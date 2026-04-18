export const UNIT_CONVERSIONS: Record<string, { factor: number; base: string }> = {
  // Length → M
  m: { factor: 1, base: 'M' },
  M: { factor: 1, base: 'M' },
  ml: { factor: 0.001, base: 'M' },
  mm: { factor: 0.001, base: 'M' },
  MM: { factor: 0.001, base: 'M' },
  cm: { factor: 0.01, base: 'M' },
  CM: { factor: 0.01, base: 'M' },
  km: { factor: 1000, base: 'M' },
  KM: { factor: 1000, base: 'M' },
  // Area → M2
  'm2': { factor: 1, base: 'M2' },
  M2: { factor: 1, base: 'M2' },
  'm²': { factor: 1, base: 'M2' },
  'M²': { factor: 1, base: 'M2' },
  ha: { factor: 10_000, base: 'M2' },
  HA: { factor: 10_000, base: 'M2' },
  'km2': { factor: 1_000_000, base: 'M2' },
  KM2: { factor: 1_000_000, base: 'M2' },
  // Volume → M3
  'm3': { factor: 1, base: 'M3' },
  M3: { factor: 1, base: 'M3' },
  'm³': { factor: 1, base: 'M3' },
  'M³': { factor: 1, base: 'M3' },
  l: { factor: 0.001, base: 'M3' },
  L: { factor: 0.001, base: 'M3' },
  lt: { factor: 0.001, base: 'M3' },
  LT: { factor: 0.001, base: 'M3' },
  // Mass → KG
  kg: { factor: 1, base: 'KG' },
  KG: { factor: 1, base: 'KG' },
  g: { factor: 0.001, base: 'KG' },
  G: { factor: 0.001, base: 'KG' },
  ton: { factor: 1000, base: 'KG' },
  TON: { factor: 1000, base: 'KG' },
  t: { factor: 1000, base: 'KG' },
  T: { factor: 1000, base: 'KG' },
  // Count
  un: { factor: 1, base: 'UN' },
  UN: { factor: 1, base: 'UN' },
  und: { factor: 1, base: 'UN' },
  UND: { factor: 1, base: 'UN' },
  unid: { factor: 1, base: 'UN' },
  UNID: { factor: 1, base: 'UN' },
}

/**
 * Convert a (value, unit) pair to its canonical base unit.
 * Returns null when value is null/0.
 */
export function normalizeToBaseUnit(
  value: number | null,
  unit: string | null,
): { value: number; baseUnit: string } | null {
  if (value == null || value <= 0) return null
  if (unit == null) return { value, baseUnit: 'UN' }
  const conv = UNIT_CONVERSIONS[unit.trim()]
  if (!conv) return { value, baseUnit: unit.trim().toUpperCase() }
  return { value: value * conv.factor, baseUnit: conv.base }
}
