'use client';

/**
 * A Projekt Map sorában, a projekt neve mellett: Iroda / Művelet kapcsoló és a
 * projekt értéke. A heti vezetői riport ebből tudja, melyik projekt melyik
 * blokkba tartozik, és mennyit ér.
 *
 *  - Kattintás a kapcsolóra: Iroda ⇄ Művelet (a Művelet „magára veszi").
 *    Iroda → Művelet váltáskor az árazás / ajánlat-kint projekt „Nyert" lesz;
 *    egy „Visszavonás" gomb a félrekattintásra.
 *  - Kattintás az értékre: kis ablak — érték (Ft) és az iroda-státusz.
 *
 * Mindenki látja; módosítani a projektvezető és a fölötte lévő szintek tudják
 * (`projects:commercial`). A sor maga egy húzható gomb, ezért ezek nem
 * `<button>`-ok, és minden eseményük megáll itt (különben megnyílna a projekt,
 * vagy elindulna a sor húzása).
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { useCanAccess } from '@/lib/hooks/use-access';
import styles from './tv-dashboard.module.css';
import type { DashboardProject, IrodaStatusz, ProjektEgyseg } from '@/lib/hooks/use-dashboard';

/** A pénz-taskok: az összegük a vezetői riport pénzes soraiba kerül. */
export const PENZ_TASK_TIPUSOK = ['szamla', 'szamlazas', 'kifizetes', 'varhato_kifizetes'];

export const STATUSZ_NEV: Record<IrodaStatusz, string> = {
  arazas: 'Árazás',
  ajanlat_kint: 'Ajánlat kint',
  nyert: 'Nyert',
  elveszett: 'Elveszett',
};

/** 12 500 000 → „12,5M", 850 000 → „850e". */
export function rovidPenz(v: number | null | undefined): string {
  if (v == null) return '';
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}e`;
  return String(Math.round(v));
}

export function teljesPenz(v: number | null | undefined): string {
  return v == null ? '—' : `${Math.round(v).toLocaleString('hu-HU')} Ft`;
}

/** „12 500 000", „12.500.000 Ft", „12,5M" → 12500000; üres → null; hibás → NaN. */
export function penzErtelmez(szoveg: string): number | null {
  const s = szoveg.trim().toLowerCase().replace(/ft$/, '').trim();
  if (!s) return null;
  const m = /^(\d+(?:[.,]\d+)?)\s*(m|millió|e|ezer)$/.exec(s);
  if (m) {
    const alap = Number(m[1].replace(',', '.'));
    return Math.round(alap * (m[2].startsWith('m') ? 1_000_000 : 1_000));
  }
  // A `\s` a nem törhető szóközt is fedi (a hu-HU számformázás U+202F-et tesz).
  const csakSzam = s.replace(/[\s.]/g, '');
  return /^\d+$/.test(csakSzam) ? Number(csakSzam) : NaN;
}

const allj = (e: React.SyntheticEvent) => e.stopPropagation();

async function mentes(projectId: string, dto: { unit?: ProjektEgyseg; valueHuf?: number | null; officeStatus?: IrodaStatusz }) {
  const res = await apiClient.patch(`/executive-report/projects/${projectId}`, dto);
  return res.data as { unit: ProjektEgyseg; valueHuf: number | null; officeStatus: IrodaStatusz };
}

function hibaUzenet(err: unknown): string {
  const e = err as { response?: { data?: { message?: string | string[] } } };
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m ?? 'A mentés nem sikerült.';
}

export function ProjektUzletiJelzo({ project, onChanged }: {
  project: DashboardProject;
  onChanged: () => Promise<unknown> | void;
}) {
  const szerkeszthet = useCanAccess('project.commercial');
  const [nyitva, setNyitva] = React.useState<DOMRect | null>(null);
  const [folyamatban, setFolyamatban] = React.useState(false);
  const unit: ProjektEgyseg = project.unit ?? 'iroda';
  const muvelet = unit === 'muvelet';
  const statusz: IrodaStatusz = project.officeStatus ?? 'arazas';

  const valtas = async () => {
    if (!szerkeszthet || folyamatban) return;
    const elotte = { unit, officeStatus: statusz };
    setFolyamatban(true);
    try {
      const uj = await mentes(project.id, { unit: muvelet ? 'iroda' : 'muvelet' });
      await onChanged();
      toast.success(
        uj.unit === 'muvelet'
          ? `${project.name}: a Művelet vette át${elotte.officeStatus !== uj.officeStatus ? ' (nyert)' : ''}`
          : `${project.name}: visszakerült az Irodához`,
        {
          action: {
            label: 'Visszavonás',
            onClick: () => {
              void mentes(project.id, elotte).then(() => onChanged()).catch((e) => toast.error(hibaUzenet(e)));
            },
          },
        },
      );
    } catch (e) {
      toast.error(hibaUzenet(e));
    } finally {
      setFolyamatban(false);
    }
  };

  const cim = muvelet
    ? `Művelet${szerkeszthet ? ' — kattints: vissza az Irodához' : ''}`
    : `Iroda · ${STATUSZ_NEV[statusz]}${szerkeszthet ? ' — kattints: a Művelet átveszi' : ''}`;

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
      onClick={allj}
      onPointerDown={allj}
      onMouseDown={allj}
      onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
      draggable={false}
    >
      <span
        role="switch"
        aria-checked={muvelet}
        aria-label={cim}
        tabIndex={szerkeszthet ? 0 : -1}
        title={cim}
        data-testid="egyseg-kapcsolo"
        onClick={() => void valtas()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void valtas(); } }}
        style={{
          display: 'inline-flex', alignItems: 'center', borderRadius: 999, fontSize: 10, fontWeight: 700,
          lineHeight: '16px', padding: '0 6px', letterSpacing: '.02em', userSelect: 'none',
          cursor: szerkeszthet ? 'pointer' : 'default', opacity: folyamatban ? 0.5 : 1,
          background: muvelet ? '#DCFCE7' : '#DBEAFE', color: muvelet ? '#166534' : '#1E40AF',
          border: `1px solid ${muvelet ? '#86EFAC' : '#93C5FD'}`,
        }}
      >
        {muvelet ? 'MŰV' : 'IRODA'}
      </span>
      {(project.valueHuf != null || szerkeszthet) && (
        <span
          role="button"
          tabIndex={0}
          data-testid="ertek-gomb"
          // Az üres „+Ft" csak a sor fölé állva látszik — ne vegye el a helyet a névtől.
          className={project.valueHuf == null ? styles.ertekUres : undefined}
          title={`Érték: ${teljesPenz(project.valueHuf)}${!muvelet ? ` · ${STATUSZ_NEV[statusz]}` : ''}${szerkeszthet ? ' — kattints a módosításhoz' : ''}`}
          onClick={(e) => setNyitva((e.currentTarget as HTMLElement).getBoundingClientRect())}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setNyitva((e.currentTarget as HTMLElement).getBoundingClientRect());
            }
          }}
          style={{
            fontSize: 11, fontWeight: 600, cursor: 'pointer', userSelect: 'none',
            color: project.valueHuf != null ? 'var(--text)' : 'var(--text-dim, #94a3b8)',
            opacity: project.valueHuf != null ? 0.85 : 0.6,
          }}
        >
          {project.valueHuf != null ? rovidPenz(project.valueHuf) : '+Ft'}
        </span>
      )}
      {nyitva && (
        <UzletiAblak
          project={project}
          horgony={nyitva}
          szerkeszthet={szerkeszthet}
          onClose={() => setNyitva(null)}
          onSaved={async () => { setNyitva(null); await onChanged(); }}
        />
      )}
    </span>
  );
}

function UzletiAblak({ project, horgony, szerkeszthet, onClose, onSaved }: {
  project: DashboardProject;
  horgony: DOMRect;
  szerkeszthet: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [unit, setUnit] = React.useState<ProjektEgyseg>(project.unit ?? 'iroda');
  const [ertek, setErtek] = React.useState(project.valueHuf != null ? Math.round(project.valueHuf).toLocaleString('hu-HU') : '');
  const [statusz, setStatusz] = React.useState<IrodaStatusz>(project.officeStatus ?? 'arazas');
  const [ment, setMent] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const kivul = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', kivul);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', kivul); document.removeEventListener('keydown', esc); };
  }, [onClose]);

  const szam = penzErtelmez(ertek);
  const hibas = Number.isNaN(szam);

  const kuld = async () => {
    if (hibas || ment) return;
    setMent(true);
    try {
      await mentes(project.id, {
        unit,
        valueHuf: szam,
        ...(unit === 'iroda' || statusz !== (project.officeStatus ?? 'arazas') ? { officeStatus: statusz } : {}),
      });
      toast.success('Mentve');
      await onSaved();
    } catch (e) {
      toast.error(hibaUzenet(e));
      setMent(false);
    }
  };

  const top = Math.min(horgony.bottom + 6, window.innerHeight - 330);
  const left = Math.min(horgony.left, window.innerWidth - 300);
  const gomb = (aktiv: boolean): React.CSSProperties => ({
    flex: 1, padding: '5px 6px', fontSize: 12, borderRadius: 6, cursor: szerkeszthet ? 'pointer' : 'default',
    border: `1px solid ${aktiv ? '#2B3B46' : '#CBD5E1'}`, background: aktiv ? '#2B3B46' : '#fff',
    color: aktiv ? '#fff' : '#334155', fontWeight: aktiv ? 600 : 400,
  });

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`${project.name} — üzleti adatok`}
      onClick={allj}
      onMouseDown={allj}
      style={{
        position: 'fixed', top, left, width: 284, zIndex: 1000, background: '#fff', color: '#1E293B',
        borderRadius: 10, boxShadow: '0 10px 30px rgba(15,23,42,.18)', border: '1px solid #E2E8F0', padding: 14,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {project.name}
      </div>

      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Kinél van</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['iroda', 'muvelet'] as const).map((u) => (
          <button key={u} type="button" disabled={!szerkeszthet} style={gomb(unit === u)}
            onClick={() => {
              setUnit(u);
              if (u === 'muvelet' && (statusz === 'arazas' || statusz === 'ajanlat_kint')) setStatusz('nyert');
            }}>
            {u === 'iroda' ? 'Iroda' : 'Művelet'}
          </button>
        ))}
      </div>

      <label style={{ display: 'block', fontSize: 11, color: '#64748B', marginBottom: 4 }} htmlFor={`ertek-${project.id}`}>
        Érték (Ft) — árazáskor az ajánlati ár, nyerés után a szerződéses
      </label>
      <input
        id={`ertek-${project.id}`}
        data-testid="ertek-mezo"
        value={ertek}
        disabled={!szerkeszthet}
        onChange={(e) => setErtek(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void kuld(); }}
        placeholder="pl. 12 500 000 vagy 12,5M"
        inputMode="decimal"
        style={{
          width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 13, marginBottom: 2,
          border: `1px solid ${hibas ? '#DC2626' : '#CBD5E1'}`,
        }}
      />
      <div style={{ fontSize: 11, color: hibas ? '#DC2626' : '#64748B', minHeight: 16, marginBottom: 8 }}>
        {hibas ? 'Csak szám, pl. 12 500 000 vagy 12,5M' : szam != null ? teljesPenz(szam) : 'Nincs megadva'}
      </div>

      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Iroda-státusz</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        {(Object.keys(STATUSZ_NEV) as IrodaStatusz[]).map((s) => (
          <button key={s} type="button" disabled={!szerkeszthet} style={gomb(statusz === s)} onClick={() => setStatusz(s)}>
            {STATUSZ_NEV[s]}
          </button>
        ))}
      </div>

      {szerkeszthet ? (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #CBD5E1', background: '#fff' }}>
            Mégse
          </button>
          <button type="button" data-testid="uzleti-mentes" onClick={() => void kuld()} disabled={hibas || ment}
            style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: 'none', background: '#16A34A', color: '#fff', fontWeight: 600, opacity: hibas || ment ? 0.6 : 1 }}>
            {ment ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#64748B' }}>Módosítani a projektvezető és a fölötte lévő szintek tudják.</div>
      )}
    </div>,
    document.body,
  );
}
