import { normalizar } from '../db/db'
import type { Id, Movimiento } from '../db/types'
import { tieneEtiqueta } from './etiquetas'

/** Hasta dónde busca la lupa de Movimientos: el mes que se ve, o hacia atrás desde hoy. */
export type Periodo = 'mes' | '3m' | '12m' | 'todo'
export const PERIODOS: { id: Periodo; etiqueta: string; texto: string }[] = [
  { id: 'mes', etiqueta: 'Este mes', texto: 'en el mes' },
  { id: '3m', etiqueta: '3 meses', texto: 'en los últimos 3 meses' },
  { id: '12m', etiqueta: 'Un año', texto: 'en el último año' },
  { id: 'todo', etiqueta: 'Todo', texto: 'en todo' },
]

export interface FiltrosMov {
  texto: string
  tipo: 'gasto' | 'ingreso' | null
  categoriaId: Id | null
  /** Solo gastos que pagó otra persona. */
  pagoOtro: boolean
  etiqueta: string | null
  /** Con algún filtro, dónde busca (por defecto, el último año). Solo, no cuenta como filtro. */
  periodo: Periodo
}

export const SIN_FILTROS_MOV: FiltrosMov = { texto: '', tipo: null, categoriaId: null, pagoOtro: false, etiqueta: null, periodo: '12m' }

/** Si un mes (claveMes) entra en el período: "Este mes" es el que se ve; los otros cuentan desde hoy (y lo que viene, como las facturas). */
export function enPeriodo(mesMov: number, periodo: Periodo, mesVisto: number, mesHoy: number): boolean {
  if (periodo === 'mes') return mesMov === mesVisto
  if (periodo === '3m') return mesMov > mesHoy - 3
  if (periodo === '12m') return mesMov > mesHoy - 12
  return true
}

export const hayFiltrosMov = (f: FiltrosMov) =>
  f.texto !== '' || f.tipo !== null || f.categoriaId !== null || f.pagoOtro || f.etiqueta !== null

/** Texto en producto, marca, comentario, lugar y etiquetas; más los filtros por chip. */
export function filtrarMovs(movs: Movimiento[], f: FiltrosMov, yoId: Id | undefined): Movimiento[] {
  const q = normalizar(f.texto)
  return movs.filter(
    (m) =>
      (!q || normalizar(`${m.descripcion} ${m.marca ?? ''} ${m.comentario ?? ''} ${m.lugar ?? ''} ${(m.etiquetas ?? []).join(' ')}`).includes(q)) &&
      (f.etiqueta === null || tieneEtiqueta(m, f.etiqueta)) &&
      (f.tipo === null || m.tipo === f.tipo) &&
      (f.categoriaId === null || m.categoriaId === f.categoriaId) &&
      (!f.pagoOtro || (m.tipo === 'gasto' && !!m.pagadorId && m.pagadorId !== yoId)),
  )
}
