import { useEffect, useRef, type ReactNode } from 'react'
import { Chips } from './Chips'

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
}

/**
 * Lupa: campo de búsqueda + chips de filtros.
 * Los filtros aplicados se ven siempre (aunque se cierre la lupa) como testigo, con ✕ para quitarlos.
 */
export function Buscador({ abierto, texto, setTexto, placeholder, opciones, activos, resumen, onLimpiar }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (abierto) ref.current?.focus()
  }, [abierto])

  const todos: FiltroActivo[] = [...(texto ? [{ etiqueta: `“${texto}”`, onQuitar: () => setTexto('') }] : []), ...activos]
  if (!abierto && todos.length === 0) return null

  return (
    <div className="buscador">
      {abierto && (
        <>
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
          <Chips opciones={opciones.map((o) => o.etiqueta)} onElegir={(e) => opciones.find((o) => o.etiqueta === e)?.onElegir()} />
        </>
      )}
      {todos.length > 0 && (
        <div className="filtros-activos" aria-label="Filtros aplicados">
          <span className="filtrando">Filtrando</span>
          {todos.map((f) => (
            <span key={f.etiqueta} className="filtro">
              {f.etiqueta}
              <button type="button" aria-label={`Quitar filtro ${f.etiqueta}`} onClick={f.onQuitar}>
                ✕
              </button>
            </span>
          ))}
          {todos.length > 1 && (
            <button type="button" className="enlace" onClick={onLimpiar}>
              Quitar todos
            </button>
          )}
        </div>
      )}
      {todos.length > 0 && resumen && <p className="calculo">{resumen}</p>}
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
