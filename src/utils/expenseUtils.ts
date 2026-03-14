import { Expense, PaymentTransaction } from '../types'

/**
 * Round a floating-point euro amount to exactly 2 decimal places.
 * Use this for ALL money arithmetic to avoid 9.999999 / 10.000001 artefacts.
 *
 * Internally works in integer cents to avoid IEEE 754 drift.
 */
export function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100
}

/**
 * Split a total amount equally among n participants, returning amounts that
 * sum exactly to the total (adjusts the last participant for rounding remainder).
 */
export function splitEqually(total: number, n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor((total * 100) / n)
  const remainder = Math.round(total * 100) - base * n
  return Array.from({ length: n }, (_, i) =>
    (i < remainder ? base + 1 : base) / 100
  )
}

export interface Balance {
  userId: string
  amount: number // Positive: owed to them, Negative: they owe
}

export interface Debt {
  from: string
  to: string
  amount: number
}

export const calculateBalances = (expenses: Expense[], payments: PaymentTransaction[]): Record<string, number> => {
  const balances: Record<string, number> = {}

  // Process expenses
  expenses.forEach(expense => {
    const amount = expense.amount
    const payerId = expense.paidBy
    const participants = expense.participants
    
    if (!participants || participants.length === 0) return

    // Payer gets credit for the full amount
    balances[payerId] = roundCents((balances[payerId] || 0) + amount)

    // Each participant gets debit for their share (use per-participant amount if set)
    participants.forEach(p => {
      const share = roundCents(p.amount || (amount / participants.length))
      balances[p.userId] = roundCents((balances[p.userId] || 0) - share)
    })
  })

  // Process payments (settlements)
  payments.forEach(payment => {
    // Payer of the debt (fromUserId) gets credit (debt reduced)
    balances[payment.fromUserId] = roundCents((balances[payment.fromUserId] || 0) + payment.amount)

    // Receiver of the debt payment (toUserId) gets debit (credit reduced)
    balances[payment.toUserId] = roundCents((balances[payment.toUserId] || 0) - payment.amount)
  })

  return balances
}

export const calculateDebts = (balances: Record<string, number>): Debt[] => {
  const debtors: { id: string, amount: number }[] = []
  const creditors: { id: string, amount: number }[] = []

  Object.entries(balances).forEach(([userId, amount]) => {
    // Round to 2 decimals to avoid floating point errors
    const roundedAmount = Math.round(amount * 100) / 100
    if (roundedAmount < -0.01) {
      debtors.push({ id: userId, amount: roundedAmount }) // amount is negative
    } else if (roundedAmount > 0.01) {
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
