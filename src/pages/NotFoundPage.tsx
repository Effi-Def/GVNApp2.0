import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-4">🌫️</div>
      <h1 className="text-2xl font-bold text-[--text-base] mb-2">Pagina non trovata</h1>
      <p className="text-[--text-muted] mb-6">Questa pagina non esiste o è stata spostata.</p>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="px-5 py-2.5 rounded-xl bg-neutral-900 text-white font-semibold text-sm hover:bg-neutral-800 transition"
      >
        Torna alla home
      </button>
    </div>
  )
}

