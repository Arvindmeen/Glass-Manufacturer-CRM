import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initVault } from './lib/keyVault'
import { initDB } from './store/db'
import { getSettings } from './store/settings'

document.documentElement.lang = getSettings().lang

// Load saved data and decrypt the stored API key before the first render.
void Promise.all([initDB(), initVault()]).then(() =>
  createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
))
