import React from 'react'
import { useUserSettingsStore } from '../stores/UserSettingsStore'
import { useAuthStore } from '../stores/useAuthStore'
import { PigAvatar, PigAvatarGrid, PigAvatarKey } from '../components/Avatar/PigAvatar'
import { initMessaging } from '../firebase/messaging'
import { storage } from '../firebase/config'
import { ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage'

const SettingsPage: React.FC = () => {
  const { user } = useAuthStore()
  const { profile, notifications, setProfile, setNotifications, loadFromFirestore, saveProfile, saveNotifications } = useUserSettingsStore()
  const [activeTab, setActiveTab] = React.useState<'profile' | 'notifications'>('profile')
  const [customAvatar, setCustomAvatar] = React.useState('')
  const [uploading, setUploading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [storageLoading, setStorageLoading] = React.useState(false)
  const [storageAvatars, setStorageAvatars] = React.useState<string[]>([])
  const [myAvatars, setMyAvatars] = React.useState<string[]>([])

  React.useEffect(() => {
    if (user) loadFromFirestore(user.id)
  }, [user, loadFromFirestore])

  React.useEffect(() => {
    const fetchAvatars = async () => {
      if (!user) return
      setStorageLoading(true)
      try {
        const baseRef = ref(storage, 'avatars')
        const mineRef = ref(storage, `avatars/${user.id}`)
        const [baseList, mineList] = await Promise.allSettled([listAll(baseRef), listAll(mineRef)])
        const urlsBase: string[] = []
        const urlsMine: string[] = []
        if (baseList.status === 'fulfilled') {
          for (const item of baseList.value.items) {
            try { urlsBase.push(await getDownloadURL(item)) } catch {}
          }
        }
        if (mineList.status === 'fulfilled') {
          for (const item of mineList.value.items) {
            try { urlsMine.push(await getDownloadURL(item)) } catch {}
          }
        }
        setStorageAvatars(urlsBase)
        setMyAvatars(urlsMine)
      } catch (e) {
        console.warn('Impossibile elencare avatar da Storage:', e)
      } finally {
        setStorageLoading(false)
      }
    }
    fetchAvatars()
  }, [user])

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

            <div>
              <p className="text-sm font-medium mb-2">Scegli un maialino</p>
              <PigAvatarGrid onSelect={(key)=>setProfile({ avatarKey: key })} />
            </div>

            <div className="pt-2">
              <p className="text-sm font-medium mb-1">Oppure usa una tua immagine (PNG/JPG)</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input className="flex-1 border rounded-lg px-3 py-2" placeholder="avatars/mio-avatar.png oppure https://..." value={customAvatar} onChange={(e)=>setCustomAvatar(e.target.value)} />
                <button type="button" onClick={() => {
                  const v = customAvatar.trim(); if (!v) return;
                  const key: PigAvatarKey = v.startsWith('http') ? `url:${v}` : `img:${v.replace(/^\/?/, '')}`
                  setProfile({ avatarKey: key })
                }} className="px-3 py-2 bg-blue-600 text-white rounded-lg">Usa immagine</button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Suggerimento: metti i file in <code>public/avatars/</code> e inserisci ad es. <code>avatars/p1.png</code>. Le immagini in <code>public/</code> sono servite come tali.</p>

              <div className="mt-3">
                <p className="text-sm font-medium mb-1">Carica su Firebase Storage</p>
                <input type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file || !user) return
                  try {
                    setUploading(true)
                    const path = `avatars/${user.id}/${Date.now()}-${file.name}`
                    const r = ref(storage, path)
                    await uploadBytes(r, file)
                    const url = await getDownloadURL(r)
                    setProfile({ avatarKey: `url:${url}` })
                    try {
                      const mineRef = ref(storage, `avatars/${user.id}`)
                      const mineList = await listAll(mineRef)
                      const urls: string[] = []
                      for (const item of mineList.items) {
                        try { urls.push(await getDownloadURL(item)) } catch {}
                      }
                      setMyAvatars(urls)
                    } catch {}
                  } catch (err) {
                    console.error('Upload avatar failed:', err)
                    alert('Errore durante il caricamento su Storage')
                  } finally {
                    setUploading(false)
                  }
                }} />
                {uploading && <p className="text-xs text-gray-500 mt-1">Caricamento in corso...</p>}
                <p className="text-xs text-gray-500 mt-1">Consigliato per Hosting/produzione. Assicurati che le regole Storage consentano all'utente autenticato di scrivere in <code>avatars/{'{userId}'}</code>.</p>
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Scegli da Firebase Storage</p>
                {storageLoading && <p className="text-xs text-gray-500">Caricamento elenco avatar...</p>}
                {!storageLoading && (
                  <div className="space-y-3">
                    {myAvatars.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">I miei caricamenti</p>
                        <div className="grid grid-cols-5 gap-3">
                          {myAvatars.map((url, i) => (
                            <button key={`mine-${i}`} className="border rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-400" onClick={()=>setProfile({ avatarKey: `url:${url}` })}>
                              <img src={url} alt="mine" className="w-16 h-16 object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {storageAvatars.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Avatar condivisi (cartella avatars/)</p>
                        <div className="grid grid-cols-5 gap-3">
                          {storageAvatars.map((url, i) => (
                            <button key={`base-${i}`} className="border rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-400" onClick={()=>setProfile({ avatarKey: `url:${url}` })}>
                              <img src={url} alt="shared" className="w-16 h-16 object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {myAvatars.length === 0 && storageAvatars.length === 0 && (
                      <p className="text-xs text-gray-500">Nessuna immagine trovata in Storage. Caricane una o aggiungine nella cartella avatars/.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60" disabled={saving} onClick={async () => {
                try { setSaving(true); await saveProfile(); alert('Profilo salvato'); }
                catch (e) { console.error(e); alert('Errore nel salvataggio profilo'); }
                finally { setSaving(false) }
              }}>{saving ? 'Salvataggio...' : 'Salva Profilo'}</button>
            </div>
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
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={saveNotifications}>Salva Notifiche</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsPage
