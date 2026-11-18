import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'
import './styles/doc.css'
import './styles/editor.css'
import './styles/overlay.css'

if (import.meta.env.DEV && !('talkflow' in window)) await import('./dev/mock')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
