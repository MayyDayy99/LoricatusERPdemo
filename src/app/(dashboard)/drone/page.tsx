'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  AlertTriangle, Calendar, CheckCircle2, Circle, Clock, Copy, Download, Eye, FileCheck,
  FileText, FolderOpen, Mail, MapPin, Paperclip, Pencil, Plane, Plus, Radio, Send, Shield, Siren,
  Trash2, Upload, User, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useDroneAssets, useDronePilots, useDroneOperations,
  createDroneOperation, updateDroneOperation, deleteDroneOperation,
  transitionDroneOperation, fetchOperationNotams,
  useOperationDocuments, uploadOperationDocument, deleteOperationDocument,
  useDroneFormInvites, createDroneFormInvite, cancelDroneFormInvite,
  DRONE_DOC_CATEGORY_LABELS,
  type DroneOperation, type NotamLookupResult,
  type DroneDocument, type DroneDocumentCategory,
  type DroneFormInvite,
} from '@/lib/hooks/use-drone';
import { SubmissionViewModal } from '@/components/drone/submission-view-modal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  planned:     'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-50 text-red-500',
  aborted:     'bg-orange-100 text-orange-600',
};
const STATUS_HU: Record<string, string> = {
  planned:     'Tervezett',
  in_progress: 'Repülés',
  completed:   'Befejezett',
  cancelled:   'Törölve',
  aborted:     'Megszakítva',
};

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Operation Modal ──────────────────────────────────────────────────────────

interface OpForm {
  location: string;
  locationAddress: string;
  locationGpsLat: string;
  locationGpsLng: string;
  plannedDate: string;
  droneAssetId: string;
  pilotId: string;
  workOrderId: string;
  operationType: string;
  maxAltitudeM: string;
  airspacePermitRequired: boolean;
  airspacePermitAcquired: boolean;
  airspacePermitNumber: string;
  airspacePermitExpiry: string;
  policeNotificationRequired: boolean;
  policeNotificationDone: boolean;
  policeNotificationRef: string;
  calendarEntryDone: boolean;
  clientDeclarationReceived: boolean;
  weatherConditions: string;
  notes: string;
}

function OperationModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: DroneOperation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { assets } = useDroneAssets();
  const { pilots } = useDronePilots();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<OpForm>({
    location:                   initial?.location                   ?? '',
    locationAddress:            initial?.locationAddress            ?? '',
    locationGpsLat:             initial?.locationGps?.lat?.toString() ?? '',
    locationGpsLng:             initial?.locationGps?.lng?.toString() ?? '',
    plannedDate:                initial?.plannedDate                ? initial.plannedDate.slice(0, 10) : '',
    droneAssetId:               initial?.droneAssetId               ?? '',
    pilotId:                    initial?.pilotId                    ?? '',
    workOrderId:                initial?.workOrderId                ?? '',
    operationType:              initial?.operationType              ?? '',
    maxAltitudeM:               initial?.maxAltitudeM?.toString()   ?? '',
    airspacePermitRequired:     initial?.airspacePermitRequired     ?? false,
    airspacePermitAcquired:     initial?.airspacePermitAcquired     ?? false,
    airspacePermitNumber:       initial?.airspacePermitNumber       ?? '',
    airspacePermitExpiry:       initial?.airspacePermitExpiry       ? initial.airspacePermitExpiry.slice(0, 10) : '',
    policeNotificationRequired: initial?.policeNotificationRequired ?? false,
    policeNotificationDone:     initial?.policeNotificationDone     ?? false,
    policeNotificationRef:      initial?.policeNotificationRef      ?? '',
    calendarEntryDone:          initial?.calendarEntryDone          ?? false,
    clientDeclarationReceived:  initial?.clientDeclarationReceived  ?? false,
    weatherConditions:          initial?.weatherConditions          ?? '',
    notes:                      initial?.notes                      ?? '',
  });

  type StringFields = {
    [K in keyof OpForm]: OpForm[K] extends string ? K : never
  }[keyof OpForm];
  type BoolFields = {
    [K in keyof OpForm]: OpForm[K] extends boolean ? K : never
  }[keyof OpForm];

  const set = (k: StringFields, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setBool = (k: BoolFields, v: boolean) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const lat = form.locationGpsLat ? parseFloat(form.locationGpsLat) : undefined;
      const lng = form.locationGpsLng ? parseFloat(form.locationGpsLng) : undefined;
      const gps = lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)
        ? { lat, lng }
        : undefined;
      const dto: Partial<DroneOperation> = {
        location:                   form.location                   || undefined,
        locationAddress:            form.locationAddress            || undefined,
        locationGps:                gps,
        plannedDate:                form.plannedDate                || undefined,
        droneAssetId:               form.droneAssetId               || undefined,
        pilotId:                    form.pilotId                    || undefined,
        workOrderId:                form.workOrderId                || undefined,
        operationType:              form.operationType              || undefined,
        maxAltitudeM:               form.maxAltitudeM               ? parseFloat(form.maxAltitudeM) : undefined,
        airspacePermitRequired:     form.airspacePermitRequired,
        airspacePermitAcquired:     form.airspacePermitAcquired,
        airspacePermitNumber:       form.airspacePermitNumber       || undefined,
        airspacePermitExpiry:       form.airspacePermitExpiry       || undefined,
        policeNotificationRequired: form.policeNotificationRequired,
        policeNotificationDone:     form.policeNotificationDone,
        policeNotificationRef:      form.policeNotificationRef      || undefined,
        calendarEntryDone:          form.calendarEntryDone,
        clientDeclarationReceived:  form.clientDeclarationReceived,
        weatherConditions:          form.weatherConditions          || undefined,
        notes:                      form.notes                      || undefined,
      };
      if (initial) {
        await updateDroneOperation(initial.id, dto);
        toast.success('Repülés frissítve');
      } else {
        await createDroneOperation(dto);
        toast.success('Repülés létrehozva');
      }
      onSaved();
      onClose();
    } catch {
      toast.error('Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold">
          {initial ? 'Repülés szerkesztése' : 'Új drone repülés'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Drone</label>
              <select
                value={form.droneAssetId}
                onChange={e => set('droneAssetId', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— Nincs —</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pilóta</label>
              <select
                value={form.pilotId}
                onChange={e => set('pilotId', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— Nincs —</option>
                {pilots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <input
            placeholder="Helyszín neve / megnevezése"
            value={form.location}
            onChange={e => set('location', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          <input
            placeholder="Pontos cím (utca, házszám, város, irányítószám)"
            value={form.locationAddress}
            onChange={e => set('locationAddress', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">GPS — szélesség (lat)</label>
              <input
                type="number" step="0.000001"
                placeholder="pl. 47.5012"
                value={form.locationGpsLat}
                onChange={e => set('locationGpsLat', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">GPS — hosszúság (lng)</label>
              <input
                type="number" step="0.000001"
                placeholder="pl. 19.0500"
                value={form.locationGpsLng}
                onChange={e => set('locationGpsLng', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tervezett dátum</label>
              <input
                type="date"
                value={form.plannedDate}
                onChange={e => set('plannedDate', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max. magasság (m)</label>
              <input
                type="number" step="0.1"
                placeholder="pl. 120"
                value={form.maxAltitudeM}
                onChange={e => set('maxAltitudeM', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Művelet típusa</label>
            <input
              placeholder="pl. Légifelvétel, Mérés, Inspekció"
              value={form.operationType}
              onChange={e => set('operationType', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* ── Légtérengedély ─────────────────────────────────────────────── */}
          <fieldset className="border border-gray-200 rounded-lg p-3 space-y-2.5">
            <legend className="px-2 text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              Légtérengedély
            </legend>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox"
                checked={form.airspacePermitRequired}
                onChange={e => setBool('airspacePermitRequired', e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Engedély szükséges</span>
            </label>
            <label className={clsx('flex items-center gap-2 text-sm cursor-pointer', !form.airspacePermitRequired && 'opacity-50')}>
              <input type="checkbox"
                disabled={!form.airspacePermitRequired}
                checked={form.airspacePermitAcquired}
                onChange={e => setBool('airspacePermitAcquired', e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Engedély megszerezve</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Határozatszám"
                value={form.airspacePermitNumber}
                onChange={e => set('airspacePermitNumber', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                type="date"
                title="Engedély lejárata"
                value={form.airspacePermitExpiry}
                onChange={e => set('airspacePermitExpiry', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </fieldset>

          {/* ── Rendőrségi bejelentés ──────────────────────────────────────── */}
          <fieldset className="border border-gray-200 rounded-lg p-3 space-y-2.5">
            <legend className="px-2 text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Siren className="w-3.5 h-3.5" />
              Rendőrségi bejelentés
            </legend>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox"
                checked={form.policeNotificationRequired}
                onChange={e => setBool('policeNotificationRequired', e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Bejelentés szükséges</span>
            </label>
            <label className={clsx('flex items-center gap-2 text-sm cursor-pointer', !form.policeNotificationRequired && 'opacity-50')}>
              <input type="checkbox"
                disabled={!form.policeNotificationRequired}
                checked={form.policeNotificationDone}
                onChange={e => setBool('policeNotificationDone', e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Bejelentés megtörtént</span>
            </label>
            <input
              placeholder="Iktatószám"
              value={form.policeNotificationRef}
              onChange={e => set('policeNotificationRef', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </fieldset>

          {/* ── Egyéb ellenőrzések ─────────────────────────────────────────── */}
          <fieldset className="border border-gray-200 rounded-lg p-3 space-y-2.5">
            <legend className="px-2 text-xs font-semibold text-gray-600 flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5" />
              Egyéb ellenőrzések
            </legend>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox"
                checked={form.calendarEntryDone}
                onChange={e => setBool('calendarEntryDone', e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Naptárba beírva</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox"
                checked={form.clientDeclarationReceived}
                onChange={e => setBool('clientDeclarationReceived', e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Ügyfélnyilatkozat megérkezett</span>
            </label>
          </fieldset>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Időjárás</label>
            <input
              placeholder="pl. Szeles, 12°C"
              value={form.weatherConditions}
              onChange={e => set('weatherConditions', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <textarea
            rows={2}
            placeholder="Megjegyzések"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Mégsem
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Mentés...' : initial ? 'Módosítás' : 'Létrehozás'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Operation Card ───────────────────────────────────────────────────────────

function OperationCard({
  op,
  assets,
  pilots,
  onEdit,
  onDeleted,
  onTransitioned,
}: {
  op: DroneOperation;
  assets: import('@/lib/hooks/use-drone').DroneAsset[];
  pilots: import('@/lib/hooks/use-drone').DronePilot[];
  onEdit: (o: DroneOperation) => void;
  onDeleted: () => void;
  onTransitioned: () => void;
}) {
  const asset  = assets.find(a => a.id === op.droneAssetId);
  const pilot  = pilots.find(p => p.id === op.pilotId);

  const [notams, setNotams] = useState<NotamLookupResult | null>(null);
  const [notamsLoading, setNotamsLoading] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { documents, mutate: mutateDocs } = useOperationDocuments(showDocs ? op.id : null);
  const [showForms, setShowForms] = useState(false);
  const [formInviteOpen, setFormInviteOpen] = useState(false);
  const [viewingFormId, setViewingFormId] = useState<string | null>(null);
  const { invites, mutate: mutateInvites } = useDroneFormInvites(showForms ? op.id : null);

  async function handleNotamCheck() {
    setNotamsLoading(true);
    try {
      const r = await fetchOperationNotams(op.id);
      setNotams(r);
      if (r.warning) toast.warning(r.warning);
      else if (r.notams.length === 0) toast.success('Nincs releváns NOTAM');
      else toast.warning(`${r.notams.length} NOTAM a területen`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'NOTAM lekérdezés sikertelen');
    } finally {
      setNotamsLoading(false);
    }
  }

  async function handleTransition(action: 'start' | 'complete' | 'cancel' | 'abort') {
    try {
      await transitionDroneOperation(op.id, action);
      onTransitioned();
    } catch (err: any) {
      const status  = err?.response?.status;
      const message = err?.response?.data?.message ?? 'Állapotváltás sikertelen';
      // Pre-flight checklist guard — offer admin override on 400
      if (status === 400 && action === 'start' && /Hiányzó előfeltételek/i.test(message)) {
        if (confirm(`${message}\n\nMégis indítod? (csak admin)`)) {
          try {
            await transitionDroneOperation(op.id, action, { force: true });
            toast.warning('Repülés indítva — checklist felülírva');
            onTransitioned();
            return;
          } catch (err2: any) {
            toast.error(err2?.response?.data?.message ?? 'Indítás sikertelen');
            return;
          }
        }
        return;
      }
      toast.error(message);
    }
  }

  async function handleDelete() {
    if (!confirm('Törlöd ezt a repülést?')) return;
    try {
      await deleteDroneOperation(op.id);
      toast.success('Repülés törölve');
      onDeleted();
    } catch {
      toast.error('Törlés sikertelen');
    }
  }

  const permitExpiring = op.airspacePermitExpiry &&
    new Date(op.airspacePermitExpiry) < new Date(Date.now() + 7 * 86400_000);

  // Required checklist items + their status (only display required ones)
  const checklist: { label: string; done: boolean }[] = [];
  if (op.airspacePermitRequired)     checklist.push({ label: 'Légtér eng.', done: !!op.airspacePermitAcquired });
  if (op.policeNotificationRequired) checklist.push({ label: 'Rendőrség',   done: !!op.policeNotificationDone });
  // Calendar + client declaration: always display when explicitly checked off (signals an active workflow)
  if (op.calendarEntryDone)         checklist.push({ label: 'Naptár',      done: true });
  if (op.clientDeclarationReceived) checklist.push({ label: 'Ügyf.nyilatk.', done: true });

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2.5 hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {op.location || 'Helyszín nincs megadva'}
          </p>
          {op.locationAddress && (
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              {op.locationAddress}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDate(op.plannedDate)}
            {op.flightTimeMin && ` · ${op.flightTimeMin} perc`}
            {op.operationType && ` · ${op.operationType}`}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {op.projectId && (
            <Link href={`/rooms/${op.projectId}`} title="Megnyitás szobaként" className="p-1 text-gray-400 hover:text-brand-600 rounded">
              <FolderOpen className="w-3.5 h-3.5" />
            </Link>
          )}
          {op.status === 'planned' && (
            <button onClick={() => onEdit(op)} className="p-1 text-gray-400 hover:text-brand-600 rounded">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={handleDelete} className="p-1 text-gray-400 hover:text-red-500 rounded">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className={clsx('px-2 py-0.5 rounded-full font-medium', STATUS_BADGE[op.status])}>
          {STATUS_HU[op.status] ?? op.status}
        </span>
        {asset && (
          <span className="flex items-center gap-1 text-gray-500">
            <Plane className="w-3 h-3" />
            {asset.name}
          </span>
        )}
        {pilot && (
          <span className="flex items-center gap-1 text-gray-500">
            <User className="w-3 h-3" />
            {pilot.name}
          </span>
        )}
        {op.airspacePermitNumber && (
          <span className={clsx(
            'flex items-center gap-1 px-1.5 py-0.5 rounded',
            permitExpiring ? 'bg-yellow-50 text-yellow-700' : 'text-gray-500',
          )}>
            {permitExpiring && <AlertTriangle className="w-3 h-3" />}
            {op.airspacePermitNumber}
          </span>
        )}
        {op.maxAltitudeM && (
          <span className="text-gray-400">{op.maxAltitudeM} m</span>
        )}
      </div>

      {/* Checklist — required + completed items */}
      {checklist.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-50">
          {checklist.map((item, i) => (
            <span
              key={i}
              className={clsx(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs',
                item.done ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50',
              )}
              title={item.done ? 'Megvan' : 'Hiányzik'}
            >
              {item.done
                ? <CheckCircle2 className="w-3 h-3" />
                : <Circle className="w-3 h-3" />}
              {item.label}
            </span>
          ))}
        </div>
      )}

      {/* Transitions */}
      {op.status === 'planned' && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <button
            onClick={() => handleTransition('start')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            <Clock className="w-3 h-3" />
            Indít
          </button>
          <button
            onClick={() => handleTransition('cancel')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-600"
          >
            <XCircle className="w-3 h-3" />
            Lemondás
          </button>
          {op.locationGps && (
            <button
              onClick={handleNotamCheck}
              disabled={notamsLoading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              title="Légtér NOTAM ellenőrzés (3 NM sugarú körre)"
            >
              <Radio className="w-3 h-3" />
              {notamsLoading ? '…' : 'NOTAM'}
            </button>
          )}
        </div>
      )}

      {/* Documents toggle */}
      <button
        type="button"
        onClick={() => setShowDocs(s => !s)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600 pt-1 border-t border-gray-50"
      >
        <Paperclip className="w-3.5 h-3.5" />
        Dokumentumok
        <span className="text-gray-400">{showDocs ? '▼' : '▶'}</span>
      </button>

      {showDocs && (
        <div className="space-y-2 -mt-1">
          {documents.length === 0 && (
            <p className="text-xs text-gray-400 italic">Nincs feltöltött dokumentum</p>
          )}
          {documents.length > 0 && (
            <ul className="space-y-1">
              {documents.map(doc => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onDeleted={() => mutateDocs()}
                />
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            <Upload className="w-3.5 h-3.5" />
            PDF feltöltése
          </button>
        </div>
      )}

      {uploadOpen && (
        <UploadDocumentModal
          operationId={op.id}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => { mutateDocs(); setUploadOpen(false); }}
        />
      )}

      {/* Megrendelői űrlap (public magic-link) toggle */}
      <button
        type="button"
        onClick={() => setShowForms(s => !s)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600 pt-1 border-t border-gray-50"
      >
        <Mail className="w-3.5 h-3.5" />
        Megrendelői űrlap
        <span className="text-gray-400">{showForms ? '▼' : '▶'}</span>
      </button>

      {showForms && (
        <div className="space-y-2 -mt-1">
          {invites.length === 0 && (
            <p className="text-xs text-gray-400 italic">Nincs kiküldött űrlap</p>
          )}
          {invites.length > 0 && (
            <ul className="space-y-1">
              {invites.map(inv => (
                <FormInviteRow
                  key={inv.id}
                  invite={inv}
                  operationId={op.id}
                  onCancelled={() => mutateInvites()}
                  onView={(formId) => setViewingFormId(formId)}
                />
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setFormInviteOpen(true)}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            <Send className="w-3.5 h-3.5" />
            Új űrlap küldése
          </button>
        </div>
      )}

      {formInviteOpen && (
        <FormInviteModal
          operationId={op.id}
          onClose={() => setFormInviteOpen(false)}
          onCreated={() => { mutateInvites(); setFormInviteOpen(false); }}
        />
      )}

      {viewingFormId && (
        <SubmissionViewModal
          operationId={op.id}
          formId={viewingFormId}
          onClose={() => setViewingFormId(null)}
        />
      )}

      {/* NOTAM result inline panel */}
      {notams && (
        <div className="pt-2 border-t border-gray-50 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-gray-400">
            NOTAM — {new Date(notams.checkedAt).toLocaleString('hu-HU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
          </p>
          {notams.warning && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
              {notams.warning}
            </p>
          )}
          {!notams.warning && notams.notams.length === 0 && (
            <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Nincs aktív NOTAM a területen
            </p>
          )}
          {notams.notams.length > 0 && (
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {notams.notams.map((n, i) => (
                <li key={i} className="text-xs bg-amber-50 text-amber-900 rounded px-2 py-1.5 leading-snug">
                  <span className="font-mono text-amber-700">{n.id}</span>
                  {n.text && <span className="block text-amber-800 mt-0.5">{n.text}</span>}
                  {!n.text && n.rawText && (
                    <span className="block text-amber-800 mt-0.5 font-mono text-[11px]">
                      {String(n.rawText).slice(0, 200)}{String(n.rawText).length > 200 ? '…' : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {op.status === 'in_progress' && (
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => handleTransition('complete')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100"
          >
            <CheckCircle2 className="w-3 h-3" />
            Befejezés
          </button>
          <button
            onClick={() => handleTransition('abort')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-50 text-orange-600 hover:bg-orange-100"
          >
            <XCircle className="w-3 h-3" />
            Megszakít
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({ doc, onDeleted }: { doc: DroneDocument; onDeleted: () => void }) {
  const sizeKb = (doc.sizeBytes / 1024).toFixed(0);
  const dateLabel = new Date(doc.uploadedAt).toLocaleDateString('hu-HU', {
    year: '2-digit', month: 'short', day: 'numeric',
  });

  async function handleDelete() {
    if (!confirm(`Töröljed: ${doc.fileName}?`)) return;
    try {
      await deleteOperationDocument(doc.id);
      toast.success('Dokumentum törölve');
      onDeleted();
    } catch {
      toast.error('Törlés sikertelen');
    }
  }

  return (
    <li className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition">
      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-700 truncate">
          {doc.label || doc.fileName}
        </p>
        <p className="text-[11px] text-gray-400 truncate">
          {DRONE_DOC_CATEGORY_LABELS[doc.category]} · {sizeKb} kB · {dateLabel}
        </p>
      </div>
      {doc.downloadUrl && (
        <a
          href={doc.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Letöltés"
          className="p-1 text-gray-400 hover:text-brand-600 rounded shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
      )}
      <button
        type="button"
        onClick={handleDelete}
        title="Törlés"
        className="p-1 text-gray-400 hover:text-red-500 rounded shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}

// ─── Upload Document Modal ────────────────────────────────────────────────────

function UploadDocumentModal({
  operationId,
  onClose,
  onUploaded,
}: {
  operationId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [category, setCategory] = useState<DroneDocumentCategory>('airspace_permit');
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error('Válassz egy PDF fájlt');
      return;
    }
    if (file.type !== 'application/pdf') {
      toast.error('Csak PDF fájl engedélyezett');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Max. 50 MB');
      return;
    }
    setBusy(true);
    try {
      await uploadOperationDocument(operationId, { file, category, label: label || undefined });
      toast.success('Dokumentum feltöltve');
      onUploaded();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Feltöltés sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Upload className="w-5 h-5 text-brand-600" />
          Dokumentum feltöltése
        </h2>
        <p className="text-xs text-gray-500">
          Csak PDF, max. 50 MB. A dokumentumokat hatósági ellenőrzéshez tároljuk — törlés után is megőrződnek a naplóban.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Kategória</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as DroneDocumentCategory)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {(Object.entries(DRONE_DOC_CATEGORY_LABELS) as [DroneDocumentCategory, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Megnevezés (opcionális)</label>
            <input
              placeholder="pl. 2026/LEGTER000123 — Mátyás-templom"
              value={label}
              maxLength={255}
              onChange={e => setLabel(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">PDF fájl</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:text-xs hover:file:bg-brand-100"
            />
            {file && (
              <p className="text-xs text-gray-500 mt-1">
                {file.name} · {(file.size / 1024).toFixed(0)} kB
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Mégsem
            </button>
            <button
              type="submit"
              disabled={busy || !file}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Feltöltés…' : 'Feltöltés'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Form Invite Row ──────────────────────────────────────────────────────────

const FORM_STATUS_BADGE: Record<string, string> = {
  pending:   'bg-gray-100 text-gray-600',
  submitted: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-500',
  expired:   'bg-amber-50 text-amber-700',
};
const FORM_STATUS_HU: Record<string, string> = {
  pending:   'Függőben',
  submitted: 'Beküldve',
  cancelled: 'Törölve',
  expired:   'Lejárt',
};

function FormInviteRow({
  invite,
  operationId,
  onCancelled,
  onView,
}: {
  invite: DroneFormInvite;
  operationId: string;
  onCancelled: () => void;
  onView: (formId: string) => void;
}) {
  const expiresLabel = new Date(invite.expiresAt).toLocaleDateString('hu-HU', {
    year: '2-digit', month: 'short', day: 'numeric',
  });
  const isPending = invite.status === 'pending';
  const isExpired = isPending && new Date(invite.expiresAt).getTime() < Date.now();
  const effectiveStatus = isExpired ? 'expired' : invite.status;

  // A link a frontend WEB_URL-ből származik — ha nincs, használjuk a böngésző origin-jét.
  const webOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = invite.link ?? `${webOrigin}/public/drone-form/${invite.token}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link másolva');
    } catch {
      toast.error('Másolás sikertelen');
    }
  }

  async function handleCancel() {
    if (!confirm('Visszavonod a meghívót?')) return;
    try {
      await cancelDroneFormInvite(operationId, invite.id);
      toast.success('Meghívó visszavonva');
      onCancelled();
    } catch {
      toast.error('Visszavonás sikertelen');
    }
  }

  return (
    <li className="bg-gray-50 rounded-lg px-2 py-1.5 text-xs">
      <div className="flex items-center gap-2">
        <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-700 truncate">
            {invite.recipientName ?? invite.recipientEmail ?? '—'}
          </p>
          <p className="text-[11px] text-gray-400 truncate">
            {invite.recipientEmail} · lejár: {expiresLabel}
            {invite.attachmentCount > 0 && ` · ${invite.attachmentCount} mell.`}
          </p>
        </div>
        <span className={clsx('px-1.5 py-0.5 rounded-full font-medium', FORM_STATUS_BADGE[effectiveStatus])}>
          {FORM_STATUS_HU[effectiveStatus] ?? effectiveStatus}
        </span>
        {invite.status === 'submitted' && (
          <button
            type="button"
            onClick={() => onView(invite.id)}
            title="Beküldött űrlap megtekintése"
            className="p-1 text-gray-400 hover:text-brand-600 rounded shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
        {isPending && !isExpired && (
          <>
            <button
              type="button"
              onClick={copyLink}
              title="Link másolása"
              className="p-1 text-gray-400 hover:text-brand-600 rounded shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              title="Meghívó visszavonása"
              className="p-1 text-gray-400 hover:text-red-500 rounded shrink-0"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </li>
  );
}

// ─── Form Invite Modal ────────────────────────────────────────────────────────

function FormInviteModal({
  operationId,
  onClose,
  onCreated,
}: {
  operationId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientEmail.trim() || !recipientName.trim()) return;
    setBusy(true);
    try {
      const out = await createDroneFormInvite(operationId, {
        recipientEmail: recipientEmail.trim(),
        recipientName: recipientName.trim(),
        expiresInDays,
      });
      const webOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      setCreatedLink(out.link ?? `${webOrigin}/public/drone-form/${out.token}`);
      toast.success('Meghívó kiküldve');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Meghívó küldése sikertelen');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!createdLink) return;
    try {
      await navigator.clipboard.writeText(createdLink);
      toast.success('Link másolva');
    } catch {
      toast.error('Másolás sikertelen');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {!createdLink ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Megrendelői űrlap küldése</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email cím</label>
              <input
                type="email"
                required
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Megrendelő neve</label>
              <input
                type="text"
                required
                maxLength={200}
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Érvényesség (nap)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={expiresInDays}
                onChange={e => setExpiresInDays(Math.min(60, Math.max(1, parseInt(e.target.value, 10) || 14)))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Mégsem
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? 'Küldés…' : 'Küldés'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Meghívó kiküldve</h3>
            <p className="text-sm text-gray-600">
              Az email kiment, a link itt másolható (akkor is, ha az email nem érkezne meg):
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={createdLink}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50"
                onFocus={e => e.target.select()}
              />
              <button
                type="button"
                onClick={copyLink}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-brand-50 text-brand-700 hover:bg-brand-100"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => { onCreated(); }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700"
              >
                Rendben
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DronePage() {
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState<DroneOperation | 'new' | null>(null);

  const { operations, loading, error, mutate } = useDroneOperations({ status: filterStatus || undefined });
  const { assets } = useDroneAssets();
  const { pilots } = useDronePilots();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-50 rounded-xl">
            <Plane className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Drone repülések</h1>
            <p className="text-sm text-gray-500">{operations.length} repülés</p>
          </div>
        </div>
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-4 h-4" />
          Új repülés
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Minden státusz</option>
          <option value="planned">Tervezett</option>
          <option value="in_progress">Repülés</option>
          <option value="completed">Befejezett</option>
          <option value="cancelled">Törölve</option>
          <option value="aborted">Megszakítva</option>
        </select>
      </div>

      {/* List */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 h-32 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-red-500 text-sm">Betöltési hiba</div>
      )}

      {!loading && !error && operations.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Plane className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nincsenek repülések</p>
          <button
            onClick={() => setModal('new')}
            className="mt-4 text-brand-600 text-sm font-medium hover:underline"
          >
            Hozz létre egyet
          </button>
        </div>
      )}

      {!loading && operations.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {operations.map(op => (
            <OperationCard
              key={op.id}
              op={op}
              assets={assets}
              pilots={pilots}
              onEdit={o => setModal(o)}
              onDeleted={() => mutate()}
              onTransitioned={() => mutate()}
            />
          ))}
        </div>
      )}

      {/* Calendar view hint */}
      {!loading && operations.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-400 pt-2">
          <Calendar className="w-3.5 h-3.5" />
          Drone eszközök és pilóták kezelése az API-n keresztül érhető el (/drone/assets, /drone/pilots)
        </div>
      )}

      {modal && (
        <OperationModal
          initial={modal === 'new' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => mutate()}
        />
      )}
    </div>
  );
}
