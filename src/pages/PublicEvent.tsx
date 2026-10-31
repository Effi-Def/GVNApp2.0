import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'

interface PublicEventPayload {
  id: string
  title: string
  description?: string
  location?: string
  category?: string
  time?: string
  date?: string
  endDate?: string
  participantsCount?: number
  publicShareEnabled?: boolean
}

const buildPublicEventEndpoint = (eventId: string) => {
  const configured = (import.meta.env.VITE_PUBLIC_FUNCTIONS_URL || '').trim()
  if (configured) {
    const base = configured.endsWith('/') ? configured.slice(0, -1) : configured
    return `${base}/publicEvent?id=${encodeURIComponent(eventId)}`
  }
  return `/api/publicEvent?id=${encodeURIComponent(eventId)}`
}

const PublicEvent = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [event, setEvent] = useState<PublicEventPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If already logged in, go to full summary
    if (user && id) {
      navigate(`/events/${id}/summary`, { replace: true })
      return
    }
    if (!id) {
      setEvent(null)
      setError('Link evento non valido')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(buildPublicEventEndpoint(id), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })

        if (response.status === 404) {
          setEvent(null)
          setError('Evento non trovato o non più disponibile')
          return
        }

        if (response.status === 403) {
          setEvent(null)
          setError('La condivisione di questo evento è stata disattivata')
          return
        }

        if (!response.ok) {
          throw new Error(`Status ${response.status}`)
        }

        const payload = (await response.json()) as PublicEventPayload
        setEvent({ ...payload, id })
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('❌ Errore caricando evento pubblico:', err)
        setEvent(null)
        setError('Impossibile caricare l\'evento condiviso')
      } finally {
        setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [id, user, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-[--bg-page] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">📅</div>
          <div className="text-[--text-muted]">Caricamento evento…</div>
        </div>
      </div>
    )
  }

  if (!loading && !event) {
    return (
      <div className="min-h-screen bg-[--bg-page] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">🤷‍♂️</div>
          <div className="text-[--text-base] font-medium">{error || 'Evento non trovato'}</div>
          <div className="mt-3"><button onClick={() => navigate('/')} className="text-green-700 hover:underline">Vai alla Home</button></div>
        </div>
      </div>
    )
  }

  if (!event) {
    return null
  }

  const parseDate = (value?: string) => {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const formatRange = (e: PublicEventPayload) => {
    const startDate = parseDate(e.date)
    const endDate = parseDate(e.endDate)
    const time = e.time ? ` alle ${e.time}` : ''
    if (startDate && endDate) {
      const start = startDate.toLocaleDateString('it-IT')
      const end = endDate.toLocaleDateString('it-IT')
      return `${start} — ${end}${time}`
    }
    if (startDate) {
      return `${startDate.toLocaleDateString('it-IT')}${time}`
    }
    return 'Data da definire'
  }

  const participantsCount = event?.participantsCount ?? 0

  return (
    <div className="min-h-screen bg-[--bg-page]">
      <header className="sticky top-0 z-10 bg-[--bg-card]/80 backdrop-blur border-b border-[--border-base]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-base font-semibold text-[--text-base]">Sei stato invitato 🎉</div>
          <button onClick={() => navigate('/')} className="text-sm text-[--text-muted] hover:text-[--text-base]">Apri app</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
          <div className="bg-[--bg-card] rounded-2xl shadow-sm border border-[--border-base] p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📅</span>
            <h1 className="text-xl sm:text-2xl font-bold text-[--text-base]">{event.title}</h1>
          </div>
          <div className="text-sm text-[--text-muted] space-y-1 mb-4">
            <div>📍 {event.location || 'Luogo da definire'}</div>
            <div>🗓️ {formatRange(event)}</div>
          </div>

          {event.description ? (
            <div className="mb-4 text-sm text-[--text-base] leading-relaxed border-l-2 border-[--border-base] pl-3">
              {event.description}
            </div>
          ) : null}

          <div className="mt-2 p-3 rounded-xl bg-[--bg-subtle] border border-[--border-base] text-sm font-medium text-[--text-base]">
            {participantsCount > 0 ? (
              <div>👥 {participantsCount} {participantsCount === 1 ? 'persona partecipa' : 'persone partecipano'} già — unisciti!</div>
            ) : (
              <div>✨ Sii il primo a confermare la tua presenza</div>
            )}
          </div>

          <div className="mt-5">
            <button
              onClick={() => {
                if (id) sessionStorage.setItem('postLoginRedirect', `/events/${id}/summary`)
                navigate('/')
              }}
              className="w-full px-4 py-3.5 rounded-2xl bg-neutral-900 text-white text-base font-semibold hover:bg-neutral-700 transition"
            >
              Accedi e partecipa →
            </button>
            <p className="mt-2 text-center text-xs text-[--text-muted]">Gratuito · Accedi con Google in un tap</p>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-[--text-muted]">
        GVNApp • Condivisione sicura
      </footer>
    </div>
  )
}

export default PublicEvent
