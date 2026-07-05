'use client';

import { useState, useCallback } from 'react';
import {
  X, Play, CheckCircle2, RotateCcw,
  Database, RefreshCw, Trash2, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle, Loader2,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useOnboardingStore } from '@/lib/onboarding-store';
import { useT } from '@/lib/hooks/use-t';
import { MODULE_TOURS } from './tour-definitions';
import { useDemoStatus, seedDemo, resetDemo, clearDemo } from '@/lib/hooks/use-demo';

function resolve(obj: Record<string, unknown>, path: string): string {
  const val = path.split('.').reduce<unknown>((o, k) => {
    if (o && typeof o === 'object') return (o as Record<string, unknown>)[k];
    return undefined;
  }, obj);
  return typeof val === 'string' ? val : path;
}

interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
}

// ─── Demo section ─────────────────────────────────────────────────────────────

function DemoSection() {
  const t = useT();
  const td = t.tutorial.demo;
  const { status, loading: statusLoading, mutate } = useDemoStatus();
  const [busy, setBusy] = useState<'seed' | 'reset' | 'clear' | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [showWhat, setShowWhat] = useState(false);
  const [tourPrompt, setTourPrompt] = useState(false);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSeed = async () => {
    if (!window.confirm(status?.isSeeded ? td.alreadySeeded : `${td.btnLoad}?`)) return;
    setBusy('seed');
    try {
      await seedDemo();
      await mutate();
      showToast('ok', td.successLoad);
      setTourPrompt(true);
    } catch {
      showToast('err', td.errorLoad);
    } finally {
      setBusy(null);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(td.confirmReset)) return;
    setBusy('reset');
    try {
      await resetDemo();
      await mutate();
      showToast('ok', td.successReset);
      setTourPrompt(true);
    } catch {
      showToast('err', td.errorReset);
    } finally {
      setBusy(null);
    }
  };

  const handleClear = async () => {
    if (!window.confirm(td.confirmClear)) return;
    setBusy('clear');
    try {
      await clearDemo();
      await mutate();
      showToast('ok', td.successClear);
    } catch {
      showToast('err', td.errorClear);
    } finally {
      setBusy(null);
    }
  };

  const isSeeded = status?.isSeeded ?? false;
  const isBusy = busy !== null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-50 to-blue-50 px-4 py-3 flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center mt-0.5">
          <Database className="w-4 h-4 text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{td.sectionTitle}</p>
          <p className="text-xs text-gray-500 mt-0.5">{td.sectionSubtitle}</p>
        </div>
      </div>

      {/* Status bar */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-100 flex items-center gap-2">
        {statusLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
        ) : isSeeded ? (
          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        )}
        <span className={`text-xs font-medium ${isSeeded ? 'text-green-700' : 'text-gray-500'}`}>
          {isSeeded ? td.statusLoaded : td.statusEmpty}
        </span>
        {isSeeded && status && (
          <span className="text-xs text-gray-400 ml-auto">
            {td.entityCount(status.counts.total)}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-white space-y-2">
        {!isSeeded ? (
          <button
            onClick={handleSeed}
            disabled={isBusy}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 transition-colors disabled:opacity-50"
          >
            {busy === 'seed' ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{td.loading}</>
            ) : (
              <><Database className="w-4 h-4" />{td.btnLoad}</>
            )}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={isBusy}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-medium px-3 py-2 transition-colors disabled:opacity-50"
            >
              {busy === 'reset' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {td.btnReset}
            </button>
            <button
              onClick={handleClear}
              disabled={isBusy}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium px-3 py-2 transition-colors disabled:opacity-50"
            >
              {busy === 'clear' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              {td.btnClear}
            </button>
          </div>
        )}

        {/* What gets loaded — collapsible */}
        <button
          onClick={() => setShowWhat((v) => !v)}
          className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-600 transition-colors pt-1"
        >
          <span>{td.what.title}</span>
          {showWhat ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showWhat && (
          <ul className="text-xs text-gray-500 space-y-1 pb-1">
            {([
              ['accounts',   td.what.accounts],
              ['customers',  td.what.customers],
              ['projects',   td.what.projects],
              ['deals',      td.what.deals],
              ['quotes',     td.what.quotes],
              ['workOrders', td.what.workOrders],
              ['contracts',  td.what.contracts],
              ['activities', td.what.activities],
              ['tasks',      td.what.tasks],
            ] as [string, string][]).map(([, label]) => (
              <li key={label} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-brand-400 flex-shrink-0" />
                {label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mx-4 mb-3 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
          toast.type === 'ok'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.type === 'ok'
            ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Tour prompt */}
      {tourPrompt && (
        <div className="mx-4 mb-3 border border-brand-200 rounded-lg bg-brand-50 p-3">
          <p className="text-xs font-semibold text-brand-800 mb-0.5">{td.tourPromptTitle}</p>
          <p className="text-xs text-brand-600 mb-2">{td.tourPromptDesc}</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTourPrompt(false);
                // scroll to module list — user can pick a tour
                document.getElementById('help-module-list')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex-1 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-md px-2 py-1.5 transition-colors"
            >
              {td.tourPromptStart}
            </button>
            <button
              onClick={() => setTourPrompt(false)}
              className="flex-1 text-xs font-medium border border-brand-200 text-brand-700 hover:bg-brand-100 rounded-md px-2 py-1.5 transition-colors"
            >
              {td.tourPromptSkip}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  const t = useT();
  const tRaw = t as unknown as Record<string, unknown>;
  const tt = t.tutorial;
  const { moduleTours, completeModuleTour, resetOnboarding } = useOnboardingStore();
  const [running, setRunning] = useState(false);

  const startModuleTour = useCallback(
    (moduleId: string) => {
      const mod = MODULE_TOURS.find((m) => m.id === moduleId);
      if (!mod) return;

      const steps: DriveStep[] = mod.steps.map((s) => ({
        element: s.element,
        popover: {
          title: resolve(tRaw, s.popover.title),
          description: resolve(tRaw, s.popover.description),
          side: s.popover.side,
          align: 'center' as const,
        },
      }));

      onClose();
      setRunning(true);

      setTimeout(() => {
        const d = driver({
          showProgress: true,
          animate: true,
          overlayColor: 'rgba(43,59,70,0.6)',
          stagePadding: 8,
          stageRadius: 12,
          popoverClass: 'dimop-tour-popover',
          allowClose: true,
          steps,
          onDestroyed: () => {
            completeModuleTour(moduleId);
            setRunning(false);
          },
        });
        d.drive();
      }, 300);
    },
    [tRaw, onClose, completeModuleTour],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white shadow-2xl border-l border-gray-200 h-full flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-loricatus-dark">{tt.helpPanel.title}</h2>
            <p className="text-sm text-gray-500">{tt.helpPanel.subtitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Demo section */}
          <DemoSection />

          {/* Module tour list */}
          <div id="help-module-list" className="space-y-2">
            {MODULE_TOURS.map((mod) => {
              const IconComp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[mod.icon] ?? Icons.HelpCircle;
              const label = resolve(tRaw, `tutorial.modules.${mod.id}.label`);
              const done = moduleTours[mod.id] === 'completed';

              return (
                <button
                  key={mod.id}
                  disabled={running}
                  onClick={() => startModuleTour(mod.id)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                    done
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 hover:border-brand-300 hover:bg-brand-50'
                  } disabled:opacity-50`}
                >
                  <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                    done ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {done ? <CheckCircle2 className="w-5 h-5" /> : <IconComp className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">
                      {done ? tt.helpPanel.completed : `${mod.steps.length} ${tt.stepOf.replace('{current}', '').replace('{total}', '').trim() || 'steps'}`}
                    </p>
                  </div>
                  {!done && <Play className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => {
              resetOnboarding();
              onClose();
            }}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            {tt.helpPanel.restartMain}
          </button>
        </div>
      </div>
    </div>
  );
}
