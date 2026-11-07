import { uuid } from '../db/db'
import type { Id } from '../db/types'

/**
 * Estado "pegajoso" de la compra en curso (lugar, fecha manual, método de pago).
 * Vence al "Guardar y cerrar" o tras 2 h sin cargar nada.
 * El pagador se recuerda aparte y no vence.
 */
export interface SesionCompra {
  compraId: Id
  lugar: string
  /** Solo si la fecha se cambió a mano. */
  fecha?: number
  metodoPagoId?: Id
  ultimaActividad: number
}

const CLAVE_SESION = 'billis.sesion'
const CLAVE_PAGADOR = 'billis.ultimoPagador'
const VENCE_MS = 2 * 60 * 60 * 1000

function leer<T>(clave: string): T | null {
  try {
    const s = localStorage.getItem(clave)
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null
  }
}

function escribir(clave: string, valor: unknown) {
  try {
    if (valor === null) localStorage.removeItem(clave)
    else localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    /* sin almacenamiento: el formulario arranca vacío, no pasa nada */
  }
}

/** La compra abierta (con al menos un gasto guardado), o null si no hay o venció. */
export function sesionAbierta(): SesionCompra | null {
  const s = leer<SesionCompra>(CLAVE_SESION)
  return s && Date.now() - s.ultimaActividad < VENCE_MS ? s : null
}

/** Devuelve la sesión vigente o una nueva vacía. */
export function sesionActual(): SesionCompra {
  const s = leer<SesionCompra>(CLAVE_SESION)
  if (s && Date.now() - s.ultimaActividad < VENCE_MS) return s
  return { compraId: uuid(), lugar: '', ultimaActividad: Date.now() }
}

export function guardarSesion(s: Omit<SesionCompra, 'ultimaActividad'>) {
  escribir(CLAVE_SESION, { ...s, ultimaActividad: Date.now() })
}

export function cerrarSesion() {
  escribir(CLAVE_SESION, null)
}

export const ultimoPagador = () => leer<string>(CLAVE_PAGADOR)
export const guardarPagador = (nombre: string) => escribir(CLAVE_PAGADOR, nombre)
