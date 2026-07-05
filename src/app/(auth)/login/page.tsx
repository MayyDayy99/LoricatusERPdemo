'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { useLangStore } from '@/lib/lang-store';
import { SsoProviderButtons } from '@/components/auth/SsoProviderButtons';
import { IS_DEMO } from '@/lib/demo/config';
import { LangPicker } from '@/components/ui/lang-picker';
import { LoricatusLoader } from '@/components/loricatus-loader';

const LOGIN_T = {
  hu: {
    badge:         'Bejelentkezés',
    heading:       'Üdvözöljük vissza',
    emailLabel:    'E-mail cím',
    emailError:    'Érvénytelen e-mail cím',
    passwordLabel: 'Jelszó',
    passwordError: 'A jelszó megadása kötelező',
    submit:        'Belépés',
    submitting:    'Belépés…',
    showPw:        'Jelszó megjelenítése',
    hidePw:        'Jelszó elrejtése',
    or:            'vagy',
    successToast:  'Sikeres bejelentkezés',
    errorToast:    'Bejelentkezés sikertelen',
    footer:        'Minden jog fenntartva',
  },
  en: {
    badge:         'Login',
    heading:       'Welcome back',
    emailLabel:    'Email address',
    emailError:    'Invalid email address',
    passwordLabel: 'Password',
    passwordError: 'Password is required',
    submit:        'Sign In',
    submitting:    'Signing in…',
    showPw:        'Show password',
    hidePw:        'Hide password',
    or:            'or',
    successToast:  'Login successful',
    errorToast:    'Login failed',
    footer:        'All rights reserved',
  },
  it: {
    badge:         'Accesso',
    heading:       'Bentornati',
    emailLabel:    'Indirizzo email',
    emailError:    'Indirizzo email non valido',
    passwordLabel: 'Password',
    passwordError: 'La password è obbligatoria',
    submit:        'Accedi',
    submitting:    'Accesso…',
    showPw:        'Mostra password',
    hidePw:        'Nascondi password',
    or:            'oppure',
    successToast:  'Accesso riuscito',
    errorToast:    'Accesso non riuscito',
    footer:        'Tutti i diritti riservati',
  },
} as const;

type LoginForm = { email: string; password: string };

