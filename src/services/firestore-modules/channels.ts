import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  Timestamp,
  getCountFromServer,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { Channel } from '../../types'
import { toDate, toDateOrNow } from '../firestoreMappers'

const MAX_CHANNELS = 10

function mapChannel(d: any): Channel {
  const data: any = d.data()
  return {
    id: d.id,
    farmId: data.farmId || '',
    name: data.name || '',
    description: data.description,
    createdAt: toDateOrNow(data.createdAt),
    createdBy: data.createdBy || '',
    isDefault: !!data.isDefault,
    isArchived: !!data.isArchived,
    lastMessageAt: toDate(data.lastMessageAt),
    lastMessagePreview: data.lastMessagePreview,
  }
}

export const channelService = {
  /**
   * Create a new channel in a farm.
   * Uses a transaction to enforce the MAX_CHANNELS limit atomically.
   * Throws if count >= MAX_CHANNELS.
   */
  async create(farmId: string, opts: {
    name: string
    description?: string
    createdBy: string
    isDefault?: boolean
  }): Promise<Channel> {
    const channelsRef = collection(db, 'farms', farmId, 'channels')

    return runTransaction(db, async (tx) => {
      // Count non-archived channels (reads must come before writes in a transaction)
      const snap = await getCountFromServer(
        query(channelsRef, orderBy('createdAt', 'asc'))
      )
      const total = snap.data().count
      if (total >= MAX_CHANNELS) {
        throw new Error(`Limite canali raggiunto (max ${MAX_CHANNELS})`)
      }

      const now = Timestamp.now()
      const newRef = doc(channelsRef)
      const payload = {
        farmId,
        name: opts.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: opts.description ?? null,
        createdAt: now,
        createdBy: opts.createdBy,
        isDefault: opts.isDefault ?? false,
        isArchived: false,
        lastMessageAt: null,
        lastMessagePreview: null,
      }
      tx.set(newRef, payload)
      const { description: _d, lastMessageAt: _lm, lastMessagePreview: _lp, ...rest } = payload
      return {
        id: newRef.id,
        ...rest,
        description: opts.description,
        createdAt: now.toDate(),
      } as Channel
    })
  },

  /** Ensure the default #generale channel exists (idempotent). */
  async ensureDefaultChannel(farmId: string, ownerId: string): Promise<void> {
    const channelsRef = collection(db, 'farms', farmId, 'channels')
    const snap = await getCountFromServer(query(channelsRef))
    if (snap.data().count > 0) return   // already has channels

    await addDoc(channelsRef, {
      farmId,
      name: 'generale',
      description: 'Il canale principale della fattoria',
      createdAt: Timestamp.now(),
      createdBy: ownerId,
      isDefault: true,
      isArchived: false,
      lastMessageAt: null,
      lastMessagePreview: null,
    })
  },

  async archive(farmId: string, channelId: string): Promise<void> {
    const ref = doc(db, 'farms', farmId, 'channels', channelId)
    await updateDoc(ref, { isArchived: true, updatedAt: Timestamp.now() })
  },

  async unarchive(farmId: string, channelId: string): Promise<void> {
    const ref = doc(db, 'farms', farmId, 'channels', channelId)
    await updateDoc(ref, { isArchived: false, updatedAt: Timestamp.now() })
  },

  listenChannels(farmId: string, cb: (channels: Channel[]) => void): () => void {
    const q = query(
      collection(db, 'farms', farmId, 'channels'),
      orderBy('createdAt', 'asc'),
    )
    return onSnapshot(q, (snap) => cb(snap.docs.map(mapChannel)))
  },

  /** Count of non-archived channels; used to enforce the UI create-button limit. */
  async getActiveCount(farmId: string): Promise<number> {
    const snap = await getCountFromServer(
      query(collection(db, 'farms', farmId, 'channels'), orderBy('createdAt', 'asc'))
    )
    return snap.data().count
  },
}
