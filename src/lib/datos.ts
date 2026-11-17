import { useLiveQuery } from 'dexie-react-hooks'
import { db, getAjuste, vivo } from '../db/db'
import { CLAVE_COTIZACIONES, cotizacionesDesde, type Cotizaciones } from './conversor'
import { CLAVE_GRUPOS, gruposDesde, type Grupo } from './grupos'
import { CLAVE_ETIQUETAS, CLAVE_FIJA, todasEtiquetas } from './etiquetas'
import { porTipo } from './metodos'
import type { Categoria, MetodoPago, Moneda, Movimiento, Persona } from '../db/types'

export interface Datos {
  movimientos: Movimiento[]
  personas: Persona[]
  metodos: MetodoPago[]
  categorias: Categoria[]
  yo: Persona | undefined
  multimoneda: boolean
  /** Las monedas para cargar: pesos y, con "Usar otras monedas", las elegidas en Ajustes. */
  monedas: Moneda[]
  /** Todas las etiquetas (creadas en Ajustes o usadas), en orden alfabético. */
  etiquetas: string[]
  /** La que se pone sola en cada gasto nuevo (ej. durante un viaje). */
  etiquetaFija: string | null
  /** Lista de compras compartida a la que está unido este teléfono. */
  listaId: string | null
  /** Grupo elegido a mano para cada producto de la lista (nombre normalizado → grupo). */
  gruposAprendidos: Record<string, string>
  /** Con quiénes compartís la lista actual (sus nombres), para elegir pagador. */
  miembrosLista: string[]
  /** Grupos de la lista de compras de este teléfono, en orden. */
  grupos: Grupo[]
  /** Sección de tareas elegida ('todo' o el id de una sección). */
  tareasSeccion: string
  /** Orden de las secciones de tareas en la barra (ids); las que faltan van al final. */
  ordenSecciones: string[]
  /** Para el conversor de la calculadora: cuántos dólares vale cada moneda. */
  cotizaciones: Cotizaciones
  /** Presupuesto mensual en pesos por categoría (centavos). */
  presupuestos: Record<string, number>
}

/** Todos los datos vivos (no borrados), reactivos. Para uso personal el volumen es chico. */
export function useDatos(): Datos | undefined {
  return useLiveQuery(async () => {
    const [movimientos, personas, metodos, categorias, multimoneda, listaId, gruposAprendidos, miembrosLista, grupos, tareasSeccion, ordenSecciones, cotizaciones, presupuestos, otrasMonedas, etiquetasGuardadas, etiquetaFija] = await Promise.all([
      db.movimientos.toArray(),
      db.personas.toArray(),
      db.metodosPago.toArray(),
      db.categorias.toArray(),
      getAjuste('multimoneda', false),
      getAjuste<string | null>('listaId', null),
      getAjuste<Record<string, string>>('gruposLista', {}),
      getAjuste<string[]>('miembrosLista', []),
      getAjuste<Grupo[] | null>(CLAVE_GRUPOS, null),
      getAjuste('tareasSeccion', 'todo'),
      getAjuste<string[]>('ordenSecciones', []),
      getAjuste<Cotizaciones | null>(CLAVE_COTIZACIONES, null),
      getAjuste<Record<string, number>>('presupuestos', {}),
      getAjuste<Moneda[]>('monedas', ['USD']),
      getAjuste<string[]>(CLAVE_ETIQUETAS, []),
      getAjuste<string | null>(CLAVE_FIJA, null),
    ])
    const vivos = movimientos.filter(vivo)
    const ps = personas.filter(vivo)
    return {
      movimientos: vivos,
      personas: ps,
      metodos: metodos.filter(vivo).sort(porTipo),
      categorias: categorias.filter(vivo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      yo: ps.find((p) => p.esYo),
      multimoneda,
      monedas: ['ARS', ...(multimoneda ? otrasMonedas.filter((m) => m !== 'ARS') : [])],
      etiquetas: todasEtiquetas(vivos, etiquetasGuardadas),
      etiquetaFija,
      listaId,
      gruposAprendidos,
      miembrosLista,
      grupos: gruposDesde(grupos),
      tareasSeccion,
      ordenSecciones,
      cotizaciones: cotizacionesDesde(cotizaciones),
      presupuestos,
    }
  })
}
