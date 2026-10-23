import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isTauri } from './lib/tauri'

// No shell desktop (Tauri) aplicamos a trava de app nativo (sem scroll/seleção).
// Na web/mobile deixamos o comportamento padrão do navegador para rolagem e PWA.
if (isTauri) {
  document.documentElement.classList.add('is-desktop')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
