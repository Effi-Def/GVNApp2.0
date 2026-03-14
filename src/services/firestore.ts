import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  Timestamp,
  onSnapshot
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { Event, Expense, Poll, ShoppingList, PaymentTransaction, ChatMessage, ChatAttachment, ChatReactionKey, EventParticipation, EventParticipationStatus } from '../types'
import { toDate } from '../utils/dates'
import { APP_CONFIG } from '../constants'
import { storage } from '../firebase/config'
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage'

// ─── Shared event mapping helper ────────────────────────────────────────────
// Maps a raw Firestore document to a typed Event, handling all date coercions.
function mapEventDoc(id: string, data: any): Event {
  const participants = Array.isArray(data.participants)
    ? data.participants.map((p: any) => ({
        ...p,
        respondedAt: toDate(p?.respondedAt) ?? new Date(),
        days: p?.days ?? undefined,
      }))
    : []

  const participation: Record<string, EventParticipation> | undefined = (() => {
    const raw = data.participation
    if (!raw || typeof raw !== 'object') return undefined
    const out: Record<string, EventParticipation> = {}
    for (const [uid, entry] of Object.entries(raw)) {
      const e: any = entry
      if (!e || typeof e !== 'object') continue
      const status = e.status as EventParticipationStatus | undefined
      const accessLevel = e.accessLevel as EventParticipation['accessLevel'] | undefined
      if (!status || !accessLevel) continue
      out[uid] = {
        status,
        accessLevel,
        role: e.role,
        respondedAt: toDate(e.respondedAt),
      }
    }
    return Object.keys(out).length ? out : undefined
  })()

  return {
    id,
    ...data,
    participants,
    participation,
    publicShareEnabled: data.publicShareEnabled !== false,
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
    date: toDate(data.date) ?? new Date(),
    endDate: toDate(data.endDate),
    chatLastActivityAt: toDate(data.chatLastActivityAt),
  } as Event
}
// ─────────────────────────────────────────────────────────────────────────────

