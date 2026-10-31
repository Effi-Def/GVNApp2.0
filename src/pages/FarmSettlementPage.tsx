import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { useAppStore } from '../stores/AppStore'
import { useFarmContext } from '../contexts/FarmContext'
import { farmService, paymentService } from '../services/firestore'
import type { Event, Expense, FarmMembership, PaymentTransaction } from '../types'
import ExpenseSettlement from '../components/ExpenseSettlement'

export default function FarmSettlementPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { activeFarmId, activeFarm } = useFarmContext()

  const events = useAppStore(s => (s as any).events) as Event[]
  const expenses = useAppStore(s => (s as any).expenses) as Expense[]
  const farmIds = useAppStore(s => (s as any).farmIds) as string[]

  const [payments, setPayments] = useState<PaymentTransaction[]>([])
  const [members, setMembers] = useState<FarmMembership[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id || !activeFarmId) return

    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const [allPayments, m] = await Promise.all([
          paymentService.getAll().catch(() => []),
          farmService.listMembers(activeFarmId).catch(() => []),
        ])
        if (!alive) return

        const farmEventIds = new Set((events || []).map(e => e.id))

        // Payments scoping strategy:
        // - Prefer scoped payments written with farmId
        // - Include event-scoped payments for events in this farm
        // - Include legacy farm-level payments (no farmId/eventId) ONLY if user has a single farm
        const isSingleFarmUser = Array.isArray(farmIds) && farmIds.length <= 1
        const scoped = (allPayments || []).filter(p => {
          const anyP: any = p
          const pFarmId = typeof anyP?.farmId === 'string' ? anyP.farmId : undefined
          const pEventId = typeof anyP?.eventId === 'string' ? anyP.eventId : undefined

          if (pFarmId && pFarmId === activeFarmId) return true
          if (pEventId && farmEventIds.has(pEventId)) return true
          if (!pFarmId && !pEventId && isSingleFarmUser) return true
          return false
        })

        setPayments(scoped)
        setMembers(m)
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [user?.id, activeFarmId, events, farmIds])

  const userNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const m of members || []) {
      if (!m?.userId) continue
      if (m.displayName && m.displayName.trim().length > 0) map[m.userId] = m.displayName
    }
    return map
  }, [members])

  if (!activeFarmId || !activeFarm) {
    return (
      <div className="pt-16 w-full">
        <div className="rounded-3xl border border-[--border-base] bg-[--bg-card] p-6">
          <div className="text-lg font-semibold">Nessuna fattoria attiva</div>
          <div className="mt-1 text-sm text-[--text-muted]">Seleziona una fattoria per vedere i conti.</div>
          <button className="mt-4 px-4 py-2 rounded-xl bg-[--text-base] text-[--bg-card]" onClick={() => navigate('/')}>Torna alla Home</button>
        </div>
      </div>
    )
  }

  if (!user?.id) {
    return null
  }

  return (
    <div className="pt-16 w-full">
      <div className="rounded-3xl border border-[--border-base] bg-[--bg-card]/80 backdrop-blur p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <button
            className="px-3 py-2 rounded-xl bg-[--bg-raised] text-[--text-base] hover:bg-neutral-200"
            onClick={() => navigate('/farm')}
          >
            ← Fattoria
          </button>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-[--text-muted]">Chi deve a chi</div>
            <div className="text-xs text-[--text-muted]">{activeFarm.name || 'Fattoria'}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-2xl font-semibold text-[--text-base]">Chi deve a chi</div>
          <div className="mt-1 text-sm text-[--text-muted]">
            Riassunto di tutte le spese della fattoria, ottimizzato per il minimo numero di scambi.
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="rounded-2xl border border-[--border-base] bg-[--bg-card] p-4 text-sm text-[--text-muted]">Caricamento…</div>
          ) : (
            <ExpenseSettlement
              expenses={expenses || []}
              payments={payments || []}
              events={events || []}
              currentUserId={user.id}
              userNameById={userNameById}
              scope={{ farmId: activeFarmId }}
              onPaymentRecorded={async () => {
                const all = await paymentService.getAll().catch(() => [])
                const farmEventIds = new Set((events || []).map(e => e.id))
                const isSingleFarmUser = Array.isArray(farmIds) && farmIds.length <= 1
                setPayments(
                  (all || []).filter(p => {
                    const anyP: any = p
                    const pFarmId = typeof anyP?.farmId === 'string' ? anyP.farmId : undefined
                    const pEventId = typeof anyP?.eventId === 'string' ? anyP.eventId : undefined
                    if (pFarmId && pFarmId === activeFarmId) return true
                    if (pEventId && farmEventIds.has(pEventId)) return true
                    if (!pFarmId && !pEventId && isSingleFarmUser) return true
                    return false
                  })
                )
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

