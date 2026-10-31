// First-run steps are shown one at a time: theme, then tutorial, then notifications.

const THEME_SEEN_KEY = 'gvn-theme-setup-seen'
const TUTORIAL_DONE_KEY = 'gvn.tutorial.v1'
const TUTORIAL_PENDING_KEY = 'gvn.tutorial.pending'

export const FIRST_RUN_EVENT = 'gvn:first-run-changed'

export function notifyFirstRunChanged() {
  window.dispatchEvent(new Event(FIRST_RUN_EVENT))
}

export function isThemeSetupDone(): boolean {
  try {
    return !!localStorage.getItem(THEME_SEEN_KEY)
  } catch {
    return true
  }
}

export function markThemeSetupDone() {
  try {
    localStorage.setItem(THEME_SEEN_KEY, '1')
  } catch {}
  notifyFirstRunChanged()
}

export function isTutorialPending(): boolean {
  try {
    return !localStorage.getItem(TUTORIAL_DONE_KEY) && !!localStorage.getItem(TUTORIAL_PENDING_KEY)
  } catch {
    return false
  }
}

export function markTutorialDone() {
  try {
    localStorage.setItem(TUTORIAL_DONE_KEY, '1')
    localStorage.removeItem(TUTORIAL_PENDING_KEY)
  } catch {}
  notifyFirstRunChanged()
}