// Events Service
export const eventService = {
  // Create new event
  async create(eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    try {
      console.log('📅 Creating new event:', eventData.title)
      
      // Rimuovi campi undefined per Firebase
      const cleanEventData = Object.fromEntries(
        Object.entries(eventData).filter(([_, value]) => value !== undefined)
      )
      
      // Extract participant IDs for security rules (visibility does NOT imply participation)
      const participantIds = (eventData.participants || []).map(p => p.userId)

      // Ensure creator has an explicit participation entry
      const participation: Record<string, EventParticipation> = (() => {
        const base: Record<string, EventParticipation> =
          eventData.participation && typeof eventData.participation === 'object'
            ? { ...eventData.participation }
            : {}
        if (eventData.createdBy && !base[eventData.createdBy]) {
          base[eventData.createdBy] = {
            status: 'yes',
            accessLevel: 'full',
            role: 'owner',
            respondedAt: new Date(),
          }
        }
        return base
      })()

      const docRef = await addDoc(collection(db, 'events'), {
        ...cleanEventData,
        participantIds,
        participation,
        publicShareEnabled: cleanEventData.publicShareEnabled !== false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })

      const newEvent: Event = {
        id: docRef.id,
        ...eventData,
        participantIds,
        participation,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      console.log('✅ Event created successfully:', newEvent.id)
      return newEvent
    } catch (error) {
      console.error('❌ Error creating event:', error)
      throw error
    }
  },

  // Get all events
  async getAll(): Promise<Event[]> {
    try {
      console.log('📅 Fetching all events (ordered by date desc)')
      const q = query(
        collection(db, 'events'),
        orderBy('date', 'desc'),
        limit(APP_CONFIG.PAGINATION_LIMIT)
      )
      const querySnapshot = await getDocs(q)
      const events = querySnapshot.docs.map(d => mapEventDoc(d.id, d.data()))
      console.log(`✅ Fetched ${events.length} events`)
      return events
    } catch (error) {
      console.warn('⚠️ Ordered query failed, falling back to unordered fetch:', error)
      try {
        const snap = await getDocs(collection(db, 'events'))
        const events = snap.docs.map(d => mapEventDoc(d.id, d.data()))
        events.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
        console.log(`✅ Fallback fetched ${events.length} events`)
        return events
      } catch (e) {
        console.error('❌ Error fetching events (fallback also failed):', e)
        throw new Error('Errore durante il caricamento degli eventi')
      }
    }
  },

  // Get more events for pagination
  async getMoreEvents(lastDate: Date): Promise<Event[]> {
    try {
      console.log('📅 Fetching more events after:', lastDate)
      const q = query(
        collection(db, 'events'),
        orderBy('date', 'desc'),
        startAfter(lastDate),
        limit(APP_CONFIG.PAGINATION_LIMIT)
      )
      const querySnapshot = await getDocs(q)
      const events = querySnapshot.docs.map(d => mapEventDoc(d.id, d.data()))
      console.log(`✅ Fetched ${events.length} more events`)
      return events
    } catch (error) {
      console.error('❌ Error fetching more events:', error)
      throw new Error('Errore durante il caricamento di altri eventi')
    }
  },

  // Get a single event by ID
  async getById(id: string): Promise<Event | null> {
    try {
      const snap = await getDoc(doc(db, 'events', id))
      if (!snap.exists()) return null
      return mapEventDoc(snap.id, snap.data())
    } catch (e) {
      console.error('❌ Error fetching event by id:', e)
      return null
    }
  },

  // Update event
  async update(id: string, eventData: Partial<Event>): Promise<void> {
    try {
      console.log('📅 Updating event:', id)
      const eventRef = doc(db, 'events', id)
      // Remove undefined to prevent Firestore from rejecting the update
      const cleanEventData = Object.fromEntries(
        Object.entries(eventData).filter(([_, value]) => value !== undefined)
      )
      await updateDoc(eventRef, {
        ...cleanEventData,
        updatedAt: Timestamp.now()
      })
      console.log('✅ Event updated successfully')
    } catch (error) {
      console.error('❌ Error updating event:', error)
      throw new Error('Errore durante l\'aggiornamento dell\'evento')
    }
  },

  // Delete event with cascading delete for related expenses, polls and lists
  async delete(id: string): Promise<void> {
    try {
      console.log('📅 Deleting event and related data:', id)
      
      // Delete all expenses related to this event
      const expensesQuery = query(collection(db, 'expenses'), where('eventId', '==', id))
      const expensesSnapshot = await getDocs(expensesQuery)
      const expenseDeletePromises = expensesSnapshot.docs.map(doc => deleteDoc(doc.ref))
      console.log(`🗑️ Found ${expensesSnapshot.docs.length} expenses to delete`)
      
      // Delete all polls related to this event
      const pollsQuery = query(collection(db, 'polls'), where('eventId', '==', id))
      const pollsSnapshot = await getDocs(pollsQuery)
      const pollDeletePromises = pollsSnapshot.docs.map(doc => deleteDoc(doc.ref))
      console.log(`🗑️ Found ${pollsSnapshot.docs.length} polls to delete`)

      // Delete all shopping lists related to this event
      const listsQuery = query(collection(db, 'lists'), where('eventId', '==', id))
      const listsSnapshot = await getDocs(listsQuery)
      const listDeletePromises = listsSnapshot.docs.map(doc => deleteDoc(doc.ref))
      console.log(`🗑️ Found ${listsSnapshot.docs.length} lists to delete`)
      
      // Execute all deletions in parallel
      await Promise.all([
        ...expenseDeletePromises,
        ...pollDeletePromises,
        ...listDeletePromises,
        deleteDoc(doc(db, 'events', id))
      ])
      
      console.log('✅ Event and all related data deleted successfully')
    } catch (error) {
      console.error('❌ Error deleting event and related data:', error)
      throw new Error('Errore durante l\'eliminazione dell\'evento e dei dati correlati')
    }
  },

  // Update user participation in an event
  async updateParticipation(eventId: string, userId: string, userName: string, status: 'yes' | 'no' | 'maybe'): Promise<void> {
    try {
      console.log(`📅 Updating participation for event ${eventId}, user ${userId}, status: ${status}`)
      
      const eventRef = doc(db, 'events', eventId)
      const eventDoc = await getDoc(eventRef)
      
      if (!eventDoc.exists()) {
        throw new Error('Evento non trovato')
      }
      
      const event = eventDoc.data() as any
      const participants = Array.isArray(event.participants) ? [...event.participants] : []

      const participation: Record<string, any> = (() => {
        const raw = event.participation
        if (!raw || typeof raw !== 'object') return {}
        return { ...raw }
      })()
      
      // Trova la partecipazione esistente dell'utente
      const existingIndex = participants.findIndex(p => p.userId === userId)
      
      if (existingIndex >= 0) {
        // Aggiorna la partecipazione esistente
        participants[existingIndex] = {
          ...participants[existingIndex],
          userId,
          name: userName,
          status,
          respondedAt: new Date()
        }
      } else {
        // Aggiungi nuova partecipazione
        participants.push({
          userId,
          name: userName,
          status,
          respondedAt: new Date()
        })
      }

      // Dual-write: explicit participation map (does not imply visibility)
      const accessLevel = status === 'no' ? 'readonly' : 'full'
      participation[userId] = {
        status,
        accessLevel,
        role: event.createdBy === userId ? 'owner' : 'member',
        respondedAt: Timestamp.now(),
      }
      
      // Update participantIds for security rules
      const participantIds = participants.map(p => p.userId)

      // Aggiorna il documento
      await updateDoc(eventRef, {
        participants,
        participation,
        participantIds,
        updatedAt: Timestamp.now()
      })
      
      console.log('✅ Participation updated successfully')
    } catch (error) {
      console.error('❌ Error updating participation:', error)
      throw error
    }
  },

  // Update per-day presence for a user in an event (keys are YYYY-MM-DD)
  async updateDailyPresence(eventId: string, userId: string, userName: string, daysKeys: string[]): Promise<void> {
    try {
      console.log(`📅 Updating daily presence for event ${eventId}, user ${userId}`)
      const eventRef = doc(db, 'events', eventId)
      const eventDoc = await getDoc(eventRef)
      if (!eventDoc.exists()) throw new Error('Evento non trovato')

      const event = eventDoc.data() as any
      const participants = Array.isArray(event.participants) ? [...event.participants] : []
      const existingIndex = participants.findIndex((p: any) => p.userId === userId)
      const days: Record<string, boolean> = {}
      for (const k of daysKeys) days[k] = true

      // Do not create participation implicitly. Daily presence is only allowed after explicit RSVP (status=yes).
      const participationEntry = event.participation && typeof event.participation === 'object' ? event.participation[userId] : undefined
      const statusFromParticipation = participationEntry?.status
      const legacyStatus = existingIndex >= 0 ? (participants[existingIndex] as any)?.status : undefined
      const effectiveStatus = statusFromParticipation || legacyStatus
      if (effectiveStatus !== 'yes') {
        throw new Error('Devi confermare la partecipazione (✅) prima di selezionare i giorni di presenza')
      }

      if (existingIndex >= 0) {
        const existing = participants[existingIndex] as any
        participants[existingIndex] = {
          ...existing,
          userId,
          name: userName,
          days,
          // Preserve existing respondedAt if present (Timestamp or Date), otherwise set now
          respondedAt: existing?.respondedAt || new Date()
        }
      } else {
        // If the legacy participant record is missing we prefer failing instead of implicitly creating it
        throw new Error('Partecipazione non trovata: effettua RSVP prima di selezionare i giorni')
      }

      await updateDoc(eventRef, { participants, updatedAt: Timestamp.now() })
      console.log('✅ Daily presence updated successfully')
    } catch (error) {
      console.error('❌ Error updating daily presence:', error)
      throw new Error('Errore durante l\'aggiornamento dei giorni di presenza')
    }
  }
}

// Expenses Service
export const expenseService = {
  async create(expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> {
    try {
      console.log('💰 Creating new expense:', expenseData.title)
      
      const participantIds = [
        expenseData.paidBy,
        ...expenseData.participants.map(p => p.userId)
      ]
      // Remove duplicates
      const uniqueParticipantIds = [...new Set(participantIds)]

      const docRef = await addDoc(collection(db, 'expenses'), {
        ...expenseData,
        participantIds: uniqueParticipantIds,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      
      const newExpense: Expense = {
        id: docRef.id,
        ...expenseData,
        participantIds: uniqueParticipantIds,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      // Send system message to chat
      if (expenseData.eventId) {
        chatService.sendSystemMessage(
          expenseData.eventId,
          'expense_created',
          `ha aggiunto una spesa: ${expenseData.title}`,
          { relatedId: newExpense.id, amount: expenseData.amount, title: expenseData.title },
          expenseData.paidBy
        ).catch(e => console.error('Failed to send system message:', e))
      }

      console.log('✅ Expense created successfully:', newExpense.id)
      return newExpense
    } catch (error) {
      console.error('❌ Error creating expense:', error)
      throw error
    }
  },

  async getAll(): Promise<Expense[]> {
    try {
      console.log('💰 Fetching all expenses')
      const q = query(
        collection(db, 'expenses'), 
        orderBy('createdAt', 'desc'),
        limit(APP_CONFIG.PAGINATION_LIMIT)
      )
      const querySnapshot = await getDocs(q)
      
      const expenses: Expense[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDate(doc.data().createdAt) ?? new Date(),
        updatedAt: toDate(doc.data().updatedAt) ?? new Date()
      })) as Expense[]
      
      console.log(`✅ Fetched ${expenses.length} expenses`)
      return expenses
    } catch (error) {
      console.error('❌ Error fetching expenses:', error)
      throw new Error('Errore durante il caricamento delle spese')
    }
  },

  // Get expenses filtered by user participation
  async getByUserParticipation(userId: string, userEvents: string[]): Promise<Expense[]> {
    try {
      console.log('💰 Fetching expenses for user events...')
      const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'))
      const querySnapshot = await getDocs(q)
      
      const allExpenses: Expense[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDate(doc.data().createdAt) ?? new Date(),
        updatedAt: toDate(doc.data().updatedAt) ?? new Date()
      })) as Expense[]
      
      // Filtra le spese in base alla partecipazione dell'utente
      const filteredExpenses = allExpenses.filter(expense => {
        // L'utente può vedere la spesa se:
        // 1. È lui che l'ha pagata
        // 2. È tra i partecipanti alla spesa
        // 3. La spesa è collegata a un evento a cui partecipa
        const isPayer = expense.paidBy === userId
        const isParticipant = expense.participants.some(p => p.userId === userId)
        const isEventParticipant = expense.eventId && userEvents.includes(expense.eventId)
        
        return isPayer || isParticipant || isEventParticipant
      })
      
      console.log(`✅ Filtered ${filteredExpenses.length} expenses for user (from ${allExpenses.length} total)`)
      return filteredExpenses
    } catch (error) {
      console.error('❌ Error fetching user expenses:', error)
      throw new Error('Errore durante il caricamento delle spese')
    }
  },

  async update(id: string, expenseData: Partial<Expense>): Promise<void> {
    try {
      await updateDoc(doc(db, 'expenses', id), {
        ...expenseData,
        updatedAt: Timestamp.now()
      })
    } catch (error) {
      console.error('❌ Error updating expense:', error)
      throw new Error('Errore durante l\'aggiornamento della spesa')
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'expenses', id))
    } catch (error) {
      console.error('❌ Error deleting expense:', error)
      throw new Error('Errore durante l\'eliminazione della spesa')
    }
  }
}

