import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserSettingsStore } from '../stores/UserSettingsStore'
import { useAuthStore } from '../stores/useAuthStore'
import { PigAvatar, PigAvatarKey } from '../components/Avatar/PigAvatar'
import { storage } from '../firebase/config'
import { ref, getDownloadURL, listAll } from 'firebase/storage'
import { loadCachedAvatars, saveCachedAvatars, prefetchImages } from '../utils/avatarCache'
import AdvancedSection from '../components/AdvancedSection'
import { useDarkMode, ThemePreference } from '../hooks/useDarkMode'

// ── Shared section card ────────────────────────────────────────────────────
const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="bg-[--bg-card] border border-[--border-base] rounded-2xl p-5 shadow-card space-y-4">
    {title && <h2 className="text-sm font-semibold text-[--text-muted] uppercase tracking-wider">{title}</h2>}
    {children}
  </div>
)

// ── Labelled field ─────────────────────────────────────────────────────────
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-[--text-base]">{label}</label>
    {children}
  </div>
)

// ── Dark mode theme picker ─────────────────────────────────────────────────
const THEME_OPTIONS: { value: ThemePreference; icon: string; label: string }[] = [
  { value: 'light',  icon: '☀️',  label: 'Chiara'  },
  { value: 'dark',   icon: '🌙',  label: 'Scura'   },
  { value: 'system', icon: '🖥️', label: 'Sistema' },
]

