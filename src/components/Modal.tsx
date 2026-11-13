import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useUltimo } from './useUltimo'

interface Props {
  titulo: string
  children?: ReactNode
  /** Si viene, el modal pide un texto (ej. renombrar) y lo devuelve al confirmar. */
  valorInicial?: string
  etiquetaConfirmar: string
  /** Acción destructiva: el botón se pinta de rojo. */
  peligro?: boolean
  /** Teclado del teléfono para el texto. */
  inputMode?: 'text' | 'decimal'
  onConfirmar: (valor: string) => void
  onCancelar: () => void
}

/** Diálogo centrado para confirmar una acción o pedir un texto. */
export function Modal({ titulo, children, valorInicial, etiquetaConfirmar, peligro, inputMode, onConfirmar, onCancelar }: Props) {
  const [valor, setValor] = useState(valorInicial ?? '')
  const ref = useRef<HTMLInputElement>(null)
  const conTexto = valorInicial !== undefined

  // Escape cancela; se lee la última versión de onCancelar sin re-suscribir.
  const cancelar = useUltimo(onCancelar)
  useEffect(() => {
    ref.current?.select()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && cancelar.current()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
    // El ref no cambia: corre una sola vez, al abrir.
  }, [cancelar])

  return (
    <div
      className="modal-fondo"
      onClick={(e) => {
        e.stopPropagation()
        onCancelar()
      }}
    >
      <form
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!conTexto || valor.trim()) onConfirmar(valor.trim())
        }}
      >
        <h3>{titulo}</h3>
        {children && <div className="modal-texto">{children}</div>}
        {conTexto && (
          <div className="campo">
            <input ref={ref} value={valor} aria-label={titulo} inputMode={inputMode} onChange={(e) => setValor(e.target.value)} />
          </div>
        )}
        <div className="modal-botones">
          <button type="button" className="cancelar" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="submit" className={'primario' + (peligro ? ' boton-peligro' : '')} disabled={conTexto && !valor.trim()}>
            {etiquetaConfirmar}
          </button>
        </div>
      </form>
    </div>
  )
}
