import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const EventMap = lazy(() => import('../components/Map/EventMap'))
import { useAppStore } from '../stores/AppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useActiveFarmStore } from '../stores/useActiveFarmStore'
import { eventService, expenseService, farmService, listService, pollService } from '../services/firestore'
import { roundTo2 } from '../services/firestoreMappers'
import { Event, Expense, FarmMembership, Poll, ShoppingList, EventParticipant, EventParticipation } from '../types'
import { getUserKeys, getUserEventParticipation } from '../utils/events'
import { formatEuro, formatEuroSigned, getExpenseShares } from '../utils/expenseUtils'
import ExpenseForm from '../components/ExpenseForm'
import PollForm from '../components/PollForm'

const EventSummary = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { events, expenses: storeExpenses, polls: storePolls, lists: storeLists, addExpense, addPoll, updateEvent } = useAppStore()
  const { user } = useAuthStore()
  const [event, setEvent] = useState<Event | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [loading, setLoading] = useState(true)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const showToast = (msg: string, type: 'ok' | 'err' = 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }
  const [tooltipDay, setTooltipDay] = useState<string | null>(null)
  const [showBalances, setShowBalances] = useState(false)
  const [showMyDebts, setShowMyDebts] = useState(false)
  const [showParticipantsOverlay, setShowParticipantsOverlay] = useState(false)

  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showPollForm, setShowPollForm] = useState(false)
  const [submittingExpense, setSubmittingExpense] = useState(false)
  const [submittingPoll, setSubmittingPoll] = useState(false)
  const activeFarmId = useActiveFarmStore(s => s.activeFarmId)
  const [farmMembers, setFarmMembers] = useState<FarmMembership[]>([])
  const [actionLoading, setActionLoading] = useState<'vote' | 'finalize' | null>(null)
  const [submittingParticipation, setSubmittingParticipation] = useState(false)
  const [participationError, setParticipationError] = useState<string | null>(null)

  useEffect(() => {
    // Ensure we start at the top when opening the summary
    window.scrollTo({ top: 0, behavior: 'auto' })
    const load = async () => {
      try {
        setLoading(true)
        let ev = events.find(e => e.id === id) || null
        if (!ev && id) {
          ev = await eventService.getById(id)
        }
        setEvent(ev)

        // Related data comes from the already scoped AppStore when possible.
        setExpenses(((storeExpenses as Expense[]) || []).filter(e => e.eventId === id))
        setPolls(((storePolls as Poll[]) || []).filter(p => p.eventId === id))
        const fromStore = (((storeLists as ShoppingList[]) || []).filter(l => l.eventId === id))
        if (fromStore.length) {
          setLists(fromStore)
        } else {
          // Fallback for deep links: fetch only lists for this event id.
          const allLists = id ? await listService.getByEventId(id).catch(() => [] as ShoppingList[]) : [] as ShoppingList[]
          setLists(allLists.filter(l => l.eventId === id))
        }
      } catch (e: any) {
        console.error('❌ Error loading EventSummary data:', e)
        setFatalError('Impossibile caricare il riassunto dell\'evento. Riprova più tardi.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, events, storeExpenses, storePolls, storeLists])

  const participants = event?.participants || []
  const participationStats = useMemo(() => {
    const confirmed = participants.filter(p => p.status === 'yes')
    const maybe = participants.filter(p => p.status === 'maybe')
    const declined = participants.filter(p => p.status === 'no')
    const total = participants.length
    const progress = total ? Math.round((confirmed.length / total) * 100) : 0
    return { confirmed, maybe, declined, total, progress }
  }, [participants])

  const hypeMessage = useMemo(() => {
    const { confirmed, total } = participationStats
    if (total === 0) return 'Nessuna risposta ancora.'
    if (confirmed.length === total) return 'Tutti hanno confermato.'
    const pending = total - confirmed.length
    return `${confirmed.length} ${confirmed.length === 1 ? 'confermato' : 'confermati'} su ${total} · ${pending} in attesa`
  }, [participationStats])

  const stageLabel = useMemo(() => {
    const { confirmed, total } = participationStats
    if (total === 0) return 'Nessuna risposta'
    return `${confirmed.length} / ${total} ${confirmed.length === 1 ? 'confermato' : 'confermati'}`
  }, [participationStats])
  const startOfDay = (d: Date) => { const nd = new Date(d); nd.setHours(0,0,0,0); return nd }
  const dateKey = (d: Date) => {
    const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`
  }
  const isMultiDay = !!(event?.endDate && startOfDay(new Date(event.endDate)).getTime() > startOfDay(new Date(event.date)).getTime())
  const dayKeys = useMemo(() => {
    if (!event) return [] as string[]
    const s = startOfDay(new Date(event.date)); const e = startOfDay(new Date(event.endDate || event.date))
    const arr: string[] = []
    for (let d = new Date(s); d.getTime() <= e.getTime(); d.setDate(d.getDate()+1)) arr.push(dateKey(d))
    return arr
  }, [event?.date, event?.endDate])

  // Stato partecipazione utente corrente
  const currentUserId = user?.id || user?.email || ''
  const currentUserName = user?.displayName || user?.email || 'Utente'
  const meKeys = useMemo(() => getUserKeys(user), [user?.id, user?.email])
  const myP = useMemo(() => (event ? getUserEventParticipation(event, meKeys) : { status: 'none', accessLevel: 'none' as const }), [event, meKeys])
  const myStatus = myP.status
  const canChat = !!event && (meKeys.includes(event.createdBy) || myStatus === 'yes')
  const [myDays, setMyDays] = useState<Set<string>>(new Set())

  // Planning: proposed dates
  const proposedDates = useMemo(() => {
    const raw = event?.proposedDates
    return Array.isArray(raw) ? raw.filter((x: string) => x.trim()) : []
  }, [event])
  const dateVotes = useMemo(() => {
    const raw = event?.dateVotes
    return raw && typeof raw === 'object' ? raw : {} as Record<string, string>
  }, [event])
  const myDateVote: string | undefined = event?.dateVotes?.[currentUserId]
  const voteCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const d of proposedDates) counts[d] = 0
    for (const v of Object.values(dateVotes)) {
      if (typeof v !== 'string' || counts[v] == null) continue
      counts[v] += 1
    }
    return counts
  }, [proposedDates, dateVotes])
  const isPlanning = useMemo(() => {
    if (event?.status === 'planning') return true
    if (event?.dateFinalized === false) return true
    if (proposedDates.length > 0 && !event?.selectedDateKey) return true
    return false
  }, [event, proposedDates.length])
  const pendingMembers = useMemo(() => {
    const responded = new Set((event?.participants || []).map(p => p.userId).filter(Boolean))
    return farmMembers.filter(m => m?.userId && !responded.has(m.userId))
  }, [farmMembers, event?.participants])

  useEffect(() => {
    if (!event || !currentUserId) return
    const mine = event.participants?.find(p => p.userId === currentUserId)
    if (mine?.days) {
      setMyDays(new Set(Object.keys(mine.days).filter(k => mine.days?.[k])))
    } else if (isMultiDay && myStatus === 'yes' && dayKeys.length > 0) {
      // Default: if confirmed for a multi-day event but no per-day selection yet, assume all days selected locally
      setMyDays(new Set(dayKeys))
    } else {
      setMyDays(new Set())
    }
  }, [event, currentUserId, myStatus, isMultiDay, dayKeys.join('|')])

  useEffect(() => {
    if (!activeFarmId) { setFarmMembers([]); return }
    let alive = true
    farmService.listMembers(activeFarmId)
      .then(m => { if (alive) setFarmMembers(Array.isArray(m) ? m : []) })
      .catch(() => { if (alive) setFarmMembers([]) })
    return () => { alive = false }
  }, [activeFarmId])

  const voteDate = async (dateKey: string) => {
    if (!id || !currentUserId) return
    setActionLoading('vote')
    try {
      await eventService.voteOnProposedDate(id, currentUserId, dateKey)
      const remote = await eventService.getById(id)
      if (remote) { setEvent(remote); updateEvent(id, remote) }
    } catch (err) { console.error('voteDate error:', err) }
    finally { setActionLoading(null) }
  }

  const finalizeDate = async (dateKey: string) => {
    if (!id || !currentUserId || event?.createdBy !== currentUserId) return
    setActionLoading('finalize')
    try {
      await eventService.finalizeProposedDate(id, dateKey)
      const remote = await eventService.getById(id)
      if (remote) { setEvent(remote); updateEvent(id, remote) }
    } catch (err) { console.error('finalizeDate error:', err) }
    finally { setActionLoading(null) }
  }

  const updatePresence = async (newSet: Set<string>) => {
    if (!event || !currentUserId) return
    if (myStatus !== 'yes') {
      showToast('Conferma la partecipazione (✅) per selezionare i giorni di presenza')
      return
    }
    try {
      await eventService.updateDailyPresence(event.id, currentUserId, currentUserName, Array.from(newSet))
      // update local state
      const updatedParticipants: EventParticipant[] = (() => {
        const arr = [...(event.participants || [])]
        const idx = arr.findIndex(p => p.userId === currentUserId)
        const days: Record<string, boolean> = {}
        Array.from(newSet).forEach(k => { days[k] = true })
        if (idx >= 0) arr[idx] = { ...arr[idx], days }
        return arr
      })()
      const updated = { ...event, participants: updatedParticipants, updatedAt: new Date() }
      setEvent(updated)
      updateEvent(event.id, { participants: updatedParticipants, updatedAt: new Date() })
    } catch (e) {
      console.error('❌ Error updating daily presence:', e)
      showToast('Errore durante il salvataggio dei giorni di presenza')
    }
  }

  const toggleDay = (k: string) => {
    const ns = new Set(myDays)
    if (ns.has(k)) ns.delete(k); else ns.add(k)
    setMyDays(ns)
    updatePresence(ns)
  }

  const handleParticipation = async (status: 'yes' | 'no' | 'maybe') => {
    if (!event || !currentUserId || submittingParticipation) return
    setSubmittingParticipation(true)
    setParticipationError(null)
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

      const updatedParticipation = (() => {
        const base = (event.participation && typeof event.participation === 'object') ? { ...event.participation } : {}
        base[currentUserId] = {
          status,
          accessLevel: status === 'no' ? 'readonly' : 'full',
          role: event.createdBy === currentUserId ? 'owner' : 'member',
          respondedAt: new Date(),
        }
        return base
      })()

      const updated = { ...event, participants: updatedParticipants, participation: updatedParticipation as Record<string, EventParticipation>, updatedAt: new Date() }
      setEvent(updated)
      updateEvent(event.id, { participants: updatedParticipants, participation: updatedParticipation as Record<string, EventParticipation>, updatedAt: new Date() })
    } catch (err) {
      console.error('❌ Error updating participation from summary:', err)
      setParticipationError('Impossibile aggiornare la partecipazione. Riprova.')
    } finally {
      setSubmittingParticipation(false)
    }
  }

  const balances = useMemo(() => {
    if (!event) return [] as { userId: string; name: string; balance: number }[]
    const users = new Map<string, { userId: string; name: string; balance: number }>()
    for (const p of participants) users.set(p.userId, { userId: p.userId, name: p.name, balance: 0 })

    for (const exp of expenses) {
      const payer = users.get(exp.paidBy)
      if (payer) payer.balance = roundTo2(payer.balance + exp.amount)
      for (const { userId, share } of getExpenseShares(exp)) {
        const u = users.get(userId)
        if (u) u.balance = roundTo2(u.balance - share)
      }
    }
    return Array.from(users.values())
  }, [event, participants, expenses])

  // Debts for current user: positive means others owe me, negative means I owe
  const myDebts = useMemo(() => {
    if (!event || !currentUserId) return [] as { counterpartyId: string; counterpartyName: string; amount: number }[]
    const nameById = new Map(participants.map(p => [p.userId, p.name] as const))
    const ledger = new Map<string, number>()
    for (const exp of expenses) {
      const shares = getExpenseShares(exp)
      if (exp.paidBy === currentUserId) {
        // Others owe me their shares
        for (const { userId, share } of shares) {
          if (userId !== currentUserId) {
            ledger.set(userId, roundTo2((ledger.get(userId) || 0) + share))
          }
        }
      }
      // If I am participant and not payer, I owe my share to the payer
      const mine = shares.find(s => s.userId === currentUserId)
      if (mine && exp.paidBy !== currentUserId) {
        ledger.set(exp.paidBy, roundTo2((ledger.get(exp.paidBy) || 0) - mine.share))
      }
    }
    return Array.from(ledger.entries()).map(([counterpartyId, amount]) => ({
      counterpartyId,
      counterpartyName: nameById.get(counterpartyId) || counterpartyId,
      amount
    })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  }, [event, expenses, participants, currentUserId])

  if (loading) {
    return (
      <div className="pt-16 px-6 pb-6 max-w-4xl mx-auto">Caricamento...</div>
    )
  }

  if (!event) {
    return (
      <div className="pt-16 px-6 pb-6 max-w-4xl mx-auto">Evento non trovato</div>
    )
  }

  if (fatalError) {
    return (
      <div className="pt-16 px-4 sm:px-6 pb-4 sm:pb-6 max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 p-4 rounded-lg">
          {fatalError}
        </div>
        <div className="mt-4">
          <button onClick={() => navigate(-1)} className="text-sm text-[--text-muted] hover:text-[--text-base]">← Indietro</button>
        </div>
      </div>
    )
  }

  const handleCreateExpense = async (expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!event?.id) return
    setSubmittingExpense(true)
    try {
      const created = await expenseService.create({ ...expenseData, eventId: event.id })
      addExpense(created)
      setExpenses(prev => [created, ...prev])
      try {
        const now = new Date()
        setEvent(prev => (prev ? { ...prev, updatedAt: now } : prev))
        updateEvent(event.id, { updatedAt: now })
      } catch {}
    } finally {
      setSubmittingExpense(false)
      setShowExpenseForm(false)
    }
  }

  const handleCreatePoll = async (pollData: Omit<Poll, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!event?.id) return
    setSubmittingPoll(true)
    try {
      const { votes: _votes, id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = pollData as any
      const created = await pollService.create({
        ...rest,
        eventId: event.id,
        createdBy: (rest.createdBy as string) || (user?.id || ''),
        isActive: typeof rest.isActive === 'boolean' ? rest.isActive : true,
      })
      addPoll(created)
      setPolls(prev => [created, ...prev])
      try {
        const now = new Date()
        setEvent(prev => (prev ? { ...prev, updatedAt: now } : prev))
        updateEvent(event.id, { updatedAt: now })
      } catch {}
    } finally {
      setSubmittingPoll(false)
      setShowPollForm(false)
    }
  }

  return (
    <div className="pt-16 pb-4 px-4 sm:px-6 max-w-5xl mx-auto space-y-6">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[--text-base] flex items-center gap-2">{event.title} <span>🐷</span></h1>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const shareUrl = `${window.location.origin}/share/e/${event.id}`
              const shareData = {
                title: `Invito: ${event.title}`,
                text: `${event.title} • ${new Date(event.date).toLocaleDateString('it-IT')} ${event.time ? 'alle ' + event.time : ''} • ${event.location}`,
                url: shareUrl
              }
              try {
                if ((navigator as any).share) {
                  await (navigator as any).share(shareData)
                } else if (navigator.clipboard) {
                  await navigator.clipboard.writeText(shareUrl)
                  showToast('Link copiato negli appunti 📋', 'ok')
                } else {
                  prompt('Copia il link', shareUrl)
                }
              } catch (e) {
                console.error('Share failed:', e)
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-[--border-base] text-[--text-base] hover:bg-[--bg-subtle] text-sm"
            title="Condividi evento"
          >
            Condividi
          </button>
          <button onClick={() => navigate(-1)} className="text-sm text-[--text-muted] hover:text-[--text-base]">← Indietro</button>
        </div>
      </div>

      {/* Primary event info */}
      <div className="bg-[--bg-card] rounded-xl border border-[--border-base] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm text-[--text-muted] flex items-center gap-2">
              <span>📅</span>
              <span>
                {new Date(event.date).toLocaleDateString('it-IT')} {event.time && `alle ${event.time}`}
                {event.endDate && ` — ${new Date(event.endDate).toLocaleDateString('it-IT')}`}
              </span>
            </div>
            <div className="text-sm text-[--text-muted] flex items-center gap-2">
              <span>📍</span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline hover:text-green-600 transition-colors"
              >
                {event.location}
              </a>
            </div>
          </div>
        </div>
        {event.description && (
          <p className="mt-3 text-sm text-[--text-muted] whitespace-pre-line">{event.description}</p>
        )}

        {/* Mappa OpenStreetMap — visible solo quando lat/lon sono stati salvati */}
        {event.locationGeo && (
          <div className="mt-4">
            <Suspense fallback={
              <div className="h-48 w-full rounded-xl bg-[--bg-raised] animate-pulse flex items-center justify-center text-[--text-muted] text-sm">
                Caricamento mappa…
              </div>
            }>
              <EventMap
                lat={event.locationGeo.lat}
                lon={event.locationGeo.lon}
                label={event.location}
              />
            </Suspense>
          </div>
        )}

        {/* Per-day selection for multi-day events */}
        {isMultiDay && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-[--text-base] mb-2">La tua presenza per giorno</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-1.5">
              {dayKeys.map(k => {
                const d = new Date(k)
                const label = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(d)
                const selected = myDays.has(k)
                return (
                  <button
                    key={k}
                    onClick={() => toggleDay(k)}
                    className={`px-2 py-1 text-[11px] rounded border transition-colors ${selected ? 'bg-green-50 border-green-300 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-[--bg-card] border-[--border-base] text-[--text-muted] hover:bg-[--bg-subtle]'}`}
                    title={`Presenza il ${label}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Planning: proposed date voting */}
      {proposedDates.length > 0 && (
        <div className="bg-[--bg-card] rounded-xl border border-[--border-base] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{isPlanning ? '📅 Scegliamo una data' : '📅 Date proposte'}</h2>
              <p className="text-xs text-[--text-muted]">
                {isPlanning
                  ? (event?.createdBy === currentUserId ? "Finalizza la data quando tutti hanno votato." : "L'organizzatore finalizzerà la data.")
                  : 'Vota la data che preferisci.'}
              </p>
            </div>
            {actionLoading === 'finalize' && <span className="text-xs text-[--text-muted] animate-pulse">Finalizzo…</span>}
            {actionLoading === 'vote' && <span className="text-xs text-[--text-muted] animate-pulse">Aggiorno…</span>}
          </div>
          <div className="mt-3 space-y-2">
            {proposedDates.map(d => {
              const selected = myDateVote === d
              const n = voteCounts[d] || 0
              const canFinalize = isPlanning && event?.createdBy === currentUserId
              return (
                <div key={d} className={`flex items-center gap-2 p-3 rounded-xl border transition ${selected ? 'bg-primary-600 border-primary-600 text-white' : 'bg-neutral-50 border-[--border-base]'}`}>
                  <button
                    type="button"
                    className={`flex-1 text-left text-sm font-medium ${selected ? 'text-white' : 'text-[--text-base]'}`}
                    disabled={actionLoading !== null}
                    onClick={() => voteDate(d)}
                  >
                    {d} · {n} voto{n === 1 ? '' : 'i'}
                  </button>
                  {canFinalize && (
                    <button
                      type="button"
                      className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition ${selected ? 'bg-white text-primary-700 border-white' : 'bg-[--bg-card] text-[--text-muted] border-[--border-base] hover:bg-[--bg-raised]'}`}
                      disabled={actionLoading !== null}
                      onClick={() => finalizeDate(d)}
                    >
                      Finalizza
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Partecipazione: solo controlli, lista nascosta */}
      <div className="bg-[--bg-card] rounded-xl border border-[--border-base] p-4">
        <h2 className="text-sm font-semibold text-[--text-muted] mb-3">La tua risposta</h2>
        {currentUserId ? (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => handleParticipation('yes')}
                disabled={submittingParticipation}
                className={`flex-1 py-2 text-sm rounded-xl border font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  myStatus === 'yes' ? 'bg-green-600 text-white border-green-600' : 'bg-[--bg-card] text-[--text-muted] border-[--border-base] hover:bg-green-50 dark:hover:bg-green-900/20'
                }`}
              >
                {submittingParticipation && myStatus !== 'yes' ? '…' : '✓ Sì'}
              </button>
              <button
                onClick={() => handleParticipation('maybe')}
                disabled={submittingParticipation}
                className={`flex-1 py-2 text-sm rounded-xl border font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  myStatus === 'maybe' ? 'bg-amber-500 text-white border-amber-500' : 'bg-[--bg-card] text-[--text-muted] border-[--border-base] hover:bg-amber-50 dark:hover:bg-amber-900/20'
                }`}
              >
                {submittingParticipation && myStatus !== 'maybe' ? '…' : '~ Forse'}
              </button>
              <button
                onClick={() => handleParticipation('no')}
                disabled={submittingParticipation}
                className={`flex-1 py-2 text-sm rounded-xl border font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  myStatus === 'no' ? 'bg-neutral-700 text-white border-neutral-700' : 'bg-[--bg-card] text-[--text-muted] border-[--border-base] hover:bg-[--bg-raised]'
                }`}
              >
                {submittingParticipation && myStatus !== 'no' ? '…' : '✗ No'}
              </button>
            </div>
            {participationError && (
              <p className="mt-2 text-xs text-red-500">{participationError}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-[--text-muted]">Accedi per rispondere all'evento.</p>
        )}
        <button
          type="button"
          onClick={() => setShowParticipantsOverlay(true)}
          className="mt-3 w-full rounded-xl border border-[--border-base] bg-[--bg-subtle] hover:bg-[--bg-raised] transition px-3 py-3 text-left"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[--text-muted]">Partecipanti</span>
            <span className="text-xs text-[--text-muted]">{stageLabel} →</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-[--bg-raised] overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${participationStats.total === 0 ? 0 : Math.min(100, participationStats.progress)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-[--text-muted]">{hypeMessage}</p>
        </button>
      </div>

      {/* Chat call-to-action */}
      <div className="bg-[--bg-card] rounded-xl border border-[--border-base] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[--text-base]">💬 Chat evento</h2>
            <p className="text-xs text-[--text-muted] mt-0.5">
              {canChat ? 'Coordina il gruppo in tempo reale.' : 'Disponibile dopo aver confermato la partecipazione.'}
            </p>
          </div>
          <button
            onClick={() => { if (canChat) navigate(`/events/${event.id}/chat`) }}
            disabled={!canChat}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition ${
              canChat
                ? 'bg-neutral-900 text-white hover:bg-neutral-700'
                : 'bg-[--bg-raised] text-[--text-muted] cursor-not-allowed'
            }`}
          >Apri chat</button>
        </div>
      </div>

      {showParticipantsOverlay && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowParticipantsOverlay(false)}></div>
          <div className="relative w-full max-w-xl mx-4 bg-[--bg-card] rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[--text-base]">Partecipanti</h3>
                <p className="text-xs text-[--text-muted] mt-0.5">{stageLabel}</p>
              </div>
              <button onClick={() => setShowParticipantsOverlay(false)} className="text-[--text-muted] hover:text-[--text-base] text-sm">\u2715</button>
            </div>

            <div className="h-1.5 bg-[--bg-raised] rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${participationStats.total === 0 ? 0 : participationStats.progress}%` }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-[--border-base] bg-[--bg-subtle] p-3">
                <h4 className="text-xs font-semibold text-[--text-muted] mb-2">Confermati ({participationStats.confirmed.length})</h4>
                {participationStats.confirmed.length === 0 ? (
                  <p className="text-xs text-[--text-muted]">Nessuno ancora.</p>
                ) : (
                  <ul className="space-y-1 text-xs text-[--text-base]">
                    {participationStats.confirmed.map(p => (
                      <li key={p.userId} className="truncate">{p.name}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-[--border-base] bg-[--bg-subtle] p-3">
                <h4 className="text-xs font-semibold text-[--text-muted] mb-2">Forse ({participationStats.maybe.length})</h4>
                {participationStats.maybe.length === 0 ? (
                  <p className="text-xs text-[--text-muted]">Nessuno.</p>
                ) : (
                  <ul className="space-y-1 text-xs text-[--text-base]">
                    {participationStats.maybe.map(p => (
                      <li key={p.userId} className="truncate">{p.name}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-[--border-base] bg-[--bg-subtle] p-3">
                <h4 className="text-xs font-semibold text-[--text-muted] mb-2">Non partecipano ({participationStats.declined.length})</h4>
                {participationStats.declined.length === 0 ? (
                  <p className="text-xs text-[--text-muted]">Nessuno.</p>
                ) : (
                  <ul className="space-y-1 text-xs text-[--text-base]">
                    {participationStats.declined.map(p => (
                      <li key={p.userId} className="truncate">{p.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {pendingMembers.length > 0 && (
              <div className="rounded-xl border border-[--border-base] bg-[--bg-subtle] p-3">
                <h4 className="text-xs font-semibold text-[--text-muted] mb-2">In attesa di risposta ({pendingMembers.length})</h4>
                <div className="flex flex-wrap gap-1">
                  {pendingMembers.map(m => (
                    <span key={m.userId} className="text-xs bg-[--bg-card] border border-[--border-base] rounded-full px-2 py-0.5 text-[--text-muted]">
                      {m.displayName || m.userId}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setShowParticipantsOverlay(false)}
                className="px-3 py-1.5 rounded-lg border border-[--border-base] text-sm hover:bg-[--bg-subtle]"
              >Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {/* Balances (summary) - collapsible */}
      <div className="bg-[--bg-card] rounded-xl border border-[--border-base]">
        <button
          onClick={() => setShowBalances(v => !v)}
          className="w-full px-4 py-3 flex items-center justify-between"
        >
          <div>
            <h2 className="text-lg font-semibold">Saldi evento</h2>
            <p className="text-xs text-[--text-muted]">Riepilogo di quanto ciascuno ha a credito/debito.</p>
          </div>
          <span className="text-[--text-muted]">{showBalances ? '▾' : '▸'}</span>
        </button>
        {showBalances && (
          <div className="p-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {balances.map(b => (
                <div key={b.userId} className="flex items-center justify-between px-3 py-2 rounded border">
                  <span>{b.name}</span>
                  <span className={`${b.balance >= 0 ? 'text-green-600' : 'text-red-600'} font-semibold`}>
                    {formatEuroSigned(b.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* My debts/credits vs people in this event - collapsible */}
      <div className="bg-[--bg-card] rounded-xl border border-[--border-base]">
        <button onClick={() => setShowMyDebts(v => !v)} className="w-full px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">La tua situazione</h2>
            <p className="text-xs text-[--text-muted]">Importi positivi = ti devono dare, negativi = devi tu.</p>
          </div>
          <span className="text-[--text-muted]">{showMyDebts ? '▾' : '▸'}</span>
        </button>
        {showMyDebts && (
          <div className="p-4 pt-0">
            {(!currentUserId || myDebts.length === 0) ? (
              <p className="text-sm text-[--text-muted]">Nessun debito/credito specifico per te in questo evento.</p>
            ) : (
              <div className="space-y-2">
                {myDebts.map(d => (
                  <div key={d.counterpartyId} className="flex items-center justify-between px-3 py-2 rounded border">
                    <div className="text-sm text-[--text-base]">{d.counterpartyName}</div>
                    <div className={`${d.amount >= 0 ? 'text-green-600' : 'text-red-600'} font-semibold`}>
                      {d.amount >= 0 ? 'Deve darti ' : 'Devi a lui/lei '}
                      {formatEuro(Math.abs(d.amount))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Presence chart for multi-day events */}
      {isMultiDay && (
        <div className="bg-[--bg-card] rounded-xl border border-[--border-base] p-4">
          <h2 className="text-lg font-semibold mb-1">Presenze per giorno</h2>
          <p className="text-xs text-[--text-muted] mb-3">Asse Y = giorni, asse X = numero partecipanti presenti quel giorno.</p>
          {(() => {
            const counts = dayKeys.map(k => {
              const present = participants.filter(p => (p.days && p.days[k]) || (!p.days && p.status === 'yes'))
              return { key: k, count: present.length, users: present.map(p => p.name) }
            })
            const max = Math.max(1, ...counts.map(c => c.count))
            const [open, setOpen] = [tooltipDay, setTooltipDay] as const
            return (
              <div className="space-y-2">
                {counts.map(({ key, count, users }) => {
                  const d = new Date(key)
                  const label = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(d)
                  const leftPct = (count / max) * 100
                  const isOpen = open === key
                  return (
                    <div key={key} className="relative flex items-center gap-2">
                      <div className="w-28 shrink-0 text-xs text-[--text-muted]">{label}</div>
                      <div className="relative h-8 flex-1 border-b border-dashed border-[--border-base]">
                        <button
                          className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shadow"
                          style={{ left: `${leftPct}%` }}
                          onClick={() => setOpen(isOpen ? null : key)}
                          title={count === 1 ? '1 partecipante' : `${count} partecipanti`}
                        >
                          {count}
                        </button>
                        {isOpen && (
                          <div className="absolute z-20 mt-2 left-1/2 -translate-x-1/2 bg-[--bg-card] border border-[--border-base] rounded shadow p-2 text-xs min-w-[12rem] max-w-[80vw]">
                            <div className="font-medium text-[--text-base] mb-1">{label}</div>
                            {users.length === 0 ? (
                              <div className="text-[--text-muted]">Nessuno</div>
                            ) : (
                              <ul className="list-disc list-inside space-y-0.5 text-[--text-base]">
                                {users.map(u => (<li key={u}>{u}</li>))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Expenses */}
      <div className="bg-[--bg-card] rounded-xl border border-[--border-base] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Spese</h2>
          <button
            type="button"
            onClick={() => { if (event?.id) setShowExpenseForm(true) }}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-[--border-base] text-[--text-muted] hover:bg-[--bg-subtle]"
            title="Aggiungi spesa"
            aria-label="Aggiungi spesa"
          >
            +
          </button>
        </div>
        {expenses.length === 0 ? (
          <p className="text-sm text-[--text-muted]">Nessuna spesa</p>
        ) : (
          <div className="space-y-2">
            {expenses.map(e => (
              <div key={e.id} className="flex items-center justify-between px-3 py-2 rounded border">
                <div className="truncate">
                  <div className="font-medium text-[--text-base] truncate">{e.title}</div>
                  <div className="text-xs text-[--text-muted]">
                    Pagata da{' '}
                    {e.participants.find(p => p.userId === e.paidBy)?.name
                      || participants.find(p => p.userId === e.paidBy)?.name
                      || farmMembers.find(m => m.userId === e.paidBy)?.displayName
                      || (e.paidBy === user?.id ? (user?.displayName || 'Tu') : e.paidBy)}
                  </div>
                </div>
                <div className="text-[--text-base] font-semibold">{formatEuro(e.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Polls */}
      <div className="bg-[--bg-card] rounded-xl border border-[--border-base] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Sondaggi</h2>
          <button
            type="button"
            onClick={() => { if (event?.id) setShowPollForm(true) }}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-[--border-base] text-[--text-muted] hover:bg-[--bg-subtle]"
            title="Aggiungi sondaggio"
            aria-label="Aggiungi sondaggio"
          >
            +
          </button>
        </div>
        {polls.length === 0 ? (
          <p className="text-sm text-[--text-muted]">Nessun sondaggio</p>
        ) : (
          <div className="space-y-2">
            {polls.map(p => {
              const now = new Date()
              const expired = p.votingEndsAt ? p.votingEndsAt < now : false
              const active = p.isActive && !expired
              const totalVotes = p.votes?.length ?? 0
              return (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg border border-[--border-base] hover:bg-[--bg-subtle] transition gap-3"
                  onClick={() => navigate('/polls', { state: { eventId: event.id } })}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[--text-base] truncate">{p.title}</div>
                    <div className="text-xs text-[--text-muted] mt-0.5">{p.options.length} opzioni · {totalVotes} vot{totalVotes === 1 ? 'o' : 'i'}</div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    active ? 'bg-green-50 text-green-700' : 'bg-[--bg-raised] text-[--text-muted]'
                  }`}>
                    {active ? 'Aperto' : 'Chiuso'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Lists */}
      <div className="bg-[--bg-card] rounded-xl border border-[--border-base] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Liste</h2>
          <button
            type="button"
            onClick={() => { if (event?.id) navigate('/lists', { state: { openForm: true, eventId: event.id } }) }}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-[--border-base] text-[--text-muted] hover:bg-[--bg-subtle]"
            title="Aggiungi lista"
            aria-label="Aggiungi lista"
          >
            +
          </button>
        </div>
        {lists.length === 0 ? (
          <p className="text-sm text-[--text-muted]">Nessuna lista</p>
        ) : (
          <div className="space-y-2">
            {lists.map(l => {
              const typeIcon = l.type === 'transport' ? '🚗' : l.type === 'lodging' ? '🛏️' : l.type === 'todo' ? '✅' : '🛒'
              const done = l.items.filter(i => i.completed).length
              const total = l.items.length
              const pct = total ? Math.round((done / total) * 100) : 0
              return (
                <button
                  key={l.id}
                  type="button"
                  className="w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg border border-[--border-base] hover:bg-[--bg-subtle] transition gap-3"
                  onClick={() => navigate('/lists', { state: { eventId: event.id } })}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{typeIcon}</span>
                      <span className="font-medium text-[--text-base] truncate">{l.title}</span>
                    </div>
                    {total > 0 && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[--bg-raised] rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-[--text-muted] shrink-0">{done}/{total}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-[--text-muted] shrink-0">›</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {showExpenseForm && event?.id ? (
        <ExpenseForm
          defaultEventId={event.id}
          onSubmit={handleCreateExpense}
          onClose={() => setShowExpenseForm(false)}
          isLoading={submittingExpense}
        />
      ) : null}

      {showPollForm && event?.id ? (
        <PollForm
          defaultEventId={event.id}
          onSubmit={handleCreatePoll}
          onClose={() => setShowPollForm(false)}
          isLoading={submittingPoll}
        />
      ) : null}
    </div>
  )
}

export default EventSummary



