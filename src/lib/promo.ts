import type { Parte, Promo } from '../db/types'

/** Total a pagar en centavos aplicando la promo. */
export function totalConPromo(precioUnitCent: number, cantidad: number, promo?: Promo): number {
  const bruto = precioUnitCent * cantidad
  if (!promo) return bruto
  switch (promo.tipo) {
    case 'nxm': {
      if (promo.lleva <= 0 || promo.paga < 0) return bruto
      const grupos = Math.floor(cantidad / promo.lleva)
      const resto = cantidad % promo.lleva
      return (grupos * promo.paga + resto) * precioUnitCent
    }
    case 'nesima': {
      if (promo.n <= 0) return bruto
      const grupos = Math.floor(cantidad / promo.n)
      return Math.round(bruto - grupos * precioUnitCent * (promo.pct / 100))
    }
    case 'pct':
      return Math.round(bruto * (1 - promo.pct / 100))
    case 'manual':
      return promo.totalCent
  }
}

export function describirPromo(p: Promo): string {
  switch (p.tipo) {
    case 'nxm':
      return `${p.lleva}x${p.paga}`
    case 'nesima':
      return `${p.n}ª al ${p.pct}%`
    case 'pct':
      return `${p.pct}% off`
    case 'manual':
      return 'Promo'
  }
}

/** Cantidad mínima que tiene sentido para la promo (ej. 3x2 → 3). */
export function cantidadSugerida(p: Promo): number {
  if (p.tipo === 'nxm') return p.lleva
  if (p.tipo === 'nesima') return p.n
  return 1
}

export function miParte(totalCent: number, parte: Parte): number {
  switch (parte.modo) {
    case 'todo':
      return totalCent
    case 'mitad':
      return Math.round(totalCent / 2)
    case 'nada':
      return 0
    case 'pct':
      return Math.round((totalCent * (parte.pct ?? 100)) / 100)
  }
}
