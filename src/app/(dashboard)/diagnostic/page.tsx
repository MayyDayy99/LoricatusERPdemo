'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  RC_ITEMS,
  FEATURE_MODULES,
  CI_CHECKS,
  DEPLOY_CHECKLIST,
  HEALTH_CATEGORIES,
  HEALTH_SCORE,
  ROADMAP_PROGRESS,
  CHANGELOG,
  type RcSeverity,
  type CiStatus,
} from '@/lib/diagnostic-data';

/* ─── helpers ─── */

function severityColor(s: RcSeverity) {
  if (s === 'CRITICAL') return 'bg-red-600';
  if (s === 'HIGH') return 'bg-orange-500';
  if (s === 'MEDIUM') return 'bg-gray-500';
  return 'bg-blue-500';
}

function ciLabel(s: CiStatus) {
  if (s === 'pass') return { text: 'PASS', cls: 'bg-green-100 text-green-800' };
  if (s === 'fail') return { text: 'FAIL', cls: 'bg-red-100 text-red-800' };
  return { text: 'Nem futott', cls: 'bg-gray-100 text-gray-600' };
}

function pct(done: number, total: number) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/* ─── sub-components ─── */

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function ProgressBar({ value, color = 'bg-green-500' }: { value: number; color?: string }) {
  return (
    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
    </div>
  );
}

/* ─── Easter egg helpers ─── */

const EASTER_EGG_DATE = new Date('2026-03-17T00:00:00');

function formatElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const parts = [];
  if (days > 0) parts.push(`${days} nap`);
  if (hours > 0) parts.push(`${hours} óra`);
  if (mins > 0) parts.push(`${mins} perc`);
  parts.push(`${secs} másodperc`);
  return parts.join(', ');
}

function EasterEggModal({ onClose }: { onClose: () => void }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - EASTER_EGG_DATE.getTime());

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - EASTER_EGG_DATE.getTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl px-8 py-7 max-w-sm w-full mx-4 text-center space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl">🥬</div>
        <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Easter egg</p>
        <p className="text-sm text-gray-500 leading-relaxed">Ez az easter egg ennyi ideig lapult a fűben:</p>
        <p className="text-lg font-bold text-brand-700 tabular-nums">{formatElapsed(elapsed)}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Bezárás
        </button>
      </div>
    </div>
  );
}

/* ─── page ─── */

