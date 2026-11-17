import { useRef } from 'react'
import { desdeInput, fmtFecha, fmtHora } from '../lib/fecha'

interface Props {
  tipo: 'date' | 'datetime-local'
  /** En el formato del input: '2026-11-07' o '2026-11-07T13:05'; '' = vacío. */
  valor: string
  onCambio: (v: string) => void
  etiqueta: string
  /** Lo que se lee cuando está vacío. */
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Fecha escrita siempre DD/MM/AA (el input del teléfono la muestra como quiere): el texto y el
 * calendario juntos, y encima el input de verdad, invisible, que abre el selector al tocarlo.
 */
export function CampoFecha({ tipo, valor, onCambio, etiqueta, placeholder, disabled, className }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const d = valor ? desdeInput(valor) : null
  const texto = d ? (tipo === 'date' ? fmtFecha(d) : `${fmtFecha(d)} ${fmtHora(d)}`) : ''
  return (
    <label className={'campo-fecha' + (className ? ' ' + className : '') + (disabled ? ' deshabilitado' : '')}>
      <span className={'campo-fecha-texto' + (texto ? '' : ' vacio-fecha')}>{texto || placeholder}</span>
      <svg className="campo-fecha-icono" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        ref={ref}
        type={tipo}
        aria-label={etiqueta}
        value={valor}
        disabled={disabled}
        onChange={(e) => onCambio(e.target.value)}
        // En la compu, tocar el campo no abre el calendario solo.
        onClick={() => {
          try {
            ref.current?.showPicker()
          } catch {
            /* sin showPicker: el teléfono lo abre igual */
          }
        }}
      />
    </label>
  )
}