// Payment Transactions Service - 💸 NUOVO
export const paymentService = {
  async create(paymentData: Omit<PaymentTransaction, 'id' | 'createdAt'>): Promise<PaymentTransaction> {
    try {
      console.log('💸 Creating payment transaction:', paymentData.amount)
      const docRef = await addDoc(collection(db, 'payments'), {
        ...paymentData,
        createdAt: Timestamp.now()
      })
      
      const newPayment: PaymentTransaction = {
        id: docRef.id,
        ...paymentData,
        createdAt: new Date()
      }
      
      console.log('✅ Payment transaction created:', newPayment.id)
      return newPayment
    } catch (error) {
      console.error('❌ Error creating payment:', error)
      throw new Error('Errore durante la registrazione del pagamento')
    }
  },

  async getAll(): Promise<PaymentTransaction[]> {
    try {
      const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'))
      const querySnapshot = await getDocs(q)
      
      const payments: PaymentTransaction[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDate(doc.data().createdAt) ?? new Date()
      })) as PaymentTransaction[]
      
      return payments
    } catch (error) {
      console.error('❌ Error fetching payments:', error)
      throw new Error('Errore durante il caricamento dei pagamenti')
    }
  },

  async getByEvent(eventId: string): Promise<PaymentTransaction[]> {
    try {
      const q = query(
        collection(db, 'payments'), 
        where('eventId', '==', eventId),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(q)
      
      const payments: PaymentTransaction[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDate(doc.data().createdAt) ?? new Date()
      })) as PaymentTransaction[]
      
      return payments
    } catch (error) {
      console.error('❌ Error fetching payments for event:', error)
      throw new Error('Errore durante il caricamento dei pagamenti per l\'evento')
    }
  }
}

