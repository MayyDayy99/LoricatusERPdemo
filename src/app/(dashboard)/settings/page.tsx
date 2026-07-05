'use client';

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Save, RefreshCw, CheckCircle2, AlertCircle, Camera, Shield, Bell, Building2, User, RotateCcw, Sun, Moon, Monitor, Database, Trash2, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser, updateProfile, updatePreferences, uploadMyAvatar, deleteMyAvatar, useMyAvatarUrl } from '@/lib/hooks/use-users';
import { useTenant, updateBranding, updateCompanyProfile } from '@/lib/hooks/use-tenants';
import { useT } from '@/lib/hooks/use-t';
import { useOnboardingStore } from '@/lib/onboarding-store';
import { useThemeStore } from '@/lib/theme-store';
import { useDemoStatus, seedDemo, resetDemo, clearDemo } from '@/lib/hooks/use-demo';
import { SidebarCustomizeSection } from '@/components/settings/sidebar-customize-section';

/* ─── section card ───────────────────────────────────────────────────────────── */

function Section({ icon, title, description, children }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-3 pb-1 border-b border-gray-50">
        <span className="text-brand-500">{icon}</span>
        <div>
          <h2 className="font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ─── save button helper ─────────────────────────────────────────────────────── */

function SaveButton({ status, label }: { status: 'idle' | 'saving' | 'saved' | 'error'; label?: string }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={status === 'saving'}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60"
      >
        {status === 'saving'
          ? <RefreshCw className="w-4 h-4 animate-spin" />
          : <Save className="w-4 h-4" />}
        {status === 'saving' ? t.settings.savingBtn : (label ?? t.settings.saveBtn)}
      </button>
      {status === 'saved' && (
        <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
          <CheckCircle2 className="w-4 h-4" /> {t.settings.savedMsg}
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
          <AlertCircle className="w-4 h-4" /> {t.settings.errorMsg}
        </span>
      )}
    </div>
  );
}

/* ─── profile section ─────────────────────────────────────────────────────────── */

function ProfileSection() {
  const t = useT();
  const { currentUser, mutate } = useCurrentUser();
  const { url: avatarUrl, mutate: mutateAvatar } = useMyAvatarUrl();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      setForm({ firstName: currentUser.firstName, lastName: currentUser.lastName, email: currentUser.email });
    }
  }, [currentUser]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setStatus('saving');
    try {
      await updateProfile(currentUser.id, form);
      await mutate();
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2500);
    } catch {
      setStatus('error');
    }
  }

  async function handleAvatarUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('A fájl nagyobb, mint 5 MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Csak JPG, PNG vagy WEBP fájl engedélyezett');
      return;
    }
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      await uploadMyAvatar(file);
      await Promise.all([mutate(), mutateAvatar()]);
    } catch (err: any) {
      setAvatarError(err?.response?.data?.message ?? 'Feltöltés sikertelen');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAvatarDelete() {
    if (!confirm('Törlöd a profilképet?')) return;
    try {
      await deleteMyAvatar();
      await Promise.all([mutate(), mutateAvatar()]);
    } catch (err: any) {
      setAvatarError(err?.response?.data?.message ?? 'Törlés sikertelen');
    }
  }

  const initials = currentUser
    ? `${currentUser.firstName?.[0] ?? ''}${currentUser.lastName?.[0] ?? ''}`.toUpperCase()
    : '';

  return (
    <Section icon={<User className="w-5 h-5" />} title={t.settings.profileTitle} description={t.settings.profileDesc}>
      {/* Profilkép */}
      <div className="flex items-center gap-4 pb-4 border-b border-gray-50">
        <div className="relative">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Profilkép"
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-100"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xl font-bold">
              {initials || <User className="w-8 h-8" />}
            </div>
          )}
          {avatarUploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg text-sm font-medium hover:bg-brand-100 disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              Kép feltöltése
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleAvatarDelete}
                disabled={avatarUploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Törlés
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">JPG, PNG vagy WEBP, max 5 MB. Ajánlott: 256×256 px.</p>
          {avatarError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {avatarError}
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }}
          />
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="prof-firstname" className="block text-sm font-medium text-gray-700 mb-1.5">{t.settings.firstNameLabel}</label>
            <input id="prof-firstname" type="text" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label htmlFor="prof-lastname" className="block text-sm font-medium text-gray-700 mb-1.5">{t.settings.lastNameLabel}</label>
            <input id="prof-lastname" type="text" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
        </div>
        <div>
          <label htmlFor="prof-email" className="block text-sm font-medium text-gray-700 mb-1.5">{t.settings.emailLabel}</label>
          <input id="prof-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <SaveButton status={status} />
      </form>
    </Section>
  );
}

