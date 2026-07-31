/**
 * Identity Platform — Favorites engine (pure helpers).
 */
import type { Favorite, FavoriteKind, PersonalizationSignal } from "./types";
import { favoriteKey } from "./validation";

export function dedupeFavorites(favorites: readonly Favorite[]): readonly Favorite[] {
  const seen = new Map<string, Favorite>();
  for (const f of favorites) {
    const key = favoriteKey(f);
    if (!seen.has(key)) seen.set(key, f);
  }
  return Object.freeze([...seen.values()]);
}

export function favoritesByKind(
  favorites: readonly Favorite[],
): Readonly<Record<FavoriteKind, readonly Favorite[]>> {
  const base: Record<FavoriteKind, Favorite[]> = {
    place: [], station: [], airport: [], hotel: [], route: [], search: [],
  };
  for (const f of favorites) base[f.kind].push(f);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(base).map(([k, v]) => [k, Object.freeze(v)]),
    ) as Record<FavoriteKind, readonly Favorite[]>,
  );
}

export function sortFavorites(favorites: readonly Favorite[]): readonly Favorite[] {
  return Object.freeze(
    [...favorites].sort(
      (a, b) => (a.createdAt - b.createdAt) || favoriteKey(a).localeCompare(favoriteKey(b)),
    ),
  );
}

export function favoriteSignals(favorites: readonly Favorite[]): readonly PersonalizationSignal[] {
  const counts = new Map<string, number>();
  for (const f of favorites) counts.set(favoriteKey(f), (counts.get(favoriteKey(f)) ?? 0) + 1);
  return Object.freeze(
    [...counts.entries()]
      .map(([key, count]) => ({
        key: `favorite:${key}`,
        value: count,
        weight: Math.min(0.2, 0.05 * count),
        source: "favorites",
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  );
}
