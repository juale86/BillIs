import { useEffect, useState } from 'react'
import { useUltimo } from './useUltimo'
import { evaluar, mostrar, teclear } from '../lib/calculadora'
import { Bandera } from './Bandera'
import { convertir, MONEDAS_CONVERSOR, redondear, type Cotizaciones } from '../lib/conversor'

const TECLAS = ['(', ')', 'C', '⌫', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '%', '0', '.', '+', '=']

/** Por dentro la cuenta usa punto; en pantalla, coma decimal como el resto de la app. */
const conComa = (s: string) => s.replace(/\./g, ',')

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
  /** El campo cuya lista de monedas está abierta. */
  const [eligiendo, setEligiendo] = useState<Campo | null>(null)
  const conversor = modo === 'conversor'

  const pulsar = (t: string) => {
    setError(false)
    setEligiendo(null)
    const r = aplicar(conversor ? conv.cuenta : cuenta, t)
    if (r === 'error') return setError(true)
    if (conversor) setConv({ ...conv, cuenta: r })
    else setCuenta(r)
  }

  const ref = useUltimo(pulsar)
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
  }, [onCerrar, ref])

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

  /** Monto y, adentro del mismo recuadro, la bandera que abre las otras monedas. */
  const grupo = (c: Campo) => {
    const moneda = c === 'de' ? conv.de : conv.a
    const nombre = MONEDAS_CONVERSOR.find((m) => m.codigo === moneda)?.nombre ?? moneda
    return (
      <div className={'conv-grupo' + (conv.campo === c ? ' activo' : '')}>
        <input
          className="conv-monto"
          value={conComa(texto(c))}
          placeholder="0"
          readOnly
          // Escribe el teclado de la calculadora: que no aparezca el del teléfono.
          inputMode="none"
          aria-label={(c === 'de' ? 'Monto en ' : 'Monto convertido en ') + nombre}
          onClick={() => activar(c)}
          onFocus={() => activar(c)}
        />
        <button
          type="button"
          className="conv-moneda"
          aria-label={'Moneda: ' + nombre}
          aria-expanded={eligiendo === c}
          onClick={() => setEligiendo(eligiendo === c ? null : c)}
        >
          <Bandera codigo={moneda} />
        </button>
        {eligiendo === c && (
          <div className="conv-monedas" role="menu">
            {MONEDAS_CONVERSOR.map((m) => (
              <button
                key={m.codigo}
                type="button"
                role="menuitemradio"
                aria-checked={m.codigo === moneda}
                aria-label={m.nombre}
                title={m.nombre}
                onClick={() => {
                  setConv({ ...conv, [c]: m.codigo })
                  setEligiendo(null)
                }}
              >
                <Bandera codigo={m.codigo} />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const tecla = (t: string) => (
    <button
      key={t}
      type="button"
      className={'calc-tecla' + (t === '=' ? ' igual' : /[+−×÷%()]/.test(t) ? ' op' : t === 'C' || t === '⌫' ? ' borrar' : '')}
      aria-label={t === '⌫' ? 'Borrar uno' : t === 'C' ? 'Borrar todo' : t === '.' ? 'Coma decimal' : undefined}
      onClick={() => pulsar(t)}
    >
      {conComa(t)}
    </button>
  )

  return (
    <div className="hoja-fondo calc-fondo" onClick={onCerrar}>
      <div className="hoja calculadora" role="dialog" aria-label="Calculadora" onClick={(e) => e.stopPropagation()}>
        {conversor ? (
          <div className="conversor" aria-live="polite">
            <div className="conv-linea">
              {grupo('de')}
              <span className="conv-signo" aria-label="aproximadamente igual a">
                ≈
              </span>
              {grupo('a')}
            </div>
            {(error || falta.length > 0) && (
              <small className="conv-aviso">
                {error
                  ? 'No se puede calcular'
                  : `Falta la cotización de ${falta.map((m) => m.codigo).join(' y ')} en Ajustes`}
              </small>
            )}
          </div>
        ) : (
          <div className="calc-pantalla" aria-live="polite">
            <div className="calc-expr">{conComa(cuenta.expr) || '0'}</div>
            <div className="calc-previa">{error ? 'No se puede calcular' : mostrarPrevia ? '= ' + conComa(mostrar(previa)) : ' '}</div>
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
              setEligiendo(null)
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
