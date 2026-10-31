import { useNotificationsStore } from '../stores/useNotificationsStore'
import { useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { notificationService } from '../services/notifications'
import { useAuthStore } from '../stores/useAuthStore'

type Tab = 'unread' | 'all'

const getNotifIcon = (type: string) => {
  switch (type) {
    case 'expense': return '💰'
    case 'payment': return '💸'
    case 'event': return '🎉'
    case 'poll': return '🗳️'
    case 'list': return '📝'
    case 'chat': return '💬'
    case 'reminder': return '⏰'
    default: return '🔔'
  }
}

const formatRelativeTime = (date: Date) => {
  try {
    const now = new Date()
    const diffMs = now.getTime() - (date instanceof Date ? date : new Date(date)).getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffMins < 1) return 'ora'
    if (diffMins < 60) return `${diffMins}m fa`
    if (diffHours < 24) return `${diffHours}h fa`
    if (diffDays < 7) return `${diffDays}g fa`
    return (date instanceof Date ? date : new Date(date)).toLocaleDateString('it-IT')
  } catch {
    return ''
  }
}

const NotificationsPage = () => {
  const notifications = useNotificationsStore(s => s.notifications)
  const markAsRead = useNotificationsStore(s => s.markAsRead)
  const markAllAsRead = useNotificationsStore(s => s.markAllAsRead)
  const userId = useAuthStore(s => s.user?.id)
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('unread')

  const unread = useMemo(() => notifications.filter(n => !n.read), [notifications])
  const displayed = tab === 'unread' ? unread : notifications

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
    <div className="pt-16 px-4 sm:px-6 pb-4 sm:pb-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">Notifiche <span>🐷</span></h1>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings/notifications')} className="text-sm text-[--text-muted] hover:text-[--text-base]">Preferenze</button>
          {unread.length > 0 && (
            <button onClick={onMarkAllAsRead} className="text-sm text-blue-600 hover:text-blue-800">Segna tutte come lette</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-[--bg-subtle] rounded-xl p-1">
        <button
          onClick={() => setTab('unread')}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'unread' ? 'bg-[--bg-card] text-[--text-base] shadow-sm' : 'text-[--text-muted]'}`}
        >
          Non lette {unread.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{unread.length}</span>}
        </button>
        <button
          onClick={() => setTab('all')}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'all' ? 'bg-[--bg-card] text-[--text-base] shadow-sm' : 'text-[--text-muted]'}`}
        >
          Tutte {notifications.length > 0 && <span className="ml-1 text-xs text-[--text-muted]">({notifications.length})</span>}
        </button>
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 text-[--text-muted]">
          <div className="text-5xl mb-2">🔕</div>
          <p>{tab === 'unread' ? 'Nessuna notifica non letta' : 'Nessuna notifica'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(n => (
            <button
              key={n.id}
              onClick={() => openNotification(n.id, n.actionUrl)}
              className={`w-full text-left p-4 rounded-xl border transition-colors ${
                !n.read
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-[--bg-card] border-[--border-base] opacity-75'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">{getNotifIcon(n.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`font-medium truncate ${n.read ? 'text-[--text-muted]' : 'text-[--text-base]'}`}>{n.title}</div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-[--text-muted]">{formatRelativeTime(n.createdAt)}</span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                    </div>
                  </div>
                  <div className="text-sm text-[--text-muted] mt-0.5 line-clamp-2">{n.message}</div>
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
