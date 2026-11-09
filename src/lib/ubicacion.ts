import type { Movimiento, Ubicacion } from '../db/types'

/** Pide la posición al GPS del teléfono. */
export function obtenerUbicacion(): Promise<Ubicacion> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Este navegador no tiene localizador'))
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          precision: Math.round(p.coords.accuracy),
        }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'Sin permiso de ubicación'
              : e.code === e.TIMEOUT
                ? 'El localizador tardó demasiado'
                : 'No se pudo obtener la ubicación',
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  })
}

/** Distancia en metros entre dos puntos (haversine). */
export function distancia(a: Ubicacion, b: Ubicacion): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

/** El lugar donde ya compraste más cerca de esta posición (a menos de 150 m). */
export function lugarCercano(movs: Movimiento[], aca: Ubicacion): string | null {
  let mejor: { lugar: string; d: number } | null = null
  for (const m of movs) {
    if (!m.ubicacion || !m.lugar) continue
    const d = distancia(aca, m.ubicacion)
    if (d < 150 && (!mejor || d < mejor.d)) mejor = { lugar: m.lugar, d }
  }
  return mejor?.lugar ?? null
}

export const linkMapa = (u: Ubicacion) => `https://www.google.com/maps/search/?api=1&query=${u.lat},${u.lon}`
