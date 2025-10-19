import React from 'react'

// Simple emoji-based variants for now; could be replaced with SVG assets.
const variants = [
  '🐷','🐽','🐗','🐖','🧑‍🌾🐷','🤠🐷','😇🐷','😈🐷','🎩🐷','👑🐷','🕶️🐷','🎭🐷','🩷🐷','💙🐷','💚🐷','💛🐷','🖤🐷','🤍🐷','💜🐷','🧢🐷','🎀🐷','🪖🐷'
]

// Accepted keys:
// - pig-N           -> emoji avatar by index
// - img:path.png    -> image in public/ (e.g., img:avatars/pig01.png)
// - url:https://... -> external image URL
export type PigAvatarKey = string

export const PigAvatar: React.FC<{ keyName?: PigAvatarKey; className?: string; size?: number }> = ({ keyName, className, size }) => {
  // Render custom image if requested
  if (keyName?.startsWith('img:')) {
    const path = keyName.slice(4) // remove 'img:'
    const src = path.startsWith('/') ? path : `/${path}`
    const dim = size || 32
    return <img src={src} alt="avatar" className={className} style={{ width: dim, height: dim, objectFit: 'cover', borderRadius: 8 }} />
  }
  if (keyName?.startsWith('url:')) {
    const src = keyName.slice(4)
    const dim = size || 32
    return <img src={src} alt="avatar" className={className} style={{ width: dim, height: dim, objectFit: 'cover', borderRadius: 8 }} />
  }

  // Default emoji avatar
  let idx = 0
  if (keyName?.startsWith('pig-')) {
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
