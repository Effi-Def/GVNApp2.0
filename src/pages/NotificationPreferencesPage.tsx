import React, { useEffect, useMemo, useState } from 'react'
import { NotificationSettings, useUserSettingsStore } from '../stores/UserSettingsStore'
import { useAuthStore } from '../stores/useAuthStore'
import { initMessaging } from '../firebase/messaging'
import { isSupported as fcmIsSupported } from 'firebase/messaging'

const NotificationPreferencesPage: React.FC = () => {
  const { user } = useAuthStore()
  const { notifications, setNotifications, saveNotifications, saveNotificationsPartial, loadFromFirestore } = useUserSettingsStore()
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [typesDraft, setTypesDraft] = useState<NonNullable<NotificationSettings['types']>>({})
  const [typesDirty, setTypesDirty] = useState(false)

  if (!user) return null
  const types = typesDraft || {}

  useEffect(() => {
    if (!typesDirty) {
      setTypesDraft((notifications.types || {}) as any)
    }
  }, [notifications.types, typesDirty])

  const permission = useMemo(() => {
    try {
      if (typeof Notification === 'undefined') return 'unsupported'
      return Notification.permission
    } catch {
      return 'unknown'
    }
  }, [])

  const formatError = (e: unknown) => {
    const anyErr = e as any
    const code = anyErr?.code ? String(anyErr.code) : ''
    const msg = anyErr?.message ? String(anyErr.message) : String(e)
    return code ? `${code}: ${msg}` : msg
  }

  const handleSave = async () => {
    setSaveMessage(null)
    setSaving(true)
    try {
      // Apply draft types to store only on explicit save
      setNotifications({ types: typesDraft })
      await saveNotifications(user.id)
      // Reload immediately to verify persistence
      await loadFromFirestore(user.id)
      setSaveMessage('Preferenze salvate')
      setTypesDirty(false)
    } catch (e) {
      console.error(e)
      setSaveMessage('Errore nel salvataggio preferenze: ' + formatError(e))
    } finally {
      setSaving(false)
    }
  }

  const saveToggle = async (partial: { pushEnabled?: boolean; desktopEnabled?: boolean }) => {
    setSaveMessage(null)
    setSaving(true)
    try {
      await saveNotificationsPartial(user.id, partial)
      await loadFromFirestore(user.id)
      setSaveMessage('Impostazione salvata')
    } catch (e) {
      console.error(e)
      setSaveMessage('Errore nel salvataggio: ' + formatError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Preferenze notifiche</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Notifiche push su cellulare</div>
            <div className="text-xs text-gray-600">Richiede consenso del browser e Service Worker</div>
          </div>
          <input type="checkbox" checked={notifications.pushEnabled} onChange={async (e)=>{
            const checked = e.target.checked
            setNotifications({ pushEnabled: checked })
            if (checked) {
              try {
                await initMessaging(user.id)
                await saveToggle({ pushEnabled: true })
              } catch (err) {
                console.error(err)
                setNotifications({ pushEnabled: false })
                await saveToggle({ pushEnabled: false })
                alert('Errore attivazione push: ' + formatError(err))
              }
            } else {
              await saveToggle({ pushEnabled: false })
            }
          }} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Notifiche desktop leggere</div>
            <div className="text-xs text-gray-600">Pop-up locale quando l'app è aperta</div>
          </div>
          <input type="checkbox" checked={notifications.desktopEnabled} onChange={async (e)=>{
            const checked = e.target.checked
            setNotifications({ desktopEnabled: checked })
            await saveToggle({ desktopEnabled: checked })
          }} />
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mt-6">
        <h2 className="text-lg font-semibold mb-2">Diagnostica Notifiche</h2>
        <p className="text-xs text-gray-600 mb-3">Se non ricevi le notifiche, controlla qui.</p>
        
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
             <span>Stato Permessi:</span>
             <span className={permission === 'granted' ? 'text-green-600 font-bold' : 'text-red-600'}>
               {permission === 'granted' ? 'Concessi ✅' : 'Non concessi ❌'}
             </span>
          </div>
          
          <div className="flex items-center justify-between">
             <span>App Installata (PWA):</span>
             <span className={window.matchMedia('(display-mode: standalone)').matches ? 'text-green-600 font-bold' : 'text-orange-600'}>
               {window.matchMedia('(display-mode: standalone)').matches ? 'Sì ✅' : 'No (Browser) ⚠️'}
             </span>
          </div>

          <div className="flex items-center justify-between">
             <span>Token FCM:</span>
             <span className={notifications.fcmTokens && notifications.fcmTokens.length > 0 ? 'text-green-600 font-bold' : 'text-red-600'}>
               {notifications.fcmTokens && notifications.fcmTokens.length > 0 ? 'Presente ✅' : 'Mancante ❌'}
             </span>
          </div>
          
          {!window.matchMedia('(display-mode: standalone)').matches && (
             <div className="bg-orange-50 p-2 rounded text-xs text-orange-800">
               Su iOS (iPhone), le notifiche funzionano <strong>solo</strong> se aggiungi l'app alla Home.
             </div>
          )}

          <div className="pt-2 space-y-2">
            <button 
              onClick={async () => {
                try {
                  const { httpsCallable, getFunctions } = await import('firebase/functions')
                  const { default: app } = await import('../firebase/config')
                  const functions = getFunctions(app)
                  const sendTest = httpsCallable(functions, 'sendTestPush')
                  await sendTest({ userId: user.id })
                  alert('Notifica di test inviata! Dovrebbe arrivare a breve.')
                } catch (e) {
                  console.error(e)
                  alert('Errore invio test: ' + e)
                }
              }}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium"
            >
              Invia Notifica di Test 🔔
            </button>

            <button
              onClick={() => {
                const origin = window.location.origin
                const attempts = [
                  `intent://settings#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;end`,
                  `chrome://settings/content/siteDetails?site=${encodeURIComponent(origin)}`,
                  'app-settings://notifications',
                  'App-Prefs:root=NOTIFICATIONS_ID',
                ]
                for (const url of attempts) {
                  try { const w = window.open(url, '_blank'); if (w) return } catch {}
                }
                alert('Per abilitare le notifiche: apri Impostazioni di sistema > Notifiche > consenti per il browser/app. Su Android Chrome: premi ℹ️ nell\'URL > Notifiche. Su iOS: Impostazioni > Safari/Browser > Notifiche.')
              }}
              className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-sm font-medium"
            >
              Apri impostazioni notifiche
            </button>
            
            <button 
              onClick={async () => {
                try {
                  await initMessaging(user.id)
                  alert('Push reinizializzate con successo!')
                } catch (e) {
                  alert('Errore reinizializzazione push: ' + e)
                }
              }}
              className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-sm font-medium"
            >
              Re‑inizializza push 🔄
            </button>
          </div>
        </div>

        <PushDiagnostics userId={user.id} />
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-2">Tipologie</h2>
        <p className="text-xs text-gray-600 mb-3">Scegli quali notifiche vuoi ricevere</p>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span>Eventi creati</span>
            <input type="checkbox" checked={types.event !== false} onChange={(e)=>{ setTypesDirty(true); setTypesDraft({ ...types, event: e.target.checked }) }} />
          </label>
          <label className="flex items-center justify-between">
            <span>Spese create</span>
            <input type="checkbox" checked={types.expense !== false} onChange={(e)=>{ setTypesDirty(true); setTypesDraft({ ...types, expense: e.target.checked }) }} />
          </label>
          <label className="flex items-center justify-between">
            <span>Sondaggi creati</span>
            <input type="checkbox" checked={types.poll !== false} onChange={(e)=>{ setTypesDirty(true); setTypesDraft({ ...types, poll: e.target.checked }) }} />
          </label>
          <label className="flex items-center justify-between">
            <span>Liste create</span>
            <input type="checkbox" checked={types.list !== false} onChange={(e)=>{ setTypesDirty(true); setTypesDraft({ ...types, list: e.target.checked }) }} />
          </label>
          <label className="flex items-center justify-between">
            <span>Messaggi chat (sperimentale)</span>
            <input type="checkbox" checked={!!types.chat} onChange={(e)=>{ setTypesDirty(true); setTypesDraft({ ...types, chat: e.target.checked }) }} />
          </label>
        </div>
        <div className="pt-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvataggio...' : 'Salva preferenze'}
          </button>
          {saveMessage && (
            <div className="mt-2 text-sm text-gray-700">{saveMessage}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default NotificationPreferencesPage

function PushDiagnostics({ userId }: { userId: string }) {
  const { notifications } = useUserSettingsStore()
  const [supported, setSupported] = useState<boolean | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | 'n/d'>('n/d')
  const [swControlled, setSwControlled] = useState<boolean>(false)
  const [swScript, setSwScript] = useState<string>('')
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [vapidOk] = useState<boolean>(!!import.meta.env.VITE_FIREBASE_VAPID_KEY)
  const [platformNote, setPlatformNote] = useState<string | null>(null)

  useEffect(() => {
    if (notifications.fcmTokens && notifications.fcmTokens.length > 0) {
      setToken(notifications.fcmTokens[notifications.fcmTokens.length - 1])
    } else if (notifications.fcmToken) {
      setToken(notifications.fcmToken)
    }
  }, [notifications])

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
    setBusy(true)
    setLastError(null)
    setLogs([])
    try {
      const t = await initMessaging(userId, (msg) => setLogs(prev => [...prev, msg]))
      setToken(t)
      alert(t ? 'Token ottenuto e salvato' : 'Nessun token (controlla supporto/permessi/VAPID)')
    } catch (e: any) {
      console.error(e)
      setLastError(e.message || String(e))
      alert('Errore inizializzazione: ' + (e.message || String(e)))
    } finally { setBusy(false) }
  }

  const resetSW = async () => {
    if (!navigator.serviceWorker) return
    setBusy(true)
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) {
        await reg.unregister()
      }
      alert('Service Worker rimosso. L\'app verrà ricaricata.')
      window.location.reload()
    } catch (e) {
      alert('Errore rimozione Service Worker: ' + e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 p-3 border rounded-lg bg-gray-50">
      <div className="font-semibold mb-2">Diagnostica Push (avanzata)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div><span className="text-gray-600">Supporto FCM:</span> {supported == null ? 'n/d' : supported ? '✅' : '❌'}</div>
        <div><span className="text-gray-600">Permesso:</span> {permission}</div>
        <div><span className="text-gray-600">SW controlla la pagina:</span> {swControlled ? `sì (${swScript.split('/').pop()})` : 'no'}</div>
        <div><span className="text-gray-600">VAPID key:</span> {vapidOk ? 'presente' : 'mancante'}</div>
        <div className="col-span-1 sm:col-span-2 break-all">
          <span className="text-gray-600">Token (preview):</span>
          {token ? <span className="text-green-600 font-mono ml-1">{token.slice(0, 24)}…</span> : <span className="text-orange-600 ml-1">non ottenuto</span>}
        </div>
        {lastError && <div className="col-span-1 sm:col-span-2 text-red-600 break-all font-mono text-xs mt-1 bg-red-50 p-1 rounded border border-red-200">{lastError}</div>}
        {logs.length > 0 && (
          <div className="col-span-1 sm:col-span-2 mt-2 p-2 bg-black text-green-400 font-mono text-xs rounded max-h-32 overflow-y-auto">
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </div>
      {platformNote && <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{platformNote}</div>}
      <div className="mt-3 flex gap-2 flex-wrap">
        <button className="px-3 py-2 border rounded" onClick={requestPermission}>Richiedi permesso</button>
        <button className="px-3 py-2 bg-indigo-600 text-white rounded disabled:opacity-50" disabled={busy} onClick={reinit}>{busy ? 'Inizializzo…' : 'Re‑inizializza push'}</button>
        <button className="px-3 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200" onClick={resetSW}>Reset Service Worker ⚠️</button>
      </div>
      <div className="text-xs text-gray-500 mt-2">Nota: in sviluppo (npm run dev) il Service Worker PWA è disabilitato, quindi le push possono non funzionare.</div>
    </div>
  )
}
