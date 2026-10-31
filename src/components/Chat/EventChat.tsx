import React, { useEffect, useMemo, useRef, useState } from 'react'
import { chatService, eventService } from '../../services/firestore'
import { ChatMessage, EventParticipant, EventParticipation } from '../../types'
import { ChatDescriptor, eventDescriptor } from '../../types/chat'
import { useAuthStore } from '../../stores/useAuthStore'
import { useUserSettingsStore } from '../../stores/UserSettingsStore'
import MessageBubble from './MessageBubble'
import ThreadPanel from './ThreadPanel'

interface Props {
  eventId?: string
  /** When provided, overrides eventId-derived paths for messages/presence/storage. */
  chatDescriptor?: ChatDescriptor
  /**
   * Pre-loaded member list for @mentions in channel mode.
   * In event mode this is populated automatically from eventService.getById().
   */
  chatPeople?: Array<{ uid: string; name: string }>
  /** Called instead of markEventChatRead when in channel/non-event mode. */
  onMarkRead?: () => Promise<void>
  eventName?: string
  onBack?: () => void
  className?: string
  canWrite?: boolean
}

const canEditOrDelete = (msg: ChatMessage, meId: string) => {
  if (msg.userId !== meId) return false
  const created = msg.createdAt?.getTime?.() || 0
  return Date.now() - created < 15 * 60 * 1000 // 15 minutes window
}

// Module-level message cache: keeps the last known messages for each event.
// If EventChat ever remounts (e.g. due to a store refresh in the parent), the
// cached messages are shown immediately instead of flashing an empty list.
const _chatMsgCache = new Map<string, ChatMessage[]>()

