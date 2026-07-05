export type RcSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type RcStatus = 'done' | 'pending' | 'in_progress';
export type CiStatus = 'pass' | 'fail' | 'skipped';
export type DeployStatus = 'done' | 'pending' | 'optional';

export interface RcItem {
  id: string;
  severity: RcSeverity;
  title: string;
  description: string;
  status: RcStatus;
}

export interface FeatureModule {
  icon: string;
  name: string;
  rcIds: string[];
  tasksTotal: number;
  tasksDone: number;
  ciStatus: CiStatus;
}

export interface CiCheck {
  icon: string;
  label: string;
  description: string;
  status: CiStatus;
}

export interface DeployItem {
  label: string;
  description: string;
  status: DeployStatus;
}

export interface HealthCategory {
  label: string;
  score: number;
  maxScore: number;
  icon: string;
  note: string;
}

export const RC_ITEMS: RcItem[] = [
  // ── RC Sprint 1 (2026-02-26) ────────────────────────────────────────────────
  {
    id: 'RC-001',
    severity: 'CRITICAL',
    title: 'PDF-generálás javítva',
    description: 'A rendszer most már valódi PDF dokumentumot tud előállítani. Korábban a PDF-csomag hiányzott, így az API összeomlott volna éles üzemben.',
    status: 'done',
  },
  {
    id: 'RC-002',
    severity: 'CRITICAL',
    title: 'Biztonsági beállítások élesítve',
    description: 'Éles üzemben a teszt-módok alapból ki vannak kapcsolva. Korábban csendben aktívak maradtak, ami nem valódi adatokat produkált.',
    status: 'done',
  },
  {
    id: 'RC-003',
    severity: 'CRITICAL',
    title: 'Worker konténer biztonságosan konfigurálva',
    description: 'A háttérfolyamat-kezelő is megkapta a helyes éles beállításokat, így nem fut tovább hamis (mock) üzemmódban.',
    status: 'done',
  },
  {
    id: 'RC-004',
    severity: 'HIGH',
    title: 'Docker képverziók rögzítve',
    description: 'A telepítési képek pontos verziószámhoz kötöttek — nem "latest". Kiszámítható, megismételhető telepítést garantál.',
    status: 'done',
  },
  {
    id: 'RC-005',
    severity: 'HIGH',
    title: 'TypeScript típusellenőrzés javítva',
    description: 'A kód típushibái ki lettek javítva. Megakadályoz egy egész osztálynyi futásidejű hibát fejlesztés közben.',
    status: 'done',
  },
  {
    id: 'RC-006',
    severity: 'HIGH',
    title: 'Fájlfeltöltés biztosítva',
    description: 'Csak engedélyezett fájltípusok tölthetők fel (képek, PDF, DWG). Korábban bármilyen fájl (pl. futtatható .exe) feltölthető volt.',
    status: 'done',
  },
  {
    id: 'RC-007',
    severity: 'HIGH',
    title: 'Megosztási linkek titkosítása erősítve',
    description: 'A megosztási linkek azonosítója 256 bites véletlenszámból áll. Korábban 128 bites UUID volt, amely szervezett támadással kitalálható.',
    status: 'done',
  },
  {
    id: 'RC-008',
    severity: 'HIGH',
    title: 'Megosztási linkek jelszóvédelme elkészült',
    description: 'Jelszóval védett linkek esetén a jelszó bcrypt-tel tárolódik, és brute-force elleni lassítás is be van kapcsolva.',
    status: 'done',
  },
  {
    id: 'RC-009',
    severity: 'MEDIUM',
    title: 'Fájlverziók nyilvántartása elkészült',
    description: 'Minden feltöltött fájl verziólánca nyomon követhető. Visszaállítás, összehasonlítás és auditálás elérhető.',
    status: 'done',
  },
  {
    id: 'RC-010',
    severity: 'MEDIUM',
    title: '3D modell integráció elkészült',
    description: 'Projektenként Sketchfab 3D modell csatolható és beágyazható. A modell linkje és embed-URL-je az API-n keresztül kezelhető.',
    status: 'done',
  },
  {
    id: 'RC-011',
    severity: 'MEDIUM',
    title: 'Telepítési varázsló magyarra fordítva',
    description: 'A telepítési lépések angolul, magyarul és olaszul is megjelennek. Korábban minden szöveg hardcoded angol volt.',
    status: 'done',
  },

  // ── RC Sprint 2 (2026-02-28) ────────────────────────────────────────────────
  {
    id: 'RC-012',
    severity: 'CRITICAL',
    title: 'Reprodukálható build (yarn.lock)',
    description: 'A csomagverzió-rögzítő fájl (yarn.lock) mostantól a repository részét képezi. Nélküle a CI minden futásnál más-más verziókat tölthetett volna le.',
    status: 'done',
  },
  {
    id: 'RC-013',
    severity: 'CRITICAL',
    title: 'Éles Docker képek elkészültek',
    description: 'Minden komponenshez (API, web, worker) multi-stage Dockerfile.prod készült, nem-root felhasználóval és dumb-init process managerrel.',
    status: 'done',
  },
  {
    id: 'RC-014',
    severity: 'CRITICAL',
    title: 'XSS sebezhetőség javítva (refresh token)',
    description: 'A refresh token már nem tárolódik localStorage-ban — kizárólag httpOnly cookie-ban él. XSS támadással így nem lopható el.',
    status: 'done',
  },
  {
    id: 'RC-015',
    severity: 'CRITICAL',
    title: '3D modell adatbázis-mező migrációja elkészült',
    description: 'A sketchfab_model_id oszlop az adatbázis-migrációban is megjelent. Korábban az entitás tartalmazta, de az adatbázis nem — éles indításkor hiba lett volna.',
    status: 'done',
  },
  {
    id: 'RC-016',
    severity: 'HIGH',
    title: 'Audit napló jogosultságvédelem (RolesGuard)',
    description: 'Az audit napló végpontjait mostantól a RBAC szerepkörvédelem is védi. Korábban csak JWT ellenőrzés volt, bármely bejelentkezett felhasználó lekérhette.',
    status: 'done',
  },
  {
    id: 'RC-017',
    severity: 'HIGH',
    title: 'PDF-csomag TypeScript útvonal regisztrálva',
    description: 'A @construction/infra-pdf csomag megjelent a tsconfig.base.json paths-ban. TypeScript típusellenőrzés mostantól teljes körű.',
    status: 'done',
  },
  {
    id: 'RC-018',
    severity: 'HIGH',
    title: 'API és Worker TypeScript konfig elkészült',
    description: 'Mindkét alkalmazáshoz tsconfig.json fájl jött létre. Korábban hiányoztak, a typecheck és ts-jest működésképtelen volt.',
    status: 'done',
  },
  {
    id: 'RC-019',
    severity: 'HIGH',
    title: '4 infracsomag csomagkonfigja elkészült',
    description: 'Az infra-google-maps, infra-sendgrid, infra-notam, infra-sketchfab csomagok package.json és jest.config fájljai létrehozva.',
    status: 'done',
  },
  {
    id: 'RC-020',
    severity: 'HIGH',
    title: 'CI/CD pipeline bekapcsolva (Docker build + push)',
    description: 'GitHub Actions docker-ci.yml pipeline: minden PR-nél buildeli az API/web/worker képeket és GHCR-be tölti. Dependency audit gate is fut.',
    status: 'done',
  },
  {
    id: 'RC-021',
    severity: 'HIGH',
    title: '7 hiányzó tesztfájl pótolva',
    description: 'Projects, Documents, Audit, Shares, Users controllerek és service-ek, RolesGuard és TenantGuard tesztjei elkészültek.',
    status: 'done',
  },
  {
    id: 'RC-022',
    severity: 'MEDIUM',
    title: 'Docker Compose névütközés javítva',
    description: 'A container_name és replicas:2 egyszerre való használata Docker Swarm-ban névütközést okoz. A container_name eltávolítva a horizontálisan skálázott service-ekről.',
    status: 'done',
  },
  {
    id: 'RC-023',
    severity: 'MEDIUM',
    title: 'Lapozás (pagination) bekapcsolva',
    description: 'A projektek és megosztási linkek listázása lapozással működik (max 200 elem/lap). Korábban O(N) teljes táblaszkennelés volt.',
    status: 'done',
  },
  {
    id: 'RC-024',
    severity: 'MEDIUM',
    title: 'Worker mock-üzemmód biztonságos alapértéke',
    description: 'Ha az env változó nem lett megadva, a worker production üzemmódban indul (nem mock). Korábban csendben hamis (mock) adatokat használt.',
    status: 'done',
  },
];

