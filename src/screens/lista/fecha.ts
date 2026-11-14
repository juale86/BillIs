/** Fecha corta para las listas (cerrada el 13/11). */
export const fmtFecha = (t: number) => new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })
