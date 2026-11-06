import Dexie, { type EntityTable } from 'dexie'
import type { Ajuste, Base, Categoria, MetodoPago, Movimiento, Persona } from './types'

export const db = new Dexie('billis') as Dexie & {
  movimientos: EntityTable<Movimiento, 'id'>
  personas: EntityTable<Persona, 'id'>
  metodosPago: EntityTable<MetodoPago, 'id'>
  categorias: EntityTable<Categoria, 'id'>
  ajustes: EntityTable<Ajuste, 'clave'>
}

db.version(1).stores({
  movimientos: 'id, tipo, fecha, descripcionNorm, compraId, modificadoEn',
  personas: 'id, nombre, modificadoEn',
  metodosPago: 'id, modificadoEn',
  categorias: 'id, tipo, modificadoEn',
  ajustes: 'clave',
})

export const TABLAS = ['movimientos', 'personas', 'metodosPago', 'categorias', 'ajustes'] as const

export const uuid = () => crypto.randomUUID()

/** Crea los campos base para un registro nuevo. */
export function nuevoBase(): Base {
  const ahora = Date.now()
  return { id: uuid(), creadoEn: ahora, modificadoEn: ahora, borradoEn: null }
}

export const vivo = <T extends Base>(r: T) => !r.borradoEn

export async function getAjuste<T>(clave: string, porDefecto: T): Promise<T> {
  const a = await db.ajustes.get(clave)
  return a === undefined ? porDefecto : (a.valor as T)
}

export function setAjuste(clave: string, valor: unknown) {
  return db.ajustes.put({ clave, valor })
}

export const normalizar = (s: string) =>
  s.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')

const CATEGORIAS_GASTO = ['Súper', 'Almacén', 'Servicios', 'Transporte', 'Salud', 'Hogar', 'Salidas', 'Ropa', 'Otros']
const CATEGORIAS_INGRESO = ['Sueldo', 'Ventas', 'Reintegros', 'Otros']
const METODOS = ['Efectivo', 'Débito', 'Crédito', 'Transferencia']

/** Primera apertura: crea "yo", categorías y métodos por defecto. */
export async function inicializar(nombre: string) {
  await db.transaction('rw', db.personas, db.categorias, db.metodosPago, async () => {
    await db.personas.add({ ...nuevoBase(), nombre: nombre.trim(), esYo: true })
    if ((await db.categorias.count()) === 0) {
      await db.categorias.bulkAdd([
        ...CATEGORIAS_GASTO.map((n) => ({ ...nuevoBase(), nombre: n, tipo: 'gasto' as const })),
        ...CATEGORIAS_INGRESO.map((n) => ({ ...nuevoBase(), nombre: n, tipo: 'ingreso' as const })),
      ])
    }
    if ((await db.metodosPago.count()) === 0) {
      await db.metodosPago.bulkAdd(METODOS.map((n) => ({ ...nuevoBase(), nombre: n })))
    }
  })
}

/** Busca una persona por nombre (sin distinguir mayúsculas) o la crea. */
export async function personaPorNombre(nombre: string): Promise<Persona> {
  const n = normalizar(nombre)
  const todas = await db.personas.toArray()
  const existente = todas.find((p) => vivo(p) && normalizar(p.nombre) === n)
  if (existente) return existente
  const p: Persona = { ...nuevoBase(), nombre: nombre.trim(), esYo: false }
  await db.personas.add(p)
  return p
}
