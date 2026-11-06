import { useLiveQuery } from 'dexie-react-hooks'
import { db, getAjuste, vivo } from '../db/db'
import type { Categoria, MetodoPago, Movimiento, Persona } from '../db/types'

export interface Datos {
  movimientos: Movimiento[]
  personas: Persona[]
  metodos: MetodoPago[]
  categorias: Categoria[]
  yo: Persona | undefined
  multimoneda: boolean
  /** Lista de compras compartida a la que está unido este teléfono. */
  listaId: string | null
}

/** Todos los datos vivos (no borrados), reactivos. Para uso personal el volumen es chico. */
export function useDatos(): Datos | undefined {
  return useLiveQuery(async () => {
    const [movimientos, personas, metodos, categorias, multimoneda, listaId] = await Promise.all([
      db.movimientos.toArray(),
      db.personas.toArray(),
      db.metodosPago.toArray(),
      db.categorias.toArray(),
      getAjuste('multimoneda', false),
      getAjuste<string | null>('listaId', null),
    ])
    const ps = personas.filter(vivo)
    return {
      movimientos: movimientos.filter(vivo),
      personas: ps,
      metodos: metodos.filter(vivo).sort((a, b) => a.creadoEn - b.creadoEn),
      categorias: categorias.filter(vivo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      yo: ps.find((p) => p.esYo),
      multimoneda,
      listaId,
    }
  })
}
