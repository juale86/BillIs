interface Props {
  opciones: string[]
  activo?: string
  onElegir: (v: string) => void
}

/** Fila de sugerencias tocables debajo de un campo. */
export function Chips({ opciones, activo, onElegir }: Props) {
  if (!opciones.length) return null
  return (
    <div className="chips">
      {opciones.map((o) => (
        <button
          type="button"
          key={o}
          className={'chip' + (activo === o ? ' chip-activo' : '')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onElegir(o)}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
