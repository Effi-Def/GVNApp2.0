import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { ChatAttachment, ChatMessage } from '../../types'
import { toDate, toDateOrNow } from '../firestoreMappers'

function mapMsg(d: any, contextId: string): ChatMessage {
  const data: any = d.data()
  return {
    id: d.id,
    eventId: contextId,
    userId: data.userId,
    userName: data.userName,
    userPhotoURL: data.userPhotoURL,
    text: data.text,
    type: data.type || 'text',
    systemType: data.systemType,
    metadata: data.metadata,
    attachments: Array.isArray(data.attachments) ? data.attachments : undefined,
    reactions: data.reactions || undefined,
    mentions: Array.isArray(data.mentions) ? data.mentions : undefined,
    createdAt: toDateOrNow(data.createdAt),
    editedAt: toDate(data.editedAt),
    deleted: !!data.deleted,
  }
}

export const chatReadService = {
  /** Generic listener — accepts any Firestore messages collection path. */
  listenPath(messagesPath: string, cb: (messages: ChatMessage[]) => void, onError?: (e: any) => void) {
    const segments = messagesPath.split('/')
    const col = collection(db, segments[0], ...segments.slice(1))
    const qy = query(col, orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(
      qy,
      (snap) => cb(snap.docs.map(d => mapMsg(d, messagesPath))),
      (err) => { console.error('❌ Chat listener error:', err); onError?.(err) },
    )
    return unsub
  },

  /** Backward-compat wrapper for event chats. */
  listen(eventId: string, cb: (messages: ChatMessage[]) => void, onError?: (e: any) => void) {
    return this.listenPath(`events/${eventId}/messages`, cb, onError)
  },

  /** Subscribe to the replies sub-collection of a single message. */
  listenReplies(
    messagesPath: string,
    msgId: string,
    cb: (replies: ChatMessage[]) => void,
    onError?: (e: any) => void,
  ) {
    const segs = [...messagesPath.split('/'), msgId, 'replies']
    const col = collection(db, segs[0], ...segs.slice(1))
    const qy = query(col, orderBy('createdAt', 'asc'))
    return onSnapshot(
      qy,
      (snap) => cb(snap.docs.map(d => mapMsg(d, `${messagesPath}/${msgId}`))),
      (err) => { console.error('❌ Replies listener error:', err); onError?.(err) },
    )
  },

  async getMediaAttachments(eventId: string): Promise<Array<{
    messageId: string
    attachment: ChatAttachment
    userName: string
    userPhotoURL?: string
    createdAt: Date
    eventId: string
  }>> {
    const col = collection(db, 'events', eventId, 'messages')
    const q = query(col, orderBy('createdAt', 'desc'), limit(500))
    const snap = await getDocs(q)
    const results: Array<{
      messageId: string
      attachment: ChatAttachment
      userName: string
      userPhotoURL?: string
      createdAt: Date
      eventId: string
    }> = []
    for (const d of snap.docs) {
      const data: any = d.data()
      if (data.deleted || !Array.isArray(data.attachments) || data.attachments.length === 0) continue
      for (const att of data.attachments as ChatAttachment[]) {
        if (att.type === 'image' || att.type === 'video') {
          results.push({
            messageId: d.id,
            attachment: att,
            userName: String(data.userName || 'Utente'),
            userPhotoURL: typeof data.userPhotoURL === 'string' ? data.userPhotoURL : undefined,
            createdAt: toDateOrNow(data.createdAt),
            eventId,
          })
        }
      }
    }
    return results
  },
}
