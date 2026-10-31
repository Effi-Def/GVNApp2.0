import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Event, Expense, Poll, ShoppingList } from '../types'

// ---------------------------------------------------------------------------
// Deep Date serialization helper
// Dates are stored as { __date: "ISO string" } to survive JSON round-trips.
// Deserialization is handled by the createJSONStorage reviver (see persist config below).
// ---------------------------------------------------------------------------
function deepSerializeDates(obj: unknown): unknown {
  if (obj instanceof Date) return { __date: obj.toISOString() }
  if (Array.isArray(obj)) return obj.map(deepSerializeDates)
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as object)) out[k] = deepSerializeDates(v)
    return out
  }
  return obj
}

// ---------------------------------------------------------------------------
// AppState
// ---------------------------------------------------------------------------
interface AppState {
  events: Event[]
  expenses: Expense[]
  polls: Poll[]
  lists: ShoppingList[]
  farmIds: string[]

  setEvents: (events: Event[]) => void
  addEvent: (event: Event) => void
  updateEvent: (id: string, event: Partial<Event>) => void
  deleteEvent: (id: string) => void

  setExpenses: (expenses: Expense[]) => void
  addExpense: (expense: Expense) => void
  updateExpense: (id: string, expense: Partial<Expense>) => void
  deleteExpense: (id: string) => void

  setPolls: (polls: Poll[]) => void
  addPoll: (poll: Poll) => void
  updatePoll: (id: string, poll: Partial<Poll>) => void
  deletePoll: (id: string) => void

  setLists: (lists: ShoppingList[]) => void
  addList: (list: ShoppingList) => void
  updateList: (id: string, list: Partial<ShoppingList>) => void
  deleteList: (id: string) => void

  setFarmIds: (farmIds: string[]) => void
}

// ---------------------------------------------------------------------------
// Store with persistence (stale-while-revalidate pattern:
// cached data is shown instantly, then replaced by fresh Firestore data
// via loadUserData shortly after mount).
// ---------------------------------------------------------------------------
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      events: [],
      expenses: [],
      polls: [],
      lists: [],
      farmIds: [],

      setEvents: (events) => set({ events }),
      addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
      updateEvent: (id, updatedEvent) => set((state) => ({
        events: state.events.map(event => event.id === id ? { ...event, ...updatedEvent } : event)
      })),
      deleteEvent: (id) => set((state) => ({
        events: state.events.filter(event => event.id !== id)
      })),

      setExpenses: (expenses) => set({ expenses }),
      addExpense: (expense) => set((state) => ({ expenses: [...state.expenses, expense] })),
      updateExpense: (id, updatedExpense) => set((state) => ({
        expenses: state.expenses.map(expense => expense.id === id ? { ...expense, ...updatedExpense } : expense)
      })),
      deleteExpense: (id) => set((state) => ({
        expenses: state.expenses.filter(expense => expense.id !== id)
      })),

      setPolls: (polls) => set({ polls }),
      addPoll: (poll) => set((state) => ({ polls: [...state.polls, poll] })),
      updatePoll: (id, updatedPoll) => set((state) => ({
        polls: state.polls.map(poll => poll.id === id ? { ...poll, ...updatedPoll } : poll)
      })),
      deletePoll: (id) => set((state) => ({
        polls: state.polls.filter(poll => poll.id !== id)
      })),

      setLists: (lists) => set({ lists }),
      addList: (list) => set((state) => ({ lists: [...state.lists, list] })),
      updateList: (id, updatedList) => set((state) => ({
        lists: state.lists.map(list => list.id === id ? { ...list, ...updatedList } : list)
      })),
      deleteList: (id) => set((state) => ({
        lists: state.lists.filter(list => list.id !== id)
      })),

      setFarmIds: (farmIds) => set({ farmIds }),
    }),
    {
      name: 'gvn-app-store',
      version: 1,
      // createJSONStorage handles JSON.parse/stringify internally.
      // We supply a reviver to convert { __date: ISO } tokens back to Date objects on read.
      // The old custom getItem did JSON.parse internally and returned an object, causing Zustand
      // to attempt JSON.parse again on "[object Object]" → SyntaxError → empty cache every load.
      storage: createJSONStorage(() => localStorage, {
        reviver: (_key, value) => {
          if (
            value !== null &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            '__date' in (value as object)
          ) {
            const raw = (value as { __date: string }).__date
            const d = new Date(raw)
            return isNaN(d.getTime()) ? null : d
          }
          return value
        },
      }),
      // Serialize Dates before writing to localStorage
      partialize: (state) => ({
        events: deepSerializeDates(state.events),
        expenses: deepSerializeDates(state.expenses),
        polls: deepSerializeDates(state.polls),
        lists: deepSerializeDates(state.lists),
        farmIds: state.farmIds,
      }) as unknown as AppState,
    }
  )
)
