import React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { chatService } from '../../services/firestore'
import { ChatMessage, ChatReactionKey } from '../../types'
import { useAuthStore } from '../../stores/useAuthStore'
import { useUserSettingsStore } from '../../stores/UserSettingsStore'

interface Props {
  eventId: string
}

const REACTIONS: { key: ChatReactionKey; label: string }[] = [
  { key: 'like', label: '👍' },
  { key: 'love', label: '❤️' },
  { key: 'fun', label: '😂' },
]

const canEditOrDelete = (msg: ChatMessage, meId: string) => {
  if (msg.userId !== meId) return false
  const created = msg.createdAt?.getTime?.() || 0
  return Date.now() - created < 15 * 60 * 1000 // 15 minutes window
}

const EventChat: React.FC<Props> = ({ eventId }) => {
  const { user } = useAuthStore()
  const me = { id: user?.id || user?.email || '', name: user?.displayName || user?.email || 'Tu', photoURL: user?.photoURL }

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatError, setChatError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [quoted, setQuoted] = useState<ChatMessage | null>(null)
  const [participants, setParticipants] = useState<{ uid: string; lastReadAt?: Date }[]>([])
  const [typingUsers, setTypingUsers] = useState<{ uid: string; updatedAt: Date; typing: boolean }[]>([])
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const [showNewIndicator, setShowNewIndicator] = useState(false)
  const typingDebounce = useRef<number | null>(null)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

  const { notifications, toggleEventMute, markEventChatRead } = useUserSettingsStore()
  const muted = !!(notifications.mutedEventIds || []).includes(eventId)

  useEffect(() => {
    const unsub = chatService.listen(
      eventId,
      msgs => {
        setChatError(null)
        setMessages(msgs)
      },
      () => {
        setChatError('Impossibile caricare la chat per questo evento (permessi o rete).')
      }
    )
    return () => unsub()
  }, [eventId])

  useEffect(() => {
    const unsubP = chatService.listenParticipants(eventId, list => setParticipants(list))
    const unsubT = chatService.listenTyping(eventId, list => setTypingUsers(list))
    return () => { unsubP(); unsubT() }
  }, [eventId])

  useEffect(() => {
    // Auto-scroll only if user is near the bottom
    const el = bottomRef.current?.parentElement
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 64
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setShowNewIndicator(false)
    } else {
      setShowNewIndicator(true)
    }
  }, [messages.length])

  useEffect(() => {
    // Mark as read when opening
    markEventChatRead(eventId).catch(()=>{})
    if (me.id) chatService.markRead(eventId, me.id, { displayName: me.name, photoURL: me.photoURL }).catch(()=>{})
  }, [eventId, markEventChatRead, me.id])


  const othersTyping = useMemo(() => {
    const now = Date.now()
    return typingUsers.filter(t => t.uid !== me.id && t.typing && now - t.updatedAt.getTime() < 5000)
  }, [typingUsers, me.id])

  const onSend = async () => {
    if (!me.id) return alert('Devi essere autenticato')
    if (!text.trim() && files.length === 0) return
    try {
      setSending(true)
      const quotedPayload = quoted ? { messageId: quoted.id, textPreview: quoted.text, mediaThumbUrl: quoted.attachments?.[0]?.url } : undefined
      setUploadProgress({})
      await chatService.sendMessage(
        eventId,
        { text: text.trim() || undefined, files: files.length ? files : undefined, quoted: quotedPayload },
        { id: me.id, displayName: me.name, photoURL: me.photoURL },
        (fileName, pct) => setUploadProgress(prev => ({ ...prev, [fileName]: pct }))
      )
      setText('')
      setFiles([])
      setQuoted(null)
      await markEventChatRead(eventId)
      if (me.id) chatService.markRead(eventId, me.id, { displayName: me.name, photoURL: me.photoURL }).catch(()=>{})
    } catch (e) {
      console.error('Send message failed', e)
      alert('Errore nell\'invio del messaggio')
    } finally {
      setSending(false)
    }
  }

  const toggleReaction = async (m: ChatMessage, key: ChatReactionKey) => {
    if (!me.id) return
    const arr = m.reactions?.[key] || []
    const has = arr.includes(me.id)
    try {
      await chatService.toggleReaction(eventId, m.id, key, me.id, has)
    } catch (e) {
      console.error('toggleReaction failed', e)
    }
  }

  const onFilesSelected = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const sel = Array.from(ev.target.files || [])
    // basic limits: max 3 files, 5MB each
    const limited = sel.slice(0, 3).filter(f => f.size <= 5 * 1024 * 1024)
    setFiles(limited)
  }

  const onEdit = async (m: ChatMessage) => {
    const newText = prompt('Modifica messaggio', m.text || '')
    if (newText == null) return
    try { await chatService.editMessage(eventId, m.id, newText) } catch (e) { console.error(e) }
  }

  const onDelete = async (m: ChatMessage) => {
    if (!confirm('Eliminare questo messaggio?')) return
    try { await chatService.deleteMessage(eventId, m.id) } catch (e) { console.error(e) }
  }

  const unreadCount = useMemo(() => {
    const lastRead = notifications.lastReadByEvent?.[eventId] || 0
    return messages.filter(m => (m.createdAt?.getTime?.() || 0) > lastRead && m.userId !== me.id).length
  }, [messages, notifications.lastReadByEvent, eventId, me.id])

  const ticksFor = (m: ChatMessage): 'clock' | 'single' | 'double' | 'double-blue' => {
    // No createdAt shouldn't happen (we only show committed docs), fallback to clock
    if (!m.createdAt) return 'clock'
    const others = participants.filter(p => p.uid !== me.id)
    if (others.length === 0) return 'double'
    const createdMs = m.createdAt.getTime()
    const readCount = others.filter(p => (p.lastReadAt?.getTime?.() || 0) >= createdMs).length
    if (readCount === others.length) return 'double-blue'
    return 'double'
  }

  const renderTicks = (m: ChatMessage) => {
    const t = ticksFor(m)
    if (t === 'clock') return <span title="In invio">🕒</span>
    if (t === 'single') return <span title="Inviato">✓</span>
    if (t === 'double') return <span title="Consegnato">✓✓</span>
    return <span className="text-primary-600" title="Letto">✓✓</span>
  }

  const onComposerChange = (v: string) => {
    setText(v)
    if (!me.id) return
    chatService.setTyping(eventId, me.id, true).catch(()=>{})
    if (typingDebounce.current) window.clearTimeout(typingDebounce.current)
    typingDebounce.current = window.setTimeout(() => {
      chatService.setTyping(eventId, me.id, false).catch(()=>{})
    }, 2500)
  }

  return (
    <div id="chat" className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Chat</h2>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-primary-100 text-primary-700" title="Non letti">{unreadCount}</span>
          )}
          <button
            onClick={() => toggleEventMute(eventId)}
            className={`px-2 py-1 text-xs rounded-lg border ${muted ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-800 hover:bg-gray-50'}`}
            title={muted ? 'Notifiche disattivate per questo evento' : 'Disattiva notifiche per questo evento'}
          >{muted ? '🔕 Silenzia' : '🔔 Notifiche'}</button>
        </div>
      </div>

      {/* Messages list */}
      <div className="relative max-h-[50vh] overflow-y-auto pr-1 space-y-3" onScroll={() => {
        // If scrolled to bottom, mark as read
        const el = bottomRef.current?.parentElement
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 16) {
          if (me.id) chatService.markRead(eventId, me.id, { displayName: me.name, photoURL: me.photoURL }).catch(()=>{})
          setShowNewIndicator(false)
        }
      }}>
        {chatError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
            {chatError}
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-sm text-gray-600">Nessun messaggio. Inizia la conversazione!</div>
        )}
        {(() => {
          const els: React.ReactNode[] = []
          let lastDay = ''
          let prevUser: string | null = null
          let prevAt: number = 0
          const dayLabel = (d: Date) => {
            const today = new Date(); today.setHours(0,0,0,0)
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1)
            const dd = new Date(d); const day = new Date(dd); day.setHours(0,0,0,0)
            if (day.getTime() === today.getTime()) return 'Oggi'
            if (day.getTime() === yesterday.getTime()) return 'Ieri'
            return dd.toLocaleDateString('it-IT', { day: '2-digit', month: 'long' })
          }
          for (const m of messages) {
            const dk = m.createdAt ? m.createdAt.toDateString() : ''
            if (dk && dk !== lastDay) {
              lastDay = dk
              els.push(
                <div key={`sep-${dk}`} className="text-[11px] text-gray-500 text-center my-2">
                  <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{dayLabel(m.createdAt)}</span>
                </div>
              )
            }
            const mine = m.userId === me.id
            const grouped = prevUser === m.userId && Math.abs((m.createdAt?.getTime?.() || 0) - prevAt) < 60_000
            prevUser = m.userId
            prevAt = m.createdAt?.getTime?.() || 0
            els.push(
              <div key={m.id} className={`flex items-start gap-2 ${mine ? 'justify-end' : 'justify-start'} group ${grouped ? 'mt-0.5' : ''}`}>
              {!mine && !grouped && (
                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0">
                  {m.userPhotoURL ? (
                    <img src={m.userPhotoURL} alt={m.userName} className="w-full h-full object-cover"/>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">{m.userName?.[0]?.toUpperCase?.() || '?'}</div>
                  )}
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl border ${mine ? 'bg-primary-50 border-primary-200' : 'bg-white border-gray-200'} p-2`}
                   title={m.createdAt?.toLocaleString?.() || ''}>
                {!grouped && <div className="text-[11px] text-gray-500 mb-0.5">{mine ? 'Tu' : m.userName}</div>}
                {m.quoted && (
                  <div className="mb-1 text-xs border-l-2 border-primary-300 pl-2 text-gray-600 bg-primary-50/40 rounded">
                    {m.quoted.mediaThumbUrl && (
                      <img src={m.quoted.mediaThumbUrl} alt="quote" className="inline-block w-10 h-10 object-cover rounded mr-2 align-middle" />
                    )}
                    <span className="align-middle italic truncate max-w-[220px] inline-block">{m.quoted.textPreview || 'Media'}</span>
                  </div>
                )}
                {m.deleted ? (
                  <div className="text-xs italic text-gray-400">Messaggio eliminato</div>
                ) : (
                  <>
                    {m.text && <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="mt-1 grid grid-cols-3 gap-1">
                        {m.attachments.map(att => (
                          <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="block border rounded overflow-hidden hover:opacity-90">
                            {att.type === 'image' ? (
                              <img src={att.url} alt={att.name} className="w-full h-24 object-cover"/>
                            ) : (
                              <div className="p-2 text-xs text-primary-700 underline truncate">{att.name}</div>
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      {REACTIONS.map(r => {
                        const arr = m.reactions?.[r.key] || []
                        const active = arr.includes(me.id)
                        return (
                          <button key={r.key} onClick={() => toggleReaction(m, r.key)} className={`text-xs px-1.5 py-0.5 rounded-full border ${active ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-200 text-gray-700'}`}>{r.label} {arr.length || ''}</button>
                        )
                      })}
                      <button onClick={() => setQuoted(m)} className="ml-2 text-xs text-primary-700 hover:underline">Rispondi</button>
                      {canEditOrDelete(m, me.id) && !m.deleted && (
                        <>
                          <button onClick={() => onEdit(m)} className="ml-2 text-xs text-gray-500 hover:text-gray-700">Modifica</button>
                          <button onClick={() => onDelete(m)} className="text-xs text-gray-500 hover:text-gray-700">Elimina</button>
                        </>
                      )}
                      <span className="ml-auto text-[10px] text-gray-400 flex items-center gap-1">
                        <span>{m.createdAt?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>{renderTicks(m)}</span>
                        {m.editedAt && <span className="text-gray-400">(modificato)</span>}
                        <Menu message={m} onReply={() => setQuoted(m)} onCopy={() => { if (m.text) navigator.clipboard?.writeText(m.text).catch(()=>{}) }} onDelete={() => onDelete(m)} canEdit={canEditOrDelete(m, me.id) && !m.deleted} />
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            )
          }
          return els
        })()}
        <div ref={bottomRef} />
        {showNewIndicator && (
          <div className="sticky bottom-1 flex justify-center">
            <button onClick={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowNewIndicator(false) }} className="px-2 py-1 text-xs rounded-full bg-primary-600 text-white shadow">Nuovi messaggi ↓</button>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="mt-3 border-t pt-3">
        {quoted && (
          <div className="mb-2 text-xs border-l-2 border-primary-300 pl-2 text-gray-600 bg-primary-50/40 rounded flex items-center justify-between">
            <div className="py-1 pr-2 truncate">
              {quoted.attachments?.[0]?.url && (
                <img src={quoted.attachments[0].url} alt="quote" className="inline-block w-8 h-8 object-cover rounded mr-2 align-middle" />
              )}
              <span className="align-middle italic truncate max-w-[220px] inline-block">{quoted.text || 'Media'}</span>
            </div>
            <button className="text-xs px-2 py-1" onClick={() => setQuoted(null)}>✕</button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="inline-flex items-center justify-center w-11 h-11 text-base border rounded-lg cursor-pointer hover:bg-gray-50" title="Aggiungi allegati" aria-label="Aggiungi allegati">
            📎
            <input type="file" multiple className="hidden" onChange={onFilesSelected} />
          </label>
          <EmojiPicker onPick={(emoji) => setText(t => (t || '') + emoji)} />
          <div className="flex-1">
            <textarea
              value={text}
              onChange={e => onComposerChange(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm resize-none"
              rows={2}
              placeholder="Scrivi un messaggio..."
            />
            {othersTyping.length > 0 && (
              <div className="text-[11px] text-gray-500 mt-1">
                {othersTyping.length === 1 ? 'Sta scrivendo…' : 'Stanno scrivendo…'}
              </div>
            )}
          </div>
          <button disabled={sending || (!text.trim() && files.length===0)} onClick={onSend} className={`h-11 px-4 rounded-lg text-sm ${sending ? 'bg-gray-200 text-gray-500' : 'bg-primary-600 text-white hover:bg-primary-700'}`}>Invia</button>
        </div>
        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((f,i) => (
              <span key={i} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{f.name}</span>
            ))}
            <button onClick={() => setFiles([])} className="text-xs text-gray-500 hover:text-gray-700">Rimuovi allegati</button>
          </div>
        )}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="mt-2 space-y-1">
            {Object.entries(uploadProgress).map(([name, pct]) => (
              <div key={name} className="text-xs text-gray-600 flex items-center gap-2">
                <span className="truncate max-w-[40vw]">{name}</span>
                <div className="flex-1 h-1.5 bg-gray-200 rounded">
                  <div className="h-1.5 bg-primary-500 rounded" style={{ width: `${pct}%` }} />
                </div>
                <span>{pct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default EventChat
 
// Lightweight inline actions menu
const Menu: React.FC<{ message: ChatMessage; onReply: () => void; onCopy: () => void; onDelete: () => void; canEdit: boolean }>
  = ({ onReply, onCopy, onDelete, canEdit }) => {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block ml-1">
      <button
        className="text-gray-400 hover:text-gray-600 px-1"
        title="Azioni"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 bottom-5 bg-white border border-gray-200 rounded-lg shadow-lg text-[12px] min-w-[140px] z-10">
          <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { onReply(); setOpen(false) }}>↩️ Rispondi</button>
          <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { onCopy(); setOpen(false) }}>📋 Copia</button>
          {canEdit && <button className="block w-full text-left px-3 py-2 hover:bg-red-50 text-red-600" onClick={() => { onDelete(); setOpen(false) }}>🗑️ Elimina</button>}
        </div>
      )}
    </span>
  )
}

// Tiny emoji popover for quick insert
const EmojiPicker: React.FC<{ onPick: (emoji: string) => void }> = ({ onPick }) => {
  const [open, setOpen] = useState(false)
  const common = ['😀','😁','😂','🤣','😍','👍','🙏','🎉','🥳','🍕','⚽','🏖️']
  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="inline-flex items-center justify-center w-11 h-11 text-base border rounded-lg hover:bg-gray-50"
        title="Emoji"
        onClick={(e) => { e.preventDefault(); setOpen(o => !o) }}
      >
        😊
      </button>
      {open && (
        <div className="absolute left-0 bottom-12 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-6 gap-1 text-xl z-10">
          {common.map(c => (
            <button key={c} className="w-8 h-8 hover:bg-gray-50 rounded" onClick={() => { onPick(c); setOpen(false) }}>{c}</button>
          ))}
        </div>
      )}
    </span>
  )
}
