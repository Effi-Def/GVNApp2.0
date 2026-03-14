import { useState, useEffect, useCallback, useRef } from 'react'

interface AsyncDataState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Generic hook that replaces the repeated useState(loading) + try/catch/finally pattern
 * spread across EventsPage, ExpensesPage, ListsPage, PollsPage, etc.
 *
 * Usage:
 *   const { data, loading, error, reload } = useAsyncData(
 *     () => eventService.getAll(),
 *     { deps: [user?.id], skip: !user }
 *   )
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  options?: {
    /** Re-run whenever these values change (like useEffect deps) */
    deps?: unknown[]
    /** Skip fetching (e.g. when user is not yet authenticated) */
    skip?: boolean
  }
): AsyncDataState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!options?.skip)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  // Keep a stable ref to the fetcher so callers don't need to memoize it
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (options?.skip) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetcherRef.current()
      .then(result => {
        if (!cancelled) {
          setData(result)
        }
      })
      .catch(err => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Errore nel caricamento dei dati'
          setError(msg)
          console.error('useAsyncData error:', err)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, options?.skip, ...(options?.deps ?? [])])

  return { data, loading, error, reload }
}