/* ─── password section ────────────────────────────────────────────────────────── */

function PasswordSection() {
  const t = useT();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (form.next !== form.confirm) { setError(t.settings.pwMismatch); return; }
    if (form.next.length < 8) { setError(t.settings.pwTooShort); return; }
    setError(null);
    setStatus('saving');
    try {
      await apiClient.post('/auth/change-password', { currentPassword: form.current, newPassword: form.next });
      setStatus('saved');
      setForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.settings.errorMsg);
      setStatus('error');
    }
  }

  return (
    <Section icon={<Shield className="w-5 h-5" />} title={t.settings.passwordTitle} description={t.settings.passwordDesc}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="pw-current" className="block text-sm font-medium text-gray-700 mb-1.5">{t.settings.currentPw}</label>
          <input id="pw-current" type="password" value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="pw-new" className="block text-sm font-medium text-gray-700 mb-1.5">{t.settings.newPw}</label>
            <input id="pw-new" type="password" value={form.next} onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} required minLength={8} maxLength={128}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="block text-sm font-medium text-gray-700 mb-1.5">{t.settings.confirmPw}</label>
            <input id="pw-confirm" type="password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}
        <SaveButton status={status} label={t.settings.changePwBtn} />
      </form>
    </Section>
  );
}

/* ─── 2FA recovery codes section ─────────────────────────────────────────────── */

function TwoFASection() {
  const t = useT();
  const { currentUser } = useCurrentUser();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/auth/2fa/recovery-codes');
      setCodes(res.data.codes as string[]);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.settings.errorMsg);
    } finally {
      setLoading(false);
    }
  }

  if (!currentUser?.twoFactorEnabled) return null;

  return (
    <Section icon={<Shield className="w-5 h-5" />} title={t.settings.mfaTitle} description={t.settings.mfaDesc}>
      {codes ? (
        <div className="space-y-3">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Mentsd el ezeket a kódokat biztonságos helyre — csak egyszer jelennek meg!
          </p>
          <div className="grid grid-cols-2 gap-2">
            {codes.map((c) => (
              <code key={c} className="font-mono text-sm bg-gray-100 px-3 py-1.5 rounded text-center tracking-widest">{c}</code>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCodes(null)}
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            {t.common.cancel}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Generálj 10 egyszeri mentési kódot. A korábban generált kódok érvénytelenek lesznek.
          </p>
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {loading ? t.settings.savingBtn : 'Mentési kódok generálása'}
          </button>
        </div>
      )}
    </Section>
  );
}

/* ─── notifications section ───────────────────────────────────────────────────── */

const PREF_DEFAULTS: Record<string, boolean> = {
  uploadComplete: true,
  documentSigned: true,
  shareLinkAccessed: false,
  weeklyReport: false,
};

function NotificationsSection() {
  const t = useT();
  const { currentUser } = useCurrentUser();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(PREF_DEFAULTS);

  useEffect(() => {
    if (currentUser?.notificationPreferences && Object.keys(currentUser.notificationPreferences).length > 0) {
      setPrefs({ ...PREF_DEFAULTS, ...currentUser.notificationPreferences });
    }
  }, [currentUser]);

  const items = [
    { key: 'uploadComplete',    label: 'Fájlfeltöltés kész',         desc: 'Értesítés, ha egy feltöltés feldolgozása befejeződött' },
    { key: 'documentSigned',    label: 'Dokumentum aláírva',          desc: 'Értesítés, ha egy dokumentumot jóváhagytak' },
    { key: 'shareLinkAccessed', label: 'Megosztási link megnyitva',   desc: 'Értesítés, ha valaki megnyitott egy megosztási linket' },
    { key: 'weeklyReport',      label: 'Heti összefoglaló (e-mail)',   desc: 'Heti projektalapú tevékenységi összefoglaló e-mailben' },
  ] as const;

  async function handleToggle(key: string) {
    if (!currentUser) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    try {
      await updatePreferences(currentUser.id, updated);
    } catch {
      setPrefs(prefs); // revert on error
    }
  }

  return (
    <Section icon={<Bell className="w-5 h-5" />} title={t.settings.notifTitle} description={t.settings.notifDesc}>
      <div className="divide-y divide-gray-50">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle(item.key)}
              title={item.label}
              className={clsx(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                prefs[item.key] ? 'bg-brand-600' : 'bg-gray-200',
              )}
            >
              <span className={clsx('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', prefs[item.key] ? 'translate-x-4.5' : 'translate-x-0.5')} />
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400">Az értesítési preferenciák mentése automatikus.</p>
    </Section>
  );
}

