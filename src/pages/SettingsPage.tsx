import React from 'react'
import { useUserSettingsStore } from '../stores/UserSettingsStore'
import { useAuthStore } from '../stores/useAuthStore'
import { PigAvatar, PigAvatarKey } from '../components/Avatar/PigAvatar'
import { storage } from '../firebase/config'
import { ref, getDownloadURL, listAll } from 'firebase/storage'
import { loadCachedAvatars, saveCachedAvatars, prefetchImages } from '../utils/avatarCache'

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuthStore()
  const { profile, setProfile, loadFromFirestore, saveProfile } = useUserSettingsStore()
  const [saving, setSaving] = React.useState(false)
  const [storageLoading, setStorageLoading] = React.useState(false)
  const [storageAvatars, setStorageAvatars] = React.useState<string[]>([])

  React.useEffect(() => {
    if (user) loadFromFirestore(user.id)
  }, [user, loadFromFirestore])

  const fetchAvatars = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) return
    if (!opts?.silent) setStorageLoading(true)
    try {
      const baseRef = ref(storage, 'avatars')
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
    if (cached && cached.urls.length) {
      setStorageAvatars(cached.urls)
      prefetchImages(cached.urls)
    }
    fetchAvatars({ silent: !!(cached && cached.urls.length) })
  }, [fetchAvatars])

  if (!user) return null

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Impostazioni</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome utente</label>
          <input className="w-full border rounded-lg px-3 py-2" value={profile?.displayName || ''} onChange={(e)=>setProfile({ displayName: e.target.value })}/>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input className="w-full border rounded-lg px-3 py-2" value={profile?.firstName || ''} onChange={(e)=>setProfile({ firstName: e.target.value })}/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cognome</label>
            <input className="w-full border rounded-lg px-3 py-2" value={profile?.lastName || ''} onChange={(e)=>setProfile({ lastName: e.target.value })}/>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <h3 className="font-semibold">Avatar</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Attuale:</span>
            <PigAvatar keyName={(profile?.avatarKey as PigAvatarKey) || 'pig-0'} className="text-3xl" />
            <span className="text-xs text-gray-500">({profile?.avatarKey || 'pig-0'})</span>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Scegli da Firebase Storage (cartella avatars/)</p>
              <button type="button" className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200" onClick={() => fetchAvatars()}>Aggiorna elenco</button>
            </div>
            {storageLoading && <p className="text-xs text-gray-500">Caricamento elenco avatar...</p>}
            {!storageLoading && (
              <div className="space-y-3">
                {storageAvatars.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Avatar disponibili</p>
                    <div className="grid grid-cols-5 gap-3">
                      {storageAvatars.map((url, i) => (
                        <button key={`base-${i}`} className="border rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-400" onClick={()=>setProfile({ avatarKey: `url:${url}` })} title={url}>
                          <img src={url} alt="shared" className="w-16 h-16 object-cover rounded" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {storageAvatars.length === 0 && (
                  <p className="text-xs text-gray-500">Nessuna immagine trovata in Storage nella cartella <code>avatars/</code>.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pt-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60" disabled={saving} onClick={async () => {
            try {
              setSaving(true)
              await saveProfile()
              try {
                const { user: authUser, setUser } = (await import('../stores/useAuthStore')).useAuthStore.getState()
                if (authUser && profile?.displayName) {
                  setUser({ ...authUser, displayName: profile.displayName })
                }
              } catch {}
              alert('Profilo salvato')
            }
            catch (e) { console.error(e); alert('Errore nel salvataggio profilo') }
            finally { setSaving(false) }
          }}>{saving ? 'Salvataggio...' : 'Salva Profilo'}</button>

          <button
            type="button"
            className="ml-3 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
            onClick={() => {
              window.location.href = '/settings/notifications'
            }}
          >
            Impostazioni notifiche
          </button>

          <button
            type="button"
            onClick={async () => {
              if (!confirm('Sei sicuro di voler uscire?')) return
              try {
                await logout()
              } catch (e) {
                console.error('Errore logout:', e)
                alert('Errore durante il logout')
                return
              }
              try { sessionStorage.removeItem('postLoginRedirect') } catch {}
              window.location.replace('/')
            }}
            className="ml-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >Logout</button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
