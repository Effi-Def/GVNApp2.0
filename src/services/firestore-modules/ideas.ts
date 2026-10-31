import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { Idea, IdeaDraft } from '../../types'
import { toDateOrNow } from '../firestoreMappers'

const MAX_IDEAS = 200

const ideasCollection = (farmId: string) => collection(db, 'farms', farmId, 'ideas')
const ideaDoc = (farmId: string, ideaId: string) => doc(db, 'farms', farmId, 'ideas', ideaId)

function mapIdea(d: any): Idea {
  const data: any = d.data()
  return {
    id: d.id,
    farmId: data.farmId || '',
    title: data.title || '',
    category: data.category || 'altro',
    note: data.note,
    link: data.link,
    location: data.location,
    createdBy: data.createdBy || '',
    interestedIds: Array.isArray(data.interestedIds) ? data.interestedIds : [],
    status: data.status === 'organized' ? 'organized' : 'open',
    eventId: data.eventId,
    createdAt: toDateOrNow(data.createdAt),
    updatedAt: toDateOrNow(data.updatedAt),
  }
}

export const ideaService = {
  listen(
    farmId: string,
    onData: (ideas: Idea[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const q = query(ideasCollection(farmId), orderBy('createdAt', 'desc'), limit(MAX_IDEAS))
    return onSnapshot(q, snap => onData(snap.docs.map(mapIdea)), error => {
      console.error('❌ Error listening to ideas:', error)
      onError?.(error)
    })
  },

  /** Whoever adds an idea is already interested in it. */
  async create(farmId: string, draft: IdeaDraft, userId: string): Promise<void> {
    const now = Timestamp.now()
    await addDoc(ideasCollection(farmId), {
      farmId,
      title: draft.title,
      category: draft.category,
      ...(draft.note ? { note: draft.note } : {}),
      ...(draft.link ? { link: draft.link } : {}),
      ...(draft.location ? { location: draft.location } : {}),
      createdBy: userId,
      interestedIds: [userId],
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })
  },

  async update(farmId: string, ideaId: string, draft: IdeaDraft): Promise<void> {
    await updateDoc(ideaDoc(farmId, ideaId), {
      title: draft.title,
      category: draft.category,
      note: draft.note || deleteField(),
      link: draft.link || deleteField(),
      location: draft.location || deleteField(),
      updatedAt: Timestamp.now(),
    })
  },

  // arrayUnion/arrayRemove: two people tapping together must not overwrite each other
  async setInterest(farmId: string, ideaId: string, userId: string, interested: boolean): Promise<void> {
    await updateDoc(ideaDoc(farmId, ideaId), {
      interestedIds: interested ? arrayUnion(userId) : arrayRemove(userId),
      updatedAt: Timestamp.now(),
    })
  },

  async markOrganized(farmId: string, ideaId: string, eventId: string): Promise<void> {
    await updateDoc(ideaDoc(farmId, ideaId), {
      status: 'organized',
      eventId,
      updatedAt: Timestamp.now(),
    })
  },

  async reopen(farmId: string, ideaId: string): Promise<void> {
    await updateDoc(ideaDoc(farmId, ideaId), {
      status: 'open',
      eventId: deleteField(),
      updatedAt: Timestamp.now(),
    })
  },

  async delete(farmId: string, ideaId: string): Promise<void> {
    await deleteDoc(ideaDoc(farmId, ideaId))
  },
}