// Polls Service
export const pollService = {
  async create(pollData: Omit<Poll, 'id' | 'createdAt' | 'updatedAt' | 'votes'>): Promise<Poll> {
    try {
      console.log('📊 Creating new poll:', pollData.title)
      const docRef = await addDoc(collection(db, 'polls'), {
        ...pollData,
        votes: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      
      const newPoll: Poll = {
        id: docRef.id,
        ...pollData,
        votes: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      // Send system message to chat
      if (pollData.eventId) {
        chatService.sendSystemMessage(
          pollData.eventId,
          'poll_created',
          `ha creato un sondaggio: ${pollData.title}`,
          { relatedId: newPoll.id, title: pollData.title },
          pollData.createdBy
        ).catch(e => console.error('Failed to send system message:', e))
      }

      console.log('✅ Poll created successfully:', newPoll.id)
      return newPoll
    } catch (error) {
      console.error('❌ Error creating poll:', error)
      throw new Error('Errore durante la creazione del sondaggio')
    }
  },

  async getAll(): Promise<Poll[]> {
    try {
      const q = query(
        collection(db, 'polls'), 
        orderBy('createdAt', 'desc'),
        limit(APP_CONFIG.PAGINATION_LIMIT)
      )
      const querySnapshot = await getDocs(q)
      
      const polls: Poll[] = querySnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          createdAt: toDate(data.createdAt) ?? new Date(),
          updatedAt: toDate(data.updatedAt) ?? new Date(),
          votingEndsAt: toDate(data.votingEndsAt)
        }
      }) as Poll[]
      
      return polls
    } catch (error) {
      console.error('❌ Error fetching polls:', error)
      throw new Error('Errore durante il caricamento dei sondaggi')
    }
  },

  // Get polls filtered by user participation in events
  async getByUserParticipation(userId: string, userEvents: string[]): Promise<Poll[]> {
    try {
      console.log('📊 Starting getByUserParticipation for polls...')
      console.log('📊 UserId:', userId)
      console.log('📊 UserEvents:', userEvents)
      
      console.log('📊 Creating Firestore query...')
      const q = query(collection(db, 'polls'), orderBy('createdAt', 'desc'))
      
      console.log('📊 Executing Firestore query...')
      const querySnapshot = await getDocs(q)
      console.log(`📊 Firestore query completed, got ${querySnapshot.docs.length} documents`)
      
      const allPolls: Poll[] = querySnapshot.docs.map(doc => {
        const data = doc.data()
        console.log('📊 Processing poll document:', doc.id)
        return {
          id: doc.id,
          ...data,
          createdAt: toDate(data.createdAt) ?? new Date(),
          updatedAt: toDate(data.updatedAt) ?? new Date(),
          votingEndsAt: toDate(data.votingEndsAt)
        }
      }) as Poll[]
      
      console.log(`📊 Converted ${allPolls.length} documents to Poll objects`)
      
      // Filtra i sondaggi in base alla partecipazione dell'utente agli eventi
      console.log('📊 Starting filtering process...')
      const filteredPolls = allPolls.filter(poll => {
        // L'utente può vedere il sondaggio se:
        // 1. È lui che l'ha creato
        // 2. Il sondaggio è collegato a un evento a cui partecipa
        // 3. Ha già votato nel sondaggio
        const isCreator = poll.createdBy === userId
        const isEventParticipant = poll.eventId && userEvents.includes(poll.eventId)
        const hasVoted = poll.votes && poll.votes.some(vote => vote.userId === userId)
        
        const canSee = isCreator || isEventParticipant || hasVoted
        console.log(`📊 Poll ${poll.id}: creator=${isCreator}, eventParticipant=${isEventParticipant}, hasVoted=${hasVoted}, canSee=${canSee}`)
        
        return canSee
      })
      
      console.log(`✅ Filtered ${filteredPolls.length} polls for user (from ${allPolls.length} total)`)
      return filteredPolls
    } catch (error) {
      console.error('❌ Error in getByUserParticipation for polls:', error)
      if (error instanceof Error) {
        console.error('❌ Error details:', error.message, error.stack)
      }
      throw new Error('Errore durante il caricamento dei sondaggi')
    }
  },

  async update(id: string, pollData: Partial<Poll>): Promise<void> {
    try {
      const docRef = doc(db, 'polls', id)
      const updateData = {
        ...pollData,
        updatedAt: Timestamp.now()
      }
      delete updateData.id
      delete updateData.createdAt
      
      await updateDoc(docRef, updateData)
      console.log('✅ Poll updated successfully:', id)
    } catch (error) {
      console.error('❌ Error updating poll:', error)
      throw new Error('Errore durante l\'aggiornamento del sondaggio')
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'polls', id))
    } catch (error) {
      console.error('❌ Error deleting poll:', error)
      throw new Error('Errore durante l\'eliminazione del sondaggio')
    }
  }
}

