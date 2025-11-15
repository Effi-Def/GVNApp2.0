/**
 * Detects if the current device is a mobile device
 * Mobile devices often have issues with popup-based authentication
 * @returns true if running on a mobile device
 */
export function isMobileDevice(): boolean {
  // Check for mobile user agent patterns
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
  
  // Common mobile patterns
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
    /Mobile/i,
  ]
  
  const isMobileUA = mobilePatterns.some(pattern => userAgent.match(pattern))
  
  // Also check for touch support and small screen as additional indicators
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const isSmallScreen = window.innerWidth < 768
  
  // Consider it mobile if it matches user agent OR (has touch AND small screen)
  return isMobileUA || (hasTouch && isSmallScreen)
}

/**
 * Determines if the app is running in a standalone/PWA mode
 * @returns true if running as installed PWA
 */
export function isStandalonePWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true
}
