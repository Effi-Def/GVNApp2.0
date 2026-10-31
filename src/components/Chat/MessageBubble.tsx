/**
 * MessageBubble — reusable chat message bubble.
 *
 * Mobile UX:
 *   • Long press (500 ms) → context menu bottom sheet
 *   • Swipe left → reply, swipe right → 👍 reaction
 *
 * Reaction system:
 *   • Any emoji character as key (legacy 'like'/'love'/'fun' resolved via resolveEmoji)
 *   • ReactionPill: count animation, reactor tooltip, click to toggle
 *   • "+" button (hover desktop / context menu mobile) opens EmojiPicker
 *   • Max 6 pills visible; overflow shown as "+N altri"
 */
import React, { useEffect, useRef, useState } from 'react'
import { ChatMessage } from '../../types'
import ReactionPill from './ReactionPill'
import EmojiPicker from './EmojiPicker'

// ── Linkify ──────────────────────────────────────────────────────────────────
export function linkifyText(text: string): React.ReactNode {
  const urlRegex = /https?:\/\/[^\s]+/g
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const url = match[0]
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="underline text-blue-600 dark:text-blue-400 break-all"
      >
        {url}
      </a>
    )
    last = match.index + url.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 1 ? parts : text
}

// ── VoicePlayer ──────────────────────────────────────────────────────────────
export const VoicePlayer: React.FC<{ url: string; name: string; mine: boolean }> = ({ url, mine }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause() } else { a.play().catch(() => {}) }
  }

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 min-w-[200px] max-w-[280px] ${mine ? 'bg-green-200/60 dark:bg-green-800/40' : 'bg-[--bg-raised] dark:bg-gray-700'}`}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0) }}
        className="hidden"
      />
      <button
        onClick={toggle}
        className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${mine ? 'bg-green-600 hover:bg-green-700' : 'bg-primary-600 hover:bg-primary-700'} text-white`}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="relative h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-current rounded-full transition-all" style={{ width: `${pct}%`, opacity: 0.6 }} />
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={currentTime}
            onChange={(e) => {
              const val = Number(e.target.value)
              setCurrentTime(val)
              if (audioRef.current) audioRef.current.currentTime = val
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
          />
        </div>
        <div className="flex justify-between text-[11px] opacity-60 font-mono">
          <span>{fmt(playing ? currentTime : duration)}</span>
          <span>🎤</span>
        </div>
      </div>
    </div>
  )
}

