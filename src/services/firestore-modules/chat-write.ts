import {
  collection,
  doc,
  addDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore'
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage'
import { db, storage } from '../../firebase/config'
import { ChatAttachment, ChatReactionKey } from '../../types'
import { ChatDescriptor } from '../../types/chat'
import { cleanUndefinedDeep } from '../firestoreMappers'

export const chatWriteService = {
  async sendSystemMessage(
    eventId: string,
    systemType: 'expense_created' | 'poll_created' | 'list_created' | 'event_updated',
    text: string,
    metadata?: { relatedId?: string; amount?: number; title?: string },
    userId: string = 'system',
  ) {
    const { addDoc, collection, Timestamp, updateDoc, doc } = await import('firebase/firestore')
    const col = collection(db, 'events', eventId, 'messages')

    const payload = cleanUndefinedDeep({
      eventId,
      userId,
      userName: 'System',
      text,
      type: 'system',
      systemType,
      metadata,
      createdAt: Timestamp.now(),
      deleted: false,
    })

    await addDoc(col, payload)

    try {
      await updateDoc(doc(db, 'events', eventId), { chatLastActivityAt: Timestamp.now(), updatedAt: Timestamp.now() })
    } catch {}
  },

  async sendMessage(
    eventId: string,
    payload: { text?: string; files?: File[]; quoted?: { messageId: string; textPreview?: string; mediaThumbUrl?: string }; mentions?: string[] },
    user: { id: string; displayName: string; photoURL?: string },
    onProgress?: (fileName: string, progress: number) => void,
  ) {
    const cleanQuoted = payload.quoted ? {
      messageId: payload.quoted.messageId,
      ...(payload.quoted.textPreview && { textPreview: payload.quoted.textPreview }),
      ...(payload.quoted.mediaThumbUrl && { mediaThumbUrl: payload.quoted.mediaThumbUrl }),
    } : null

    const base = {
      userId: user.id,
      userName: user.displayName || 'Utente',
      userPhotoURL: user.photoURL || null,
      text: payload.text || null,
      mentions: payload.mentions && payload.mentions.length > 0 ? payload.mentions : null,
      attachments: [] as ChatAttachment[],
      reactions: { like: [], love: [], fun: [] } as Partial<Record<ChatReactionKey, string[]>>,
      quoted: cleanQuoted,
      deleted: false,
      createdAt: Timestamp.now(),
    }

    const col = collection(db, 'events', eventId, 'messages')
    const docRef = await addDoc(col, base)
    try {
      await updateDoc(doc(db, 'events', eventId), { chatLastActivityAt: Timestamp.now(), updatedAt: Timestamp.now() })
    } catch {}

    if (payload.files && payload.files.length > 0) {
      const uploaded: ChatAttachment[] = []
      for (const f of payload.files) {
        const path = `events/${eventId}/chat/${docRef.id}/${encodeURIComponent(f.name)}`
        const r = ref(storage, path)
        const task = uploadBytesResumable(r, f)
        await new Promise<void>((resolve, reject) => {
          task.on('state_changed', (snap) => {
            const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0
            onProgress?.(f.name, pct)
          }, reject, async () => {
            resolve()
          })
        })
        const url = await getDownloadURL(r)
        uploaded.push({
          id: crypto.randomUUID(),
          url,
          name: f.name,
          type: f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'file',
          size: f.size,
          contentType: f.type,
        })
      }
      await updateDoc(docRef, { attachments: uploaded })
    }
  },

  async editMessage(eventId: string, messageId: string, newText: string) {
    const refDoc = doc(db, 'events', eventId, 'messages', messageId)
    await updateDoc(refDoc, { text: newText, editedAt: Timestamp.now() })
  },

  async deleteMessage(eventId: string, messageId: string) {
    const refDoc = doc(db, 'events', eventId, 'messages', messageId)
    await updateDoc(refDoc, { deleted: true, text: null })
  },

  async toggleReaction(eventId: string, messageId: string, key: ChatReactionKey, userId: string, hasReacted: boolean) {
    const refDoc = doc(db, 'events', eventId, 'messages', messageId)
    const { arrayUnion, arrayRemove } = await import('firebase/firestore')
    const field = `reactions.${key}` as any
    await updateDoc(refDoc, { [field]: hasReacted ? arrayRemove(userId) : arrayUnion(userId) })
  },

  // ── Descriptor-based methods (work with any chat path) ──────────────────

  async sendMessageTo(
    descriptor: ChatDescriptor,
    payload: { text?: string; files?: File[]; quoted?: { messageId: string; textPreview?: string; mediaThumbUrl?: string }; mentions?: string[] },
    user: { id: string; displayName: string; photoURL?: string },
    onProgress?: (fileName: string, progress: number) => void,
  ) {
    const cleanQuoted = payload.quoted ? {
      messageId: payload.quoted.messageId,
      ...(payload.quoted.textPreview && { textPreview: payload.quoted.textPreview }),
      ...(payload.quoted.mediaThumbUrl && { mediaThumbUrl: payload.quoted.mediaThumbUrl }),
    } : null

    const base = {
      userId: user.id,
      userName: user.displayName || 'Utente',
      userPhotoURL: user.photoURL || null,
      text: payload.text || null,
      mentions: payload.mentions && payload.mentions.length > 0 ? payload.mentions : null,
      attachments: [] as ChatAttachment[],
      reactions: { like: [], love: [], fun: [] } as Partial<Record<ChatReactionKey, string[]>>,
      quoted: cleanQuoted,
      deleted: false,
      createdAt: Timestamp.now(),
    }

    const segments = descriptor.messagesPath.split('/')
    const col = collection(db, segments[0], ...segments.slice(1))
    const docRef = await addDoc(col, base)

    // Update parent doc's last-activity timestamp
    try {
      const pSeg = descriptor.parentDocPath.split('/')
      await updateDoc(doc(db, pSeg[0], ...pSeg.slice(1)), {
        [descriptor.lastActivityField]: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    } catch {}

    if (payload.files && payload.files.length > 0) {
      const uploaded: ChatAttachment[] = []
      for (const f of payload.files) {
        const path = `${descriptor.storagePath}/${docRef.id}/${encodeURIComponent(f.name)}`
        const r = ref(storage, path)
        const task = uploadBytesResumable(r, f)
        await new Promise<void>((resolve, reject) => {
          task.on('state_changed', (snap) => {
            const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0
            onProgress?.(f.name, pct)
          }, reject, async () => { resolve() })
        })
        const url = await getDownloadURL(r)
        uploaded.push({
          id: crypto.randomUUID(),
          url,
          name: f.name,
          type: f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'file',
          size: f.size,
          contentType: f.type,
        })
      }
      await updateDoc(docRef, { attachments: uploaded })
    }
  },

  /**
   * Write a reply to a parent message's replies sub-collection.
   * Atomically increments the parent's replyCount and updates lastReplyAt/Preview.
   */
  async sendReply(
    descriptor: ChatDescriptor,
    parentMsgId: string,
    payload: { text?: string; files?: File[] },
    user: { id: string; displayName: string; photoURL?: string },
    onProgress?: (fileName: string, progress: number) => void,
  ) {
    const base = {
      userId: user.id,
      userName: user.displayName || 'Utente',
      userPhotoURL: user.photoURL || null,
      text: payload.text || null,
      attachments: [] as ChatAttachment[],
      reactions: { like: [], love: [], fun: [] } as Partial<Record<ChatReactionKey, string[]>>,
      deleted: false,
      createdAt: Timestamp.now(),
    }

    // Write reply doc
    const segs = [...descriptor.messagesPath.split('/'), parentMsgId, 'replies']
    const repliesCol = collection(db, segs[0], ...segs.slice(1))
    const replyRef = await addDoc(repliesCol, base)

    // Bump parent counters
    const parentSegs = descriptor.messagesPath.split('/')
    const parentRef = doc(db, parentSegs[0], ...parentSegs.slice(1), parentMsgId)
    const { increment } = await import('firebase/firestore')
    await updateDoc(parentRef, {
      replyCount: increment(1),
      lastReplyAt: Timestamp.now(),
      lastReplyPreview: (payload.text || '').slice(0, 100),
    })

    if (payload.files && payload.files.length > 0) {
      const uploaded: ChatAttachment[] = []
      for (const f of payload.files) {
        const path = `${descriptor.storagePath}/${parentMsgId}/replies/${replyRef.id}/${encodeURIComponent(f.name)}`
        const r = ref(storage, path)
        const task = uploadBytesResumable(r, f)
        await new Promise<void>((resolve, reject) => {
          task.on('state_changed', (snap) => {
            const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0
            onProgress?.(f.name, pct)
          }, reject, () => resolve())
        })
        const url = await getDownloadURL(r)
        uploaded.push({
          id: crypto.randomUUID(),
          url,
          name: f.name,
          type: f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'file',
          size: f.size,
          contentType: f.type,
        })
      }
      await updateDoc(replyRef, { attachments: uploaded })
    }
  },

  async editMessageAt(messagesPath: string, messageId: string, newText: string) {
    const s = messagesPath.split('/')
    await updateDoc(doc(db, s[0], ...s.slice(1), messageId), { text: newText, editedAt: Timestamp.now() })
  },

  async deleteMessageAt(messagesPath: string, messageId: string) {
    const s = messagesPath.split('/')
    await updateDoc(doc(db, s[0], ...s.slice(1), messageId), { deleted: true, text: null })
  },

  async toggleReactionAt(messagesPath: string, messageId: string, emoji: string, userId: string, hasReacted: boolean) {
    const s = messagesPath.split('/')
    const refDoc = doc(db, s[0], ...s.slice(1), messageId)
    const { arrayUnion, arrayRemove } = await import('firebase/firestore')
    const field = `reactions.${emoji}` as any
    await updateDoc(refDoc, { [field]: hasReacted ? arrayRemove(userId) : arrayUnion(userId) })
  },
}
