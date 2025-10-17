export interface User {
  id: string
  email: string
  displayName: string
  photoURL?: string
  createdAt: Date
}

export interface Event {
  id: string
  title: string
  description: string
  category: EventCategory
  date: Date
  endDate?: Date // Per viaggi: data di fine
  time: string
  location: string
  createdBy: string
  participants: EventParticipant[]
  createdAt: Date
  updatedAt: Date
}

export type EventCategory = 
  | 'cena' 
  | 'aperitivo' 
  | 'viaggio' 
  | 'sport' 
  | 'festa' 
  | 'cinema' 
  | 'shopping' 
  | 'altro'

export interface EventParticipant {
  userId: string
  name: string
  status: 'yes' | 'no' | 'maybe'
  respondedAt: Date
}

export interface Expense {
  id: string
  title: string
  amount: number
  paidBy: string
  participants: ExpenseParticipant[]
  eventId?: string
  createdAt: Date
  updatedAt: Date
}

export interface ExpenseParticipant {
  userId: string
  name: string
  amount: number
  settled: boolean
}

export interface Poll {
  id: string
  title: string  // Cambiamo da question a title per coerenza
  description?: string  // Aggiungiamo descrizione opzionale
  options: PollOption[]
  createdBy: string
  eventId?: string
  votes: PollVote[]
  isActive: boolean  // Aggiungiamo stato attivo/chiuso
  createdAt: Date
  updatedAt: Date
  closedAt?: Date
  votingDurationHours?: number // Durata in ore per le votazioni
  votingEndsAt?: Date // Timestamp di scadenza votazioni
}

export interface PollOption {
  id: string
  text: string
  votes: number // Aggiungiamo il conteggio voti
}

export interface PollVote {
  userId: string
  userName: string
  optionId: string
  votedAt: Date
}

export interface ShoppingList {
  id: string
  title: string
  description?: string // Aggiungiamo descrizione opzionale
  items: ListItem[]  // Cambiamo il nome del tipo
  eventId?: string
  createdBy: string
  shared?: boolean  // Aggiungiamo flag condivisione
  createdAt: Date
  updatedAt: Date
}

export interface ListItem {  // Rinominiamo e aggiungiamo proprietà
  id: string
  text: string
  completed: boolean
  completedBy?: string
  completedAt?: Date
  addedBy: string
  addedAt: Date
}

// Alias per backward compatibility
export interface ShoppingListItem extends ListItem {}

export interface Group {
  id: string
  name: string
  members: string[]
  createdBy: string
  createdAt: Date
}
