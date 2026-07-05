/* ─── Dev Checklist – F-1 .. F-24 pályázati követelmények ─── */

export type ChecklistStatus = 'done' | 'partial' | 'pending';

export interface DevChecklistItem {
  id: string;
  title: string;
  description: string;
  href: string;
  status: ChecklistStatus;
}

export const DEV_CHECKLIST_ITEMS: DevChecklistItem[] = [
  {
    id: 'F-1',
    title: 'Médiatárolás',
    description:
      'Fotók, videók, 3D modellek, PDF-ek és prezentációk feltöltése és tárolása. Maximum 5 GB / fájl méret támogatás.',
    href: '/uploads',
    status: 'done',
  },
  {
    id: 'F-2',
    title: '3D megjelenítés',
    description:
      '3D modellek megjelenítése Sketchfab integráción keresztül, webes beágyazással.',
    href: '/projects',
    status: 'done',
  },
  {
    id: 'F-3',
    title: 'PDF generálás és kezelés',
    description:
      'PDF generálás ajánlat és munkalap dokumentumokhoz. Szerkesztési lehetőség az alkalmazás által létrehozott PDF-ek esetében.',
    href: '/documents',
    status: 'done',
  },
  {
    id: 'F-4',
    title: 'Live scan',
    description:
      'Alkalmazáson belüli fénykép készítés és azonnali feltöltés, felhasználó általi méretre vágási lehetőséggel.',
    href: '/uploads',
    status: 'done',
  },
  {
    id: 'F-5',
    title: 'Térkép alapú projektmegjelenítés',
    description: 'Google Maps integráció az árazó felületen.',
    href: '/map',
    status: 'done',
  },
  {
    id: 'F-6',
    title: 'Területkijelölés térképen',
    description: 'Polygon és mérési funkciók (m², hektár, stb.).',
    href: '/map',
    status: 'done',
  },
  {
    id: 'F-7',
    title: 'Pontjelölések térképen',
    description: 'Pontszerű lokációk jelölése a térképen tű ikonokkal.',
    href: '/map',
    status: 'done',
  },
  {
    id: 'F-8',
    title: 'NOTAM információk integrálása',
    description:
      'Automatikus lekérdezés és a légtér engedélykötelességének ellenőrzése.',
    href: '/notam',
    status: 'done',
  },
  {
    id: 'F-9',
    title: 'Igénykonfigurátor és automatikus árazás',
    description: 'Árazó modul létrehozása a megadott excel árazó alapján.',
    href: '/pricing',
    status: 'done',
  },
  {
    id: 'F-10',
    title: 'Excel alapú adatimport/export',
    description:
      'A véglegesített Excel árazó változatlan struktúrában történő beolvasása.',
    href: '/pricing',
    status: 'done',
  },
  {
    id: 'F-11',
    title: 'Jogosultság alapú adatmegosztás',
    description:
      'Alkalmazáson belüli jogosultsággal védett, időkorlátos hozzáférések a projekt adatlaphoz és dokumentumokhoz.',
    href: '/shares',
    status: 'done',
  },
  {
    id: 'F-12',
    title: 'Felhasználói és szerepkör-kezelés',
    description:
      'CRM integráció nélkül, önálló rendszerben működő jogosultsági struktúra és ügyfélkezelés. (4 szerepkör: pénzügy, project team, franchise partner, ügyfél)',
    href: '/users',
    status: 'done',
  },
  {
    id: 'F-13',
    title: 'Sales profil modul',
    description: 'Ügyfelek kezelése az alkalmazáson belül.',
    href: '/customers',
    status: 'done',
  },
  {
    id: 'F-14',
    title: 'Külső tárhely integráció',
    description: 'Azure felhő tárhely.',
    href: '/settings',
    status: 'done',
  },
  {
    id: 'F-15',
    title: 'Verziókövetés',
    description:
      'Fájl- és dokumentumverzió követés auditnaplóval, és/vagy időbélyegző használatával.',
    href: '/uploads',
    status: 'done',
  },
  {
    id: 'F-16',
    title: 'Szerződésnyilvántartó',
    description:
      'Projektenként szűrhető, szabad szavas keresőben kereshető dokumentum nevek.',
    href: '/contracts',
    status: 'done',
  },
  {
    id: 'F-17',
    title: 'Platformfüggetlen működés',
    description:
      'Android, Mac, iOS, Windows platformokon futó webalkalmazás.',
    href: '',
    status: 'done',
  },
  {
    id: 'F-18',
    title: 'Reszponzív működés',
    description:
      'Mobil és tablet eszközökön optimalizált webes használat.',
    href: '',
    status: 'done',
  },
  {
    id: 'F-19',
    title: 'Vevői adatlap',
    description:
      'Kapcsolattartási és projektadat struktúrával, a megadott adatok alapján.',
    href: '/customers',
    status: 'done',
  },
  {
    id: 'F-20',
    title: 'Többnyelvű felület',
    description: 'Magyar, angol és olasz nyelvi támogatás.',
    href: '/settings',
    status: 'done',
  },
  {
    id: 'F-21',
    title: 'Nagy sávszélesség optimalizáció (5G)',
    description: 'Nagy adatsebesség támogatása.',
    href: '',
    status: 'done',
  },
  {
    id: 'F-22',
    title: 'Moduláris architektúra',
    description:
      'API-first szemléletű, később bővíthető rendszer, moduláris architektúra.',
    href: '',
    status: 'done',
  },
  {
    id: 'F-23',
    title: 'Munkalap generálás',
    description: 'Megadott projektadatok alapján.',
    href: '/documents',
    status: 'done',
  },
  {
    id: 'F-24',
    title: 'Dokumentumküldés',
    description:
      'Ajánlat, szerződésminta, GDPR dokumentum sablon alapú feltöltése és kiküldése.',
    href: '/documents',
    status: 'done',
  },
];
