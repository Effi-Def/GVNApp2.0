import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '../stores/AppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { expenseService, pollService, listService, eventService } from '../services/firestore'
import { Event, Expense, Poll, ShoppingList } from '../types'

const EventSummary = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { events, updateEvent } = useAppStore()
  const { user } = useAuthStore()
  const [event, setEvent] = useState<Event | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Ensure we start at the top when opening the summary
    window.scrollTo({ top: 0, behavior: 'auto' })
    const load = async () => {
      try {
        setLoading(true)
        let ev = events.find(e => e.id === id) || null
        if (!ev && id) {
          const all = await eventService.getAll()
          ev = all.find(e => e.id === id) || null
        }
        setEvent(ev)

        // Filter related data
        const [allExpenses, allPolls, allLists] = await Promise.all([
          expenseService.getAll(),
          pollService.getAll(),
          listService.getAll()
        ])
        setExpenses(allExpenses.filter(e => e.eventId === id))
        setPolls(allPolls.filter(p => p.eventId === id))
        setLists(allLists.filter(l => l.eventId === id))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, events])

  const participants = event?.participants || []

  // Stato partecipazione utente corrente
  const currentUserId = user?.id || user?.email || ''
  const currentUserName = user?.displayName || user?.email || 'Utente'
  const myParticipation = participants.find(p => p.userId === currentUserId)
  const myStatus: 'yes' | 'no' | 'maybe' | 'none' = (myParticipation?.status as any) || 'none'

  const handleParticipation = async (status: 'yes' | 'no' | 'maybe') => {
    if (!event || !currentUserId) return
    try {
      await eventService.updateParticipation(event.id, currentUserId, currentUserName, status)

      // Aggiorna localmente lo stato evento e lo store globale
      const updatedParticipants = (() => {
        const arr = [...(event.participants || [])]
        const idx = arr.findIndex(p => p.userId === currentUserId)
        if (idx >= 0) {
          arr[idx] = { ...arr[idx], status, respondedAt: new Date() }
        } else {
          arr.push({ userId: currentUserId, name: currentUserName, status, respondedAt: new Date() })
        }
        return arr
      })()

      const updated = { ...event, participants: updatedParticipants, updatedAt: new Date() }
      setEvent(updated)
      updateEvent(event.id, { participants: updatedParticipants, updatedAt: new Date() })
    } catch (err) {
      console.error('❌ Error updating participation from summary:', err)
      alert('Errore durante l\'aggiornamento della partecipazione')
    }
  }

  const balances = useMemo(() => {
    if (!event) return [] as { userId: string; name: string; balance: number }[]
    const users = new Map<string, { userId: string; name: string; balance: number }>()
    for (const p of participants) users.set(p.userId, { userId: p.userId, name: p.name, balance: 0 })

    for (const exp of expenses) {
      const payer = users.get(exp.paidBy)
      if (payer) payer.balance += exp.amount
      for (const pp of exp.participants) {
        const u = users.get(pp.userId)
        if (u) u.balance -= pp.amount
      }
    }
    return Array.from(users.values())
  }, [event, participants, expenses])

  // Debts for current user: positive means others owe me, negative means I owe
  const userId = user?.id || user?.email || ''
  const myDebts = useMemo(() => {
    if (!event || !userId) return [] as { counterpartyId: string; counterpartyName: string; amount: number }[]
    const nameById = new Map(participants.map(p => [p.userId, p.name] as const))
    const ledger = new Map<string, number>()
    for (const exp of expenses) {
      if (exp.paidBy === userId) {
        // Others owe me their shares
        for (const pp of exp.participants) {
          if (pp.userId !== userId) {
            ledger.set(pp.userId, (ledger.get(pp.userId) || 0) + pp.amount)
          }
        }
      }
      // If I am participant and not payer, I owe my share to the payer
      const mine = exp.participants.find(pp => pp.userId === userId)
      if (mine && exp.paidBy !== userId) {
        ledger.set(exp.paidBy, (ledger.get(exp.paidBy) || 0) - mine.amount)
      }
    }
    return Array.from(ledger.entries()).map(([counterpartyId, amount]) => ({
      counterpartyId,
      counterpartyName: nameById.get(counterpartyId) || counterpartyId,
      amount
    })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  }, [event, expenses, participants, userId])

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">Caricamento...</div>
    )
  }

  if (!event) {
    return (
      <div className="p-6 max-w-4xl mx-auto">Evento non trovato</div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">{event.title} <span>🐷</span></h1>
        <button onClick={() => navigate(-1)} className="text-sm text-gray-600 hover:text-gray-800">← Indietro</button>
      </div>

      {/* Primary event info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm text-neutral-600 flex items-center gap-2">
              <span>📅</span>
              <span>
                {new Date(event.date).toLocaleDateString('it-IT')} {event.time && `alle ${event.time}`}
                {event.endDate && ` — ${new Date(event.endDate).toLocaleDateString('it-IT')}`}
              </span>
            </div>
            <div className="text-sm text-neutral-600 flex items-center gap-2">
              <span>📍</span>
              <span>{event.location}</span>
            </div>
          </div>
        </div>
        {event.description && (
          <p className="mt-3 text-sm text-neutral-700 whitespace-pre-line">{event.description}</p>
        )}
      </div>

      {/* Participants */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-3">Partecipanti</h2>
        <div className="flex flex-wrap gap-2">
          {participants.map(p => (
            <span key={p.userId} className="px-2 py-1 text-sm rounded bg-gray-100 text-gray-700">{p.name} ({p.status})</span>
          ))}
        </div>
        {/* Controlli partecipazione utente corrente */}
        {currentUserId && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-gray-700">La tua risposta:</span>
            <button
              onClick={() => handleParticipation('yes')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                myStatus === 'yes' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-green-100'
              }`}
            >
              ✓ Partecipo
            </button>
            <button
              onClick={() => handleParticipation('maybe')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                myStatus === 'maybe' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-yellow-100'
              }`}
            >
              ? Forse
            </button>
            <button
              onClick={() => handleParticipation('no')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                myStatus === 'no' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-red-100'
              }`}
            >
              ✗ Non partecipo
            </button>
          </div>
        )}
      </div>

      {/* Balances (summary) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-1">Saldi evento</h2>
        <p className="text-xs text-gray-500 mb-3">Riepilogo di quanto ciascuno ha a credito/debito nel totale dell'evento.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {balances.map(b => (
            <div key={b.userId} className="flex items-center justify-between px-3 py-2 rounded border">
              <span>{b.name}</span>
              <span className={`${b.balance >= 0 ? 'text-green-600' : 'text-red-600'} font-semibold`}>
                {b.balance >= 0 ? '+' : ''}{b.balance.toFixed(2)}€
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* My debts/credits vs people in this event */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-1">La tua situazione</h2>
        <p className="text-xs text-gray-500 mb-3">Dettaglio verso ogni persona: importi positivi = devono darti, negativi = devi tu.</p>
        {(!userId || myDebts.length === 0) ? (
          <p className="text-sm text-gray-600">Nessun debito/credito specifico per te in questo evento.</p>
        ) : (
          <div className="space-y-2">
            {myDebts.map(d => (
              <div key={d.counterpartyId} className="flex items-center justify-between px-3 py-2 rounded border">
                <div className="text-sm text-gray-800">{d.counterpartyName}</div>
                <div className={`${d.amount >= 0 ? 'text-green-600' : 'text-red-600'} font-semibold`}>
                  {d.amount >= 0 ? 'Deve darti ' : 'Devi a lui/lei '}
                  {Math.abs(d.amount).toFixed(2)}€
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expenses */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-3">Spese</h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-gray-600">Nessuna spesa</p>
        ) : (
          <div className="space-y-2">
            {expenses.map(e => (
              <div key={e.id} className="flex items-center justify-between px-3 py-2 rounded border">
                <div className="truncate">
                  <div className="font-medium text-gray-900 truncate">{e.title}</div>
                  <div className="text-xs text-gray-500">Pagata da {e.paidBy}</div>
                </div>
                <div className="text-gray-900 font-semibold">{e.amount.toFixed(2)}€</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Polls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-3">Sondaggi</h2>
        {polls.length === 0 ? (
          <p className="text-sm text-gray-600">Nessun sondaggio</p>
        ) : (
          <ul className="list-disc list-inside text-sm text-gray-800">
            {polls.map(p => (
              <li key={p.id}>
                {p.title} • {p.options.length} opzioni • {p.votes.length} voti
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Lists */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-3">Liste</h2>
        {lists.length === 0 ? (
          <p className="text-sm text-gray-600">Nessuna lista</p>
        ) : (
          <ul className="list-disc list-inside text-sm text-gray-800">
            {lists.map(l => (
              <li key={l.id}>
                {l.title} • {l.items.filter(i => i.completed).length}/{l.items.length} completati
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default EventSummary