// ── Main page ──────────────────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
  const navigate  = useNavigate()
  const { user, logout } = useAuthStore()
  const { profile, setProfile, loadFromFirestore, saveProfile } = useUserSettingsStore()
  const { theme: currentTheme, setTheme } = useDarkMode()

  const [saving,        setSaving]        = React.useState(false)
  const [saveMsg,       setSaveMsg]       = React.useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [storageLoading, setStorageLoading] = React.useState(false)
  const [storageAvatars, setStorageAvatars] = React.useState<string[]>([])

  React.useEffect(() => {
    if (user) loadFromFirestore(user.id)
  }, [user, loadFromFirestore])

  const fetchAvatars = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) return
    if (!opts?.silent) setStorageLoading(true)
    try {
      const baseRef  = ref(storage, 'avatars')
      const baseList = await listAll(baseRef)
      const urlsBase = (await Promise.all(
        baseList.items.map(item => getDownloadURL(item).catch(() => null))
      )).filter((u): u is string => !!u)
      setStorageAvatars(urlsBase)
      saveCachedAvatars(urlsBase)
      prefetchImages(urlsBase)
    } finally {
      setStorageLoading(false)
    }
  }, [user])

  React.useEffect(() => {
    const cached = loadCachedAvatars()
    if (cached?.urls.length) {
      setStorageAvatars(cached.urls)
      prefetchImages(cached.urls)
    }
    fetchAvatars({ silent: !!(cached?.urls.length) })
  }, [fetchAvatars])

  if (!user) return null

  const inputCls = [
    'w-full rounded-xl border-2 px-4 py-2.5 text-sm font-medium',
    'bg-[--bg-card] text-[--text-base] placeholder:text-[--text-muted]',
    'border-[--border-base] focus:border-primary-500',
    'focus:outline-none focus:ring-4 focus:ring-primary-500/10',
    'transition-all duration-200',
  ].join(' ')

  const btnSecondary = [
    'px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200',
    'bg-[--bg-subtle] text-[--text-base] border-[--border-base]',
    'hover:bg-[--bg-raised] hover:border-[--border-strong]',
  ].join(' ')

  return (
    <div className="pt-16 px-4 pb-8 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-[--text-base]">Impostazioni</h1>

      {/* ── Profilo ── */}
      <Section title="Profilo">
        <Field label="Nome visibile">
          <input
            className={inputCls}
            value={profile?.displayName || ''}
            onChange={e => setProfile({ displayName: e.target.value })}
            placeholder="Come ti chiamano gli amici"
          />
        </Field>

        <div className="flex items-center gap-3 pt-1">
          <button
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white
              bg-gradient-to-br from-primary-500 to-primary-600
              shadow-[0_4px_14px_0_rgb(16_185_129/0.30)]
              hover:brightness-110 active:scale-95 transition-all duration-200
              disabled:opacity-50 disabled:pointer-events-none"
            disabled={saving}
            onClick={async () => {
              try {
                setSaving(true)
                setSaveMsg(null)
                await saveProfile()
                try {
                  const { user: authUser, setUser } = useAuthStore.getState()
                  if (authUser && profile?.displayName) setUser({ ...authUser, displayName: profile.displayName })
                } catch {}
                setSaveMsg({ type: 'ok', text: 'Profilo salvato ✓' })
                setTimeout(() => setSaveMsg(null), 3000)
              } catch (e) {
                console.error(e)
                setSaveMsg({ type: 'err', text: 'Errore nel salvataggio profilo' })
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? 'Salvataggio…' : 'Salva nome'}
          </button>

          {saveMsg && (
            <span className={`text-sm font-medium ${saveMsg.type === 'ok' ? 'text-primary-600 dark:text-primary-400' : 'text-red-500'}`}>
              {saveMsg.text}
            </span>
          )}
        </div>
      </Section>

      {/* ── Aspetto ── */}
      <Section title="Aspetto">
        <p className="text-sm text-[--text-muted]">Scegli il tema dell'interfaccia.</p>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(opt => {
            const active = currentTheme === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={[
                  'flex flex-col items-center gap-2 rounded-xl p-3 border-2 transition-all duration-150',
                  active
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-[--border-base] bg-[--bg-subtle] hover:border-[--border-strong]',
                ].join(' ')}
                aria-pressed={active}
              >
                <span className="text-2xl" aria-hidden>{opt.icon}</span>
                <span className={`text-xs font-semibold ${active ? 'text-primary-600 dark:text-primary-400' : 'text-[--text-base]'}`}>
                  {opt.label}
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Azioni rapide ── */}
      <Section title="Accesso rapido">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} onClick={() => navigate('/settings/notifications')}>
            🔔 Notifiche
          </button>
          <button type="button" className={btnSecondary} onClick={() => navigate('/settings/farms')}>
            🐷 Gruppi
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 active:scale-95 transition-all duration-200"
            onClick={async () => {
              try { await logout() } catch (e) {
                console.error('Errore logout:', e)
                setSaveMsg({ type: 'err', text: 'Errore durante il logout' })
                return
              }
              try { sessionStorage.removeItem('postLoginRedirect') } catch {}
              window.location.replace('/')
            }}
          >
            🚪 Logout
          </button>
        </div>
      </Section>

      {/* ── Sezione avanzata ── */}
      <AdvancedSection storageKey="gvn.advanced.settings.profile" title="Avanzate">
        <div className="bg-[--bg-card] border border-[--border-base] rounded-2xl p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome">
              <input className={inputCls} value={profile?.firstName || ''} onChange={e => setProfile({ firstName: e.target.value })} />
            </Field>
            <Field label="Cognome">
              <input className={inputCls} value={profile?.lastName || ''} onChange={e => setProfile({ lastName: e.target.value })} />
            </Field>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-[--text-base]">Avatar</h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[--text-muted]">Attuale:</span>
              <PigAvatar keyName={(profile?.avatarKey as PigAvatarKey) || 'pig-0'} className="text-3xl" />
              <span className="text-xs text-[--text-muted]">({profile?.avatarKey || 'pig-0'})</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-[--text-base]">Scegli da Firebase Storage</p>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded-lg bg-[--bg-subtle] hover:bg-[--bg-raised] border border-[--border-base] text-[--text-base] transition-colors"
                  onClick={() => fetchAvatars()}
                >
                  Aggiorna elenco
                </button>
              </div>

              {storageLoading && (
                <p className="text-xs text-[--text-muted]">Caricamento elenco avatar…</p>
              )}

              {!storageLoading && storageAvatars.length > 0 && (
                <>
                  <p className="text-xs text-[--text-muted] mb-2">Avatar disponibili</p>
                  <div className="grid grid-cols-5 gap-3">
                    {storageAvatars.map((url, i) => (
                      <button
                        key={`base-${i}`}
                        className="rounded-xl overflow-hidden border-2 border-[--border-base] hover:border-primary-500 transition-colors"
                        onClick={() => setProfile({ avatarKey: `url:${url}` })}
                        title={url}
                      >
                        <img src={url} alt="avatar" className="w-full aspect-square object-cover" />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {!storageLoading && storageAvatars.length === 0 && (
                <p className="text-xs text-[--text-muted]">
                  Nessuna immagine trovata in Storage nella cartella <code className="bg-[--bg-subtle] px-1 py-0.5 rounded text-primary-600 dark:text-primary-400">avatars/</code>.
                </p>
              )}
            </div>
          </div>
        </div>
      </AdvancedSection>
    </div>
  )
}

export default SettingsPage
