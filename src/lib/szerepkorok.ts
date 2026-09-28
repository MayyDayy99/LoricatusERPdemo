/**
 * Szerepkör-ellenőrzés EGY helyen.
 *
 * Eddig minden oldal külön írta le, hogy „admin vagy ceo", és a `super_admin`
 * egyikből sem maradt ki véletlenül — hanem mindegyikből. A szuperadmin így a
 * saját rendszeréből volt kizárva: az oldalsávban látta a menüpontot (ott a
 * `super_admin` mindent lát), az oldal viszont „Csak admin" üzenettel fogadta.
 * A backend közben végig beengedte (a statikus RBAC-mátrix `*`-ot ad a
 * `super_admin`-nak), tehát ez tisztán felületi zárás volt.
 *
 * A kis/nagybetűt is kezeljük: a korábbi ellenőrzések 'ADMIN' / 'CEO'
 * változatokat is néztek, mert a szerepkör több forrásból érkezhet.
 */

type SzerepNev = string | null | undefined;

const kisbetus = (szerep: SzerepNev): string => (szerep ?? '').toLowerCase();

/** A rendszer gazdája — minden felületet lát, jogosultságot nem korlátozunk rá. */
export function szuperadmin(szerep: SzerepNev): boolean {
  return kisbetus(szerep) === 'super_admin';
}

/** Admin szintű: szuperadmin, admin vagy ügyvezető. */
export function adminSzintu(szerep: SzerepNev): boolean {
  return ['super_admin', 'admin', 'ceo'].includes(kisbetus(szerep));
}

/** Admin szintű VAGY vezető (manager) — a csapatot látó nézetekhez. */
export function vezetoiSzintu(szerep: SzerepNev): boolean {
  return adminSzintu(szerep) || kisbetus(szerep) === 'manager';
}
