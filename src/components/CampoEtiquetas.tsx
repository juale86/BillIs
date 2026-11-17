import { useState } from 'react'
import { normalizar } from '../db/db'
import { limpiarEtiqueta, mismaEtiqueta, sinRepetidas } from '../lib/etiquetas'

interface Props {
  valor: string[]
  onCambio: (es: string[]) => void
  /** Todas las que existen, para sugerir. */
  todas: string[]
}

/**
 * Etiquetas de un movimiento: chips con ✕ y un campo para escribir otra (Enter o coma la agrega).
 * Con el campo enfocado se sugieren las que ya existen.
 */
export function CampoEtiquetas({ valor, onCambio, todas }: Props) {
  const [texto, setTexto] = useState('')
  const [foco, setFoco] = useState(false)
  const q = normalizar(texto)
  const sugeridas = todas.filter((e) => !valor.some((v) => mismaEtiqueta(v, e)) && (!q || normalizar(e).includes(q))).slice(0, 8)

  function agregar(e: string) {
    const limpia = limpiarEtiqueta(e)
    // Si ya existe con otra forma (ej. "brasil"), se usa la que existe.
    const existente = todas.find((x) => mismaEtiqueta(x, limpia))
    if (limpia) onCambio(sinRepetidas([...valor, existente ?? limpia]))
    setTexto('')
  }

  return (
    <div className="campo crece etiquetas-campo">
      <div className="etiquetas-caja">
        {valor.map((e) => (
          <span key={e} className="etiqueta">
            {e}
            <button type="button" aria-label={`Quitar etiqueta ${e}`} onClick={() => onCambio(valor.filter((v) => v !== e))}>
              ✕
            </button>
          </span>
        ))}
        <input
          value={texto}
          placeholder={valor.length ? 'Otra' : 'Etiqueta, ej. Brasil'}
          aria-label="Etiquetas"
          autoComplete="off"
          enterKeyHint="done"
          onFocus={() => setFoco(true)}
          onBlur={() => {
            setFoco(false)
            if (texto.trim()) agregar(texto)
          }}
          onChange={(e) => {
            const t = e.target.value
            if (t.endsWith(',')) agregar(t.slice(0, -1))
            else setTexto(t)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (texto.trim()) agregar(texto)
            } else if (e.key === 'Backspace' && !texto && valor.length) onCambio(valor.slice(0, -1))
          }}
        />
      </div>
      {foco && sugeridas.length > 0 && (
        <div className="chips" aria-label="Etiquetas que ya usaste">
          {sugeridas.map((e) => (
            <button type="button" key={e} className="chip" onMouseDown={(ev) => ev.preventDefault()} onClick={() => agregar(e)}>
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
