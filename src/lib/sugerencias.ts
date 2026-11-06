import { normalizar } from '../db/db'
import type { Id, Movimiento } from '../db/types'

/** Valores más frecuentes (y recientes, como desempate) de un campo de texto. */
function ranking(movs: Movimiento[], campo: (m: Movimiento) => string | undefined, limite: number): string[] {
  const conteo = new Map<string, { texto: string; n: number; ultima: number }>()
  for (const m of movs) {
    const v = campo(m)?.trim()
    if (!v) continue
    const k = normalizar(v)
    const c = conteo.get(k)
    if (c) {
      c.n++
      if (m.fecha > c.ultima) {
        c.ultima = m.fecha
        c.texto = v
      }
    } else conteo.set(k, { texto: v, n: 1, ultima: m.fecha })
  }
  return [...conteo.values()]
    .sort((a, b) => b.n - a.n || b.ultima - a.ultima)
    .slice(0, limite)
    .map((c) => c.texto)
}

export function sugerirDescripciones(movs: Movimiento[], tipo: 'gasto' | 'ingreso', texto: string): string[] {
  const q = normalizar(texto)
  if (!q) return []
  const delTipo = movs.filter((m) => m.tipo === tipo)
  return ranking(delTipo, (m) => m.descripcion, 200)
    .filter((d) => {
      const n = normalizar(d)
      return n !== q && n.includes(q)
    })
    .sort((a, b) => Number(!normalizar(b).startsWith(q)) - Number(!normalizar(a).startsWith(q)))
    .slice(0, 6)
}

export const sugerirLugares = (movs: Movimiento[], tipo: 'gasto' | 'ingreso') =>
  ranking(movs.filter((m) => m.tipo === tipo), (m) => m.lugar, 5)

export function sugerirMarcas(movs: Movimiento[], descripcion: string): string[] {
  const d = normalizar(descripcion)
  if (!d) return []
  return ranking(movs.filter((m) => m.tipo === 'gasto' && m.descripcionNorm === d), (m) => m.marca, 6)
}

/**
 * Último precio unitario pagado por un producto.
 * Prioridad: producto+marca+lugar → producto+marca → producto+lugar → producto.
 */
export function ultimoPrecio(
  movs: Movimiento[],
  descripcion: string,
  marca: string,
  lugar: string,
): { cent: number; moneda: Movimiento['moneda'] } | null {
  const d = normalizar(descripcion)
  const ma = normalizar(marca)
  const lu = normalizar(lugar)
  const candidatos = movs
    .filter((m) => m.tipo === 'gasto' && m.descripcionNorm === d)
    .sort((a, b) => b.fecha - a.fecha)
  if (!candidatos.length) return null
  const igual = (a: string | undefined, b: string) => normalizar(a ?? '') === b
  const filtros: ((m: Movimiento) => boolean)[] = []
  if (ma && lu) filtros.push((m) => igual(m.marca, ma) && igual(m.lugar, lu))
  if (ma) filtros.push((m) => igual(m.marca, ma))
  if (lu) filtros.push((m) => igual(m.lugar, lu))
  filtros.push(() => true)
  for (const f of filtros) {
    const m = candidatos.find(f)
    if (m) return { cent: m.precioUnitCent, moneda: m.moneda }
  }
  return null
}

/** Categoría por producto y, si no hay, por lugar. */
export function sugerirCategoria(
  movs: Movimiento[],
  tipo: 'gasto' | 'ingreso',
  descripcion: string,
  lugar: string,
): Id | undefined {
  const delTipo = movs.filter((m) => m.tipo === tipo && m.categoriaId).sort((a, b) => b.fecha - a.fecha)
  const d = normalizar(descripcion)
  const porDesc = d && delTipo.find((m) => m.descripcionNorm === d)
  if (porDesc) return porDesc.categoriaId
  const lu = normalizar(lugar)
  const porLugar = lu && delTipo.find((m) => normalizar(m.lugar ?? '') === lu)
  return porLugar ? porLugar.categoriaId : undefined
}