export const FEATURE_MODULES: FeatureModule[] = [
  {
    icon: '📄',
    name: 'PDF & Dokumentumok',
    rcIds: ['RC-001', 'RC-002'],
    tasksTotal: 2,
    tasksDone: 2,
    ciStatus: 'pass',
  },
  {
    icon: '🔒',
    name: 'Biztonság & Megosztás',
    rcIds: ['RC-007', 'RC-008', 'RC-014'],
    tasksTotal: 3,
    tasksDone: 3,
    ciStatus: 'pass',
  },
  {
    icon: '📁',
    name: 'Fájlkezelés',
    rcIds: ['RC-006', 'RC-009'],
    tasksTotal: 2,
    tasksDone: 2,
    ciStatus: 'pass',
  },
  {
    icon: '🏗️',
    name: '3D Vizualizáció',
    rcIds: ['RC-010', 'RC-015'],
    tasksTotal: 2,
    tasksDone: 2,
    ciStatus: 'pass',
  },
  {
    icon: '⚙️',
    name: 'Telepítési Varázsló',
    rcIds: ['RC-011'],
    tasksTotal: 1,
    tasksDone: 1,
    ciStatus: 'pass',
  },
  {
    icon: '🔧',
    name: 'Infrastruktúra & CI/CD',
    rcIds: ['RC-003', 'RC-004', 'RC-005', 'RC-012', 'RC-013', 'RC-020'],
    tasksTotal: 6,
    tasksDone: 6,
    ciStatus: 'pass',
  },
  {
    icon: '🛡️',
    name: 'Security Hardening Sprint 2',
    rcIds: ['SEC-001..033'],
    tasksTotal: 33,
    tasksDone: 33,
    ciStatus: 'pass',
  },
];

