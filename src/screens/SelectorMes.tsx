import type { ReactNode } from 'react'
import { nombreMes } from '../lib/calculos'

interface Props {
  mes: number
  setMes: (m: number) => void
  /** extra: acción al costado (ej. la lupa). */
  extra?: ReactNode
  /** Si viene, las flechas saltan solo entre estos meses (los que tienen movimientos). */
  meses?: number[]
}

export function SelectorMes({ mes, setMes, extra, meses }: Props) {
  const anterior = meses ? Math.max(...meses.filter((m) => m < mes)) : mes - 1
  const siguiente = meses ? Math.min(...meses.filter((m) => m > mes)) : mes + 1
  return (
    <div className="selector-mes">
      <button
        className="icono"
        aria-label="Mes anterior"
        disabled={!Number.isFinite(anterior)}
        onClick={() => setMes(anterior)}
      >
        ‹
      </button>
      <strong>{nombreMes(mes)}</strong>
      <button
        className="icono"
        aria-label="Mes siguiente"
        disabled={!Number.isFinite(siguiente)}
        onClick={() => setMes(siguiente)}
      >
        ›
      </button>
      {extra}
    </div>
  )
}
