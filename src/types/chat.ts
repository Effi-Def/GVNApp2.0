/**
 * ChatDescriptor — path-level abstraction for chat features.
 *
 * Both event chats and farm channels share the same message shape and UI.
 * A ChatDescriptor tells the service layer and EventChat where to read/write
 * without hardcoding "events/{id}/" everywhere.
 *
 * Use the factory functions below to construct descriptors.
 */
export interface ChatDescriptor {
  /** Firestore collection path for messages. */
  messagesPath: string
  /** Firestore doc path whose /participants and /typing subcollections track presence. */
  presenceBasePath: string
  /** Firebase Storage path prefix for uploaded files. */
  storagePath: string
  /** Firestore doc path to update with the latest-activity timestamp. */
  parentDocPath: string
  /** Field on the parent doc that holds the latest-activity timestamp. */
  lastActivityField: 'chatLastActivityAt' | 'lastMessageAt'
  context: 'event' | 'channel'
}

export function eventDescriptor(eventId: string): ChatDescriptor {
  return {
    messagesPath: `events/${eventId}/messages`,
    presenceBasePath: `events/${eventId}`,
    storagePath: `events/${eventId}/chat`,
    parentDocPath: `events/${eventId}`,
    lastActivityField: 'chatLastActivityAt',
    context: 'event',
  }
}

export function channelDescriptor(farmId: string, channelId: string): ChatDescriptor {
  return {
    messagesPath: `farms/${farmId}/channels/${channelId}/messages`,
    presenceBasePath: `farms/${farmId}/channels/${channelId}`,
    storagePath: `farms/${farmId}/channels/${channelId}/chat`,
    parentDocPath: `farms/${farmId}/channels/${channelId}`,
    lastActivityField: 'lastMessageAt',
    context: 'channel',
  }
}
