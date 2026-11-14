import type { Moneda } from '../db/types'

const formatos = new Map<Moneda, Intl.NumberFormat>()

export function fmt(cent: number, moneda: Moneda = 'ARS'): string {
  let f = formatos.get(moneda)
  if (!f) {
    f = new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda, minimumFractionDigits: 2 })
    formatos.set(moneda, f)
  }
  return f.format(cent / 100)
}

/**
 * Convierte texto a centavos. Acepta "1500", "1.500", "1.234,56", "1234.5", "1234,5".
 * Devuelve null si no es un número válido.
 */
export function parseMonto(texto: string): number | null {
  let s = texto.replace(/[\s$]/g, '').replace(/^US/, '')
  if (!s) return null
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    const puntos = s.split('.').length - 1
    if (puntos > 1 || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '')
  }
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

/** Centavos a texto editable en un input ("1234,5" → "1234,50"). */
export function montoAInput(cent: number): string {
  const entero = Math.trunc(cent / 100)
  const dec = Math.abs(cent % 100)
  return dec === 0 ? String(entero) : `${entero},${String(dec).padStart(2, '0')}`
}

/**
 * Un monto mientras se escribe, con puntos de miles: "1250000" → "1.250.000", "1250000,5" → "1.250.000,5".
 * La coma es el decimal (hasta dos cifras). Un punto escrito al final también cuenta como coma,
 * porque los puntos de miles los pone esta función. Lo devuelto lo sigue entendiendo parseMonto.
 */
export function conMiles(texto: string): string {
  let s = texto.replace(/[^\d.,]/g, '')
  if (s.endsWith('.') && !s.includes(',')) s = s.slice(0, -1) + ','
  const coma = s.indexOf(',')
  const entero = (coma < 0 ? s : s.slice(0, coma)).replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  if (coma < 0) return miles
  return (miles || '0') + ',' + s.slice(coma + 1).replace(/\D/g, '').slice(0, 2)
}
