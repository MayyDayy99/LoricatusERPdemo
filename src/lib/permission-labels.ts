/**
 * Jogosultság-azonosítók magyar megnevezései.
 *
 * Egy helyen, mert két különböző célra kell:
 *   - a /settings/roles jogosultság-mátrix fejlécei,
 *   - a hibaüzenetek (`error-messages.ts`): egy 403-ból emberi mondat legyen
 *     ("Nincs jogosultságod: Projekt térkép – létrehozás") a nyers
 *     "Insufficient permissions. Required: project-map:create" helyett.
 */
export const RESOURCE_LABELS: Record<string, string> = {
  'tenant':      'Munkaterület',
  'users':       'Felhasználók',
  'projects':    'Projektek',
  'uploads':     'Fájlok / Feltöltések',
  'documents':   'Dokumentumok',
  'shares':      'Megosztások',
  'pricing':     'Árazás',
  'maps':        'Térkép',
  'contracts':   'Szerződések',
  'customers':   'Ügyfelek',
  'audit':       'Tevékenységnapló',
  'deals':       'Üzletek (CRM)',
  'activities':  'Tevékenységek',
  'crm-tasks':   'CRM Feladatok',
  'quotes':      'Árajánlatok',
  'invoices':    'Számlák',
  'pipelines':   'Értékesítési folyamatok',
  'workflows':   'Automatizációk',
  'webhooks':    'Webhookok',
  'crm-reports': 'CRM Riportok',
  'comments':      'Kommentek',
  'field-reports': 'Helyszíni jelentések',
  'leaves':        'Szabadságok',
  'reports':       'Jelentések',
  'project-map':   'Projekt térkép',
  'import':        'Importálás',
  'work-orders':   'Munkalapok',
  'equipment':      'Eszközök',
  'subcontractors': 'Alvállalkozók',
  'timesheets':     'Munkaidő',
  'analytics':      'Elemzések',
  'referrals':      'Meghívók',
};

/** A művelet-rész (`:read`, `:create`, …) magyar megfelelője. */
const ACTION_LABELS: Record<string, string> = {
  read: 'megtekintés',
  create: 'létrehozás',
  update: 'módosítás',
  delete: 'törlés',
  write: 'szerkesztés',
  send: 'küldés',
  manage: 'kezelés',
  approve: 'jóváhagyás',
  revoke: 'visszavonás',
};

/**
 * `project-map:create` → `Projekt térkép – létrehozás`
 *
 * Ismeretlen erőforrásnál a nyers azonosítót adja vissza: jobb egy technikai
 * szó, mint egy félrevezető fordítás.
 */
export function describePermission(permission: string): string {
  const [resource, action] = permission.split(':');
  const res = RESOURCE_LABELS[resource];
  const act = ACTION_LABELS[action];
  if (!res) return permission;
  return act ? `${res} – ${act}` : res;
}
