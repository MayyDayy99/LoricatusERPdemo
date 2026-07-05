'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, RefreshCw, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';

interface ReferralPreview {
  referrerName: string;
  recipientName?: string | null;
  tenantName: string;
  expiresAt: string;
}

// `||` (NEM `??`) — üres-string env-varra is fallbackoljunk.
// (Ugyanaz a NAS-prod NEXT_PUBLIC_API_URL-trap mint a drone-form-nál.)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function ReferralRegisterPage() {
  const { token } = useParams() as { token: string };
  const { setAuth } = useAuthStore();

  const [preview, setPreview] = useState<ReferralPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/referral/${token}`, { cache: 'no-store' });
        const ct = res.headers.get('content-type') ?? '';
        const text = await res.text();
        if (!ct.includes('application/json')) {
          throw new Error(`A szerver válasza nem JSON (${res.status}). Tipp: kapcsold ki az AdBlock-ot ezen az oldalon.`);
        }
        const data = JSON.parse(text);
        if (!res.ok) throw new Error(data?.message ?? 'A meghívó nem érvényes.');
        setPreview(data);
        if (data.recipientName) {
          const parts = String(data.recipientName).split(/\s+/);
          if (parts.length >= 2) {
            setLastName(parts[0]);
            setFirstName(parts.slice(1).join(' '));
          } else {
            setLastName(data.recipientName);
          }
        }
        // recipientEmail-t NEM kapja a preview (v2.3.0 token-leak mitigation) —
        // a user kézzel adja meg a saját email-jét; a backend a registerFromToken-ben
        // egyezteti a referral.recipient_email-lel.
      } catch (e: any) {
        setLoadError(e?.message ?? 'Ismeretlen hiba');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (password !== password2) { setSubmitError('A két jelszó nem egyezik.'); return; }
    if (password.length < 8)    { setSubmitError('A jelszó legalább 8 karakter legyen.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/public/referral/${token}/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
        }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data?.message ?? 'Regisztráció sikertelen.');
      // Auto-login: az accessToken-t + tenantId-t betesszük az auth-store-ba; a
      // refresh-token cookie-t a backend már beállította. A 4 felület
      // (árajánlat / szerződés / munkalap / térkép) elérhető a /quotes oldalra
      // redirecttel.
      setAuth(data.accessToken, data.tenantId);
      setSuccess(true);
      // 400ms-on belül full-page reload-dal a /quotes-ra: a window.location
      // garantálja az auth-store hydratiót és a refresh-cookie érvényesülését,
      // még akkor is, ha a user közben hozzányúl a tabhoz.
      setTimeout(() => { window.location.href = '/quotes'; }, 400);
    } catch (e: any) {
      setSubmitError(e?.message ?? 'Hálózati hiba.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" /> Betöltés…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white max-w-md w-full rounded-xl shadow-sm border border-red-100 p-6 space-y-2">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <h1 className="text-lg font-bold text-gray-900">A meghívó nem érvényes</h1>
          <p className="text-sm text-gray-600">{loadError}</p>
          <p className="text-xs text-gray-400 mt-2">Kérj a feladótól egy új meghívólinket.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white max-w-md w-full rounded-xl shadow-sm border border-green-100 p-6 space-y-2 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <h1 className="text-lg font-bold text-gray-900">Sikeres regisztráció!</h1>
          <p className="text-sm text-gray-600">Pillanatok belül átirányítunk az ügyfél-felületre…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-2">
          <UserPlus className="w-8 h-8 text-brand-600" />
          <h1 className="text-xl font-bold text-gray-900">Üdvözöljük a {preview?.tenantName} portálon!</h1>
          <p className="text-sm text-gray-600">
            <span className="font-medium">{preview?.referrerName}</span> meghívott Önt a megrendelői felületre.
            Itt nyomon követheti az árajánlatait, szerződéseit és munkalapjait.
          </p>
          <p className="text-xs text-gray-400">Meghívó érvényessége: {preview && fmtDate(preview.expiresAt)}-ig</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Regisztráció</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vezetéknév</label>
              <input
                type="text" required maxLength={100}
                value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Keresztnév</label>
              <input
                type="text" required maxLength={100}
                value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">E-mail (egyben belépési azonosító)</label>
            <input
              type="email" required maxLength={254}
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Jelszó (min. 8)</label>
              <input
                type="password" required minLength={8} maxLength={128}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Jelszó mégegyszer</label>
              <input
                type="password" required minLength={8} maxLength={128}
                value={password2} onChange={(e) => setPassword2(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Telefon (opcionális)</label>
            <input
              type="tel" maxLength={50}
              value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cégnév (opcionális)</label>
            <input
              type="text" maxLength={200}
              value={company} onChange={(e) => setCompany(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Regisztrálok…' : 'Regisztráció és belépés'}
          </button>
        </form>
      </div>
    </div>
  );
}
