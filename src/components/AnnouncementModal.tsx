import { useEffect, useState } from 'react'

// One-time announcement popup utilities
export const ANNOUNCEMENT_ID = '2025-10-22' // change this id to show a new popup next time

export const MESSAGE = `A voi bosgati,
buone notizie. Ho fatto delle implementazioni.

. Visualizzazione del calendario con colori che indicano gli eventi
- Creazione della to do list: creando una lista to do, è posbbile assegnare "giorno di consegna" e utente, così da avere sott'occhio anche nella home quali cose non dimenticarsi!
- Creazione della lista macchine: gestione veloce ed efficace!
- Creazione della lista camere: Così saprai sempre dove dormi. Anche se fosse un divano.`

export function isAnnouncementUnread(): boolean {
  try {
    const key = `whats_new_seen:${ANNOUNCEMENT_ID}`
    return !localStorage.getItem(key)
  } catch {
    return false
  }
}

export function openAnnouncementModal() {
  window.dispatchEvent(new CustomEvent('open-announcement'))
}

export default function AnnouncementModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const key = `whats_new_seen:${ANNOUNCEMENT_ID}`
    const seen = localStorage.getItem(key)
    if (!seen) setOpen(true)
  }, [])

  useEffect(() => {
    const original = document.body.style.overflow
    if (open) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [open])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('open-announcement', handler as any)
    return () => window.removeEventListener('open-announcement', handler as any)
  }, [])

  if (!open) return null

  const acknowledge = () => {
    localStorage.setItem(`whats_new_seen:${ANNOUNCEMENT_ID}`, '1')
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-[80]">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-md w-full h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[85vh] overflow-y-auto relative">
        <div className="p-6 pb-28 sm:pb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="text-3xl" aria-hidden>🐷</div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Novità di oggi</h2>
              <p className="text-sm text-gray-500">Aggiornamento una tantum con le ultime modifiche</p>
            </div>
          </div>

          {/* Message */}
          <div className="whitespace-pre-wrap text-gray-800 leading-relaxed text-sm">
            {MESSAGE}
          </div>

          {/* Tips */}
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            Il messaggio appare una sola volta per versione. Aggiorna l'app per verificare di avere l'ultima release.
          </div>

          {/* Actions - fixed on mobile */}
          <div className="fixed left-1/2 -translate-x-1/2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[85] w-full max-w-md px-4 sm:static sm:translate-x-0 sm:px-0 sm:mt-6">
            <div className="bg-white border rounded-xl shadow-md px-4 py-3 flex gap-3 sm:border-0 sm:shadow-none sm:p-0 sm:justify-end">
              <button
                onClick={acknowledge}
                className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Chiudi
              </button>
              <button
                onClick={acknowledge}
                className="flex-1 sm:flex-none px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Non mostrare più
              </button>
            </div>
          </div>
        </div>

        {/* Close (X) */}
        <button
          onClick={acknowledge}
          className="absolute top-3 right-3 p-2 rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="Chiudi"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
