import { normalizar } from '../db/db'
import type { Id, MetodoPago, Persona, TipoMetodo } from '../db/types'

export const TIPOS_METODO: { id: TipoMetodo; nombre: string }[] = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'billetera', nombre: 'Billetera' },
  { id: 'debito', nombre: 'Débito' },
  { id: 'credito', nombre: 'Tarjeta de crédito' },
  { id: 'transferencia', nombre: 'Transferencia' },
]

/** El tipo guardado o, en los métodos viejos, el que se deduce del nombre. */
export function tipoDe(m: MetodoPago): TipoMetodo {
  if (m.tipo) return m.tipo
  const n = normalizar(m.nombre)
  if (/credito|visa|master|amex|american|cabal|naranja|tarjeta/.test(n)) return 'credito'
  if (/debito/.test(n)) return 'debito'
  if (/efectivo|cash/.test(n)) return 'efectivo'
  if (/transfer/.test(n)) return 'transferencia'
  return 'billetera'
}

/** Con tarjeta se puede pagar en cuotas. */
export const aceptaCuotas = (m: MetodoPago | undefined) => !!m && tipoDe(m) === 'credito'

/** Las tarjetas son de alguien; el resto, de quien paga. */
export const conTitular = (t: TipoMetodo) => t === 'credito' || t === 'debito'

/** El titular, si es otra persona (no vos). */
export function titularOtro(m: MetodoPago | undefined, personas: Persona[], yoId: Id | undefined): Persona | undefined {
  if (!m?.titularId || m.titularId === yoId || !conTitular(tipoDe(m))) return undefined
  return personas.find((p) => p.id === m.titularId)
}

/** "Visa Galicia (Ana)" si la tarjeta es de otra persona; si no, el nombre. */
export function nombreMetodo(m: MetodoPago, personas: Persona[], yoId: Id | undefined): string {
  const t = titularOtro(m, personas, yoId)
  return t ? `${m.nombre} (${t.nombre})` : m.nombre
}

/** Efectivo, billeteras, débito, crédito y transferencia; dentro de cada tipo, en el orden en que se crearon. */
export const porTipo = (a: MetodoPago, b: MetodoPago) =>
  TIPOS_METODO.findIndex((t) => t.id === tipoDe(a)) - TIPOS_METODO.findIndex((t) => t.id === tipoDe(b)) ||
  a.creadoEn - b.creadoEn ||
  a.nombre.localeCompare(b.nombre, 'es')
