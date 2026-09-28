'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { DashboardOverview } from '@/lib/hooks/use-dashboard';
import { rozikaAtirat, type RozikaEredmeny, type RozikaJavaslat } from '@/lib/hooks/use-rozika';
import styles from './tv-dashboard.module.css';

/**
 * ── ROZIKA: ÁTIRAT → JAVASLATOK ─────────────────────────────────────────────
 *
 * A meeting átirata beillesztve; Rozika kigyűjti a vállalt feladatokat, és
 * PISZKOZATKÉNT teszi fel őket a Projekt mapre (szaggatott keret). Megerősíteni
 * ember erősít meg, a Mapen, egy koppintással — itt semmi nem véglegesedik.
 */

const MAX_HOSSZ = 120_000;

function maBudapesten(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest' }).format(new Date());
}

export function RozikaAtiratModal({
  overview, modell, onClose, onSaved,
}: {
  overview: DashboardOverview;
  modell?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [atirat, setAtirat] = useState('');
  const [meetingDatum, setMeetingDatum] = useState(maBudapesten);
  const [projectId, setProjectId] = useState('');
  const [dolgozik, setDolgozik] = useState(false);
  const [eredmeny, setEredmeny] = useState<RozikaEredmeny | null>(null);

  const nevek = useMemo(
    () => new Map(overview.people.map((p) => [p.id, `${p.firstName} ${p.lastName}`.trim()])),
    [overview.people],
  );

  async function kuldes(e: React.FormEvent) {
    e.preventDefault();
    if (atirat.trim().length < 20) return;
    setDolgozik(true);
    try {
      const e2 = await rozikaAtirat({
        atirat: atirat.trim(),
        meetingDatum,
        projectId: projectId || undefined,
      });
      setEredmeny(e2);
      if (e2.javaslatok.some((j) => j.allapot === 'letrehozva')) onSaved();
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 502 || status === 503) {
        // Az api-client minden 5xx-et általános szövegre cserél. Itt viszont a
        // szerver a SAJÁT, felhasználónak írt mondatát küldi (mi romlott el a
        // kinyerőnél, és hogy semmi nem került fel) — az eredetit mutatjuk.
        toast.error(
          typeof data?.technicalMessage === 'string'
            ? data.technicalMessage
            : 'Rozika most nem érhető el. A Projekt mapre semmi nem került.',
        );
      } else {
        const msg = data?.message;
        toast.error(Array.isArray(msg) ? msg.join(', ') : (msg ?? `Rozika most nem érhető el: ${err?.message ?? 'ismeretlen hiba'}`));
      }
    } finally {
      setDolgozik(false);
    }
  }

  return (
    <div className={styles.modalBg} onClick={dolgozik ? undefined : onClose}>
      <form
        className={styles.modal}
        style={{ width: 640 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={kuldes}
      >
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalSub}>🎧 Rozika</div>
            <div className={styles.modalTitle}>Meeting-átiratból javaslatok</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={dolgozik}>×</button>
        </div>

        {eredmeny ? (
          <Eredmeny eredmeny={eredmeny} nevek={nevek} />
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
              Illeszd be a meeting átiratát. Rozika kigyűjti a <b>vállalt</b> feladatokat, és
              piszkozatként teszi fel őket a Projekt mapre — véglegesíteni ott tudjátok, egy koppintással.
            </p>

            <div className={styles.formRowInline}>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>📅 A meeting napja</div>
                <input
                  type="date"
                  className={styles.formInput}
                  value={meetingDatum}
                  onChange={(e) => setMeetingDatum(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>📂 Projekt (opcionális)</div>
                <select
                  className={styles.formSelect}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">— Nincs projekthez kötve —</option>
                  {overview.projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', margin: '-6px 0 12px' }}>
              A „csütörtökre”, „holnapig” ehhez a naphoz képest értendő. A projektet nem Rozika
              találja ki: amit itt választasz, minden javaslat ahhoz kerül.
            </div>

            <div className={styles.formRow}>
              <div className={styles.formLabel}>📝 Átirat</div>
              <textarea
                className={styles.formInput}
                value={atirat}
                onChange={(e) => setAtirat(e.target.value)}
                maxLength={MAX_HOSSZ}
                rows={12}
                placeholder={'Péter: Jóska, hívd fel a tervezőt ma délután.\nJóska: Rendben, felhívom.'}
                style={{ resize: 'vertical', fontSize: 12, lineHeight: 1.45 }}
                autoFocus
                required
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 4, gap: 12 }}>
                <span>
                  Az átirat a kinyerő modellhez megy{modell ? ` (${modell})` : ''}, és nem tároljuk:
                  a javaslatban csak az a mondat marad, amiből a feladat lett.
                </span>
                <span style={{ whiteSpace: 'nowrap' }}>{atirat.length.toLocaleString('hu-HU')} karakter</span>
              </div>
            </div>

            <button
              type="submit"
              className={styles.saveBtn}
              disabled={dolgozik || atirat.trim().length < 20 || !meetingDatum}
            >
              {dolgozik ? 'Rozika olvassa… (akár egy perc)' : 'Javaslatok kérése'}
            </button>
          </>
        )}

        {eredmeny && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className={styles.saveBtn}
              style={{ flex: 1, background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => { setEredmeny(null); setAtirat(''); }}
            >
              Másik átirat
            </button>
            <button type="button" className={styles.saveBtn} style={{ flex: 1 }} onClick={onClose}>
              Bezárás
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function Eredmeny({ eredmeny, nevek }: { eredmeny: RozikaEredmeny; nevek: Map<string, string> }) {
  const uj = eredmeny.javaslatok.filter((j) => j.allapot === 'letrehozva').length;
  const regi = eredmeny.javaslatok.length - uj;

  if (eredmeny.javaslatok.length === 0) {
    return (
      <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}>
        Ebben az átiratban Rozika nem talált vállalt feladatot. Ez gyakori és rendben
        van: egy meeting nagy része nem feladatkiosztás.
        {eredmeny.hibasTetelek > 0 && <HibasTetelek db={eredmeny.hibasTetelek} />}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        {uj > 0 ? `${uj} új javaslat a Projekt mapen` : 'Nem került fel új javaslat'}
        {regi > 0 && <span style={{ fontWeight: 400, color: 'var(--muted)' }}> · {regi} már korábban is megvolt</span>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
        Szaggatott kerettel látszanak; a Mapen megerősítheted vagy eldobhatod őket.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {eredmeny.javaslatok.map((j, i) => <JavaslatSor key={j.taskId ?? i} j={j} nevek={nevek} />)}
      </div>
      {eredmeny.hibasTetelek > 0 && <HibasTetelek db={eredmeny.hibasTetelek} />}
    </div>
  );
}

function JavaslatSor({ j, nevek }: { j: RozikaJavaslat; nevek: Map<string, string> }) {
  const felelos = j.felelosId ? nevek.get(j.felelosId) ?? j.felelosNev : null;
  return (
    <div
      style={{
        border: '1px dashed var(--border-strong, #9ca3af)',
        borderRadius: 8,
        padding: '8px 10px',
        opacity: j.allapot === 'mar-megvolt' ? 0.6 : 1,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        {j.cim}
        {j.allapot === 'mar-megvolt' && (
          <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--muted)' }}> — már megvolt, nem írtuk fel újra</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {felelos ? (
          <span>👤 {felelos}</span>
        ) : (
          <span style={{ color: 'var(--orange, #c2410c)' }}>
            👤 {j.felelosNev || '—'} — {j.felelosJeloltek > 1 ? `${j.felelosJeloltek} emberre is illik` : 'nem ismert név'}, válaszd ki megerősítéskor
          </span>
        )}
        <span>{j.hatarido ? `📅 ${j.hatarido}` : '📅 nem hangzott el határidő'}</span>
      </div>
      <div style={{ fontSize: 11, fontStyle: 'italic', marginTop: 4, color: 'var(--text)' }}>
        „{j.idezet}”
        {!j.idezetEgyezik && (
          <span style={{ fontStyle: 'normal', color: 'var(--orange, #c2410c)' }}> — szó szerint nem szerepel az átiratban</span>
        )}
      </div>
    </div>
  );
}

function HibasTetelek({ db }: { db: number }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
      A modell {db} hiányos tételt is adott (cím vagy idézet nélkül) — ezeket nem tettük fel.
    </div>
  );
}
