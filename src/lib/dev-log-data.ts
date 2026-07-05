/* ─── Fejlesztési napló ───────────────────────────────────────
 * Minden sprint / munkanaphoz egy bejegyzés.
 * Legfrissebb felül.
 * ─────────────────────────────────────────────────────────────*/

export interface DevLogEntry {
  date: string;       // ISO dátum: 2026-03-21
  sprint: string;     // pl. "Sprint 2.5"
  title: string;      // rövid cím
  items: { tag: 'API' | 'Web' | 'Mobile' | 'Infra' | 'Docs'; text: string }[];
  nextUp?: string;    // mi jön következőnek
}

export const DEV_LOG: DevLogEntry[] = [
  {
    date: '2026-03-21',
    sprint: 'Sprint 2.5',
    title: 'Web UI quick wins — összefüggések I.',
    items: [
      { tag: 'Web',  text: 'Work Order detail oldal (/work-orders/[id]) — teljes adatlap, állapotváltás gombok, PDF generálás/letöltés' },
      { tag: 'Web',  text: 'Invoice PDF: helyes /download-url endpoint bekötve; conditional generate/download gomb (generatedStorageKey alapján)' },
      { tag: 'Web',  text: 'Customer detail hub: +3 tab — Szerződések, Számlák, Munkalapok (lazy useSWR)' },
      { tag: 'Web',  text: 'Szerződés lejárat vizuális jelzés: ≤30 nap → narancssárga sor + nap számláló; lejárt → piros' },
      { tag: 'API',  text: 'ContractsService.findByCustomer() + GET /contracts/customer/:id endpoint' },
      { tag: 'API',  text: 'Deal WON → CrmTask auto-létrehozás: "Számla kiállítása", high prio, 7 nap határidő, deal+customer linkelve' },
    ],
    nextUp: 'Sprint 3: Activity FK migration (contractId, workOrderId), Upload→Document konverzió, Contract PDF generálás',
  },
  {
    date: '2026-03-21',
    sprint: 'Sprint 1+2',
    title: 'PDF processzorok, Projekt hub, CRM workflow automatizáció',
    items: [
      { tag: 'API',  text: 'WorkOrdersProcessor — Bull queue feldolgozó: PDF generálás → Storage → Document entitás auto-létrehozás' },
      { tag: 'API',  text: 'QuotesProcessor — ugyanaz a pattern: generatedStorageKey + Document ha van projectId' },
      { tag: 'API',  text: 'InvoicesProcessor — INVOICE_PDF_QUEUE feldolgozó + module bővítés' },
      { tag: 'API',  text: 'DocumentsService.createFromGenerated() — PDF-ből közvetlenül GENERATED állapotú Document entitás' },
      { tag: 'API',  text: 'DocumentType enum: +work_order_pdf, +quote_pdf, +invoice_pdf (migration: ALTER TYPE ... ADD VALUE IF NOT EXISTS)' },
      { tag: 'API',  text: 'Quote → Contract automatikus létrehozás: QuotesService.accept() → ContractsService.createFromQuote() (graceful fallback)' },
      { tag: 'API',  text: 'ContractsService.generateContractNumber() — CNT-YYYY-NNN formátum, tenant-szintű szekvencia' },
      { tag: 'API',  text: 'invoices.findAll() — projectId szűrő hozzáadva; quotes.findAll() — dealId szűrő hozzáadva' },
      { tag: 'Web',  text: 'Projekt detail hub — 7 tabos lazy-loading: Alap adatok | Dokumentumok | Feltöltések | Munkalapok | Szerződések | Számlák | Tevékenységek' },
      { tag: 'Web',  text: 'Deal detail oldal (/crm/deals/[id]) — Árajánlatok + Számlák szekciók, info kártyák (valószínűség, zárás, darabszámok)' },
      { tag: 'Web',  text: 'DealCard: ExternalLink ikon → deal detail navigáció' },
    ],
    nextUp: 'Sprint 2.5: Work Order detail oldal, Invoice PDF gomb, Customer hub bővítés',
  },
  {
    date: '2026-03-20',
    sprint: 'Infrastruktura + Mobil Phase 3',
    title: 'Docker stack, CORS, admin auth, seed adatok, mobil CRM',
    items: [
      { tag: 'Infra', text: 'Docker dev stack: API + Worker + PostgreSQL + Redis + MinIO konténerek, health check-ek' },
      { tag: 'Infra', text: 'CORS patch: ConfigService + env alapú origin whitelist' },
      { tag: 'Infra', text: 'Admin account fix: accounts auth javítás, seed script (tenants, users, demo adatok)' },
      { tag: 'API',   text: 'Pipeline fix: több TypeORM entity regisztráció javítás, TS build hibák' },
      { tag: 'API',   text: 'Work Orders modul: teljes CRUD + állapotgép (draft→active→completed→archived/cancelled) + PDF queue' },
      { tag: 'Mobile', text: 'Mobil Phase 3: Ügyfelek lista + 360° summary, Deal lista + detail + gyors deal létrehozás' },
      { tag: 'Mobile', text: 'Web preview oldal mobilon; push token null fix; értesítés ikon' },
      { tag: 'Docs',  text: 'osszefuggesek.md — átfogó összefüggés-dokumentum létrehozva (Sprint 1–6 roadmap)' },
    ],
  },
];
