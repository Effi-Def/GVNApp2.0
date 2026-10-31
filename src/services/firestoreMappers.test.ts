import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import {
  cleanUndefined,
  cleanUndefinedDeep,
  roundTo2,
  toDate,
  toDateOrNow,
  toTimestamp,
} from './firestoreMappers'

describe('firestoreMappers', () => {
  it('toDate converts Date, ISO string and timestamp number', () => {
    const date = new Date('2026-03-20T10:00:00.000Z')
    expect(toDate(date)).toEqual(date)
    expect(toDate('2026-03-20T10:00:00.000Z')?.toISOString()).toBe('2026-03-20T10:00:00.000Z')
    expect(toDate(date.getTime())?.toISOString()).toBe('2026-03-20T10:00:00.000Z')
  })

  it('toDate supports Firestore-like objects with toDate()', () => {
    const expected = new Date('2026-03-21T09:30:00.000Z')
    const value = { toDate: () => expected }
    expect(toDate(value)).toEqual(expected)
  })

  it('toDate returns undefined for invalid inputs', () => {
    expect(toDate(undefined)).toBeUndefined()
    expect(toDate('not-a-date')).toBeUndefined()
    expect(toDate({ foo: 'bar' })).toBeUndefined()
  })

  it('toDateOrNow returns fallback when conversion fails', () => {
    const fallback = new Date('2026-03-22T00:00:00.000Z')
    expect(toDateOrNow('invalid-date', fallback)).toEqual(fallback)
  })

  it('toTimestamp converts Date and string inputs', () => {
    const source = new Date('2026-03-21T08:00:00.000Z')
    const fromDate = toTimestamp(source)
    const fromString = toTimestamp(source.toISOString())

    expect(fromDate?.toMillis()).toBe(source.getTime())
    expect(fromString?.toMillis()).toBe(source.getTime())
  })

  it('toTimestamp returns existing Timestamp unchanged', () => {
    const ts = Timestamp.fromDate(new Date('2026-03-20T01:00:00.000Z'))
    expect(toTimestamp(ts)).toBe(ts)
  })

  it('toTimestamp returns undefined for invalid values', () => {
    expect(toTimestamp(undefined)).toBeUndefined()
    expect(toTimestamp(new Date('invalid'))).toBeUndefined()
    expect(toTimestamp('invalid')).toBeUndefined()
  })

  it('cleanUndefined removes only top-level undefined fields', () => {
    const cleaned = cleanUndefined({
      a: 1,
      b: undefined,
      c: null,
    })

    expect(cleaned).toEqual({ a: 1, c: null })
  })

  it('cleanUndefinedDeep removes undefined recursively in objects and arrays', () => {
    const cleaned = cleanUndefinedDeep({
      a: 1,
      b: undefined,
      c: {
        d: undefined,
        e: 2,
      },
      f: [1, undefined, 3, { x: undefined, y: 'ok' }],
    })

    expect(cleaned).toEqual({
      a: 1,
      c: { e: 2 },
      f: [1, 3, { y: 'ok' }],
    })
  })

  it('cleanUndefinedDeep preserves Date, Timestamp and null values', () => {
    const date = new Date('2026-03-22T12:00:00.000Z')
    const ts = Timestamp.fromDate(date)

    const cleaned = cleanUndefinedDeep({
      date,
      ts,
      nullable: null,
    })

    expect(cleaned.date).toBe(date)
    expect(cleaned.ts).toBe(ts)
    expect(cleaned.nullable).toBeNull()
  })

  it('roundTo2 normalizes floating point drift', () => {
    expect(roundTo2(1.005)).toBe(1)
    expect(roundTo2(10.235)).toBe(10.24)
    expect(roundTo2(0.1 + 0.2)).toBe(0.3)
  })
})
