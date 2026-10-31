import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { farmService, userPrivateService } from '../services/firestore'
import { useAuthStore, refreshActiveFarmData } from '../stores/useAuthStore'
import { useActiveFarmStore } from '../stores/useActiveFarmStore'
import { useAppStore } from '../stores/AppStore'

const JoinFarmPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const hydrateForUser = useActiveFarmStore((s) => s.hydrateForUser)
  const setActiveFarmId = useActiveFarmStore((s) => s.setActiveFarmId)
  const setFarmIds = useAppStore((s) => s.setFarmIds)

  const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>('loading')
  const [farmName, setFarmName] = React.useState<string>('')
  const [errorMsg, setErrorMsg] = React.useState<string>('')
  const [retrying, setRetrying] = React.useState(false)

  const doJoin = React.useCallback(async () => {
    if (!token || !user?.id) return
    setStatus('loading')
    setErrorMsg('')
    try {
      // Resolve invite first to get farm name for success screen
      const inv = await farmService.getInvite(token)
      if (!inv || !inv.active) throw new Error('Invito non valido o scaduto')
      if (inv.farmName) setFarmName(inv.farmName)

      // Direct join — no owner approval needed
      const farmId = await farmService.joinDirectlyByToken({
        token,
        user: { id: user.id, displayName: user.displayName, photoURL: user.photoURL },
      })

      // Sync stores
      const allFarmIds = await userPrivateService.getFarmIds(user.id).catch(() => [farmId])
      const nextIds = Array.from(new Set([...allFarmIds, farmId]))
      try { setFarmIds(nextIds) } catch {}
      await hydrateForUser({ userId: user.id, farmIds: nextIds })
      await setActiveFarmId({ userId: user.id, farmId })
      await refreshActiveFarmData()

      // Mark tutorial pending for first-time users
      try { localStorage.setItem('gvn.tutorial.pending', '1') } catch {}

      setStatus('success')
      setTimeout(() => navigate('/', { replace: true }), 1400)
    } catch (e: any) {
      console.error('JoinFarmPage error:', e)
      const msg = typeof e?.message === 'string' ? e.message : 'Errore durante l\'accesso al gruppo'
      setErrorMsg(msg)
      setStatus('error')
    }
  }, [token, user?.id, hydrateForUser, setActiveFarmId, setFarmIds, navigate])

  React.useEffect(() => {
    void doJoin()
  }, [doJoin])

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-[--bg-card] rounded-3xl shadow-xl p-8 text-center space-y-6">
          <div className="text-6xl">👋</div>
          <div>
            <div className="text-2xl font-bold text-[--text-base]">Sei stato invitato!</div>
            <div className="mt-2 text-sm text-[--text-muted]">
              Un tuo amico ti sta aspettando — eventi, sondaggi e chat del gruppo, tutto in un posto.
            </div>
          </div>
          <button
            type="button"
            className="w-full py-3 rounded-2xl bg-neutral-900 text-white font-semibold text-sm hover:bg-neutral-700 transition"
            onClick={() => {
              try { sessionStorage.setItem('postLoginRedirect', `/farms/join/${token}`) } catch {}
              navigate('/login')
            }}
          >
            Accedi per unirti →
          </button>
          <div className="text-xs text-[--text-muted]">Gratuito. Accedi con Google in un tap.</div>
        </div>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-6">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-200 border-t-neutral-800" />
        <p className="text-sm text-[--text-muted]">Accesso al gruppo in corso…</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 px-6">
        <div className="text-5xl animate-bounce">🎉</div>
        <div className="text-xl font-semibold text-[--text-base] text-center">
          {farmName ? `Benvenuto in "${farmName}"!` : 'Benvenuto nel gruppo!'}
        </div>
        <p className="text-sm text-[--text-muted]">Stai per entrare…</p>
      </div>
    )
  }

  // error
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-6 max-w-sm mx-auto">
      <div className="text-4xl">😢</div>
      <div className="text-xl font-semibold text-[--text-base] text-center">Invito non valido</div>
      <p className="text-sm text-[--text-muted] text-center">{errorMsg || 'L\'invito è scaduto o non esiste.'}</p>
      <button
        type="button"
        className="mt-2 px-6 py-3 rounded-2xl bg-neutral-900 text-white text-sm font-semibold disabled:opacity-60"
        disabled={retrying}
        onClick={async () => {
          setRetrying(true)
          await doJoin()
          setRetrying(false)
        }}
      >
        {retrying ? 'Riprovo…' : 'Riprova'}
      </button>
      <button
        type="button"
        className="text-sm text-[--text-muted] underline"
        onClick={() => navigate('/onboarding', { replace: true })}
      >
        Torna all'inizio
      </button>
    </div>
  )
}

export default JoinFarmPage

