/* ─── F-1..F-24 modul adatok ───────────────────────────────────
 *
 * Forrás: F-1-24.txt (szerződéses scope) vs. DimopPlusz112A_szakmai_terv.docx
 *
 * implemented: ami az F-1-24 scope alapján megvalósult
 * latent: amit a docx leír az adott modulnál, de az F-1-24-be
 *         nem lett beleírva → ezért nem készült el
 * ─────────────────────────────────────────────────────────────*/

export interface LatentItem {
  id: string;
  label: string;
  detail: string; // miért látens — docx hivatkozás
}

export interface FeatureModule {
  id: string;
  title: string;
  href: string;
  implemented: string[];
  latent: LatentItem[];
}

export const FEATURE_MODULES: FeatureModule[] = [
  {
    id: 'F-1',
    title: 'Médiatárolás',
    href: '/uploads',
    implemented: [
      'Fotó, videó, 3D modell, PDF és PPT feltöltés és tárolás',
      'Maximum 5 GB / fájl méret támogatás',
      'Azure Blob Storage integráció',
      'Feltöltési előzmények és fájllistázás',
    ],
    latent: [
      {
        id: 'F-1-L1',
        label: 'Virtuális séták tárolása és kezelése',
        detail: 'A docx "virtuális séták" feltöltését is tartalmazza, az F-1-24 csak prezentációkat említ.',
      },
      {
        id: 'F-1-L2',
        label: 'Keresés és kategorizálás fájlok között',
        detail: 'A docx "kategorizálható, kereshető" elvárást ír — az F-1-24-ből ez hiányzik.',
      },
      {
        id: 'F-1-L3',
        label: 'Automatikus archiválás / törlés lezárt projekt után',
        detail: 'Az F-1-24 tartalmaz egy zárójeles megjegyzést (Projekt státusz = Teljesített esetén archiválás), de ez nem lett explicit feladatként meghatározva.',
      },
    ],
  },
  {
    id: 'F-2',
    title: '3D megjelenítés',
    href: '/projects',
    implemented: [
      'Sketchfab integráció — 3D modellek webes beágyazással',
      'Mobil kompatibilis megjelenítő',
    ],
    latent: [
      {
        id: 'F-2-L1',
        label: 'Natív VR/AR eszköz kompatibilitás (pl. Meta Quest)',
        detail: 'A docx "VR/AR eszközökön" való megjelenítést ír, az F-1-24 csak "Sketchfab integráció, webes beágyazás" — natív headset támogatás nem szerepelt a scope-ban.',
      },
    ],
  },
  {
    id: 'F-3',
    title: 'PDF generálás és kezelés',
    href: '/documents',
    implemented: [
      'PDF generálás ajánlat dokumentumhoz (OFFER típus)',
      'PDF generálás munkalap dokumentumhoz (WORK_ORDER típus)',
      'Generált PDF letöltése',
      'Szerkesztési lehetőség: GENERATED → DRAFT visszaállítás',
      'SHA-256 renderHash — dokumentum hitelesség',
    ],
    latent: [
      {
        id: 'F-3-L1',
        label: 'PDF kitöltés (form filling) — meglévő sablonon',
        detail: 'A docx "kitöltés" funkciót ír (PDF megtekintő, kitöltés, exportálás). Az F-1-24 kizárólag az alkalmazás által generált PDF-ekre szűkíti a szerkesztést.',
      },
    ],
  },
  {
    id: 'F-4',
    title: 'Live scan',
    href: '/uploads',
    implemented: [
      'Azonnali feltöltés mobilról vagy asztalról',
      'ClamAV vírusellenőrzés minden feltöltésnél',
      'Valós idejű feltöltési státusz visszajelzés',
    ],
    latent: [
      {
        id: 'F-4-L1',
        label: 'Alkalmazáson belüli fényképezés (kamera hozzáférés)',
        detail: 'Az F-1-24 explicit "alkalmazáson belüli fénykép készítés"-t ír, de a kamera API integrációja nem valósult meg — csak fájlfeltöltés érhető el.',
      },
      {
        id: 'F-4-L2',
        label: 'Méretre vágás (crop) feltöltés előtt',
        detail: 'Az F-1-24 "felhasználó általi méretre vágási lehetőséget" tartalmaz, a docx is megerősíti. Nem valósult meg.',
      },
      {
        id: 'F-4-L3',
        label: 'Képek automatikus feljavítása feltöltés után',
        detail: 'A docx "képek automatikus feljavítása" elvárást ír (pl. élesítés, fénykorrekció). Az F-1-24-ben nem szerepel.',
      },
    ],
  },
  {
    id: 'F-5',
    title: 'Térkép alapú projektmegjelenítés',
    href: '/map',
    implemented: [
      'OpenStreetMap integráció interaktív térképpel',
      'Projektmarkerek megjelenítése térképen',
      'Projekt területek (polygon) megjelenítése',
      'Geocoding és reverse geocoding',
    ],
    latent: [
      {
        id: 'F-5-L1',
        label: 'Google Maps API integráció (az F-1-24 Google Maps-t ír)',
        detail: 'Az F-1-24 "Google Maps integráció"-t határoz meg, a megvalósítás OpenStreetMap-et használ (ingyenes alternatíva). Felváltás Google Maps API-ra fizetős, de a megrendelő elvárása Google Maps volt.',
      },
    ],
  },
  {
    id: 'F-6',
    title: 'Területkijelölés térképen',
    href: '/map',
    implemented: [
      'Polygon rajzolás és szerkesztés',
      'Terület számítás (m² és hektár)',
      'Kerület számítás (Haversine formula)',
    ],
    latent: [
      {
        id: 'F-6-L1',
        label: 'Szabadkézi rajz eszköz területkijelöléshez',
        detail: 'A docx "szabadkézi rajz eszközöket" említ polygon mellett. Az F-1-24 csak polygont ír.',
      },
      {
        id: 'F-6-L2',
        label: 'Átlátszóság állítás a kijelölt területeknél',
        detail: 'A docx "átlátszóság állítás" funkciót tartalmaz. Az F-1-24-ből hiányzik.',
      },
      {
        id: 'F-6-L3',
        label: 'Távolság mérés két pont között',
        detail: 'A docx "távolság" mérési funkciót ír. Az F-1-24-ből hiányzik.',
      },
    ],
  },
  {
    id: 'F-7',
    title: 'Pontjelölések térképen',
    href: '/map',
    implemented: [
      'Tű ikonok elhelyezése a térképen',
      'Pontjelölések CRUD kezelése',
    ],
    latent: [
      {
        id: 'F-7-L1',
        label: 'Egyedi ikonok kiválasztása / feltöltése pontokhoz',
        detail: 'A docx "egyedi ikonok" használatát írja. Az F-1-24 csak "tű ikonokat" említ.',
      },
      {
        id: 'F-7-L2',
        label: 'Pontok szöveges címkézése a térképen',
        detail: 'A docx "címkézés" funkciót tartalmaz. Az F-1-24-ből hiányzik.',
      },
    ],
  },
  {
    id: 'F-8',
    title: 'NOTAM információk integrálása',
    href: '/notam',
    implemented: [
      'Automatikus NOTAM lekérdezés',
      'Légtér engedélykötelesség ellenőrzése',
      'NOTAM zónák térkép megjelenítése',
    ],
    latent: [
      {
        id: 'F-8-L1',
        label: 'Push értesítés NOTAM változásra',
        detail: 'A docx "push értesítést" ír NOTAM frissítéseknél. Az F-1-24 csak lekérdezést és ellenőrzést tartalmaz.',
      },
      {
        id: 'F-8-L2',
        label: 'Adatforrás megbízhatóság jelzése',
        detail: 'A docx "adatforrás megbízhatóság" vizualizációját írja (pl. adat kora, forrás státusza). Az F-1-24-ből hiányzik.',
      },
    ],
  },
  {
    id: 'F-9',
    title: 'Igénykonfigurátor és automatikus árazás',
    href: '/pricing',
    implemented: [
      'BOQ (Bill of Quantities) tételek CRUD kezelése',
      'Automatikus árajánlat számítás tételekből',
      'Árazás exportálása ajánlat dokumentumhoz',
      'Excel árazó alapján feltöltött tételek',
    ],
    latent: [],
  },
  {
    id: 'F-10',
    title: 'Excel alapú adatimport/export',
    href: '/pricing',
    implemented: [
      'Excel fájl importálása (feltöltött .xlsx-ből)',
      'Eredeti struktúra változatlan beolvasása',
      'Excel export (.xlsx) — árazó lista',
    ],
    latent: [
      {
        id: 'F-10-L1',
        label: 'Automatikus mezőellenőrzés importnál',
        detail: 'A docx "automatikus mezőellenőrzés"-t ír Excel importnál. Az F-1-24 csak a változatlan struktúra beolvasását írja.',
      },
      {
        id: 'F-10-L2',
        label: 'Valós idejű szinkronizálás Excel és az alkalmazás között',
        detail: 'A docx "szinkronizálás"-t említ. Az F-1-24 csak egyszeri importot és exportot ír.',
      },
    ],
  },
  {
    id: 'F-11',
    title: 'Jogosultság alapú adatmegosztás',
    href: '/shares',
    implemented: [
      'Időkorlátos share link generálás (token)',
      'Jelszóvédelem a megosztott linkekhez',
      'Jogosultságkezelés (olvasás / letöltés)',
      'Hozzáférés visszavonása',
    ],
    latent: [],
  },
  {
    id: 'F-12',
    title: 'Felhasználói és szerepkör-kezelés',
    href: '/users',
    implemented: [
      '4 szerepkör: super_admin, admin, manager, viewer',
      'Felhasználó meghívás és hozzáférés kezelés',
      'Tenant-alapú izoláció',
      'JWT autentikáció, 2FA (TOTP), login lockout',
    ],
    latent: [
      {
        id: 'F-12-L1',
        label: 'MiniCRM API integráció (feladatok, ügyfelek, határidők szinkronizálása)',
        detail: 'A docx "API-alapú kapcsolat, realtime adatátvitel" a MiniCRM-mel. Az F-1-24 explicit "CRM integráció nélkül" — ezért maradt ki. Ez a legerősebb eltérés a két dokumentum között.',
      },
    ],
  },
  {
    id: 'F-13',
    title: 'Sales profil modul',
    href: '/customers',
    implemented: [
      'Ügyfél adatlap létrehozás és szerkesztés',
      'Kapcsolattartási adatok rögzítése',
      'Kapcsolódó projektek megjelenítése',
      'Archiválás (soft-delete)',
      'Audit napló az ügyféladatokon',
    ],
    latent: [
      {
        id: 'F-13-L1',
        label: 'Ügyfélprofil szinkronizálása külső CRM rendszerrel',
        detail: 'A docx "interface a CRM rendszerrel" elvárást ír. Az F-1-24 csak belső ügyfélkezelést tartalmaz.',
      },
    ],
  },
  {
    id: 'F-14',
    title: 'Külső tárhely integráció',
    href: '/settings',
    implemented: [
      'Azure Blob Storage integráció',
      'Biztonságos kapcsolat (SAS token)',
    ],
    latent: [
      {
        id: 'F-14-L1',
        label: 'Google Drive integráció',
        detail: 'A docx "Google Drive, Dropbox, AWS" alternatívákat említ. Az F-1-24 kizárólag Azure-t ír.',
      },
      {
        id: 'F-14-L2',
        label: 'Dropbox integráció',
        detail: 'A docx "Google Drive, Dropbox, AWS" alternatívákat említ. Az F-1-24 kizárólag Azure-t ír.',
      },
      {
        id: 'F-14-L3',
        label: 'Kétirányú szinkronizálás a felhőtárhellyel',
        detail: 'A docx "kétirányú szinkron" elvárást ír. Az F-1-24-ből hiányzik.',
      },
    ],
  },
  {
    id: 'F-15',
    title: 'Verziókövetés',
    href: '/uploads',
    implemented: [
      'Fájlverzió követés audit naplóval',
      'SHA-256 időbélyeg (renderHash) dokumentumokon',
      'Szerződésmódosítások nyomon követése',
    ],
    latent: [
      {
        id: 'F-15-L1',
        label: 'Blokklánc alapú dokumentumhitelesítés',
        detail: 'A docx "blockchain segítségével" való verziókövetést és hamisítás elleni védelmet ír, publikus hash-azonosítóval. Az F-1-24 "auditnaplóval és/vagy időbélyegző" formát ír — a blockchain opcionálisan lett kezelve.',
      },
    ],
  },
  {
    id: 'F-16',
    title: 'Szerződésnyilvántartó',
    href: '/contracts',
    implemented: [
      'Szerződések tárolása és listázása',
      'Szűrés projektenként',
      'Szabad szavas keresés dokumentumnévre',
      'Szerződés állapotgép (DRAFT → ACTIVE → EXPIRED / TERMINATED)',
    ],
    latent: [],
  },
  {
    id: 'F-17',
    title: 'Platformfüggetlen működés',
    href: '',
    implemented: [
      'Reszponzív webalkalmazás — minden platformon fut böngészőből',
      'Android, iOS, Windows, macOS kompatibilitás (webes)',
    ],
    latent: [
      {
        id: 'F-17-L1',
        label: 'Natív iOS / Android alkalmazás',
        detail: 'A docx "natív alkalmazás/reszponzív design" kettős elvárást ír. Az F-1-24 "webalkalmazást" ír — natív app nem volt a scope-ban.',
      },
    ],
  },
  {
    id: 'F-18',
    title: 'Reszponzív működés',
    href: '',
    implemented: [
      'Mobil és tablet eszközökön optimalizált webes felület',
      'Reszponzív layout minden képernyőméretre',
    ],
    latent: [
      {
        id: 'F-18-L1',
        label: 'Offline mód — részleges adatelérés hálózat nélkül',
        detail: 'A docx "offline mód részleges támogatása" elvárást ír. Az F-1-24-ből hiányzik.',
      },
    ],
  },
  {
    id: 'F-19',
    title: 'Vevői adatlap',
    href: '/customers',
    implemented: [
      'Strukturált ügyfélprofil (kapcsolattartási adatok)',
      'Projektadat struktúra az adatlapon',
      'Kapcsolódó projektek és dokumentumok listája',
    ],
    latent: [
      {
        id: 'F-19-L1',
        label: 'Ügyfél általi visszajelzés / jóváhagyás küldés az alkalmazásból',
        detail: 'A docx szerint a megrendelők visszajelzést adhatnak vagy jóváhagyást küldhetnek közvetlenül. Ez strukturált approval workflow-t jelent, ami nem volt az F-1-24 scope-jában.',
      },
    ],
  },
  {
    id: 'F-20',
    title: 'Többnyelvű felület',
    href: '/settings',
    implemented: [
      'Magyar (hu), Angol (en), Olasz (it) nyelvi támogatás',
      'Nyelvváltó gomb a felületen',
    ],
    latent: [
      {
        id: 'F-20-L1',
        label: 'Automatikus nyelvdetektálás (böngésző / rendszer beállítás alapján)',
        detail: 'A docx "automatikus detektálás" elvárást ír. Az F-1-24 csak a három nyelv támogatását határozza meg.',
      },
    ],
  },
  {
    id: 'F-21',
    title: 'Nagy sávszélesség optimalizáció (5G)',
    href: '',
    implemented: [
      'Nagy fájlméret feltöltés támogatása',
      'Általános hálózati optimalizáció',
    ],
    latent: [
      {
        id: 'F-21-L1',
        label: 'Videó és VR tartalmak valós idejű streamelése 5G hálózaton',
        detail: 'A docx "videó és VR tartalmak valós idejű streamelése" elvárást ír a 5G kapcsán. Az F-1-24 csak "nagy adatsebesség támogatása" — konkrét streaming funkció nem szerepelt.',
      },
    ],
  },
  {
    id: 'F-22',
    title: 'Moduláris architektúra',
    href: '',
    implemented: [
      'API-first szemlélet (REST API, NestJS)',
      'Moduláris monorepó struktúra',
      'DI token alapú provider rendszer — könnyen bővíthető',
    ],
    latent: [],
  },
  {
    id: 'F-23',
    title: 'Munkalap generálás',
    href: '/documents',
    implemented: [
      'Munkalap PDF generálás projektadatokból (WORK_ORDER típus)',
      'Projekt specifikációk strukturálása a munkalapon',
    ],
    latent: [
      {
        id: 'F-23-L1',
        label: 'Projektterület (térkép / polygon) megjelenítése a munkalapon',
        detail: 'A docx "projektterület megjelenítése" elvárást ír a munkalapon. Az F-1-24 csak "megadott projektadatok alapján" — a térképi elem beágyazása nem volt explicit.',
      },
    ],
  },
  {
    id: 'F-24',
    title: 'Dokumentumküldés',
    href: '/documents',
    implemented: [
      'Ajánlat, szerződésminta, GDPR dokumentum sablon alapú feltöltése',
      'Dokumentum kiküldése e-mailben',
      'Ügyfél általi megtekintés share linken keresztül',
    ],
    latent: [
      {
        id: 'F-24-L1',
        label: 'Garancia lapok sablonjai és kezelése',
        detail: 'A docx "garancia lapok" küldését is tartalmazza. Az F-1-24 csak ajánlat, szerződésminta és GDPR dokumentumot nevesít.',
      },
    ],
  },
];
