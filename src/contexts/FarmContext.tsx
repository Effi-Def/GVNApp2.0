import React from 'react'
import { Farm, FarmThemeKey } from '../types'
import { useAuthStore } from '../stores/useAuthStore'
import { useActiveFarmStore } from '../stores/useActiveFarmStore'
import { userPrivateService } from '../services/firestore'

export type FarmWorkspaceSettings = {
  themeKey: FarmThemeKey
}

export type FarmContextValue = {
  farms: Farm[]
  activeFarmId: string | null
  activeFarm: Farm | null
  settings: FarmWorkspaceSettings
  setThemeKey: (themeKey: FarmThemeKey) => Promise<void>
}

const FarmContext = React.createContext<FarmContextValue | null>(null)

let _basePrimary: string | null = null
let _baseAccent: string | null = null

function getBaseVars(): { primary: string; accent: string } {
  // Capture the design-system defaults once, so per-farm themes don't drift.
  if (!_basePrimary || !_baseAccent) {
    try {
      const cs = getComputedStyle(document.documentElement)
      _basePrimary = (cs.getPropertyValue('--color-primary') || '').trim() || '#10b981'
      _baseAccent = (cs.getPropertyValue('--color-accent') || '').trim() || '#ec4899'
    } catch {
      _basePrimary = _basePrimary || '#10b981'
      _baseAccent = _baseAccent || '#ec4899'
    }
  }
  return { primary: _basePrimary!, accent: _baseAccent! }
}

function applyTheme(themeKey: FarmThemeKey) {
  try {
    const root = document.documentElement
    const { primary, accent } = getBaseVars()

    // Stay inside the existing design system: derive variants from the base variables.
    // Use CSS color-mix so we don't introduce new palette constants.
    const next = (() => {
      if (themeKey === 'cool') {
        return {
          primary: `color-mix(in srgb, ${primary} 75%, white)`,
          accent: `color-mix(in srgb, ${accent} 75%, white)`,
        }
      }
      if (themeKey === 'warm') {
        return {
          primary: `color-mix(in srgb, ${primary} 85%, ${accent} 15%)`,
          accent: `color-mix(in srgb, ${accent} 85%, ${primary} 15%)`,
        }
      }
      return { primary, accent }
    })()

    root.style.setProperty('--color-primary', next.primary)
    root.style.setProperty('--color-accent', next.accent)
  } catch {}
}

export function ActiveFarmProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const farms = useActiveFarmStore(s => s.farms)
  const activeFarmId = useActiveFarmStore(s => s.activeFarmId)

  const [themeKey, setThemeKeyState] = React.useState<FarmThemeKey>('default')

  const activeFarm = React.useMemo(() => {
    if (!activeFarmId) return null
    return (farms || []).find(f => f.id === activeFarmId) || null
  }, [farms, activeFarmId])

  // Load farm-scoped settings (theme) when farm or user changes.
  React.useEffect(() => {
    const uid = user?.id
    const fid = activeFarmId
    if (!uid || !fid) {
      setThemeKeyState('default')
      applyTheme('default')
      return
    }

    let alive = true
    ;(async () => {
      try {
        const remote = await userPrivateService.getFarmThemeKey(uid, fid).catch(() => null)
        const next: FarmThemeKey = (remote === 'cool' || remote === 'warm' || remote === 'default')
          ? remote
          : 'default'
        if (!alive) return
        setThemeKeyState(next)
        applyTheme(next)
      } catch {
        if (!alive) return
        setThemeKeyState('default')
        applyTheme('default')
      }
    })()

    return () => { alive = false }
  }, [user?.id, activeFarmId])

  const setThemeKey = React.useCallback(async (next: FarmThemeKey) => {
    const uid = user?.id
    const fid = activeFarmId
    setThemeKeyState(next)
    applyTheme(next)

    if (!uid || !fid) return
    await userPrivateService.setFarmThemeKey(uid, fid, next).catch(() => {})
  }, [user?.id, activeFarmId])

  const value: FarmContextValue = React.useMemo(() => ({
    farms: farms || [],
    activeFarmId,
    activeFarm,
    settings: { themeKey },
    setThemeKey,
  }), [farms, activeFarmId, activeFarm, themeKey, setThemeKey])

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>
}

export function useFarmContext(): FarmContextValue {
  const ctx = React.useContext(FarmContext)
  if (!ctx) throw new Error('useFarmContext must be used within ActiveFarmProvider')
  return ctx
}
