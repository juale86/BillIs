import type { Id, Moneda, Movimiento } from '../db/types'

/** Índice de mes absoluto (año*12 + mes 0–11). */
export const claveMes = (t: number) => {
  const d = new Date(t)
  return d.getFullYear() * 12 + d.getMonth()
}

export const nombreMes = (clave: number) =>
  new Date(Math.floor(clave / 12), clave % 12, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

/** Lo que te corresponde de un gasto (tu parte, o el total si no hay parte). */
export const parteDe = (m: Movimiento) => m.miParteCent ?? m.totalCent

/** Reparte un monto en n cuotas; el redondeo va a la primera. */
export function repartir(cent: number, n: number): number[] {
  const base = Math.trunc(cent / n)
  const cuotas = Array<number>(n).fill(base)
  cuotas[0] += cent - base * n
  return cuotas
}

/** Imputaciones mensuales de un gasto: [claveMes, monto]. Sin cuotas → una sola. */
export function imputaciones(m: Movimiento): [number, number][] {
  const mes = claveMes(m.fecha)
  const n = m.cuotas?.cantidad ?? 1
  if (n <= 1) return [[mes, parteDe(m)]]
  return repartir(parteDe(m), n).map((c, i) => [mes + i, c])
}

export interface Resumen {
  ingresos: number
  gastos: number
  porCategoria: Map<Id | '', number>
  cuotasPendientes: number
}

export function resumenMes(movs: Movimiento[], mes: number, moneda: Moneda): Resumen {
  const r: Resumen = { ingresos: 0, gastos: 0, porCategoria: new Map(), cuotasPendientes: 0 }
  for (const m of movs) {
    if (m.moneda !== moneda) continue
    if (m.tipo === 'ingreso') {
      if (claveMes(m.fecha) === mes) r.ingresos += m.totalCent
    } else if (m.tipo === 'gasto') {
      for (const [mm, monto] of imputaciones(m)) {
        if (mm === mes) {
          r.gastos += monto
          const k = m.categoriaId ?? ''
          r.porCategoria.set(k, (r.porCategoria.get(k) ?? 0) + monto)
        } else if (mm > mes && claveMes(m.fecha) <= mes) {
          r.cuotasPendientes += monto
        }
      }
    }
  }
  return r
}

/**
 * Saldos por persona y moneda. Positivo = esa persona te debe; negativo = le debés.
 */
export function saldos(movs: Movimiento[], yoId: Id): Map<Id, Map<Moneda, number>> {
  const res = new Map<Id, Map<Moneda, number>>()
  const sumar = (p: Id, mon: Moneda, v: number) => {
    if (!res.has(p)) res.set(p, new Map())
    const mm = res.get(p)!
    mm.set(mon, (mm.get(mon) ?? 0) + v)
  }
  for (const m of movs) {
    if (m.tipo === 'gasto') {
      const pagador = m.pagadorId ?? yoId
      if (pagador === yoId) {
        if (m.contraparteId && m.contraparteId !== yoId) sumar(m.contraparteId, m.moneda, m.totalCent - parteDe(m))
      } else {
        sumar(pagador, m.moneda, -parteDe(m))
      }
    } else if (m.tipo === 'pagoDeuda') {
      // Vos le pagás a alguien: tu deuda baja (saldo sube). Alguien te paga: lo que te debe baja.
      if (m.pagadorId === yoId && m.contraparteId) sumar(m.contraparteId, m.moneda, m.totalCent)
      else if (m.pagadorId) sumar(m.pagadorId, m.moneda, -m.totalCent)
    }
  }
  return res
}
