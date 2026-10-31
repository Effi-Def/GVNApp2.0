import { useMemo, useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useActiveFarmStore } from '../stores/useActiveFarmStore'
import { useFarmContext } from '../contexts/FarmContext'

export default function FarmSwitcher() {
  const { user } = useAuthStore()
  const { farms, activeFarmId, setActiveFarmId } = useActiveFarmStore()
  const switching = useActiveFarmStore(s => s.switching)
  const { activeFarm, settings, setThemeKey } = useFarmContext()
  const [open, setOpen] = useState(false)

  const options = useMemo(() => {
    const uniq = new Map<string, string>()
    for (const f of farms || []) {
      if (!f?.id) continue
      uniq.set(f.id, f.name || 'Gruppo')
    }
    return Array.from(uniq.entries()).map(([id, name]) => ({ id, name }))
  }, [farms])

  // Backward compatible: hide if user has 0/1 farm.
  if (!user?.id) return null
  if (options.length <= 1) return null

  return (
    <div className="hidden lg:flex items-center">
      <button
        type="button"
        className="max-w-[240px] border border-[--border-base] bg-[--bg-card] rounded-xl px-3 py-2 text-sm font-semibold text-[--text-base] hover:bg-[--bg-subtle] disabled:opacity-70 disabled:cursor-wait"
        onClick={() => !switching && setOpen(true)}
        disabled={switching}
        title="Cambia gruppo"
      >
        {switching ? '⏳ Caricamento...' : (activeFarm?.name || 'Gruppo')}
        {!switching && <span className="ml-2 text-[--text-muted]">▾</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-label="Chiudi"
          />
          <div className="absolute right-6 top-24 w-[340px] max-w-[92vw] bg-[--bg-card] rounded-2xl border border-[--border-base] shadow-xl p-3 text-left">
            <div className="flex items-center justify-between px-2 py-1">
              <div className="font-semibold text-[--text-base]">Gruppi</div>
              <button type="button" className="text-sm text-[--text-muted] hover:text-[--text-base]" onClick={() => setOpen(false)}>Chiudi</button>
            </div>

            <div className="mt-2 space-y-1">
              {options.map((o) => {
                const active = o.id === activeFarmId
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm ${
                      active
                        ? 'border-primary-200 bg-primary-50 text-primary-800'
                        : 'border-[--border-base] hover:bg-[--bg-subtle] text-[--text-base]'
                    }`}
                    onClick={async () => {
                      setOpen(false)
                      await setActiveFarmId({ userId: user.id, farmId: o.id })
                    }}
                  >
                    <span className="truncate">{o.name}</span>
                    {active && <span className="text-xs font-semibold">Attivo</span>}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 border-t border-neutral-100 pt-3 px-2">
              <div className="text-xs font-semibold text-[--text-muted] mb-2">Tema del gruppo</div>
              <div className="flex gap-2">
                {(['default', 'cool', 'warm'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`px-3 py-1.5 rounded-lg text-xs border ${
                      settings.themeKey === k
                        ? 'border-primary-300 bg-primary-50 text-primary-800'
                        : 'border-[--border-base] hover:bg-[--bg-subtle] text-[--text-muted]'
                    }`}
                    onClick={() => setThemeKey(k)}
                  >
                    {k === 'default' ? 'Default' : k === 'cool' ? 'Cool' : 'Warm'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

