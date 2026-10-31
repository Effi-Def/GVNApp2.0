/**
 * Farm message search — Option A (client-side).
 *
 * Architecture:
 *   SearchService interface   ← UI depends only on this
 *   clientSearchService       ← Option A implementation
 *   (future) indexedSearchService ← Option B: swap here, UI unchanged
 *
 * Option A strategy:
 *   - For each farm channel, fetch the last 500 messages (ordered desc).
 *   - For each farm event (already in AppStore), fetch the last 500 messages.
 *   - Filter client-side by case-insensitive substring match.
 *   - Sort results by createdAt desc, cap at MAX_RESULTS.
 *
 * Scalability note:
 *   At ~500 messages × N channels, this is fine for small farms (<50 people,
 *   <10 channels). When you hit performance limits, replace clientSearchService
 *   with an index-backed Option B implementation — the UI is unaffected.
 */
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query as fsQuery,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { toDateOrNow } from './firestoreMappers'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChannelSource {
  type: 'channel'
  farmId: string
  channelId: string
  channelName: string
}

export interface EventSource {
  type: 'event'
  eventId: string
  eventName: string
}

export interface SearchResult {
  id: string
  /** Full message text (use `excerptAround` to get a snippet). */
  text: string
  authorName: string
  authorPhotoURL?: string
  createdAt: Date
  source: ChannelSource | EventSource
  /** React Router `to` path — navigate here, then scroll to `#msg-{id}`. */
  href: string
}

export interface SearchParams {
  /** The search query string (min 2 chars to trigger). */
  term: string
  farmId: string
  /** All non-archived channels to search. */
  channels: Array<{ id: string; name: string }>
  /** Farm-scoped events to also search (optional). */
  eventIds?: Array<{ id: string; name: string }>
  /** Pass an AbortSignal to cancel in-flight requests on new keystrokes. */
  signal?: AbortSignal
}

/** Implement this interface to swap Option A → B without touching any UI code. */
export interface SearchService {
  search(params: SearchParams): Promise<SearchResult[]>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESSAGES_PER_SOURCE = 500
const MAX_RESULTS = 100

/**
 * Return a short excerpt of `text` centered on the first occurrence of `term`.
 * Adds ellipsis on either side when the text is truncated.
 */
export function excerptAround(text: string, term: string, radius = 60): string {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(term.toLowerCase())
  if (idx === -1) return text.length > radius * 2 ? text.slice(0, radius * 2) + '…' : text
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + term.length + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

async function fetchAndFilter(
  path: string,
  term: string,
  signal: AbortSignal | undefined,
  mapResult: (id: string, data: Record<string, unknown>) => SearchResult,
): Promise<SearchResult[]> {
  if (signal?.aborted) return []

  const segs = path.split('/')
  const col = collection(db, segs[0], ...segs.slice(1))
  const q = fsQuery(col, orderBy('createdAt', 'desc'), limit(MESSAGES_PER_SOURCE))

  const snap = await getDocs(q)
  if (signal?.aborted) return []

  const lower = term.toLowerCase()
  const results: SearchResult[] = []

  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>
    if (data.deleted || !data.text || typeof data.text !== 'string') continue
    if (!data.text.toLowerCase().includes(lower)) continue
    results.push(mapResult(d.id, data))
  }

  return results
}

// ── Option A: client-side fetch + filter ──────────────────────────────────────

export const clientSearchService: SearchService = {
  async search({ term, farmId, channels, eventIds = [], signal }) {
    const trimmed = term.trim()
    if (trimmed.length < 2) return []

    const channelJobs = channels.map(ch =>
      fetchAndFilter(
        `farms/${farmId}/channels/${ch.id}/messages`,
        trimmed,
        signal,
        (id, data) => ({
          id,
          text: data.text as string,
          authorName: (data.userName as string) || 'Utente',
          authorPhotoURL: typeof data.userPhotoURL === 'string' ? data.userPhotoURL : undefined,
          createdAt: toDateOrNow(data.createdAt),
          source: {
            type: 'channel',
            farmId,
            channelId: ch.id,
            channelName: ch.name,
          } as ChannelSource,
          href: `/farm/channels/${ch.id}`,
        }),
      ),
    )

    const eventJobs = eventIds.map(ev =>
      fetchAndFilter(
        `events/${ev.id}/messages`,
        trimmed,
        signal,
        (id, data) => ({
          id,
          text: data.text as string,
          authorName: (data.userName as string) || 'Utente',
          authorPhotoURL: typeof data.userPhotoURL === 'string' ? data.userPhotoURL : undefined,
          createdAt: toDateOrNow(data.createdAt),
          source: {
            type: 'event',
            eventId: ev.id,
            eventName: ev.name,
          } as EventSource,
          href: `/events/${ev.id}/chat`,
        }),
      ),
    )

    const settled = await Promise.allSettled([...channelJobs, ...eventJobs])
    const all: SearchResult[] = []
    for (const r of settled) {
      if (r.status === 'fulfilled') all.push(...r.value)
    }

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return all.slice(0, MAX_RESULTS)
  },
}
