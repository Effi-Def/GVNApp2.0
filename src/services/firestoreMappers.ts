import { FieldValue, Timestamp } from 'firebase/firestore'

export function toDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof (value as any)?.toDate === 'function') return (value as any).toDate()
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? undefined : d
  }
  return undefined
}

export function toDateOrNow(value: unknown, fallback: Date = new Date()): Date {
  return toDate(value) || fallback
}

export function toTimestamp(value: unknown): Timestamp | undefined {
  if (!value) return undefined
  if (value instanceof Timestamp) return value
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : Timestamp.fromDate(value)
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? undefined : Timestamp.fromDate(d)
  }
  return undefined
}

export function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}

export function cleanUndefinedDeep(value: any): any {
  if (value === undefined) return undefined
  if (value === null) return null
  if (value instanceof FieldValue) return value
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value
  if (Array.isArray(value)) {
    return value.map(cleanUndefinedDeep).filter(v => v !== undefined)
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([k, v]) => [k, cleanUndefinedDeep(v)] as const)
      .filter(([, v]) => v !== undefined)
    return Object.fromEntries(entries)
  }
  return value
}

/** Round a currency amount to exactly 2 decimal places, eliminating IEEE-754 drift. */
export function roundTo2(n: number): number {
  return Math.round(n * 100) / 100
}
