import { db, getAjuste, normalizar, setAjuste } from '../db/db'
import type { Movimiento } from '../db/types'

/**
 * Etiquetas libres de los movimientos (ej. "Brasil" para un viaje). Se crean al escribirlas en un gasto
 * o en Ajustes (ajuste 'etiquetas', las que todavía no se usaron). La "fija" se pone sola en cada
 * gasto nuevo hasta que se saca (ajuste 'etiquetaFija').
 */
export const CLAVE_ETIQUETAS = 'etiquetas'
export const CLAVE_FIJA = 'etiquetaFija'

export const mismaEtiqueta = (a: string, b: string) => normalizar(a) === normalizar(b)

export const tieneEtiqueta = (m: Movimiento, e: string) => !!m.etiquetas?.some((x) => mismaEtiqueta(x, e))

/** Sin repetidas (sin distinguir mayúsculas ni acentos), conservando la primera forma. */
export function sinRepetidas(es: string[]): string[] {
  const vistas = new Set<string>()
  return es.filter((e) => {
    const k = normalizar(e)
    if (!k || vistas.has(k)) return false
    vistas.add(k)
    return true
  })
}

/** Todas: las creadas en Ajustes y las usadas, en orden alfabético. */
export const todasEtiquetas = (movs: Movimiento[], guardadas: string[]) =>
  sinRepetidas([...guardadas, ...movs.flatMap((m) => m.etiquetas ?? [])]).sort((a, b) => a.localeCompare(b, 'es'))

/** Limpia lo escrito: sin espacios de más ni "#" adelante, hasta 30 letras. */
export const limpiarEtiqueta = (e: string) => e.replace(/^#+/, '').trim().replace(/\s+/g, ' ').slice(0, 30)

/** Renombra (o, con `nueva` null, quita) una etiqueta en todos los movimientos y en los ajustes. */
export async function cambiarEtiqueta(vieja: string, nueva: string | null) {
  await db.transaction('rw', db.movimientos, db.ajustes, async () => {
    const ahora = Date.now()
    const movs = await db.movimientos.filter((m) => tieneEtiqueta(m, vieja)).toArray()
    await db.movimientos.bulkPut(
      movs.map((m) => {
        const resto = (m.etiquetas ?? []).filter((x) => !mismaEtiqueta(x, vieja))
        const es = sinRepetidas(nueva ? [...resto, nueva] : resto)
        return { ...m, etiquetas: es.length ? es : undefined, modificadoEn: ahora }
      }),
    )
    const guardadas = await getAjuste<string[]>(CLAVE_ETIQUETAS, [])
    const sin = guardadas.filter((x) => !mismaEtiqueta(x, vieja))
    await setAjuste(CLAVE_ETIQUETAS, nueva ? sinRepetidas([...sin, nueva]) : sin)
    const fija = await getAjuste<string | null>(CLAVE_FIJA, null)
    if (fija && mismaEtiqueta(fija, vieja)) await setAjuste(CLAVE_FIJA, nueva)
  })
}
