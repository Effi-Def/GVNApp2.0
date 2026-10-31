import { useState, useEffect } from 'react'
import { Event, Expense, Poll, ShoppingList } from '../types'
import { useAppStore } from '../stores/AppStore'
import { listService } from '../services/firestore'
import { formatEuro } from '../utils/expenseUtils'

interface EventDashboardProps {
  event: Event
  onClose: () => void
}

const EventDashboard = ({ event, onClose }: EventDashboardProps) => {
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [lists, setLists] = useState<ShoppingList[]>([])
  const storeExpenses = useAppStore(s => (s as any).expenses) as any as Expense[]
  const storePolls = useAppStore(s => (s as any).polls) as any as Poll[]
  const storeLists = useAppStore(s => (s as any).lists) as any as ShoppingList[]

  useEffect(() => {
    const loadEventData = async () => {
      try {
        setLoading(true)

        const exp = (storeExpenses || []).filter(expense => expense.eventId === event.id)
        const pls = (storePolls || []).filter(poll => poll.eventId === event.id)
        const lstFromStore = (storeLists || []).filter(list => list.eventId === event.id)

        setExpenses(exp)
        setPolls(pls)

        if (lstFromStore.length) {
          setLists(lstFromStore)
        } else {
          const listsData = event.id ? await listService.getByEventId(event.id).catch(() => []) : []
          setLists((listsData as any[]).filter(list => list.eventId === event.id))
        }
      } catch (error) {
        console.error('❌ Error loading event data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadEventData()
  }, [event.id, storeExpenses, storePolls, storeLists])

  const getTotalExpenses = () => {
    return expenses.reduce((total, expense) => total + expense.amount, 0)
  }

  const getCategoryIcon = (category: string) => {
    const icons = {
      cena: '🍽️',
      aperitivo: '🍻',
      viaggio: '✈️',
      sport: '⚽',
      festa: '🎉',
      cinema: '🎬',
      shopping: '🛍️',
      altro: '📌'
    }
    return icons[category as keyof typeof icons] || '📌'
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 !mt-0 bg-black/50 flex items-center justify-center z-[70]">
        <div className="bg-[--bg-card] rounded-lg shadow-xl p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-3 text-[--text-muted]">Caricamento dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 !mt-0 bg-black/50 flex items-end sm:items-center justify-center sm:p-4 z-[70]">
      <div className="bg-[--bg-card] rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-4xl max-h-[calc(100dvh-4rem)] sm:max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <div className="flex items-center">
              <span className="text-3xl mr-3">{getCategoryIcon(event.category)}</span>
              <div>
                <h2 className="text-2xl font-bold text-[--text-base]">{event.title}</h2>
                <p className="text-[--text-muted]">
                  {event.category === 'viaggio' && event.endDate 
                    ? `Dal ${formatDate(event.date)} al ${formatDate(event.endDate)} - Partenza alle ${event.time}`
                    : `${formatDate(event.date)} alle ${event.time}`
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[--text-muted] hover:text-[--text-muted] text-2xl"
            >
              ✕
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Participants */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-medium">Partecipanti</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {event.participants.filter(p => p.status === 'yes').length}
                  </p>
                </div>
                <span className="text-3xl">👥</span>
              </div>
            </div>

            {/* Expenses */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-sm font-medium">Spese Totali</p>
                  <p className="text-2xl font-bold text-green-900">
                    {formatEuro(getTotalExpenses())}
                  </p>
                </div>
                <span className="text-3xl">💰</span>
              </div>
            </div>

            {/* Polls */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-600 text-sm font-medium">Sondaggi</p>
                  <p className="text-2xl font-bold text-purple-900">{polls.length}</p>
                </div>
                <span className="text-3xl">📊</span>
              </div>
            </div>

            {/* Lists */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-600 text-sm font-medium">Liste</p>
                  <p className="text-2xl font-bold text-orange-900">{lists.length}</p>
                </div>
                <span className="text-3xl">📋</span>
              </div>
            </div>
          </div>

          {/* Details Sections */}
          <div className="space-y-6">
            {/* Event Info */}
            <div className="bg-[--bg-subtle] rounded-lg p-6">
              <h3 className="text-lg font-semibold text-[--text-base] mb-4">Informazioni Evento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[--text-muted]">Luogo</p>
                  <p className="font-medium text-[--text-base]">📍 {event.location}</p>
                </div>
                <div>
                  <p className="text-sm text-[--text-muted]">
                    {event.category === 'viaggio' ? 'Periodo' : 'Data e Ora'}
                  </p>
                  <p className="font-medium text-[--text-base]">
                    {event.category === 'viaggio' && event.endDate 
                      ? `✈️ Dal ${formatDate(event.date)} al ${formatDate(event.endDate)} - Partenza alle ${event.time}`
                      : `🕐 ${formatDate(event.date)} alle ${event.time}`
                    }
                  </p>
                </div>
                {event.description && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-[--text-muted]">Descrizione</p>
                    <p className="font-medium text-[--text-base]">{event.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Expenses */}
            {expenses.length > 0 && (
              <div className="bg-[--bg-card] border border-[--border-base] rounded-lg p-6">
                <h3 className="text-lg font-semibold text-[--text-base] mb-4">Ultime Spese</h3>
                <div className="space-y-3">
                  {expenses.slice(0, 3).map(expense => (
                    <div key={expense.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                      <div>
                        <p className="font-medium text-[--text-base]">{expense.title}</p>
                        <p className="text-sm text-[--text-muted]">{expense.participants.length === 1 ? '1 partecipante' : `${expense.participants.length} partecipanti`}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[--text-base]">{formatEuro(expense.amount)}</p>
                        <p className="text-xs text-[--text-muted]">
                          circa {formatEuro(expense.amount / expense.participants.length)} a persona
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Polls */}
            {polls.length > 0 && (
              <div className="bg-[--bg-card] border border-[--border-base] rounded-lg p-6">
                <h3 className="text-lg font-semibold text-[--text-base] mb-4">Sondaggi Attivi</h3>
                <div className="space-y-3">
                  {polls.filter(poll => !poll.closedAt).slice(0, 3).map(poll => (
                    <div key={poll.id} className="py-2 border-b last:border-b-0">
                      <p className="font-medium text-[--text-base]">{poll.title}</p>
                      <p className="text-sm text-[--text-muted]">{poll.votes.length} voti • {poll.options.length} opzioni</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EventDashboard

