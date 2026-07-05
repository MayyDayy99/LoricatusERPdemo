'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/hooks/use-users';
import { useCommissionSettings, updateCommissionSettings } from '@/lib/hooks/use-commission';

export default function JutalekKonfigPage() {
  const { currentUser } = useCurrentUser();
  const role = (currentUser as any)?.role;
  const isAdmin = role === 'admin' || role === 'ADMIN' || role === 'ceo' || role === 'CEO';

  const { settings, mutate } = useCommissionSettings();
  const [dailyRate, setDailyRate] = useState(50000);
  const [workforce, setWorkforce] = useState(8);
  const [monthlyBaseSalary, setMonthlyBaseSalary] = useState(0);
  // 4-bontás (LOGIKA-infografika): a Z listaár %-os felbontása.
  const [ratioCost, setRatioCost] = useState(0.55);
  const [ratioProfit, setRatioProfit] = useState(0.20);
  const [ratioCommission, setRatioCommission] = useState(0.05);
  const [ratioOverhead, setRatioOverhead] = useState(0.20);
  const [subcontractorMarkup, setSubcontractorMarkup] = useState(1.20);
  // Milestone-offset (jutalék-folyamat): hány hónap az utolsó task end_date után.
  const [customerPaymentOffsetMonths, setCustomerPaymentOffsetMonths] = useState(1);
  const [commissionPayoutOffsetMonths, setCommissionPayoutOffsetMonths] = useState(2);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings) {
      setDailyRate(settings.dailyRateHuf);
      setWorkforce(settings.workforceSize);
      setMonthlyBaseSalary(settings.monthlyBaseSalaryHuf ?? 0);
      setRatioCost(Number(settings.ratioCost ?? 0.55));
      setRatioProfit(Number(settings.ratioProfit ?? 0.20));
      setRatioCommission(Number(settings.ratioCommission ?? settings.commissionRatio ?? 0.05));
      setRatioOverhead(Number(settings.ratioOverhead ?? 0.20));
      setSubcontractorMarkup(Number(settings.subcontractorMarkup ?? 1.20));
      setCustomerPaymentOffsetMonths(Number(settings.customerPaymentOffsetMonths ?? 1));
      setCommissionPayoutOffsetMonths(Number(settings.commissionPayoutOffsetMonths ?? 2));
    }
  }, [settings]);

  const ratioSumPct = (ratioCost + ratioProfit + ratioCommission + ratioOverhead) * 100;
  const ratioSumOk = Math.abs(ratioSumPct - 100) < 0.1;

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold text-gray-900">Jutalék-konfiguráció</h1>
        <p className="mt-3 text-sm text-gray-500">Ez a felület csak admin / CEO szerepkörrel érhető el.</p>
      </div>
    );
  }

  async function save() {
    if (!ratioSumOk) {
      toast.error(`Az ár-felbontás 4 aránya összesen ${ratioSumPct.toFixed(1)}% — pontosan 100% kell legyen.`);
      return;
    }
    setBusy(true);
    try {
      await updateCommissionSettings({
        // A `commissionRatio` szinkronban a `ratioCommission`-nal (backend is összehangolja).
        commissionRatio: ratioCommission,
        dailyRateHuf: dailyRate,
        workforceSize: workforce,
        monthlyBaseSalaryHuf: monthlyBaseSalary,
        ratioCost,
        ratioProfit,
        ratioCommission,
        ratioOverhead,
        subcontractorMarkup,
        customerPaymentOffsetMonths,
        commissionPayoutOffsetMonths,
      });
      await mutate();
      toast.success('Beállítások mentve');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setBusy(false);
    }
  }

  // Példa-számítás 1 000 000 Ft listaár (Z) esetén — LOGIKA-infografika szerint.
  const exampleZ = 1_000_000;
  const exampleX = Math.floor(exampleZ * ratioCost);                  // önköltség
  const exampleCommission = Math.floor(exampleZ * ratioCommission);   // jutalék
  const exampleDays = Math.max(1, Math.round(exampleX / dailyRate));
  const examplePerHead = Math.floor(exampleCommission / workforce);

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <Link href="/jutalek" className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> Vissza a jutalék-listához
        </Link>
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-600" />
          <h1 className="text-xl font-semibold text-gray-900">Jutalék-konfiguráció</h1>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          A jutalék-számítást és az árképzést vezérlő globális paraméterek. A „LORICATUS"
          árazási logika (4-bontás) alapján: a listaár (Z) felbomlik önköltségre (55%),
          fedezetre (20%), jutalékra (5%) és rezsire (20%). Plusz az alvállalkozói felár
          (Loricatus_ár = alvállalkozó × 1.20).
        </p>
      </header>

      <section className="bg-white border border-gray-100 rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Ár-felbontás (Z = listaár)</h2>
          <p className="text-xs text-gray-500 mb-3">
            A 4 arány összege pontosan <strong>100%</strong> kell legyen. Jelenleg{' '}
            <span className={ratioSumOk ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
              {ratioSumPct.toFixed(1)}%
            </span>.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <RatioField label="Önköltség (X)" hint="Ráfordított idő × ft." value={ratioCost} onChange={setRatioCost} />
          <RatioField label="Fedezet (profit)" hint="A cég profitja." value={ratioProfit} onChange={setRatioProfit} />
          <RatioField label="Jutalék (értékesítés)" hint="A dolgozóknak megy." value={ratioCommission} onChange={setRatioCommission} />
          <RatioField label="Rezsi (működési)" hint="A cég működési költségei." value={ratioOverhead} onChange={setRatioOverhead} />
        </div>
        <Field
          label="Alvállalkozó-felár szorzó"
          hint="Loricatus_ár = alvállalkozó_díj × szorzó. Default 1.20 (20% felár)."
        >
          <input
            type="number"
            min={1}
            max={5}
            step={0.01}
            value={subcontractorMarkup}
            onChange={(e) => setSubcontractorMarkup(Math.max(1, Math.min(5, parseFloat(e.target.value) || 1)))}
            className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <span className="ml-2 text-sm text-gray-500">× ({Math.round((subcontractorMarkup - 1) * 100)}% felár)</span>
        </Field>
        <Field
          label="Ügyfél-kifizetés (hó)"
          hint="A WO utolsó task end_date-je után hány hóval várjuk az ügyfél-kifizetést. Default 1 hó."
        >
          <input
            type="number"
            min={1}
            max={12}
            step={1}
            value={customerPaymentOffsetMonths}
            onChange={(e) => setCustomerPaymentOffsetMonths(Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1)))}
            className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <span className="ml-2 text-sm text-gray-500">hó</span>
        </Field>
        <Field
          label="Jutalék-kifizetés (hó)"
          hint="A WO utolsó task end_date-je után hány hóval fizetjük a jutalékot. Default 2 hó."
        >
          <input
            type="number"
            min={1}
            max={12}
            step={1}
            value={commissionPayoutOffsetMonths}
            onChange={(e) => setCommissionPayoutOffsetMonths(Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1)))}
            className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <span className="ml-2 text-sm text-gray-500">hó</span>
        </Field>
      </section>

      <section className="bg-white border border-gray-100 rounded-lg p-5 space-y-5">
        <Field
          label="Napi érték (Ft)"
          hint="Egy munkanap pénzbeli értéke. NAPOK (1 fő) = X / napi érték."
        >
          <input
            type="number"
            min={1}
            step={1000}
            value={dailyRate}
            onChange={(e) => setDailyRate(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <span className="ml-2 text-sm text-gray-500">Ft / nap</span>
        </Field>

        <Field
          label="Dolgozói létszám"
          hint="Hány fő közt oszlik el a jutalék (egyenlően). 1-100 között."
        >
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={workforce}
            onChange={(e) => setWorkforce(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))}
            className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <span className="ml-2 text-sm text-gray-500">fő</span>
        </Field>

        <Field
          label="Havi alapbér (Ft)"
          hint="Tenant-globális havi alapbér. A /jutalek oldalon „Fizetésed”-ként jelenik meg, és összeadódik a jutalékkal."
        >
          <input
            type="number"
            min={0}
            step={1000}
            value={monthlyBaseSalary}
            onChange={(e) => setMonthlyBaseSalary(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <span className="ml-2 text-sm text-gray-500">Ft / hó</span>
        </Field>

        <div className="pt-4 border-t border-gray-100">
          <button
            onClick={save}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> {busy ? 'Mentés…' : 'Beállítások mentése'}
          </button>
        </div>
      </section>

      <section className="bg-gray-50 border border-gray-100 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Példa-számítás</h2>
        <div className="space-y-1.5 text-sm text-gray-600">
          <div><strong>1 000 000 Ft listaár (Z)</strong> Y (saját) tétel esetén:</div>
          <div className="pl-4">Önköltség (X) = 1 000 000 × {ratioCost.toFixed(2)} = <strong className="text-gray-900">{exampleX.toLocaleString('hu')} Ft</strong></div>
          <div className="pl-4">Jutalék = 1 000 000 × {ratioCommission.toFixed(2)} = <strong className="text-gray-900">{exampleCommission.toLocaleString('hu')} Ft</strong></div>
          <div className="pl-4">NAPOK (1 fő) = ⌈{exampleX.toLocaleString('hu')} / {dailyRate.toLocaleString('hu')}⌉ = <strong className="text-gray-900">{exampleDays} nap</strong></div>
          <div className="pl-4">Egy főre eső jutalék = {exampleCommission.toLocaleString('hu')} / {workforce} = <strong className="text-gray-900">{examplePerHead.toLocaleString('hu')} Ft</strong></div>
          <div className="pt-2">
            <strong>500 000 Ft alvállalkozói tétel (X-jelölésű)</strong> esetén:
          </div>
          <div className="pl-4">Loricatus-ár = 500 000 × {subcontractorMarkup.toFixed(2)} = <strong className="text-gray-900">{(500_000 * subcontractorMarkup).toLocaleString('hu')} Ft</strong></div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">{label}</label>
      <div className="flex items-center">{children}</div>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  );
}

function RatioField({
  label, hint, value, onChange,
}: {
  label: string; hint: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={Math.round(value * 100)}
          onChange={(e) => onChange(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) / 100)}
          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono"
        />
        <span className="text-sm text-gray-500">%</span>
      </div>
      <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>
    </div>
  );
}
