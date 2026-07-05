/**
 * generateStaticParams-segéd a statikus exporthoz (GitHub Pages). A dinamikus
 * route-ok szerver-oldali layout.tsx-ei ezt hívják, hogy a determinisztikus
 * seed-idkből előállítsák a prerenderelendő paramétereket.
 *
 * Csak DEMO_EXPORT=true esetén ad vissza id-ket; normál (szerveres) buildnél
 * üres, hogy ne prerendereljen feleslegesen.
 */
import { buildSeed } from './db';

export function idsFor(collection: string, fallback: string[] = ['demo']): string[] {
  if (process.env.DEMO_EXPORT !== 'true') return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store: any = buildSeed();
  const rows = store[collection];
  const ids: string[] = Array.isArray(rows) ? rows.map((r: { id: string }) => r.id) : [];
  return ids.length ? ids : fallback;
}

/** Param-objektumok adott param-névvel (id / projectId / categoryId …). */
export function paramsFor(collection: string, param = 'id', fallback: string[] = ['demo']): Array<Record<string, string>> {
  return idsFor(collection, fallback).map((id) => ({ [param]: id }));
}
