import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { farmService } from '../services/firestore'
import { useAuthStore, refreshActiveFarmData } from '../stores/useAuthStore'
import { useActiveFarmStore } from '../stores/useActiveFarmStore'
import { useAppStore } from '../stores/AppStore'

const ICON_OPTIONS = ['🐷', '🌱', '🎉', '⚽', '🎵', '🏖️', '🍕', '🚀', '🦊', '🌍', '🎮', '🤝']

const OnboardingPage = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const farms = useActiveFarmStore((s) => s.farms)
  const initializingFarms = useActiveFarmStore((s) => s.initializing)
  const initializedForUserId = useActiveFarmStore((s) => s.initializedForUserId)
  const hydrateForUser = useActiveFarmStore((s) => s.hydrateForUser)
  const setActiveFarmId = useActiveFarmStore((s) => s.setActiveFarmId)

  const farmIds = useAppStore((s) => s.farmIds)
  const setFarmIds = useAppStore((s) => s.setFarmIds)

  const [inviteCode, setInviteCode] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [createdFarmId, setCreatedFarmId] = useState<string | null>(null)

  const [farmName, setFarmName] = useState('')
  const [iconEmoji, setIconEmoji] = useState('🐷')
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const isReady = useMemo(() => {
    if (!user?.id) return false
    if (initializingFarms) return false
    if (initializedForUserId !== user.id) return false
    return true
  }, [user?.id, initializingFarms, initializedForUserId])

  useEffect(() => {
    if (!isReady) return
    if ((farms?.length || 0) > 0) {
      navigate('/', { replace: true })
    }
  }, [isReady, farms?.length, navigate])

  if (!user?.id) return null

  const goJoin = () => {
    const code = inviteCode.trim()
    if (!code) return
    navigate(`/farms/join/${encodeURIComponent(code)}`)
  }

  const createFarm = async () => {
    const name = farmName.trim()
    if (!name) {
      setCreateError('Dai un nome al gruppo prima di continuare')
      return
    }
    setCreateError(null)

    setSubmitting(true)
    try {
      const created = await farmService.createFarm({
        name,
        ownerId: user.id,
        iconEmoji: iconEmoji?.trim() || undefined,
        privacy: 'invite',
      })

      const nextFarmIds = Array.from(new Set([...(Array.isArray(farmIds) ? farmIds : []), created.id]))
      try {
        setFarmIds(nextFarmIds)
      } catch {}

      await hydrateForUser({ userId: user.id, farmIds: nextFarmIds })
      await setActiveFarmId({ userId: user.id, farmId: created.id })
      await refreshActiveFarmData()

      try { localStorage.setItem('gvn.tutorial.pending', '1') } catch {}

      setCreatedFarmId(created.id)
    } catch (e) {
      console.error(e)
      setCreateError('Qualcosa è andato storto. Riprova.')
    } finally {
      setSubmitting(false)
    }
  }

  if (createdFarmId) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="rounded-3xl border border-[--border-base] bg-[--bg-card] p-6 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <div className="text-2xl font-semibold text-[--text-base]">Gruppo creato!</div>
          <div className="mt-2 text-sm text-[--text-muted]">
            Ora invita i tuoi amici — senza di loro il gruppo è vuoto.
          </div>
          <div className="mt-6 space-y-3">
            <button
              type="button"
              className="w-full px-4 py-3 rounded-2xl bg-neutral-900 text-white text-sm font-semibold"
              onClick={() => navigate('/farm', { replace: true })}
            >
              👥 Invita gli amici
            </button>
            <button
              type="button"
              className="w-full px-4 py-3 rounded-2xl border border-[--border-base] bg-[--bg-card] text-[--text-base] text-sm font-semibold"
              onClick={() => navigate('/polls?create=1', { replace: true })}
            >
              🗳️ Proponi una data subito
            </button>
            <button
              type="button"
              className="text-sm text-[--text-muted] pt-1"
              onClick={() => navigate('/', { replace: true })}
            >
              Vai alla home →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-3xl border border-[--border-base] bg-[--bg-card] p-6">
        <div className="text-2xl font-semibold text-[--text-base]">Crea il vostro gruppo</div>
        <div className="mt-2 text-sm text-[--text-muted]">
          Il posto per eventi, sondaggi e chat. Dopo puoi invitare gli altri.
        </div>

        <div className="mt-6 space-y-4">
          {/* Emoji + name row */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-14 h-14 rounded-2xl border border-[--border-base] bg-[--bg-raised] text-3xl flex items-center justify-center flex-shrink-0 hover:bg-[--bg-subtle] transition"
              onClick={() => setShowIconPicker(p => !p)}
              title="Cambia icona"
              disabled={submitting}
            >
              {iconEmoji}
            </button>
            <input
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              className="flex-1 px-4 py-3 rounded-2xl border border-[--border-base] bg-[--bg-card] text-base text-[--text-base] font-medium placeholder:text-[--text-muted]"
              placeholder="Es. Amici del liceo"
              autoFocus
              disabled={submitting}
              onKeyDown={(e) => e.key === 'Enter' && createFarm()}
            />
          </div>

          {/* Inline icon picker */}
          {showIconPicker && (
            <div className="grid grid-cols-6 gap-2 p-3 rounded-2xl border border-[--border-base] bg-[--bg-subtle]">
              {ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`h-10 w-10 rounded-xl text-xl flex items-center justify-center transition ${
                    iconEmoji === icon ? 'bg-primary-100 ring-2 ring-primary-400' : 'hover:bg-[--bg-raised]'
                  }`}
                  onClick={() => { setIconEmoji(icon); setShowIconPicker(false) }}
                >
                  {icon}
                </button>
              ))}
            </div>
          )}

          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}

          <button
            type="button"
            className="w-full px-4 py-3 rounded-2xl bg-neutral-900 text-white text-sm font-semibold disabled:opacity-60 transition"
            onClick={createFarm}
            disabled={submitting || !farmName.trim()}
          >
            {submitting ? 'Creazione...' : 'Crea il vostro spazio →'}
          </button>
        </div>

        {/* Join via code — secondary */}
        <div className="mt-6 pt-5 border-t border-[--border-base]">
          <div className="text-xs font-semibold text-[--text-muted] mb-2">Hai un codice invito?</div>
          <div className="flex gap-2">
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-[--border-base] bg-[--bg-card] text-sm text-[--text-base]"
              placeholder="Incolla il codice"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={(e) => e.key === 'Enter' && goJoin()}
            />
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-semibold disabled:opacity-60"
              onClick={goJoin}
              disabled={submitting || inviteCode.trim().length === 0}
            >
              Entra
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingPage
