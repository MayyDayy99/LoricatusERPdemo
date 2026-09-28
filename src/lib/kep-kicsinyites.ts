/**
 * ── KÉPKICSINYÍTÉS A BÖNGÉSZŐBEN, FELTÖLTÉS ELŐTT ───────────────────────────
 *
 * A heti jelentés képeiből KÉT méret készül:
 *
 *   teljes    max. 1600 px — a felületen, nagyításhoz
 *   elonezet  max.  600 px — az ügyvezetőnek küldött e-mailbe ágyazva
 *
 * Miért itt, és nem a szerveren:
 *   - a szerveren nincs képfeldolgozó függőség, és egy natív könyvtár az
 *     alpine képben platformfüggő buktató;
 *   - egy telefonos fotó 4–8 MB — kicsinyítve 300–500 KB, ami mobilneten is
 *     gyorsan felmegy.
 *
 * MELLÉKHATÁS, SZÁNDÉKOSAN: a vászonra rajzolás és újrakódolás MINDEN EXIF-
 * adatot eldob. A helyszíni fotók GPS-koordinátái, a készülék típusa és a
 * készítés pontos ideje nem kerül a tárolóba — és nem kerül az e-mailbe sem.
 *
 * A tájolást viszont MEGTARTJUK: a `createImageBitmap` az EXIF-beli
 * elforgatást alkalmazza rajzolás előtt, különben az álló fotók oldalra
 * dőlve jelennének meg.
 */

const TELJES_MAX_OLDAL = 1600;
const ELONEZET_MAX_OLDAL = 600;

/** A szerver korlátjai alatt, tartalékkal (lásd `weekly-reports.service.ts`). */
const TELJES_MAX_BYTE = 3.8 * 1024 * 1024;
const ELONEZET_MAX_BYTE = 560 * 1024;

export interface ElkeszultKep {
  teljes: Blob;
  elonezet: Blob;
  nev: string;
}

export class KepHiba extends Error {}

export async function kepetElokeszit(fajl: File): Promise<ElkeszultKep> {
  if (!fajl.type.startsWith('image/')) {
    throw new KepHiba(`„${fajl.name}" nem kép.`);
  }

  let kep: ImageBitmap;
  try {
    kep = await createImageBitmap(fajl, { imageOrientation: 'from-image' });
  } catch {
    // Jellemzően HEIC (iPhone), amit a Chrome és a Firefox nem tud megnyitni.
    // Az iPhone Safari a fájlválasztóból amúgy is JPEG-et ad.
    throw new KepHiba(
      `„${fajl.name}" formátumát a böngésző nem tudja megnyitni (pl. HEIC). ` +
      'Mentsd el JPEG-ként, vagy töltsd fel a telefon böngészőjéből.',
    );
  }

  try {
    const teljes = await kodol(kep, TELJES_MAX_OLDAL, [0.82, 0.7, 0.55], TELJES_MAX_BYTE);
    const elonezet = await kodol(kep, ELONEZET_MAX_OLDAL, [0.78, 0.65, 0.5], ELONEZET_MAX_BYTE);
    return { teljes, elonezet, nev: jpgNev(fajl.name) };
  } finally {
    kep.close();
  }
}

/**
 * Átméretezés és JPEG-kódolás. Ha az első minőségen túl nagy, lejjebb megy —
 * egy részletgazdag fotó (pl. fűszálak közelről) 1600 px-en is lehet több MB.
 */
async function kodol(kep: ImageBitmap, maxOldal: number, minosegek: number[], maxByte: number): Promise<Blob> {
  const arany = Math.min(1, maxOldal / Math.max(kep.width, kep.height));
  const szel = Math.max(1, Math.round(kep.width * arany));
  const mag = Math.max(1, Math.round(kep.height * arany));

  const vaszon = document.createElement('canvas');
  vaszon.width = szel;
  vaszon.height = mag;
  const ctx = vaszon.getContext('2d');
  if (!ctx) throw new KepHiba('A böngésző nem tudja feldolgozni a képet.');

  // Fehér háttér: a JPEG nem ismeri az átlátszóságot, és egy átlátszó PNG
  // háttere enélkül FEKETE lenne.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, szel, mag);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(kep, 0, 0, szel, mag);

  let utolso: Blob | null = null;
  for (const minoseg of minosegek) {
    utolso = await new Promise<Blob | null>((ok) => vaszon.toBlob(ok, 'image/jpeg', minoseg));
    if (utolso && utolso.size <= maxByte) return utolso;
  }
  if (!utolso) throw new KepHiba('A kép kódolása nem sikerült.');
  throw new KepHiba('A kép a kicsinyítés után is túl nagy. Próbálj egy kisebb felbontású képet.');
}

/** A fájlnév megtartása, `.jpg` kiterjesztéssel — a tartalom már JPEG. */
function jpgNev(eredeti: string): string {
  const alap = eredeti.replace(/\.[^./\\]+$/, '') || 'kep';
  return `${alap}.jpg`;
}
