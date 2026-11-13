import { useEffect, useRef, useState } from 'react'
import { evaluar, mostrar, teclear } from '../lib/calculadora'
import { convertir, MONEDAS_CONVERSOR, redondear, type Cotizaciones } from '../lib/conversor'

const TECLAS = ['(', ')', 'C', '⌫', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '%', '0', '.', '+', '=']

// Teclado físico → tecla de la calculadora.
const DEL_TECLADO: Record<string, string> = {
  '*': '×', x: '×', '/': '÷', '-': '−', ',': '.', Enter: '=', Backspace: '⌫', Delete: 'C', c: 'C', C: 'C',
}

/** Lo escrito y si ya se apretó "=" (el resultado queda escrito; un número empieza de cero, un operador sigue). */
interface Cuenta {
  expr: string
  hecho: boolean
}
type Campo = 'de' | 'a'
interface Conversor {
  cuenta: Cuenta
  /** El campo donde escribe el teclado; el otro muestra la conversión. */
  campo: Campo
  de: string
  a: string
}

const VACIA: Cuenta = { expr: '', hecho: false }

// Lo último sobrevive a cerrar y abrir mientras la app está abierta (no se guarda).
let recordado: { cuenta: Cuenta; modo: 'calculadora' | 'conversor'; conv: Conversor } = {
  cuenta: VACIA,
  modo: 'calculadora',
  conv: { cuenta: VACIA, campo: 'de', de: 'ARS', a: 'BRL' },
}

