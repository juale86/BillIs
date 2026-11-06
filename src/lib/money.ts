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
