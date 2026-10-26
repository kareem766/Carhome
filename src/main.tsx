import React from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import NavigationLoader from './components/NavigationLoader'
import './index.css'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <>
      <App />
      <NavigationLoader />
    </>
  </React.StrictMode>
)