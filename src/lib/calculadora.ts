/**
 * Calculadora básica: + − × ÷ %, paréntesis y punto decimal.
 * Evalúa con un parser propio (nada de eval). Los paréntesis sin cerrar se cierran solos.
 * "%" divide por 100, salvo después de + o −: 200 + 10% = 220 (como las calculadoras de bolsillo).
 */

export const OPERADORES = ['+', '−', '×', '÷'] as const
const esOperador = (c: string) => (OPERADORES as readonly string[]).includes(c)
const esDigito = (c: string) => c >= '0' && c <= '9'

/** Agrega una tecla a la expresión, corrigiendo lo obvio (dos operadores seguidos, dos puntos, etc.). */
export function teclear(expr: string, tecla: string): string {
  const ult = expr.slice(-1)
  if (esDigito(tecla)) {
    if (ult === ')' || ult === '%') return expr + '×' + tecla
    // "0" solo a la izquierda se reemplaza: 05 → 5
    const num = expr.match(/[\d.]*$/)![0]
    if (num === '0') return expr.slice(0, -1) + tecla
    return expr + tecla
  }
  if (tecla === '.') {
    const num = expr.match(/[\d.]*$/)![0]
    if (num.includes('.')) return expr
    if (ult === ')' || ult === '%') return expr + '×0.'
    return expr + (num === '' ? '0.' : '.')
  }
  if (esOperador(tecla)) {
    if (expr === '' || ult === '(') return tecla === '−' ? expr + '−' : expr
    if (esOperador(ult)) {
      // "×−" deja escribir un negativo; si no, se cambia el operador
      if (tecla === '−' && (ult === '×' || ult === '÷')) return expr + '−'
      const sinOps = expr.replace(/[+−×÷]+$/, '')
      return sinOps === '' || sinOps.endsWith('(') ? expr : sinOps + tecla
    }
    if (ult === '.') return expr.slice(0, -1) + tecla
    return expr + tecla
  }
  if (tecla === '%') {
    if (esDigito(ult) || ult === ')') return expr + '%'
    return expr
  }
  if (tecla === '(') {
    if (esDigito(ult) || ult === ')' || ult === '%' || ult === '.') return expr + '×('
    return expr + '('
  }
  if (tecla === ')') {
    const abiertos = (expr.match(/\(/g)?.length ?? 0) - (expr.match(/\)/g)?.length ?? 0)
    if (abiertos <= 0 || ult === '(' || esOperador(ult)) return expr
    return expr + ')'
  }
  return expr
}

/** Resultado de la expresión, o null si está incompleta o no da un número. */
export function evaluar(expr: string): number | null {
  const s = expr.replace(/[+−×÷.(]+$/, '')
  if (!s) return null
  let i = 0
  const ver = () => s[i]

  // expresión := término (('+'|'−') término)*
  const expresion = (): number => {
    const t0 = termino()
    let v = t0.soloPorcentaje ? t0.v / 100 : t0.v
    while (ver() === '+' || ver() === '−') {
      const op = s[i++]
      const t = termino()
      const d = t.soloPorcentaje ? (v * t.v) / 100 : t.v
      v = op === '+' ? v + d : v - d
    }
    return v
  }
  // término := factor (('×'|'÷') factor)*; un término que es solo "n%" se marca para + y −
  const termino = (): { v: number; soloPorcentaje: boolean } => {
    let f = factor()
    let v = f.porcentaje ? f.v / 100 : f.v
    let solo = f.porcentaje
    while (ver() === '×' || ver() === '÷') {
      const op = s[i++]
      f = factor()
      const x = f.porcentaje ? f.v / 100 : f.v
      v = op === '×' ? v * x : v / x
      solo = false
    }
    return { v: solo ? v * 100 : v, soloPorcentaje: solo }
  }
  // factor := '−' factor | número | '(' expresión ')'  seguido de '%' opcional
  const factor = (): { v: number; porcentaje: boolean } => {
    let v: number
    if (ver() === '−') {
      i++
      const f = factor()
      return { v: -f.v, porcentaje: f.porcentaje }
    }
    if (ver() === '(') {
      i++
      v = expresion()
      if (ver() === ')') i++
    } else {
      const m = s.slice(i).match(/^\d*\.?\d*/)![0]
      if (m === '' || m === '.') throw new Error('número')
      i += m.length
      v = Number(m)
    }
    let porcentaje = false
    while (ver() === '%') {
      i++
      if (porcentaje) v /= 100
      porcentaje = true
    }
    return { v, porcentaje }
  }

  try {
    const v = expresion()
    if (i < s.length || !Number.isFinite(v)) return null
    return v
  } catch {
    return null
  }
}

/** Número para mostrar: hasta 10 cifras significativas, sin ceros de más. */
export function mostrar(v: number): string {
  if (Object.is(v, -0)) v = 0
  const r = Number(v.toPrecision(10))
  if (Math.abs(r) >= 1e15 || (r !== 0 && Math.abs(r) < 1e-9)) return r.toExponential(6).replace(/\.?0+e/, 'e')
  return String(r)
}
