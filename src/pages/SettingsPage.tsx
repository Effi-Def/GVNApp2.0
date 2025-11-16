import React from 'react'
import { useUserSettingsStore } from '../stores/UserSettingsStore'
import { useAuthStore } from '../stores/useAuthStore'
import { PigAvatar, PigAvatarKey } from '../components/Avatar/PigAvatar'
import { initMessaging } from '../firebase/messaging'
import { useEffect, useState } from 'react'
import { isSupported as fcmIsSupported } from 'firebase/messaging'
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
            <button
              type="button"
              onClick={async () => {
                if (!confirm('Sei sicuro di voler uscire?')) return
                try {
                  await (await import('../stores/useAuthStore')).useAuthStore.getState().logout()
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
            <div className="flex gap-2 flex-wrap">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={async ()=>{
                try { await saveNotifications(); alert('Preferenze notifiche salvate'); }
                catch(e){ console.error(e); alert('Errore nel salvataggio preferenze') }
              }}>Salva Notifiche</button>
              <button className="px-4 py-2 bg-neutral-100 text-neutral-800 rounded-lg" onClick={()=>{
                // Prova ad aprire impostazioni di notifica OS / browser
                const origin = window.location.origin
                const attempts = [
                  // Chrome Android: pagina sito
                  `intent://settings#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;end`,
                  `chrome://settings/content/siteDetails?site=${encodeURIComponent(origin)}`,
                  // iOS
                  'app-settings://notifications',
                  'App-Prefs:root=NOTIFICATIONS_ID',
                ]
                for (const url of attempts) {
                  try { const w = window.open(url, '_blank'); if (w) return } catch {}
                }
                alert('Per abilitare le notifiche: apri Impostazioni di sistema > Notifiche > consenti per il browser/app. Su Android Chrome: premi ℹ️ nell\'URL > Notifiche. Su iOS: Impostazioni > Safari/Browser > Notifiche.')
              }}>Apri impostazioni notifiche</button>
              <button className="px-4 py-2 bg-white border rounded-lg" onClick={()=>{
                // link rapido a pagina preferenze completa
                window.location.href = '/notifications/settings'
              }}>Preferenze dettagliate</button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg" onClick={async () => {
                try {
                  if (!user) return
                  const fns = getFunctions()
                  const call = httpsCallable(fns, 'sendTestPush')
                  await call({})
                  alert('Richiesta inviata: controlla il dispositivo (se non vedi nulla, verifica le impostazioni notifiche)')
                } catch (e) {
                  console.error('Errore test push:', e)
                  alert('Errore durante il test push')
                }
              }}>Test push</button>
            </div>
          </div>

          {/* Push diagnostics */}
          <PushDiagnostics userId={user?.id} />
        </div>
      )}
    </div>
  )
}

export default SettingsPage

// Inline diagnostics component for push notifications
function PushDiagnostics({ userId }: { userId?: string }) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | 'n/d'>('n/d')
  const [swControlled, setSwControlled] = useState<boolean>(false)
  const [swScript, setSwScript] = useState<string>('')
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [vapidOk] = useState<boolean>(!!import.meta.env.VITE_FIREBASE_VAPID_KEY)
  const [platformNote, setPlatformNote] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const sup = await fcmIsSupported().catch(() => false)
        setSupported(!!sup)
      } catch { setSupported(false) }
      try { setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'n/d') } catch {}
      try {
        const ctrl = (navigator.serviceWorker && navigator.serviceWorker.controller) as any
        setSwControlled(!!ctrl)
        setSwScript(ctrl?.scriptURL || '')
      } catch {}
      // iOS web browsers currently do not support Firebase Web Messaging
      const ua = navigator.userAgent
      if (/iPhone|iPad|iPod/i.test(ua)) {
        setPlatformNote('Su iOS i browser non supportano le push Web via Firebase. Le push funzionano su Android Chrome/Edge/Firefox. Su iOS usa notifiche in‑app o un wrapper nativo.')
      }
    })()
  }, [])

  const requestPermission = async () => {
    try { await Notification.requestPermission(); setPermission(Notification.permission) } catch {}
  }

  const reinit = async () => {
    if (!userId) return
    setBusy(true)
    try {
      const t = await initMessaging(userId)
      setToken(t)
      alert(t ? 'Token ottenuto e salvato' : 'Nessun token (controlla supporto/permessi/VAPID)')
    } finally { setBusy(false) }
  }

  return (
    <div className="mt-6 p-3 border rounded-lg bg-gray-50">
      <div className="font-semibold mb-2">Diagnostica Push</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div><span className="text-gray-600">Supporto FCM:</span> {supported == null ? 'n/d' : supported ? '✅' : '❌'}</div>
        <div><span className="text-gray-600">Permesso:</span> {permission}</div>
        <div><span className="text-gray-600">SW controlla la pagina:</span> {swControlled ? `sì (${swScript.split('/').pop()})` : 'no'}</div>
        <div><span className="text-gray-600">VAPID key:</span> {vapidOk ? 'presente' : 'mancante'}</div>
        <div className="col-span-1 sm:col-span-2 break-all"><span className="text-gray-600">Token (preview):</span> {token ? token.slice(0, 24) + '…' : 'non ottenuto'}</div>
      </div>
      {platformNote && <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{platformNote}</div>}
      <div className="mt-3 flex gap-2 flex-wrap">
        <button className="px-3 py-2 border rounded" onClick={requestPermission}>Richiedi permesso</button>
        <button className="px-3 py-2 bg-indigo-600 text-white rounded disabled:opacity-50" disabled={busy || !userId} onClick={reinit}>{busy ? 'Inizializzo…' : 'Re‑inizializza push'}</button>
      </div>
      <div className="text-xs text-gray-500 mt-2">Suggerimenti: abilita "Notifiche push" sopra, consenti il permesso, verifica che la VAPID key sia corretta in .env.local, e che la pagina sia controllata da un Service Worker.</div>
    </div>
  )
}
