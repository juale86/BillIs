import { Component, type ReactNode } from 'react'

const CLAVE_RECARGA = 'billis.recargaPorError'

/**
 * iOS (sobre todo la app instalada) corta la conexión a IndexedDB cuando la app queda
 * en segundo plano; al volver, toda consulta falla. Se arregla recargando.
 */
const esConexionPerdida = (e: unknown) =>
  /Indexed Database server lost|DatabaseClosed|Connection is closing/i.test(
    `${(e as Error)?.name} ${(e as Error)?.message}`,
  )

/** Recarga una sola vez por minuto, para no entrar en un bucle si el error persiste. */
function recargarUnaVez(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE_RECARGA) ?? 0)
    if (Date.now() - ultima < 60_000) return false
    sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()))
  } catch {
    /* sin almacenamiento: se recarga igual */
  }
  location.reload()
  return true
}

/** Si la base se desconecta fuera del render (ej. al guardar), también se recarga. */
export function vigilarConexionDB() {
  const revisar = (e: unknown) => {
    if (esConexionPerdida(e)) recargarUnaVez()
  }
  addEventListener('unhandledrejection', (ev) => revisar(ev.reason))
  addEventListener('error', (ev) => revisar(ev.error))
}

/** Sin esto, un error al dibujar desmonta toda la app y queda la pantalla vacía (negra en tema oscuro). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
    if (esConexionPerdida(error)) recargarUnaVez()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="bienvenida">
        <h1>BillIs</h1>
        <p>Algo falló al mostrar la pantalla. Tus datos siguen guardados en el teléfono.</p>
        <p className="nota">
          {error.name}: {error.message}
        </p>
        <button className="primario" onClick={() => location.reload()}>
          Recargar
        </button>
      </div>
    )
  }
}
