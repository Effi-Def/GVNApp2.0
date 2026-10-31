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
import { Poll } from '../../types'
import { toDate, toDateOrNow } from '../firestoreMappers'

export const pollReadService = {
  async getAll(): Promise<Poll[]> {
    try {
      const q = query(
        collection(db, 'polls'),
        orderBy('createdAt', 'desc'),
        limit(APP_CONFIG.PAGINATION_LIMIT),
      )
      const querySnapshot = await getDocs(q)

      const polls: Poll[] = querySnapshot.docs.map(d => {
        const data: any = d.data()
        return {
          id: d.id,
          ...data,
          createdAt: toDateOrNow(data.createdAt),
          updatedAt: toDateOrNow(data.updatedAt),
          votingEndsAt: toDate(data.votingEndsAt),
        }
      }) as Poll[]

      return polls
    } catch (error) {
      console.error('❌ Error fetching polls:', error)
      throw new Error('Errore durante il caricamento dei sondaggi')
    }
  },

  async getForUserVisibleEvents(params: { userId: string; eventIds: string[] }): Promise<Poll[]> {
    try {
      const uniqueEventIds = Array.from(new Set((params.eventIds || []).filter(Boolean)))
      const chunks: string[][] = []
      for (let i = 0; i < uniqueEventIds.length; i += 10) chunks.push(uniqueEventIds.slice(i, i + 10))

      const queries: Promise<any>[] = []
      queries.push(getDocs(query(collection(db, 'polls'), where('createdBy', '==', params.userId), limit(APP_CONFIG.PAGINATION_LIMIT))))

      for (const c of chunks) {
        queries.push(getDocs(query(collection(db, 'polls'), where('eventId', 'in', c), limit(APP_CONFIG.PAGINATION_LIMIT))))
      }

      const snaps = await Promise.allSettled(queries)
      const byId = new Map<string, Poll>()

      for (const s of snaps) {
        if (s.status !== 'fulfilled') continue
        for (const d of s.value.docs) {
          const data: any = d.data()
          byId.set(d.id, {
            id: d.id,
            ...data,
            createdAt: toDateOrNow(data.createdAt),
            updatedAt: toDateOrNow(data.updatedAt),
            votingEndsAt: toDate(data.votingEndsAt),
          } as Poll)
        }
      }

      const polls = Array.from(byId.values())
      polls.sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0))
      return polls
    } catch (error) {
      console.error('❌ Error fetching polls for user visible events:', error)
      throw new Error('Errore durante il caricamento dei sondaggi')
    }
  },

  async getByUserParticipation(userId: string, userEvents: string[]): Promise<Poll[]> {
    try {
      const q = query(collection(db, 'polls'), orderBy('createdAt', 'desc'), limit(APP_CONFIG.PAGINATION_LIMIT))
      const querySnapshot = await getDocs(q)

      const allPolls: Poll[] = querySnapshot.docs.map(d => {
        const data: any = d.data()
        return {
          id: d.id,
          ...data,
          createdAt: toDateOrNow(data.createdAt),
          updatedAt: toDateOrNow(data.updatedAt),
          votingEndsAt: toDate(data.votingEndsAt),
        }
      }) as Poll[]

      const filteredPolls = allPolls.filter(poll => {
        const isCreator = poll.createdBy === userId
        const isEventParticipant = poll.eventId && userEvents.includes(poll.eventId)
        const hasVoted = poll.votes && poll.votes.some(vote => vote.userId === userId)
        return isCreator || isEventParticipant || hasVoted
      })

      console.log(`✅ Filtered ${filteredPolls.length} polls for user (from ${allPolls.length} total)`)
      return filteredPolls
    } catch (error) {
      console.error('❌ Error in getByUserParticipation for polls:', error)
      throw new Error('Errore durante il caricamento dei sondaggi')
    }
  },
}
