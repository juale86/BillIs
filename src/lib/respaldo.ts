import { db, getAjuste, setAjuste, TABLAS } from '../db/db'
import { describirPromo } from './promo'

const CLAVE_ULTIMO = 'ultimoRespaldo'
const DIAS_AVISO = 7

function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const hoy = () => new Date().toISOString().slice(0, 10)

export async function exportarJSON() {
  const datos: Record<string, unknown[]> = {}
  for (const t of TABLAS) datos[t] = await db.table(t).toArray()
  descargar(`billis-${hoy()}.json`, JSON.stringify({ app: 'billis', version: 1, datos }), 'application/json')
  await setAjuste(CLAVE_ULTIMO, Date.now())
}

/** Reemplaza todos los datos por los del archivo. */
export async function importarJSON(archivo: File) {
  const json = JSON.parse(await archivo.text())
  if (json?.app !== 'billis' || typeof json.datos !== 'object') throw new Error('El archivo no es un respaldo de BillIs')
  await db.transaction('rw', TABLAS.map((t) => db.table(t)), async () => {
    for (const t of TABLAS) {
      await db.table(t).clear()
      const filas = json.datos[t]
      if (Array.isArray(filas)) await db.table(t).bulkAdd(filas)
    }
  })
}

const csvCelda = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportarCSV() {
  const [movs, personas, metodos, categorias] = await Promise.all([
    db.movimientos.toArray(),
    db.personas.toArray(),
    db.metodosPago.toArray(),
    db.categorias.toArray(),
  ])
  const nombre = (lista: { id: string; nombre: string }[], id?: string) => lista.find((x) => x.id === id)?.nombre ?? ''
  const dec = (c?: number) => (c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','))
  const cab = ['Fecha', 'Tipo', 'Producto', 'Marca', 'Comentario', 'Categoría', 'Cantidad', 'Precio unitario', 'Promo', 'Total', 'Mi parte', 'Moneda', 'Cuotas', 'Lugar/Origen', 'Ubicación', 'Método', 'Pagador', 'Compartido con', 'Compra']
  const filas = movs
    .filter((m) => !m.borradoEn)
    .sort((a, b) => a.fecha - b.fecha)
    .map((m) => [
      new Date(m.fecha).toLocaleString('es-AR'),
      m.tipo,
      m.descripcion,
      m.marca,
      m.comentario,
      nombre(categorias, m.categoriaId),
      m.cantidad,
      dec(m.precioUnitCent),
      m.promo ? describirPromo(m.promo) : '',
      dec(m.totalCent),
      dec(m.miParteCent),
      m.moneda,
      m.cuotas?.cantidad,
      m.lugar,
      m.ubicacion ? `${m.ubicacion.lat.toFixed(6)}, ${m.ubicacion.lon.toFixed(6)}` : '',
      nombre(metodos, m.metodoPagoId),
      nombre(personas, m.pagadorId),
      nombre(personas, m.contraparteId),
      m.compraId,
    ])
  // Separador ";" para que Excel en español lo abra bien.
  const csv = [cab, ...filas].map((f) => f.map(csvCelda).join(';')).join('\n')
  descargar(`billis-${hoy()}.csv`, '﻿' + csv, 'text/csv')
}

export async function necesitaRespaldo(): Promise<boolean> {
  if ((await db.movimientos.count()) === 0) return false
  // Sin ningún respaldo todavía, se cuenta desde el primer movimiento cargado (no desde siempre):
  // así no avisa a los minutos de empezar a usar la app.
  let desde = await getAjuste<number>(CLAVE_ULTIMO, 0)
  if (!desde) {
    desde = Infinity
    await db.movimientos.each((m) => {
      if (m.creadoEn < desde) desde = m.creadoEn
    })
  }
  return Date.now() - desde > DIAS_AVISO * 24 * 60 * 60 * 1000
}

export async function pedirPersistencia() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    /* no soportado */
  }
}
