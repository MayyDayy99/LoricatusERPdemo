// Demó mock-adat a Heti jelentés / Vezetői riport / Egyéni mezők modulokhoz.
// A valódi rendszerben ezek a heti aktivitásból aggregálódnak; a demóban
// realisztikus, statikus pillanatképet adunk vissza.

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }
function isoAt(d: Date, hh: number, mm: number): string {
  const x = new Date(d); x.setHours(hh, mm, 0, 0); return x.toISOString();
}
function mondayOf(base: Date): Date {
  const x = new Date(base); const day = (x.getDay() + 6) % 7; // 0 = hétfő
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x;
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

const PROJEKTEK = [
  'Bartók udvar — drónos állapotfelmérés', 'Avas kilátó — negyedéves monitoring',
  'Tisza-part — támfal inspekció', 'Zsolnay negyed — BIM LOD300 modell',
  'Kastély keleti szárny — HBIM', 'Irodaház — MEP koordináció',
];

/* ─────────── Heti jelentés ─────────── */

export function buildWeeklyReport(meId: string, meName: string): any {
  const monday = mondayOf(new Date());
  const friday = addDays(monday, 4);
  const now = new Date();
  const mk = (i: number) => ({ id: 'wf-' + i, cim: '', projekt: PROJEKTEK[i % PROJEKTEK.length], szoba: null, szerep: (i % 3 === 0 ? 'segito' : 'felelos') });

  const person = (userId: string, nev: string, seed: number) => ({
    userId, nev,
    elvegezve: [
      { ...mk(seed), cim: 'Drónrepülés ütemezése', kesz: ymd(addDays(monday, 1)), projektMap: true, szerep: 'felelos' },
      { ...mk(seed + 1), cim: 'Pontfelhő regisztráció', kesz: ymd(addDays(monday, 2)), projektMap: true, szerep: 'felelos' },
      { ...mk(seed + 2), cim: 'Ügyfél-egyeztetés', kesz: ymd(addDays(monday, 3)), projektMap: false, szerep: 'segito' },
    ],
    nyitva: [
      { ...mk(seed + 3), cim: 'BIM-modell építés', kezdes: ymd(addDays(monday, 3)), hatarido: ymd(addDays(friday, 3)), folyamatban: true, lejart: false, szerep: 'felelos' },
      { ...mk(seed + 4), cim: 'Ortofotó generálás', kezdes: ymd(addDays(monday, 4)), hatarido: ymd(addDays(friday, 5)), folyamatban: false, lejart: false, szerep: 'felelos' },
    ],
    csuszott: seed % 2 === 0 ? [{ ...mk(seed + 5), cim: 'Riport összeállítás', napok: 2, szerep: 'felelos' }] : [],
    jovoHet: [
      { ...mk(seed + 6), cim: 'Helyszíni bejárás', kezdes: ymd(addDays(monday, 7)), hatarido: ymd(addDays(monday, 9)), folyamatban: false, lejart: false, szerep: 'felelos' },
    ],
    tavollet: seed % 3 === 0 ? [{ tol: ymd(addDays(monday, 4)), ig: ymd(addDays(monday, 4)), megjegyzes: 'Szabadság' }] : [],
  });

  const szemelyek = [
    person(meId, meName, 0),
    person('user-op-1', 'Nagy Péter', 2),
    person('user-op-2', 'Tóth Anna', 4),
    person('user-op-3', 'Szabó Zoltán', 1),
  ];

  return {
    id: 'weekly-' + ymd(monday),
    hetKezdete: ymd(monday), hetPentek: ymd(friday),
    megjeloles: `${ymd(monday)} – ${ymd(friday)}`,
    kuldesIdeje: isoAt(friday, 15, 0), emlekeztetoIdeje: isoAt(addDays(monday, 3), 16, 0),
    emlekeztetoKiment: isoAt(addDays(monday, 3), 16, 0),
    most: now.toISOString(),
    allapot: 'draft', szerkesztheto: true, elkuldve: null,
    bejegyzesekSzamaKuldeskor: null, cimzettBeallitva: true, cimzett: 'vezetoseg@loricatus.hu',
    utolsoHiba: null,
    jogok: { ir: true, kezel: true, tag: true },
    nezoId: meId,
    forras: 'project_map_and_rooms',
    tevekenyseg: {
      forras: 'project_map_and_rooms', szamitva: now.toISOString(),
      ablak: { tol: ymd(monday), ig: ymd(friday) }, szemelyek,
    },
    befagyasztva: false,
    bejegyzesek: [
      { id: 'be-1', szerzoId: 'user-op-1', szerzo: 'Nagy Péter', szoveg: 'A Bartók udvar drónrepülése lezajlott, a pontfelhő feldolgozás alatt. Jövő héten átadás.', letrehozva: isoAt(addDays(monday, 2), 14, 20), modositva: isoAt(addDays(monday, 2), 14, 20), sajat: false, kepek: [] },
      { id: 'be-2', szerzoId: meId, szerzo: meName, szoveg: 'A Zsolnay negyed BIM-modellje 70%-on áll, a keleti szárny hátravan.', letrehozva: isoAt(addDays(monday, 3), 9, 5), modositva: isoAt(addDays(monday, 3), 9, 5), sajat: true, kepek: [] },
    ],
  };
}

export function weeklyList(): any[] {
  const monday = mondayOf(new Date());
  return [0, 1, 2, 3].map((w) => {
    const m = addDays(monday, -7 * w);
    return {
      id: 'weekly-' + ymd(m), hetKezdete: ymd(m),
      megjeloles: `${ymd(m)} – ${ymd(addDays(m, 4))}`,
      allapot: w === 0 ? 'draft' : 'sent',
      bejegyzesek: w === 0 ? 2 : 3 + (w % 3),
      elkuldve: w === 0 ? null : isoAt(addDays(m, 4), 15, 0),
    };
  });
}

export function weeklyMembers(meId: string, meName: string): any[] {
  return [
    { userId: meId, nev: meName, email: 'demo@loricatus.hu', szerepkor: 'admin' },
    { userId: 'user-op-1', nev: 'Nagy Péter', email: 'nagy.peter@loricatus.hu', szerepkor: 'operative' },
    { userId: 'user-op-2', nev: 'Tóth Anna', email: 'toth.anna@loricatus.hu', szerepkor: 'operative' },
    { userId: 'user-op-3', nev: 'Szabó Zoltán', email: 'szabo.zoltan@loricatus.hu', szerepkor: 'manager' },
  ];
}

export function weeklySettings(): any {
  const monday = mondayOf(new Date());
  return {
    cimzettEmail: 'vezetoseg@loricatus.hu', cimzettNev: 'Vezetőség', forras: 'project_map_and_rooms',
    kuldesNap: 5, kuldesIdo: '15:00',
    kovetkezoKuldes: isoAt(addDays(monday, 4), 15, 0), kovetkezoEmlekezteto: isoAt(addDays(monday, 3), 16, 0),
  };
}

/* ─────────── Vezetői riport ─────────── */

export function execReport(): any {
  const monday = mondayOf(new Date());
  return {
    adat: { het: { hetKezdete: ymd(monday), hetVege: ymd(addDays(monday, 6)), megjeloles: `${ymd(monday)} – ${ymd(addDays(monday, 6))}` }, szamitva: new Date().toISOString() },
    elonezet: true, allapot: 'kesz', elkuldve: null,
    cimzettek: ['ceo@loricatus.hu', 'coo@loricatus.hu'], keziKuldes: null, hiba: null,
  };
}

export function execEmail(): any {
  const c = (l: string, v: string) => `<td style="padding:8px 14px;border-bottom:1px solid #eee"><div style="color:#6b7280;font-size:12px">${l}</div><div style="font-weight:700;font-size:18px;color:#111">${v}</div></td>`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#111">
    <div style="background:#12331f;color:#fff;padding:22px 26px;border-radius:12px 12px 0 0">
      <div style="font-size:13px;letter-spacing:.14em;opacity:.8">LORICATUS · VEZETŐI RIPORT</div>
      <h1 style="margin:6px 0 0;font-size:22px">Heti összefoglaló</h1></div>
    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      <table style="border-collapse:collapse;width:100%"><tr>${c('Pipeline', '72 M Ft')}${c('Nyert ajánlat', '3 db')}${c('Aktív projekt', '16')}${c('Havi bevétel', '18,5 M Ft')}</tr></table>
      <h3 style="margin:22px 0 8px">Iroda</h3>
      <p style="color:#4b5563;line-height:1.55">4 új ajánlat kiment (Bartók udvar, Zsolnay negyed, Kastély, Irodaház), ebből 2 nyert. 1 szerződés aláírásra vár.</p>
      <h3 style="margin:18px 0 8px">Művelet</h3>
      <p style="color:#4b5563;line-height:1.55">9 aktív terepi projekt, 3 csúszásban (időjárás miatt). A drónflotta 92%-os kihasználtságon.</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:22px;border-top:1px solid #f3f4f6;padding-top:14px">Loricatus Group Kft. · Automatikus heti vezetői riport.</p>
    </div></div>`;
  return { subject: 'Loricatus — heti vezetői riport', html, text: 'Heti vezetői riport: pipeline 72 M Ft, 3 nyert ajánlat, 16 aktív projekt.' };
}

export function execSettings(): any {
  return {
    enabled: true, nap: 1, perc: 480,
    cimzettek: [
      { userId: 'u-ceo', email: 'ceo@loricatus.hu', nev: 'Ügyvezető', szakaszok: ['iroda', 'muvelet'], feloldottEmail: 'ceo@loricatus.hu', feloldottNev: 'Ügyvezető' },
      { userId: 'u-coo', email: 'coo@loricatus.hu', nev: 'Operatív igazgató', szakaszok: ['muvelet'], feloldottEmail: 'coo@loricatus.hu', feloldottNev: 'Operatív igazgató' },
    ],
  };
}

export function execArchive(): any[] {
  const monday = mondayOf(new Date());
  return [1, 2, 3, 4].map((w) => {
    const m = addDays(monday, -7 * w);
    return { hetKezdete: ymd(m), megjeloles: `${ymd(m)} – ${ymd(addDays(m, 6))}`, allapot: 'elkuldve', elkuldve: isoAt(addDays(m, 0), 8, 0), cimzettek: ['ceo@loricatus.hu', 'coo@loricatus.hu'], keziKuldes: null, hiba: null };
  });
}

/* ─────────── Egyéni mezők ─────────── */

export function customFields(): any[] {
  const t = new Date().toISOString();
  const mk = (i: number, fieldName: string, fieldType: string, entityType: string, required: boolean, description: string, options?: any) => ({
    id: 'cf-' + i, fieldName, fieldType, entityType, description, options: options ?? null,
    required, sortOrder: i, isActive: true, createdAt: t, updatedAt: t,
  });
  return [
    mk(1, 'Helyszíni felelős', 'text', 'project', true, 'A projekt helyszíni koordinátora'),
    mk(2, 'GSD (cm)', 'number', 'project', false, 'Terepi felbontás centiméterben'),
    mk(3, 'Légtér-engedély', 'boolean', 'project', true, 'Beszerezve-e a NOTAM engedély'),
    mk(4, 'Átadás dátuma', 'date', 'project', false, 'Tervezett átadási határidő'),
    mk(5, 'Prioritás', 'select', 'project', false, 'A projekt sürgőssége', { values: ['alacsony', 'közepes', 'magas'] }),
    mk(6, 'Ügyfél-szegmens', 'select', 'customer', false, 'B2B kategória', { values: ['építőipar', 'önkormányzat', 'ipari', 'magán'] }),
    mk(7, 'Belső megjegyzés', 'textarea', 'customer', false, 'Nem látszik az ügyfélnek'),
  ];
}

/* ─────────── Projekt-sablonok (workflow-szerkesztő) ─────────── */

export function projectTemplates(): any[] {
  const t = new Date().toISOString();
  const step = (sortIndex: number, stepType: string, name: string, dependsOn?: number) => ({
    sortIndex, stepType, name, anchorKind: 'project_created',
    ...(dependsOn !== undefined ? { dependsOnStepSortIndex: dependsOn } : {}),
  });
  return [
    {
      id: 'tpl-1', tenantId: 'demo-tenant-0001', name: 'Drónos állapotfelmérés',
      description: 'Homlokzat + tető ortofotó és pontfelhő', color: '#4f9d69',
      sortIndex: 0, isArchived: false, inputs: [], createdAt: t, updatedAt: t,
      steps: [
        step(0, 'task', 'Helyszíni bejárás'), step(1, 'notification', 'Légtér-engedély (NOTAM)', 0),
        step(2, 'task', 'Drónrepülés', 1), step(3, 'task', 'Pontfelhő regisztráció', 2),
        step(4, 'task', 'Ortofotó generálás', 3), step(5, 'task', 'Riport átadás', 4),
      ],
    },
    {
      id: 'tpl-2', tenantId: 'demo-tenant-0001', name: 'BIM-modellezés (LOD300)',
      description: 'Meglévő állapot HBIM modell', color: '#c8a24a',
      sortIndex: 1, isArchived: false, inputs: [], createdAt: t, updatedAt: t,
      steps: [
        step(0, 'task', 'Adatgyűjtés / szkennelés'), step(1, 'task', 'Pontfelhő tisztítás', 0),
        step(2, 'task', 'Modell építés', 1), step(3, 'task', 'Metszetek / alaprajzok', 2),
        step(4, 'work_order', 'Munkalap kiadás', 3), step(5, 'task', 'Minőségellenőrzés', 4),
        step(6, 'task', 'Átadás', 5),
      ],
    },
    {
      id: 'tpl-3', tenantId: 'demo-tenant-0001', name: 'Geodéziai bemérés',
      description: 'GNSS alappontok + bemérés', color: '#8b5cf6',
      sortIndex: 2, isArchived: false, inputs: [], createdAt: t, updatedAt: t,
      steps: [
        step(0, 'task', 'Alappont-hálózat'), step(1, 'task', 'Bemérés', 0),
        step(2, 'task', 'Kiértékelés', 1), step(3, 'deadline_marker', 'Leadási határidő', 2),
        step(4, 'task', 'Átadás', 3),
      ],
    },
  ];
}
