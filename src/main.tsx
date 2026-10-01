import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bootstrapBackend } from '@/services/backend'

// Decide between the real API and the in-browser demo backend before the first render,
// so sign-in state and live data come from the same place from the start.
bootstrapBackend().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
