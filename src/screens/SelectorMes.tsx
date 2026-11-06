import { nombreMes } from '../lib/calculos'

export function SelectorMes({ mes, setMes }: { mes: number; setMes: (m: number) => void }) {
  return (
    <div className="selector-mes">
      <button className="icono" aria-label="Mes anterior" onClick={() => setMes(mes - 1)}>
        ‹
      </button>
      <strong>{nombreMes(mes)}</strong>
      <button className="icono" aria-label="Mes siguiente" onClick={() => setMes(mes + 1)}>
        ›
      </button>
    </div>
  )
}
