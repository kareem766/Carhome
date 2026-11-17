import React from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import NotificationOnboardingPrompt from './components/NotificationOnboardingPrompt'
import './index.css'
import './company-cards.css'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <>
      <App />
      <NotificationOnboardingPrompt />
    </>
  </React.StrictMode>
)