// Shopping Lists Service
export const listService = {
  async create(listData: Omit<ShoppingList, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShoppingList> {
    try {
      console.log('📋 Creating new list:', listData.title)
      // Helper to remove undefined fields deeply while preserving Date objects
      const cleanUndefinedDeep = (value: any): any => {
        if (value instanceof Date) return value
        if (Array.isArray(value)) return value.map(cleanUndefinedDeep)
        if (value && typeof value === 'object') {
          const result: any = {}
          for (const [k, v] of Object.entries(value)) {
            if (v !== undefined) {
              const cleaned = cleanUndefinedDeep(v)
              if (cleaned !== undefined) result[k] = cleaned
            }
          }
          return result
        }
        return value
      }

      const dataToWrite = cleanUndefinedDeep({
        ...listData,
        sharedWith: listData.sharedWith || [listData.createdBy],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })

      const docRef = await addDoc(collection(db, 'lists'), dataToWrite)
      
      const newList: ShoppingList = {
        id: docRef.id,
        ...listData,
        sharedWith: listData.sharedWith || [listData.createdBy],
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      // Send system message to chat
      if (listData.eventId) {
        chatService.sendSystemMessage(
          listData.eventId,
          'list_created',
          `ha creato una lista: ${listData.title}`,
          { relatedId: newList.id, title: listData.title },
          listData.createdBy
        ).catch(e => console.error('Failed to send system message:', e))
      }

      console.log('✅ List created successfully:', newList.id)
      return newList
    } catch (error) {
      console.error('❌ Error creating list:', error)
      throw error
    }
  },

  async getAll(): Promise<ShoppingList[]> {
    try {
      const q = query(
        collection(db, 'lists'), 
        orderBy('createdAt', 'desc'),
        limit(APP_CONFIG.PAGINATION_LIMIT)
      )
      const querySnapshot = await getDocs(q)
      
      const lists: ShoppingList[] = querySnapshot.docs.map(doc => {
        const data: any = doc.data()
        // Normalizza le date anche dentro gli items
        const items = Array.isArray(data.items)
          ? data.items.map((it: any) => ({
              ...it,
              addedAt: it?.addedAt?.toDate ? it.addedAt.toDate() : it?.addedAt,
              completedAt: it?.completedAt?.toDate ? it.completedAt.toDate() : it?.completedAt,
              dueDate: it?.dueDate?.toDate ? it.dueDate.toDate() : it?.dueDate,
            }))
          : []

        return {
          id: doc.id,
          ...data,
          items,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
        } as ShoppingList
      })
      
      return lists
    } catch (error) {
      console.error('❌ Error fetching lists:', error)
      throw new Error('Errore durante il caricamento delle liste')
    }
  },

  async update(id: string, listData: Partial<ShoppingList>): Promise<void> {
    try {
      const docRef = doc(db, 'lists', id)
      const updateData: any = {
        ...listData,
        updatedAt: Timestamp.now()
      }
      delete updateData.id
      delete updateData.createdAt
      // Helper to remove undefined fields deeply while preserving Date objects
      const cleanUndefinedDeep = (value: any): any => {
        if (value instanceof Date) return value
        if (Array.isArray(value)) return value.map(cleanUndefinedDeep)
        if (value && typeof value === 'object') {
          const result: any = {}
          for (const [k, v] of Object.entries(value)) {
            if (v !== undefined) {
              const cleaned = cleanUndefinedDeep(v)
              if (cleaned !== undefined) result[k] = cleaned
            }
          }
          return result
        }
        return value
      }
      const sanitized = cleanUndefinedDeep(updateData)
      
      await updateDoc(docRef, sanitized)
      console.log('✅ List updated successfully:', id)
    } catch (error) {
      console.error('❌ Error updating list:', error)
      const e: any = error
      if (e && (e.code || e.name === 'FirebaseError')) {
        throw e
      }
      throw new Error(`Errore durante l'aggiornamento della lista: ${e?.message ?? ''}`)
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'lists', id))
      console.log('✅ List deleted successfully:', id)
    } catch (error) {
      console.error('❌ Error deleting list:', error)
      throw new Error('Errore durante l\'eliminazione della lista')
    }
  }
}

