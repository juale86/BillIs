import type { Promo } from '../db/types'

export type TipoPromo = '' | Promo['tipo']

/**
 * Promo de un gasto: el tipo y sus números (a y b según el tipo: lleva/paga, unidad nº/% off,
 * % off, o el total que pagaste). Los textos se guardan tal cual se escriben; el cálculo lo hace el formulario.
 */
export function CamposPromo(props: {
  tipo: TipoPromo
  a: string
  b: string
  onTipo: (t: TipoPromo) => void
  onA: (v: string) => void
  onB: (v: string) => void
}) {
  const { tipo, a, b, onTipo, onA, onB } = props
  return (
    <fieldset className="grupo">
      <div className="fila">
        <label className="campo crece">
          <span>Promo</span>
          <select value={tipo} onChange={(e) => onTipo(e.target.value as TipoPromo)}>
            <option value="">Sin promo</option>
            <option value="nxm">Lleva N, paga M (3x2)</option>
            <option value="nesima">N-ésima unidad con descuento</option>
            <option value="pct">% de descuento</option>
            <option value="manual">Otra (escribo el total)</option>
          </select>
        </label>
      </div>
      {/* Las dos promos con dos números usan los mismos campos; cambian las etiquetas. */}
      {(tipo === 'nxm' || tipo === 'nesima') && (
        <div className="fila">
          <label className="campo chico">
            <span>{tipo === 'nxm' ? 'Lleva' : 'Unidad nº'}</span>
            <input value={a} inputMode="numeric" onChange={(e) => onA(e.target.value)} />
          </label>
          <label className="campo chico">
            <span>{tipo === 'nxm' ? 'Paga' : '% off'}</span>
            <input value={b} inputMode="numeric" onChange={(e) => onB(e.target.value)} />
          </label>
        </div>
      )}
      {tipo === 'pct' && (
        <label className="campo chico">
          <span>% off</span>
          <input value={a} inputMode="numeric" onChange={(e) => onA(e.target.value)} />
        </label>
      )}
      {tipo === 'manual' && (
        <label className="campo">
          <span>Total que pagaste</span>
          <input value={a} inputMode="decimal" onChange={(e) => onA(e.target.value)} />
        </label>
      )}
    </fieldset>
  )
}