// Full Loricatus logo — geometric icon always in brand yellow, wordmark colour via prop
function LoricatusLogo({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  const wordmarkClass = dark ? 'fill-loricatus-dark' : 'fill-white';
  return (
    <svg
      className={className}
      viewBox="0 0 466.05 192.96"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Loricatus"
      role="img"
    >
      {/* Geometric icon — brand yellow */}
      <g className="fill-loricatus-accent">
        <path d="M211,81.94v9a2.45,2.45,0,0,1-.08.72,1.55,1.55,0,0,1-2.41.77l-.35-.32Q199.09,83,190,73.86a1.65,1.65,0,0,1-.56-1.68A1.52,1.52,0,0,1,190.87,71h.48l17.85.09a1.74,1.74,0,0,1,1.31.47,1.63,1.63,0,0,1,.47,1.22c0,1,0,2,0,3v6.17Z" />
        <path d="M234.65,82.07c.06,2.9.11,5.8.17,8.69,0,.13,0,.27,0,.39a1.46,1.46,0,0,1-.92,1.41,1.5,1.5,0,0,1-1.66-.27,1.62,1.62,0,0,1-.19-.18L213.75,73.92a1.66,1.66,0,0,1-.58-1.35,1.51,1.51,0,0,1,1.27-1.39,5.44,5.44,0,0,1,.57,0l17.59.17H233A1.58,1.58,0,0,1,234.49,73l.06,3.13c0,2,.07,4,.1,6Z" />
        <path d="M200,47.41l8.33.34c.33,0,.67,0,1,0a1.59,1.59,0,0,1,1.49,1.62c0,.7,0,1.39,0,2.09l.09,15.42c0,.12,0,.24,0,.35a1.41,1.41,0,0,1-.9,1.36,1.48,1.48,0,0,1-1.63-.23c-.11-.09-.21-.2-.32-.3l-16-16.06c-.76-.77-1.51-1.56-2.26-2.35a1.54,1.54,0,0,1-.46-1.42A1.46,1.46,0,0,1,190.93,47c.92,0,1.83.07,2.74.11l6.34.27Z" />
        <path d="M258,82.24c.17,2.46.32,4.84.48,7.22,0,.54.07,1.07.11,1.61a1.36,1.36,0,0,1-.78,1.46,1.52,1.52,0,0,1-1.71-.22,2.09,2.09,0,0,1-.22-.2c-6.23-5.85-12.35-11.81-18.43-17.81-.12-.12-.25-.24-.36-.37a1.44,1.44,0,0,1-.31-1.65,1.39,1.39,0,0,1,1.41-.89c2.26,0,4.52.07,6.77.12,3.38.06,6.75.14,10.12.22h.74a1.64,1.64,0,0,1,1.62,1.6c.18,2.81.35,5.61.53,8.41,0,.19,0,.38,0,.49" />
        <path d="M210.66,35.35c.05,3.36.08,6,.11,8.63,0,.12,0,.23,0,.35a1.3,1.3,0,0,1-.7,1.3,1.53,1.53,0,0,1-1.61-.06,2.83,2.83,0,0,1-.43-.36c-4.36-4.32-8.65-8.7-12.81-13.22-1.81-2-3.57-4-5.35-5.95a1.89,1.89,0,0,1-.47-1,1.31,1.31,0,0,1,1.41-1.59c.72.06,1.43.19,2.15.28L201.65,25l7.1,1,.39.07a1.8,1.8,0,0,1,1.38,1.68c0,2.8.1,5.59.14,7.66" />
        <path d="M270.32,72.18l7.49.32a1.75,1.75,0,0,1,1.7,1.56l2.4,15c.11.67.21,1.34.34,2a1.3,1.3,0,0,1-1.78,1.53,2.49,2.49,0,0,1-.87-.54c-2.76-2.41-5.55-4.79-8.26-7.25-3.75-3.41-7.44-6.87-11.16-10.32a2,2,0,0,1-.61-.88,1.3,1.3,0,0,1,1.23-1.73c.78,0,1.56,0,2.34.06l7.18.24" />
        <path d="M210.19,15.1c.07,2.78.15,5.26.21,7.73a1.21,1.21,0,0,1-1.61,1.3,2,2,0,0,1-1-.58c-.93-1-1.88-2-2.81-3q-5.21-5.52-10-11.43c-1.78-2.22-3.46-4.53-5.18-6.8a1.81,1.81,0,0,1-.41-1.55A1,1,0,0,1,190.66,0l.41.14c4.88,1.78,9.8,3.44,14.74,5,.83.27,1.66.52,2.49.78a2.32,2.32,0,0,1,1.06.64,1.68,1.68,0,0,1,.54,1.19c.09,2.53.2,5.07.29,7.29" />
        <path d="M224.44,48.43l7.95.42A1.53,1.53,0,0,1,234,50.54c.05,1.93.09,3.85.13,5.78q.11,4.51.19,9a2.48,2.48,0,0,1-.07.72,1.41,1.41,0,0,1-2,.74,2.12,2.12,0,0,1-.48-.37q-8.06-7.92-16.09-15.86a1.63,1.63,0,0,1-.54-.87,1.34,1.34,0,0,1,1.26-1.63,7.49,7.49,0,0,1,.82,0l7.25.33Z" />
        <path d="M256.45,58.15c.11,2,.23,3.93.35,5.9a1.18,1.18,0,0,1-.53,1.16,1.28,1.28,0,0,1-1.36.05,2.5,2.5,0,0,1-.57-.46q-6.27-6.07-12.52-12.17c-.32-.31-.65-.62-1-.94a2.4,2.4,0,0,1-.37-.53,1.15,1.15,0,0,1,1.06-1.62c.43,0,.87,0,1.3.05l4.38.31,6.57.51a7.45,7.45,0,0,1,.95.09A1.45,1.45,0,0,1,256.09,52c.08,1.09.13,2.19.2,3.29s.1,1.94.16,2.9" />
        <path d="M233.57,36.27c.06,1.68.1,3.52.2,5.36A1.25,1.25,0,0,1,232,42.89a1.84,1.84,0,0,1-.65-.41l-8.35-8-5.22-5a3.64,3.64,0,0,1-.48-.56,1,1,0,0,1,.88-1.67,9.38,9.38,0,0,1,1.29.12l7.2.93,5.2.68a1.76,1.76,0,0,1,1,.5,1.38,1.38,0,0,1,.41,1c.07,1.88.15,3.76.23,5.8" />
        <path d="M278,63.94a.94.94,0,0,1-1.28,1,2,2,0,0,1-.77-.46q-2.34-2.17-4.65-4.38-3.39-3.24-6.75-6.5a2.88,2.88,0,0,1-.41-.45A1,1,0,0,1,264.1,52a1,1,0,0,1,1-.47l2.46.27,6.07.75c.6.08,1.21.16,1.81.26a1.51,1.51,0,0,1,1.31,1.4q.61,4.69,1.21,9.39c0,.12,0,.26,0,.38" />
        <path d="M255.42,39.05c.06,1,.14,2.06.18,3.08a1.05,1.05,0,0,1-1.6,1.09,2.47,2.47,0,0,1-.63-.44c-2.31-2.16-4.6-4.33-6.91-6.48-1.4-1.31-2.83-2.61-4.25-3.91a4.36,4.36,0,0,1-.43-.43.91.91,0,0,1-.19-1,.85.85,0,0,1,.89-.49c.63.05,1.24.14,1.86.22l5.28.75c1.37.19,2.75.39,4.12.6a1.47,1.47,0,0,1,1.34,1.51c.11,1.85.23,3.7.34,5.54" />
        <path d="M232.83,21.06c0,.17,0,.34,0,.51a.76.76,0,0,1-.7.88,1.8,1.8,0,0,1-1.53-.47c-1-.88-2-1.76-2.92-2.66-2.87-2.69-5.73-5.4-8.6-8.1-.16-.15-.32-.3-.46-.46a2.69,2.69,0,0,1-.3-.37.79.79,0,0,1-.07-.82.71.71,0,0,1,.75-.34,3.16,3.16,0,0,1,.6.11q5.56,1.47,11.15,3a3.18,3.18,0,0,1,.83.35,1.34,1.34,0,0,1,.7,1.17c.17,2.41.36,4.82.54,7.23h0" />
        <path d="M275.67,43.85a.71.71,0,0,1-.69.76,1.47,1.47,0,0,1-1.21-.49c-.75-.75-1.49-1.5-2.25-2.23l-6.59-6.38a2.48,2.48,0,0,1-.44-.53.72.72,0,0,1,.56-1.13,1.55,1.55,0,0,1,.43,0l8.28,1.52a1.43,1.43,0,0,1,1.3,1.48c.19,2.27.4,4.53.59,6.79,0,.08,0,.15,0,.2" />
        <path d="M254.38,23.6c0,.13,0,.26,0,.39a.66.66,0,0,1-.66.79,1.64,1.64,0,0,1-1.12-.25,2.12,2.12,0,0,1-.38-.29l-9.2-7.54c-.19-.16-.39-.31-.56-.48a.64.64,0,0,1-.24-.66.63.63,0,0,1,.63-.38,2.81,2.81,0,0,1,.65.07l9.05,1.81a3.13,3.13,0,0,1,.69.24,1.14,1.14,0,0,1,.69,1c.12,1.76.28,3.52.43,5.28h0" />
        <path d="M274.42,26.12a.63.63,0,0,1-.52.7,1.33,1.33,0,0,1-1.22-.3c-.2-.16-.38-.34-.58-.52-2-1.87-4.13-3.62-6.26-5.36a1.75,1.75,0,0,1-.32-.29.56.56,0,0,1,.28-1,1.78,1.78,0,0,1,.65,0c.84.1,1.69.23,2.53.34,1.1.15,2.2.29,3.31.42.29,0,.58,0,.86.11a2.81,2.81,0,0,1,.68.26.92.92,0,0,1,.45.84c0,.79,0,1.59,0,2.38" />
      </g>
      {/* Wordmark — white on dark, dark on light */}
      <g className={wordmarkClass}>
        <polygon points="0 161.99 0 192.96 37.16 192.96 37.16 186.76 6.17 186.76 6.17 161.99 0 161.99" />
        <polygon points="305.03 161.99 305.03 168.16 323.54 168.16 323.54 192.84 329.71 192.84 329.71 168.16 348.21 168.16 348.21 161.99 305.03 161.99" />
        <path d="M121.49,174.33v-6.17h21.62a3.09,3.09,0,1,1,0,6.17ZM152.36,171a9.51,9.51,0,0,0-9.64-9H115.33v30.85h6.16V180.5h12.76l10,12.46h8.14l-10-12.46h.71a9.26,9.26,0,0,0,9.25-9.54" />
        <path d="M456.66,174.15H435.5a3.11,3.11,0,0,1-3.12-2.5,3,3,0,0,1,3-3.5h29.14V162h-28.8a9.42,9.42,0,0,0-9.54,8.88,9.15,9.15,0,0,0,9.16,9.44h21.14a3.36,3.36,0,0,1,3.4,2.89,3.23,3.23,0,0,1-3.21,3.57H427.32v6.16h28.95a9.65,9.65,0,0,0,9.78-9.1,9.39,9.39,0,0,0-9.39-9.68" />
        <path d="M78.79,186.67H66.46a9.26,9.26,0,1,1,0-18.51H78.79a9.26,9.26,0,1,1,0,18.51m0-24.68H66.46a15.42,15.42,0,1,0,0,30.84H78.79a15.42,15.42,0,0,0,0-30.84" />
        <rect x="172.23" y="161.99" width="6.17" height="30.84" />
        <path d="M199,178.44c.53,8.2,7.7,14.4,15.92,14.4H236v-6.17h-21.2a9.51,9.51,0,0,1-9.64-9,9.25,9.25,0,0,1,9.25-9.54H236V162H214.43A15.43,15.43,0,0,0,199,178.44" />
        <path d="M266.36,180.5l4.82-9.84a4.65,4.65,0,0,1,8.37,0l4.82,9.84Zm18.51-12.87a10,10,0,0,0-9-5.64h-1a10,10,0,0,0-9,5.64L253.6,192.84h6.76l3-6.18h24l3,6.18h6.77Z" />
        <path d="M402,176.59h0a9.25,9.25,0,0,1-9.25,9.2H380.36a9.25,9.25,0,0,1-9.25-9.2h0V162h-6.17v14.6A15.42,15.42,0,0,0,380.36,192H392.7a15.42,15.42,0,0,0,15.42-15.37V162H402Z" />
      </g>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const { locale } = useLangStore();
  const t = LOGIN_T[locale];
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [transitionPlaying, setTransitionPlaying] = useState(false);

  const loginSchema = useMemo(() => z.object({
    email: z.string().email(t.emailError),
    password: z.string().min(1, t.passwordError),
  }), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  // M-5: derive tenantId for the login request (not yet in auth store at this point)
  // Priority: subdomain → NEXT_PUBLIC_DEFAULT_TENANT_ID env var
  const getLoginTenantId = (): string => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const parts = window.location.hostname.split('.');
    // Only treat subdomain as tenantId if it looks like a UUID (ignore tunnel/preview subdomains)
    if (parts.length >= 3 && parts[0] !== 'www' && UUID_RE.test(parts[0])) return parts[0];
    return process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? '';
  };

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const tenantId = getLoginTenantId();
      const response = await apiClient.post(
        '/auth/login',
        data,
        tenantId ? { headers: { 'x-tenant-id': tenantId } } : undefined,
      );
      setAuth(response.data.accessToken, tenantId || undefined);
      toast.success(t.successToast);
      // Show the brand intro animation for ~5s before navigating to the dashboard.
      // The auth state is already set, so the dashboard is fetching data behind the loader.
      setTransitionPlaying(true);
      setTimeout(() => router.push('/dashboard'), 5000);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t.errorToast);
      setLoading(false);
    }
  };

  if (transitionPlaying) return <LoricatusLoader />;

  const inputBase =
    'w-full px-4 py-3 text-sm rounded bg-gray-50 text-loricatus-dark outline-none border transition-all duration-150 ' +
    'focus:border-loricatus-accent focus:ring-2 focus:ring-loricatus-accent/20';

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── Left panel — brand dark ── */}
      <div className="relative flex flex-col justify-between bg-loricatus-dark md:w-[55%] px-12 py-14 overflow-hidden">

        {/* Decorative watermark icon */}
        <div
          className="pointer-events-none absolute -bottom-16 -right-16 w-[420px] h-[420px] opacity-[0.06]"
          aria-hidden="true"
        >
          <svg viewBox="185 0 105 97" xmlns="http://www.w3.org/2000/svg" className="fill-loricatus-accent">
            <path d="M211,81.94v9a2.45,2.45,0,0,1-.08.72,1.55,1.55,0,0,1-2.41.77l-.35-.32Q199.09,83,190,73.86a1.65,1.65,0,0,1-.56-1.68A1.52,1.52,0,0,1,190.87,71h.48l17.85.09a1.74,1.74,0,0,1,1.31.47,1.63,1.63,0,0,1,.47,1.22c0,1,0,2,0,3v6.17Z" />
            <path d="M234.65,82.07c.06,2.9.11,5.8.17,8.69,0,.13,0,.27,0,.39a1.46,1.46,0,0,1-.92,1.41,1.5,1.5,0,0,1-1.66-.27,1.62,1.62,0,0,1-.19-.18L213.75,73.92a1.66,1.66,0,0,1-.58-1.35,1.51,1.51,0,0,1,1.27-1.39,5.44,5.44,0,0,1,.57,0l17.59.17H233A1.58,1.58,0,0,1,234.49,73l.06,3.13c0,2,.07,4,.1,6Z" />
            <path d="M200,47.41l8.33.34c.33,0,.67,0,1,0a1.59,1.59,0,0,1,1.49,1.62c0,.7,0,1.39,0,2.09l.09,15.42c0,.12,0,.24,0,.35a1.41,1.41,0,0,1-.9,1.36,1.48,1.48,0,0,1-1.63-.23c-.11-.09-.21-.2-.32-.3l-16-16.06c-.76-.77-1.51-1.56-2.26-2.35a1.54,1.54,0,0,1-.46-1.42A1.46,1.46,0,0,1,190.93,47c.92,0,1.83.07,2.74.11l6.34.27Z" />
            <path d="M258,82.24c.17,2.46.32,4.84.48,7.22,0,.54.07,1.07.11,1.61a1.36,1.36,0,0,1-.78,1.46,1.52,1.52,0,0,1-1.71-.22,2.09,2.09,0,0,1-.22-.2c-6.23-5.85-12.35-11.81-18.43-17.81-.12-.12-.25-.24-.36-.37a1.44,1.44,0,0,1-.31-1.65,1.39,1.39,0,0,1,1.41-.89c2.26,0,4.52.07,6.77.12,3.38.06,6.75.14,10.12.22h.74a1.64,1.64,0,0,1,1.62,1.6c.18,2.81.35,5.61.53,8.41,0,.19,0,.38,0,.49" />
            <path d="M210.66,35.35c.05,3.36.08,6,.11,8.63,0,.12,0,.23,0,.35a1.3,1.3,0,0,1-.7,1.3,1.53,1.53,0,0,1-1.61-.06,2.83,2.83,0,0,1-.43-.36c-4.36-4.32-8.65-8.7-12.81-13.22-1.81-2-3.57-4-5.35-5.95a1.89,1.89,0,0,1-.47-1,1.31,1.31,0,0,1,1.41-1.59c.72.06,1.43.19,2.15.28L201.65,25l7.1,1,.39.07a1.8,1.8,0,0,1,1.38,1.68c0,2.8.1,5.59.14,7.66" />
            <path d="M270.32,72.18l7.49.32a1.75,1.75,0,0,1,1.7,1.56l2.4,15c.11.67.21,1.34.34,2a1.3,1.3,0,0,1-1.78,1.53,2.49,2.49,0,0,1-.87-.54c-2.76-2.41-5.55-4.79-8.26-7.25-3.75-3.41-7.44-6.87-11.16-10.32a2,2,0,0,1-.61-.88,1.3,1.3,0,0,1,1.23-1.73c.78,0,1.56,0,2.34.06l7.18.24" />
            <path d="M210.19,15.1c.07,2.78.15,5.26.21,7.73a1.21,1.21,0,0,1-1.61,1.3,2,2,0,0,1-1-.58c-.93-1-1.88-2-2.81-3q-5.21-5.52-10-11.43c-1.78-2.22-3.46-4.53-5.18-6.8a1.81,1.81,0,0,1-.41-1.55A1,1,0,0,1,190.66,0l.41.14c4.88,1.78,9.8,3.44,14.74,5,.83.27,1.66.52,2.49.78a2.32,2.32,0,0,1,1.06.64,1.68,1.68,0,0,1,.54,1.19c.09,2.53.2,5.07.29,7.29" />
            <path d="M224.44,48.43l7.95.42A1.53,1.53,0,0,1,234,50.54c.05,1.93.09,3.85.13,5.78q.11,4.51.19,9a2.48,2.48,0,0,1-.07.72,1.41,1.41,0,0,1-2,.74,2.12,2.12,0,0,1-.48-.37q-8.06-7.92-16.09-15.86a1.63,1.63,0,0,1-.54-.87,1.34,1.34,0,0,1,1.26-1.63,7.49,7.49,0,0,1,.82,0l7.25.33Z" />
          </svg>
        </div>

        {/* Top: Logo */}
        <LoricatusLogo dark={false} className="w-52 md:w-64 relative z-10" />

        {/* Center: Headline */}
        <div className="flex-1 flex flex-col justify-center py-16 relative z-10">
          <div className="w-8 h-0.5 mb-8 bg-loricatus-accent" />
          <h2 className="text-3xl md:text-4xl font-light leading-snug tracking-tight text-white">
            Építőipar 4.0
            <br />
            <span className="font-semibold text-loricatus-accent">egy platformon.</span>
          </h2>
          <p className="mt-6 text-sm leading-relaxed max-w-xs text-loricatus-silver">
            Projektek, dokumentumok, szerződések és csapatok — áttekinthetően,
            biztonságosan, valós időben.
          </p>
        </div>

        {/* Bottom */}
        <p className="text-xs tracking-widest uppercase text-loricatus-graphite relative z-10">
          Construction SaaS &nbsp;·&nbsp; v2.0
        </p>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex-1 flex items-center justify-center bg-white px-8 py-14 md:px-16">
        <div className="w-full max-w-sm">

          {/* Mobile-only logo */}
          <div className="flex justify-center mb-10 md:hidden">
            <LoricatusLogo dark className="w-44" />
          </div>

          {/* Language picker — right-aligned, above heading */}
          <div className="flex justify-end mb-6">
            <LangPicker variant="full" />
          </div>

          {/* Heading */}
          <div className="mb-10">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-2 text-loricatus-accent">
              {t.badge}
            </p>
            <h1 className="text-2xl font-semibold text-loricatus-dark">
              {t.heading}
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold tracking-widest uppercase mb-2 text-loricatus-dark"
              >
                {t.emailLabel}
              </label>
              <input
                id="email"
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="nev@ceg.hu"
                className={`${inputBase} ${errors.email ? 'border-red-400' : 'border-gray-200'}`}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold tracking-widest uppercase mb-2 text-loricatus-dark"
              >
                {t.passwordLabel}
              </label>
              <div className="relative">
                <input
                  id="password"
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`${inputBase} pr-11 ${errors.password ? 'border-red-400' : 'border-gray-200'}`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-loricatus-silver hover:text-loricatus-graphite transition rounded"
                  aria-label={showPassword ? t.hidePw : t.showPw}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-semibold tracking-widest uppercase rounded bg-loricatus-accent text-loricatus-dark hover:bg-brand-600 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t.submitting}
                </span>
              ) : t.submit}
            </button>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 tracking-widest uppercase">{t.or}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* SSO — demó módban rejtve (nincs valós OAuth-backend) */}
          {!IS_DEMO && <SsoProviderButtons />}

          {/* Demó belépés */}
          {IS_DEMO && (
            <button
              type="button"
              onClick={() => {
                setAuth('demo-access-token', 'demo-tenant-0001');
                router.push('/dashboard');
              }}
              className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-amber-950 transition hover:bg-amber-400"
            >
              🎭 Démó belépés (egy kattintással)
            </button>
          )}

          {/* Footer */}
          <p className="mt-10 text-center text-xs text-loricatus-silver">
            &copy; {new Date().getFullYear()} Loricatus Kft. &nbsp;·&nbsp; {t.footer}
          </p>
        </div>
      </div>
    </div>
  );
}
