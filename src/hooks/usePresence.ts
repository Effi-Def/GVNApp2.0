import { useEffect, useMemo, useState } from 'react'
import { listenPresence, type PresenceData } from '../services/presence'

/**
 * Subscribes to RTDB presence nodes for a list of user IDs.
 *
 * @param uids - Array of user IDs to watch. Changes to the array content
 *               (not reference) trigger a re-subscription.
 * @returns A Map from uid → { online: boolean, lastSeen: number }.
 *          Missing entries mean the user has never written a presence node.
 *
 * @example
 * const presence = usePresence(members.map(m => m.userId))
 * const isOnline = presence.get(m.userId)?.online ?? false
 */
export function usePresence(uids: string[]): Map<string, PresenceData> {
  const [presence, setPresence] = useState<Map<string, PresenceData>>(new Map())

  // Stable key: only re-subscribe when the *content* of uids changes.
  // Sorting ensures that order differences don't cause spurious re-subs.
  const stableKey = useMemo(() => [...uids].sort().join(','), [uids])

  useEffect(() => {
    if (!stableKey) {
      setPresence(new Map())
      return
    }
    const sorted = stableKey.split(',').filter(Boolean)
    return listenPresence(sorted, setPresence)
  }, [stableKey])

  return presence
}