/** Aplica una tecla a una cuenta; 'error' si "=" no da un número. */
function aplicar(c: Cuenta, t: string): Cuenta | 'error' {
  if (t === 'C') return VACIA
  if (t === '⌫') return { expr: c.hecho ? '' : c.expr.slice(0, -1), hecho: false }
  if (t === '=') {
    const v = evaluar(c.expr)
    if (v === null) return c.expr ? 'error' : c
    return { expr: mostrar(v).replace('-', '−'), hecho: true }
  }
  const base = c.hecho && (/[\d.(]/.test(t) || c.expr.includes('e')) ? '' : c.expr
  return { expr: teclear(base, t), hecho: false }
}

/** Calculadora simple, sin historial, con un conversor de moneda (cotizaciones de Ajustes). */
export function Calculadora({ cotizaciones, onCerrar }: { cotizaciones: Cotizaciones; onCerrar: () => void }) {
  const [cuenta, setCuenta] = useState(recordado.cuenta)
  const [modo, setModo] = useState(recordado.modo)
  const [conv, setConv] = useState(recordado.conv)
  useEffect(() => {
    recordado = { cuenta, modo, conv }
  }, [cuenta, modo, conv])
  const [error, setError] = useState(false)
  const conversor = modo === 'conversor'

  const pulsar = (t: string) => {
    setError(false)
    const r = aplicar(conversor ? conv.cuenta : cuenta, t)
    if (r === 'error') return setError(true)
    if (conversor) setConv({ ...conv, cuenta: r })
    else setCuenta(r)
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

  // Calculadora: el resultado parcial debajo de la cuenta.
  const previa = cuenta.hecho ? null : evaluar(cuenta.expr)
  const mostrarPrevia = previa !== null && /[+−×÷%(]/.test(cuenta.expr.replace(/^−/, ''))

  // Conversor: el campo activo tiene la cuenta; el otro, su valor en la otra moneda.
  const monedaActiva = conv.campo === 'de' ? conv.de : conv.a
  const monedaOtra = conv.campo === 'de' ? conv.a : conv.de
  const valor = evaluar(conv.cuenta.expr)
  const convertido = valor === null ? null : convertir(valor, monedaActiva, monedaOtra, cotizaciones)
  const textoOtro = convertido === null ? '' : mostrar(redondear(convertido)).replace('-', '−')
  const texto = (c: Campo) => (c === conv.campo ? conv.cuenta.expr : textoOtro)
  const falta = MONEDAS_CONVERSOR.filter((m) => (m.codigo === conv.de || m.codigo === conv.a) && !cotizaciones[m.codigo])

  /** Tocar el otro campo: pasa a escribirse ahí, empezando por lo que mostraba. */
  function activar(c: Campo) {
    if (c === conv.campo) return
    setError(false)
    setConv({ ...conv, campo: c, cuenta: { expr: textoOtro, hecho: true } })
  }

  const filaMoneda = (c: Campo) => (
    <div className="conv-fila">
      <input
        className={'conv-monto' + (conv.campo === c ? ' activo' : '')}
        value={texto(c)}
        placeholder="0"
        readOnly
        // Escribe el teclado de la calculadora: que no aparezca el del teléfono.
        inputMode="none"
        aria-label={c === 'de' ? 'Monto' : 'Monto convertido'}
        onClick={() => activar(c)}
        onFocus={() => activar(c)}
      />
      <select
        aria-label={c === 'de' ? 'Moneda del monto' : 'Moneda a la que se convierte'}
        value={c === 'de' ? conv.de : conv.a}
        onChange={(e) => setConv({ ...conv, [c]: e.target.value })}
      >
        {MONEDAS_CONVERSOR.map((m) => (
          <option key={m.codigo} value={m.codigo}>
            {m.bandera} {m.codigo}
          </option>
        ))}
      </select>
    </div>
  )

  const tecla = (t: string) => (
    <button
      key={t}
      type="button"
      className={'calc-tecla' + (t === '=' ? ' igual' : /[+−×÷%()]/.test(t) ? ' op' : t === 'C' || t === '⌫' ? ' borrar' : '')}
      aria-label={t === '⌫' ? 'Borrar uno' : t === 'C' ? 'Borrar todo' : undefined}
      onClick={() => pulsar(t)}
    >
      {t}
    </button>
  )

  return (
    <div className="hoja-fondo calc-fondo" onClick={onCerrar}>
      <div className="hoja calculadora" role="dialog" aria-label="Calculadora" onClick={(e) => e.stopPropagation()}>
        {conversor ? (
          <div className="conversor" aria-live="polite">
            {filaMoneda('de')}
            <div className="conv-signo">
              {error ? (
                <small>No se puede calcular</small>
              ) : falta.length ? (
                <small>Falta la cotización de {falta.map((m) => m.codigo).join(' y ')} en Ajustes</small>
              ) : (
                <svg width="22" height="16" viewBox="0 0 22 16" role="img" aria-label="aproximadamente igual a">
                  <path
                    d="M2 5.5q2.25-3 4.5 0t4.5 0 4.5 0 4.5 0M2 12q2.25-3 4.5 0t4.5 0 4.5 0 4.5 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
            {filaMoneda('a')}
          </div>
        ) : (
          <div className="calc-pantalla" aria-live="polite">
            <div className="calc-expr">{cuenta.expr || '0'}</div>
            <div className="calc-previa">{error ? 'No se puede calcular' : mostrarPrevia ? '= ' + mostrar(previa) : ' '}</div>
          </div>
        )}
        <div className="calc-teclas">
          {TECLAS.slice(0, -1).map(tecla)}
          {/* A la izquierda del "=": alterna entre la calculadora y el conversor de moneda. */}
          <button
            type="button"
            className="calc-tecla conversor-tecla"
            aria-pressed={conversor}
            aria-label="Conversor de moneda"
            title="Conversor de moneda"
            onClick={() => {
              setError(false)
              setModo(conversor ? 'calculadora' : 'conversor')
            }}
          >
            <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden="true">
              <text x="0.5" y="16" fontSize="15" fontWeight="700" fill="currentColor">
                $
              </text>
              <path
                d="M12 7h15M23 3l4 4-4 4M27 15H12M16 11l-4 4 4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {tecla('=')}
        </div>
      </div>
    </div>
  )
}
