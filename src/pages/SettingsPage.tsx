import { useEffect, useState } from 'react'
import { useUserSettingsStore } from '../stores/UserSettingsStore'
import { useAuthStore } from '../stores/useAuthStore'
import { PigAvatar, PigAvatarGrid, PigAvatarKey } from '../components/Avatar/PigAvatar'
import { initMessaging } from '../firebase/messaging'

const SettingsPage = () => {
  const { user } = useAuthStore()
  const { profile, notifications, setProfile, setNotifications, loadFromFirestore, saveProfile, saveNotifications } = useUserSettingsStore()
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications'>('profile')
  const [customAvatar, setCustomAvatar] = useState('')

  useEffect(() => {
    if (user) loadFromFirestore(user.id)
  }, [user, loadFromFirestore])

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
                <input
                  className="flex-1 border rounded-lg px-3 py-2"
                  placeholder="avatars/mio-avatar.png oppure https://..."
                  value={customAvatar}
                  onChange={(e)=>setCustomAvatar(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = customAvatar.trim()
                    if (!v) return
                    const key: PigAvatarKey = v.startsWith('http') ? `url:${v}` : `img:${v.replace(/^\/?/, '')}`
                    setProfile({ avatarKey: key })
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg"
                >Usa immagine</button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Suggerimento: metti i file in <code>public/avatars/</code> e inserisci ad es. <code>avatars/p1.png</code>. Le immagini in <code>public/</code> sono servite come tali.</p>
            </div>
          </div>

          <div className="pt-4">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={saveProfile}>Salva Profilo</button>
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