export default function DiagnosticPage() {
  const [eggOpen, setEggOpen] = useState(false);
  const openEgg = useCallback(() => setEggOpen(true), []);
  const closeEgg = useCallback(() => setEggOpen(false), []);

  const doneDeploy = DEPLOY_CHECKLIST.filter(d => d.status === 'done').length;
  const requiredDeploy = DEPLOY_CHECKLIST.filter(d => d.status !== 'optional').length;
  const deployPct = pct(doneDeploy, requiredDeploy);

  const totalTasks = RC_ITEMS.length;
  const doneTasks = RC_ITEMS.filter(r => r.status === 'done').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fejlesztési Állapotjelentés</h1>
        <p className="text-gray-500 mt-1">RC feladatok, CI ellenőrzések és élesítési státusz</p>
        <Link
          href="/dev-checklist"
          className="inline-block mt-2 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Palyazati Kovetelmenyek Checklist (F-1 &ndash; F-24) &rarr;
        </Link>
      </div>

      {/* Overall readiness */}
      <SectionCard title="Összesített Projekt Készültség">
        <div className={clsx(
          'rounded-lg px-4 py-3 text-sm font-semibold border',
          doneTasks === totalTasks ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800',
        )}>
          {doneTasks === totalTasks ? '✅ Fejlesztési feladatok KÉSZ' : '⚠️ FEJLESZTÉS FOLYAMATBAN'}
          <span className="block font-normal mt-0.5 text-xs opacity-80">
            {doneTasks}/{totalTasks} RC feladat teljesítve
          </span>
        </div>
        <div className="space-y-3 pt-1">
          {ROADMAP_PROGRESS.map(row => (
            <div key={row.label} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-sm">
              <span className="font-medium text-gray-700">{row.label}</span>
              <ProgressBar value={pct(row.done, row.total)} />
              <span className="font-bold text-gray-800 text-right w-16">
                {row.total === 0 ? '—' : `${pct(row.done, row.total)}%`}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Health score */}
      <SectionCard
        title="Projekt Egészségpontszám"
        description="Összesített minőségi mutató — fejlesztési feladatok és automatikus ellenőrzések alapján."
      >
        <div className="flex items-baseline gap-2 border-2 border-green-400 bg-green-50 rounded-xl px-6 py-4 w-fit">
          <span className="text-5xl font-black text-green-600">{HEALTH_SCORE}</span>
          <span className="text-xl text-gray-400 font-normal">/ 100</span>
        </div>
        <div className="divide-y divide-gray-50">
          {HEALTH_CATEGORIES.map(cat => (
            <div key={cat.label} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center py-3 text-sm">
              <span className="font-semibold text-gray-700">{cat.label}</span>
              <span className="font-bold text-brand-700 text-right whitespace-nowrap">{cat.score}/{cat.maxScore} pont</span>
              <span className="text-base">{cat.icon}</span>
              {cat.note && (
                <span className="col-span-3 text-xs text-gray-400 -mt-1">{cat.note}</span>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Changelog */}
      <SectionCard
        title="Fejlesztési Napló — Mi változott?"
        description="Az elmúlt napok fejlesztési eredményei dátum szerint csoportosítva."
      >
        <div className="space-y-5">
          {CHANGELOG.map((entry) => {
            const isFrontendSprint = entry.date.includes('CRM Frontend Sprint');
            return (
              <div key={entry.date} className="flex gap-5">
                <span className="font-bold text-brand-800 text-sm min-w-[160px] pt-0.5">{entry.date}</span>
                <ul className="space-y-1">
                  {entry.items.map((item, i) => (
                    <>
                      <li key={item} className="text-sm text-gray-600 flex gap-2">
                        <span className="text-green-500 mt-0.5">●</span>
                        {item}
                      </li>
                      {isFrontendSprint && i === 2 && (
                        <li
                          key="easter-egg"
                          onClick={openEgg}
                          className="text-sm text-gray-600 flex gap-2"
                          style={{ cursor: 'default' }}
                        >
                          <span className="text-green-500 mt-0.5">●</span>
                          Ágó elkelkáposztátlanítása
                        </li>
                      )}
                    </>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {eggOpen && <EasterEggModal onClose={closeEgg} />}

      {/* Feature modules */}
      <SectionCard
        title="Funkciók Készültsége"
        description="Minden modul külön követve — RC feladatok alapján."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURE_MODULES.map(mod => {
            const p = pct(mod.tasksDone, mod.tasksTotal);
            const ci = ciLabel(mod.ciStatus);
            return (
              <div key={mod.name} className="border border-yellow-200 bg-yellow-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{mod.icon}</span>
                  <span className="font-bold text-sm flex-1 text-gray-800">{mod.name}</span>
                  <span className="text-xs font-bold text-yellow-800 bg-yellow-200 px-2 py-0.5 rounded-full">{p}%</span>
                </div>
                <div className="text-xs text-gray-500">{mod.rcIds.join(', ')}</div>
                <ProgressBar value={p} color="bg-yellow-600" />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{mod.tasksDone}/{mod.tasksTotal} feladat kész</span>
                  <span className={clsx('px-2 py-0.5 rounded-full font-semibold', ci.cls)}>CI: {ci.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* CI checks */}
      <SectionCard
        title="Biztonsági és megbízhatósági ellenőrzések"
        description="Automatizált ellenőrzések, amelyek minden mentés után lefutnak."
      >
        <div className="divide-y divide-gray-50">
          {CI_CHECKS.map(check => {
            const badge = ciLabel(check.status);
            return (
              <div key={check.label} className="flex items-start gap-4 py-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{check.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-800">{check.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{check.description}</div>
                </div>
                <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap', badge.cls)}>
                  {badge.text}
                </span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* RC items */}
      <SectionCard
        title="Elvégzett fejlesztési feladatok részletesen"
        description="Mit javítottunk, és mit jelent ez a megrendelő számára."
      >
        <div className="divide-y divide-gray-50">
          {RC_ITEMS.map(item => (
            <div key={item.id} className="flex items-start gap-3 py-3">
              <span className="font-mono text-xs font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded mt-0.5 flex-shrink-0">{item.id}</span>
              <span className={clsx('text-white text-xs font-bold px-2 py-1 rounded mt-0.5 flex-shrink-0', severityColor(item.severity))}>
                {item.severity}
              </span>
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-800">{item.title}</div>
                <div className="text-xs text-gray-500 mt-1">{item.description}</div>
              </div>
              <span className="text-lg flex-shrink-0 mt-0.5">
                {item.status === 'done' ? '✅' : item.status === 'in_progress' ? '🔄' : '⏳'}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Deploy checklist */}
      <SectionCard
        title="Élesítési Ellenőrzőlista"
        description="Pontosan mi van még hátra az éles indítás előtt."
      >
        <div className="divide-y divide-gray-50">
          {DEPLOY_CHECKLIST.map(item => {
            const isDone = item.status === 'done';
            const isOptional = item.status === 'optional';
            return (
              <div key={item.label} className="flex items-start gap-4 py-3">
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {isDone ? '✅' : isOptional ? '⏳' : '🔲'}
                </span>
                <div className={clsx('flex-1', isDone && 'opacity-50')}>
                  <div className="font-semibold text-sm text-gray-800">
                    {item.label}
                    {isOptional && (
                      <span className="ml-2 text-xs font-normal bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">opcionális</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                </div>
              </div>
            );
          })}
        </div>
        {/* progress bar */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">
            Kötelező lépések: {doneDeploy}/{requiredDeploy}
          </span>
          <ProgressBar value={deployPct} color={deployPct === 100 ? 'bg-green-500' : 'bg-orange-400'} />
          <span className="font-bold text-orange-500 whitespace-nowrap">{deployPct}%</span>
        </div>
      </SectionCard>
    </div>
  );
}
