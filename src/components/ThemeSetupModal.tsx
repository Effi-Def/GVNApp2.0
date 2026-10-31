/**
 * ThemeSetupModal
 *
 * Shown ONCE to first-time users (after login) so they can choose
 * their preferred colour scheme and see a live preview immediately.
 * The choice is persisted in localStorage via useDarkMode.
 *
 * Trigger key:  'gvn-theme-setup-seen'
 */

import { useEffect, useState } from 'react'
import { useDarkMode, ThemePreference } from '../hooks/useDarkMode'
import { isThemeSetupDone, markThemeSetupDone } from '../utils/firstRun'

const OPTIONS: { value: ThemePreference; label: string; icon: string; desc: string }[] = [
  { value: 'light',  icon: '☀️',  label: 'Chiara',  desc: 'Sfondo bianco, testo scuro' },
  { value: 'dark',   icon: '🌙',  label: 'Scura',   desc: 'Sfondo notturno, meno affaticamento' },
  { value: 'system', icon: '🖥️', label: 'Sistema', desc: 'Segue le impostazioni del dispositivo' },
]

export default function ThemeSetupModal() {
  const [open, setOpen] = useState(false)
  const { theme, setTheme, isDark } = useDarkMode()
  // Track selection locally so user can preview before confirming
  const [selected, setSelected] = useState<ThemePreference>(theme)

  // Apply preview live as user clicks an option
  useEffect(() => {
    setTheme(selected)
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isThemeSetupDone()) setOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  const confirm = () => {
    markThemeSetupDone()
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className={[
          'relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden',
          'bg-[--bg-card] text-[--text-base]',
          'transition-colors duration-200',
        ].join(' ')}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="text-4xl mb-3" aria-hidden>🐷</div>
          <h2 className="text-xl font-bold text-[--text-base]">Benvenuto/a!</h2>
          <p className="mt-1 text-sm text-[--text-muted]">
            Scegli come preferisci visualizzare l'app. Puoi cambiarlo in qualsiasi momento dalle Impostazioni.
          </p>
        </div>

        {/* Live preview strip */}
        <div
          className={[
            'mx-6 mb-4 rounded-xl p-3 flex items-center gap-3 border transition-all duration-300',
            isDark
              ? 'bg-neutral-800 border-neutral-700'
              : 'bg-[--bg-subtle] border-[--border-base]',
          ].join(' ')}
          aria-live="polite"
        >
          <div
            className={[
              'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0',
              isDark ? 'bg-primary-600 text-white' : 'bg-primary-500 text-white',
            ].join(' ')}
          >
            G
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-[--text-base]'}`}>
              GVNApp — anteprima {isDark ? 'scura' : 'chiara'}
            </div>
            <div className={`text-[11px] truncate ${isDark ? 'text-[--text-muted]' : 'text-[--text-muted]'}`}>
              Così apparirà l'interfaccia
            </div>
          </div>
          <span className="text-lg" aria-hidden>{isDark ? '🌙' : '☀️'}</span>
        </div>

        {/* Options */}
        <div className="px-6 pb-4 grid grid-cols-3 gap-2">
          {OPTIONS.map(opt => {
            const active = selected === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={[
                  'flex flex-col items-center gap-1.5 rounded-xl p-3 border-2 transition-all duration-150',
                  active
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-[--border-base] bg-[--bg-subtle] hover:border-[--border-strong]',
                ].join(' ')}
                aria-pressed={active}
              >
                <span className="text-2xl" aria-hidden>{opt.icon}</span>
                <span className={`text-xs font-semibold ${active ? 'text-primary-600 dark:text-primary-400' : 'text-[--text-base]'}`}>
                  {opt.label}
                </span>
                <span className="text-[10px] text-[--text-muted] text-center leading-tight hidden sm:block">
                  {opt.desc}
                </span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            onClick={confirm}
            className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200
              bg-gradient-to-br from-primary-500 to-primary-600
              hover:brightness-110 active:scale-95
              shadow-[0_4px_14px_0_rgb(16_185_129/0.30)]"
          >
            Conferma e inizia
          </button>
        </div>
      </div>
    </div>
  )
}

