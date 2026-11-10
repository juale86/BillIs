import { useLiveQuery } from 'dexie-react-hooks'
import { db, getAjuste, vivo } from '../db/db'
import { CLAVE_GRUPOS, gruposDesde, type Grupo } from './grupos'
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
  /** Grupo elegido a mano para cada producto de la lista (nombre normalizado → grupo). */
  gruposAprendidos: Record<string, string>
  /** Con quiénes compartís la lista actual (sus nombres), para elegir pagador. */
  miembrosLista: string[]
  /** Grupos de la lista de compras de este teléfono, en orden. */
  grupos: Grupo[]
}

/** Todos los datos vivos (no borrados), reactivos. Para uso personal el volumen es chico. */
export function useDatos(): Datos | undefined {
  return useLiveQuery(async () => {
    const [movimientos, personas, metodos, categorias, multimoneda, listaId, gruposAprendidos, miembrosLista, grupos] = await Promise.all([
      db.movimientos.toArray(),
      db.personas.toArray(),
      db.metodosPago.toArray(),
      db.categorias.toArray(),
      getAjuste('multimoneda', false),
      getAjuste<string | null>('listaId', null),
      getAjuste<Record<string, string>>('gruposLista', {}),
      getAjuste<string[]>('miembrosLista', []),
      getAjuste<Grupo[] | null>(CLAVE_GRUPOS, null),
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
      gruposAprendidos,
      miembrosLista,
      grupos: gruposDesde(grupos),
    }
  })
}
