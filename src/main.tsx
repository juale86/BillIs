import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Texto en Barlow; montos en Barlow semicondensada.
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import '@fontsource/barlow-semi-condensed/600.css'
import '@fontsource/barlow-semi-condensed/700.css'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary, vigilarConexionDB } from './components/ErrorBoundary'
import { aplicarTema, leerTema } from './lib/tema'

aplicarTema(leerTema())
// En "Automático", si el teléfono pasa a claro u oscuro con la app abierta, las barras del sistema siguen al fondo.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema(leerTema()))
vigilarConexionDB()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