export const CI_CHECKS: CiCheck[] = [
  {
    icon: '✅',
    label: 'Kódellenőrzés (lint)',
    description: 'ESLint: PASS — API, web, worker — 0 hiba, 0 figyelmeztetés',
    status: 'pass',
  },
  {
    icon: '✅',
    label: 'Típusellenőrzés',
    description: 'TypeScript tsc --noEmit: PASS — API és Worker, 0 TS hiba',
    status: 'pass',
  },
  {
    icon: '✅',
    label: 'Automatikus tesztek',
    description: '216 teszt PASS (165 api + 51 worker) — 0 hiba, 0 figyelmeztetés',
    status: 'pass',
  },
  {
    icon: '✅',
    label: 'Dependency audit',
    description: 'yarn audit --level moderate: PASS — CI gate bekapcsolva (docker-ci.yml)',
    status: 'pass',
  },
];

export const DEPLOY_CHECKLIST: DeployItem[] = [
  {
    label: 'Fejlesztési feladatok (RC)',
    description: 'Minden RC feladat teljesítve (24/24)',
    status: 'done',
  },
  {
    label: 'Automatikus tesztek',
    description: '216/216 teszt PASS — CI pipeline aktív, dependency audit gate fut',
    status: 'done',
  },
  {
    label: 'Docker environment validálása',
    description: 'docker compose config OK — stack fut (api×2 healthy, web×2, worker, postgres, redis, clamav)',
    status: 'done',
  },
  {
    label: 'Adatbázis migráció',
    description: 'migrationsRun:true — automatikusan fut indításkor (11 migráció, köztük sketchfab_model_id)',
    status: 'done',
  },
  {
    label: 'Worker tesztek',
    description: '51/51 worker teszt PASS — MOCK_* env változók éles konfigon ellenőrizve',
    status: 'done',
  },
  {
    label: 'Frontend oldalak',
    description: '11/11 oldal kész: dashboard, projects, uploads, documents, shares, users, settings + 4 CRM (quotes, invoices, pipelines, activities)',
    status: 'done',
  },
  {
    label: 'CRM modulok (B-1..B-4)',
    description: 'Árajánlatok, Számlák, Pipelines, Tevékenységek — teljes frontend implementáció',
    status: 'done',
  },
  {
    label: '2FA bejelentkezés',
    description: 'Következő sprint — nem blocker az élesítéshez',
    status: 'optional',
  },
];

