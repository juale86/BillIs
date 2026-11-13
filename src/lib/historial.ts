import { db, normalizar, nuevoBase } from '../db/db'
import type { Categoria, GastoCargado, Historial, Movimiento } from '../db/types'
import { amPm } from './hora'
import type { ItemLista } from './listaCompras'
import { fmt } from './money'
import { describirPromo, miParte } from './promo'

/**
 * Historial de un movimiento: quién lo cargó, lo que se cargó primero y el último cambio.
 * Sirve para tus propias ediciones y para las correcciones del dueño de una lista a lo que compraste.
 */

/** Los datos de un movimiento como se compararían con otra versión. */
export function cargaDe(m: Movimiento, categorias: Categoria[]): GastoCargado {
  return {
    descripcion: m.descripcion,
    marca: m.marca ?? null,
    cantidad: m.cantidad,
    precioUnitCent: m.precioUnitCent,
    promo: m.promo ?? null,
    totalCent: m.totalCent,
    moneda: m.moneda,
    fecha: m.fecha,
    lugar: m.lugar ?? null,
    comentario: m.comentario ?? null,
    categoria: categorias.find((c) => c.id === m.categoriaId)?.nombre ?? null,
    cargadoEn: m.creadoEn,
  }
}

/** Lo que tiene cargado un ítem comprado. Los comprados antes de 1.20 solo tienen nombre, cantidad y monto. */
export function cargaDeItem(it: ItemLista): GastoCargado {
  if (it.gasto) return it.gasto
  const cant = /^\d+$/.test(it.cantidad ?? '') ? Math.max(1, Number(it.cantidad)) : 1
  const total = it.montoCent ?? 0
  return {
    descripcion: it.nombre,
    marca: it.marca,
    cantidad: cant,
    precioUnitCent: Math.round(total / cant),
    promo: null,
    totalCent: total,
    moneda: it.moneda ?? 'ARS',
    fecha: it.modificadoEn,
    lugar: null,
    comentario: null,
    categoria: null,
    cargadoEn: it.modificadoEn,
  }
}

export type CampoCarga = Exclude<keyof GastoCargado, 'cargadoEn'>

export const ETIQUETA_CAMPO: Record<CampoCarga, string> = {
  descripcion: 'Producto',
  marca: 'Marca',
  cantidad: 'Cantidad',
  precioUnitCent: 'Precio',
  moneda: 'Moneda',
  promo: 'Promo',
  totalCent: 'Total',
  fecha: 'Fecha',
  categoria: 'Categoría',
  lugar: 'Lugar',
  comentario: 'Comentario',
}

const CAMPOS = Object.keys(ETIQUETA_CAMPO) as CampoCarga[]

/** "vie 13/11, 6:02pm" */
export function fmtFechaHora(t: number): string {
  const d = new Date(t)
  const dia = d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')
  const hora = amPm(d.toLocaleTimeString('es-AR', { hour: 'numeric', minute: '2-digit' }))
  return `${dia} ${d.getDate()}/${d.getMonth() + 1}, ${hora}`
}

/** Cómo se lee el valor de un campo ("sin marca", "$ 1.890,00"). */
export function textoCampo(c: CampoCarga, g: GastoCargado): string {
  switch (c) {
    case 'descripcion':
      return g.descripcion
    case 'marca':
      return g.marca ?? 'sin marca'
    case 'cantidad':
      return String(g.cantidad)
    case 'precioUnitCent':
      return g.precioUnitCent ? fmt(g.precioUnitCent, g.moneda) : 'sin precio'
    case 'moneda':
      return g.moneda
    case 'promo':
      return g.promo ? describirPromo(g.promo) : 'sin promo'
    case 'totalCent':
      return fmt(g.totalCent, g.moneda)
    case 'fecha':
      return fmtFechaHora(g.fecha)
    case 'categoria':
      return g.categoria ?? 'sin categoría'
    case 'lugar':
      return g.lugar ?? 'sin lugar'
    case 'comentario':
      return g.comentario ? `“${g.comentario}”` : 'sin comentario'
  }
}

function igual(c: CampoCarga, a: GastoCargado, b: GastoCargado): boolean {
  switch (c) {
    case 'promo':
      return JSON.stringify(a.promo) === JSON.stringify(b.promo)
    case 'fecha':
      // El campo de fecha tiene precisión de minutos.
      return Math.floor(a.fecha / 60000) === Math.floor(b.fecha / 60000)
    case 'marca':
    case 'lugar':
    case 'comentario':
    case 'categoria':
    case 'descripcion':
      return (a[c] ?? '').trim() === (b[c] ?? '').trim()
    default:
      return a[c] === b[c]
  }
}

/**
 * Los campos que cambiaron de una versión a otra, en el orden del formulario.
 * El total solo se cuenta si no lo explica un cambio de precio, cantidad o promo.
 */
export function cambios(antes: GastoCargado, ahora: GastoCargado): CampoCarga[] {
  const distintos = CAMPOS.filter((c) => !igual(c, antes, ahora))
  const explicado = distintos.some((c) => c === 'precioUnitCent' || c === 'cantidad' || c === 'promo')
  return explicado ? distintos.filter((c) => c !== 'totalCent') : distintos
}

/** El historial después de editar un movimiento propio: guarda lo primero que se cargó y quién lo cambió. */
export function historialAlEditar(
  antes: Movimiento,
  despues: Movimiento,
  quien: string,
  categorias: Categoria[],
): Historial | undefined {
  const previa = cargaDe(antes, categorias)
  if (cambios(previa, cargaDe(despues, categorias)).length === 0) return antes.historial
  return { original: antes.historial?.original ?? previa, editadoPor: quien, editadoEn: Date.now() }
}

/**
 * Aplica a tu gasto la corrección que hizo el dueño de la lista sobre lo que compraste.
 * La categoría viaja por nombre: si no la tenés, se crea.
 */
export async function aplicarCorreccion(m: Movimiento, it: ItemLista, categorias: Categoria[]) {
  const g = it.gasto
  if (!g || !it.corregidoEn || !m.listaItem) return
  let categoriaId = m.categoriaId
  if (g.categoria) {
    const n = normalizar(g.categoria)
    const existente = categorias.find((c) => c.tipo === 'gasto' && normalizar(c.nombre) === n)
    if (existente) categoriaId = existente.id
    else {
      const nueva = { ...nuevoBase(), nombre: g.categoria, tipo: 'gasto' as const }
      await db.categorias.add(nueva)
      categoriaId = nueva.id
    }
  }
  const parte = m.parte ?? { modo: 'todo' as const }
  await db.movimientos.update(m.id, {
    descripcion: g.descripcion,
    descripcionNorm: normalizar(g.descripcion),
    marca: g.marca ?? undefined,
    cantidad: g.cantidad,
    precioUnitCent: g.precioUnitCent,
    promo: g.promo ?? undefined,
    totalCent: g.totalCent,
    moneda: g.moneda,
    fecha: g.fecha,
    lugar: g.lugar ?? undefined,
    comentario: g.comentario ?? undefined,
    categoriaId,
    miParteCent: miParte(g.totalCent, parte),
    // Las cuotas se mantienen; el interés se pierde porque cambió el precio de contado.
    cuotas: m.cuotas && { cantidad: m.cuotas.cantidad },
    listaItem: { ...m.listaItem, corregidoEn: it.corregidoEn },
    historial: {
      original: m.historial?.original ?? cargaDe(m, categorias),
      editadoPor: it.corregidoPor ?? 'el dueño de la lista',
      editadoEn: it.corregidoEn,
    },
    modificadoEn: Date.now(),
  })
}
