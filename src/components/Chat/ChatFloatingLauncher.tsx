import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/AppStore'
import { useUserSettingsStore } from '../../stores/UserSettingsStore'
import { useAuthStore } from '../../stores/useAuthStore'
import EventChat from './EventChat'
import { getUserKeys, userCanChat, getUserEventParticipation } from '../../utils/events'

const ChatListItem = ({ ev, onClick }: { ev: any, onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-[--bg-subtle] rounded-lg group transition-colors mb-1"
  >
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
      {ev.title.slice(0,2).toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className={`font-medium truncate group-hover:text-primary-700 transition-colors ${ev.unread ? 'text-[--text-base] font-bold' : 'text-[--text-muted]'}`}>{ev.title}</span>
        {ev.unread && <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>}
      </div>
      <p className={`text-xs mt-0.5 truncate ${ev.unread ? 'text-[--text-muted] font-medium' : 'text-[--text-muted]'}`}>
        {ev.lastActivityDate
          ? new Date(ev.lastActivityDate).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
          : 'Nessuna attività ancora'}
      </p>
    </div>
    {ev.unread && (
      <span className="ml-2 text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">NEW</span>
    )}
  </button>
)

/**
 * Floating WhatsApp-like chat launcher
 * - Fixed bottom-right button (desktop & mobile)
 * - Opens an overlay panel listing events with chat activity
 * - Shows unread badge per event (based on chatLastActivityAt vs lastReadByEvent)
 */
const ChatFloatingLauncher: React.FC = () => {
  const navigate = useNavigate()
  const { events } = useAppStore()
  const { user } = useAuthStore()
  const { notifications } = useUserSettingsStore()
  const [open, setOpen] = useState(false)
  const [activeEventId, setActiveEventId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const meKeys = useMemo(() => {
    return Array.from(new Set(getUserKeys(user)))
  }, [user?.id, user?.email])
  
  const data = useMemo(() => {
    const lastReadMap = notifications.lastReadByEvent || {}
    // Show ALL accessible chats across all farms — no farm filter here
    const eligible = events.filter(event => {
      if (meKeys.length === 0) return false
      return userCanChat(event, meKeys)
    })

    return eligible
      .map(event => {
        const activityTs = event.chatLastActivityAt?.getTime?.() || event.updatedAt?.getTime?.() || event.date?.getTime?.() || 0
        
        const lastRead = lastReadMap[event.id] || 0
        // Consider unread if activity is newer than last read (with 2s buffer)
        const unread = activityTs > lastRead + 2000

        return {
          id: event.id,
          title: event.title,
          lastActivity: activityTs,
          unread,
          lastActivityDate: event.chatLastActivityAt || event.updatedAt || event.date,
        }
      })
      .sort((a, b) => {
        if (a.unread !== b.unread) return a.unread ? -1 : 1
        return b.lastActivity - a.lastActivity
      })
  }, [events, notifications.lastReadByEvent, meKeys])

  const activeEvent = useMemo(() => events.find(e => e.id === activeEventId) || null, [events, activeEventId])

  const canWriteActiveEvent = useMemo(() => {
    if (!activeEvent) return false
    if (meKeys.length === 0) return false
    if (meKeys.includes(activeEvent.createdBy)) return true
    const p = getUserEventParticipation(activeEvent as any, meKeys)
    return p.status === 'yes' && p.accessLevel === 'full'
  }, [activeEvent, meKeys])

  const filteredData = useMemo(() => {
    if (!search) return data
    return data.filter(d => d.title.toLowerCase().includes(search.toLowerCase()))
  }, [data, search])

  const unreadChats = filteredData.filter(d => d.unread)
  const readChats = filteredData.filter(d => !d.unread)

  // Ref for the chat panel — used to resize it when the software keyboard opens,
  // because `dvh` units can lag on some Android WebViews inside PWA mode.
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !activeEventId) return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const panel = panelRef.current
      if (!panel) return
      // Use 92% of the visual viewport to leave a small gap at the top
      panel.style.height = `${Math.floor(vv.height * 0.92)}px`
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      // Reset inline style when closing so CSS dvh takes over again
      if (panelRef.current) panelRef.current.style.height = ''
    }
  }, [open, activeEventId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <div className="fixed bottom-24 left-4 sm:left-auto sm:right-5 md:right-10 md:bottom-10 z-[60] pointer-events-none">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Apri chat"
            className="relative shadow-lg rounded-full w-14 h-14 bg-primary-600 hover:bg-primary-500 active:scale-95 transition flex items-center justify-center text-white text-2xl pointer-events-auto"
          >
            💬
            {data.some(d => d.unread) && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full px-1.5 py-0.5 shadow">
                {data.filter(d => d.unread).length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Overlay Panel */}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { setOpen(false); setActiveEventId(null) }}
          ></div>
          <div
            ref={panelRef}
            className={`relative w-full sm:w-[420px] md:w-[520px] ${activeEventId ? 'h-[85dvh]' : 'max-h-[85dvh]'} bg-[--bg-card] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-[fadeIn_.18s_ease]`}>
            {!activeEventId && (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h3 className="font-semibold text-[--text-base] flex items-center gap-2"><span>💬</span><span>Chat Eventi</span></h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[--text-muted]">{data.filter(d => d.unread).length} non letti</span>
                    <button onClick={() => setOpen(false)} className="text-[--text-muted] hover:text-[--text-muted] text-sm">Chiudi</button>
                  </div>
                </div>
                
                <div className="px-3 py-2 border-b bg-[--bg-card]">
                  <input 
                    type="text" 
                    placeholder="Cerca evento..." 
                    className="w-full px-3 py-1.5 bg-[--bg-raised] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                <div className="overflow-y-auto custom-scrollbar px-2 py-2">
                  {filteredData.length === 0 && (
                    <div className="py-8 text-center text-[--text-muted] text-sm">
                      {search ? 'Nessun evento trovato' : 'Nessun evento disponibile. Crea un evento per iniziare a chattare!'}
                    </div>
                  )}

                  {unreadChats.length > 0 && (
                    <div className="mb-2">
                      <div className="px-2 py-1 text-[10px] font-bold text-[--text-muted] uppercase tracking-wider">Da leggere</div>
                      {unreadChats.map(ev => (
                        <ChatListItem key={ev.id} ev={ev} onClick={() => { setActiveEventId(ev.id); setOpen(true) }} />
                      ))}
                    </div>
                  )}

                  {readChats.length > 0 && (
                    <div>
                      {unreadChats.length > 0 && <div className="px-2 py-1 text-[10px] font-bold text-[--text-muted] uppercase tracking-wider mt-2">Tutti</div>}
                      {readChats.map(ev => (
                        <ChatListItem key={ev.id} ev={ev} onClick={() => { setActiveEventId(ev.id); setOpen(true) }} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-3 border-t bg-[--bg-subtle] flex items-center justify-between text-xs text-[--text-muted]">
                  <span>{data.filter(d => d.unread).length} chat con nuovi messaggi</span>
                  <button onClick={() => { setOpen(false); navigate('/chats') }} className="text-primary-600 hover:underline">Apri elenco completo</button>
                </div>
              </>
            )}

            {activeEventId && (
              <div className="flex flex-col h-full min-h-0">
                <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveEventId(null)} className="text-sm text-[--text-muted] hover:text-[--text-muted]">← Indietro</button>
                    <div>
                      <p className="text-sm font-semibold text-[--text-base] truncate max-w-[180px]">{activeEvent?.title ?? '...'}</p>
                      <p className="text-[11px] text-[--text-muted]">Chat evento in popup</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setOpen(false); navigate(`/events/${activeEventId}/chat`) }}
                    className="text-xs text-primary-600 hover:underline"
                  >Apri a tutto schermo</button>
                </div>
                <div className="flex-1 min-h-0 bg-[--bg-subtle] flex">
                  <EventChat eventId={activeEventId} canWrite={canWriteActiveEvent} className="flex-1 min-h-0 border-none rounded-none" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default ChatFloatingLauncher

