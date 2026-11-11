/** "2" → "x2"; lo que no es un número ("1 kg", "media docena") queda como se escribió. */
export function textoCantidad(c: string | number | null | undefined): string {
  if (c === null || c === undefined || c === '') return ''
  const s = String(c).trim()
  return /^\d+([.,]\d+)?$/.test(s) ? `x${s}` : s
}