// Users Service (profiles and notification settings)
export const userService = {
  async get(userId: string): Promise<{ profile?: any; notifications?: any } | null> {
    try {
      const ref = doc(db, 'users', userId)
      const snap = await getDoc(ref)
      if (!snap.exists()) return null
      return snap.data() as any
    } catch (e) {
      console.error('❌ Error fetching user settings:', e)
      throw e
    }
  },
  async createOrUpdate(userId: string, data: any): Promise<void> {
    try {
      const ref = doc(db, 'users', userId)
      // setDoc with merge will create the doc if missing and update otherwise
      const { setDoc } = await import('firebase/firestore')
      await setDoc(ref, data, { merge: true })
    } catch (e) {
      console.error('❌ Error creating/updating user settings:', e)
      throw e
    }
  },
  async updatePartial(userId: string, data: any): Promise<void> {
    try {
      const ref = doc(db, 'users', userId)
      const { setDoc } = await import('firebase/firestore')

      const deepClean = (value: any): any => {
        if (value === undefined) return undefined
        if (value === null) return null
        if (Array.isArray(value)) {
          return value.map(deepClean)
        }
        if (typeof value === 'object') {
          const entries = Object.entries(value)
            .map(([k, v]) => [k, deepClean(v)] as const)
            .filter(([_, v]) => v !== undefined)
          return Object.fromEntries(entries)
        }
        return value
      }

      const sanitized = deepClean(data)
      await setDoc(ref, sanitized, { merge: true })
    } catch (e) {
      console.error('❌ Error updating user settings:', e)
      throw e
    }
  },
  async addFcmToken(userId: string, token: string): Promise<void> {
    try {
      const { setDoc, arrayUnion } = await import('firebase/firestore')
      const ref = doc(db, 'users', userId)
      // Use setDoc with merge: true to safely update nested fields without overwriting the whole map
      await setDoc(ref, { 
        notifications: { 
          fcmToken: token,
          fcmTokens: arrayUnion(token), 
          pushEnabled: true 
        } 
      }, { merge: true })
    } catch (e) {
      console.error('❌ Error adding FCM token:', e)
    }
  }
}

