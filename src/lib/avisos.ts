/**
 * Errores para el usuario sin `alert()`: el alert nativo frena la pantalla (y las pruebas
 * automáticas) hasta que alguien lo cierra. Esto lo muestra App en el aviso de abajo, en rojo.
 */

/** Lo que se dice cuando falla algo compartido (listas, secciones, miembros). */
const SIN_CONEXION = 'No se pudo completar. Revisá la conexión.'

let mostrar: ((texto: string) => void) | null = null

/** Para App: quién muestra los errores (null al desmontarse). */
export function registrarErrores(f: ((texto: string) => void) | null) {
  mostrar = f
}

export function avisarError(texto: string) {
  mostrar?.(texto)
}

/**
 * Para los menús de listas y secciones: corre la operación y avisa si salió bien
 * (con el texto `ok`, si hay) o que falló la conexión.
 */
export const accionConAviso =
  (onAviso: (texto: string) => void) =>
  (p: Promise<unknown>, ok?: string) =>
    p.then(() => ok && onAviso(ok)).catch(() => avisarError(SIN_CONEXION))

export type Accion = ReturnType<typeof accionConAviso>
