import React, { useEffect, useMemo, useRef, useState } from 'react'
import { chatService, eventService } from '../../services/firestore'
import { ChatMessage, ChatReactionKey, EventParticipant, EventParticipation } from '../../types'
import { useAuthStore } from '../../stores/useAuthStore'
import { useUserSettingsStore } from '../../stores/UserSettingsStore'

interface Props {
  eventId: string
  eventName?: string
  onBack?: () => void
  className?: string
  canWrite?: boolean
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

const EventChat: React.FC<Props> = ({ eventId, eventName, onBack, className, canWrite: canWriteProp }) => {
  const { user } = useAuthStore()
  const me = { id: user?.id || user?.email || '', name: user?.displayName || user?.email || 'Tu', photoURL: user?.photoURL }

  const meKeys = useMemo(() => {
    const keys = [user?.id, user?.email].filter((v): v is string => typeof v === 'string' && v.length > 0)
    return Array.from(new Set(keys))
  }, [user?.id, user?.email])

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatError, setChatError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [quoted, setQuoted] = useState<ChatMessage | null>(null)
  const [selectedMentions, setSelectedMentions] = useState<Array<{ uid: string; name: string }>>([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [participants, setParticipants] = useState<{ uid: string; lastReadAt?: Date; displayName?: string; photoUrl?: string }[]>([])
  const [eventPeople, setEventPeople] = useState<Array<{ uid: string; name: string }>>([])
  const [eventParticipants, setEventParticipants] = useState<EventParticipant[]>([])
  const [eventCreatedBy, setEventCreatedBy] = useState<string | null>(null)
  const [eventParticipation, setEventParticipation] = useState<Record<string, EventParticipation> | null>(null)
  const [typingUsers, setTypingUsers] = useState<{ uid: string; updatedAt: Date; typing: boolean }[]>([])
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const [showNewIndicator, setShowNewIndicator] = useState(false)
  const typingDebounce = useRef<number | null>(null)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<number | null>(null)
  const isRecordingCancelled = useRef(false)

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

  // Load event participants for @mentions (so you can tag even if they never opened the chat)
  useEffect(() => {
    let alive = true
    eventService.getById(eventId)
      .then(ev => {
        if (!alive) return
        setEventCreatedBy(typeof ev?.createdBy === 'string' ? ev.createdBy : null)
        setEventParticipants(Array.isArray(ev?.participants) ? ev.participants : [])
        setEventParticipation((ev as any)?.participation && typeof (ev as any).participation === 'object' ? (ev as any).participation : null)
        const ppl = (ev?.participants || [])
          .filter(p => !!p?.userId)
          .map(p => ({ uid: p.userId, name: (p.name || 'Utente').trim() }))
          .filter(p => p.name.length > 0)
        setEventPeople(ppl)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [eventId])

  const computedCanWrite = useMemo(() => {
    if (!me.id) return false
    if (eventCreatedBy && meKeys.includes(eventCreatedBy)) return true
    // Prefer explicit participation: chat only after status=yes
    if (eventParticipation) {
      for (const k of meKeys) {
        const entry = (eventParticipation as any)[k] as any
        if (entry?.status === 'yes' && entry?.accessLevel === 'full') return true
      }
    }
    // Legacy fallback
    const p = eventParticipants.find(p => meKeys.includes(p.userId))
    if (!p) return false
    return p.status === 'yes'
  }, [eventCreatedBy, eventParticipants, eventParticipation, me.id, meKeys])

  const canWrite = typeof canWriteProp === 'boolean' ? canWriteProp : computedCanWrite

  // Scroll handling
  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' })
  }

  useEffect(() => {
    // Auto-scroll logic
    const el = bottomRef.current?.parentElement
    if (!el) return
    
    const lastMsg = messages[messages.length - 1]
    const isMine = lastMsg?.userId === me.id
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150

    if (isMine || nearBottom) {
      scrollToBottom()
      setShowNewIndicator(false)
    } else if (messages.length > 0) {
      setShowNewIndicator(true)
    }
  }, [messages.length, me.id])

  useEffect(() => {
    // Mark as read when opening
    markEventChatRead(eventId).catch(()=>{})
    if (me.id) chatService.markRead(eventId, me.id, { displayName: me.name, photoURL: me.photoURL }).catch(()=>{})
  }, [eventId, markEventChatRead, me.id])


  const othersTyping = useMemo(() => {
    const now = Date.now()
    return typingUsers.filter(t => t.uid !== me.id && t.typing && now - t.updatedAt.getTime() < 5000)
  }, [typingUsers, me.id])

  const sendVoiceMessage = async (audioFile: File) => {
    if (!me.id) return
    try {
      setSending(true)
      setUploadProgress({})
      await chatService.sendMessage(
        eventId,
        { files: [audioFile] },
        { id: me.id, displayName: me.name, photoURL: me.photoURL },
        (fileName, pct) => setUploadProgress(prev => ({ ...prev, [fileName]: pct }))
      )
      scrollToBottom()
    } catch (e) {
      console.error('Failed to send voice message', e)
      alert('Errore invio vocale')
    } finally {
      setSending(false)
      setUploadProgress({})
    }
  }

  const onSend = async () => {
    if (!me.id) return alert('Devi essere autenticato')
    if (!text.trim() && files.length === 0) return
    try {
      setSending(true)
      const quotedPayload = quoted ? { messageId: quoted.id, textPreview: quoted.text, mediaThumbUrl: quoted.attachments?.[0]?.url } : undefined
      const mentions = selectedMentions
        .filter(m => text.includes(`@${m.name}`))
        .map(m => m.uid)
      setUploadProgress({})
      await chatService.sendMessage(
        eventId,
        { text: text.trim() || undefined, files: files.length ? files : undefined, quoted: quotedPayload, mentions: mentions.length ? mentions : undefined },
        { id: me.id, displayName: me.name, photoURL: me.photoURL },
        (fileName, pct) => setUploadProgress(prev => ({ ...prev, [fileName]: pct }))
      )
      setText('')
      setFiles([])
      setQuoted(null)
      setSelectedMentions([])
      setMentionOpen(false)
      setMentionQuery('')
      setMentionStart(null)
      setMentionIndex(0)
      await markEventChatRead(eventId)
      if (me.id) chatService.markRead(eventId, me.id, { displayName: me.name, photoURL: me.photoURL }).catch(()=>{})
      scrollToBottom()
    } catch (e) {
      console.error('Send message failed', e)
      alert('Errore nell\'invio del messaggio')
    } finally {
      setSending(false)
    }
  }

  // Audio Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      isRecordingCancelled.current = false

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks immediately
        stream.getTracks().forEach(track => track.stop())

        if (isRecordingCancelled.current) {
          audioChunksRef.current = []
          return
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        // Prevent sending empty or too short recordings (< 1s)
        if (audioBlob.size < 1000 || audioChunksRef.current.length === 0) {
           return
        }

        const audioFile = new File([audioBlob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' })
        await sendVoiceMessage(audioFile)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Error accessing microphone:', err)
      alert('Impossibile accedere al microfono')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // If recording is very short (< 500ms), treat as cancel/accidental
      if (recordingTime < 1 && audioChunksRef.current.length === 0) {
        isRecordingCancelled.current = true
      }
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      isRecordingCancelled.current = true
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      audioChunksRef.current = [] 
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
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

  const onDelete = async (m: ChatMessage) => {
    if (!confirm('Eliminare questo messaggio?')) return
    try { await chatService.deleteMessage(eventId, m.id) } catch (e) { console.error(e) }
  }

  const ticksFor = (m: ChatMessage): 'clock' | 'single' | 'double' | 'double-blue' => {
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
    return <span className="text-blue-500" title="Letto">✓✓</span>
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

  const mentionCandidates = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase()
    const pool = [
      ...eventPeople,
      ...participants
        .filter(p => !!p.uid)
        .map(p => ({ uid: p.uid, name: (p.displayName || 'Utente').trim() }))
    ]
    const seen = new Set<string>()
    const list = pool
      .filter(p => !!p.uid && p.uid !== me.id)
      .filter(p => {
        if (seen.has(p.uid)) return false
        seen.add(p.uid)
        return true
      })
      .map(p => ({ uid: p.uid, name: (p.name || 'Utente').trim() }))
      .filter(p => p.name.length > 0)
    if (!mentionOpen) return []
    if (!q) return list.slice(0, 12)
    return list.filter(p => p.name.toLowerCase().includes(q)).slice(0, 12)
  }, [mentionOpen, mentionQuery, participants, eventPeople, me.id])

  const computeMentionState = (value: string) => {
    const el = textareaRef.current
    const cursor = (el && typeof el.selectionStart === 'number') ? el.selectionStart : value.length
    const before = value.slice(0, cursor)
    const at = before.lastIndexOf('@')
    if (at < 0) {
      setMentionOpen(false)
      setMentionQuery('')
      setMentionStart(null)
      setMentionIndex(0)
      return
    }
    const prev = at === 0 ? ' ' : before[at - 1]
    const okPrefix = /\s/.test(prev)
    if (!okPrefix) {
      setMentionOpen(false)
      setMentionQuery('')
      setMentionStart(null)
      setMentionIndex(0)
      return
    }
    const between = before.slice(at + 1)
    if (/\s/.test(between)) {
      setMentionOpen(false)
      setMentionQuery('')
      setMentionStart(null)
      setMentionIndex(0)
      return
    }
    setMentionOpen(true)
    setMentionQuery(between)
    setMentionStart(at)
    setMentionIndex(0)
  }

  const applyMention = (m: { uid: string; name: string }) => {
    const el = textareaRef.current
    if (!el) return
    const cursor = typeof el.selectionStart === 'number' ? el.selectionStart : text.length
    const start = mentionStart
    if (start == null) return

    const before = text.slice(0, start)
    const after = text.slice(cursor)
    const inserted = `@${m.name} `
    const next = `${before}${inserted}${after}`
    setText(next)
    setSelectedMentions(prev => {
      if (prev.some(x => x.uid === m.uid)) return prev
      return [...prev, { uid: m.uid, name: m.name }]
    })
    setMentionOpen(false)
    setMentionQuery('')
    setMentionStart(null)
    setMentionIndex(0)

    requestAnimationFrame(() => {
      try {
        el.focus()
        const pos = before.length + inserted.length
        el.setSelectionRange(pos, pos)
      } catch {}
    })
  }

  return (
    <div id="chat" className={`flex flex-col min-h-0 bg-[#e5ddd5] dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700 shadow-sm relative ${className || 'h-[calc(100vh-140px)]'}`}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 shadow-sm">
        {onBack && (
          <button onClick={onBack} className="p-1 -ml-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate text-gray-900 dark:text-white">{eventName || 'Chat Evento'}</h2>
          <div className="text-xs text-gray-500 truncate">
            {othersTyping.length > 0
              ? <span className="text-green-600 font-medium">sta scrivendo...</span>
              : `${participants.length} partecipanti`
            }
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toggleEventMute(eventId)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
            {muted ? '🔇' : '🔈'}
          </button>
        </div>
      </div>

      <ChatThread
        me={me}
        messages={messages}
        chatError={chatError}
        showNewIndicator={showNewIndicator}
        onReply={setQuoted}
        onDelete={onDelete}
        onToggleReaction={toggleReaction}
        canEditOrDelete={(m) => canEditOrDelete(m, me.id)}
        renderTicks={renderTicks}
        scrollToBottom={scrollToBottom}
        bottomRef={bottomRef}
        onAtBottom={() => {
          if (me.id) chatService.markRead(eventId, me.id, { displayName: me.name, photoURL: me.photoURL }).catch(()=>{})
          setShowNewIndicator(false)
        }}
      />

      {canWrite && (
        <ChatComposer
          quoted={quoted}
          onClearQuoted={() => setQuoted(null)}
          files={files}
          onRemoveFile={(idx) => setFiles(files.filter((_, i) => i !== idx))}
          uploadProgress={uploadProgress}
          onFilesSelected={onFilesSelected}
          textareaRef={textareaRef}
          text={text}
          onTextChange={(v) => {
            onComposerChange(v)
            computeMentionState(v)
          }}
          onComputeMentionState={computeMentionState}
          mentionOpen={mentionOpen}
          mentionCandidates={mentionCandidates}
          mentionIndex={mentionIndex}
          setMentionIndex={setMentionIndex}
          applyMention={applyMention}
          closeMention={() => {
            setMentionOpen(false)
            setMentionQuery('')
            setMentionStart(null)
            setMentionIndex(0)
          }}
          sending={sending}
          onSend={onSend}
          scrollToBottom={scrollToBottom}
          setTextAppendEmoji={(emoji) => setText(t => t + emoji)}
          isRecording={isRecording}
          recordingTime={recordingTime}
          startRecording={startRecording}
          stopRecording={stopRecording}
          cancelRecording={cancelRecording}
          formatTime={formatTime}
        />
      )}
    </div>
  )
}

export default EventChat

function ChatThread(props: {
  me: { id: string; name: string; photoURL?: string }
  messages: ChatMessage[]
  chatError: string | null
  showNewIndicator: boolean
  onReply: (m: ChatMessage) => void
  onDelete: (m: ChatMessage) => void
  onToggleReaction: (m: ChatMessage, key: ChatReactionKey) => void
  canEditOrDelete: (m: ChatMessage) => boolean
  renderTicks: (m: ChatMessage) => React.ReactNode
  scrollToBottom: (smooth?: boolean) => void
  bottomRef: React.RefObject<HTMLDivElement>
  onAtBottom: () => void
}) {
  const {
    me,
    messages,
    chatError,
    showNewIndicator,
    onReply,
    onDelete,
    onToggleReaction,
    canEditOrDelete,
    renderTicks,
    scrollToBottom,
    bottomRef,
    onAtBottom,
  } = props

  return (
    <>
      <div
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 bg-[#e5ddd5] dark:bg-gray-900"
        style={{
          backgroundImage:
            'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
          backgroundBlendMode: 'overlay',
        }}
        onScroll={(e) => {
          const el = e.currentTarget
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
            onAtBottom()
          }
        }}
      >
        {chatError && (
          <div className="text-center my-4">
            <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs border border-red-200">{chatError}</span>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <div className="text-4xl">💬</div>
            <div className="text-sm">Nessun messaggio. Inizia la conversazione!</div>
          </div>
        )}

        {(() => {
          const els: React.ReactNode[] = []
          let lastDay = ''
          let prevUser: string | null = null

          const dayLabel = (d: Date) => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const yesterday = new Date(today)
            yesterday.setDate(yesterday.getDate() - 1)
            const dd = new Date(d)
            const day = new Date(dd)
            day.setHours(0, 0, 0, 0)
            if (day.getTime() === today.getTime()) return 'Oggi'
            if (day.getTime() === yesterday.getTime()) return 'Ieri'
            return dd.toLocaleDateString('it-IT', { day: '2-digit', month: 'long' })
          }

          for (const m of messages) {
            const dk = m.createdAt ? m.createdAt.toDateString() : ''
            if (dk && dk !== lastDay) {
              lastDay = dk
              els.push(
                <div key={`sep-${dk}`} className="flex justify-center my-4 sticky top-0 z-10">
                  <span className="bg-gray-200/80 backdrop-blur-sm text-gray-600 text-[11px] font-medium px-3 py-1 rounded-full shadow-sm">
                    {dayLabel(m.createdAt)}
                  </span>
                </div>
              )
            }

            const mine = m.userId === me.id
            const grouped = prevUser === m.userId
            prevUser = m.userId

            if (m.type === 'system') {
              els.push(
                <div key={m.id} className="flex justify-center my-2">
                  <div className="bg-gray-100/80 text-gray-600 text-xs px-3 py-1 rounded-lg flex items-center gap-2 border border-gray-200">
                    <span className="font-semibold">{m.userName === 'System' ? 'Sistema' : m.userName}</span>
                    <span>{m.text}</span>
                  </div>
                </div>
              )
              continue
            }

            els.push(
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'} mb-2 group px-2`}>
                <div
                  className={`max-w-[80%] relative shadow-sm px-3 py-2 ${
                    mine
                      ? 'bg-green-100 dark:bg-green-900/50 text-gray-900 dark:text-white rounded-3xl rounded-tr-none ml-auto'
                      : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-3xl rounded-tl-none'
                  }`}
                >
                  {/* Reply Context */}
                  {m.quoted && (
                    <div
                      className={`mb-1 rounded-lg p-2 text-xs border-l-4 cursor-pointer bg-black/5 dark:bg-white/10 ${mine ? 'border-green-600' : 'border-gray-400'}`}
                      onClick={() => {
                        const el = document.getElementById(`msg-${m.quoted?.messageId}`)
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }}
                    >
                      <div className="font-semibold opacity-90 mb-0.5 truncate">{m.quoted.textPreview || 'Allegato'}</div>
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="">
                    {!mine && !grouped && (
                      <div className="text-xs font-bold text-orange-600 mb-1">{m.userName}</div>
                    )}

                    {m.deleted ? (
                      <div className="italic opacity-60 text-sm flex items-center gap-1">
                        🚫 <span>Messaggio eliminato</span>
                      </div>
                    ) : (
                      <>
                        {/* Attachments */}
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="mb-2 grid gap-2">
                            {m.attachments.map((att) => (
                              <div key={att.id}>
                                {att.type === 'image' ? (
                                  <a href={att.url} target="_blank" rel="noreferrer">
                                    <img src={att.url} alt="attachment" className="rounded-lg max-h-60 object-cover w-full aspect-video" />
                                  </a>
                                ) : att.type === 'audio' ? (
                                  <div className="flex items-center gap-2 bg-black/5 dark:bg-white/10 p-2 rounded-lg min-w-[200px]">
                                    <audio controls src={att.url} className="h-8 w-full" />
                                  </div>
                                ) : (
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 p-2 bg-black/5 dark:bg-white/10 rounded-lg hover:bg-black/10 transition"
                                  >
                                    <span className="text-2xl">📄</span>
                                    <span className="text-sm underline truncate">{att.name}</span>
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Text */}
                        {m.text && <div className="text-[15px] whitespace-pre-wrap break-words leading-relaxed">{m.text}</div>}
                      </>
                    )}
                  </div>

                  {/* Context Menu Trigger */}
                  {!m.deleted && (
                    <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Menu
                        message={m}
                        onReply={() => onReply(m)}
                        onCopy={() => m.text && navigator.clipboard.writeText(m.text)}
                        onDelete={() => onDelete(m)}
                        canEdit={canEditOrDelete(m)}
                      />
                    </div>
                  )}
                </div>

                {/* Footer: Reactions & Timestamp */}
                <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} mt-1`}>
                  {/* Reactions */}
                  {Object.keys(m.reactions || {}).length > 0 && (
                    <div className="flex gap-1 -mt-3 mb-1 z-10 relative px-2">
                      {REACTIONS.map((r) => {
                        const count = m.reactions?.[r.key]?.length || 0
                        if (count === 0) return null
                        const iReacted = m.reactions?.[r.key]?.includes(me.id)
                        return (
                          <button
                            key={r.key}
                            onClick={() => onToggleReaction(m, r.key)}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border shadow-sm bg-white dark:bg-gray-800 ${iReacted ? 'border-green-500' : 'border-gray-200 dark:border-gray-600'}`}
                          >
                            {r.label} {count}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 px-1">
                    <span>{m.createdAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {mine && <span>{renderTicks(m)}</span>}
                    {m.editedAt && <span>(modificato)</span>}
                  </div>
                </div>
              </div>
            )
          }
          return els
        })()}
        <div ref={bottomRef} />
      </div>

      {/* New Message Indicator */}
      {showNewIndicator && (
        <div className="absolute bottom-20 right-4 z-20">
          <button onClick={() => scrollToBottom()} className="bg-white text-primary-600 p-2 rounded-full shadow-lg border border-gray-100 animate-bounce">
            ⬇️
          </button>
        </div>
      )}
    </>
  )
}

function ChatComposer(props: {
  quoted: ChatMessage | null
  onClearQuoted: () => void
  files: File[]
  onRemoveFile: (idx: number) => void
  uploadProgress: Record<string, number>
  onFilesSelected: (ev: React.ChangeEvent<HTMLInputElement>) => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
  text: string
  onTextChange: (v: string) => void
  onComputeMentionState: (v: string) => void
  mentionOpen: boolean
  mentionCandidates: Array<{ uid: string; name: string }>
  mentionIndex: number
  setMentionIndex: React.Dispatch<React.SetStateAction<number>>
  applyMention: (m: { uid: string; name: string }) => void
  closeMention: () => void
  sending: boolean
  onSend: () => void
  scrollToBottom: (smooth?: boolean) => void
  setTextAppendEmoji: (emoji: string) => void
  isRecording: boolean
  recordingTime: number
  startRecording: () => void
  stopRecording: () => void
  cancelRecording: () => void
  formatTime: (seconds: number) => string
}) {
  const {
    quoted,
    onClearQuoted,
    files,
    onRemoveFile,
    uploadProgress,
    onFilesSelected,
    textareaRef,
    text,
    onTextChange,
    onComputeMentionState,
    mentionOpen,
    mentionCandidates,
    mentionIndex,
    setMentionIndex,
    applyMention,
    closeMention,
    sending,
    onSend,
    scrollToBottom,
    setTextAppendEmoji,
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
    formatTime,
  } = props

  return (
    <div className="bg-white p-2 border-t pb-[max(0.25rem,env(safe-area-inset-bottom))]">
      {/* Quoted Message Preview */}
      {quoted && (
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg mb-2 border-l-4 border-primary-500">
          <div className="overflow-hidden">
            <div className="text-xs font-bold text-primary-600">Risposta a {quoted.userName}</div>
            <div className="text-sm truncate text-gray-600">{quoted.text || 'Allegato'}</div>
          </div>
          <button onClick={onClearQuoted} className="p-1 hover:bg-gray-200 rounded-full">✕</button>
        </div>
      )}

      {/* File Preview */}
      {files.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
          {files.map((f, i) => (
            <div key={i} className="relative bg-gray-100 p-2 rounded-lg min-w-[100px]">
              <div className="text-xs truncate w-24">{f.name}</div>
              <div className="text-[10px] text-gray-500">{(f.size / 1024).toFixed(0)} KB</div>
              <button
                onClick={() => onRemoveFile(i)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="mb-2 space-y-1">
          {Object.entries(uploadProgress).map(([name, pct]) => (
            <div key={name} className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Plus Menu */}
        <div className="relative group">
          <button className="p-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 hidden group-hover:block min-w-[160px] z-20">
            <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer text-gray-700 dark:text-gray-200">
              <span className="text-xl">📷</span>
              <span className="text-sm font-medium">Foto e Video</span>
              <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={onFilesSelected} />
            </label>
            <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer text-gray-700 dark:text-gray-200">
              <span className="text-xl">📄</span>
              <span className="text-sm font-medium">Documento</span>
              <input type="file" multiple className="hidden" onChange={onFilesSelected} />
            </label>
          </div>
        </div>

        <div className="flex-1 relative bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center px-3 py-1 border border-transparent focus-within:border-green-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Scrivi un messaggio..."
            className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-500"
            rows={1}
            style={{ minHeight: '44px' }}
            onFocus={() => {
              window.setTimeout(() => scrollToBottom(false), 50)
            }}
            onKeyDown={(e) => {
              if (mentionOpen) {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  closeMention()
                  return
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setMentionIndex((i) => Math.min(i + 1, Math.max(0, mentionCandidates.length - 1)))
                  return
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setMentionIndex((i) => Math.max(0, i - 1))
                  return
                }
                if (e.key === 'Enter' && mentionCandidates.length > 0) {
                  e.preventDefault()
                  applyMention(mentionCandidates[Math.min(mentionIndex, mentionCandidates.length - 1)])
                  return
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            onKeyUp={() => onComputeMentionState(text)}
          />

          {mentionOpen && mentionCandidates.length > 0 && (
            <div className="absolute left-3 right-3 bottom-full mb-2 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
              <div className="px-3 py-2 text-[11px] text-gray-500 border-b bg-gray-50">Tagga un partecipante</div>
              <div className="max-h-44 overflow-y-auto">
                {mentionCandidates.map((m, idx) => (
                  <button
                    key={m.uid}
                    type="button"
                    onMouseDown={(ev) => {
                      ev.preventDefault()
                      applyMention(m)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${idx === mentionIndex ? 'bg-gray-100' : ''}`}
                  >
                    <span className="truncate">{m.name}</span>
                    <span className="text-xs text-gray-400">@</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <EmojiPicker onPick={(emoji) => setTextAppendEmoji(emoji)} />
        </div>

        {text.trim() || files.length > 0 ? (
          <button
            onClick={onSend}
            disabled={sending}
            className="p-3 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
            </svg>
          </button>
        ) : (
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={cancelRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`p-3 rounded-full transition-all shadow-sm ${isRecording ? 'bg-red-500 text-white scale-110 animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {isRecording ? (
              <span className="font-mono text-xs">{formatTime(recordingTime)}</span>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {isRecording && (
        <div className="text-center text-xs text-red-500 mt-1 animate-pulse">Rilascia per inviare, esci per annullare</div>
      )}
    </div>
  )
}

// Components
const Menu: React.FC<{ message: ChatMessage; onReply: () => void; onCopy: () => void; onDelete: () => void; canEdit: boolean }>
  = ({ onReply, onCopy, onDelete, canEdit }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        className="w-6 h-6 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-sm"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
      >
        ⌄
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 bg-white border border-gray-100 rounded-lg shadow-xl text-sm min-w-[160px] z-30 overflow-hidden py-1">
            <button className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2" onClick={() => { onReply(); setOpen(false) }}>
              <span>↩️</span> Rispondi
            </button>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2" onClick={() => { onCopy(); setOpen(false) }}>
              <span>📋</span> Copia
            </button>
            {canEdit && (
              <button className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2" onClick={() => { onDelete(); setOpen(false) }}>
                <span>🗑️</span> Elimina
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const EmojiPicker: React.FC<{ onPick: (emoji: string) => void }> = ({ onPick }) => {
  const [open, setOpen] = useState(false)
  const common = ['😀','😂','🤣','😍','🥰','😎','👍','👎','🙏','🎉','🔥','❤️','💔','💩','👻','💀']
  return (
    <div className="relative">
      <button
        type="button"
        className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        😊
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-10 bg-white border border-gray-200 rounded-xl shadow-xl p-3 grid grid-cols-4 gap-2 text-2xl z-30 w-64">
            {common.map(c => (
              <button key={c} className="hover:bg-gray-100 rounded p-1 transition-colors" onClick={() => { onPick(c); setOpen(false) }}>{c}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
