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
  Timestamp 
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { Event, Expense, Poll, ShoppingList, PaymentTransaction } from '../types'

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
      
      const docRef = await addDoc(collection(db, 'events'), {
        ...cleanEventData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      
      const newEvent: Event = {
        id: docRef.id,
        ...eventData,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      console.log('✅ Event created successfully:', newEvent.id)
      return newEvent
    } catch (error) {
      console.error('❌ Error creating event:', error)
      throw new Error('Errore durante la creazione dell\'evento')
    }
  },

  // Get all events
  async getAll(): Promise<Event[]> {
    try {
      console.log('📅 Fetching all events')
      const q = query(collection(db, 'events'), orderBy('date', 'desc'))
      const querySnapshot = await getDocs(q)
      
      const events: Event[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        date: doc.data().date?.toDate() || new Date()
      })) as Event[]
      
      console.log(`✅ Fetched ${events.length} events`)
      return events
    } catch (error) {
      console.error('❌ Error fetching events:', error)
      throw new Error('Errore durante il caricamento degli eventi')
    }
  },

  // Update event
  async update(id: string, eventData: Partial<Event>): Promise<void> {
    try {
      console.log('📅 Updating event:', id)
      const eventRef = doc(db, 'events', id)
      await updateDoc(eventRef, {
        ...eventData,
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
      
      const event = eventDoc.data() as Event
      const participants = event.participants || []
      
      // Trova la partecipazione esistente dell'utente
      const existingIndex = participants.findIndex(p => p.userId === userId)
      
      if (existingIndex >= 0) {
        // Aggiorna la partecipazione esistente
        participants[existingIndex] = {
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
      
      // Aggiorna il documento
      await updateDoc(eventRef, {
        participants,
        updatedAt: Timestamp.now()
      })
      
      console.log('✅ Participation updated successfully')
    } catch (error) {
      console.error('❌ Error updating participation:', error)
      throw new Error('Errore durante l\'aggiornamento della partecipazione')
    }
  }
}

// Expenses Service
export const expenseService = {
  async create(expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> {
    try {
      console.log('💰 Creating new expense:', expenseData.title)
      const docRef = await addDoc(collection(db, 'expenses'), {
        ...expenseData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      
      const newExpense: Expense = {
        id: docRef.id,
        ...expenseData,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      console.log('✅ Expense created successfully:', newExpense.id)
      return newExpense
    } catch (error) {
      console.error('❌ Error creating expense:', error)
      throw new Error('Errore durante la creazione della spesa')
    }
  },

  async getAll(): Promise<Expense[]> {
    try {
      console.log('💰 Fetching all expenses')
      const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'))
      const querySnapshot = await getDocs(q)
      
      const expenses: Expense[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
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
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
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
        createdAt: doc.data().createdAt?.toDate() || new Date()
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
        createdAt: doc.data().createdAt?.toDate() || new Date()
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
      
      console.log('✅ Poll created successfully:', newPoll.id)
      return newPoll
    } catch (error) {
      console.error('❌ Error creating poll:', error)
      throw new Error('Errore durante la creazione del sondaggio')
    }
  },

  async getAll(): Promise<Poll[]> {
    try {
      const q = query(collection(db, 'polls'), orderBy('createdAt', 'desc'))
      const querySnapshot = await getDocs(q)
      
      const polls: Poll[] = querySnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          votingEndsAt: data.votingEndsAt?.toDate() || undefined
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
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          votingEndsAt: data.votingEndsAt?.toDate() || undefined
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
      const docRef = await addDoc(collection(db, 'lists'), {
        ...listData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      
      const newList: ShoppingList = {
        id: docRef.id,
        ...listData,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      console.log('✅ List created successfully:', newList.id)
      return newList
    } catch (error) {
      console.error('❌ Error creating list:', error)
      throw new Error('Errore durante la creazione della lista')
    }
  },

  async getAll(): Promise<ShoppingList[]> {
    try {
      const q = query(collection(db, 'lists'), orderBy('createdAt', 'desc'))
      const querySnapshot = await getDocs(q)
      
      const lists: ShoppingList[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as ShoppingList[]
      
      return lists
    } catch (error) {
      console.error('❌ Error fetching lists:', error)
      throw new Error('Errore durante il caricamento delle liste')
    }
  },

  async update(id: string, listData: Partial<ShoppingList>): Promise<void> {
    try {
      const docRef = doc(db, 'lists', id)
      const updateData = {
        ...listData,
        updatedAt: Timestamp.now()
      }
      delete updateData.id
      delete updateData.createdAt
      
      await updateDoc(docRef, updateData)
      console.log('✅ List updated successfully:', id)
    } catch (error) {
      console.error('❌ Error updating list:', error)
      throw new Error('Errore durante l\'aggiornamento della lista')
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
      return null
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
      await updateDoc(ref, data)
    } catch (e) {
      console.error('❌ Error updating user settings:', e)
      throw e
    }
  }
}
