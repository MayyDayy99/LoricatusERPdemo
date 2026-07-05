'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText, Download, Eye, ClipboardList, Loader2, Send, CheckCircle, XCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { usePricingItems, usePricingGroups } from '@/lib/hooks/use-pricing';
import {
  useProjectQuote, useQuoteLineItems,
  createProjectQuote, addQuoteLineItem, removeQuoteLineItem,
  generateQuotePdf, getQuotePdfUrl, exportQuoteToWorkOrder,
  sendProjectQuote, acceptProjectQuote, rejectProjectQuote, duplicateProjectQuote,
} from '@/lib/hooks/use-project-quote';

const fmt = (n: number) =>
  new Intl.NumberFormat('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  draft:    { label: 'Piszkozat', cls: 'bg-gray-100 text-gray-600' },
  sent:     { label: 'Elküldve',  cls: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Elfogadva', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Elutasítva', cls: 'bg-red-100 text-red-700' },
  expired:  { label: 'Lejárt',    cls: 'bg-yellow-100 text-yellow-700' },
};

export function ProjectQuoteTab({
  projectId,
  projectName,
  customerId,
}: {
  projectId: string;
  projectName: string;
  customerId?: string;
}) {
  const { quote, isLoading: quoteLoading, mutate: mutateQuote } = useProjectQuote(projectId);
  const { lineItems, mutate: mutateItems } = useQuoteLineItems(quote?.id ?? null);
  const { items: catalog } = usePricingItems();
  const { groups } = usePricingGroups();
  const [creating, setCreating] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pdfBusy, setPdfBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  // Az "Exportálás munkalappá" előtti megerősítő ablak (Elfogadták az árajánlatot?)
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);

  // pricingItemId → quoteLineItemId leképezés (a pipa-állapothoz)
  const lineByPricingItem = useMemo(() => {
    const m = new Map<string, string>();
    for (const li of lineItems) {
      if (li.pricingItemId) m.set(li.pricingItemId, li.id);
    }
    return m;
  }, [lineItems]);

  // Katalógus csoportonként
  const sections = useMemo(() => {
    const byGroup = new Map<string, typeof catalog>();
    const ungrouped: typeof catalog = [];
    for (const it of [...catalog].sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (it.groupId) {
        if (!byGroup.has(it.groupId)) byGroup.set(it.groupId, []);
        byGroup.get(it.groupId)!.push(it);
      } else {
        ungrouped.push(it);
      }
    }
    const out: Array<{ id: string; name: string; color: string; items: typeof catalog }> = [];
    for (const g of groups) out.push({ id: g.id, name: g.name, color: g.color, items: byGroup.get(g.id) ?? [] });
    if (ungrouped.length > 0) out.push({ id: '__ungrouped__', name: 'Csoport nélkül', color: '#e5e7eb', items: ungrouped });
    return out.filter(s => s.items.length > 0);
  }, [catalog, groups]);

  async function startQuote() {
    if (!customerId) {
      toast.error('A projektnek nincs megrendelője — előbb rendelj hozzá egy ügyfelet.');
      return;
    }
    setCreating(true);
    try {
      await createProjectQuote(projectId, customerId, `Árajánlat — ${projectName}`);
      await mutateQuote();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Árajánlat indítása sikertelen');
    } finally {
      setCreating(false);
    }
  }

  async function toggleItem(pricingItemId: string, item: { name: string; unitPrice: number; quantity: number; unit?: string }, groupName: string) {
    if (!quote) return;
    setBusyItem(pricingItemId);
    try {
      const existingLineId = lineByPricingItem.get(pricingItemId);
      if (existingLineId) {
        await removeQuoteLineItem(quote.id, existingLineId);
      } else {
        await addQuoteLineItem(quote.id, {
          description: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          unit: item.unit,
          section: groupName,
          pricingItemId,
        });
      }
      await Promise.all([mutateItems(), mutateQuote()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Tétel-művelet sikertelen');
    } finally {
      setBusyItem(null);
    }
  }

  async function handlePreviewOrDownload(mode: 'preview' | 'download') {
    if (!quote) return;
    try {
      const url = await getQuotePdfUrl(quote.id);
      if (mode === 'preview') window.open(url, '_blank');
      else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${quote.quoteNumber}.pdf`;
        a.click();
      }
    } catch {
      toast.error('Még nincs generált PDF — előbb kattints az "Árajánlat generálása" gombra.');
    }
  }

  async function handleGenerate() {
    if (!quote) return;
    setPdfBusy(true);
    try {
      await generateQuotePdf(quote.id);
      toast.success('Árajánlat-PDF generálása elindult — pár másodperc múlva letölthető.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'PDF-generálás sikertelen');
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleExport() {
    if (!quote) return;
    setExportBusy(true);
    try {
      await exportQuoteToWorkOrder(quote.id);
      toast.success('Munkalap létrehozva — nézd meg a Munkalapok fülön.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Exportálás sikertelen');
    } finally {
      setExportBusy(false);
    }
  }

  // ── Árajánlat-életciklus akciók (mint a CRM → Árajánlatok panelen) ──────────
  async function handleSend() {
    if (!quote) return;
    setLifecycleBusy('send');
    try {
      await sendProjectQuote(quote.id, recipientEmail || undefined);
      await mutateQuote();
      toast.success('Árajánlat elküldve az ügyfélnek.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Küldés sikertelen');
    } finally {
      setLifecycleBusy(null);
    }
  }

  async function handleAccept() {
    if (!quote) return;
    setLifecycleBusy('accept');
    try {
      await acceptProjectQuote(quote.id);
      await mutateQuote();
      toast.success('Árajánlat elfogadottra állítva.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Elfogadás sikertelen');
    } finally {
      setLifecycleBusy(null);
    }
  }

  async function handleReject() {
    if (!quote) return;
    setLifecycleBusy('reject');
    try {
      await rejectProjectQuote(quote.id);
      await mutateQuote();
      toast.success('Árajánlat elutasítva.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Elutasítás sikertelen');
    } finally {
      setLifecycleBusy(null);
    }
  }

  async function handleDuplicate() {
    if (!quote) return;
    setLifecycleBusy('dup');
    try {
      await duplicateProjectQuote(quote);
      await mutateQuote();
      toast.success('Árajánlat másolva — új piszkozat létrehozva.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Másolás sikertelen');
    } finally {
      setLifecycleBusy(null);
    }
  }

  /**
   * Az "Exportálás munkalappá" gomb többé nem blokkol elfogadatlan árajánlatnál.
   * Helyette megerősítő ablak kérdez rá: "Elfogadták az árajánlatot?".
   *  • Igen → ha még nem elfogadott, a háttérben send→accept lépéseket megtesszük
   *           (a state-gép: draft → sent → accepted), majd exportálunk.
   *  • Nem → "Nem, irány az árajánlat" → bezárjuk az ablakot, a user a fenti
   *           Küldés/Elfogadás gombokkal intézheti az árajánlatot.
   */
  function onExportClick() {
    if (!quote) return;
    if (quote.state === 'accepted') {
      void handleExport();
    } else {
      setShowAcceptConfirm(true);
    }
  }

  async function handleConfirmAccepted() {
    if (!quote) return;
    setShowAcceptConfirm(false);
    setExportBusy(true);
    try {
      // A state-gép lépcsőit a tényleges állapottól függően tesszük meg.
      if (quote.state === 'draft') {
        await sendProjectQuote(quote.id, recipientEmail || undefined);
        await acceptProjectQuote(quote.id);
      } else if (quote.state === 'sent') {
        await acceptProjectQuote(quote.id);
      }
      await mutateQuote();
      await exportQuoteToWorkOrder(quote.id);
      toast.success('Árajánlat elfogadva és munkalap létrehozva — a task-ok felkerülnek a Projekt mapre.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Művelet sikertelen');
    } finally {
      setExportBusy(false);
    }
  }

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (quoteLoading) {
    return <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400 text-sm">Töltés…</div>;
  }

  if (!quote) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-10 text-center">
        <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500 mb-4">Ehhez a projekthez még nincs árajánlat.</p>
        {customerId ? (
          <button type="button" onClick={startQuote} disabled={creating}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {creating ? 'Indítás…' : 'Árajánlat indítása'}
          </button>
        ) : (
          <p className="text-xs text-amber-600">A projektnek nincs megrendelője — előbb rendelj hozzá egy ügyfelet az Alap adatok fülön.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Összegző fejléc + akció-gombok */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{quote.quoteNumber}</span>
              {(() => {
                const badge = STATE_BADGE[quote.state] ?? STATE_BADGE.draft;
                return <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', badge.cls)}>{badge.label}</span>;
              })()}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Nettó: <span className="font-mono">{fmt(Number(quote.subtotal))}</span> ·
              ÁFA ({quote.taxRate}%): <span className="font-mono">{fmt(Number(quote.taxAmount))}</span> ·
              <span className="font-semibold text-gray-900"> Bruttó: <span className="font-mono">{fmt(Number(quote.totalAmount))} Ft</span></span>
            </div>
            {/* Alvállalkozói felár audit (Loricatus 4-bontás) — csak ha van X-tétel. */}
            {quote.metadata?.pricing?.subcontractorRaw && quote.metadata.pricing.subcontractorRaw > 0 && (
              <div className="text-[11px] text-gray-400 mt-1">
                Ebből alvállalkozói beszerzés: <span className="font-mono">{fmt(quote.metadata.pricing.subcontractorRaw)} Ft</span>
                {' '}× {quote.metadata.pricing.subcontractorMarkup?.toFixed(2) ?? '1.20'} szorzó
                {' '}= <span className="font-mono">{fmt(quote.metadata.pricing.subcontractorRaw * (quote.metadata.pricing.subcontractorMarkup ?? 1.2))} Ft</span>
                {' '}(felár: <span className="font-mono">{fmt(quote.metadata.pricing.subcontractorMarkupAmount ?? 0)} Ft</span>)
              </div>
            )}
            {quote.priceLockedAt && (
              <div className="text-[11px] text-gray-400 mt-1">
                Az árak rögzítve: {new Date(quote.priceLockedAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })}
                {' '}— egy későbbi áremelés ezt az árajánlatot nem módosítja.
              </div>
            )}
            {/* Küldéshez opcionális e-mail (csak piszkozatnál) */}
            {quote.state === 'draft' && (
              <input
                type="email"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                placeholder="Ügyfél e-mail (opcionális küldéskor)"
                className="mt-2 w-64 max-w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
              />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Életciklus-gombok — ugyanazok, mint a CRM → Árajánlatok panelen */}
            {quote.state === 'draft' && (
              <button type="button" onClick={handleSend} disabled={lifecycleBusy === 'send'}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                {lifecycleBusy === 'send' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Küldés ügyfélnek
              </button>
            )}
            {quote.state === 'sent' && (
              <>
                <button type="button" onClick={handleAccept} disabled={lifecycleBusy === 'accept'}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                  {lifecycleBusy === 'accept' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Elfogadás
                </button>
                <button type="button" onClick={handleReject} disabled={lifecycleBusy === 'reject'}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                  {lifecycleBusy === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Elutasítás
                </button>
              </>
            )}
            <button type="button" onClick={() => handlePreviewOrDownload('preview')}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 inline-flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Előnézet
            </button>
            <button type="button" onClick={handleGenerate} disabled={pdfBusy}
              className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 inline-flex items-center gap-1.5">
              {pdfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              PDF generálás
            </button>
            <button type="button" onClick={() => handlePreviewOrDownload('download')}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 inline-flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Letöltés
            </button>
            <button type="button" onClick={handleDuplicate} disabled={lifecycleBusy === 'dup'}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-1.5">
              {lifecycleBusy === 'dup' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              Másolás
            </button>
            <button type="button" onClick={onExportClick} disabled={exportBusy || lineItems.length === 0}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-1.5">
              {exportBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
              Exportálás munkalappá
            </button>
          </div>
        </div>
      </div>

      {/* Tételcsoportok — lenyíló, pipálható */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {sections.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">
            Nincs árazógép-tétel. Hozz létre tételeket az Árazógép oldalon.
          </div>
        )}
        {sections.map(section => {
          const isCollapsed = collapsed.has(section.id);
          const checkedCount = section.items.filter(it => lineByPricingItem.has(it.id)).length;
          return (
            <div key={section.id} className="border-b border-gray-50 last:border-b-0">
              <button
                type="button"
                onClick={() => toggleCollapse(section.id)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
                style={{ background: section.color + '55' }}
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                <span className="text-sm font-semibold text-gray-800">{section.name}</span>
                <span className="text-xs text-gray-500">
                  {checkedCount > 0 ? `${checkedCount} / ${section.items.length} kiválasztva` : `${section.items.length} tétel`}
                </span>
              </button>
              {!isCollapsed && (
                <ul className="divide-y divide-gray-50">
                  {section.items.map(it => {
                    const checked = lineByPricingItem.has(it.id);
                    const isPercent = it.metadata?.calcMode === 'percent';
                    return (
                      <li key={it.id}
                        className={clsx('flex items-center gap-3 px-4 py-2 transition', checked ? 'bg-brand-50/50' : 'hover:bg-gray-50')}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busyItem === it.id}
                          onChange={() => toggleItem(it.id, { name: it.name, unitPrice: Number(it.unitPrice), quantity: Number(it.quantity), unit: it.unit }, section.name)}
                          className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400 shrink-0"
                        />
                        <span className="flex-1 text-sm text-gray-800">{it.name}</span>
                        <span className="text-xs text-gray-400 w-24 text-right">{it.unit ?? ''}</span>
                        <span className="text-sm font-mono text-gray-700 w-32 text-right">
                          {isPercent
                            ? `${it.metadata?.percentValue ?? 0}%`
                            : `${fmt(Number(it.unitPrice))} Ft`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* "Elfogadták az árajánlatot?" megerősítő ablak — az export előtt */}
      {showAcceptConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAcceptConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Elfogadták az árajánlatot?</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Ha igen, az árajánlatot elfogadottra állítjuk, és a tételek munkalapként
                  exportálódnak — a task-ok felkerülnek a Projekt mapre.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button type="button" onClick={() => setShowAcceptConfirm(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Nem, irány az árajánlat
              </button>
              <button type="button" onClick={handleConfirmAccepted}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 inline-flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Igen, elfogadták
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
