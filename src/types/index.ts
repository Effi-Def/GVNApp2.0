export interface User {
  id: string
  email: string
  displayName: string
  photoURL?: string
  createdAt: Date
}

export interface EventLocation {
  address: string
  lat: number
  lon: number
}

export interface Event {
  id: string
  title: string
  description: string
  category: EventCategory
  date: Date
  // Planning lifecycle (optional for backward compatibility)
  status?: 'planning' | 'scheduled' | 'done' | 'canceled'
  // When false, `date` is a placeholder (usually first proposed date)
  dateFinalized?: boolean
  // When planning with `proposedDates`, this stores the chosen YYYY-MM-DD
  selectedDateKey?: string
  finalizedAt?: Date
  // MVP: multiple proposed dates (YYYY-MM-DD) with per-user vote
  proposedDates?: string[]
  dateVotes?: Record<string, string>
  endDate?: Date // Per viaggi: data di fine
  time: string
  location: string
  // Geocoordinate opzionali per la visualizzazione mappa (OpenStreetMap/Nominatim)
  locationGeo?: EventLocation
  createdBy: string

  // Visibility vs participation (groundwork for [000])
  visibility?: EventVisibility
  // Explicit participation map keyed by userId (does not imply visibility)
  participation?: Record<string, EventParticipation>

  participants: EventParticipant[]
  // Priorità evento per ordinamento/visibilità
  priority?: EventPriority
  // Ultima attività chat per badge "Nuovi"
  chatLastActivityAt?: Date
  // Flag per consentire la condivisione pubblica dell'evento
  publicShareEnabled?: boolean
  // IDs dei partecipanti per regole di sicurezza
  participantIds?: string[]
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

export type EventVisibilityType = 'public' | 'restricted'

export interface EventVisibility {
  type: EventVisibilityType
  farms?: string[]
  users?: string[]
}

// 🐷 Fattorie (groups)
export type FarmRole = 'owner' | 'member'

export type FarmPrivacy = 'invite' | 'open'

export interface Farm {
  id: string
  name: string
  ownerId: string
  iconEmoji?: string
  privacy?: FarmPrivacy
  inviteTokenId?: string
  memberCount?: number
  createdAt: Date
  updatedAt: Date
}

export interface FarmMembership {
  userId: string
  role: FarmRole
  accessLevel: 'full' | 'readonly' | 'none'
  joinedAt: Date
  displayName?: string
  photoURL?: string
}

export type FarmJoinRequestStatus = 'pending' | 'approved' | 'denied'

export interface FarmJoinRequest {
  id: string
  userId: string
  status: FarmJoinRequestStatus
  displayName?: string
  photoURL?: string
  createdAt: Date
  updatedAt?: Date
}

// Private per-user metadata (NOT a global directory)
export interface UserPrivate {
  id: string
  farmIds: string[]
  farms?: Record<string, { role: FarmRole; joinedAt: Date }>
  // Persisted per-user UI preference
  lastActiveFarmId?: string
  // Per-farm user settings (workspace-scoped preferences)
  farmSettings?: Record<string, { themeKey?: FarmThemeKey }>
  createdAt: Date
  updatedAt: Date
}

export type FarmThemeKey = 'default' | 'cool' | 'warm'

export interface Channel {
  id: string
  farmId: string
  name: string              // without "#", e.g. "generale"
  description?: string
  createdAt: Date
  createdBy: string
  isDefault: boolean        // default channel cannot be archived
  isArchived: boolean
  lastMessageAt?: Date
  lastMessagePreview?: string
}

export type EventParticipationStatus = 'yes' | 'maybe' | 'no' | 'left'
export type EventParticipationRole = 'owner' | 'member'
export type EventParticipationAccessLevel = 'full' | 'readonly' | 'none'

export interface EventParticipation {
  status: EventParticipationStatus
  role?: EventParticipationRole
  accessLevel: EventParticipationAccessLevel
  respondedAt?: Date
}

export interface Expense {
  id: string
  title: string
  amount: number
  paidBy: string
  createdBy?: string
  participants: ExpenseParticipant[]
  eventId?: string
  notes?: string // 📝 Note e descrizioni aggiuntive
  splitType?: 'equal' | 'custom' | 'percentage' // 🎛️ Tipo di divisione
  attachments?: ExpenseAttachment[] // 📎 Allegati (scontrini, foto)
  comments?: ExpenseComment[] // 💬 Commenti e discussioni
  // IDs dei partecipanti per regole di sicurezza
  participantIds?: string[]
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
  // Optional scope for settlement: either per-event or per-farm
  farmId?: string
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
  sharedWith?: string[] // IDs degli utenti con cui è condivisa la lista
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
/**
 * Any emoji character used as a reaction key.
 * Legacy values 'like', 'love', 'fun' are still stored in Firestore for existing
 * messages; the UI maps them via resolveEmoji() in ReactionPill.tsx.
 */
export type ChatReactionKey = string

export interface ChatAttachment {
  id: string
  url: string
  name: string
  type: 'image' | 'video' | 'file' | 'audio'
  size?: number
  contentType?: string
  durationSeconds?: number // for audio/video
}

export interface ChatMessage {
  id: string
  eventId: string
  userId: string
  userName: string
  userPhotoURL?: string
  text?: string
  // Tagged users (by uid) extracted from @ mentions
  mentions?: string[]
  type?: 'text' | 'system' // Default 'text'
  systemType?: 'expense_created' | 'poll_created' | 'list_created' | 'event_updated'
  metadata?: {
    relatedId?: string // ID of the expense/poll/list
    amount?: number // For expenses
    title?: string // For titles
  }
  attachments?: ChatAttachment[]
  reactions?: Record<string, string[]>
  quoted?: {
    messageId: string
    textPreview?: string
    mediaThumbUrl?: string
  }
  createdAt: Date
  editedAt?: Date
  deleted?: boolean
  // Threading — populated when the message has replies
  replyCount?: number
  lastReplyAt?: Date
  lastReplyPreview?: string
}
