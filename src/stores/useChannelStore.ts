import { create } from 'zustand'
import {
  doc,
  setDoc,
  collection,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { Channel } from '../types'
import { channelService } from '../services/firestore'
import { toDate } from '../services/firestoreMappers'

interface ChannelStore {
  /** Channels indexed by farmId */
  channelsByFarm: Record<string, Channel[]>
  /** Last-read timestamps by channelId (loaded from userPrivate/{uid}/channelReads) */
  channelReads: Record<string, Date>
  /** Unsubscribe handles for active farm listeners */
  _unsubs: Record<string, () => void>

  listenChannels: (farmId: string) => () => void
  stopListening: (farmId: string) => void
  loadReads: (userId: string) => () => void
  markRead: (userId: string, farmId: string, channelId: string) => Promise<void>
  getUnread: (channelId: string, channel: Channel) => boolean
}

export const useChannelStore = create<ChannelStore>((set, get) => ({
  channelsByFarm: {},
  channelReads: {},
  _unsubs: {},

  listenChannels(farmId) {
    const existing = get()._unsubs[farmId]
    if (existing) return existing   // already listening

    const unsub = channelService.listenChannels(farmId, (channels) => {
      set(s => ({ channelsByFarm: { ...s.channelsByFarm, [farmId]: channels } }))
    })

    set(s => ({ _unsubs: { ...s._unsubs, [farmId]: unsub } }))
    return unsub
  },

  stopListening(farmId) {
    const { _unsubs } = get()
    _unsubs[farmId]?.()
    set(s => {
      const next = { ...s._unsubs }
      delete next[farmId]
      return { _unsubs: next }
    })
  },

  /** Subscribe to userPrivate/{uid}/channelReads for real-time unread state. */
  loadReads(userId: string) {
    const colRef = collection(db, 'userPrivate', userId, 'channelReads')
    const unsub = onSnapshot(colRef, (snap) => {
      const reads: Record<string, Date> = {}
      snap.docs.forEach(d => {
        const ts = d.data().lastReadAt
        const date = toDate(ts)
        if (date) reads[d.id] = date
      })
      set({ channelReads: reads })
    })
    return unsub
  },

  async markRead(userId, _farmId, channelId) {
    const ref = doc(db, 'userPrivate', userId, 'channelReads', channelId)
    const now = new Date()
    await setDoc(ref, { lastReadAt: serverTimestamp() }, { merge: true })
    // Optimistic local update so the badge clears immediately
    set(s => ({ channelReads: { ...s.channelReads, [channelId]: now } }))
  },

  getUnread(channelId, channel) {
    if (!channel.lastMessageAt) return false
    const lastRead = get().channelReads[channelId]
    if (!lastRead) return true
    return channel.lastMessageAt.getTime() > lastRead.getTime() + 2000
  },
}))
