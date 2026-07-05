'use client';

// This page is always dynamic — it reads URL fragments and query params at runtime.
// Static pre-rendering would fail because useSearchParams() requires Suspense in Next.js 15.
export const dynamic = 'force-dynamic';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';

/**
 * SSO callback landing page.
 *
 * After a successful OAuth flow the backend redirects here with the access token
 * in the URL fragment: /auth/sso-callback#access_token=...&expires_in=15m
 *
 * Using the fragment (hash) keeps the token out of server logs and browser history.
 * The refresh token has already been set by the backend as an httpOnly cookie.
 */
function SsoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    // Provider-reported error passed as a query param (not fragment) by the callback controller
    const ssoError = searchParams.get('sso_error');
    if (ssoError) {
      // M-4: sanitize before displaying — strip anything beyond a short plain-text message
      const safeError = decodeURIComponent(ssoError).replace(/[<>"']/g, '').slice(0, 200);
      toast.error(`SSO hiba: ${safeError}`);
      router.replace('/login');
      return;
    }

    // Parse the access token from the URL fragment
    const hash = window.location.hash.slice(1); // strip leading '#'
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');

    if (!accessToken) {
      toast.error('SSO bejelentkezés sikertelen — hiányzó token');
      router.replace('/login');
      return;
    }

    // Persist in auth store (same as local login) and clean up the URL
    setAuth(accessToken);
    window.history.replaceState(null, '', window.location.pathname);

    toast.success('Sikeres bejelentkezés');
    router.replace('/dashboard');
  }, [router, searchParams, setAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Bejelentkezés feldolgozása…</p>
      </div>
    </div>
  );
}

export default function SsoCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
        </div>
      }
    >
      <SsoCallbackContent />
    </Suspense>
  );
}