// ── Desktop hover menu (dropdown) ─────────────────────────────────────────────
const BubbleMenu: React.FC<{
  message: ChatMessage
  onReply: () => void
  onOpenThread?: () => void
  onCopy: () => void
  onDelete: () => void
  onOpenPicker: () => void
  canEdit: boolean
}> = ({ onReply, onOpenThread, onCopy, onDelete, onOpenPicker, canEdit }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        className="w-7 h-7 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-sm"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
        aria-label="Opzioni messaggio"
      >
        ⌄
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 bg-[--bg-card] border border-gray-100 rounded-lg shadow-xl text-sm min-w-[180px] z-30 overflow-hidden py-1">
            <button className="w-full text-left px-4 py-2.5 hover:bg-[--bg-subtle] flex items-center gap-2"
              onClick={() => { onOpenPicker(); setOpen(false) }}>
              😊 Reagisci
            </button>
            <button className="w-full text-left px-4 py-2.5 hover:bg-[--bg-subtle] flex items-center gap-2"
              onClick={() => { onReply(); setOpen(false) }}>
              ↩️ Rispondi
            </button>
            {onOpenThread && (
              <button className="w-full text-left px-4 py-2.5 hover:bg-[--bg-subtle] flex items-center gap-2"
                onClick={() => { onOpenThread(); setOpen(false) }}>
                💬 Apri thread
              </button>
            )}
            <button className="w-full text-left px-4 py-2.5 hover:bg-[--bg-subtle] flex items-center gap-2"
              onClick={() => { onCopy(); setOpen(false) }}>
              📋 Copia
            </button>
            {canEdit && (
              <button className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-600 flex items-center gap-2"
                onClick={() => { onDelete(); setOpen(false) }}>
                🗑️ Elimina
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────
export interface MessageBubbleProps {
  m: ChatMessage
  mine: boolean
  grouped: boolean
  meId: string
  /** Used to display reactor names in reaction tooltips. */
  people?: Array<{ uid: string; name: string }>
  onReply?: (m: ChatMessage) => void
  onOpenThread?: (m: ChatMessage) => void
  onDelete?: (m: ChatMessage) => void
  onToggleReaction?: (m: ChatMessage, emoji: string) => void
  canEditOrDelete?: (m: ChatMessage) => boolean
  renderTicks?: (m: ChatMessage) => React.ReactNode
  isThreadView?: boolean
}

// Quick reactions shown in the mobile long-press context menu
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥']
// Max reaction pills to show before "+N altri" overflow
const VISIBLE_LIMIT = 6

const MessageBubble: React.FC<MessageBubbleProps> = ({
  m, mine, grouped, meId,
  people,
  onReply, onOpenThread, onDelete, onToggleReaction,
  canEditOrDelete, renderTicks,
  isThreadView = false,
}) => {
  // ── Name resolution for tooltip ────────────────────────────────────────────
  const nameOf = (uid: string) => {
    if (uid === meId) return 'Tu'
    return people?.find(p => p.uid === uid)?.name ?? uid.slice(0, 8) + '…'
  }

  // ── Reaction data ──────────────────────────────────────────────────────────
  const allReactions = Object.entries(m.reactions || {}).filter(([, uids]) => uids.length > 0)
  const visibleReactions = allReactions.slice(0, VISIBLE_LIMIT)
  const overflowCount = allReactions.length - VISIBLE_LIMIT

  // ── Mobile gesture state ────────────────────────────────────────────────────
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [contextPickerOpen, setContextPickerOpen] = useState(false)
  const [swipeDx, setSwipeDx] = useState(0)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const swipeActiveRef = useRef(false)
  const swipeDxRef = useRef(0)

  // ── Desktop picker state ────────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState<{ bottom: number; left: number } | null>(null)
  const pickerBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    return () => {
      if (longPressRef.current) clearTimeout(longPressRef.current)
    }
  }, [])

  // ── Picker positioning ──────────────────────────────────────────────────────
  const openDesktopPicker = () => {
    const rect = pickerBtnRef.current?.getBoundingClientRect()
    if (!rect) return
    setPickerPos({
      bottom: window.innerHeight - rect.top + 8,
      left: Math.min(rect.left, window.innerWidth - 272),
    })
    setPickerOpen(true)
  }

  // ── Touch handlers ──────────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (m.deleted) return
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
    swipeActiveRef.current = false
    swipeDxRef.current = 0

    longPressRef.current = setTimeout(() => {
      setContextMenuOpen(true)
      if (typeof navigator.vibrate === 'function') navigator.vibrate(15)
      touchStartRef.current = null
    }, 500)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y

    if ((Math.abs(dx) > 8 || Math.abs(dy) > 8) && longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }

    if (Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > 10) {
      swipeActiveRef.current = true
      swipeDxRef.current = dx
      setSwipeDx(dx)
    }
  }

  const handleTouchEnd = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }

    const dx = swipeDxRef.current
    if (swipeActiveRef.current && touchStartRef.current !== null) {
      if (dx < -50 && !m.deleted) onReply?.(m)
      else if (dx > 50 && !m.deleted) onToggleReaction?.(m, '👍')
    }

    swipeActiveRef.current = false
    swipeDxRef.current = 0
    setSwipeDx(0)
    touchStartRef.current = null
  }

  const clampedDx = Math.sign(swipeDx) * Math.min(Math.abs(swipeDx) * 0.4, 30)

  return (
    <div
      id={`msg-${m.id}`}
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Swipe hints */}
      {swipeDx < -10 && !m.deleted && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xl pointer-events-none select-none"
          style={{ opacity: Math.min(Math.abs(swipeDx) / 60, 1) }}>↩️</div>
      )}
      {swipeDx > 10 && !m.deleted && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xl pointer-events-none select-none"
          style={{ opacity: Math.min(swipeDx / 60, 1) }}>👍</div>
      )}

      {/* ── Bubble ──────────────────────────────────────────────────────────── */}
      <div
        className={`flex flex-col ${mine ? 'items-end' : 'items-start'} mb-2 group px-2`}
        style={{
          transform: clampedDx !== 0 ? `translateX(${clampedDx}px)` : undefined,
          transition: swipeDx === 0 ? 'transform 0.2s ease' : 'none',
        }}
      >
        <div
          className={`max-w-[80%] relative shadow-sm px-3 py-2 ${
            mine
              ? 'bg-green-100 dark:bg-green-900/50 text-[--text-base] dark:text-white rounded-3xl rounded-tr-none ml-auto'
              : 'bg-[--bg-card] dark:bg-gray-700 text-[--text-base] dark:text-gray-100 rounded-3xl rounded-tl-none'
          }`}
        >
          {/* Quote */}
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

          {/* Content */}
          <div>
            {!mine && !grouped && (
              <div className="text-xs font-bold text-orange-600 mb-1">{m.userName}</div>
            )}
            {m.deleted ? (
              <div className="italic opacity-60 text-sm flex items-center gap-1">
                🚫 <span>Messaggio eliminato</span>
              </div>
            ) : (
              <>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mb-2 grid gap-2">
                    {m.attachments.map((att) => (
                      <div key={att.id}>
                        {att.type === 'image' ? (
                          <a href={att.url} target="_blank" rel="noreferrer" className="block">
                            <img src={att.url} alt={att.name} className="rounded-xl max-h-64 object-cover w-full cursor-zoom-in" loading="lazy" />
                          </a>
                        ) : att.type === 'video' ? (
                          <div className="rounded-xl overflow-hidden bg-black">
                            <video src={att.url} controls preload="metadata" className="max-h-64 w-full object-contain" playsInline />
                          </div>
                        ) : att.type === 'audio' ? (
                          <VoicePlayer url={att.url} name={att.name} mine={mine} />
                        ) : (
                          <a href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-black/5 dark:bg-white/10 rounded-xl hover:bg-black/10 transition">
                            <span className="text-2xl">📄</span>
                            <div className="overflow-hidden">
                              <div className="text-sm font-medium truncate">{att.name}</div>
                              {att.size && <div className="text-[11px] opacity-60">{(att.size / 1024).toFixed(0)} KB</div>}
                            </div>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {m.text && (
                  <div className="text-[15px] whitespace-pre-wrap break-words leading-relaxed">{linkifyText(m.text)}</div>
                )}
              </>
            )}
          </div>

          {/* Desktop hover menu */}
          {!m.deleted && (onReply || onDelete || onToggleReaction) && (
            <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <BubbleMenu
                message={m}
                onReply={() => onReply?.(m)}
                onOpenThread={!isThreadView && onOpenThread ? () => onOpenThread(m) : undefined}
                onCopy={() => m.text && navigator.clipboard.writeText(m.text)}
                onDelete={() => onDelete?.(m)}
                onOpenPicker={openDesktopPicker}
                canEdit={canEditOrDelete?.(m) ?? false}
              />
            </div>
          )}
        </div>

        {/* ── Footer: reactions + "+ add" + timestamp + thread ──────────────── */}
        <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} mt-1`}>

          {/* Reaction pills row */}
          {(allReactions.length > 0 || (!m.deleted && onToggleReaction)) && (
            <div className="flex flex-wrap items-center gap-1 -mt-3 mb-1 z-10 relative px-1">
              {visibleReactions.map(([key, uids]) => (
                <ReactionPill
                  key={key}
                  emojiKey={key}
                  count={uids.length}
                  iReacted={uids.includes(meId)}
                  reactorNames={uids.map(nameOf)}
                  onClick={() => onToggleReaction?.(m, key)}
                />
              ))}

              {overflowCount > 0 && (
                <span className="text-[11px] text-[--text-muted] px-1">
                  +{overflowCount} altri
                </span>
              )}

              {/* "+" button — hover-visible on desktop; opens picker */}
              {!m.deleted && onToggleReaction && (
                <div className="relative">
                  <button
                    ref={pickerBtnRef}
                    onClick={openDesktopPicker}
                    className="w-7 h-7 rounded-full border border-dashed border-[--border-base] text-[--text-muted] flex items-center justify-center text-sm hover:bg-[--bg-subtle] opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Aggiungi reazione"
                  >
                    +
                  </button>

                  {/* Desktop picker popover */}
                  {pickerOpen && pickerPos && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
                      <div
                        className="fixed z-50"
                        style={{ bottom: pickerPos.bottom, left: pickerPos.left }}
                      >
                        <EmojiPicker
                          onSelect={(emoji) => { onToggleReaction(m, emoji); setPickerOpen(false) }}
                          onClose={() => setPickerOpen(false)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-[--text-muted] px-1">
            <span>{m.createdAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {renderTicks && <span>{renderTicks(m)}</span>}
            {m.editedAt && <span>(modificato)</span>}
          </div>

          {/* Thread indicator */}
          {!isThreadView && !m.deleted && (m.replyCount ?? 0) > 0 && onOpenThread && (
            <button
              onClick={() => onOpenThread(m)}
              className="mt-0.5 min-h-[36px] flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline px-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {m.replyCount} {m.replyCount === 1 ? 'risposta' : 'risposte'}
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile context menu (long press → bottom sheet) ────────────────── */}
      {contextMenuOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setContextMenuOpen(false)} />
          <div
            className="fixed bottom-0 inset-x-0 z-50 bg-[--bg-card] dark:bg-gray-800 rounded-t-2xl shadow-2xl"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 bg-[--border-base] rounded-full mx-auto mt-3 mb-2" />

            {m.text && !m.deleted && (
              <div className="mx-4 mb-3 px-3 py-2 bg-[--bg-subtle] dark:bg-gray-700/50 rounded-xl text-sm text-[--text-muted] line-clamp-2">
                {m.text}
              </div>
            )}

            {/* Quick reactions + picker trigger */}
            {!m.deleted && onToggleReaction && (
              <div className="flex justify-center gap-2 mb-3 px-4">
                {QUICK_REACTIONS.map(emoji => {
                  const alreadyReacted = (m.reactions || {})[emoji]?.includes(meId)
                  return (
                    <button
                      key={emoji}
                      onClick={() => { onToggleReaction(m, emoji); setContextMenuOpen(false) }}
                      className={`w-11 h-11 rounded-full text-2xl flex items-center justify-center active:scale-90 transition-transform ring-2 ${
                        alreadyReacted
                          ? 'ring-green-500 bg-green-50 dark:bg-green-900/30'
                          : 'ring-transparent bg-[--bg-subtle] dark:bg-gray-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  )
                })}
                <button
                  onClick={() => { setContextMenuOpen(false); setContextPickerOpen(true) }}
                  className="w-11 h-11 rounded-full bg-[--bg-subtle] dark:bg-gray-700 flex items-center justify-center text-[--text-muted] text-xl active:scale-90 transition-transform"
                  aria-label="Tutti gli emoji"
                >
                  +
                </button>
              </div>
            )}

            <div className="border-t border-[--border-base] mx-4 mb-1" />
            <div className="px-2 pb-1">
              {!m.deleted && onReply && (
                <button onClick={() => { onReply(m); setContextMenuOpen(false) }}
                  className="w-full text-left px-4 py-3.5 flex items-center gap-3 text-[--text-base] rounded-xl active:bg-[--bg-subtle]">
                  <span className="text-lg">↩️</span> Rispondi
                </button>
              )}
              {!isThreadView && !m.deleted && onOpenThread && (
                <button onClick={() => { onOpenThread(m); setContextMenuOpen(false) }}
                  className="w-full text-left px-4 py-3.5 flex items-center gap-3 text-[--text-base] rounded-xl active:bg-[--bg-subtle]">
                  <span className="text-lg">💬</span> Apri thread
                </button>
              )}
              {!m.deleted && m.text && (
                <button onClick={() => { navigator.clipboard.writeText(m.text!); setContextMenuOpen(false) }}
                  className="w-full text-left px-4 py-3.5 flex items-center gap-3 text-[--text-base] rounded-xl active:bg-[--bg-subtle]">
                  <span className="text-lg">📋</span> Copia testo
                </button>
              )}
              {!m.deleted && (canEditOrDelete?.(m) ?? false) && onDelete && (
                <button onClick={() => { onDelete(m); setContextMenuOpen(false) }}
                  className="w-full text-left px-4 py-3.5 flex items-center gap-3 text-red-600 rounded-xl active:bg-red-50 dark:active:bg-red-900/20">
                  <span className="text-lg">🗑️</span> Elimina
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Mobile full-picker sheet (from "+" in context menu) ────────────── */}
      {contextPickerOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setContextPickerOpen(false)} />
          <div
            className="fixed bottom-0 inset-x-0 z-50 bg-[--bg-card] dark:bg-gray-800 rounded-t-2xl shadow-2xl p-4"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 bg-[--border-base] rounded-full mx-auto mb-4" />
            <EmojiPicker
              onSelect={(emoji) => {
                onToggleReaction?.(m, emoji)
                setContextPickerOpen(false)
              }}
              onClose={() => setContextPickerOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default MessageBubble
