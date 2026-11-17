import { Bandera } from './Bandera'

interface Props {
  moneda: string
  opciones: { codigo: string; nombre: string }[]
  abierto: boolean
  onAbrir: () => void
  onElegir: (codigo: string) => void
}

/** Bandera chica dentro del campo del monto; tocándola se abren las otras monedas (calculadora y formulario). */
export function MenuMoneda({ moneda, opciones, abierto, onAbrir, onElegir }: Props) {
  const nombre = opciones.find((m) => m.codigo === moneda)?.nombre ?? moneda
  return (
    <>
      <button type="button" className="conv-moneda" aria-label={'Moneda: ' + nombre} aria-expanded={abierto} onClick={onAbrir}>
        <Bandera codigo={moneda} />
      </button>
      {abierto && (
        <div className="conv-monedas" role="menu">
          {opciones.map((m) => (
            <button
              key={m.codigo}
              type="button"
              role="menuitemradio"
              aria-checked={m.codigo === moneda}
              aria-label={m.nombre}
              title={m.nombre}
              onClick={() => onElegir(m.codigo)}
            >
              <Bandera codigo={m.codigo} />
            </button>
          ))}
        </div>
      )}
    </>
  )
}
