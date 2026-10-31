/**
 * ThreadPanel — slide-in panel that shows a parent message + its replies.
 *
 * Desktop: fixed right panel (w-96, full height).
 * Mobile:  bottom sheet (85vh, rounded top corners).
 */
import React, { useEffect, useRef, useState } from 'react'
import { chatService } from '../../services/firestore'
import { ChatDescriptor } from '../../types/chat'
import { ChatMessage, ChatReactionKey } from '../../types'
import { useAuthStore } from '../../stores/useAuthStore'
import MessageBubble from './MessageBubble'

interface Props {
  descriptor: ChatDescriptor
  message: ChatMessage
  onClose: () => void
}

const canEditReply = (msg: ChatMessage, meId: string) => {
  if (msg.userId !== meId) return false
  const created = msg.createdAt?.getTime?.() || 0
  return Date.now() - created < 15 * 60 * 1000
}

const ThreadPanel: React.FC<Props> = ({ descriptor, message, onClose }) => {
  const { user } = useAuthStore()
  const me = {
    id: user?.id || user?.email || '',
    name: user?.displayName || user?.email || 'Tu',
    photoURL: user?.photoURL,
  }

  // On mobile, dynamically size the sheet to the visible viewport so the
  // keyboard doesn't push content off-screen (avoids fixed `85vh` issues).
  const [mobileHeight, setMobileHeight] = useState<number | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    const mql = window.matchMedia('(max-width: 639px)')
    if (!vv || !mql.matches) return
    const update = () => setMobileHeight(Math.round(vv.height * 0.88))
    update()
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])

  const [replies, setReplies] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const unsub = chatService.listenReplies(descriptor.messagesPath, message.id, setReplies)
    return unsub
  }, [descriptor.messagesPath, message.id])

  // Auto-scroll to bottom when new replies arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [replies.length])

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [text])

  const onSend = async () => {
    if (!me.id || !text.trim()) return
    try {
      setSending(true)
      await chatService.sendReply(
        descriptor,
        message.id,
        { text: text.trim() },
        { id: me.id, displayName: me.name, photoURL: me.photoURL },
      )
      setText('')
      requestAnimationFrame(() => textareaRef.current?.focus())
    } catch (e) {
      console.error('sendReply failed', e)
      setError("Errore nell'invio della risposta")
      setTimeout(() => setError(null), 3000)
    } finally {
      setSending(false)
    }
  }

  const repliesPath = `${descriptor.messagesPath}/${message.id}/replies`

  const toggleReplyReaction = async (m: ChatMessage, key: ChatReactionKey) => {
    if (!me.id) return
    const arr = m.reactions?.[key] || []
    const has = arr.includes(me.id)
    try {
      await chatService.toggleReactionAt(repliesPath, m.id, key, me.id, has)
    } catch (e) {
      console.error('toggleReaction failed', e)
    }
  }

  const onDeleteReply = async (m: ChatMessage) => {
    if (!confirm('Eliminare questa risposta?')) return
    try {
      await chatService.deleteMessageAt(repliesPath, m.id)
    } catch (e) {
      console.error('deleteReply failed', e)
    }
  }

  return (
    <>
      {/* Backdrop — tapping closes the panel on mobile */}
      <div
        className="fixed inset-0 !mt-0 bg-black/40 z-40 sm:hidden"
        onClick={onClose}
      />

      {/* Panel body */}
      <div
        className="fixed z-50 bg-[--bg-card] dark:bg-gray-800 flex flex-col shadow-2xl
          bottom-0 left-0 right-0 rounded-t-2xl
          sm:bottom-auto sm:top-0 sm:right-0 sm:left-auto sm:h-full sm:w-96 sm:rounded-none sm:border-l sm:border-[--border-base]"
        style={mobileHeight !== null ? { height: `${mobileHeight}px` } : { height: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[--border-base] flex-shrink-0">
          <button
            onClick={onClose}
            className="text-[--text-muted] hover:text-[--text-base] p-1 rounded-full hover:bg-[--bg-raised] transition-colors"
            aria-label="Chiudi thread"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="font-semibold text-[--text-base]">Thread</span>
          <span className="ml-auto text-xs text-[--text-muted]">
            {replies.length} {replies.length === 1 ? 'risposta' : 'risposte'}
          </span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Parent message — pinned at top */}
          <div className="px-2 py-3 border-b border-[--border-base] bg-[--bg-subtle] dark:bg-gray-900/50">
            <MessageBubble
              m={message}
              mine={message.userId === me.id}
              grouped={false}
              meId={me.id}
              isThreadView={true}
            />
          </div>

          {/* Replies */}
          <div className="p-2 space-y-1">
            {replies.length === 0 && (
              <div className="text-center py-10 text-[--text-muted] text-sm">
                Nessuna risposta ancora. Sii il primo!
              </div>
            )}

            {replies.map((r, i) => (
              <MessageBubble
                key={r.id}
                m={r}
                mine={r.userId === me.id}
                grouped={i > 0 && replies[i - 1].userId === r.userId}
                meId={me.id}
                onDelete={onDeleteReply}
                onToggleReaction={toggleReplyReaction}
                canEditOrDelete={(m) => canEditReply(m, me.id)}
                isThreadView={true}
              />
            ))}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-4 py-1 flex-shrink-0">
            <span className="text-xs text-red-600">{error}</span>
          </div>
        )}

        {/* Composer */}
        <div className="flex-shrink-0 border-t border-[--border-base] p-3 flex items-end gap-2 bg-[--bg-card] dark:bg-gray-800 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            placeholder="Rispondi nel thread..."
            className="flex-1 bg-[--bg-raised] dark:bg-gray-700 rounded-2xl px-3 py-2 text-sm text-[--text-base] dark:text-white resize-none border border-transparent focus:border-green-500 focus:outline-none transition-colors min-h-[40px] max-h-32"
            rows={1}
          />
          <button
            onClick={onSend}
            disabled={sending || !text.trim()}
            className="w-9 h-9 rounded-full bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
            aria-label="Invia risposta"
          >
            {sending ? (
              <svg className="animate-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

export default ThreadPanel
