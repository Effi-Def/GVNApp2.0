import React from 'react'
import { useUserSettingsStore } from '../stores/UserSettingsStore'
import { useAuthStore } from '../stores/useAuthStore'
import { initMessaging } from '../firebase/messaging'

const NotificationPreferencesPage: React.FC = () => {
  const { user } = useAuthStore()
  const { notifications, setNotifications, saveNotifications } = useUserSettingsStore()

  if (!user) return null
  const types = notifications.types || {}

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
            setNotifications({ pushEnabled: e.target.checked })
            if (e.target.checked) await initMessaging(user.id)
          }} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Notifiche desktop leggere</div>
            <div className="text-xs text-gray-600">Pop-up locale quando l'app è aperta</div>
          </div>
          <input type="checkbox" checked={notifications.desktopEnabled} onChange={(e)=>setNotifications({ desktopEnabled: e.target.checked })} />
        </div>
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-2">Tipologie</h2>
        <p className="text-xs text-gray-600 mb-3">Scegli quali notifiche vuoi ricevere</p>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span>Eventi creati</span>
            <input type="checkbox" checked={types.event !== false} onChange={(e)=>setNotifications({ types: { ...types, event: e.target.checked } })} />
          </label>
          <label className="flex items-center justify-between">
            <span>Spese create</span>
            <input type="checkbox" checked={types.expense !== false} onChange={(e)=>setNotifications({ types: { ...types, expense: e.target.checked } })} />
          </label>
          <label className="flex items-center justify-between">
            <span>Sondaggi creati</span>
            <input type="checkbox" checked={types.poll !== false} onChange={(e)=>setNotifications({ types: { ...types, poll: e.target.checked } })} />
          </label>
          <label className="flex items-center justify-between">
            <span>Liste create</span>
            <input type="checkbox" checked={types.list !== false} onChange={(e)=>setNotifications({ types: { ...types, list: e.target.checked } })} />
          </label>
          <label className="flex items-center justify-between">
            <span>Messaggi chat (sperimentale)</span>
            <input type="checkbox" checked={!!types.chat} onChange={(e)=>setNotifications({ types: { ...types, chat: e.target.checked } })} />
          </label>
        </div>
        <div className="pt-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={saveNotifications}>Salva preferenze</button>
        </div>
      </div>
    </div>
  )
}

export default NotificationPreferencesPage