/* ─── appearance section ──────────────────────────────────────────────────────── */

function AppearanceSection() {
  const { theme, setTheme } = useThemeStore();

  return (
    <Section icon={<Monitor className="w-5 h-5" />} title="Megjelenés" description="Válassz világos vagy sötét felületi témát">
      <div className="flex gap-3">
        {([
          { value: 'light' as const, label: 'Világos', Icon: Sun },
          { value: 'dark'  as const, label: 'Sötét',   Icon: Moon },
        ]).map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={clsx(
              'flex flex-col items-center gap-2 flex-1 rounded-xl border-2 py-4 px-3 transition',
              theme === value
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-sm font-medium">{label}</span>
            {theme === value && (
              <span className="text-[10px] font-semibold bg-brand-500 text-white px-2 py-0.5 rounded-full">Aktív</span>
            )}
          </button>
        ))}
      </div>
    </Section>
  );
}

/* ─── onboarding section ─────────────────────────────────────────────────────── */

function OnboardingSection() {
  const t = useT();
  const td = t.tutorial.demo;
  const { mainTour, resetOnboarding } = useOnboardingStore();
  const [confirmed, setConfirmed] = useState(false);
  const { status, mutate } = useDemoStatus();
  const [busy, setBusy] = useState<'seed' | 'reset' | 'clear' | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [showWhat, setShowWhat] = useState(false);

  const isSeeded = status?.isSeeded ?? false;
  const isBusy = busy !== null;

  function handleReset() {
    resetOnboarding();
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 2500);
  }

  function showToast(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSeed() {
    if (!window.confirm(`${td.btnLoad}?`)) return;
    setBusy('seed');
    try { await seedDemo(); await mutate(); showToast('ok', td.successLoad); }
    catch { showToast('err', td.errorLoad); }
    finally { setBusy(null); }
  }

  async function handleDemoReset() {
    if (!window.confirm(td.confirmReset)) return;
    setBusy('reset');
    try { await resetDemo(); await mutate(); showToast('ok', td.successReset); }
    catch { showToast('err', td.errorReset); }
    finally { setBusy(null); }
  }

  async function handleClear() {
    if (!window.confirm(td.confirmClear)) return;
    setBusy('clear');
    try { await clearDemo(); await mutate(); showToast('ok', td.successClear); }
    catch { showToast('err', td.errorClear); }
    finally { setBusy(null); }
  }

  return (
    <Section icon={<RotateCcw className="w-5 h-5" />} title={t.tutorial.helpPanel.title} description={t.tutorial.helpPanel.subtitle}>

      {/* Tour reset */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {mainTour === 'completed' || mainTour === 'dismissed'
            ? t.tutorial.helpPanel.completed
            : mainTour === 'in_progress' ? 'In progress…' : '—'}
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-700 border border-gray-200 rounded-lg px-3 py-1.5 transition"
        >
          {confirmed ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <RotateCcw className="w-4 h-4" />}
          {t.tutorial.helpPanel.restartMain}
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Demo adatok szekció */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-brand-500" />
            <span className="text-sm font-semibold text-gray-900">{td.sectionTitle}</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            isSeeded ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {isSeeded
              ? `${td.statusLoaded} · ${td.entityCount(status?.counts.total ?? 0)}`
              : td.statusEmpty}
          </span>
        </div>

        <p className="text-xs text-gray-500">{td.sectionSubtitle}</p>

        {/* Akciógombok */}
        {!isSeeded ? (
          <button
            onClick={handleSeed}
            disabled={isBusy}
            className="flex items-center gap-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2 transition disabled:opacity-50"
          >
            {busy === 'seed' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {busy === 'seed' ? td.loading : td.btnLoad}
          </button>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleDemoReset}
              disabled={isBusy}
              className="flex items-center gap-2 text-sm border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg px-4 py-2 transition disabled:opacity-50"
            >
              {busy === 'reset' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {busy === 'reset' ? td.loading : td.btnReset}
            </button>
            <button
              onClick={handleClear}
              disabled={isBusy}
              className="flex items-center gap-2 text-sm border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg px-4 py-2 transition disabled:opacity-50"
            >
              {busy === 'clear' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {busy === 'clear' ? td.loading : td.btnClear}
            </button>
          </div>
        )}

        {/* Mit tölt be? */}
        <button
          onClick={() => setShowWhat(v => !v)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"
        >
          {showWhat ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {td.what.title}
        </button>
        {showWhat && (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 pl-1">
            {[td.what.accounts, td.what.customers, td.what.projects, td.what.deals,
              td.what.quotes, td.what.workOrders, td.what.contracts, td.what.activities, td.what.tasks, td.what.timesheets
            ].map((label) => (
              <li key={label} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-brand-400 flex-shrink-0" />
                {label}
              </li>
            ))}
          </ul>
        )}

        {/* Toast */}
        {toast && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
            toast.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {toast.type === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
            {toast.msg}
          </div>
        )}
      </div>
    </Section>
  );
}

/* ─── company profile section ─────────────────────────────────────────────────── */

function CompanyProfileSection() {
  const t = useT();
  const { tenant, mutate } = useTenant();
  const [form, setForm] = useState({
    companyName: '', address: '', taxId: '', registrationNumber: '', ceoName: '',
    defaultContactName: '', defaultContactPhone: '', defaultContactEmail: '', defaultContactTitle: '',
    warrantyTemplate: '', defaultSignatory: '', defaultSignatoryTitle: '',
    defaultCurrency: 'HUF',
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (tenant) {
      setForm({
        companyName: tenant.companyName ?? '',
        address: tenant.address ?? '',
        taxId: tenant.taxId ?? '',
        registrationNumber: tenant.registrationNumber ?? '',
        ceoName: tenant.ceoName ?? '',
        defaultContactName: tenant.defaultContactName ?? '',
        defaultContactPhone: tenant.defaultContactPhone ?? '',
        defaultContactEmail: tenant.defaultContactEmail ?? '',
        defaultContactTitle: tenant.defaultContactTitle ?? '',
        warrantyTemplate: tenant.warrantyTemplate ?? '',
        defaultSignatory: tenant.defaultSignatory ?? '',
        defaultSignatoryTitle: tenant.defaultSignatoryTitle ?? '',
        defaultCurrency: tenant.defaultCurrency ?? 'HUF',
      });
    }
  }, [tenant]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    try {
      const dto: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(form)) dto[k] = v || undefined;
      await updateCompanyProfile(dto);
      await mutate();
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2500);
    } catch {
      setStatus('error');
    }
  }

  const inp = (id: string, key: keyof typeof form, label: string, type = 'text') => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input id={id} type={type} value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
    </div>
  );

  return (
    <Section icon={<Building2 className="w-5 h-5" />} title={t.settings.companyTitle} description={t.settings.companyDesc}>
      <form onSubmit={handleSave} className="space-y-4">
        {inp('cp-name', 'companyName', t.settings.companyName)}
        {inp('cp-addr', 'address', t.settings.address)}
        <div className="grid grid-cols-2 gap-4">
          {inp('cp-tax', 'taxId', t.settings.taxId)}
          {inp('cp-reg', 'registrationNumber', t.settings.registrationNumber)}
        </div>
        {inp('cp-ceo', 'ceoName', t.settings.ceoName)}

        <div className="border-t border-gray-100 pt-4 mt-4">
          <p className="text-xs text-gray-400 mb-3">Kapcsolattartó</p>
          <div className="grid grid-cols-2 gap-4">
            {inp('cp-cn', 'defaultContactName', t.settings.contactName)}
            {inp('cp-ct', 'defaultContactTitle', t.settings.contactTitle)}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3">
            {inp('cp-cp', 'defaultContactPhone', t.settings.contactPhone, 'tel')}
            {inp('cp-ce', 'defaultContactEmail', t.settings.contactEmail, 'email')}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 mt-4">
          <p className="text-xs text-gray-400 mb-3">Dokumentum alapértékek</p>
          <div>
            <label htmlFor="cp-wt" className="block text-sm font-medium text-gray-700 mb-1.5">{t.settings.warrantyTemplate}</label>
            <textarea id="cp-wt" rows={3} value={form.warrantyTemplate}
              onChange={e => setForm(f => ({ ...f, warrantyTemplate: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3">
            {inp('cp-sig', 'defaultSignatory', t.settings.defaultSignatory)}
            {inp('cp-sigt', 'defaultSignatoryTitle', t.settings.defaultSignatoryTitle)}
          </div>
          <div className="mt-3">
            <label htmlFor="cp-cur" className="block text-sm font-medium text-gray-700 mb-1.5">{t.settings.defaultCurrency}</label>
            <select
              id="cp-cur"
              value={form.defaultCurrency}
              onChange={e => setForm(f => ({ ...f, defaultCurrency: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="HUF">HUF — Forint</option>
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — Dollar</option>
              <option value="GBP">GBP — Pound</option>
              <option value="CHF">CHF — Swiss Franc</option>
              <option value="RON">RON — Leu</option>
              <option value="CZK">CZK — Koruna</option>
              <option value="PLN">PLN — Złoty</option>
            </select>
          </div>
        </div>

        <SaveButton status={status} />
      </form>
    </Section>
  );
}

/* ─── workspace section ──────────────────────────────────────────────────────── */

function WorkspaceSection() {
  const t = useT();
  const { tenant, mutate } = useTenant();
  const [form, setForm] = useState({ displayName: '', logoUrl: '' });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (tenant) {
      setForm({ displayName: tenant.displayName ?? '', logoUrl: tenant.logoUrl ?? '' });
    }
  }, [tenant]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    try {
      await updateBranding({ displayName: form.displayName || undefined, logoUrl: form.logoUrl || undefined });
      await mutate();
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2500);
    } catch {
      setStatus('error');
    }
  }

  return (
    <Section icon={<Building2 className="w-5 h-5" />} title={t.settings.tenantTitle} description={t.settings.tenantDesc}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="ws-name" className="block text-sm font-medium text-gray-700 mb-1.5">{t.settings.tenantNameLabel}</label>
          <input
            id="ws-name"
            type="text"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            maxLength={200}
            placeholder={tenant?.name ?? ''}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <p className="text-xs text-gray-400 mt-1">Megjelenítési név — ha üres, az alap slug kerül megjelenítésre.</p>
        </div>
        <div>
          <label htmlFor="ws-logo" className="block text-sm font-medium text-gray-700 mb-1.5">Logó URL</label>
          <input
            id="ws-logo"
            type="url"
            value={form.logoUrl}
            onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
            maxLength={2000}
            placeholder="https://cdn.example.com/logo.png"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          {form.logoUrl && (
            <img src={form.logoUrl} alt="Logo előnézet" className="mt-2 h-10 object-contain rounded border border-gray-100 p-1" />
          )}
        </div>
        <SaveButton status={status} />
      </form>
    </Section>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const t = useT();
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.settings.title}</h1>
        <p className="text-gray-500 mt-1">Profil, jelszó és munkaterület-beállítások</p>
      </div>

      <AppearanceSection />
      <ProfileSection />
      <PasswordSection />
      <TwoFASection />
      <NotificationsSection />
      <SidebarCustomizeSection />
      <OnboardingSection />
      <WorkspaceSection />
      <CompanyProfileSection />
    </div>
  );
}
