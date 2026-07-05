'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useThemeStore } from '@/lib/theme-store';
import { Sidebar, MobileMenuToggle } from '@/components/layout/sidebar';
import { NotificationBell } from '@/components/layout/notification-bell';
import { CommandPalette } from '@/components/layout/command-palette';
import { RoleSwitcher } from '@/components/role-switcher';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { useAuthStore } from '@/lib/auth-store';
import { WelcomeModal } from '@/components/onboarding/welcome-modal';
import { GuidedTour } from '@/components/onboarding/guided-tour';
import { HelpPanel } from '@/components/onboarding/help-panel';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken, _hasHydrated } = useAuthStore();
  const { theme } = useThemeStore();
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // F5 frissítés után az accessToken (memória) elveszik, de a refresh_token
  // httpOnly cookie megmarad. Mielőtt /login-ra dobnánk, csendben próbáljuk
  // visszaszerezni a session-t, hogy a felhasználó észre se vegye a refresh-t.
  const [refreshTried, setRefreshTried] = useState(false);

  // Zustand persist hydration után alkalmazza a mentett témát
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useEffect(() => {
    if (!_hasHydrated || accessToken || refreshTried) return;
    const ac = new AbortController();
    fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      signal: ac.signal,
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { accessToken: string }) => {
        if (data?.accessToken) {
          useAuthStore.getState().setAuth(data.accessToken);
        }
      })
      .catch(() => { /* refresh failed — final redirect handled below */ })
      .finally(() => setRefreshTried(true));
    return () => ac.abort();
  }, [_hasHydrated, accessToken, refreshTried]);

  useEffect(() => {
    if (_hasHydrated && refreshTried && !accessToken) {
      router.push('/login');
    }
  }, [_hasHydrated, refreshTried, accessToken, router]);

  if (!_hasHydrated) return null;
  // Avoid flashing /login while the silent refresh is in flight.
  if (!accessToken && !refreshTried) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-sm text-gray-400">Munkamenet ellenőrzése…</div>
      </div>
    );
  }
  if (!accessToken) return null;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        onHelpClick={openHelp}
        isMobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ImpersonationBanner />
        <header className="h-12 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 px-5 shrink-0">
          <MobileMenuToggle onClick={() => setMobileNavOpen(true)} />
          <CommandPalette />
          <div className="ml-auto flex items-center gap-3">
            <RoleSwitcher />
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      <WelcomeModal />
      <GuidedTour />
      <HelpPanel open={helpOpen} onClose={closeHelp} />
    </div>
  );
}
