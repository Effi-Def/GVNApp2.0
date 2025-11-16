import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/AppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useUserSettingsStore } from '../stores/UserSettingsStore'
import { useNavigate } from 'react-router-dom'
import { eventService, listService } from '../services/firestore'
import MonthCalendar from '../components/Calendar/MonthCalendar'
import { isAnnouncementUnread, openAnnouncementModal } from '../components/AnnouncementModal'

const HomePage = () => {
  const { user } = useAuthStore()
  const { profile } = useUserSettingsStore()
  const { events, expenses, lists, setEvents, setLists } = useAppStore()
  const navigate = useNavigate()
  
  const [isLoading, setIsLoading] = useState(false)

  // Funzione per ricaricare i dati manualmente usando lo store
  const refreshData = async () => {
    setIsLoading(true)
    try {
      // Prova a usare una funzione di caricamento centralizzata se esiste
      const { loadUserData } = useAuthStore.getState() as any
      if (typeof loadUserData === 'function') {
        await loadUserData()
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Assicurati che se lo store è vuoto proviamo un caricamento centralizzato una sola volta
  useEffect(() => {
    if (events.length === 0 && !isLoading) {
      // Prova prima la funzione centralizzata se disponibile
      const { loadUserData } = useAuthStore.getState() as any
      if (typeof loadUserData === 'function') {
        console.log('🔄 HomePage: Loading user data...')
        loadUserData().catch((e: any) => {
          console.warn('⚠️ HomePage: loadUserData failed:', e)
        })
      } else {
        // Fallback diretto: carica eventi da Firestore
        console.log('🔄 HomePage: Loading events directly...')
        ;(async () => {
          try {
            const eventsData = await eventService.getAll()
            console.log('✅ HomePage: Loaded events:', eventsData.length)
            setEvents(eventsData)
          } catch (e) {
            console.warn('⚠️ Impossibile caricare eventi (fallback HomePage):', e)
          }
        })()
      }
    }
  }, [events.length, isLoading])

  // Prendi i prossimi 3-5 eventi
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Id utente corrente usato in più sezioni; definirlo PRIMA di usarlo
  const currentUserId = user?.id || user?.email || 'mock-user'
  
  const upcomingEvents = events
    .filter(event => {
      const eventDate = new Date(event.date)
      eventDate.setHours(0, 0, 0, 0)
      if (eventDate < today) return false
      // Nascondi eventi a cui ho risposto "no"
      const mine = (event.participants || []).find(p => p.userId === currentUserId)
      if (mine && mine.status === 'no') return false
      return true
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  const nextUpcomingEvents = upcomingEvents.slice(0, 5)

  // Calcola il bilancio delle spese per l'utente corrente (stesso algoritmo di ExpensesPage-hybrid)
  
  const userBalance = expenses.reduce((balance, expense) => {
    const userParticipation = expense.participants.find(p => p.userId === currentUserId)
    if (!userParticipation) return balance

    if (expense.paidBy === currentUserId) {
      // L'utente ha pagato, deve ricevere dagli altri (solo da quelli non settled)
      const totalOwed = expense.participants
        .filter(p => p.userId !== currentUserId && !p.settled)
        .reduce((sum, p) => sum + p.amount, 0)
      return balance + totalOwed
    } else if (!userParticipation.settled) {
      // L'utente deve pagare (solo se non già settled)
      return balance - userParticipation.amount
    }
    return balance
  }, 0)

  console.log('🏠 HomePage Balance Calculation:', { 
    currentUserId, 
    expensesCount: expenses.length, 
    userBalance,
    expenses: expenses.map(e => ({
      id: e.id,
      title: e.title,
      amount: e.amount,
      paidBy: e.paidBy,
      userParticipation: e.participants.find(p => p.userId === currentUserId)
    }))
  })

  // ===== I miei To-do =====
  const meName = (profile?.displayName && profile.displayName.trim().length > 0)
    ? profile.displayName.trim()
    : ((user?.displayName && user.displayName !== 'Utente') ? user.displayName : (user?.email ? user.email.split('@')[0] : ''))

  type TodoEntry = {
    listId: string
    listTitle: string
    eventId?: string
    itemId: string
    text: string
    status?: 'todo' | 'in-progress' | 'done'
    dueDate?: Date
    addedAt?: Date
  }

  const myTodos: TodoEntry[] = (lists || [])
    .filter(l => (l.type || 'shopping') === 'todo')
    .flatMap(l => (l.items || []).filter(it => !it.completed).map(it => ({
      listId: l.id,
      listTitle: l.title,
      eventId: l.eventId,
      itemId: it.id,
      text: it.text,
      status: it.status,
      dueDate: it.dueDate,
      addedAt: it.addedAt,
      assignees: it.assignees || [],
      addedBy: it.addedBy,
    } as any)))
    .filter((e: any) => {
      // Match per assegnatari o autore come fallback
      const assigned = Array.isArray(e.assignees) && e.assignees.some((a: any) =>
        (a.userId && a.userId === currentUserId) || (a.userName && meName && a.userName.toLowerCase() === meName.toLowerCase())
      )
      return assigned || e.addedBy === currentUserId
    })
    .sort((a, b) => {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      if (ad !== bd) return ad - bd
      const order = (s?: string) => s === 'todo' ? 0 : s === 'in-progress' ? 1 : 2
      const so = order(a.status) - order(b.status)
      if (so !== 0) return so
      const aa = a.addedAt ? new Date(a.addedAt).getTime() : 0
      const ba = b.addedAt ? new Date(b.addedAt).getTime() : 0
      return aa - ba
    })
    .slice(0, 4)

  const toggleTodoFromHome = async (entry: TodoEntry) => {
    const list = lists.find(l => l.id === entry.listId)
    if (!list) return
    const updatedItems = list.items.map(it => {
      if (it.id !== entry.itemId) return it
      const nowCompleted = !it.completed
      return {
        ...it,
        completed: nowCompleted,
        completedBy: nowCompleted ? (user?.id || currentUserId) : undefined,
        completedAt: nowCompleted ? new Date() : undefined,
        status: (list.type || 'shopping') === 'todo' ? (nowCompleted ? 'done' : 'todo') : it.status,
      }
    })
    const updatedList = { ...list, items: updatedItems, updatedAt: new Date() }
    await listService.update(list.id, updatedList)
    setLists(lists.map(l => l.id === list.id ? updatedList : l))
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-6 sm:pb-8 relative">
      {/* Loading state */}
      {isLoading && (
        <div className="gvn-card p-4 sm:p-6 bg-gradient-to-r from-primary-50 to-accent-50 border-primary-200">
          <div className="flex items-center space-x-3">
            <div className="animate-spin h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full"></div>
            <span className="text-primary-700 font-medium">Caricamento dati in corso...</span>
          </div>
        </div>
      )}

      {/* Hero Header con mascotte */}
      <div className="gvn-card p-6 sm:p-8 bg-gradient-to-br from-primary-50 via-white to-accent-50 border-primary-100 relative overflow-hidden">
        {/* Mascotte floating */}
        <div className="hidden sm:block absolute top-4 right-6 text-4xl animate-float opacity-60">
          🐷
        </div>
        
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between relative z-10">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <h1 className="gvn-title text-2xl sm:text-3xl lg:text-4xl bg-gradient-to-r from-primary-600 to-accent-500 bg-clip-text text-transparent">
                Ciao, {(profile?.displayName && profile.displayName.trim().length > 0)
                  ? profile.displayName
                  : ((user?.displayName && user.displayName !== 'Utente') ? user.displayName : (user?.email ? user.email.split('@')[0] : 'Amico'))}!
              </h1>
              <span className="text-2xl animate-bounce">👋</span>
              {/* Badge novità se annuncio non letto */}
              {typeof window !== 'undefined' && isAnnouncementUnread() && (
                <button
                  onClick={openAnnouncementModal}
                  className="ml-2 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-50 text-pink-700 border border-pink-200 hover:bg-pink-100"
                  title="Novità dell'ultima versione"
                >
                  <span>🐷</span>
                  <span>Novità</span>
                </button>
              )}
            </div>
            <p className="text-neutral-600 text-base sm:text-lg font-medium">
              Benvenuto nel tuo hub sociale del <span className="gvn-badge-pig">🐷 Gruppo GVN</span>
            </p>
            <p className="text-neutral-500 flex flex-wrap items-center gap-2 text-sm sm:text-base">
              Gestisci eventi, spese e decisioni di gruppo tutto in un posto
              {/* Pulsante refresh dati */}
              <button
                onClick={refreshData}
                disabled={isLoading}
                className="ml-2 p-1 rounded-full hover:bg-primary-100 transition-colors disabled:opacity-50"
                title="Aggiorna dati"
              >
                <span className={`text-sm ${isLoading ? 'animate-spin' : ''}`}>🔄</span>
              </button>
            </p>
          </div>
          <div className="hidden lg:block text-6xl opacity-20">
            🎉
          </div>
        </div>
      </div>

      {/* Calendar + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <MonthCalendar
            events={events}
            onSelectEvent={(eventId) => navigate(`/events/${eventId}/summary`)}
            compact
            currentUserId={currentUserId}
            onCreateEvent={(date) => {
              const y = date.getFullYear()
              const m = String(date.getMonth() + 1).padStart(2, '0')
              const d = String(date.getDate()).padStart(2, '0')
              navigate(`/events?create=1&date=${y}-${m}-${d}`)
            }}
          />
        </div>

  <button onClick={() => navigate('/expenses')} className="gvn-card p-6 group hover:scale-105 text-left">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">Il Tuo Saldo</p>
              <p className={`gvn-title text-4xl ${userBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {userBalance >= 0 ? '+' : ''}€{userBalance.toFixed(2)}
              </p>
              <p className="text-xs text-neutral-400">
                {userBalance >= 0 ? 'Devi ricevere' : 'Devi pagare'}
              </p>
              {/* Debug info */}
              <p className="text-xs text-blue-400 opacity-70">
                📊 Dati: {events.length} eventi, {expenses.length} spese
              </p>
            </div>
            <div className={`bg-gradient-to-br p-4 rounded-2xl group-hover:scale-110 transition-transform ${
              userBalance >= 0 ? 'from-green-100 to-green-200' : 'from-red-100 to-red-200'
            }`}>
              <span className="text-3xl">{userBalance >= 0 ? '💚' : '💸'}</span>
            </div>
          </div>
  </button>
        {/* Chat quick link removed to keep Home clean as requested */}
        {/* Riepilogo Spese Totali rimosso su richiesta */}
      </div>

      {/* I miei To-do */}
      <div className="gvn-card p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="gvn-title text-2xl flex items-center gap-2">
            <span>✅</span>
            <span>I miei To‑do</span>
          </h2>
          <button onClick={() => navigate('/lists')} className="text-sm text-primary-600 hover:underline">Apri liste</button>
        </div>
        {myTodos.length === 0 ? (
          <p className="text-neutral-500">Nessun to‑do assegnato. Assegna elementi dalle liste To‑do.</p>
        ) : (
          <div className="space-y-3">
            {myTodos.map(t => (
              <div key={`${t.listId}:${t.itemId}`} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-neutral-50">
                <button
                  onClick={() => toggleTodoFromHome(t)}
                  className={`w-6 h-6 rounded-full border-2 ${t.status === 'done' ? 'bg-green-500 border-green-500' : 'border-neutral-300'}`}
                  title="Completa"
                >
                  {t.status === 'done' && (
                    <svg className="w-4 h-4 text-white mx-auto mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-neutral-800 truncate">{t.text}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                    <span className={`px-2 py-0.5 rounded-full border ${
                      t.status === 'done' ? 'bg-green-50 text-green-700 border-green-200' :
                      t.status === 'in-progress' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>{t.status || 'todo'}</span>
                    {t.dueDate && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">📅 {new Date(t.dueDate).toLocaleDateString('it-IT')}</span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-neutral-50 text-neutral-600 border border-neutral-200">📝 {t.listTitle}</span>
                    {t.eventId && (
                      <button onClick={() => navigate(`/events/${t.eventId}/summary`)} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:underline">Vai all'evento</button>
                    )}
                  </div>
                </div>
                <button onClick={() => navigate('/lists')} className="text-xs text-primary-600 hover:underline">Apri</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prossimi Eventi - redesigned */}
      <div className="gvn-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h2 className="gvn-title text-2xl flex items-center space-x-3">
            <span>🎉</span>
            <span>Eventi in Programma</span>
          </h2>
          {nextUpcomingEvents.length > 0 && (
            <div className="gvn-badge-pig">
              <span>🐷</span>
              <span>{nextUpcomingEvents.length} eventi</span>
            </div>
          )}
        </div>
        
        {nextUpcomingEvents.length > 0 ? (
          <div className="space-y-4">
            {nextUpcomingEvents.map((event, index) => (
              <div key={event.id} className="relative">
                <div onClick={() => navigate(`/events/${event.id}/summary`)} className="cursor-pointer flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0 sm:space-x-4 p-4 rounded-xl bg-gradient-to-r from-neutral-50 to-transparent border border-neutral-100 hover:shadow-md transition-all duration-200">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                      {new Date(event.date).getDate()}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-neutral-900 text-lg">{event.title}</h3>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-2 text-sm text-neutral-600 space-y-2 sm:space-y-0">
                      <span className="flex items-center space-x-1">
                        <span>📅</span>
                        <span>{new Date(event.date).toLocaleDateString('it-IT')} alle {event.time}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <span>📍</span>
                        <span>{event.location}</span>
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
                        {event.participants.filter(p => p.status === 'yes').length} confermati
                      </span>
                      {index === 0 && (
                        <span className="text-xs font-semibold text-accent-600 bg-accent-50 px-3 py-1 rounded-full animate-pulse">
                          🔥 Prossimo evento
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 opacity-50">📅</div>
            <h3 className="gvn-title text-xl text-neutral-600 mb-2">Nessun evento in programma</h3>
            <p className="text-neutral-500 mb-6">Crea il primo evento per il gruppo!</p>
            <button onClick={() => navigate('/events?create=1')} className="gvn-btn-primary">
              <span>🎉</span>
              <span>Crea Evento</span>
            </button>
          </div>
        )}
      </div>

      {/* Attività recenti - dinamiche e filtrate */}
      <div className="gvn-card p-6 sm:p-8">
        <h2 className="gvn-title text-2xl flex items-center space-x-3 mb-6">
          <span>🔔</span>
          <span>Attività Recenti</span>
        </h2>

        {(() => {
          // Helper: safe date
          const toDate = (d: any) => d instanceof Date ? d : new Date(d)
          // Event IDs dove partecipo (yes/maybe) o che ho creato
          const myEventIds = new Set(
            events
              .filter(ev => ev.createdBy === currentUserId || (ev.participants || []).some(p => p.userId === currentUserId && (p.status === 'yes' || p.status === 'maybe')))
              .map(ev => ev.id)
          )

          type Activity = { id: string; kind: 'event' | 'expense' | 'poll' | 'list'; text: string; when: Date; icon: string; click: () => void; accent: string }
          const items: Activity[] = []

          // Nuovi eventi creati (mostra come categoria dedicata)
          for (const ev of events) {
            items.push({
              id: `ev-${ev.id}`,
              kind: 'event',
              text: `Nuovo evento: "${ev.title}"` ,
              when: toDate(ev.createdAt),
              icon: '🎉',
              accent: 'bg-blue-50 border-blue-100',
              click: () => navigate(`/events/${ev.id}/summary`)
            })
          }

          // Attività inerenti ai miei eventi: spese, sondaggi, liste
          for (const ex of expenses) {
            if (!ex.eventId || !myEventIds.has(ex.eventId)) continue
            items.push({
              id: `ex-${ex.id}`,
              kind: 'expense',
              text: `Nuova spesa: "${ex.title}" · €${ex.amount.toFixed(2)}`,
              when: toDate(ex.createdAt),
              icon: '💰',
              accent: 'bg-green-50 border-green-100',
              click: () => navigate(`/events/${ex.eventId}/summary`)
            })
          }

          // Polls
          const appState: any = useAppStore.getState()
          const polls = appState.polls || []
          for (const p of polls) {
            if (!p.eventId || !myEventIds.has(p.eventId)) continue
            items.push({
              id: `po-${p.id}`,
              kind: 'poll',
              text: `Nuovo sondaggio: "${p.title}"`,
              when: toDate(p.createdAt),
              icon: '🗳️',
              accent: 'bg-purple-50 border-purple-100',
              click: () => navigate(`/events/${p.eventId}/summary`)
            })
          }

          // Lists
          const lists = appState.lists || []
          for (const l of lists) {
            if (!l.eventId || !myEventIds.has(l.eventId)) continue
            items.push({
              id: `li-${l.id}`,
              kind: 'list',
              text: `Nuova lista: "${l.title}"`,
              when: toDate(l.createdAt),
              icon: '📝',
              accent: 'bg-amber-50 border-amber-100',
              click: () => navigate(`/events/${l.eventId}/summary`)
            })
          }

          // Ordina per data desc e prendi i più recenti
          items.sort((a, b) => b.when.getTime() - a.when.getTime())
          const top = items.slice(0, 6)

          const timeAgo = (d: Date) => {
            const diff = Date.now() - d.getTime()
            const minutes = Math.floor(diff / 60000)
            if (minutes < 1) return 'adesso'
            if (minutes < 60) return `${minutes} min fa`
            const hours = Math.floor(minutes / 60)
            if (hours < 24) return `${hours} h fa`
            const days = Math.floor(hours / 24)
            if (days === 1) return 'ieri'
            return `${days} gg fa`
          }

          return (
            <div className="space-y-3">
              {top.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">Nessuna attività recente</div>
              ) : (
                top.map(a => (
                  <button key={a.id} onClick={a.click} className={`text-left flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-3 sm:space-y-0 p-4 rounded-xl border w-full ${a.accent}`}>
                    <div className="w-3 h-3 bg-neutral-400 rounded-full"></div>
                    <div className="flex-1">
                      <span className="font-medium text-neutral-700">{a.text}</span>
                      <p className="text-sm text-neutral-500">{timeAgo(a.when)}</p>
                    </div>
                    <span className="text-xl">{a.icon}</span>
                  </button>
                ))
              )}
            </div>
          )
        })()}
      </div>
  {/* Floating chat launcher moved to global Layout for cross-page visibility */}
    </div>
  )
}

export { HomePage }
export default HomePage
// Floating chat launcher rendered specifically on Home
// (Placed after export to avoid interfering with page DOM logic)

