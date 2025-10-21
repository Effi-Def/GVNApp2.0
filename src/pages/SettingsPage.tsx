import React from 'react'
import { useUserSettingsStore } from '../stores/UserSettingsStore'
import { useAuthStore } from '../stores/useAuthStore'
import { PigAvatar, PigAvatarKey } from '../components/Avatar/PigAvatar'
import { initMessaging } from '../firebase/messaging'
import { storage } from '../firebase/config'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { ref, getDownloadURL, listAll } from 'firebase/storage'
import { loadCachedAvatars, saveCachedAvatars, prefetchImages } from '../utils/avatarCache'

const SettingsPage: React.FC = () => {
  const { user } = useAuthStore()
  const { profile, notifications, setProfile, setNotifications, loadFromFirestore, saveProfile, saveNotifications } = useUserSettingsStore()
  const [activeTab, setActiveTab] = React.useState<'profile' | 'notifications'>('profile')
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
      // Parallelize getDownloadURL to reduce latency
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
    // Instant load from cache, then SWR refresh in background
    const cached = loadCachedAvatars()
    if (cached && cached.urls.length) {
      setStorageAvatars(cached.urls)
      prefetchImages(cached.urls)
    }
    // If no cache or stale, refresh; use silent mode if we have something to show
    fetchAvatars({ silent: !!(cached && cached.urls.length) })
  }, [fetchAvatars])

  if (!user) return null

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Impostazioni</h1>
      <div className="flex gap-2 mb-6">
        <button className={`px-4 py-2 rounded-lg ${activeTab==='profile'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setActiveTab('profile')}>Profilo</button>
        <button className={`px-4 py-2 rounded-lg ${activeTab==='notifications'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setActiveTab('notifications')}>Notifiche</button>
      </div>

      {activeTab === 'profile' && (
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
                // Aggiorna subito il displayName nello store auth per propagazione immediata
                try {
                  const { user, setUser } = (await import('../stores/useAuthStore')).useAuthStore.getState()
                  if (user && profile?.displayName) {
                    setUser({ ...user, displayName: profile.displayName })
                  }
                } catch {}
                alert('Profilo salvato')
              }
              catch (e) { console.error(e); alert('Errore nel salvataggio profilo'); }
              finally { setSaving(false) }
            }}>{saving ? 'Salvataggio...' : 'Salva Profilo'}</button>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input id="desktop" type="checkbox" checked={notifications.desktopEnabled} onChange={(e)=>setNotifications({ desktopEnabled: e.target.checked })} />
            <label htmlFor="desktop">Notifiche desktop leggere</label>
          </div>
          <div className="flex items-center gap-2">
            <input id="push" type="checkbox" checked={notifications.pushEnabled} onChange={async (e)=>{
              setNotifications({ pushEnabled: e.target.checked })
              if (e.target.checked && user) {
                await initMessaging(user.id)
              }
            }} />
            <label htmlFor="push">Notifiche push su cellulare</label>
          </div>
          <div className="pt-4">
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={saveNotifications}>Salva Notifiche</button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg" onClick={async () => {
                try {
                  if (!user) return
                  const fns = getFunctions()
                  const call = httpsCallable(fns, 'sendTestPush')
                  await call({})
                  alert('Richiesta inviata: controlla il dispositivo per la notifica push')
                } catch (e) {
                  console.error('Errore test push:', e)
                  alert('Errore durante il test push')
                }
              }}>Test push</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsPage
