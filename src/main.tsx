import React from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import NavigationLoader from './components/NavigationLoader'
import AppErrorBoundary from './components/AppErrorBoundary'
import ConnectivityStatus from './components/ConnectivityStatus'
import './index.css'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
      <NavigationLoader />
      <ConnectivityStatus />
    </AppErrorBoundary>
  </React.StrictMode>
)