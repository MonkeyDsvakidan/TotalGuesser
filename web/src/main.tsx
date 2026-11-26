import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-500.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/bungee/latin-400.css'
import './index.css'
import { loadAbendScript } from './game/abend'

// Abend-Rangliste (GameMaster): /abend.js zuerst laden, damit die Namen des Abends im Setup bereitstehen
loadAbendScript().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
