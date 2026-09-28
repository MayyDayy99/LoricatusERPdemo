import type { AxiosError } from 'axios';
import { describePermission } from './permission-labels';

/**
 * Egységes hiba-értelmezés: egy tetszőleges hibából emberi, cselekvésre
 * váltható magyar mondat.
 *
 * ELŐZMÉNY (2026-09-03): az alkalmazásban 292 `catch` blokk van, mindegyik a
 * saját kézzel írt tartalék szövegével (`'Hiba'`, `'Mentés sikertelen'`, …), és
 * mindegyik a szerver nyers üzenetét mutatja, ha van. A felhasználó ezért ilyen
 * mondatokat lát:
 *
 *     „Insufficient permissions. Required: project-map:create"
 *     „Tenant context is required"
 *     „Hiba"
 *
 * Az elsőből nem derül ki, hogy kitől kérjen jogot; a másodikból semmi; a
 * harmadikból még kevesebb. Ráadásul a backend `correlationId`-t is küld, ami a
 * kérést a szerver naplójában AZONOSÍTJA — a frontend ezt eddig eldobta.
 *
 * BEAVATKOZÁSI PONT: ez a modul az `api-client` válasz-interceptorából fut, és
 * felülírja a `response.data.message`-t. Így mind a 292 meglévő `catch` blokk
 * automatikusan a jó szöveget kapja, anélkül, hogy hozzájuk kellene nyúlni.
 *
 * ELV: a szerver ÉRTELMES üzenetét nem írjuk felül. Sok végpont küld pontos
 * magyar mondatot („Az utolsó adminisztrátort nem lehet visszaminősíteni") —
 * azt kár lenne általánosra cserélni. Csak az ismert technikai/angol
 * üzeneteket fordítjuk le, illetve azokat az állapotkódokat, ahol a szerver
 * szövege sosem hasznos (401, 5xx, hálózati hiba).
 */

export type ErrorKind =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'permission'
  | 'validation'
  | 'notfound'
  | 'conflict'
  | 'toolarge'
  | 'ratelimit'
  | 'server'
  | 'unknown';

export interface DescribedError {
  /** Emberi, cselekvésre váltható mondat — ezt lássa a felhasználó. */
  message: string;
  kind: ErrorKind;
  status?: number;
  /** A szerver kérés-azonosítója; támogatásnál ezzel található meg a naplóban. */
  correlationId?: string;
  /** Az eredeti (gyakran technikai) üzenet — hibakereséshez. */
  technical?: string;
}

/**
 * Olyan szerverüzenetek, amelyek a felhasználónak semmit nem mondanak.
 * Ezeket cseréljük; minden mást meghagyunk.
 */
const TECHNICAL_MESSAGES: RegExp[] = [
  /^forbidden$/i,
  /^unauthorized$/i,
  /^not found$/i,
  /^bad request$/i,
  /^conflict$/i,
  /^internal server error$/i,
  /^request failed/i,
  /^cannot (get|post|put|patch|delete)\b/i,
  /tenant context/i,
  /cross-tenant access denied/i,
  /^validation failed/i,
  // Ezeket az első próba fogta meg: az angol szöveg átcsúszott a felhasználóig.
  /^payload too large$/i,
  /too many requests/i,
  /throttlerexception/i,
  /^service unavailable$/i,
  /^gateway timeout$/i,
  /invalid credentials/i,
  /^invalid or expired token$/i,
  /^user not found$/i,
  /^no role assigned$/i,
];

/**
 * A bejelentkezési végpontokon a 401 NEM lejárt munkamenetet jelent, hanem
 * rossz jelszót — a felhasználó épp most gépelte be. Az általános
 * „Jelentkezz be újra" ott értelmetlen, a backend saját üzenete viszont pontos.
 *
 * Ez a megkülönböztetés ITT van, nem a hívóban: így akkor is helyes marad, ha
 * valaki közvetlenül hívja a `describeApiError`-t.
 */
function isLoginAttempt(url?: string): boolean {
  return !!url && /\/auth\/(login|refresh)$/.test(url);
}

function isTechnical(message: string): boolean {
  return TECHNICAL_MESSAGES.some(re => re.test(message.trim()));
}

/** `Insufficient permissions. Required: project-map:create` → a jog neve. */
function extractRequiredPermission(message: string): string | null {
  const m = message.match(/required:\s*([a-z0-9_-]+:[a-z0-9_*-]+)/i);
  return m ? m[1] : null;
}

interface ServerErrorBody {
  message?: unknown;
  code?: unknown;
  correlationId?: unknown;
}

/**
 * A hibából emberi leírás. Bármit elfogad (Axios-hiba, sima Error, ismeretlen),
 * mert a hívó oldalakon a `catch (e: any)` mintázat az uralkodó.
 */
