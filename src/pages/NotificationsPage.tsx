import { useNotificationsStore } from '../stores/useNotificationsStore'
import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { notificationService } from '../services/notifications'
import { useAuthStore } from '../stores/useAuthStore'

const NotificationsPage = () => {
  const notifications = useNotificationsStore(s => s.notifications)
  const markAsRead = useNotificationsStore(s => s.markAsRead)
  const markAllAsRead = useNotificationsStore(s => s.markAllAsRead)
  const userId = useAuthStore(s => s.user?.id)
  const navigate = useNavigate()

  const unread = useMemo(() => notifications.filter(n => !n.read), [notifications])

  const openNotification = (id: string, url?: string) => {
    markAsRead(id)
    if (userId) notificationService.markAsRead(userId, id)
    if (url) navigate(url)
  }

  const onMarkAllAsRead = () => {
    markAllAsRead()
    if (userId) notificationService.markAllAsRead(userId)
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">Notifiche <span>🐷</span></h1>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings/notifications')} className="text-sm text-gray-700 hover:text-gray-900">Preferenze</button>
          {unread.length > 0 && (
            <button onClick={onMarkAllAsRead} className="text-sm text-blue-600 hover:text-blue-800">Segna tutte come lette</button>
          )}
        </div>
      </div>

      {unread.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-5xl mb-2">🔕</div>
          Nessuna notifica
        </div>
      ) : (
        <div className="space-y-2">
          {unread.map(n => (
            <button key={n.id} onClick={() => openNotification(n.id, n.actionUrl)} className={`w-full text-left p-4 rounded-xl border ${n.read ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-start gap-3">
                <span className="text-xl">{n.type === 'expense' ? '💰' : n.type === 'event' ? '🎉' : '🔔'}</span>
                <div className="flex-1">
                  <div className="font-medium">{n.title}</div>
                  <div className="text-sm text-gray-600">{n.message}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default NotificationsPage
