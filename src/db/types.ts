export type Id = string

/** Campos comunes a todo registro sincronizable. */
export interface Base {
  id: Id
  creadoEn: number
  modificadoEn: number
  /** Borrado lógico: si tiene valor, el registro está borrado. */
  borradoEn?: number | null
}

export type Moneda = 'ARS' | 'USD'
export const MONEDAS: Moneda[] = ['ARS', 'USD']

/** Promociones. Para agregar una nueva: sumar una variante acá y su cálculo en lib/promo.ts. */
export type Promo =
  | { tipo: 'nxm'; lleva: number; paga: number }
  | { tipo: 'nesima'; n: number; pct: number }
  | { tipo: 'pct'; pct: number }
  | { tipo: 'manual'; totalCent: number }

export type ModoParte = 'todo' | 'mitad' | 'nada' | 'pct'
export interface Parte {
  modo: ModoParte
  /** Solo si modo === 'pct' (0–100). */
  pct?: number
}

export interface Cuotas {
  cantidad: number
  /** Total sin interés (precio × cantidad con promo), si difiere del financiado. */
  precioContadoCent?: number
}

export type TipoMovimiento = 'gasto' | 'ingreso' | 'pagoDeuda'

export interface Movimiento extends Base {
  tipo: TipoMovimiento
  descripcion: string
  descripcionNorm: string
  marca?: string
  categoriaId?: Id
  cantidad: number
  /** Gasto: precio unitario. Ingreso / pagoDeuda: monto. */
  precioUnitCent: number
  promo?: Promo
  /** Lo que efectivamente salió/entró (con promo e interés de cuotas). */
  totalCent: number
  moneda: Moneda
  fecha: number
  /** Gasto: lugar de compra. Ingreso: origen. */
  lugar?: string
  /** Gasto: método de pago. Ingreso: medio de cobro. */
  metodoPagoId?: Id
  /** Gasto / pagoDeuda: quién pagó. */
  pagadorId?: Id
  /** Gasto: con quién se comparte si pagaste vos. pagoDeuda: quién recibió. */
  contraparteId?: Id
  parte?: Parte
  /** Gasto: tu parte del total, en centavos. */
  miParteCent?: number
  cuotas?: Cuotas
  /** Agrupa los gastos de una misma compra (mismo lugar, hasta "Pagar"). */
  compraId?: Id
  /** Ítem de lista de compras que se compró con este gasto. */
  listaItem?: { listaId: string; itemId: string }
}

export interface Persona extends Base {
  nombre: string
  esYo: boolean
}

export interface MetodoPago extends Base {
  nombre: string
  /** Previsto para calcular en qué resumen cae cada cuota. Sin uso en v1. */
  diaCierre?: number
}

export interface Categoria extends Base {
  nombre: string
  tipo: 'gasto' | 'ingreso'
}

export interface Ajuste {
  clave: string
  valor: unknown
}
