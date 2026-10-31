import React from 'react'
import { useAuthStore } from '../stores/useAuthStore'

const ExportDataButton: React.FC = () => {
  const { user } = useAuthStore()
  const [loading, setLoading] = React.useState(false)
  const [msg, setMsg] = React.useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const handleExport = async () => {
    if (!user) return
    setLoading(true)
    setMsg(null)
    try {
      const { httpsCallable, getFunctions } = await import('firebase/functions')
      const { default: app } = await import('../firebase/config')
      const fns = getFunctions(app)
      const exportFn = httpsCallable(fns, 'exportUserData')
      const result = await exportFn()

      const json = JSON.stringify(result.data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gvn-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setMsg({ type: 'ok', text: 'Dati esportati ✓' })
      setTimeout(() => setMsg(null), 4000)
    } catch (e) {
      console.error('[ExportDataButton] Error:', e)
      setMsg({ type: 'err', text: "Errore durante l'esportazione" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        disabled={loading}
        onClick={handleExport}
        className="px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 bg-[--bg-subtle] text-[--text-base] border-[--border-base] hover:bg-[--bg-raised] hover:border-[--border-strong] disabled:opacity-50 disabled:pointer-events-none"
      >
        {loading ? 'Esportazione…' : '⬇️ Scarica i tuoi dati'}
      </button>
      {msg && (
        <span className={`text-sm font-medium ${msg.type === 'ok' ? 'text-primary-600 dark:text-primary-400' : 'text-red-500'}`}>
          {msg.text}
        </span>
      )}
    </div>
  )
}

export default ExportDataButton
