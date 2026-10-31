import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatService } from '../services/firestore'
import { useAppStore } from '../stores/AppStore'
import { useFarmContext } from '../contexts/FarmContext'
import type { ChatAttachment, Event } from '../types'

interface MediaItem {
  messageId: string
  attachment: ChatAttachment
  userName: string
  userPhotoURL?: string
  createdAt: Date
  eventId: string
  eventTitle: string
}

// ── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({
  items,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  items: MediaItem[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const item = items[index]
  if (!item) return null

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={handleBackdrop}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        onClick={onClose}
        aria-label="Chiudi"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>

      {/* Prev */}
      {index > 0 && (
        <button
          className="absolute left-2 sm:left-6 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          aria-label="Precedente"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      )}

      {/* Media */}
      <div className="max-w-[92vw] max-h-[85vh] flex items-center justify-center px-12">
        {item.attachment.type === 'image' ? (
          <img
            src={item.attachment.url}
            alt={item.attachment.name}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <video
            src={item.attachment.url}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
          />
        )}
      </div>

      {/* Next */}
      {index < items.length - 1 && (
        <button
          className="absolute right-2 sm:right-6 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); onNext() }}
          aria-label="Successivo"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      )}

      {/* Caption */}
      <div className="absolute bottom-4 left-0 right-0 text-center px-4">
        <p className="text-white/80 text-sm">
          <span className="font-semibold">{item.eventTitle}</span>
          {' · '}
          {item.userName}
          {' · '}
          {item.createdAt.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
        <p className="text-white/40 text-xs mt-0.5">{index + 1} / {items.length}</p>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function FarmMediaPage() {
  const navigate = useNavigate()
  const { activeFarmId, activeFarm } = useFarmContext()
  const allEvents = useAppStore(s => s.events)

  // Events visible to this farm
  const farmEvents: Event[] = useMemo(() => {
    if (!activeFarmId) return []
    return allEvents.filter(e => {
      const v = e.visibility
      if (!v || v.type === 'public') return true
      return Array.isArray(v.farms) && v.farms.includes(activeFarmId)
    })
  }, [allEvents, activeFarmId])

  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadedEventIds, setLoadedEventIds] = useState<Set<string>>(new Set())
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all')
  const [filterEventId, setFilterEventId] = useState<string>('all')
  const [search, setSearch] = useState('')

  const abortRef = useRef(false)

  useEffect(() => {
    if (farmEvents.length === 0) return
    abortRef.current = false
    setLoading(true)
    setItems([])
    setLoadedEventIds(new Set())

    const load = async () => {
      const allItems: MediaItem[] = []
      for (const ev of farmEvents) {
        if (abortRef.current) break
        try {
          const media = await chatService.getMediaAttachments(ev.id)
          const mapped: MediaItem[] = media.map(m => ({
            ...m,
            eventTitle: ev.title || 'Evento',
          }))
          allItems.push(...mapped)
          setLoadedEventIds(prev => new Set([...prev, ev.id]))
          // Sort all fetched items by date desc and update state progressively
          const sorted = [...allItems].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          setItems(sorted)
        } catch {
          // skip event on error
        }
      }
      setLoading(false)
    }

    load()
    return () => { abortRef.current = true }
  }, [farmEvents.map(e => e.id).join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = useMemo(() => {
    let list = items
    if (filterType !== 'all') list = list.filter(i => i.attachment.type === filterType)
    if (filterEventId !== 'all') list = list.filter(i => i.eventId === filterEventId)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.eventTitle.toLowerCase().includes(q) ||
        i.userName.toLowerCase().includes(q)
      )
    }
    return list
  }, [items, filterType, filterEventId, search])

  if (!activeFarmId || !activeFarm) {
    return (
      <div className="pt-16 px-4 max-w-3xl mx-auto">
        <p className="text-sm text-[--text-muted]">Nessun gruppo attivo. <button className="underline text-primary-600" onClick={() => navigate('/')}>Torna alla Home</button></p>
      </div>
    )
  }

  const totalProgress = farmEvents.length > 0 ? Math.round((loadedEventIds.size / farmEvents.length) * 100) : 0

  return (
    <>
      {lightboxIndex !== null && (
        <Lightbox
          items={displayed}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => (i != null && i > 0 ? i - 1 : i))}
          onNext={() => setLightboxIndex(i => (i != null && i < displayed.length - 1 ? i + 1 : i))}
        />
      )}

      <div className="pt-16 px-4 pb-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate('/farm')}
            className="p-2 rounded-full hover:bg-[--bg-raised] text-[--text-muted] transition-colors"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-[--text-base]">📸 Foto & Video</h1>
            <p className="text-sm text-[--text-muted]">{activeFarm.name} · {items.length} media</p>
          </div>
        </div>

        {/* Loading progress bar */}
        {loading && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[--text-muted]">Caricamento media da {loadedEventIds.size} / {farmEvents.length} eventi...</span>
              <span className="text-xs text-[--text-muted]">{totalProgress}%</span>
            </div>
            <div className="h-1.5 bg-[--bg-raised] rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-300 rounded-full"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Search */}
          <div className="flex-1 min-w-[180px] relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted]" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="search"
              placeholder="Cerca per evento o autore…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-[--bg-card] border border-[--border-base] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {/* Type filter */}
          <div className="flex bg-[--bg-card] border border-[--border-base] rounded-xl overflow-hidden text-sm">
            {(['all', 'image', 'video'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-2 transition-colors ${filterType === t ? 'bg-primary-600 text-white' : 'text-[--text-muted] hover:bg-[--bg-subtle]'}`}
              >
                {t === 'all' ? 'Tutti' : t === 'image' ? '🖼 Foto' : '🎬 Video'}
              </button>
            ))}
          </div>

          {/* Event filter */}
          {farmEvents.length > 1 && (
            <select
              value={filterEventId}
              onChange={e => setFilterEventId(e.target.value)}
              className="text-sm bg-[--bg-card] border border-[--border-base] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 text-[--text-muted]"
            >
              <option value="all">Tutti gli eventi</option>
              {farmEvents.map(e => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          )}
        </div>

        {/* Gallery grid */}
        {displayed.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[--text-muted] gap-3">
            <div className="text-6xl">📷</div>
            <p className="text-sm font-medium">Nessun media trovato</p>
            <p className="text-xs text-center max-w-xs">Le foto e i video inviati nelle chat degli eventi appariranno qui.</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 space-y-2">
            {displayed.map((item, idx) => (
              <MediaTile
                key={`${item.eventId}-${item.messageId}-${item.attachment.id}`}
                item={item}
                onClick={() => setLightboxIndex(idx)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ── MediaTile ────────────────────────────────────────────────────────────────
function MediaTile({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div
      className="break-inside-avoid mb-2 group cursor-pointer rounded-xl overflow-hidden relative bg-neutral-100"
      onClick={onClick}
    >
      {item.attachment.type === 'image' && !imgError ? (
        <img
          src={item.attachment.url}
          alt={item.attachment.name}
          className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : item.attachment.type === 'video' ? (
        <div className="relative aspect-video bg-black flex items-center justify-center">
          <video
            src={item.attachment.url}
            className="w-full h-full object-cover"
            preload="metadata"
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" className="text-[--text-base] ml-0.5"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        </div>
      ) : (
        <div className="aspect-square flex items-center justify-center bg-neutral-200 text-4xl">📄</div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl" />

      {/* Meta pill */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 translate-y-full group-hover:translate-y-0 transition-transform rounded-b-xl">
        <p className="text-white text-[11px] font-medium truncate">{item.eventTitle}</p>
        <p className="text-white/70 text-[10px] truncate">{item.userName}</p>
      </div>

      {/* Video badge */}
      {item.attachment.type === 'video' && (
        <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">▶ video</div>
      )}
    </div>
  )
}

