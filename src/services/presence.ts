/**
 * Presence service — Firebase Realtime Database.
 *
 * RTDB is the canonical solution for online/offline presence because it
 * supports `onDisconnect()` at the network level (Firestore does not).
 *
 * Schema:
 *   /presence/{uid}       { online: boolean, lastSeen: number (server timestamp ms) }
 *   /typing/{chatKey}/{uid} { typing: boolean, updatedAt: number }
 *
 * chatKey: a slash-free identifier for the chat context, e.g.
 *   "events__eventId" or "farms__farmId__channels__channelId"
 */
import {
  ref,
  set,
  onValue,
  onDisconnect,
  serverTimestamp,
  type Database,
  type Unsubscribe,
} from 'firebase/database'
import { rtdb } from '../firebase/config'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PresenceData {
  online: boolean
  /** Unix ms timestamp of when the user was last seen online. */
  lastSeen: number
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function presRef(db: Database, uid: string) {
  return ref(db, `/presence/${uid}`)
}

/**
 * Convert a Firestore messages path (e.g. "events/abc/messages") to a safe
 * RTDB key with no slashes (e.g. "events__abc__messages").
 */
export function chatPathKey(messagesPath: string): string {
  return messagesPath.replace(/\//g, '__')
}

// ── Presence (online / offline) ───────────────────────────────────────────────

/**
 * Start tracking presence for the currently signed-in user.
 *
 * - Registers an `onDisconnect` handler so the server marks the user offline
 *   automatically if the connection drops (tab crash, network loss, etc.).
 * - Writes `online: true` immediately.
 * - Adds window `blur` / `focus` listeners to mark offline/online when the
 *   user switches apps or tabs.
 *
 * Returns a cleanup function; call it on logout or component unmount.
 */
export function initPresence(uid: string): () => void {
  if (!rtdb) {
    // RTDB not configured — presence features are disabled.
    return () => {}
  }

  const r = presRef(rtdb, uid)
  const onlineVal = { online: true, lastSeen: serverTimestamp() }
  const offlineVal = { online: false, lastSeen: serverTimestamp() }

  // Register onDisconnect before going online so the server-side handler is
  // guaranteed to run even if the client crashes before the manual set below.
  void onDisconnect(r).set(offlineVal)

  // Mark online
  void set(r, onlineVal)

  const handleFocus = () => {
    void onDisconnect(r).set(offlineVal) // re-register in case it was cancelled
    void set(r, onlineVal)
  }
  const handleBlur = () => {
    void set(r, offlineVal)
  }

  window.addEventListener('focus', handleFocus)
  window.addEventListener('blur', handleBlur)

  return () => {
    window.removeEventListener('focus', handleFocus)
    window.removeEventListener('blur', handleBlur)
    // Best-effort: mark offline synchronously on cleanup
    void set(r, offlineVal)
  }
}

/**
 * Subscribe to the presence nodes for a list of uids.
 * Calls `cb` with the updated Map whenever any node changes.
 * Returns an unsubscribe function.
 */
export function listenPresence(
  uids: string[],
  cb: (presence: Map<string, PresenceData>) => void,
): () => void {
  if (!rtdb || uids.length === 0) {
    cb(new Map())
    return () => {}
  }

  const state = new Map<string, PresenceData>()
  const unsubs: Unsubscribe[] = []

  for (const uid of uids) {
    const r = presRef(rtdb, uid)
    const unsub = onValue(r, (snap) => {
      const raw = snap.val() as { online?: boolean; lastSeen?: number } | null
      if (raw) {
        state.set(uid, {
          online: !!raw.online,
          lastSeen: typeof raw.lastSeen === 'number' ? raw.lastSeen : Date.now(),
        })
      } else {
        state.delete(uid)
      }
      cb(new Map(state))
    })
    unsubs.push(unsub)
  }

  return () => unsubs.forEach(fn => fn())
}

// ── Typing (RTDB-backed) ──────────────────────────────────────────────────────

/**
 * Write or clear a typing indicator for the current user.
 * `chatKey` must be a slash-free string — use `chatPathKey()` to build it.
 */
export function setTypingRtdb(chatKey: string, uid: string, typing: boolean): void {
  if (!rtdb) return
  const r = ref(rtdb, `/typing/${chatKey}/${uid}`)
  if (typing) {
    void set(r, { typing: true, updatedAt: serverTimestamp() })
  } else {
    void set(r, null)
  }
}

/**
 * Subscribe to typing indicators for a given chat.
 * Returns `Map<uid, updatedAt>` for users who are currently typing.
 */
export function listenTypingRtdb(
  chatKey: string,
  cb: (typingUids: Set<string>) => void,
): () => void {
  if (!rtdb) {
    cb(new Set())
    return () => {}
  }

  const r = ref(rtdb, `/typing/${chatKey}`)
  const unsub = onValue(r, (snap) => {
    const raw = snap.val() as Record<string, { typing?: boolean; updatedAt?: number }> | null
    const now = Date.now()
    const active = new Set<string>()
    if (raw) {
      for (const [uid, data] of Object.entries(raw)) {
        // Treat stale entries (> 6 s) as not typing — guards against missed clears
        if (data?.typing && typeof data.updatedAt === 'number' && now - data.updatedAt < 6000) {
          active.add(uid)
        }
      }
    }
    cb(active)
  })

  return unsub
}
