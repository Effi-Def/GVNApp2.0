import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { APP_CONFIG } from '../../constants'
import { ShoppingList } from '../../types'
import { toDate, toDateOrNow } from '../firestoreMappers'

export const listReadService = {
  async getByEventId(eventId: string): Promise<ShoppingList[]> {
    try {
      const q = query(collection(db, 'lists'), where('eventId', '==', eventId), limit(APP_CONFIG.PAGINATION_LIMIT))
      const querySnapshot = await getDocs(q)

      const lists: ShoppingList[] = querySnapshot.docs.map(docSnap => {
        const data: any = docSnap.data()
        const items = Array.isArray(data.items)
          ? data.items.map((it: any) => ({
              ...it,
              addedAt: toDate(it?.addedAt),
              completedAt: toDate(it?.completedAt),
              dueDate: toDate(it?.dueDate),
            }))
          : []

        return {
          id: docSnap.id,
          ...data,
          items,
          createdAt: toDateOrNow(data.createdAt),
          updatedAt: toDateOrNow(data.updatedAt),
        } as ShoppingList
      })

      lists.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      return lists
    } catch (error) {
      console.error('❌ Error fetching lists:', error)
      throw new Error('Errore durante il caricamento delle liste')
    }
  },

  async getForUserVisibleEvents(params: { userId: string; eventIds: string[] }): Promise<ShoppingList[]> {
    try {
      const uniqueEventIds = Array.from(new Set((params.eventIds || []).filter(Boolean)))
      const chunks: string[][] = []
      for (let i = 0; i < uniqueEventIds.length; i += 10) chunks.push(uniqueEventIds.slice(i, i + 10))

      const queries: Promise<any>[] = []
      queries.push(getDocs(query(collection(db, 'lists'), where('createdBy', '==', params.userId), limit(APP_CONFIG.PAGINATION_LIMIT))))

      for (const c of chunks) {
        queries.push(getDocs(query(collection(db, 'lists'), where('eventId', 'in', c), limit(APP_CONFIG.PAGINATION_LIMIT))))
      }

      const snaps = await Promise.allSettled(queries)
      const docs: any[] = []
      for (const s of snaps) {
        if (s.status === 'fulfilled') docs.push(...s.value.docs)
      }

      const byId = new Map<string, ShoppingList>()
      for (const d of docs) {
        const data: any = d.data()
        const items = Array.isArray(data.items)
          ? data.items.map((it: any) => ({
              ...it,
              addedAt: toDate(it?.addedAt),
              completedAt: toDate(it?.completedAt),
              dueDate: toDate(it?.dueDate),
            }))
          : []

        byId.set(d.id, {
          id: d.id,
          ...data,
          items,
          createdAt: toDateOrNow(data.createdAt),
          updatedAt: toDateOrNow(data.updatedAt),
        } as ShoppingList)
      }

      const lists = Array.from(byId.values())
      lists.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      return lists
    } catch (error) {
      console.error('❌ Error fetching lists:', error)
      throw new Error('Errore durante il caricamento delle liste')
    }
  },
}
