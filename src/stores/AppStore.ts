import { create } from 'zustand'
import { Event, Expense, Poll, ShoppingList } from '../types'

interface AppState {
  events: Event[]
  expenses: Expense[]
  polls: Poll[]
  lists: ShoppingList[]
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
}

export const useAppStore = create<AppState>((set) => ({
  events: [],
  expenses: [],
  polls: [],
  lists: [],
  
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
}))
