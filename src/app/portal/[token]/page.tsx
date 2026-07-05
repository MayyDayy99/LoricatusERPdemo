'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  HardHat, MapPin, Calendar, Users, CheckCircle2, AlertCircle,
  RefreshCw, Eraser, PenTool,
} from 'lucide-react';

interface PortalView {
  workOrderNumber: string;
  location: string;
  locationAddress?: string;
  clientCompany: string;
  deadline?: string;
  projectGoal: string;
  contacts: { name: string; phone?: string; email?: string; role?: string }[];
  scanningTasks?: string;
  droneTasks?: string;
  processingTasks?: string;
  modelingTasks?: string;
  notes?: string;
  subcontractorName?: string;
  alreadySigned: boolean;
  signedAt?: string;
  signedBy?: string;
}

// `||` (NEM `??`) — üres-string env-varra is fallbackoljunk; lásd
// apps/web/src/app/public/drone-form/[token]/page.tsx kommentet (NAS-build trap).
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/* ── Signature pad ──────────────────────────────────────────────────────────── */

function SignaturePad({ onSignatureChange }: { onSignatureChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  function getPoint(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0] ?? e.changedTouches[0];
      if (!t) return null;
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const pt = getPoint(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!pt || !ctx) return;
    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const pt = getPoint(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!pt || !ctx) return;
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    hasDrawnRef.current = true;
  }

  function end() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (hasDrawnRef.current) {
      const canvas = canvasRef.current;
      if (canvas) onSignatureChange(canvas.toDataURL('image/png'));
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    onSignatureChange(null);
  }

  return (
    <div>
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-48 touch-none bg-white"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
        <div className="absolute top-2 left-2 text-xs text-gray-300 pointer-events-none flex items-center gap-1">
          <PenTool className="w-3 h-3" /> Írd alá ide
        </div>
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        <Eraser className="w-3 h-3" /> Törlés
      </button>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────────── */

export default function SubcontractorPortalPage() {
  const { token } = useParams() as { token: string };
  const [data, setData] = useState<PortalView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [signedBy, setSignedBy] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/subcontractor-portal/${token}`)
      .then(async r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message ?? 'Hiba'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signedBy.trim() || !signatureImage) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/subcontractor-portal/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedBy, signatureImage, notes: notes || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message ?? 'Aláírás sikertelen');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Hozzáférés megtagadva</h1>
          <p className="text-sm text-gray-600">
            A link lejárt, érvénytelen vagy már felhasználva. Kérjük kérd meg az ügyintézőt új linkre.
          </p>
        </div>
      </div>
    );
  }

  const showSignForm = !data.alreadySigned && !submitted;
  const showSuccess = data.alreadySigned || submitted;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <HardHat className="w-6 h-6 text-brand-600" />
          <div>
            <h1 className="font-bold text-gray-900">Munkalap átadás</h1>
            <p className="text-xs text-gray-400">{data.workOrderNumber}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Success banner */}
        {showSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="font-bold text-green-900">Aláírás rögzítve</p>
              {data.signedBy && <p className="text-sm text-green-700 mt-1">Aláírta: {data.signedBy} — {fmtDate(data.signedAt)}</p>}
              {submitted && <p className="text-sm text-green-700 mt-1">Köszönjük! A munkalapot lezártuk a rendszerünkben.</p>}
            </div>
          </div>
        )}

        {/* Work Order details */}
        <section className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <h2 className="font-bold text-gray-900 text-lg">{data.location}</h2>
          {data.locationAddress && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <span>{data.locationAddress}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-gray-400">Megrendelő</p>
              <p className="text-gray-900 font-medium">{data.clientCompany}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Határidő</p>
              <p className="text-gray-900 font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" /> {fmtDate(data.deadline)}
              </p>
            </div>
            {data.subcontractorName && (
              <div className="col-span-2">
                <p className="text-xs font-medium text-gray-400">Kivitelező</p>
                <p className="text-gray-900 font-medium">{data.subcontractorName}</p>
              </div>
            )}
          </div>

          {/* Project goal */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-400 mb-1">Projekt célja</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.projectGoal}</p>
          </div>

          {/* Tasks */}
          {[
            { label: 'Scanning feladatok', value: data.scanningTasks },
            { label: 'Drón feladatok', value: data.droneTasks },
            { label: 'Feldolgozás', value: data.processingTasks },
            { label: 'Modellezés', value: data.modelingTasks },
            { label: 'Megjegyzések', value: data.notes },
          ].filter(t => t.value).map(t => (
            <div key={t.label} className="pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-400 mb-1">{t.label}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{t.value}</p>
            </div>
          ))}

          {/* Contacts */}
          {data.contacts.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Kapcsolattartók
              </p>
              <div className="space-y-2">
                {data.contacts.map((c, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium text-gray-900">{c.name}</span>
                    {c.role && <span className="text-gray-500"> — {c.role}</span>}
                    {c.phone && <span className="text-gray-600"> · {c.phone}</span>}
                    {c.email && <span className="text-gray-600"> · {c.email}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Signature form */}
        {showSignForm && (
          <section className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
            <h2 className="font-bold text-gray-900">Aláírással igazolom a munka átvételét</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Neved</label>
                <input
                  value={signedBy}
                  onChange={e => setSignedBy(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Teljes név"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Aláírás</label>
                <SignaturePad onSignatureChange={setSignatureImage} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Megjegyzés <span className="text-gray-400 font-normal">(opcionális)</span></label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !signedBy.trim() || !signatureImage}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {submitting ? 'Küldés…' : 'Aláírás és átadás igazolása'}
              </button>
            </form>
          </section>
        )}

        <p className="text-center text-xs text-gray-400 py-4">
          Loricatus Group · Munkalap átadási portál
        </p>
      </main>
    </div>
  );
}
