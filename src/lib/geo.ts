/**
 * ── TERÜLETSZÁMÍTÁS A BERAJZOLT SOKSZÖGBŐL ──────────────────────────────────
 *
 * A projekt helyszín-sokszöge `[szélesség, hosszúság]` párokként van tárolva
 * (`metadata.polygon`). Ebből számoljuk a területet, hogy ne kelljen külön
 * kimérni — az árazási katalógus drónos tételei eddig szó szerint azt írták
 * elő, hogy a hektárt Google Earth-ben kell körberajzolni és leolvasni.
 *
 * ── A MÓDSZER ──────────────────────────────────────────────────────────────
 *
 * Gömbi sokszög-terület (ugyanaz a képlet, amit a Leaflet.draw és a Google
 * térképes területmérője is használ):
 *
 *   T = | Σ (λ₂ − λ₁) · (2 + sin φ₁ + sin φ₂) | · R² / 2
 *
 * ahol φ a szélesség, λ a hosszúság radiánban, R a WGS84 egyenlítői sugara.
 *
 * Miért nem sík képlet (cipőfűző): a fok nem egyenlő hosszú — Magyarország
 * szélességén egy hosszúsági fok kb. 75 km, egy szélességi kb. 111 km. Egy
 * fokokban számolt sík terület emiatt ~48%-kal eltérne.
 *
 * ── PONTOSSÁG ──────────────────────────────────────────────────────────────
 *
 * Mezőgazdasági és építési léptékben (néhány hektártól néhány száz hektárig)
 * az eltérés egy geodéziai méréstől tized-százalékos nagyságrendű. A
 * korlátot NEM a képlet adja, hanem a kézzel kattintott sarokpontok — ezért
 * van a felületen külön „hivatalos terület" mező a szerződéses számnak.
 */

const WGS84_EGYENLITOI_SUGAR_M = 6378137;
const FOK_RADIAN = Math.PI / 180;

/** `[szélesség, hosszúság]` — a `metadata.polygon` tárolási formája. */
export type SzelHossz = [number, number];

/**
 * A sokszög területe négyzetméterben.
 *
 * Háromnál kevesebb pont (vagy érvénytelen adat) esetén 0 — nem dob hibát,
 * mert a felület félkész rajzolás közben is meghívhatja.
 */
export function sokszogTeruletM2(pontok: ReadonlyArray<SzelHossz> | null | undefined): number {
  if (!Array.isArray(pontok) || pontok.length < 3) return 0;

  let osszeg = 0;
  for (let i = 0; i < pontok.length; i++) {
    const p1 = pontok[i];
    const p2 = pontok[(i + 1) % pontok.length];
    if (!ervenyesPont(p1) || !ervenyesPont(p2)) return 0;

    const [szel1, hossz1] = p1;
    const [szel2, hossz2] = p2;
    osszeg +=
      (hossz2 - hossz1) * FOK_RADIAN *
      (2 + Math.sin(szel1 * FOK_RADIAN) + Math.sin(szel2 * FOK_RADIAN));
  }

  return Math.abs((osszeg * WGS84_EGYENLITOI_SUGAR_M * WGS84_EGYENLITOI_SUGAR_M) / 2);
}

export function m2Hektarba(m2: number): number {
  return m2 / 10_000;
}

/**
 * Hektár emberi olvasásra: két tizedes, magyar tizedesvesszővel.
 * Egy hektár alatt négyzetmétert is mutat, mert ott a tizedes hektár
 * („0,04 ha") nehezen értelmezhető.
 */
export function hektarSzoveg(ha: number): string {
  const szam = ha.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (ha > 0 && ha < 1) {
    const m2 = Math.round(ha * 10_000).toLocaleString('hu-HU');
    return `${szam} ha (${m2} m²)`;
  }
  return `${szam} ha`;
}

function ervenyesPont(p: unknown): p is SzelHossz {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    typeof p[0] === 'number' && Number.isFinite(p[0]) &&
    typeof p[1] === 'number' && Number.isFinite(p[1])
  );
}
