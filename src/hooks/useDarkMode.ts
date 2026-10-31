/**
 * useDarkMode
 *
 * Manages the dark/light/system theme preference.
 * - Reads the initial preference from localStorage (key: 'gvn-theme').
 * - Falls back to the OS `prefers-color-scheme` when no explicit preference is saved.
 * - Applies / removes the `dark` CSS class on `<html>` reactively.
 * - Exposes `isDark`, `theme`, and `setTheme` ('light' | 'dark' | 'system').
 */

import { useEffect, useState, useCallback } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'gvn-theme'

function getStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch { /* localStorage unavailable in SSR or private mode */ }
  return 'system'
}

function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

function resolveIsDark(pref: ThemePreference): boolean {
  if (pref === 'dark') return true
  if (pref === 'light') return false
  return prefersDark()
}

function applyClass(isDark: boolean) {
  const html = document.documentElement
  if (isDark) {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

export function useDarkMode() {
  const [theme, setThemeState] = useState<ThemePreference>(getStoredPreference)
  const isDark = resolveIsDark(theme)

  // Apply class whenever theme changes
  useEffect(() => {
    applyClass(resolveIsDark(theme))
  }, [theme])

  // When 'system', also listen for OS-level changes
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => applyClass(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((pref: ThemePreference) => {
    try { localStorage.setItem(STORAGE_KEY, pref) } catch {}
    setThemeState(pref)
  }, [])

  const toggle = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark')
  }, [isDark, setTheme])

  return { isDark, theme, setTheme, toggle }
}

/**
 * Call this once at app startup (outside React) to avoid a flash of
 * light mode before hydration.  Place it in main.tsx before ReactDOM.render.
 */
export function initDarkMode() {
  const pref = getStoredPreference()
  applyClass(resolveIsDark(pref))
}
