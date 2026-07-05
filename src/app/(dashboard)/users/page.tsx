'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Plus, UserCheck, AlertCircle, X, Users, UserX, UserCog, KeyRound, Copy, Check } from 'lucide-react';
import { useUsers, createUser, updateUserRole, setUserActive, resetUserPassword, useCurrentUser, type User } from '@/lib/hooks/use-users';
import { useT } from '@/lib/hooks/use-t';

/* ─── constants ──────────────────────────────────────────────────────────────── */

const ROLE_STYLES: Record<string, string> = {
  admin:     'bg-red-100 text-red-700',
  ceo:       'bg-purple-100 text-purple-700',
  manager:   'bg-blue-100 text-blue-700',
  operative: 'bg-amber-100 text-amber-700',
  client:    'bg-gray-100 text-gray-600',
};

/* ─── user row ───────────────────────────────────────────────────────────────── */

function UserRow({
  user,
  currentUserId,
  onRefresh,
  onDeactivate,
  onResetPassword,
}: {
  user: User;
  currentUserId: string | null;
  onRefresh: () => void;
  onDeactivate: (user: User) => void;
  onResetPassword: (user: User) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [newRole, setNewRole] = useState(user.role);
  const [busy, setBusy] = useState(false);

  const isSelf = currentUserId === user.id;

  async function handleRoleChange() {
    if (newRole === user.role) { setEditing(false); return; }
    setBusy(true);
    try {
      await updateUserRole(user.id, newRole);
      onRefresh();
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleReactivate() {
    setBusy(true);
    try {
      await setUserActive(user.id, true);
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Hiba történt');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={clsx(
      'flex items-center gap-4 py-3.5 px-4 rounded-xl border transition',
      user.isActive
        ? 'bg-white border-gray-100 hover:shadow-sm'
        : 'bg-gray-50 border-gray-200 opacity-75',
    )}>
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
        {user.firstName[0]}{user.lastName[0]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900">{user.firstName} {user.lastName}</p>
        <p className="text-xs text-gray-400 truncate">{user.email}</p>
      </div>

      {/* Role */}
      {editing ? (
        <div className="flex items-center gap-2">
          <select
            title={t.users.roleLabel}
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as User['role'])}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            {t.users.roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button type="button" onClick={handleRoleChange} disabled={busy}
            className="px-2.5 py-1 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition disabled:opacity-60">
            {busy ? '…' : t.users.saveRole}
          </button>
          <button type="button" onClick={() => { setEditing(false); setNewRole(user.role); }}
            title={t.common.cancel}
            className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className={clsx('text-xs font-semibold px-2.5 py-0.5 rounded-full', ROLE_STYLES[user.role])}>
            {t.users.roleLabels[user.role as keyof typeof t.users.roleLabels]}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-gray-400 hover:text-brand-600 px-2 py-0.5 rounded transition"
          >
            {t.common.modify}
          </button>
        </div>
      )}

      {/* Jelszó visszaállítása */}
      <button
        type="button"
        onClick={() => onResetPassword(user)}
        title="Jelszó visszaállítása — új jelszót állít be a felhasználónak"
        className="text-xs text-gray-400 hover:text-brand-600 px-2 py-0.5 rounded transition"
      >
        <KeyRound className="w-4 h-4" />
      </button>

      {/* Activate / Deactivate */}
      {!isSelf && (
        user.isActive ? (
          <button
            type="button"
            onClick={() => onDeactivate(user)}
            disabled={busy}
            title="Fiók inaktiválása — belépést és műveleteket letiltja"
            className="text-xs text-gray-400 hover:text-red-600 px-2 py-0.5 rounded transition disabled:opacity-50"
          >
            <UserX className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReactivate}
            disabled={busy}
            title="Fiók aktiválása"
            className="text-xs text-gray-400 hover:text-green-600 px-2 py-0.5 rounded transition disabled:opacity-50"
          >
            <UserCog className="w-4 h-4" />
          </button>
        )
      )}

      {/* Status */}
      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', user.isActive ? 'bg-green-400' : 'bg-gray-300')}
        title={user.isActive ? t.common.active : t.common.inactive} />
    </div>
  );
}

/* ─── deactivate confirmation modal ─────────────────────────────────────────── */

function DeactivateUserModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useT();
  const [confirmEmail, setConfirmEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = confirmEmail.trim().toLowerCase() === user.email.toLowerCase();

  async function handleConfirm() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await setUserActive(user.id, false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Hiba történt');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Felhasználó inaktiválása</h2>
          <button type="button" onClick={onClose} title={t.common.cancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 space-y-1.5">
          <p className="font-semibold">{user.firstName} {user.lastName} &lt;{user.email}&gt;</p>
          <p>A fiók inaktiválása után a felhasználó <strong>nem tud belépni</strong>, és a futó sessionje is megszűnik.</p>
          <p className="text-xs text-amber-700">Ez egy visszafordítható művelet — későbbi aktiválással a fiók visszakapható. <strong>Nem történik adattörlés.</strong></p>
        </div>

        <div>
          <label htmlFor="deact-email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Megerősítéshez gépeld be az email címet: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{user.email}</code>
          </label>
          <input
            id="deact-email"
            type="email"
            autoComplete="off"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            {t.common.cancel}
          </button>
          <button
            type="button"
            disabled={!canSubmit || busy}
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? '…' : 'Inaktiválás'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── reset password modal ──────────────────────────────────────────────────── */

function ResetPasswordModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<'generate' | 'manual'>('generate');
  const [manualPassword, setManualPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = mode === 'generate' || manualPassword.length >= 8;

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const { password } = await resetUserPassword(
        user.id,
        mode === 'manual' ? manualPassword : undefined,
      );
      setResult(password);
      onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'A jelszó visszaállítása sikertelen'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard nem elérhető — a user kézzel másolja */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-brand-600" /> Jelszó visszaállítása
          </h2>
          <button type="button" onClick={onClose} title={t.common.cancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm">
          <p className="font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>

        {result ? (
          /* ── Eredmény: az új jelszó (egyszer látható) ── */
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
              <p className="font-semibold mb-1">✓ Az új jelszó beállítva</p>
              <p className="text-xs">Add át ezt a jelszót a felhasználónak. <strong>Ez most látható egyszer</strong> — bezárás után nem kérhető vissza.</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-900 text-green-300 font-mono text-base px-4 py-3 rounded-lg tracking-wider select-all text-center">
                {result}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                title="Másolás vágólapra"
                className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
              >
                {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-gray-500" />}
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition"
            >
              Kész
            </button>
          </div>
        ) : (
          /* ── Beállítás: generálás vagy kézi ── */
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('generate')}
                className={clsx(
                  'flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition text-left',
                  mode === 'generate' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                <div className="font-semibold">Generálás</div>
                <div className="text-[11px] opacity-80">Erős ideiglenes jelszó</div>
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={clsx(
                  'flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition text-left',
                  mode === 'manual' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                <div className="font-semibold">Kézi megadás</div>
                <div className="text-[11px] opacity-80">Saját jelszó beírása</div>
              </button>
            </div>

            {mode === 'manual' && (
              <div>
                <label htmlFor="reset-pw" className="block text-sm font-medium text-gray-700 mb-1.5">Új jelszó (min. 8 karakter)</label>
                <input
                  id="reset-pw"
                  type="text"
                  autoComplete="off"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  minLength={8}
                  maxLength={128}
                  placeholder="legalább 8 karakter"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800">
              A visszaállítás feloldja a fiók esetleges kizárását is. A régi jelszó azonnal érvénytelenné válik.
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={!canSubmit || busy}
                onClick={handleSubmit}
                className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? '…' : 'Visszaállítás'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── invite modal ───────────────────────────────────────────────────────────── */

function InviteUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const t = useT();
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', password: '', role: 'operative' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createUser(form);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.users.createError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t.users.inviteTitle}</h2>
          <button type="button" onClick={onClose} title={t.common.cancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="inv-firstname" className="block text-sm font-medium text-gray-700 mb-1.5">{t.users.firstNameLabel}</label>
              <input id="inv-firstname" type="text" required value={form.firstName} onChange={(e) => update('firstName', e.target.value)} maxLength={100}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label htmlFor="inv-lastname" className="block text-sm font-medium text-gray-700 mb-1.5">{t.users.lastNameLabel}</label>
              <input id="inv-lastname" type="text" required value={form.lastName} onChange={(e) => update('lastName', e.target.value)} maxLength={100}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          </div>
          <div>
            <label htmlFor="inv-email" className="block text-sm font-medium text-gray-700 mb-1.5">{t.users.emailLabel}</label>
            <input id="inv-email" type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} maxLength={254}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label htmlFor="inv-password" className="block text-sm font-medium text-gray-700 mb-1.5">{t.users.passwordLabel}</label>
            <input id="inv-password" type="password" required value={form.password} onChange={(e) => update('password', e.target.value)} minLength={8} maxLength={128}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label htmlFor="inv-role" className="block text-sm font-medium text-gray-700 mb-1.5">{t.users.roleLabel}</label>
            <select id="inv-role" value={form.role} onChange={(e) => update('role', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              {t.users.roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              {t.common.cancel}
            </button>
            <button type="submit" disabled={busy} className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60">
              {busy ? t.common.creating : t.users.saveBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────────── */

export default function UsersPage() {
  const t = useT();
  const { users, isLoading, mutate } = useUsers();
  const { currentUser } = useCurrentUser();
  const [showInvite, setShowInvite] = useState(false);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const [resettingPw, setResettingPw] = useState<User | null>(null);

  // Az inaktív fiókok külön gyűjtőbe kerülnek a lap alján — a role szerinti
  // csoportosítás csak az aktív felhasználókat tartalmazza.
  const activeUsers   = users.filter((u) => u.isActive);
  const inactiveUsers = users.filter((u) => !u.isActive);
  const byRole = {
    admin:     activeUsers.filter((u) => u.role === 'admin'),
    ceo:       activeUsers.filter((u) => u.role === 'ceo'),
    manager:   activeUsers.filter((u) => u.role === 'manager'),
    operative: activeUsers.filter((u) => u.role === 'operative'),
    client:    activeUsers.filter((u) => u.role === 'client'),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.users.title}</h1>
          <p className="text-gray-500 mt-1">{t.users.subtitle(users.length)}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-4 h-4" />
          {t.users.inviteBtn}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">{t.users.empty}</p>
          <p className="text-sm mt-1">{t.users.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(['admin', 'ceo', 'manager', 'operative', 'client'] as const).map((role) =>
            byRole[role].length > 0 ? (
              <div key={role}>
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="w-4 h-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    {t.users.roleLabels[role]} ({byRole[role].length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {byRole[role].map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      currentUserId={currentUser?.id ?? null}
                      onRefresh={() => mutate()}
                      onDeactivate={(target) => setDeactivating(target)}
                      onResetPassword={(target) => setResettingPw(target)}
                    />
                  ))}
                </div>
              </div>
            ) : null
          )}

          {inactiveUsers.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <UserX className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Inaktív ({inactiveUsers.length})
                </h2>
              </div>
              <div className="space-y-2">
                {inactiveUsers.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    currentUserId={currentUser?.id ?? null}
                    onRefresh={() => mutate()}
                    onDeactivate={(target) => setDeactivating(target)}
                    onResetPassword={(target) => setResettingPw(target)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showInvite && <InviteUserModal onClose={() => setShowInvite(false)} onSuccess={() => mutate()} />}
      {deactivating && (
        <DeactivateUserModal
          user={deactivating}
          onClose={() => setDeactivating(null)}
          onSuccess={() => mutate()}
        />
      )}
      {resettingPw && (
        <ResetPasswordModal
          user={resettingPw}
          onClose={() => setResettingPw(null)}
          onSuccess={() => mutate()}
        />
      )}
    </div>
  );
}
