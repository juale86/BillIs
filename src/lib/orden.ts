/** Órdenes de una lista de ítems: la de compras y cada compra de Movimientos. */
export type OrdenLista = 'manual' | 'alfabetico' | 'grupos'

export const OPCIONES_ORDEN: { id: OrdenLista; etiqueta: string; detalle: string }[] = [
  { id: 'manual', etiqueta: 'Manual', detalle: 'lo último agregado primero; arrastrá ≡ para mover' },
  { id: 'alfabetico', etiqueta: 'Alfabético', detalle: 'de la A a la Z' },
  { id: 'grupos', etiqueta: 'Por grupos', detalle: 'en el orden del súper' },
]
