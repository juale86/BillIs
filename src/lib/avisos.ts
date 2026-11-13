/**
 * El aviso de abajo (con Deshacer, o en rojo si es un error), para llamar desde cualquier pantalla.
 * Lo muestra App, que se registra al arrancar. Reemplaza a `alert()`, que frenaba la pantalla
 * (y las pruebas automáticas) hasta que alguien lo cerraba.
 */

export interface Aviso {
  texto: string
  deshacer?: () => void
  /** Algo salió mal: se ve en rojo, dura más y se cierra tocándolo. */
  error?: boolean
}

let mostrar: ((a: Aviso) => void) | null = null

/** Para App: quién muestra los avisos (null al desmontarse). */
export function registrarAvisos(f: ((a: Aviso) => void) | null) {
  mostrar = f
}

export function avisar(texto: string, deshacer?: () => void) {
  mostrar?.({ texto, deshacer })
}

export function avisarError(texto: string) {
  mostrar?.({ texto, error: true })
}

/**
 * Para los menús de listas y secciones: corre la operación y avisa si salió bien
 * (con el texto `ok`, si hay) o que falló la conexión.
 */
export const accion = (p: Promise<unknown>, ok?: string) =>
  p.then(() => ok && avisar(ok)).catch(() => avisarError('No se pudo completar. Revisá la conexión.'))
