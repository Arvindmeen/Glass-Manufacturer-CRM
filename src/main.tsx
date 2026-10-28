import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { initVault } from './lib/keyVault'
import { getSettings } from './store/settings'

document.documentElement.lang = getSettings().lang

// Decrypt the stored API key before the first render, so AI buttons know whether a key exists.
void initVault().then(() =>
  createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
))
