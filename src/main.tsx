import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes.css'
import App from './App.tsx'
import { IntroGate } from './components/Intro.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <IntroGate />
  </StrictMode>,
)
