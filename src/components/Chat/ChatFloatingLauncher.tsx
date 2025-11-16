import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/AppStore'
import { useUserSettingsStore } from '../../stores/UserSettingsStore'
import { useAuthStore } from '../../stores/useAuthStore'
import EventChat from './EventChat'

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
  const meId = user?.id || user?.email || ''
  
  const data = useMemo(() => {
    const lastReadMap = notifications.lastReadByEvent || {}
    const eligible = events.filter(event => {
      if (!meId) return true
      if (event.createdBy === meId) return true
      return event.participants?.some?.(p => p.userId === meId)
    })

    return eligible
      .map(event => {
        const activityTs = event.chatLastActivityAt?.getTime?.() || event.updatedAt?.getTime?.() || event.date?.getTime?.() || 0
        const lastRead = lastReadMap[event.id] || 0
        const unread = !!(event.chatLastActivityAt && activityTs > lastRead)
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
  }, [events, notifications.lastReadByEvent, meId])

  const activeEvent = useMemo(() => events.find(e => e.id === activeEventId) || null, [events, activeEventId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-24 left-4 sm:left-auto sm:right-5 md:right-10 md:bottom-10 z-[60] pointer-events-none">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
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

      {/* Overlay Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { setOpen(false); setActiveEventId(null) }}
          ></div>
          <div className="relative w-full sm:w-[420px] md:w-[520px] max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-[fadeIn_.18s_ease]">
            {!activeEvent && (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h3 className="font-semibold text-neutral-800 flex items-center gap-2"><span>💬</span><span>Chat Eventi</span></h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400">{data.filter(d => d.unread).length} non letti</span>
                    <button onClick={() => setOpen(false)} className="text-neutral-500 hover:text-neutral-700 text-sm">Chiudi</button>
                  </div>
                </div>
                <div className="overflow-y-auto custom-scrollbar px-2 py-2 divide-y">
                  {data.length === 0 && (
                    <div className="py-8 text-center text-neutral-500 text-sm">
                      Nessun evento disponibile. Crea un evento per iniziare a chattare!
                    </div>
                  )}
                  {data.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => { setActiveEventId(ev.id); setOpen(true) }}
                      className="w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-neutral-50 rounded-lg group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center font-bold text-sm shadow-inner">
                        {ev.title.slice(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-neutral-800 truncate group-hover:text-primary-700 transition-colors">{ev.title}</span>
                          {ev.unread && <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>}
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {ev.lastActivityDate
                            ? new Date(ev.lastActivityDate).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
                            : 'Nessuna attività ancora'}
                        </p>
                      </div>
                      {ev.unread && (
                        <span className="ml-2 text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Nuovi</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="p-3 border-t bg-neutral-50 flex items-center justify-between text-xs text-neutral-500">
                  <span>{data.filter(d => d.unread).length} chat con nuovi messaggi</span>
                  <button onClick={() => { setOpen(false); navigate('/chats') }} className="text-primary-600 hover:underline">Apri elenco completo</button>
                </div>
              </>
            )}

            {activeEvent && (
              <div className="flex flex-col h-full">
                <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveEventId(null)} className="text-sm text-neutral-500 hover:text-neutral-700">← Indietro</button>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 truncate max-w-[180px]">{activeEvent.title}</p>
                      <p className="text-[11px] text-neutral-500">Chat evento in popup</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setOpen(false); navigate(`/events/${activeEvent.id}/chat`) }}
                    className="text-xs text-primary-600 hover:underline"
                  >Apri a tutto schermo</button>
                </div>
                <div className="flex-1 overflow-y-auto bg-neutral-50">
                  <EventChat eventId={activeEvent.id} />
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
