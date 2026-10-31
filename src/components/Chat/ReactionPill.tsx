/**
 * ReactionPill — emoji + count pill for chat messages.
 *
 * • Click to toggle own reaction
 * • Hover (desktop) / press (mobile) shows a tooltip listing reactor names
 * • Count change triggers a 300 ms scale-bounce animation
 * • Resolves legacy Firestore keys (like / love / fun) → emoji character
 */
import { useEffect, useRef, useState } from 'react'

/** Maps legacy reaction keys to their emoji character. */
export const LEGACY_EMOJI: Record<string, string> = {
  like: '👍',
  love: '❤️',
  fun: '😂',
}

export function resolveEmoji(key: string): string {
  return LEGACY_EMOJI[key] ?? key
}

interface Props {
  emojiKey: string
  count: number
  iReacted: boolean
  /** Display names of the users who reacted (already resolved, "Tu" for self). */
  reactorNames: string[]
  onClick: () => void
}

export default function ReactionPill({ emojiKey, count, iReacted, reactorNames, onClick }: Props) {
  const emoji = resolveEmoji(emojiKey)
  const [showTooltip, setShowTooltip] = useState(false)
  const [animating, setAnimating] = useState(false)
  const prevCount = useRef(count)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Bounce the count number whenever it changes
  useEffect(() => {
    if (count === prevCount.current) return
    prevCount.current = count
    setAnimating(true)
    const t = setTimeout(() => setAnimating(false), 300)
    return () => clearTimeout(t)
  }, [count])

  const showTip = () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    setShowTooltip(true)
  }
  const hideTip = () => {
    tooltipTimer.current = setTimeout(() => setShowTooltip(false), 200)
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
    >
      <button
        onClick={onClick}
        onTouchStart={showTip}
        onTouchEnd={hideTip}
        className={`
          inline-flex items-center gap-1 px-2 py-0.5 min-h-[28px] rounded-full border text-xs
          transition-all duration-150 select-none active:scale-90
          ${iReacted
            ? 'bg-green-100 dark:bg-green-900/40 border-green-500 dark:border-green-600'
            : 'bg-[--bg-card] dark:bg-gray-800 border-[--border-base] dark:border-gray-600 hover:bg-[--bg-subtle]'
          }
        `}
      >
        <span className="text-sm leading-none">{emoji}</span>
        <span
          className={`font-semibold tabular-nums leading-none transition-transform duration-150 inline-block ${
            animating ? 'scale-125' : 'scale-100'
          }`}
        >
          {count}
        </span>
      </button>

      {/* Tooltip — reactor names */}
      {showTooltip && reactorNames.length > 0 && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          onMouseEnter={showTip}
          onMouseLeave={hideTip}
        >
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap max-w-[200px] text-center">
            <div className="font-semibold mb-0.5">{emoji} {count}</div>
            <div className="text-gray-300 leading-snug">
              {reactorNames.slice(0, 5).join(', ')}
              {reactorNames.length > 5 && ` +${reactorNames.length - 5}`}
            </div>
          </div>
          {/* Arrow */}
          <div className="w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45 mx-auto -mt-1 rounded-sm" />
        </div>
      )}
    </div>
  )
}
