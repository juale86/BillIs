import { useEffect, useRef, useState } from 'react'
import { evaluar, mostrar, teclear } from '../lib/calculadora'

const TECLAS = ['(', ')', 'C', '⌫', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '%', '0', '.', '+', '=']

// Teclado físico → tecla de la calculadora.
const DEL_TECLADO: Record<string, string> = {
  '*': '×', x: '×', '/': '÷', '-': '−', ',': '.', Enter: '=', Backspace: '⌫', Delete: 'C', c: 'C', C: 'C',
}

// Lo último escrito sobrevive a cerrar y abrir mientras la app está abierta (no se guarda).
let recordado = { expr: '', hecho: false }

/** Calculadora simple, sin historial: recuerda solo la última cuenta. */
export function Calculadora({ onCerrar }: { onCerrar: () => void }) {
  const [expr, setExpr] = useState(recordado.expr)
  // Después de "=" el resultado queda escrito; un número empieza de cero, un operador sigue la cuenta.
  const [hecho, setHecho] = useState(recordado.hecho)
  useEffect(() => {
    recordado = { expr, hecho }
  }, [expr, hecho])
  const [error, setError] = useState(false)

  const pulsar = (t: string) => {
    setError(false)
    if (t === 'C') return setExpr(''), setHecho(false)
    if (t === '⌫') return setExpr((e) => (hecho ? '' : e.slice(0, -1))), setHecho(false)
    if (t === '=') {
      const v = evaluar(expr)
      if (v === null) return expr && setError(true)
      setExpr(mostrar(v).replace('-', '−'))
      return setHecho(true)
    }
    const base = hecho && (/[\d.(]/.test(t) || expr.includes('e')) ? '' : expr
    setExpr(teclear(base, t))
    setHecho(false)
  }

  const ref = useRef(pulsar)
  useEffect(() => {
    ref.current = pulsar
  })
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onCerrar()
      const t = DEL_TECLADO[e.key] ?? e.key
      if (TECLAS.includes(t)) {
        e.preventDefault()
        ref.current(t)
      }
    }
    addEventListener('keydown', tecla)
    return () => removeEventListener('keydown', tecla)
  }, [onCerrar])

  const previa = hecho ? null : evaluar(expr)
  const mostrarPrevia = previa !== null && /[+−×÷%(]/.test(expr.replace(/^−/, ''))

  return (
    <div className="hoja-fondo calc-fondo" onClick={onCerrar}>
      <div className="hoja calculadora" role="dialog" aria-label="Calculadora" onClick={(e) => e.stopPropagation()}>
        <div className="calc-pantalla" aria-live="polite">
          <div className="calc-expr">{expr || '0'}</div>
          <div className="calc-previa">{error ? 'No se puede calcular' : mostrarPrevia ? '= ' + mostrar(previa) : ' '}</div>
        </div>
        <div className="calc-teclas">
          {TECLAS.map((t) => (
            <button
              key={t}
              type="button"
              className={
                'calc-tecla' +
                (t === '=' ? ' igual' : /[+−×÷%()]/.test(t) ? ' op' : t === 'C' || t === '⌫' ? ' borrar' : '')
              }
              aria-label={t === '⌫' ? 'Borrar uno' : t === 'C' ? 'Borrar todo' : undefined}
              onClick={() => pulsar(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
