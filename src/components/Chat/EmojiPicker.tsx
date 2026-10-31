/**
 * EmojiPicker — custom 24-emoji grid with a recently-used section.
 *
 * No external dependencies. Recent emoji are persisted in localStorage
 * and shown first, so muscle-memory stays fast.
 */
import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'chat_recent_emoji'
const MAX_RECENT = 8

const COMMON_EMOJI = [
  '👍', '👎', '❤️', '😂', '😍', '😮', '😢', '😡',
  '🎉', '🔥', '💯', '✅', '🙏', '👀', '💪', '🤝',
  '😎', '🥰', '🤔', '🥳', '💀', '🤣', '⭐', '🚀',
]

export function getRecentEmoji(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

export function recordRecentEmoji(emoji: string): void {
  const recent = getRecentEmoji().filter(e => e !== emoji)
  recent.unshift(emoji)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
}

interface Props {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export default function EmojiPicker({ onSelect, onClose }: Props) {
  const [recent, setRecent] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setRecent(getRecentEmoji())
  }, [])

  // Close on outside click / tap
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [onClose])

  const pick = (emoji: string) => {
    recordRecentEmoji(emoji)
    onSelect(emoji)
  }

  return (
    <div
      ref={containerRef}
      className="bg-[--bg-card] dark:bg-gray-800 border border-[--border-base] rounded-2xl shadow-xl p-3 w-64"
      onMouseDown={e => e.stopPropagation()}
    >
      {recent.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-[--text-muted] uppercase tracking-wide mb-1.5 px-0.5">
            Recenti
          </p>
          <div className="grid grid-cols-8 gap-0.5 mb-2">
            {recent.map(e => (
              <button
                key={e}
                onClick={() => pick(e)}
                className="w-7 h-7 text-[18px] flex items-center justify-center rounded-lg hover:bg-[--bg-subtle] active:scale-90 transition-transform"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="border-t border-[--border-base] mb-2" />
        </>
      )}
      <p className="text-[10px] font-semibold text-[--text-muted] uppercase tracking-wide mb-1.5 px-0.5">
        Emoji
      </p>
      <div className="grid grid-cols-8 gap-0.5">
        {COMMON_EMOJI.map(e => (
          <button
            key={e}
            onClick={() => pick(e)}
            className="w-7 h-7 text-[18px] flex items-center justify-center rounded-lg hover:bg-[--bg-subtle] active:scale-90 transition-transform"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
