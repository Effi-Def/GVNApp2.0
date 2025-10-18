import React from 'react'

// Simple emoji-based variants for now; could be replaced with SVG assets.
const variants = [
  '🐷','🐽','🐗','🐖','🧑‍🌾🐷','🤠🐷','😇🐷','😈🐷','🎩🐷','👑🐷','🕶️🐷','🎭🐷','🩷🐷','💙🐷','💚🐷','💛🐷','🖤🐷','🤍🐷','💜🐷','🧢🐷','🎀🐷','🪖🐷'
]

export type PigAvatarKey = `pig-${number}`

export const PigAvatar: React.FC<{ keyName?: PigAvatarKey; className?: string }> = ({ keyName, className }) => {
  let idx = 0
  if (keyName) {
    const num = parseInt(keyName.split('-')[1], 10)
    if (!Number.isNaN(num)) idx = Math.max(0, Math.min(variants.length - 1, num))
  }
  return <span className={className} title="Avatar">{variants[idx]}</span>
}

export const PigAvatarGrid: React.FC<{ onSelect: (key: PigAvatarKey) => void }> = ({ onSelect }) => {
  return (
    <div className="grid grid-cols-5 gap-3">
      {variants.slice(0, 20).map((v, i) => (
        <button key={i} onClick={() => onSelect(`pig-${i}` as PigAvatarKey)} className="p-3 rounded-xl border hover:bg-gray-50 text-2xl">
          <span>{v}</span>
        </button>
      ))}
    </div>
  )
}
