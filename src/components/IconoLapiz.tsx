/** Lápiz de renombrar o corregir (dentro de un botón, que lleva el aria-label). */
export function IconoLapiz({ tam = 16 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20l1-5L16 4l4 4L9 19z M14 6l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