const EventChat: React.FC<Props> = ({ eventId: eventIdProp, chatDescriptor: descriptorProp, chatPeople, onMarkRead, eventName, onBack, className, canWrite: canWriteProp }) => {
  // Resolve a descriptor — either passed directly (channel mode) or derived from eventId (event mode).
  const descriptor: ChatDescriptor = descriptorProp ?? eventDescriptor(eventIdProp ?? '')
  // Stable cache/listen key is the messages collection path.
  const chatKey = descriptor.messagesPath
  // For backward-compat code that still references eventId (muted list, event participant load, etc.)
  const eventId = eventIdProp ?? ''
  const { user } = useAuthStore()
  const me = { id: user?.id || user?.email || '', name: user?.displayName || user?.email || 'Tu', photoURL: user?.photoURL }

  const meKeys = useMemo(() => {
    const keys = [user?.id, user?.email].filter((v): v is string => typeof v === 'string' && v.length > 0)
    return Array.from(new Set(keys))
  }, [user?.id, user?.email])

  const [messages, setMessages] = useState<ChatMessage[]>(() => _chatMsgCache.get(chatKey) ?? [])
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
  const [openThread, setOpenThread] = useState<ChatMessage | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const [showNewIndicator, setShowNewIndicator] = useState(false)
  const [newMsgCount, setNewMsgCount] = useState(0)
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
    const unsub = chatService.listenPath(
      descriptor.messagesPath,
      msgs => {
        _chatMsgCache.set(chatKey, msgs)
        setChatError(null)
        setMessages(msgs)
      },
      () => {
        setChatError('Impossibile caricare la chat (permessi o rete).')
      }
    )
    return () => unsub()
  }, [chatKey, descriptor.messagesPath])

  useEffect(() => {
    const unsubP = chatService.listenParticipantsAt(descriptor.presenceBasePath, list => setParticipants(list))
    const unsubT = chatService.listenTypingAt(descriptor.presenceBasePath, list => setTypingUsers(list))
    return () => { unsubP(); unsubT() }
  }, [descriptor.presenceBasePath])

  // Load event participants for @mentions — skipped in channel mode (chatPeople prop used instead)
  useEffect(() => {
    if (descriptor.context === 'channel') {
      if (chatPeople) setEventPeople(chatPeople)
      return
    }
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
  }, [eventId, descriptor.context, chatPeople])

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

  // Once canWrite has been true for this session, lock it so that a transient
  // false (e.g. a store refresh causes a brief re-render before data stabilises)
  // never unmounts the ChatComposer mid-conversation.
  const canWriteLocked = useRef(false)
  useEffect(() => {
    if (canWrite) canWriteLocked.current = true
  }, [canWrite])
  const stableCanWrite = canWrite || canWriteLocked.current

  // Scroll handling
  // scrollContainerRef points to the overflow-y-auto div inside ChatThread.
  // Using a direct ref (instead of bottomRef.current?.parentElement) avoids
  // any ambiguity and lets us call scrollTop = scrollHeight reliably.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = (smooth = true) => {
    const el = scrollContainerRef.current
    if (!el) return
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      el.scrollTop = el.scrollHeight
    }
  }

  useEffect(() => {
    // Auto-scroll logic
    const el = scrollContainerRef.current
    if (!el) return
    
    const lastMsg = messages[messages.length - 1]
    const isMine = lastMsg?.userId === me.id
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150

    if (isMine || nearBottom) {
      scrollToBottom()
      setShowNewIndicator(false)
      setNewMsgCount(0)
    } else if (messages.length > 0) {
      setShowNewIndicator(true)
      setNewMsgCount(prev => prev + 1)
    }
  }, [messages.length, me.id])

  const doMarkRead = React.useCallback(() => {
    if (onMarkRead) {
      onMarkRead().catch(() => {})
    } else if (eventId) {
      markEventChatRead(eventId).catch(() => {})
    }
    if (me.id) chatService.markReadAt(descriptor.presenceBasePath, me.id, { displayName: me.name, photoURL: me.photoURL }).catch(() => {})
  }, [onMarkRead, eventId, markEventChatRead, me.id, me.name, me.photoURL, descriptor.presenceBasePath])

  useEffect(() => {
    // Mark as read when opening
    doMarkRead()
  }, [doMarkRead])

  // Adjust scroll when the mobile keyboard opens/closes (visualViewport shrinks/grows).
  // Only auto-scroll to bottom when the user was already near the bottom —
  // avoids jumping away from a position the user deliberately scrolled to.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      const el = scrollContainerRef.current
      if (!el) return
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200
        if (nearBottom) scrollToBottom(false)
      }))
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])


  const othersTyping = useMemo(() => {
    const now = Date.now()
    return typingUsers.filter(t => t.uid !== me.id && t.typing && now - t.updatedAt.getTime() < 5000)
  }, [typingUsers, me.id])

  const sendVoiceMessage = async (audioFile: File) => {
    if (!me.id) return
    try {
      setSending(true)
      setUploadProgress({})
      await chatService.sendMessageTo(
        descriptor,
        { files: [audioFile] },
        { id: me.id, displayName: me.name, photoURL: me.photoURL },
        (fileName, pct) => setUploadProgress(prev => ({ ...prev, [fileName]: pct }))
      )
      scrollToBottom()
    } catch (e) {
      console.error('Failed to send voice message', e)
      setChatError('Errore invio messaggio vocale')
      setTimeout(() => setChatError(null), 3000)
    } finally {
      setSending(false)
      setUploadProgress({})
    }
  }

  const sendLocation = async () => {
    if (!me.id) return
    if (!navigator.geolocation) {
      setChatError('Geolocalizzazione non supportata da questo browser')
      setTimeout(() => setChatError(null), 3000)
      return
    }
    setSending(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true })
      )
      const { latitude, longitude } = pos.coords
      const url = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`
      await chatService.sendMessageTo(
        descriptor,
        { text: `📍 La mia posizione: ${url}` },
        { id: me.id, displayName: me.name, photoURL: me.photoURL }
      )
      scrollToBottom()
      doMarkRead()
    } catch (e: any) {
      const code = (e as GeolocationPositionError)?.code
      const msg = code === 1
        ? 'Posizione negata. Consenti l\u2019accesso alla posizione nelle impostazioni.'
        : code === 2 ? 'Posizione non disponibile.'
        : 'Impossibile ottenere la posizione.'
      setChatError(msg)
      setTimeout(() => setChatError(null), 4000)
    } finally {
      setSending(false)
    }
  }

  const onSend = async () => {
    if (!me.id) { setChatError('Devi essere autenticato'); return }
    const draftText = text
    const draftFiles = files
    const draftQuoted = quoted
    const draftMentions = selectedMentions
    if (!draftText.trim() && draftFiles.length === 0) return

    const quotedPayload = draftQuoted
      ? { messageId: draftQuoted.id, textPreview: draftQuoted.text, mediaThumbUrl: draftQuoted.attachments?.[0]?.url }
      : undefined
    const mentions = draftMentions
      .filter(m => draftText.includes(`@${m.name}`))
      .map(m => m.uid)

    try {
      setSending(true)
      // Clear immediately so the composer does not keep stale text on slow networks.
      setText('')
      setFiles([])
      setQuoted(null)
      setSelectedMentions([])
      setMentionOpen(false)
      setMentionQuery('')
      setMentionStart(null)
      setMentionIndex(0)
      setUploadProgress({})
      await chatService.sendMessageTo(
        descriptor,
        { text: draftText.trim() || undefined, files: draftFiles.length ? draftFiles : undefined, quoted: quotedPayload, mentions: mentions.length ? mentions : undefined },
        { id: me.id, displayName: me.name, photoURL: me.photoURL },
        (fileName, pct) => setUploadProgress(prev => ({ ...prev, [fileName]: pct }))
      )
      doMarkRead()
      scrollToBottom()
    } catch (e) {
      console.error('Send message failed', e)
      // Restore draft on failure to avoid data loss.
      setText(draftText)
      setFiles(draftFiles)
      setQuoted(draftQuoted)
      setSelectedMentions(draftMentions)
      setChatError('Errore nell\'invio del messaggio')
      setTimeout(() => setChatError(null), 3000)
    } finally {
      setSending(false)
      // Keep keyboard open (Telegram/WhatsApp behaviour)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { textareaRef.current?.focus() })
      })
    }
  }

  // Audio Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      // Pick best supported format
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || ''
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      isRecordingCancelled.current = false

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
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

        const chunks = audioChunksRef.current
        if (chunks.length === 0) return

        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm'
        const fileMime = mimeType || 'audio/webm'
        const audioBlob = new Blob(chunks, { type: fileMime })
        if (audioBlob.size < 500) return // too short/empty

        const audioFile = new File([audioBlob], `voice-${Date.now()}.${ext}`, { type: fileMime })
        await sendVoiceMessage(audioFile)
        audioChunksRef.current = []
      }

      // Request data every 250ms for better chunk reliability
      mediaRecorder.start(250)
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Error accessing microphone:', err)
      setChatError('Impossibile accedere al microfono')
      setTimeout(() => setChatError(null), 3000)
    }
  }

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    setIsRecording(false)
    setRecordingTime(0)
    // state_changed listener will fire onstop — let it handle sending
    try { mediaRecorderRef.current.stop() } catch {}
  }

  const cancelRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return
    isRecordingCancelled.current = true
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    setIsRecording(false)
    setRecordingTime(0)
    try { mediaRecorderRef.current.stop() } catch {}
    audioChunksRef.current = []
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const toggleReaction = async (m: ChatMessage, emoji: string) => {
    if (!me.id) return
    const arr = (m.reactions || {})[emoji] || []
    const has = arr.includes(me.id)
    try {
      await chatService.toggleReactionAt(descriptor.messagesPath, m.id, emoji, me.id, has)
    } catch (e) {
      console.error('toggleReaction failed', e)
    }
  }

  const onFilesSelected = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const sel = Array.from(ev.target.files || [])
    // max 10 files, 20MB each
    const limited = sel.slice(0, 10).filter(f => f.size <= 20 * 1024 * 1024)
    const rejected = sel.filter(f => f.size > 20 * 1024 * 1024)
    if (rejected.length > 0) {
      setChatError(`${rejected.length} file troppo grandi (max 20 MB)`)
      setTimeout(() => setChatError(null), 3000)
    }
    setFiles(prev => [...prev, ...limited].slice(0, 10))
    // Reset input so same file can be re-selected
    ev.target.value = ''
  }

  const onDelete = async (m: ChatMessage) => {
    if (!confirm('Eliminare questo messaggio?')) return
    try { await chatService.deleteMessageAt(descriptor.messagesPath, m.id) } catch (e) { console.error(e) }
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
    chatService.setTypingAt(descriptor.presenceBasePath, me.id, true).catch(() => {})
    if (typingDebounce.current) window.clearTimeout(typingDebounce.current)
    typingDebounce.current = window.setTimeout(() => {
      chatService.setTypingAt(descriptor.presenceBasePath, me.id, false).catch(() => {})
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
    <div id="chat" className={`flex flex-col min-h-0 bg-[#e5ddd5] dark:bg-gray-900 rounded-xl overflow-hidden border border-[--border-base] dark:border-gray-700 shadow-sm relative ${className || 'h-[calc(100vh-140px)]'}`}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[--bg-card] dark:bg-gray-800 border-b border-[--border-base] dark:border-gray-700 px-4 py-3 flex items-center gap-3 shadow-sm">
        {onBack && (
          <button onClick={onBack} className="p-1 -ml-1 rounded-full hover:bg-[--bg-raised] dark:hover:bg-gray-700 text-[--text-muted] dark:text-gray-300">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate text-[--text-base] dark:text-white">{eventName || 'Chat Evento'}</h2>
          <div className="text-xs text-[--text-muted] truncate">
            {othersTyping.length > 0
              ? <span className="text-green-600 font-medium">sta scrivendo...</span>
              : `${participants.length} partecipanti`
            }
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toggleEventMute(eventId)} className="p-2 rounded-full hover:bg-[--bg-raised] dark:hover:bg-gray-700 text-[--text-muted] dark:text-gray-300">
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
        onOpenThread={setOpenThread}
        onDelete={onDelete}
        onToggleReaction={toggleReaction}
        canEditOrDelete={(m) => canEditOrDelete(m, me.id)}
        renderTicks={renderTicks}
        scrollToBottom={scrollToBottom}
        bottomRef={bottomRef}
        scrollContainerRef={scrollContainerRef}
        onAtBottom={() => {
          if (me.id) chatService.markReadAt(descriptor.presenceBasePath, me.id, { displayName: me.name, photoURL: me.photoURL }).catch(()=>{})
          setShowNewIndicator(false)
          setNewMsgCount(0)
        }}
        newMsgCount={newMsgCount}
        people={eventPeople}
      />

      {openThread && (
        <ThreadPanel
          descriptor={descriptor}
          message={openThread}
          onClose={() => setOpenThread(null)}
        />
      )}

      {stableCanWrite && (
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
          onSendLocation={sendLocation}
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
  onOpenThread: (m: ChatMessage) => void
  onDelete: (m: ChatMessage) => void
  onToggleReaction: (m: ChatMessage, emoji: string) => void
  canEditOrDelete: (m: ChatMessage) => boolean
  renderTicks: (m: ChatMessage) => React.ReactNode
  scrollToBottom: (smooth?: boolean) => void
  bottomRef: React.RefObject<HTMLDivElement>
  scrollContainerRef: React.RefObject<HTMLDivElement>
  onAtBottom: () => void
  newMsgCount: number
  people: Array<{ uid: string; name: string }>
}) {
  const {
    me,
    messages,
    chatError,
    showNewIndicator,
    onReply,
    onOpenThread,
    onDelete,
    onToggleReaction,
    canEditOrDelete,
    renderTicks,
    scrollToBottom,
    bottomRef,
    scrollContainerRef,
    onAtBottom,
    newMsgCount,
    people,
  } = props

  return (
    <>
      <div
        ref={scrollContainerRef}
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
          <div className="flex flex-col items-center justify-center h-full text-[--text-muted] gap-2">
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
                  <span className="bg-[--bg-raised]/80 backdrop-blur-sm text-[--text-muted] text-[11px] font-medium px-3 py-1 rounded-full shadow-sm">
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
                  <div className="bg-[--bg-raised]/80 text-[--text-muted] text-xs px-3 py-1 rounded-lg flex items-center gap-2 border border-[--border-base]">
                    <span className="font-semibold">{m.userName === 'System' ? 'Sistema' : m.userName}</span>
                    <span>{m.text}</span>
                  </div>
                </div>
              )
              continue
            }

            els.push(
              <MessageBubble
                key={m.id}
                m={m}
                mine={mine}
                grouped={grouped}
                meId={me.id}
                onReply={onReply}
                onOpenThread={onOpenThread}
                onDelete={onDelete}
                onToggleReaction={onToggleReaction}
                canEditOrDelete={canEditOrDelete}
                renderTicks={renderTicks}
                people={people}
              />
            )
          }
          return els
        })()}
        <div ref={bottomRef} />
      </div>

      {/* New Message Indicator */}
      {showNewIndicator && (
        <div className="absolute bottom-20 right-4 z-20">
          <button
            onClick={() => { scrollToBottom(); onAtBottom() }}
            className="bg-primary-600 text-white pl-2.5 pr-3 py-2 rounded-full shadow-lg flex items-center gap-1.5 text-xs font-semibold"
          >
            {newMsgCount > 0 && (
              <span className="bg-white text-primary-600 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold leading-none shrink-0">
                {Math.min(newMsgCount, 99)}
              </span>
            )}
            <span>nuovi ↓</span>
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
  onSendLocation: () => void
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
    onSendLocation,
  } = props

  // Click-based attachment menu (hover doesn't work on mobile)
  const [plusOpen, setPlusOpen] = useState(false)

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [text, textareaRef])

  return (
    <div className="bg-[--bg-card] border-t pb-[max(0.25rem,env(safe-area-inset-bottom))]">
      {/* ─── RECORDING MODE overlay ──────────────────────────────── */}
      {isRecording && (
        <div className="flex items-center gap-2 px-3 py-3">
          {/* Cancel */}
          <button
            type="button"
            onClick={cancelRecording}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[--bg-raised] text-[--text-muted] rounded-2xl text-sm font-semibold hover:bg-[--bg-raised] transition-colors shrink-0"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            Annulla
          </button>

          {/* Recording indicator */}
          <div className="flex-1 flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-3 py-2 overflow-hidden">
            <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono font-bold text-red-600 text-sm shrink-0">{formatTime(recordingTime)}</span>
            {/* Animated waveform bars */}
            <div className="flex items-end gap-[3px] h-5 overflow-hidden" aria-hidden>
              {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.45, 0.75, 0.6].map((h, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-red-400"
                  style={{
                    height: '100%',
                    transform: `scaleY(${h})`,
                    transformOrigin: 'bottom',
                    animation: `wavePulse 0.8s ease-in-out ${(i * 0.08).toFixed(2)}s infinite alternate`,
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-red-400 ml-auto shrink-0">🎤 Registrazione in corso</span>
          </div>

          {/* Send */}
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 text-white rounded-2xl text-sm font-semibold hover:bg-primary-700 transition-colors shrink-0 shadow-sm"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            Invia
          </button>
        </div>
      )}

      {/* ─── NORMAL COMPOSER (hidden while recording) ───────────── */}
      <div className={isRecording ? 'hidden' : 'p-2'}>
      {/* Quoted Message Preview */}
      {quoted && (
        <div className="flex items-center justify-between bg-[--bg-subtle] p-2 rounded-lg mb-2 border-l-4 border-primary-500">
          <div className="overflow-hidden">
            <div className="text-xs font-bold text-primary-600">Risposta a {quoted.userName}</div>
            <div className="text-sm truncate text-[--text-muted]">{quoted.text || 'Allegato'}</div>
          </div>
          <button onClick={onClearQuoted} className="p-1 hover:bg-[--bg-raised] rounded-full">✕</button>
        </div>
      )}

      {/* File Preview */}
      {files.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1 pt-1">
          {files.map((f, i) => (
            <FilePreviewThumb key={i} file={f} onRemove={() => onRemoveFile(i)} />
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="mb-2 space-y-1">
          {Object.entries(uploadProgress).map(([name, pct]) => (
            <div key={name} className="h-1 w-full bg-[--bg-raised] rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Attachment buttons */}
        <div className="flex items-center gap-1">
          {/* Quick camera/gallery picker */}
          <label className="cursor-pointer p-2 text-[--text-muted] hover:bg-[--bg-raised] dark:hover:bg-gray-700 rounded-full transition-colors" title="Foto / Video">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <input type="file" multiple accept="image/*,video/*" capture="environment" className="hidden" onChange={onFilesSelected} />
          </label>

          {/* Plus menu for other files */}
          <div className="relative">
            {plusOpen && (
              <div className="fixed inset-0 z-20" onClick={() => setPlusOpen(false)} />
            )}
            <button
              type="button"
              className="p-2 text-[--text-muted] hover:bg-[--bg-raised] dark:hover:bg-gray-700 rounded-full transition-colors"
              onClick={() => setPlusOpen(o => !o)}
              title="Allega file"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            {plusOpen && (
              <div className="absolute bottom-full left-0 mb-2 bg-[--bg-card] dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 min-w-[180px] z-30">
                <label className="flex items-center gap-3 px-3 py-2 hover:bg-[--bg-subtle] dark:hover:bg-gray-700 rounded-lg cursor-pointer text-[--text-muted] dark:text-gray-200">
                  <span className="text-xl">🖼️</span>
                  <span className="text-sm font-medium">Dalla galleria</span>
                  <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => { onFilesSelected(e); setPlusOpen(false) }} />
                </label>
                <label className="flex items-center gap-3 px-3 py-2 hover:bg-[--bg-subtle] dark:hover:bg-gray-700 rounded-lg cursor-pointer text-[--text-muted] dark:text-gray-200">
                  <span className="text-xl">📄</span>
                  <span className="text-sm font-medium">Documento</span>
                  <input type="file" multiple className="hidden" onChange={(e) => { onFilesSelected(e); setPlusOpen(false) }} />
                </label>
                <button
                  type="button"
                  className="flex items-center gap-3 px-3 py-2 hover:bg-[--bg-subtle] dark:hover:bg-gray-700 rounded-lg w-full text-left text-[--text-muted] dark:text-gray-200"
                  onClick={() => { onSendLocation(); setPlusOpen(false) }}
                >
                  <span className="text-xl">📍</span>
                  <span className="text-sm font-medium">Posizione</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative bg-[--bg-raised] dark:bg-gray-800 rounded-2xl flex items-center px-3 py-1 border border-transparent focus-within:border-green-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Scrivi un messaggio..."
            className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 py-3 text-sm text-[--text-base] dark:text-white placeholder-gray-500"
            rows={1}
            style={{ minHeight: '44px' }}
            onFocus={() => {
              // Scroll to bottom when the keyboard opens.
              // Wait for the actual visualViewport resize (keyboard fully open) instead of
              // a hardcoded timeout — this is the correct signal on both iOS and Android.
              const vv = window.visualViewport
              if (vv) {
                let handled = false
                const onVVResize = () => {
                  handled = true
                  vv.removeEventListener('resize', onVVResize)
                  requestAnimationFrame(() => scrollToBottom(false))
                }
                vv.addEventListener('resize', onVVResize)
                // Fallback: keyboard already open, or resize doesn't fire (desktop)
                window.setTimeout(() => {
                  if (!handled) {
                    vv.removeEventListener('resize', onVVResize)
                    scrollToBottom(false)
                  }
                }, 500)
              } else {
                window.setTimeout(() => scrollToBottom(false), 300)
              }
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
            <div className="absolute left-3 right-3 bottom-full mb-2 bg-[--bg-card] border border-[--border-base] rounded-xl shadow-xl z-30 overflow-hidden">
              <div className="px-3 py-2 text-[11px] text-[--text-muted] border-b bg-[--bg-subtle]">Tagga un partecipante</div>
              <div className="max-h-44 overflow-y-auto">
                {mentionCandidates.map((m, idx) => (
                  <button
                    key={m.uid}
                    type="button"
                    onMouseDown={(ev) => {
                      ev.preventDefault()
                      applyMention(m)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-[--bg-subtle] flex items-center justify-between ${idx === mentionIndex ? 'bg-[--bg-raised]' : ''}`}
                  >
                    <span className="truncate">{m.name}</span>
                    <span className="text-xs text-[--text-muted]">@</span>
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
            type="button"
            onClick={startRecording}
            className="p-3 rounded-full bg-[--bg-raised] text-[--text-muted] hover:bg-[--bg-raised] active:bg-red-100 active:text-red-600 transition-colors shadow-sm"
            title="Registra messaggio vocale"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
        )}
      </div>
      </div>{/* end NORMAL COMPOSER */}
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
        className="p-2 text-[--text-muted] hover:text-[--text-muted] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        😊
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-10 bg-[--bg-card] border border-[--border-base] rounded-xl shadow-xl p-3 grid grid-cols-4 gap-2 text-2xl z-30 w-64">
            {common.map(c => (
              <button key={c} className="hover:bg-[--bg-raised] rounded p-1 transition-colors" onClick={() => { onPick(c); setOpen(false) }}>{c}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── FilePreviewThumb ─────────────────────────────────────────────────────────
// Shows a thumbnail preview of a file before sending (in the composer).
const FilePreviewThumb: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file])

  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  const isAudio = file.type.startsWith('audio/')

  return (
    <div className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-[--border-base] bg-[--bg-raised] dark:bg-gray-800 dark:border-gray-700">
      {previewUrl && isImage && (
        <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
      )}
      {previewUrl && isVideo && (
        <>
          <video src={previewUrl} className="w-full h-full object-cover" muted preload="metadata" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </>
      )}
      {isAudio && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-primary-600">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
          <span className="text-[10px] text-center px-1 truncate w-full">{(file.size / 1024).toFixed(0)}KB</span>
        </div>
      )}
      {!previewUrl && !isAudio && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-[--text-muted]">
          <span className="text-2xl">📄</span>
          <span className="text-[10px] px-1 truncate w-full text-center">{file.name.slice(-10)}</span>
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none hover:bg-black/80"
      >
        ×
      </button>
    </div>
  )
}
