import React, { useMemo, useState } from 'react'
import { Expense, PaymentTransaction, Event } from '../types'
import { calculateBalances, calculateDebts, Debt } from '../utils/expenseUtils'
import { paymentService } from '../services/firestore'

interface Props {
  expenses: Expense[]
  payments: PaymentTransaction[]
  events: Event[]
  currentUserId: string
  onPaymentRecorded: () => void
  scope?: { farmId?: string; eventId?: string }
  userNameById?: Record<string, string>
}

const ExpenseSettlement: React.FC<Props> = ({ expenses, payments, events, currentUserId, onPaymentRecorded, scope, userNameById }) => {
  const [loading, setLoading] = useState(false)

  // Build a map of userId -> userName from event participants
  const userMap = useMemo(() => {
    const map: Record<string, string> = {}
    if (userNameById && typeof userNameById === 'object') {
      for (const [k, v] of Object.entries(userNameById)) {
        if (!k) continue
        if (typeof v === 'string' && v.trim().length > 0) map[k] = v
      }
    }
    events.forEach(e => {
      e.participants.forEach(p => {
        map[p.userId] = p.name
      })
    })
    // Add current user if missing (fallback)
    if (!map[currentUserId]) map[currentUserId] = 'Tu'
    return map
  }, [events, currentUserId])

  const getUserName = (id: string) => {
    if (id === currentUserId) return 'Tu'
    return userMap[id] || 'Utente sconosciuto'
  }

  const { debts } = useMemo(() => {
    const balances = calculateBalances(expenses, payments)
    const debts = calculateDebts(balances)
    return { debts }
  }, [expenses, payments])

  const handleSettleUp = async (debt: Debt) => {
    if (!confirm(`Confermi di aver pagato ${debt.amount.toFixed(2)}€ a ${getUserName(debt.to)}?`)) return

    setLoading(true)
    try {
      await paymentService.create({
        fromUserId: debt.from,
        fromUserName: userMap[debt.from] || 'Utente',
        toUserId: debt.to,
        toUserName: userMap[debt.to] || 'Utente',
        amount: debt.amount,
        description: 'Saldo debiti',
        farmId: scope?.farmId,
        eventId: scope?.eventId,
        // We don't link to specific expenses for now, just general settlement
        relatedExpenseIds: [] 
      })
      onPaymentRecorded()
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('Errore durante la registrazione del pagamento')
    } finally {
      setLoading(false)
    }
  }

  const myDebts = debts.filter(d => d.from === currentUserId)
  const debtsToMe = debts.filter(d => d.to === currentUserId)
  const otherDebts = debts.filter(d => d.from !== currentUserId && d.to !== currentUserId)

  const totalOwedToMe = debtsToMe.reduce((sum, d) => sum + d.amount, 0)
  const totalIOwe = myDebts.reduce((sum, d) => sum + d.amount, 0)

  const handleSettleAllMine = async () => {
    if (myDebts.length === 0) return
    const total = myDebts.reduce((s, d) => s + d.amount, 0)
    if (!confirm(`Confermi di aver saldato TUTTI i tuoi debiti per un totale di ${total.toFixed(2)}€?`)) return

    setLoading(true)
    try {
      for (const debt of myDebts) {
        await paymentService.create({
          fromUserId: debt.from,
          fromUserName: userMap[debt.from] || 'Utente',
          toUserId: debt.to,
          toUserName: userMap[debt.to] || 'Utente',
          amount: debt.amount,
          description: 'Saldo debiti (reset)',
          farmId: scope?.farmId,
          eventId: scope?.eventId,
          relatedExpenseIds: [],
        })
      }
      onPaymentRecorded()
    } catch (error) {
      console.error('Error recording bulk payments:', error)
      alert('Errore durante la registrazione dei pagamenti')
    } finally {
      setLoading(false)
    }
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 bg-[--bg-card] rounded-xl border border-[--border-base]">
        <div className="text-4xl mb-3">⚖️</div>
        <p className="text-[--text-muted]">Nessuna spesa da saldare.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`p-4 rounded-xl border ${totalIOwe > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
          <h3 className="text-sm font-medium text-[--text-muted] mb-1">Devi dare</h3>
          <p className={`text-2xl font-bold ${totalIOwe > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {totalIOwe.toFixed(2)}€
          </p>
        </div>
        <div className={`p-4 rounded-xl border ${totalOwedToMe > 0 ? 'bg-green-50 border-green-100' : 'bg-[--bg-subtle] border-gray-100'}`}>
          <h3 className="text-sm font-medium text-[--text-muted] mb-1">Ti devono</h3>
          <p className={`text-2xl font-bold ${totalOwedToMe > 0 ? 'text-green-600' : 'text-[--text-muted]'}`}>
            {totalOwedToMe.toFixed(2)}€
          </p>
        </div>
      </div>

      {/* My Debts (Actionable) */}
      {myDebts.length > 0 && (
        <div className="bg-[--bg-card] rounded-xl border border-[--border-base] overflow-hidden">
          <div className="bg-red-50 px-4 py-3 border-b border-red-100">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-red-800">I tuoi debiti (Paga ora)</h3>
              <button
                onClick={handleSettleAllMine}
                disabled={loading}
                className="px-3 py-1.5 bg-neutral-900 text-white text-sm rounded-lg hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
                title="Reset: registra tutti i pagamenti necessari per azzerare i tuoi debiti"
              >
                Segna tutto come pagato
              </button>
            </div>
          </div>
          <div className="divide-y divide-[--border-base]">
            {myDebts.map((debt, idx) => (
              <div key={`my-debt-${idx}`} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
                    {getUserName(debt.to).charAt(0)}
                  </div>
                  <div>
                    <p className="text-[--text-base] font-medium">A {getUserName(debt.to)}</p>
                    <p className="text-sm text-[--text-muted]">Per pareggiare i conti</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-600 mb-1">{debt.amount.toFixed(2)}€</p>
                  <button
                    onClick={() => handleSettleUp(debt)}
                    disabled={loading}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                  >
                    Segna come pagato
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debts to Me */}
      {debtsToMe.length > 0 && (
        <div className="bg-[--bg-card] rounded-xl border border-[--border-base] overflow-hidden">
          <div className="bg-green-50 px-4 py-3 border-b border-green-100">
            <h3 className="font-semibold text-green-800">Chi ti deve soldi</h3>
          </div>
          <div className="divide-y divide-[--border-base]">
            {debtsToMe.map((debt, idx) => (
              <div key={`debt-to-me-${idx}`} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                    {getUserName(debt.from).charAt(0)}
                  </div>
                  <div>
                    <p className="text-[--text-base] font-medium">{getUserName(debt.from)}</p>
                    <p className="text-sm text-[--text-muted]">Ti deve</p>
                  </div>
                </div>
                <p className="text-lg font-bold text-green-600">{debt.amount.toFixed(2)}€</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Debts */}
      {otherDebts.length > 0 && (
        <div className="bg-[--bg-card] rounded-xl border border-[--border-base] overflow-hidden">
          <div className="bg-[--bg-subtle] px-4 py-3 border-b border-[--border-base]">
            <h3 className="font-semibold text-[--text-muted]">Altri debiti nel gruppo</h3>
          </div>
          <div className="divide-y divide-[--border-base]">
            {otherDebts.map((debt, idx) => (
              <div key={`other-debt-${idx}`} className="p-4 flex items-center justify-between opacity-75">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[--text-base]">{getUserName(debt.from)}</span>
                  <span className="text-[--text-muted]">→</span>
                  <span className="font-medium text-[--text-base]">{getUserName(debt.to)}</span>
                </div>
                <p className="font-medium text-[--text-muted]">{debt.amount.toFixed(2)}€</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {debts.length === 0 && (
        <div className="text-center py-8 bg-green-50 rounded-xl border border-green-100">
          <div className="text-3xl mb-2">✅</div>
          <h3 className="font-semibold text-green-800">Tutti i conti sono in pari!</h3>
          <p className="text-green-600 text-sm">Nessuno deve niente a nessuno.</p>
        </div>
      )}
    </div>
  )
}

export default ExpenseSettlement

