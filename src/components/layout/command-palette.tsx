'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, User, TrendingUp, Receipt, Wallet, Building2, Loader2,
  Folder, ClipboardList, CheckSquare,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type EntityType =
  | 'customer' | 'deal' | 'quote' | 'invoice' | 'account'
  | 'project' | 'work_order' | 'task';

interface SearchResultItem {
  entity: EntityType;
  id: string;
  title: string;
  subtitle?: string;
}

interface SearchResult {
  query: string;
  results: Record<EntityType, SearchResultItem[]>;
  total: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ENTITY_ICON: Record<EntityType, React.ReactNode> = {
  customer:   <User className="w-3.5 h-3.5" />,
  deal:       <TrendingUp className="w-3.5 h-3.5" />,
  quote:      <Receipt className="w-3.5 h-3.5" />,
  invoice:    <Wallet className="w-3.5 h-3.5" />,
  account:    <Building2 className="w-3.5 h-3.5" />,
  project:    <Folder className="w-3.5 h-3.5" />,
  work_order: <ClipboardList className="w-3.5 h-3.5" />,
  task:       <CheckSquare className="w-3.5 h-3.5" />,
};

const ENTITY_LABEL: Record<EntityType, string> = {
  customer:   'Ügyfelek',
  deal:       'Ügyletek',
  quote:      'Árajánlatok',
  invoice:    'Számlák',
  account:    'Cégek',
  project:    'Projektek',
  work_order: 'Munkalapok',
  task:       'Teendők',
};

const ENTITY_COLOR: Record<EntityType, string> = {
  customer:   'text-blue-500 bg-blue-50 dark:bg-blue-950 dark:text-blue-400',
  deal:       'text-green-500 bg-green-50 dark:bg-green-950 dark:text-green-400',
  quote:      'text-purple-500 bg-purple-50 dark:bg-purple-950 dark:text-purple-400',
  invoice:    'text-orange-500 bg-orange-50 dark:bg-orange-950 dark:text-orange-400',
  account:    'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400',
  project:    'text-cyan-500 bg-cyan-50 dark:bg-cyan-950 dark:text-cyan-400',
  work_order: 'text-amber-500 bg-amber-50 dark:bg-amber-950 dark:text-amber-400',
  task:       'text-emerald-500 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400',
};

const ENTITY_ORDER: EntityType[] = [
  'customer', 'account', 'deal', 'project', 'work_order', 'task', 'quote', 'invoice',
];

function entityRoute(item: SearchResultItem): string {
  switch (item.entity) {
    case 'customer':   return `/customers/${item.id}`;
    case 'deal':       return `/crm/deals/${item.id}`;
    case 'account':    return `/accounts/${item.id}`;
    case 'quote':      return `/crm/quotes`;
    case 'invoice':    return `/crm/invoices`;
    case 'project':    return `/projects/${item.id}`;
    case 'work_order': return `/work-orders/${item.id}`;
    case 'task':       return `/tasks`;
  }
}

// ─── Global Search Bar ────────────────────────────────────────────────────────

export function CommandPalette() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Flatten results for keyboard nav
  const allItems: SearchResultItem[] = result
    ? (Object.values(result.results) as SearchResultItem[][]).flat()
    : [];

  // ⌘K / Ctrl+K focuses the input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResult(null);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get<SearchResult>(`/search?q=${encodeURIComponent(query)}`);
        setResult(res.data);
        setActiveIdx(0);
      } catch {
        setResult(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const navigate = useCallback((item: SearchResultItem) => {
    router.push(entityRoute(item));
    setOpen(false);
    setQuery('');
    setResult(null);
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allItems[activeIdx]) {
      navigate(allItems[activeIdx]);
    }
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-72">
      {/* Input */}
      <div className={`flex items-center gap-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg px-3 py-1.5 transition-all ${
        open
          ? 'border-brand-400 ring-2 ring-brand-100 dark:ring-brand-900 bg-white dark:bg-gray-900'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}>
        {loading
          ? <Loader2 className="w-3.5 h-3.5 text-gray-400 shrink-0 animate-spin" />
          : <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        }
        <input
          ref={inputRef}
          type="text"
          className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 min-w-0"
          placeholder="Keresés…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {!open && (
          <kbd className="hidden sm:block text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
            ⌘K
          </kbd>
        )}
        {open && query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResult(null); inputRef.current?.focus(); }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 text-xs leading-none"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full mt-1.5 left-0 w-[420px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            {/* No results */}
            {!loading && result && result.total === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                Nincs találat: <span className="font-medium text-gray-600 dark:text-gray-300">"{query}"</span>
              </div>
            )}

            {/* Results grouped by entity */}
            {result && result.total > 0 && (
              <div className="py-1.5">
                {ENTITY_ORDER.map(entityType => {
                  const items = result.results[entityType];
                  if (!items?.length) return null;
                  return (
                    <div key={entityType} className="mb-0.5">
                      <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        {ENTITY_LABEL[entityType]}
                      </div>
                      {items.map(item => {
                        const globalIdx = allItems.indexOf(item);
                        const isActive = globalIdx === activeIdx;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navigate(item)}
                            onMouseEnter={() => setActiveIdx(globalIdx)}
                            className={`w-full text-left flex items-center gap-3 px-3 py-2 transition-colors ${
                              isActive
                                ? 'bg-brand-50 dark:bg-brand-950'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <span className={`w-6 h-6 flex items-center justify-center rounded-md shrink-0 ${ENTITY_COLOR[entityType]}`}>
                              {ENTITY_ICON[entityType]}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {item.title}
                              </div>
                              {item.subtitle && (
                                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                  {item.subtitle}
                                </div>
                              )}
                            </div>
                            {isActive && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">↵</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500">
            <span><kbd className="bg-gray-100 dark:bg-gray-800 px-1 rounded">↑↓</kbd> navigálás</span>
            <span><kbd className="bg-gray-100 dark:bg-gray-800 px-1 rounded">↵</kbd> megnyitás</span>
            <span><kbd className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Esc</kbd> bezárás</span>
          </div>
        </div>
      )}
    </div>
  );
}
