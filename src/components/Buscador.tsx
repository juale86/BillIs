import { useEffect, useRef, type ReactNode } from 'react'

export interface FiltroActivo {
  etiqueta: string
  onQuitar: () => void
}

interface Props {
  /** Si se ve el campo de texto (la lupa está abierta). */
  abierto: boolean
  texto: string
  setTexto: (t: string) => void
  placeholder: string
  /** Filtros que se pueden agregar tocando. */
  opciones: { etiqueta: string; onElegir: () => void }[]
  /** Filtros aplicados (sin contar el texto). */
  activos: FiltroActivo[]
  /** Resumen de lo filtrado, ej. "12 resultados". */
  resumen?: ReactNode
  /** Quita todos los filtros y el texto. */
  onLimpiar: () => void
  /** false: el campo de texto lo dibuja quien lo usa (siempre visible), acá solo van los chips. */
  conCampo?: boolean
}

/**
 * Lupa: campo de búsqueda + chips de filtros.
 * Los filtros aplicados quedan a la izquierda de la fila de chips, con ✕; se ven aunque se cierre la lupa.
 */
export function Buscador({ abierto, texto, setTexto, placeholder, opciones, activos, resumen, onLimpiar, conCampo = true }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (abierto && conCampo) ref.current?.focus()
  }, [abierto, conCampo])

  // Con la lupa abierta el texto ya se ve en el campo; cerrada, queda como filtro con ✕.
  const todos: FiltroActivo[] = [
    ...(texto && !abierto && conCampo ? [{ etiqueta: `“${texto}”`, onQuitar: () => setTexto('') }] : []),
    ...activos,
  ]
  const hayAlgo = todos.length > 0 || !!texto
  if (!abierto && !hayAlgo) return null

  return (
    <div className="buscador">
      {abierto && conCampo && (
        <div className="campo">
          <input
            ref={ref}
            type="search"
            value={texto}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
      )}
      {(todos.length > 0 || (abierto && opciones.length > 0)) && (
        <div className="chips" aria-label="Filtros">
          {/* Los aplicados van primero, a la izquierda, con ✕ para quitarlos. */}
          {todos.map((f) => (
            <span key={f.etiqueta} className="filtro">
              {f.etiqueta}
              <button type="button" aria-label={`Quitar filtro ${f.etiqueta}`} onClick={f.onQuitar}>
                ✕
              </button>
            </span>
          ))}
          {abierto &&
            opciones.map((o) => (
              <button
                type="button"
                key={o.etiqueta}
                className="chip"
                onMouseDown={(e) => e.preventDefault()}
                onClick={o.onElegir}
              >
                {o.etiqueta}
              </button>
            ))}
          {todos.length > 1 && (
            <button type="button" className="enlace quitar-todos" onClick={onLimpiar}>
              Quitar todos
            </button>
          )}
        </div>
      )}
      {hayAlgo && resumen && <p className="calculo">{resumen}</p>}
    </div>
  )
}

/** Ícono de lupa con punto cuando hay filtros aplicados. */
export function BotonLupa({ abierto, filtrando, onClick }: { abierto: boolean; filtrando: boolean; onClick: () => void }) {
  return (
    <button
      className={'icono borde lupa' + (filtrando ? ' con-filtro' : '')}
      aria-label={filtrando ? 'Buscar (hay filtros aplicados)' : 'Buscar'}
      aria-pressed={abierto}
      onClick={onClick}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M15 15l6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
      </svg>
    </button>
  )
}
