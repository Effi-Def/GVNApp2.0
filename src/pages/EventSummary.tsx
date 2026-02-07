import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '../stores/AppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { expenseService, pollService, listService, eventService } from '../services/firestore'
import { Event, Expense, Poll, ShoppingList, EventParticipant } from '../types'
import { getUserKeys, getUserEventParticipation } from '../utils/events'

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
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [tooltipDay, setTooltipDay] = useState<string | null>(null)
  const [showBalances, setShowBalances] = useState(false)
  const [showMyDebts, setShowMyDebts] = useState(false)
  const [showParticipantsOverlay, setShowParticipantsOverlay] = useState(false)

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
          expenseService.getAll().catch(() => []),
          pollService.getAll().catch(() => []),
          listService.getAll().catch(() => [])
        ])
        setExpenses((allExpenses as any[]).filter(e => e.eventId === id))
        setPolls((allPolls as any[]).filter(p => p.eventId === id))
        setLists((allLists as any[]).filter(l => l.eventId === id))
      } catch (e: any) {
        console.error('❌ Error loading EventSummary data:', e)
        setFatalError('Impossibile caricare il riassunto dell\'evento. Riprova più tardi.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, events])

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
    const { confirmed, maybe, total, progress } = participationStats
    if (total === 0) return 'Invita gli amici per sbloccare il livello della festa!'
    if (progress >= 90) return '🔥 Livello MAX! la festa è praticamente piena.'
    if (progress >= 60) return '🎉 Ottimo ritmo: mancano pochi passi alla festa perfetta.'
    if (confirmed.length === 0) return '🚀 Sii il primo a confermare per dare il via alla festa.'
    if (maybe.length > 0) return '👀 Convincili! Trasforma i “forse” in “sì” e sblocca bonus.'
    return `💪 ${confirmed.length}/${total} già pronti: continua così!`
  }, [participationStats])

  const stageLabel = useMemo(() => {
    const { progress, total } = participationStats
    if (total === 0) return 'Stato: lobby vuota'
    if (progress >= 90) return 'Stato: PARTY LEGEND 🏆'
    if (progress >= 60) return 'Stato: Squadra rodata ⚡'
    if (progress >= 30) return 'Stato: Riscaldamento 🔥'
    return 'Stato: Warm-up 🎯'
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
  const myStatus: 'yes' | 'no' | 'maybe' | 'none' = (myP.status as any) || 'none'
  const canChat = !!event && (meKeys.includes(event.createdBy) || myStatus === 'yes')
  const [myDays, setMyDays] = useState<Set<string>>(new Set())

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

  const updatePresence = async (newSet: Set<string>) => {
    if (!event || !currentUserId) return
    if (myStatus !== 'yes') {
      alert('Conferma la partecipazione (✅) per selezionare i giorni di presenza')
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
      alert('Errore durante il salvataggio dei giorni di presenza')
    }
  }

  const toggleDay = (k: string) => {
    const ns = new Set(myDays)
    if (ns.has(k)) ns.delete(k); else ns.add(k)
    setMyDays(ns)
    updatePresence(ns)
  }

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

      const updated = { ...event, participants: updatedParticipants, participation: updatedParticipation as any, updatedAt: new Date() }
      setEvent(updated)
      updateEvent(event.id, { participants: updatedParticipants, participation: updatedParticipation as any, updatedAt: new Date() })
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

  if (fatalError) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          {fatalError}
        </div>
        <div className="mt-4">
          <button onClick={() => navigate(-1)} className="text-sm text-gray-600 hover:text-gray-800">← Indietro</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">{event.title} <span>🐷</span></h1>
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
                  alert('Link copiato negli appunti')
                } else {
                  prompt('Copia il link', shareUrl)
                }
              } catch (e) {
                console.error('Share failed:', e)
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50 text-sm"
            title="Condividi evento"
          >
            Condividi
          </button>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-600 hover:text-gray-800">← Indietro</button>
        </div>
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

        {/* Per-day selection for multi-day events */}
        {isMultiDay && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">La tua presenza per giorno</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-1.5">
              {dayKeys.map(k => {
                const d = new Date(k)
                const label = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(d)
                const selected = myDays.has(k)
                return (
                  <button
                    key={k}
                    onClick={() => toggleDay(k)}
                    className={`px-2 py-1 text-[11px] rounded border transition-colors ${selected ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
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

      {/* Partecipazione: solo controlli, lista nascosta */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-3">La tua partecipazione</h2>
        {currentUserId ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Risposta:</span>
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
        ) : (
          <p className="text-sm text-gray-600">Accedi per rispondere all'evento.</p>
        )}
        <button
          type="button"
          onClick={() => setShowParticipantsOverlay(true)}
          className="mt-3 w-full rounded-xl border border-primary-100 bg-primary-50/70 hover:bg-primary-50 transition-all px-3 py-3 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <div className="flex items-center justify-between text-xs text-primary-800">
            <span className="font-semibold flex items-center gap-1 text-sm text-primary-700">👥 Squadra evento</span>
            <span className="text-[11px] underline">vedi nomi</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-primary-700">
            <span>Confermati: <strong>{participationStats.confirmed.length}</strong></span>
            {participationStats.maybe.length > 0 && (
              <span>Forse: <strong>{participationStats.maybe.length}</strong></span>
            )}
            {participationStats.declined.length > 0 && (
              <span>No: <strong>{participationStats.declined.length}</strong></span>
            )}
          </div>
          <div className="mt-2 h-2 rounded-full bg-primary-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 via-primary-400 to-emerald-400"
              style={{ width: `${participationStats.total === 0 ? 0 : Math.min(100, Math.max(12, participationStats.progress))}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-primary-700 flex items-center gap-1">
            <span>🎯</span>
            <span>{hypeMessage}</span>
          </p>
        </button>
      </div>

      {/* Chat call-to-action */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-500 to-emerald-500 text-white rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">💬 Chat evento</h2>
          <p className="text-sm text-white/80">Coordina il gruppo in tempo reale e tieni vivo l'entusiasmo del team.</p>
          {!canChat && (
            <p className="text-xs text-white/80 mt-1">Disponibile dopo aver confermato la partecipazione (✅).</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/chats')}
            className="px-3 py-2 rounded-lg border border-white/30 text-sm hover:bg-white/10 transition"
          >Apri elenco chat</button>
          <button
            onClick={() => { if (canChat) navigate(`/events/${event.id}/chat`) }}
            disabled={!canChat}
            className={`px-4 py-2 rounded-lg text-sm font-semibold shadow transition ${
              canChat
                ? 'bg-white text-primary-600'
                : 'bg-white/70 text-primary-700/60 cursor-not-allowed'
            }`}
          >Vai alla chat evento</button>
        </div>
      </div>

      {showParticipantsOverlay && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowParticipantsOverlay(false)}></div>
          <div className="relative w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl p-5 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 uppercase tracking-wide">{stageLabel}</span>
                <h3 className="text-xl font-bold text-neutral-900 mt-1 flex items-center gap-2">Squadra partecipanti <span>🏅</span></h3>
                <p className="text-sm text-neutral-600 max-w-md">Guarda chi ha già confermato, chi è indeciso e carica la squadra per salire di livello.</p>
              </div>
              <button onClick={() => setShowParticipantsOverlay(false)} className="text-sm text-neutral-500 hover:text-neutral-700">✕</button>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-neutral-600">
                <span>Confermati: <strong>{participationStats.confirmed.length}</strong></span>
                <span>Totale squadra: <strong>{participationStats.total}</strong></span>
              </div>
              <div className="mt-2 h-3 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 via-primary-500 to-purple-500"
                  style={{ width: `${participationStats.total === 0 ? 0 : participationStats.progress}%` }}
                ></div>
              </div>
              <p className="mt-2 text-xs text-primary-600 flex items-center gap-1">⚡ {hypeMessage}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-primary-50 rounded-xl border border-primary-100 p-3">
                <h4 className="text-sm font-semibold text-primary-700 flex items-center gap-1">✅ Confermati ({participationStats.confirmed.length})</h4>
                {participationStats.confirmed.length === 0 ? (
                  <p className="mt-2 text-xs text-primary-600">Ancora nessuno. Dai il buon esempio!</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-primary-800">
                    {participationStats.confirmed.map(p => (
                      <li key={p.userId} className="flex items-center justify-between">
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] bg-white/70 text-primary-600 px-2 py-0.5 rounded-full border border-primary-200">Protagonista</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-amber-50 rounded-xl border border-amber-100 p-3">
                <h4 className="text-sm font-semibold text-amber-700 flex items-center gap-1">🤔 Forse ({participationStats.maybe.length})</h4>
                {participationStats.maybe.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-700/80">Nessuno per ora. Continua così!</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-amber-800">
                    {participationStats.maybe.map(p => (
                      <li key={p.userId} className="flex items-center justify-between">
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] bg-white/70 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200">Convincilo!</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-3">
                <h4 className="text-sm font-semibold text-neutral-700 flex items-center gap-1">❌ Non partecipano ({participationStats.declined.length})</h4>
                {participationStats.declined.length === 0 ? (
                  <p className="mt-2 text-xs text-neutral-600">Per ora nessuna rinuncia. Ottimo!</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-neutral-800">
                    {participationStats.declined.map(p => (
                      <li key={p.userId} className="flex items-center justify-between">
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-neutral-200">Out</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-neutral-500">
              <span>Consiglio: raggiungi il 100% di conferme per sbloccare il badge “Evento epico”.</span>
              <button
                onClick={() => setShowParticipantsOverlay(false)}
                className="self-start sm:self-end px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100"
              >Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {/* Balances (summary) - collapsible */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button
          onClick={() => setShowBalances(v => !v)}
          className="w-full px-4 py-3 flex items-center justify-between"
        >
          <div>
            <h2 className="text-lg font-semibold">Saldi evento</h2>
            <p className="text-xs text-gray-500">Riepilogo di quanto ciascuno ha a credito/debito.</p>
          </div>
          <span className="text-gray-500">{showBalances ? '▾' : '▸'}</span>
        </button>
        {showBalances && (
          <div className="p-4 pt-0">
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
        )}
      </div>

      {/* My debts/credits vs people in this event - collapsible */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button onClick={() => setShowMyDebts(v => !v)} className="w-full px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">La tua situazione</h2>
            <p className="text-xs text-gray-500">Importi positivi = ti devono dare, negativi = devi tu.</p>
          </div>
          <span className="text-gray-500">{showMyDebts ? '▾' : '▸'}</span>
        </button>
        {showMyDebts && (
          <div className="p-4 pt-0">
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
        )}
      </div>

      {/* Presence chart for multi-day events */}
      {isMultiDay && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-1">Presenze per giorno</h2>
          <p className="text-xs text-gray-500 mb-3">Asse Y = giorni, asse X = numero partecipanti presenti quel giorno.</p>
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
                      <div className="w-28 shrink-0 text-xs text-gray-700">{label}</div>
                      <div className="relative h-8 flex-1 border-b border-dashed border-gray-200">
                        <button
                          className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shadow"
                          style={{ left: `${leftPct}%` }}
                          onClick={() => setOpen(isOpen ? null : key)}
                          title={`${count} partecipanti`}
                        >
                          {count}
                        </button>
                        {isOpen && (
                          <div className="absolute z-20 mt-2 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded shadow p-2 text-xs min-w-[12rem] max-w-[80vw]">
                            <div className="font-medium text-gray-900 mb-1">{label}</div>
                            {users.length === 0 ? (
                              <div className="text-gray-600">Nessuno</div>
                            ) : (
                              <ul className="list-disc list-inside space-y-0.5 text-gray-800">
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
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Spese</h2>
          <button
            type="button"
            onClick={() => { if (event?.id) navigate('/expenses', { state: { openForm: true, eventId: event.id } }) }}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
            title="Aggiungi spesa"
            aria-label="Aggiungi spesa"
          >
            +
          </button>
        </div>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Sondaggi</h2>
          <button
            type="button"
            onClick={() => { if (event?.id) navigate('/polls', { state: { openForm: true, eventId: event.id } }) }}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
            title="Aggiungi sondaggio"
            aria-label="Aggiungi sondaggio"
          >
            +
          </button>
        </div>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Liste</h2>
          <button
            type="button"
            onClick={() => { if (event?.id) navigate('/lists', { state: { openForm: true, eventId: event.id } }) }}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
            title="Aggiungi lista"
            aria-label="Aggiungi lista"
          >
            +
          </button>
        </div>
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
