import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Minimal toast utility
function showToast(message: string, opts?: { action?: { label: string; onClick: () => void } }) {
  let container = document.getElementById('gvn-toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'gvn-toast-container'
    container.style.position = 'fixed'
    container.style.bottom = '16px'
    container.style.left = '50%'
    container.style.transform = 'translateX(-50%)'
    container.style.zIndex = '9999'
    container.style.display = 'flex'
    container.style.flexDirection = 'column'
    container.style.gap = '8px'
    document.body.appendChild(container)
  }

  const toast = document.createElement('div')
  toast.style.background = '#111827'
  toast.style.color = 'white'
  toast.style.padding = '10px 14px'
  toast.style.borderRadius = '12px'
  toast.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)'
  toast.style.display = 'flex'
  toast.style.alignItems = 'center'
  toast.style.gap = '12px'

  const span = document.createElement('span')
  span.textContent = message
  span.style.fontSize = '14px'
  toast.appendChild(span)

  if (opts?.action) {
    const btn = document.createElement('button')
    btn.textContent = opts.action.label
    btn.style.background = '#3B82F6'
    btn.style.color = 'white'
    btn.style.fontWeight = '600'
    btn.style.fontSize = '12px'
    btn.style.padding = '6px 10px'
    btn.style.borderRadius = '8px'
    btn.onclick = () => {
      opts.action!.onClick()
      container!.removeChild(toast)
    }
    toast.appendChild(btn)
  }

  container.appendChild(toast)

  // Auto dismiss after 6s if no action
  if (!opts?.action) {
    setTimeout(() => {
      if (toast.parentElement) container!.removeChild(toast)
    }, 6000)
  }
}

// Register PWA and show a toast when a new version is available
const updateSW = registerSW({
  onNeedRefresh() {
    // Visible toast
    showToast('Nuova versione disponibile', {
      action: {
        label: 'Aggiorna',
        onClick: () => updateSW(true),
      },
    })
    // Also add an in-app notification so it's clearly visible
    import('./stores/useNotificationsStore').then(({ useNotificationsStore }) => {
      const add = useNotificationsStore.getState().add
      add({
        type: 'reminder',
        title: 'Nuova versione disponibile',
        message: 'Tocca per aggiornare l\'app all\'ultima versione.',
        createdAt: new Date(),
        actionUrl: undefined,
      })
    }).catch(() => {})
  },
  onOfflineReady() {
    showToast('App disponibile offline')
    // Also add an in-app notification for offline-ready
    import('./stores/useNotificationsStore').then(({ useNotificationsStore }) => {
      const add = useNotificationsStore.getState().add
      add({
        type: 'reminder',
        title: 'Disponibile offline',
        message: 'Puoi usare l\'app anche senza connessione.',
        createdAt: new Date(),
        actionUrl: undefined,
      })
    }).catch(() => {})
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
