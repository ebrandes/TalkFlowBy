import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/tokens.css'
import '../styles/base.css'
import '../styles/widget.css'
import { WidgetApp } from './WidgetApp'

if (import.meta.env.DEV && !('talkflow' in window)) await import('../dev/mock')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WidgetApp />
  </StrictMode>
)
