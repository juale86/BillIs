/**
 * Conversor de moneda de la calculadora. Cada cotización dice cuántos dólares vale una unidad
 * de esa moneda (el real, 0,18; el peso, 0,00065), y se convierte pasando por el dólar.
 * Las cotizaciones se cargan a mano en Ajustes.
 */

export interface MonedaConversor {
  codigo: string
  nombre: string
}

export const MONEDAS_CONVERSOR: MonedaConversor[] = [
  { codigo: 'ARS', nombre: 'Peso argentino' },
  { codigo: 'BRL', nombre: 'Real brasileño' },
  { codigo: 'USD', nombre: 'Dólar' },
]

/** Código de moneda → cuántos dólares vale una unidad. */
export type Cotizaciones = Record<string, number>

export const CLAVE_COTIZACIONES = 'cotizaciones'
const COTIZACIONES_INICIALES: Cotizaciones = { ARS: 0.00065, BRL: 0.18, USD: 1 }

/** Las guardadas sobre las iniciales; el dólar siempre vale 1. */
export const cotizacionesDesde = (guardadas: Cotizaciones | null): Cotizaciones => ({
  ...COTIZACIONES_INICIALES,
  ...(guardadas ?? {}),
  USD: 1,
})

/** null si falta la cotización de alguna de las dos monedas. */
export function convertir(monto: number, de: string, a: string, cot: Cotizaciones): number | null {
  const d = cot[de]
  const h = cot[a]
  if (!d || !h) return null
  return de === a ? monto : (monto * d) / h
}

/** Para mostrar un monto convertido: dos decimales, o cuatro cifras si es menor que uno. */
export function redondear(v: number): number {
  if (v !== 0 && Math.abs(v) < 1) return Number(v.toPrecision(4))
  return Math.round(v * 100) / 100
}
