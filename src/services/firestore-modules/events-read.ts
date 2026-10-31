import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { APP_CONFIG } from '../../constants'
import { Event } from '../../types'
import { mapFirestoreEvent } from './events-shared'

export const eventReadService = {
  async getAll(): Promise<Event[]> {
    try {
      console.log('📅 Fetching all events (ordered by date desc)')
      const q = query(
        collection(db, 'events'),
        orderBy('date', 'desc'),
        limit(APP_CONFIG.PAGINATION_LIMIT),
      )
      const querySnapshot = await getDocs(q)

      const events: Event[] = querySnapshot.docs.map(d => mapFirestoreEvent(d.id, d.data()))

      console.log(`✅ Fetched ${events.length} events`)
      return events
    } catch (error) {
      console.error('❌ Error fetching events:', error)
      throw new Error('Errore durante il caricamento degli eventi')
    }
  },

  async getMoreEvents(lastDoc: QueryDocumentSnapshot): Promise<{ events: Event[]; lastDoc: QueryDocumentSnapshot | null }> {
    try {
      console.log('📅 Fetching more events after doc:', lastDoc.id)
      const q = query(
        collection(db, 'events'),
        orderBy('date', 'desc'),
        startAfter(lastDoc),
        limit(APP_CONFIG.PAGINATION_LIMIT),
      )
      const querySnapshot = await getDocs(q)

      const events: Event[] = querySnapshot.docs.map(d => mapFirestoreEvent(d.id, d.data()))
      const docs = querySnapshot.docs
      const nextLastDoc = docs.length > 0 ? docs[docs.length - 1] : null

      console.log(`✅ Fetched ${events.length} more events`)
      return { events, lastDoc: nextLastDoc }
    } catch (error) {
      console.error('❌ Error fetching more events:', error)
      throw new Error('Errore durante il caricamento di altri eventi')
    }
  },

  async getById(id: string): Promise<Event | null> {
    try {
      const ref = doc(db, 'events', id)
      const snap = await getDoc(ref)
      if (!snap.exists()) return null
      return mapFirestoreEvent(snap.id, snap.data())
    } catch (e) {
      console.error('❌ Error fetching event by id:', e)
      return null
    }
  },
}
