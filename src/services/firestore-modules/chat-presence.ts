import {
  collection,
  doc,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { toDate, toDateOrNow } from '../firestoreMappers'

function presencePath(base: string, sub: 'participants' | 'typing', uid: string) {
  const segs = base.split('/')
  return doc(db, segs[0], ...segs.slice(1), sub, uid)
}

function presenceCol(base: string, sub: 'participants' | 'typing') {
  const segs = base.split('/')
  return collection(db, segs[0], ...segs.slice(1), sub)
}

export const chatPresenceService = {
  // ── Generic path-based methods ───────────────────────────────────────────

  async markReadAt(presenceBasePath: string, userId: string, profile?: { displayName?: string; photoURL?: string }) {
    const { setDoc, serverTimestamp } = await import('firebase/firestore')
    await setDoc(presencePath(presenceBasePath, 'participants', userId), {
      lastReadAt: serverTimestamp(),
      displayName: profile?.displayName || null,
      photoUrl: profile?.photoURL || null,
    }, { merge: true })
  },

  listenParticipantsAt(presenceBasePath: string, cb: (participants: { uid: string; lastReadAt?: Date; displayName?: string; photoUrl?: string }[]) => void) {
    const unsub = onSnapshot(presenceCol(presenceBasePath, 'participants'), (snap) => {
      cb(snap.docs.map(d => {
        const data: any = d.data()
        return { uid: d.id, lastReadAt: toDate(data.lastReadAt), displayName: data.displayName, photoUrl: data.photoUrl }
      }))
    })
    return unsub
  },

  async setTypingAt(presenceBasePath: string, userId: string, typing: boolean) {
    const { setDoc, serverTimestamp } = await import('firebase/firestore')
    await setDoc(presencePath(presenceBasePath, 'typing', userId), { typing, updatedAt: serverTimestamp() }, { merge: true })
  },

  listenTypingAt(presenceBasePath: string, cb: (typingUsers: { uid: string; updatedAt: Date; typing: boolean }[]) => void) {
    const unsub = onSnapshot(presenceCol(presenceBasePath, 'typing'), (snap) => {
      cb(snap.docs.map(d => {
        const data: any = d.data()
        return { uid: d.id, updatedAt: toDateOrNow(data.updatedAt), typing: !!data.typing }
      }))
    })
    return unsub
  },

  // ── Backward-compat event-scoped wrappers ────────────────────────────────

  async markRead(eventId: string, userId: string, profile?: { displayName?: string; photoURL?: string }) {
    return this.markReadAt(`events/${eventId}`, userId, profile)
  },

  listenParticipants(eventId: string, cb: (participants: { uid: string; lastReadAt?: Date; displayName?: string; photoUrl?: string }[]) => void) {
    return this.listenParticipantsAt(`events/${eventId}`, cb)
  },

  async setTyping(eventId: string, userId: string, typing: boolean) {
    return this.setTypingAt(`events/${eventId}`, userId, typing)
  },

  listenTyping(eventId: string, cb: (typingUsers: { uid: string; updatedAt: Date; typing: boolean }[]) => void) {
    return this.listenTypingAt(`events/${eventId}`, cb)
  },
}
