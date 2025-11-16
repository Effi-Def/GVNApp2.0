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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">📅</div>
          <div className="text-gray-600">Caricamento evento…</div>
        </div>
      </div>
    )
  }

  if (!loading && !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">🤷‍♂️</div>
          <div className="text-gray-700 font-medium">{error || 'Evento non trovato'}</div>
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
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-base font-semibold text-gray-900">Invito evento</div>
          <button onClick={() => navigate('/')} className="text-sm text-gray-600 hover:text-gray-800">Apri app</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📅</span>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{event.title}</h1>
          </div>
          <div className="text-sm text-neutral-600 space-y-1 mb-4">
            <div>📍 {event.location || 'Luogo da definire'}</div>
            <div>🗓️ {formatRange(event)}</div>
            {/* Intentionally omitting description and creator details */}
          </div>

          <div className="mt-2 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
            {participantsCount > 0 ? (
              <div>👥 {participantsCount} partecipanti (nomi nascosti per privacy)</div>
            ) : (
              <div>👥 Nessun partecipante ancora</div>
            )}
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => {
                // Persist the target so after login we jump to the event summary
                if (id) sessionStorage.setItem('postLoginRedirect', `/events/${id}/summary`)
                navigate('/')
              }} 
              className="flex-1 gvn-btn-primary bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Accedi per partecipare
            </button>
            <a
              href={`/`} 
              className="flex-1 text-center px-4 py-2 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
            >
              Scopri di più nell'app
            </a>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-gray-500">
        GVNApp • Condivisione sicura
      </footer>
    </div>
  )
}

export default PublicEvent
