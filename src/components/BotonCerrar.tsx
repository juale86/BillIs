/** X arriba a la derecha de un formulario: cierra sin guardar. */
export function BotonCerrar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="icono cerrar-x" aria-label="Cerrar sin guardar" onClick={onClick}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  )
}
