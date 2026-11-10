import { OPCIONES_ORDEN, type OrdenLista } from '../lib/orden'

/** Un toque pasa al orden siguiente; el ícono muestra el orden actual. */
export function BotonOrden(props: { orden: OrdenLista; onCambiar: (o: OrdenLista) => void; chico?: boolean }) {
  const { orden, onCambiar, chico } = props
  const i = OPCIONES_ORDEN.findIndex((o) => o.id === orden)
  const siguiente = OPCIONES_ORDEN[(i + 1) % OPCIONES_ORDEN.length]
  return (
    <button
      className={'icono borde boton-orden' + (chico ? ' chico' : '')}
      aria-label={`Orden ${OPCIONES_ORDEN[i].etiqueta.toLowerCase()}. Tocá para ordenar ${siguiente.etiqueta.toLowerCase()}`}
      onClick={() => onCambiar(siguiente.id)}
    >
      {orden === 'alfabetico' ? (
        <span className="orden-az" aria-hidden="true">
          A..Z
        </span>
      ) : orden === 'grupos' ? (
        // Cuatro cuadraditos: categorías.
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3.5" y="3.5" width="7" height="7" />
          <rect x="13.5" y="3.5" width="7" height="7" />
          <rect x="3.5" y="13.5" width="7" height="7" />
          <rect x="13.5" y="13.5" width="7" height="7" />
        </svg>
      ) : (
        // Mano abierta: ordenás vos, arrastrando. El viewBox la centra (el trazo cae un poco a la izquierda y abajo).
        <svg width="22" height="22" viewBox="-0.3 0.25 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path
            strokeWidth="1.8"
            d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 11V5.5a1.5 1.5 0 0 1 3 0V12M17 10a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-.8a6 6 0 0 1-4.9-2.6L3.7 15.6a1.5 1.5 0 0 1 2.4-1.8L8 16"
          />
        </svg>
      )}
    </button>
  )
}
