/**
 * FarmSearch — cmd+k search across all farm channels (and optionally events).
 *
 * Renders a magnifier icon button. On click (or cmd+k / ctrl+k anywhere on the
 * page), opens a full-screen modal with a search input and live results.
 *
 * The component depends only on the SearchService interface, so swapping
 * Option A → Option B requires no change here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientSearchService, excerptAround, type SearchResult } from '../services/search'
import { Channel, Event } from '../types'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  farmId: string
  channels: Channel[]
  /** Farm-scoped events to also search (optional). */
  farmEvents?: Event[]
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Highlights the first occurrence of `term` inside `text`. */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>
  const lower = text.toLowerCase()
  const lowerTerm = term.toLowerCase()
  const idx = lower.indexOf(lowerTerm)
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-700/60 text-inherit not-italic rounded-sm px-0.5">
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  )
}

/** Small coloured badge for channel or event source label. */
function SourceBadge({ result }: { result: SearchResult }) {
  if (result.source.type === 'channel') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shrink-0">
        # {result.source.channelName}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 shrink-0">
      📅 {result.source.eventName}
    </span>
  )
}

/** Single search result row. */
function ResultRow({
  result,
  term,
  onGo,
}: {
  result: SearchResult
  term: string
  onGo: (result: SearchResult) => void
}) {
  const snippet = excerptAround(result.text, term)
  const time = result.createdAt.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <button
      type="button"
      onClick={() => onGo(result)}
      className="w-full text-left px-4 py-3 hover:bg-[--bg-subtle] dark:hover:bg-gray-800 flex items-start gap-3 transition-colors group"
    >
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-[--bg-raised] dark:bg-gray-700 flex items-center justify-center text-sm shrink-0 overflow-hidden mt-0.5">
        {result.authorPhotoURL ? (
          <img src={result.authorPhotoURL} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[--text-muted] text-xs font-bold">
            {(result.authorName[0] ?? '?').toUpperCase()}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-xs font-semibold text-[--text-base] truncate">
            {result.authorName}
          </span>
          <SourceBadge result={result} />
          <span className="text-[10px] text-[--text-muted] ml-auto shrink-0">{time}</span>
        </div>
        <p className="text-sm text-[--text-muted] dark:text-gray-400 leading-snug line-clamp-2">
          <Highlight text={snippet} term={term} />
        </p>
      </div>

      {/* Go arrow — visible on hover */}
      <span className="text-[--text-muted] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-center text-xs">
        →
      </span>
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FarmSearch({ farmId, channels, farmEvents = [] }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable channel + event lists for the service call
  const channelsMeta = useMemo(
    () => channels.map(c => ({ id: c.id, name: c.name })),
    [channels],
  )
  const eventsMeta = useMemo(
    () =>
      farmEvents
        .filter(e => e.visibility?.farms?.includes(farmId))
        .map(e => ({ id: e.id, name: e.title })),
    [farmEvents, farmId],
  )

  // ── Open / close ────────────────────────────────────────────────────────────

  const openSearch = useCallback(() => {
    setOpen(true)
    setTerm('')
    setResults([])
    setSearched(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const closeSearch = useCallback(() => {
    abortRef.current?.abort()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setOpen(false)
    setTerm('')
    setResults([])
    setSearched(false)
    setLoading(false)
  }, [])

  // Global cmd+k / ctrl+k shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) closeSearch()
        else openSearch()
      }
      if (e.key === 'Escape' && open) closeSearch()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, openSearch, closeSearch])

  // ── Search logic ─────────────────────────────────────────────────────────────

  const runSearch = useCallback(
    (value: string) => {
      abortRef.current?.abort()
      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (value.trim().length < 2) {
        setResults([])
        setSearched(false)
        setLoading(false)
        return
      }

      setLoading(true)

      debounceRef.current = setTimeout(async () => {
        const ctrl = new AbortController()
        abortRef.current = ctrl

        try {
          const res = await clientSearchService.search({
            term: value,
            farmId,
            channels: channelsMeta,
            eventIds: eventsMeta,
            signal: ctrl.signal,
          })
          if (!ctrl.signal.aborted) {
            setResults(res)
            setSearched(true)
          }
        } catch {
          if (!ctrl.signal.aborted) setResults([])
        } finally {
          if (!ctrl.signal.aborted) {
            setLoading(false)
            setSearched(true)
          }
        }
      }, 350)
    },
    [farmId, channelsMeta, eventsMeta],
  )

  const handleTermChange = (v: string) => {
    setTerm(v)
    runSearch(v)
  }

  // ── Navigation ────────────────────────────────────────────────────────────────

  const handleGo = useCallback(
    (result: SearchResult) => {
      closeSearch()
      navigate(result.href)
      // After navigation, scroll the message into view.
      // EventChat renders id="msg-{id}" on each bubble.
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = document.getElementById(`msg-${result.id}`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el?.classList.add('ring-2', 'ring-yellow-400', 'ring-offset-2', 'rounded-2xl')
          setTimeout(() => el?.classList.remove('ring-2', 'ring-yellow-400', 'ring-offset-2', 'rounded-2xl'), 2500)
        }, 600)
      })
    },
    [closeSearch, navigate],
  )

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={openSearch}
        title="Cerca nei messaggi (⌘K)"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[--text-muted] hover:text-[--text-base] hover:bg-[--bg-raised] transition-colors shrink-0"
        aria-label="Cerca"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="m21 21-4.35-4.35" />
        </svg>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-start sm:pt-20 sm:px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeSearch}
          />

          {/* Panel */}
          <div className="relative w-full sm:max-w-xl bg-[--bg-card] dark:bg-gray-900 sm:rounded-2xl shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[70vh] overflow-hidden border border-[--border-base]">

            {/* Search input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[--border-base] flex-shrink-0">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[--text-muted] shrink-0">
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="search"
                value={term}
                onChange={e => handleTermChange(e.target.value)}
                placeholder="Cerca nei messaggi..."
                className="flex-1 bg-transparent border-none outline-none text-[--text-base] placeholder-[--text-muted] text-sm"
                autoComplete="off"
              />
              {loading && (
                <svg className="animate-spin text-[--text-muted] shrink-0" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              )}
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-[--border-base] text-[10px] text-[--text-muted] font-mono shrink-0">
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {!searched && !loading && (
                <div className="px-4 py-8 text-center text-sm text-[--text-muted]">
                  Digita almeno 2 caratteri per cercare nei messaggi del gruppo.
                </div>
              )}

              {searched && !loading && results.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-[--text-muted]">
                  Nessun risultato per <strong>&ldquo;{term}&rdquo;</strong>
                </div>
              )}

              {results.length > 0 && (
                <>
                  <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-[--text-muted] uppercase tracking-wider">
                    {results.length} risultat{results.length === 1 ? 'o' : 'i'}
                  </div>
                  <div className="divide-y divide-[--border-base]">
                    {results.map(r => (
                      <ResultRow key={`${r.source.type}-${r.id}`} result={r} term={term} onGo={handleGo} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Footer hint */}
            <div className="flex-shrink-0 border-t border-[--border-base] px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] text-[--text-muted]">
                Ultimi 500 messaggi per canale
              </span>
              <div className="flex items-center gap-3 text-[10px] text-[--text-muted]">
                <span><kbd className="font-mono">↵</kbd> vai al messaggio</span>
                <span><kbd className="font-mono">Esc</kbd> chiudi</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
