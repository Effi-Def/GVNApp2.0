import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  writeBatch,
  runTransaction,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { Event, EventParticipation } from '../../types'
import { buildParticipantIds, cleanUndefinedDeep } from './events-shared'

export const eventWriteService = {
  async create(eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    try {
      console.log('📅 Creating new event:', eventData.title)

      const cleanEventData: any = cleanUndefinedDeep(eventData)
      const participantIds = buildParticipantIds(eventData.participants, (eventData as any).createdBy)

      const participation = (() => {
        const createdBy = (eventData as any).createdBy
        if (!createdBy) return (eventData as any).participation
        const base = (eventData as any).participation && typeof (eventData as any).participation === 'object'
          ? { ...(eventData as any).participation }
          : {}
        if (!base[createdBy]) {
          base[createdBy] = {
            status: 'yes',
            accessLevel: 'full',
            role: 'owner',
            respondedAt: Timestamp.now(),
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
        updatedAt: Timestamp.now(),
      })

      const newEvent: Event = {
        id: docRef.id,
        ...eventData,
        participantIds,
        participation: participation as Record<string, EventParticipation> | undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      console.log('✅ Event created successfully:', newEvent.id)
      return newEvent
    } catch (error) {
      console.error('❌ Error creating event:', error)
      throw error
    }
  },

  async update(id: string, eventData: Partial<Event>): Promise<void> {
    try {
      console.log('📅 Updating event:', id)
      const eventRef = doc(db, 'events', id)
      const cleanEventData = cleanUndefinedDeep(eventData) as Record<string, unknown>

      if (Array.isArray(eventData.participants)) {
        cleanEventData.participantIds = buildParticipantIds(eventData.participants, eventData.createdBy)
      }

      const payload = cleanUndefinedDeep({
        ...cleanEventData,
        updatedAt: Timestamp.now(),
      })
      await updateDoc(eventRef, payload)
      console.log('✅ Event updated successfully')
    } catch (error) {
      console.error('❌ Error updating event:', error)
      throw new Error('Errore durante l\'aggiornamento dell\'evento')
    }
  },

  async delete(id: string): Promise<void> {
    try {
      console.log('📅 Deleting event and related data:', id)

      const [expensesSnapshot, pollsSnapshot, listsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'expenses'), where('eventId', '==', id))),
        getDocs(query(collection(db, 'polls'), where('eventId', '==', id))),
        getDocs(query(collection(db, 'lists'), where('eventId', '==', id))),
      ])

      const BATCH_LIMIT = 499
      const allRelatedDocs = [
        ...expensesSnapshot.docs,
        ...pollsSnapshot.docs,
        ...listsSnapshot.docs,
      ]
      for (let i = 0; i < allRelatedDocs.length; i += BATCH_LIMIT) {
        const chunk = allRelatedDocs.slice(i, i + BATCH_LIMIT)
        const b = writeBatch(db)
        chunk.forEach(d => b.delete(d.ref))
        await b.commit()
      }
      const finalBatch = writeBatch(db)
      finalBatch.delete(doc(db, 'events', id))
      await finalBatch.commit()

      console.log('✅ Event and all related data deleted successfully')
    } catch (error) {
      console.error('❌ Error deleting event and related data:', error)
      throw new Error('Errore durante l\'eliminazione dell\'evento e dei dati correlati')
    }
  },

  async updateParticipation(eventId: string, userId: string, userName: string, status: 'yes' | 'no' | 'maybe'): Promise<void> {
    try {
      console.log(`📅 Updating participation for event ${eventId}, user ${userId}, status: ${status}`)

      const eventRef = doc(db, 'events', eventId)
      await runTransaction(db, async (transaction) => {
        const eventDoc = await transaction.get(eventRef)
        if (!eventDoc.exists()) throw new Error('Evento non trovato')

        const event = eventDoc.data() as any
        const participants = Array.isArray(event.participants) ? [...event.participants] : []
        const participation: Record<string, any> = (
          event.participation && typeof event.participation === 'object'
            ? { ...event.participation }
            : {}
        )

        const existingIndex = participants.findIndex((p: any) => p.userId === userId)
        if (existingIndex >= 0) {
          participants[existingIndex] = {
            ...participants[existingIndex],
            userId,
            name: userName,
            status,
            respondedAt: Timestamp.now(),
          }
        } else {
          participants.push({ userId, name: userName, status, respondedAt: Timestamp.now() })
        }

        const accessLevel = status === 'no' ? 'readonly' : 'full'
        participation[userId] = {
          status,
          accessLevel,
          role: event.createdBy === userId ? 'owner' : 'member',
          respondedAt: Timestamp.now(),
        }

        const participantIds = buildParticipantIds(participants, event.createdBy)
        transaction.update(eventRef, cleanUndefinedDeep({ participants, participation, participantIds, updatedAt: Timestamp.now() }))
      })

      console.log('✅ Participation updated successfully')
    } catch (error) {
      console.error('❌ Error updating participation:', error)
      throw error
    }
  },

  async updateDailyPresence(eventId: string, userId: string, userName: string, daysKeys: string[]): Promise<void> {
    try {
      console.log(`📅 Updating daily presence for event ${eventId}, user ${userId}`)
      const eventRef = doc(db, 'events', eventId)

      await runTransaction(db, async (transaction) => {
        const eventDoc = await transaction.get(eventRef)
        if (!eventDoc.exists()) throw new Error('Evento non trovato')

        const event = eventDoc.data() as any
        const participants = Array.isArray(event.participants) ? [...event.participants] : []
        const existingIndex = participants.findIndex((p: any) => p.userId === userId)

        const days: Record<string, boolean> = {}
        for (const k of daysKeys) days[k] = true

        const participationEntry = event.participation && typeof event.participation === 'object'
          ? event.participation[userId]
          : undefined
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
            respondedAt: existing?.respondedAt || Timestamp.now(),
          }
        } else {
          throw new Error('Partecipazione non trovata: effettua RSVP prima di selezionare i giorni')
        }

        transaction.update(eventRef, { participants, updatedAt: Timestamp.now() })
      })

      console.log('✅ Daily presence updated successfully')
    } catch (error) {
      console.error('❌ Error updating daily presence:', error)
      if (error instanceof Error && error.message) {
        throw new Error(error.message)
      }
      throw new Error('Errore durante l\'aggiornamento dei giorni di presenza')
    }
  },

  async voteOnProposedDate(eventId: string, userId: string, dateKey: string): Promise<void> {
    try {
      if (!eventId || !userId || !dateKey) return
      const eventRef = doc(db, 'events', eventId)
      await updateDoc(eventRef, {
        [`dateVotes.${userId}`]: dateKey,
        updatedAt: Timestamp.now(),
      })
    } catch (error) {
      console.error('❌ Error voting on proposed date:', error)
      throw error
    }
  },

  async finalizeProposedDate(eventId: string, dateKey: string): Promise<void> {
    try {
      if (!eventId || !dateKey) return

      const eventRef = doc(db, 'events', eventId)
      const snap = await getDoc(eventRef)
      if (!snap.exists()) throw new Error('Evento non trovato')

      const data: any = snap.data()
      const proposedDates = Array.isArray(data?.proposedDates) ? data.proposedDates : []
      if (proposedDates.length > 0 && !proposedDates.includes(dateKey)) {
        throw new Error('Data non valida')
      }

      const [y, m, d] = String(dateKey).split('-').map((n: string) => Number(n))
      const chosenDate = (y && m && d) ? new Date(y, m - 1, d) : new Date()

      await updateDoc(eventRef, {
        date: Timestamp.fromDate(chosenDate),
        selectedDateKey: String(dateKey),
        dateFinalized: true,
        status: 'scheduled',
        finalizedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    } catch (error) {
      console.error('❌ Error finalizing proposed date:', error)
      throw error
    }
  },
}