// 💬 Event Chat Service (v1)
export const chatService = {
  // Send a system message
  async sendSystemMessage(
    eventId: string,
    systemType: 'expense_created' | 'poll_created' | 'list_created' | 'event_updated',
    text: string,
    metadata?: { relatedId?: string; amount?: number; title?: string },
    userId: string = 'system'
  ) {
    const { addDoc, collection, Timestamp, updateDoc, doc } = await import('firebase/firestore')
    const col = collection(db, 'events', eventId, 'messages')
    
    await addDoc(col, {
      eventId,
      userId,
      userName: 'System', // UI will resolve name from userId if needed
      text,
      type: 'system',
      systemType,
      metadata,
      createdAt: Timestamp.now(),
      deleted: false
    })

    // Update event chat last activity
    try {
      await updateDoc(doc(db, 'events', eventId), { chatLastActivityAt: Timestamp.now(), updatedAt: Timestamp.now() })
    } catch {}
  },

  // Listen to messages for an event in real-time (ascending by createdAt)
  listen(eventId: string, cb: (messages: ChatMessage[]) => void, onError?: (e: any) => void) {
    const col = collection(db, 'events', eventId, 'messages')
    const qy = query(col, orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const msgs: ChatMessage[] = snap.docs.map(d => {
          const data: any = d.data()
          return {
            id: d.id,
            eventId,
            userId: data.userId,
            userName: data.userName,
            userPhotoURL: data.userPhotoURL,
            text: data.text,
            type: data.type || 'text',
            systemType: data.systemType,
            metadata: data.metadata,
            attachments: Array.isArray(data.attachments) ? data.attachments : undefined,
            reactions: data.reactions || undefined,
            mentions: Array.isArray(data.mentions) ? data.mentions : undefined,
            createdAt: toDate(data.createdAt),
            editedAt: data.editedAt ? toDate(data.editedAt) : undefined,
            deleted: !!data.deleted,
          }
        })
        cb(msgs)
      },
      (err) => {
        console.error('❌ Chat listener error:', err)
        onError?.(err)
      }
    )
    return unsub
  },

  // Send a message with optional attachments and quoted reply
  async sendMessage(
    eventId: string,
    payload: { text?: string; files?: File[]; quoted?: { messageId: string; textPreview?: string; mediaThumbUrl?: string }; mentions?: string[] },
    user: { id: string; displayName: string; photoURL?: string },
    onProgress?: (fileName: string, progress: number) => void
  ) {
    // Clean undefined values from quoted to avoid Firestore errors
    const cleanQuoted = payload.quoted ? {
      messageId: payload.quoted.messageId,
      ...(payload.quoted.textPreview && { textPreview: payload.quoted.textPreview }),
      ...(payload.quoted.mediaThumbUrl && { mediaThumbUrl: payload.quoted.mediaThumbUrl }),
    } : null
    
    const base = {
      userId: user.id,
      userName: user.displayName || 'Utente',
      userPhotoURL: user.photoURL || null,
      text: payload.text || null,
      mentions: payload.mentions && payload.mentions.length > 0 ? payload.mentions : null,
      attachments: [] as ChatAttachment[],
      reactions: { like: [], love: [], fun: [] } as Partial<Record<ChatReactionKey, string[]>>,
      quoted: cleanQuoted,
      deleted: false,
      createdAt: Timestamp.now(),
    }

    // Create doc first to get id (use optimistic empty attachments, update after upload)
    const col = collection(db, 'events', eventId, 'messages')
    const docRef = await addDoc(col, base)
    // Update event chat last activity
    try {
      await updateDoc(doc(db, 'events', eventId), { chatLastActivityAt: Timestamp.now(), updatedAt: Timestamp.now() })
    } catch {}

    // Upload files if any
    if (payload.files && payload.files.length > 0) {
      const uploaded: ChatAttachment[] = []
      for (const f of payload.files) {
        const path = `events/${eventId}/chat/${docRef.id}/${encodeURIComponent(f.name)}`
        const r = ref(storage, path)
        const task = uploadBytesResumable(r, f)
        await new Promise<void>((resolve, reject) => {
          task.on('state_changed', (snap) => {
            const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0
            onProgress?.(f.name, pct)
          }, reject, async () => {
            resolve()
          })
        })
        const url = await getDownloadURL(r)
        uploaded.push({
          id: crypto.randomUUID(),
          url,
          name: f.name,
          type: f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') ? 'audio' : 'file',
          size: f.size,
          contentType: f.type,
        })
      }
      await updateDoc(docRef, { attachments: uploaded })
    }
  },

  // Edit a message (own message)
  async editMessage(eventId: string, messageId: string, newText: string) {
    const refDoc = doc(db, 'events', eventId, 'messages', messageId)
    await updateDoc(refDoc, { text: newText, editedAt: Timestamp.now() })
  },

  // Soft delete a message (own message)
  async deleteMessage(eventId: string, messageId: string) {
    const refDoc = doc(db, 'events', eventId, 'messages', messageId)
    await updateDoc(refDoc, { deleted: true, text: null })
  },

  // Toggle reaction from user
  async toggleReaction(eventId: string, messageId: string, key: ChatReactionKey, userId: string, hasReacted: boolean) {
    const refDoc = doc(db, 'events', eventId, 'messages', messageId)
    const { arrayUnion, arrayRemove } = await import('firebase/firestore')
    // Field path like reactions.like
    const field = `reactions.${key}` as any
    await updateDoc(refDoc, { [field]: hasReacted ? arrayRemove(userId) : arrayUnion(userId) })
  },

  // Participants lastReadAt tracking
  async markRead(eventId: string, userId: string, profile?: { displayName?: string; photoURL?: string }) {
    const { setDoc, serverTimestamp } = await import('firebase/firestore')
    const pRef = doc(db, 'events', eventId, 'participants', userId)
    await setDoc(pRef, {
      lastReadAt: serverTimestamp(),
      displayName: profile?.displayName || null,
      photoUrl: profile?.photoURL || null
    }, { merge: true })
  },
  listenParticipants(eventId: string, cb: (participants: { uid: string; lastReadAt?: Date; displayName?: string; photoUrl?: string }[]) => void) {
    const colRef = collection(db, 'events', eventId, 'participants')
    const unsub = onSnapshot(colRef, (snap) => {
      const list = snap.docs.map(d => {
        const data: any = d.data()
        return {
          uid: d.id,
          lastReadAt: toDate(data.lastReadAt),
          displayName: data.displayName,
          photoUrl: data.photoUrl,
        }
      })
      cb(list)
    })
    return unsub
  },

  // Count unread messages for a user in an event (messages created after lastReadAt)
  async getUnreadCount(eventId: string, lastReadAt: Date): Promise<number> {
    try {
      const { getCountFromServer } = await import('firebase/firestore')
      const q = query(
        collection(db, 'events', eventId, 'messages'),
        where('createdAt', '>', Timestamp.fromDate(lastReadAt)),
        where('deleted', '==', false)
      )
      const snap = await getCountFromServer(q)
      return snap.data().count
    } catch {
      return 0
    }
  },

  // Typing indicator
  async setTyping(eventId: string, userId: string, typing: boolean) {
    const { setDoc, serverTimestamp } = await import('firebase/firestore')
    const tRef = doc(db, 'events', eventId, 'typing', userId)
    await setDoc(tRef, { typing, updatedAt: serverTimestamp() }, { merge: true })
  },
  listenTyping(eventId: string, cb: (typingUsers: { uid: string; updatedAt: Date; typing: boolean }[]) => void) {
    const colRef = collection(db, 'events', eventId, 'typing')
    const unsub = onSnapshot(colRef, (snap) => {
      const list = snap.docs.map(d => {
        const data: any = d.data()
        return { uid: d.id, updatedAt: toDate(data.updatedAt) ?? new Date(), typing: !!data.typing }
      })
      cb(list)
    })
    return unsub
  }
}
