import { normalizar } from '../db/db'
import type { Id, Movimiento } from '../db/types'

export interface FiltrosMov {
  texto: string
  tipo: 'gasto' | 'ingreso' | null
  categoriaId: Id | null
  /** Solo gastos que pagó otra persona. */
  pagoOtro: boolean
}

export const SIN_FILTROS_MOV: FiltrosMov = { texto: '', tipo: null, categoriaId: null, pagoOtro: false }

export const hayFiltrosMov = (f: FiltrosMov) => f.texto !== '' || f.tipo !== null || f.categoriaId !== null || f.pagoOtro

/** Texto en descripción, marca y lugar; más los filtros por chip. */
export function filtrarMovs(movs: Movimiento[], f: FiltrosMov, yoId: Id | undefined): Movimiento[] {
  const q = normalizar(f.texto)
  return movs.filter(
    (m) =>
      (!q || normalizar(`${m.descripcion} ${m.marca ?? ''} ${m.lugar ?? ''}`).includes(q)) &&
      (f.tipo === null || m.tipo === f.tipo) &&
      (f.categoriaId === null || m.categoriaId === f.categoriaId) &&
      (!f.pagoOtro || (m.tipo === 'gasto' && !!m.pagadorId && m.pagadorId !== yoId)),
  )
}
