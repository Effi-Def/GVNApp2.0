import { Expense, PaymentTransaction } from '../types'
import { roundTo2 } from '../services/firestoreMappers'

export interface Balance {
  userId: string
  amount: number // Positive: owed to them, Negative: they owe
}

export interface Debt {
  from: string
  to: string
  amount: number
}

const euroFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

/** Formats an amount the Italian way: 1.234,50 € */
export const formatEuro = (amount: number): string => euroFormatter.format(amount)

/** Like formatEuro, with an explicit + on credits */
export const formatEuroSigned = (amount: number): string => `${amount > 0 ? '+' : ''}${formatEuro(amount)}`

/**
 * Splits an amount in equal shares that always add up to the total:
 * leftover cents go to the first shares (10.01 / 2 => 5.01, 5.00).
 */
export const splitEqually = (amount: number, count: number): number[] => {
  if (count <= 0) return []
  const cents = Math.round(amount * 100)
  const base = Math.floor(cents / count)
  const leftover = cents - base * count
  return Array.from({ length: count }, (_, i) => (base + (i < leftover ? 1 : 0)) / 100)
}

/**
 * What each participant owes for an expense. Same stored amount for everyone means an
 * equal split: it is recomputed, so expenses saved with per-person rounding add up too.
 */
export const getExpenseShares = (expense: Expense): { userId: string; share: number }[] => {
  const { amount, participants } = expense
  if (!participants || participants.length === 0) return []

  const isEqualSplit = expense.splitType !== 'percentage'
    && participants.every(p => p.amount === participants[0].amount)
  const equalShares = isEqualSplit ? splitEqually(amount, participants.length) : []

  return participants.map((p, index) => {
    if (isEqualSplit) return { userId: p.userId, share: equalShares[index] }
    if (expense.splitType === 'percentage' && typeof p.percentage === 'number') {
      // Recalculate from stored percentage to avoid accumulated rounding drift
      return { userId: p.userId, share: roundTo2(amount * p.percentage / 100) }
    }
    return { userId: p.userId, share: p.amount }
  })
}

export const calculateBalances =  (expenses: Expense[], payments: PaymentTransaction[]): Record<string, number> => {
  const balances: Record<string, number> = {}

  // Process expenses
  expenses.forEach(expense => {
    const amount = expense.amount
    const payerId = expense.paidBy
    const participants = expense.participants
    
    if (!participants || participants.length === 0) return

    // Payer gets credit for the full amount
    balances[payerId] = roundTo2((balances[payerId] || 0) + amount)

    // Each participant (including payer if they are one) gets debit for their share
    getExpenseShares(expense).forEach(({ userId, share }) => {
      balances[userId] = roundTo2((balances[userId] || 0) - share)
    })
  })

  // Process payments (settlements)
  payments.forEach(payment => {
    // Payer of the debt (fromUserId) gets credit (debt reduced)
    balances[payment.fromUserId] = roundTo2((balances[payment.fromUserId] || 0) + payment.amount)
    
    // Receiver of the debt payment (toUserId) gets debit (credit reduced)
    balances[payment.toUserId] = roundTo2((balances[payment.toUserId] || 0) - payment.amount)
  })

  return balances
}

export const calculateDebts = (balances: Record<string, number>): Debt[] => {
  const debtors: { id: string, amount: number }[] = []
  const creditors: { id: string, amount: number }[] = []

  Object.entries(balances).forEach(([userId, amount]) => {
    // Round to 2 decimals to avoid floating point errors
    const roundedAmount = Math.round(amount * 100) / 100
    if (roundedAmount <= -0.01) {
      debtors.push({ id: userId, amount: roundedAmount }) // amount is negative
    } else if (roundedAmount >= 0.01) {
      creditors.push({ id: userId, amount: roundedAmount }) // amount is positive
    }
  })

  // Sort by magnitude to minimize number of transactions (greedy approach)
  debtors.sort((a, b) => a.amount - b.amount) // Ascending (most negative first)
  creditors.sort((a, b) => b.amount - a.amount) // Descending (most positive first)

  const debts: Debt[] = []
  let i = 0 // debtor index
  let j = 0 // creditor index

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]

    // The amount to settle is the minimum of what debtor owes and what creditor is owed
    const amount = Math.min(Math.abs(debtor.amount), creditor.amount)
    
    // Round to 2 decimals
    const roundedAmount = Math.round(amount * 100) / 100

    if (roundedAmount > 0) {
      debts.push({
        from: debtor.id,
        to: creditor.id,
        amount: roundedAmount
      })
    }

    // Adjust remaining balances
    debtor.amount += roundedAmount
    creditor.amount -= roundedAmount

    // If debtor is settled (approx 0), move to next debtor
    if (Math.abs(debtor.amount) < 0.01) {
      i++
    }

    // If creditor is settled (approx 0), move to next creditor
    if (creditor.amount < 0.01) {
      j++
    }
  }

  return debts
}