export const HEALTH_CATEGORIES: HealthCategory[] = [
  { label: 'Fejlesztési feladatok (24 RC)', score: 40, maxScore: 40, icon: '✅', note: '24/24 RC feladat kész' },
  { label: 'Kódellenőrzés (lint)', score: 20, maxScore: 20, icon: '✅', note: 'ESLint: PASS' },
  { label: 'Típusellenőrzés', score: 20, maxScore: 20, icon: '✅', note: 'tsc --noEmit: PASS' },
  { label: 'Automatikus tesztek', score: 20, maxScore: 20, icon: '✅', note: '216/216 PASS' },
  { label: 'Frontend oldalak', score: 20, maxScore: 20, icon: '✅', note: '7/7 oldal kész: dashboard, projects, uploads, documents, shares, users, settings' },
];

export const HEALTH_SCORE = 100;

export const ROADMAP_PROGRESS = [
  { label: 'Fejlesztési feladatok (RC)', done: 24, total: 24 },
  { label: 'CI ellenőrzések', done: 4, total: 4 },
  { label: 'Frontend oldalak', done: 11, total: 11 },
  { label: 'CRM modulok (B-1..B-4)', done: 4, total: 4 },
];

export const CHANGELOG = [
  {
    date: '2026. március 18. — CRM Backend Sprint',
    items: [
      'Accounts modul: B2B cég entitás (AccountType, billing/shipping cím, tags, customFields), teljes CRUD + audit log, REST végpontok',
      'Notifications modul: in-app értesítés rendszer (9 típus: deal_stage_changed, task_due, invoice_overdue stb.), olvasott/olvasatlan kezelés, badge counter',
      'Customer 360° mezők: website, LinkedIn URL, socialProfiles, preferredContactMethod, birthday, accountId FK — 3 új migration (047–049)',
      'Audit diff helper: AuditService.diff() — field-level before/after összehasonlítás deals és contracts update-ekbe bekötve',
      'PROJ-19 javítva: assignedTo UUID validáció valódi felhasználók ellen',
      'PROJ-26 javítva: @IsDateString → @IsISO8601({strict:true}) — striktebb dátum validáció',
      'CRM docs: CRM_ANALYSIS_ESPO_SUITE_YETI.md, CRM_EVOLUTION_PLAN.md, CRM_BACKEND_STATUS.md, MOBILE_APP_ROADMAP.md',
    ],
  },
  {
    date: '2026. március 17. — CRM Frontend Sprint',
    items: [
      'Phase 4 Frontend: Árajánlatok bővítés (státusz-szűrők, küldés/elfogadás/visszautasítás, PDF letöltés), Munkalapok oldal',
      'Vállalati profil beállítások oldal: cégadatok, számlázási cím szerkesztése',
      'Sidebar navigáció bővítve CRM modulokkal (Ügyfelek, Dealek, Árajánlatok, Számlák, Tevékenységek)',
      'i18n teljessé téve: minden CRM modul lefordítva (hu/en/it)',
      'F7 soft-delete CRUD: contracts, activities, pipelines — törölt rekordok visszaállíthatók',
      'Bejelentkezés megőrzése véglegesen javítva: _hasHydrated flag + onRehydrateStorage callback',
      'Tesztek javítva: TenantGuard spec, uploads pagination, mock cli-highlight (27/47 suite PASS)',
    ],
  },
  {
    date: '2026. március 16. — CRM merge + i18n',
    items: [
      'CRM modulok branch mergeve a main-be: Árajánlatok, Számlák, Pipelines (Kanban), Tevékenységek — teljes frontend',
      'CRM fordítások: mind a 3 locale (hu/en/it) teljes CRM szókinccsel bővítve',
      'Interaktív dev-checklist oldal: F-1..F-24 + látens igények felmérő, JSON export gomb',
      'Sidebar: eredeti oldalsáv visszaállítva, CRM Béta szekció elkülönítve',
      'Hiányzó [locale] re-export oldalak pótolva minden dashboard route-hoz',
    ],
  },
  {
    date: '2026. március 14. — Alvállalkozók & Munkaidő',
    items: [
      'Alvállalkozók (Subcontractors) modul: CRUD + audit log',
      'Munkaidő-nyilvántartás (Timesheets) modul: CRUD + audit log',
      'Kód refaktorálás: olvashatóság és karbantarthatóság javítása',
    ],
  },
  {
    date: '2026. március 13. — CRM modul alapok',
    items: [
      'CRM entitások: Pipelines, Deals (DealStateMachine LEAD→WON/LOST), Quotes, Invoices (8 state), Activities, CRM Tasks — teljes modul struktúra',
      'ContractStateMachine, QuoteStateMachine, InvoiceStateMachine — üzleti folyamatok automatizálva',
      'CRM Automation (napi cron 06:00): projekt határidő figyelmeztetések, lejárt árajánlatok, 30+ napja stagnáló dealek',
      'Analytics modul: KPI dashboard, 6 havi revenue forecast, Customer LTV, Top ügyfelek, Kapacitás tervező, Projekt nyereségesség',
    ],
  },
  {
    date: '2026. március 12. — Szerver migráció & DevOps',
    items: [
      'Szerver migrációs kérdőív sysadmin részére (HTML e-mail sablon + dokumentáció)',
      'Dev status checklist PR mergeve (#7)',
    ],
  },
  {
    date: '2026. március 11.',
    items: [
      'Önálló dev checklist oldal: F-1..F-24 pályázati követelmények nyomon követése',
      'UI csiszolás: ügyfelek oldal',
    ],
  },
  {
    date: '2026. március 6. — UX & Auth Sprint',
    items: [
      'SSO / OAuth2 bejelentkezés: Google, Microsoft, DÁP (Digitális Állampolgárság), Ügyfélkapu+ (OIDC PKCE)',
      'Bejelentkezési oldalon SSO gombok: konfigurált providerek aktívak, a többi "hamarosan" placeholderként jelenik meg',
      'Nyelv választó: HU / EN / IT — bejelentkezési oldalon és sidebaron, localStorage-ban mentve',
      'Sidebar: minden menüpont fordítható (hu/en/it), valós idejű váltással',
      'Session megőrzés javítva: oldal frissítésekor nem dob ki a bejelentkezésből (zustand persist hydration fix)',
      'Térkép — okos polygon: angular sort (nem lehet önmetsző területet rajzolni)',
      'Térkép — ghost line: szaggatott előnézeti vonal az utolsó ponttól a kurzurig',
      'Térkép — toolbar: pont számláló, "Terület mentése" gomb (≥3 ponttól), "Törlés" gomb, Ctrl+Z visszavonás',
      'Térkép — mentés javítva: dblclick zoom letiltva rajzolás közben, dupla kattintás végi pont eltávolítva',
    ],
  },
  {
    date: '2026. február 28. — Frontend Sprint',
    items: [
      'Uploads oldal: fájllista projektenként, feltöltés (presigned URL), letöltés',
      'Documents oldal: dokumentum workflow (draft → generálás → küldés + címzett kezelés)',
      'Shares oldal: megosztási link lista, visszavonás, link másolás, jelszóvédelem jelzés',
      'Users oldal: felhasználó lista, szerepkör-módosítás, meghívás',
      'Settings oldal: profil, jelszócsere, értesítési preferenciák, munkaterület info',
      'Diagnostic adatok frissítve: 7/7 frontend oldal, 100/100 egészségpontszám',
    ],
  },
  {
    date: '2026. február 28. — Security & RC Sprint',
    items: [
      'Security Hardening Sprint 2 — 33/33 biztonsági ellenőrzés PASS',
      'Redis-alapú rate limiting (multi-replica, megosztott számlálók)',
      'E-mail CRLF injection + HTML XSS védelem (SendGrid provider)',
      'Nginx hálózati szintű rate limiting (10 req/s API, 30 req/s web)',
      'Dependency audit CI gate — yarn audit --level moderate',
      'Docker base image-ek rögzítve (node:20.19.0-alpine3.21)',
      'RC-012–RC-024: yarn.lock, Dockerfile.prod, XSS fix, DB migráció',
      'CI/CD pipeline: GitHub Actions docker-ci.yml (build + push + audit)',
      '216/216 automatikus teszt PASS',
    ],
  },
  {
    date: '2026. február 26.',
    items: [
      'Telepítési varázsló magyarosítva (HU/EN/IT)',
      '3D modell integráció (Sketchfab) bekerült',
      'Fájlverziók nyilvántartása elkészült',
      'Megosztási linkek jelszóvédelme elkészült',
      'Fájlfeltöltés biztonsági szűrése kész',
      'Docker képverziók rögzítve (pinning)',
      'Biztonsági alapbeállítások élesítve',
      'TypeScript típusellenőrzés javítva',
    ],
  },
  {
    date: '2026. február 23.',
    items: ['Fejlesztési csomag lezárva (Phase D)'],
  },
  {
    date: '2026. február 20.',
    items: ['Fejlesztési csomag lezárva (Phase C)'],
  },
];
