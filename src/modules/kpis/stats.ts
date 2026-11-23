import type { Estadistica } from './tipos.js';

export const sinNulos = (v: readonly (number | null)[]): number[] => v.filter((x): x is number => x !== null);

/** Media, mediana y p90 (*nearest-rank*), en segundos enteros. `n = 0` → todo `null`. */
export function estadistica(valores: readonly number[]): Estadistica {
  if (valores.length === 0) return { n: 0, media: null, mediana: null, p90: null };
  const v = [...valores].sort((a, b) => a - b);
  const rank = (p: number): number => v[Math.max(0, Math.ceil(p * v.length) - 1)] ?? 0;
  return {
    n: v.length,
    media: Math.round(v.reduce((s, x) => s + x, 0) / v.length),
    mediana: rank(0.5),
    p90: rank(0.9),
  };
}

export const mediaEntera = (valores: readonly number[]): number | null => estadistica(valores).media;
