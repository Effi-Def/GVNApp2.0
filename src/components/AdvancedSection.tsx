import React from 'react'

type AdvancedSectionProps = {
  storageKey: string
  title?: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}

function readStoredBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === '1' || raw === 'true'
  } catch {
    return fallback
  }
}

function writeStoredBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // ignore
  }
}

const AdvancedSection: React.FC<AdvancedSectionProps> = ({
  storageKey,
  title = 'Avanzate',
  defaultOpen = false,
  children,
  className,
}) => {
  const contentId = React.useId()
  const [open, setOpen] = React.useState(() => readStoredBool(storageKey, defaultOpen))

  React.useEffect(() => {
    writeStoredBool(storageKey, open)
  }, [storageKey, open])

  return (
    <div className={className}>
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[--border-base] bg-[--bg-subtle] hover:bg-[--bg-raised] text-sm transition-colors duration-150"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(v => !v)}
      >
        <span className="font-medium text-[--text-base]">{title}</span>
        <span className="text-[--text-muted]">{open ? 'Nascondi ▲' : 'Mostra ▼'}</span>
      </button>

      {open && (
        <div id={contentId} className="mt-3">
          {children}
        </div>
      )}
    </div>
  )
}

export default AdvancedSection
