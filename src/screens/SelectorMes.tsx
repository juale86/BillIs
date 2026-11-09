import type { ReactNode } from 'react'
import { nombreMes } from '../lib/calculos'

/** extra: acción al costado (ej. la lupa). */
export function SelectorMes({ mes, setMes, extra }: { mes: number; setMes: (m: number) => void; extra?: ReactNode }) {
  return (
    <div className="selector-mes">
      <button className="icono" aria-label="Mes anterior" onClick={() => setMes(mes - 1)}>
        ‹
      </button>
      <strong>{nombreMes(mes)}</strong>
      <button className="icono" aria-label="Mes siguiente" onClick={() => setMes(mes + 1)}>
        ›
      </button>
      {extra}
    </div>
  )
}
