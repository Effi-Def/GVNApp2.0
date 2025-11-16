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
  // Priorità evento per ordinamento/visibilità
  priority?: EventPriority
  // Ultima attività chat per badge "Nuovi"
  chatLastActivityAt?: Date
  // Flag per consentire la condivisione pubblica dell'evento
  publicShareEnabled?: boolean
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

// Livelli di priorità supportati (default: 'medium')
export type EventPriority = 'low' | 'medium' | 'high'

export interface EventParticipant {
  userId: string
  name: string
  status: 'yes' | 'no' | 'maybe'
  respondedAt: Date
  // Presenza per singolo giorno (chiave YYYY-MM-DD → presente:boolean)
  days?: Record<string, boolean>
}

export interface Expense {
  id: string
  title: string
  amount: number
  paidBy: string
  participants: ExpenseParticipant[]
  eventId?: string
  notes?: string // 📝 Note e descrizioni aggiuntive
  splitType?: 'equal' | 'custom' | 'percentage' // 🎛️ Tipo di divisione
  attachments?: ExpenseAttachment[] // 📎 Allegati (scontrini, foto)
  comments?: ExpenseComment[] // 💬 Commenti e discussioni
  createdAt: Date
  updatedAt: Date
}

export interface ExpenseParticipant {
  userId: string
  name: string
  amount: number
  settled: boolean
  percentage?: number // Per divisioni percentuali
}

export interface ExpenseAttachment {
  id: string
  type: 'image' | 'pdf' | 'receipt'
  url: string
  name: string
  uploadedBy: string
  uploadedAt: Date
}

export interface ExpenseComment {
  id: string
  text: string
  authorId: string
  authorName: string
  createdAt: Date
}

// Nuovo tipo per transazioni di pagamento
export interface PaymentTransaction {
  id: string
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  amount: number
  description?: string
  eventId?: string
  relatedExpenseIds?: string[] // Spese che questo pagamento sistema
  createdAt: Date
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
  // Tipo lista: shopping (default), todo, transport, lodging
  type?: ListType
  createdAt: Date
  updatedAt: Date
}

// Tipi supportati per le liste (estendibili)
export type ListType = 'shopping' | 'todo' | 'transport' | 'lodging'

export interface ListItem {  // Rinominiamo e aggiungiamo proprietà
  id: string
  text: string
  completed: boolean
  completedBy?: string
  completedAt?: Date
  addedBy: string
  addedAt: Date
  // Campi opzionali per To-do e altri tipi specializzati
  status?: 'todo' | 'in-progress' | 'done'
  dueDate?: Date
  assignees?: { userId?: string; userName: string }[]
  notes?: string
  // Estensioni per tipi speciali: trasporti (macchine) e stanze
  capacity?: number // posti disponibili nello slot (es. 5 per auto, 2 per stanza)
  driver?: { userId?: string; userName: string } // solo per macchine
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

// 💬 Chat per evento (v1)
export type ChatReactionKey = 'like' | 'love' | 'fun'

export interface ChatAttachment {
  id: string
  url: string
  name: string
  type: 'image' | 'file'
  size?: number
  contentType?: string
}

export interface ChatMessage {
  id: string
  eventId: string
  userId: string
  userName: string
  userPhotoURL?: string
  text?: string
  attachments?: ChatAttachment[]
  reactions?: Partial<Record<ChatReactionKey, string[]>>
  quoted?: {
    messageId: string
    textPreview?: string
    mediaThumbUrl?: string
  }
  createdAt: Date
  editedAt?: Date
  deleted?: boolean
}
