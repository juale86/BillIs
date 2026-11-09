import type { Id, MetodoPago } from '../db/types'

interface Props {
  etiqueta: string
  metodos: MetodoPago[]
  metodoId: Id | ''
  onMetodo: (id: Id | '') => void
  onNuevoMetodo: () => void
  /** Texto de la cantidad de cuotas; si es undefined no se ofrecen cuotas (ingresos, dólares). */
  cuotas?: string
  onCuotas?: (c: string) => void
  /** Texto de la opción vacía. */
  vacio?: string
}

/** Método de pago con las cuotas dentro del mismo campo: [Crédito ▾ | 3 cuotas]. */
export function MetodoCuotas({ etiqueta, metodos, metodoId, onMetodo, onNuevoMetodo, cuotas, onCuotas, vacio = '—' }: Props) {
  return (
    <div className="campo crece metodo">
      <span>{etiqueta}</span>
      <div className="metodo-caja">
        <select
          value={metodoId}
          aria-label={etiqueta}
          onChange={(e) => (e.target.value === '+' ? onNuevoMetodo() : onMetodo(e.target.value))}
        >
          <option value="">{vacio}</option>
          {metodos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
          <option value="+">+ Nuevo…</option>
        </select>
        {cuotas !== undefined && onCuotas && (
          <label className="metodo-cuotas">
            <input value={cuotas} inputMode="numeric" aria-label="Cuotas" onChange={(e) => onCuotas(e.target.value)} />
            <small>{cuotas.trim() === '1' ? 'cuota' : 'cuotas'}</small>
          </label>
        )}
      </div>
    </div>
  )
}
