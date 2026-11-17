export type Id = string

/** Campos comunes a todo registro sincronizable. */
export interface Base {
  id: Id
  creadoEn: number
  modificadoEn: number
  /** Borrado lógico: si tiene valor, el registro está borrado. */
  borradoEn?: number | null
}

export type Moneda = 'ARS' | 'USD' | 'BRL'
export const MONEDAS: Moneda[] = ['ARS', 'USD', 'BRL']
/** Las otras monedas que se pueden activar en Ajustes (el peso está siempre). */
export const NOMBRE_MONEDA: Record<Moneda, string> = { ARS: 'Pesos', USD: 'Dólares', BRL: 'Reales' }

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

export interface Ubicacion {
  lat: number
  lon: number
  /** Radio de error en metros. */
  precision: number
}

export type TipoMovimiento = 'gasto' | 'ingreso' | 'pagoDeuda' | 'cambio'

export interface Movimiento extends Base {
  tipo: TipoMovimiento
  descripcion: string
  descripcionNorm: string
  marca?: string
  /** Nota libre del usuario. */
  comentario?: string
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
  /** Gasto: dónde se compró, tomado del GPS. */
  ubicacion?: Ubicacion
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
  /** Ítem de lista de compras que se compró con este gasto. corregidoEn: última corrección del dueño ya aplicada. */
  listaItem?: { listaId: string; itemId: string; corregidoEn?: number }
  /** Lo que se cargó primero y el último cambio, para mostrarlo al editar. */
  historial?: Historial
  /** Factura (gasto): una de las `de` cuotas mensuales que se cargaron juntas; `fecha` es su vencimiento. */
  factura?: { serieId: Id; cuota: number; de: number }
  /** Cambio de moneda: lo que entró. `moneda` y `totalCent` son lo que salió (ej. vendiste US$ 500 → recibiste $ 725.000). */
  cambio?: { moneda: Moneda; totalCent: number }
  /** Factura todavía sin pagar: Pagar la marca como pagada. */
  porPagar?: boolean
  /** Etiquetas libres (ej. "Brasil" para un viaje), para verlas juntas en Resumen y en la búsqueda. */
  etiquetas?: string[]
}

/**
 * Los datos de un movimiento tal como se cargaron, para comparar versiones.
 * La categoría va por nombre: así se entiende en el teléfono de otra persona (listas compartidas).
 */
export interface GastoCargado {
  descripcion: string
  marca: string | null
  cantidad: number
  precioUnitCent: number
  promo: Promo | null
  totalCent: number
  moneda: Moneda
  fecha: number
  lugar: string | null
  comentario: string | null
  categoria: string | null
  /** Cuándo se cargó por primera vez. */
  cargadoEn: number
}

export interface Historial {
  /** Lo que se cargó antes del primer cambio. Los cambios siguientes se comparan siempre contra esto. */
  original: GastoCargado
  /** Quién hizo el último cambio (vos, o el dueño de la lista al corregir lo que compraste). */
  editadoPor: string
  editadoEn: number
}

export interface Persona extends Base {
  nombre: string
  esYo: boolean
}

export type TipoMetodo = 'efectivo' | 'billetera' | 'debito' | 'credito' | 'transferencia'

export interface MetodoPago extends Base {
  nombre: string
  /** Sin dato (los métodos viejos): se deduce del nombre (lib/metodos.ts). */
  tipo?: TipoMetodo
  /** Tarjetas: de quién es (una persona). Sin dato: tuya. */
  titularId?: Id
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
