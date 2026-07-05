'use client';

import { Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw, Info, CheckCircle2, RefreshCw, Layout } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { useSidebarConfig } from '@/lib/hooks/use-sidebar-config';
import {
  GROUPS,
  NAV_LABELS,
  type GroupId,
  type NavItem,
  getOrderedItemsForGroup,
} from '@/components/layout/sidebar-config';
import { useTenant } from '@/lib/hooks/use-tenants';
import { useCurrentUser } from '@/lib/hooks/use-users';
import { useLangStore } from '@/lib/lang-store';
import { useT } from '@/lib/hooks/use-t';

type SaveState = 'idle' | 'saving' | 'saved';

export function SidebarCustomizeSection() {
  const { config, isLoaded, update, reset } = useSidebarConfig();
  const { tenant } = useTenant();
  const { currentUser } = useCurrentUser();
  const { locale } = useLangStore();
  const t = useT();
  const [state, setState] = useState<SaveState>('idle');

  const flags = tenant?.featureFlags;

  const wrap = async (fn: () => Promise<void>) => {
    setState('saving');
    try {
      await fn();
      setState('saved');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('idle');
    }
  };

  const toggleHidden = (href: string) =>
    wrap(async () => {
      const next = config.hidden.includes(href)
        ? config.hidden.filter((h) => h !== href)
        : [...config.hidden, href];
      await update({ hidden: next });
    });

  const moveItem = (groupId: GroupId, href: string, direction: -1 | 1) =>
    wrap(async () => {
      const ordered = getOrderedItemsForGroup(groupId, config.order);
      const idx = ordered.findIndex((i) => i.href === href);
      if (idx < 0) return;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= ordered.length) return;
      const newOrder = [...ordered];
      [newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]];
      const hrefs = newOrder.map((i) => i.href);
      await update({ order: { ...config.order, [groupId]: hrefs } });
    });

  const toggleCollapsedGroup = (groupId: GroupId) =>
    wrap(async () => {
      const next = config.collapsedGroups.includes(groupId)
        ? config.collapsedGroups.filter((g) => g !== groupId)
        : [...config.collapsedGroups, groupId];
      await update({ collapsedGroups: next });
    });

  const renameGroup = (groupId: GroupId, value: string) =>
    wrap(async () => {
      const trimmed = value.trim().slice(0, 40);
      const nextLabels = { ...(config.groupLabels ?? {}) };
      if (trimmed.length === 0) delete nextLabels[groupId];
      else nextLabels[groupId] = trimmed;
      await update({ groupLabels: nextLabels });
    });

  const handleReset = () => wrap(() => reset());

  const isWorker = currentUser?.role === 'operative';

  return (
    <section className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between pb-1 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <span className="text-brand-500">
            <Layout className="w-5 h-5" />
          </span>
          <div>
            <h2 className="font-bold text-gray-900">{t.sidebarCustomize.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {t.sidebarCustomize.hint}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs whitespace-nowrap pl-3">
          {state === 'saving' && (
            <span className="flex items-center gap-1 text-gray-500">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              {t.sidebarCustomize.savingState}
            </span>
          )}
          {state === 'saved' && (
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t.sidebarCustomize.savedState}
            </span>
          )}
        </div>
      </div>

      {isWorker ? (
        <p className="text-sm text-gray-500 italic py-2">
          {t.sidebarCustomize.workerHint}
        </p>
      ) : !isLoaded ? (
        <p className="text-sm text-gray-400 py-2">{t.sidebarCustomize.loadingState}</p>
      ) : (
        <>
          <div className="space-y-5">
            {GROUPS.map((g) => {
              const items = getOrderedItemsForGroup(g.id, config.order);
              const isCollapsedByDefault = config.collapsedGroups.includes(g.id);
              return (
                <div key={g.id} className="space-y-2">
                  {/* Group header */}
                  <div className="flex items-center justify-between border-b border-gray-50 pb-1.5 gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="text"
                        defaultValue={config.groupLabels?.[g.id] ?? ''}
                        placeholder={g.label[locale]}
                        maxLength={40}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v.trim() !== (config.groupLabels?.[g.id] ?? '')) renameGroup(g.id, v);
                        }}
                        className="text-sm font-semibold text-gray-800 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-brand-400 focus:outline-none focus:ring-0 px-1 py-0.5 min-w-0 flex-1"
                        title="A csoport neve — átírható"
                      />
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">
                        {isCollapsedByDefault ? t.sidebarCustomize.defaultClosed : t.sidebarCustomize.defaultOpen}
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isCollapsedByDefault}
                        onChange={() => toggleCollapsedGroup(g.id)}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-400"
                      />
                      {t.sidebarCustomize.keepClosed}
                    </label>
                  </div>

                  {/* Items */}
                  <ul className="divide-y divide-gray-50">
                    {items.map((it: NavItem, idx) => {
                      const label = NAV_LABELS[it.href]?.[locale] ?? it.href;
                      const isHidden = config.hidden.includes(it.href);
                      const featureMissing =
                        it.requiredFeature && flags && flags[it.requiredFeature] === false;
                      const disabled = !!featureMissing;
                      const Icon = it.icon;
                      return (
                        <li
                          key={it.href}
                          className={clsx(
                            'flex items-center gap-2 py-2',
                            (isHidden || disabled) && 'opacity-50',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => !disabled && toggleHidden(it.href)}
                            disabled={disabled}
                            title={isHidden ? 'Megjelenítés' : 'Elrejtés'}
                            className={clsx(
                              'p-1.5 rounded-lg transition',
                              isHidden
                                ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                : 'bg-brand-50 text-brand-700 hover:bg-brand-100',
                              disabled && 'cursor-not-allowed',
                            )}
                          >
                            {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>

                          <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="flex-1 text-sm text-gray-700 truncate">{label}</span>

                          {disabled && (
                            <span
                              className="flex items-center text-gray-400"
                              title="A jelenlegi csomag nem tartalmazza"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {it.beta && (
                            <span className="text-[9px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                              BETA
                            </span>
                          )}

                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => moveItem(g.id, it.href, -1)}
                              disabled={idx === 0 || disabled}
                              title="Feljebb"
                              className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveItem(g.id, it.href, 1)}
                              disabled={idx === items.length - 1 || disabled}
                              title="Lejjebb"
                              className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Reset */}
          <div className="flex items-center justify-end pt-4 border-t border-gray-50">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand-700 border border-gray-200 rounded-lg px-3 py-1.5 transition"
            >
              <RotateCcw className="w-4 h-4" />
              {t.sidebarCustomize.resetToDefault}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
