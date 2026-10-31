import { describe, expect, it } from 'vitest'
import type { Expense } from '../types'
import { calculateBalances, calculateDebts, formatEuro, formatEuroSigned, splitEqually } from './expenseUtils'

const expense = (overrides: Partial<Expense>): Expense => ({
  id: 'expense-1',
  title: 'Spesa',
  amount: 10.01,
  paidBy: 'a',
  participants: [
    { userId: 'a', name: 'A', amount: 5.01, settled: false },
    { userId: 'b', name: 'B', amount: 5.01, settled: false },
  ],
  createdAt: new Date('2030-01-01'),
  updatedAt: new Date('2030-01-01'),
  ...overrides,
})

const sum = (values: number[]) => Math.round(values.reduce((total, v) => total + v, 0) * 100) / 100

describe('splitEqually', () => {
  it('assigns leftover cents so the shares add up to the total', () => {
    expect(splitEqually(10.01, 2)).toEqual([5.01, 5])
    expect(splitEqually(10, 3)).toEqual([3.34, 3.33, 3.33])
  })

  it.each([[0.01, 3], [19.99, 7], [100, 6], [1234.56, 11]])('keeps the total of %s across %s people', (amount, count) => {
    expect(sum(splitEqually(amount, count))).toBe(amount)
  })

  it('handles empty groups', () => {
    expect(splitEqually(10, 0)).toEqual([])
  })
})

describe('calculateBalances', () => {
  it('adds up to zero on expenses saved with per-person rounding', () => {
    const balances = calculateBalances([expense({})], [])
    expect(balances).toEqual({ a: 5, b: -5.01 + 0.01 })
    expect(sum(Object.values(balances))).toBe(0)
  })

  it('credits the selected payer even when they are not the creator', () => {
    const balances = calculateBalances([expense({ paidBy: 'b', createdBy: 'a', amount: 10, participants: [
      { userId: 'a', name: 'A', amount: 5, settled: false },
      { userId: 'b', name: 'B', amount: 5, settled: false },
    ] })], [])
    expect(balances).toEqual({ a: -5, b: 5 })
  })

  it('keeps custom amounts as they are', () => {
    const balances = calculateBalances([expense({ amount: 10, participants: [
      { userId: 'a', name: 'A', amount: 2, settled: false },
      { userId: 'b', name: 'B', amount: 8, settled: false },
    ] })], [])
    expect(balances).toEqual({ a: 8, b: -8 })
  })
})

describe('calculateDebts', () => {
  it('does not lose one-cent debts', () => {
    expect(calculateDebts({ a: 0.01, b: -0.01 })).toEqual([{ from: 'b', to: 'a', amount: 0.01 }])
  })
})

describe('formatEuro', () => {
  it('uses the Italian format', () => {
    expect(formatEuro(1234.5).replace(/\s/g, ' ')).toBe('1234,50 €')
    expect(formatEuro(10.01).replace(/\s/g, ' ')).toBe('10,01 €')
    expect(formatEuroSigned(5).replace(/\s/g, ' ')).toBe('+5,00 €')
    expect(formatEuroSigned(-5).replace(/\s/g, ' ')).toBe('-5,00 €')
  })
})
