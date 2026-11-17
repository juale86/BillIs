import { amPm } from './hora'

const p2 = (n: number) => String(n).padStart(2, '0')

/** Fecha y hora local para un <input type="datetime-local"> ("2026-11-16T18:52"). */
export const aInputFecha = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`
}

/** Todas las fechas de la app se escriben DD/MM/AA: "07/11/26". */
export const fmtFecha = (t: number | Date) => {
  const d = new Date(t)
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${p2(d.getFullYear() % 100)}`
}

/** "1:05am" */
export const fmtHora = (t: number | Date) =>
  amPm(new Date(t).toLocaleTimeString('es-AR', { hour: 'numeric', minute: '2-digit' }))

/** "vie 07/11/26" */
export const fmtDiaSemana = (t: number | Date) =>
  `${new Date(t).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')} ${fmtFecha(t)}`

/** El valor de un input de fecha ('2026-11-07' o '2026-11-07T13:05') como fecha local. */
export function desdeInput(v: string): Date | null {
  const [f, h] = v.split('T')
  const [a, m, d] = f.split('-').map(Number)
  if (!a || !m || !d) return null
  const [hh, mm] = (h ?? '00:00').split(':').map(Number)
  return new Date(a, m - 1, d, hh || 0, mm || 0)
}
