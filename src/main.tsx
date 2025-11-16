import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
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

// Guards to avoid duplicate update prompts and repeated updates
const g: any = (window as any)
if (g.__gvn_sw_update_prompt_shown == null) g.__gvn_sw_update_prompt_shown = false
if (g.__gvn_sw_update_in_progress == null) g.__gvn_sw_update_in_progress = false
if (g.__gvn_sw_controllerchange_bound == null) g.__gvn_sw_controllerchange_bound = false

// Register PWA and show a toast when a new version is available
const updateSW = registerSW({
  onNeedRefresh() {
    // CRITICAL: Prevent update loops during development
    if (import.meta.env.DEV) {
      console.log('🔧 DEV mode: skipping SW update prompt to prevent reload loops')
      return
    }
    
    // Rate-limit prompts across reloads (increased from 15s to 5 minutes)
    try {
      const last = Number(localStorage.getItem('gvn_last_update_prompt') || '0')
      const now = Date.now()
      if (now - last < 300000) { // 5 minutes
        console.log('⏭️ Skipping update prompt (too soon since last prompt)')
        return
      }
      localStorage.setItem('gvn_last_update_prompt', String(now))
    } catch {}
    
    if (g.__gvn_sw_update_prompt_shown) {
      console.log('⏭️ Skipping update prompt (already shown in this session)')
      return
    }
    
    g.__gvn_sw_update_prompt_shown = true
    console.log('🔔 Showing update prompt')
    
    // Visible toast
    showToast('Nuova versione disponibile', {
      action: {
        label: 'Aggiorna',
        onClick: () => {
          if (g.__gvn_sw_update_in_progress) {
            console.log('⏭️ Update already in progress')
            return
          }
          g.__gvn_sw_update_in_progress = true
          console.log('🔄 Starting update...')
          
          if (!g.__gvn_sw_controllerchange_bound && 'serviceWorker' in navigator) {
            try {
              navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (g.__gvn_sw_controllerchange_bound === true) return
                g.__gvn_sw_controllerchange_bound = true
                console.log('✅ New SW activated, reloading in 200ms...')
                setTimeout(() => { try { location.reload() } catch {} }, 200)
              }, { once: true } as any)
            } catch (e) {
              console.error('❌ Failed to bind controllerchange:', e)
            }
          }
          try { 
            updateSW(true)
            console.log('✅ SW update triggered')
          } catch (e) {
            console.error('❌ Failed to trigger SW update:', e)
          }
        },
      },
    })
  },
  onOfflineReady() {
    console.log('✅ App ready for offline use')
    showToast('App disponibile offline')
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