export function describeApiError(error: unknown): DescribedError {
  const axiosErr = error as AxiosError | undefined;
  const response = axiosErr?.response;
  const body = response?.data as ServerErrorBody | undefined;

  const correlationId =
    typeof body?.correlationId === 'string' && body.correlationId !== 'unknown'
      ? body.correlationId
      : undefined;

  const serverMessage =
    typeof body?.message === 'string' && body.message.trim() ? body.message.trim() : undefined;

  /* ── Nincs válasz: hálózat vagy időtúllépés ──────────────────── */
  if (!response) {
    const code = (axiosErr as { code?: string } | undefined)?.code;
    if (code === 'ECONNABORTED' || /timeout/i.test(axiosErr?.message ?? '')) {
      return {
        kind: 'timeout',
        message: 'A művelet túl sokáig tartott. Próbáld újra — ha ismétlődik, szólj az adminisztrátornak.',
        technical: axiosErr?.message,
      };
    }
    // Nem Axios-hiba (pl. kódhiba a komponensben)
    if (!axiosErr?.isAxiosError) {
      const raw = error instanceof Error ? error.message : String(error ?? '');
      return { kind: 'unknown', message: raw || 'Váratlan hiba történt.', technical: raw };
    }
    return {
      kind: 'network',
      message:
        'Nincs kapcsolat a szerverrel. Ellenőrizd az internetkapcsolatot, aztán próbáld újra.',
      technical: axiosErr?.message,
    };
  }

  const status = response.status;
  const keep = (kind: ErrorKind, fallback: string): DescribedError => ({
    kind,
    status,
    correlationId,
    technical: serverMessage,
    // A szerver értelmes magyar üzenetét MEGTARTJUK — csak a technikait cseréljük.
    message: serverMessage && !isTechnical(serverMessage) ? serverMessage : fallback,
  });

  switch (true) {
    case status === 401:
      // Bejelentkezéskor a 401 = rossz jelszó, nem lejárt munkamenet.
      if (isLoginAttempt(axiosErr?.config?.url)) {
        return keep('auth', 'A megadott e-mail vagy jelszó nem megfelelő.');
      }
      return {
        kind: 'auth',
        status,
        correlationId,
        technical: serverMessage,
        message: 'Lejárt a bejelentkezésed. Jelentkezz be újra.',
      };

    case status === 403: {
      // A leggyakoribb eset: a jogosultsági guard mondja meg, mi hiányzik.
      const perm = serverMessage ? extractRequiredPermission(serverMessage) : null;
      if (perm) {
        return {
          kind: 'permission',
          status,
          correlationId,
          technical: serverMessage,
          message:
            `Ehhez a művelethez nincs jogosultságod: ${describePermission(perm)}. ` +
            'Kérd meg a rendszer adminisztrátorát, hogy engedélyezze a szerepkörödnek.',
        };
      }
      return keep(
        'permission',
        'Ehhez a művelethez nincs jogosultságod. Kérd meg a rendszer adminisztrátorát.',
      );
    }

    case status === 404:
      return keep('notfound', 'A keresett elem nem található — lehet, hogy időközben törölték.');

    case status === 409:
      return keep('conflict', 'Ez az elem már létezik, vagy időközben módosult. Frissíts és próbáld újra.');

    case status === 413:
      return keep('toolarge', 'A fájl túl nagy. Próbáld kisebb mérettel.');

    case status === 429:
      return keep('ratelimit', 'Túl sok kérés érkezett rövid idő alatt. Várj egy kicsit, majd próbáld újra.');

    case status === 400 || status === 422:
      // Itt a szerver validációs üzenete a HASZNOS — az `api-client` már
      // emberi formára hozta a mezőnkénti listát.
      return keep('validation', 'A megadott adatok hiányosak vagy hibásak.');

    case status >= 500: {
      // 5xx-nél a szerver szövege sosem hasznos a felhasználónak, viszont a
      // correlationId-vel a naplóban EGY kérés visszakereshető.
      const idPart = correlationId ? ` Hibaazonosító: ${correlationId}` : '';
      return {
        kind: 'server',
        status,
        correlationId,
        technical: serverMessage,
        message: `A szerver nem tudta feldolgozni a kérést.${idPart} Ha újra előfordul, küldd el ezt az azonosítót.`,
      };
    }

    default:
      return keep('unknown', `Váratlan hiba (${status}).`);
  }
}

/** Rövid forma, ahol nincs hely a teljes mondatra (pl. inline mezőhiba). */
export function shortErrorMessage(error: unknown): string {
  return describeApiError(error).message;
}
