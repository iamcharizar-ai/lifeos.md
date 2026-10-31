import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/silkscreen/latin-400.css'
import '@fontsource/silkscreen/latin-700.css'
import '@fontsource/lilita-one/latin-400.css'
import '@fontsource/big-shoulders-display/latin-700'
import '@fontsource/big-shoulders-display/latin-900'
// self-hosted, not Google Fonts: no render-blocking hop to two more origins, and the service worker can keep them for offline starts
import '@fontsource-variable/outfit/index.css'
import '@fontsource-variable/space-grotesk/index.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: installable on phone once deployed (prod only — SW caching fights HMR in dev)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed; carrying on without offline support', err)))
}
