import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  limit,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { APP_CONFIG } from '../../constants'
import { Expense } from '../../types'
import { toDateOrNow } from '../firestoreMappers'

export const expenseReadService = {
  async getAll(): Promise<Expense[]> {
    try {
      console.log('💰 Fetching all expenses')
      const q = query(
        collection(db, 'expenses'),
        orderBy('createdAt', 'desc'),
        limit(APP_CONFIG.PAGINATION_LIMIT),
      )
      const querySnapshot = await getDocs(q)

      const expenses: Expense[] = querySnapshot.docs.map(d => {
        const data: any = d.data()
        return {
          id: d.id,
          ...data,
          createdAt: toDateOrNow(data.createdAt),
          updatedAt: toDateOrNow(data.updatedAt),
        }
      }) as Expense[]

      console.log(`✅ Fetched ${expenses.length} expenses`)
      return expenses
    } catch (error) {
      console.error('❌ Error fetching expenses:', error)
      throw new Error('Errore durante il caricamento delle spese')
    }
  },

  async getForEventIds(eventIds: string[]): Promise<Expense[]> {
    try {
      const uniqueEventIds = Array.from(new Set((eventIds || []).filter(Boolean)))
      if (uniqueEventIds.length === 0) return []

      const chunks: string[][] = []
      for (let i = 0; i < uniqueEventIds.length; i += 10) chunks.push(uniqueEventIds.slice(i, i + 10))

      const snaps = await Promise.allSettled(
        chunks.map(c => getDocs(query(collection(db, 'expenses'), where('eventId', 'in', c), limit(APP_CONFIG.PAGINATION_LIMIT)))),
      )

      const byId = new Map<string, Expense>()
      for (const s of snaps) {
        if (s.status !== 'fulfilled') continue
        for (const d of s.value.docs) {
          const data: any = d.data()
          byId.set(d.id, {
            id: d.id,
            ...data,
            createdAt: toDateOrNow(data.createdAt),
            updatedAt: toDateOrNow(data.updatedAt),
          } as Expense)
        }
      }

      const expenses = Array.from(byId.values())
      expenses.sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0))
      return expenses
    } catch (error) {
      console.error('❌ Error fetching expenses for eventIds:', error)
      throw new Error('Errore durante il caricamento delle spese')
    }
  },

  async getByUserParticipation(userId: string, _userEvents?: string[]): Promise<Expense[]> {
    try {
      console.log('💰 Fetching expenses for user (server-side participantIds filter)...')
      const q = query(
        collection(db, 'expenses'),
        where('participantIds', 'array-contains', userId),
        orderBy('createdAt', 'desc'),
        limit(APP_CONFIG.PAGINATION_LIMIT),
      )
      const querySnapshot = await getDocs(q)

      const expenses: Expense[] = querySnapshot.docs.map(d => {
        const data: any = d.data()
        return {
          id: d.id,
          ...data,
          createdAt: toDateOrNow(data.createdAt),
          updatedAt: toDateOrNow(data.updatedAt),
        }
      }) as Expense[]

      console.log(`✅ Fetched ${expenses.length} expenses for user`)
      return expenses
    } catch (error) {
      console.error('❌ Error fetching user expenses:', error)
      throw new Error('Errore durante il caricamento delle spese')
    }
  },
}
