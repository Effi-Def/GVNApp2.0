/**
 * Centralized date utilities for GVNApp.
 * All Firestore → JS date coercion must go through here.
 */

/**
 * Coerce any Firestore value (Timestamp, Date, string, number) to a Date.
 * Returns undefined if the value is missing or invalid.
 * Never silently falls back to "today" — callers decide the fallback.
 */
export function toDate(v: unknown): Date | undefined {
  if (!v) return undefined
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v
  if (typeof (v as any)?.toDate === 'function') {
    const d = (v as any).toDate() as Date
    return isNaN(d.getTime()) ? undefined : d
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v)
    return isNaN(d.getTime()) ? undefined : d
  }
  return undefined
}

/**
 * Like toDate() but falls back to the provided default when the value is missing/invalid.
 * Use only when a fallback is semantically correct (e.g. display purposes).
 */
export function toDateOr(v: unknown, fallback: Date): Date {
  return toDate(v) ?? fallback
}

/** Start of a given day (midnight) */
export function startOfDay(d: Date): Date {
  const nd = new Date(d)
  nd.setHours(0, 0, 0, 0)
  return nd
}

/** Format a Date as YYYY-MM-DD key */
export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Human-readable Italian date (e.g. "14 mar 2026") */
export function formatDateIT(d: Date): string {
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Human-readable Italian date + time (e.g. "14 mar 2026, 20:30") */
export function formatDateTimeIT(d: Date): string {
  return d.toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
