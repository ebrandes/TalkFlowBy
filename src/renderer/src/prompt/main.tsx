import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/tokens.css'
import '../styles/base.css'
import '../styles/prompt.css'
import { PromptApp } from './PromptApp'

if (import.meta.env.DEV && !('talkflow' in window)) await import('../dev/mock')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PromptApp />
  </StrictMode>
)
