import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'

interface Estado {
  desde: number
  hasta: number
  dy: number
}

/**
 * Reordenar una lista arrastrando una manija (dedo o mouse).
 * La fila arrastrada sigue al puntero y las demás se corren para hacerle lugar;
 * al soltar se llama onSoltar(desde, hasta) con los índices.
 */
export function useArrastre(onSoltar: (desde: number, hasta: number) => void) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const inicio = useRef<{ y0: number; centros: number[]; salto: number } | null>(null)

  function onPointerDown(e: PointerEvent<HTMLElement>, i: number) {
    const li = e.currentTarget.closest('li')
    const filas = li?.parentElement ? [...li.parentElement.children] : []
    if (!li || filas.length < 2) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rects = filas.map((f) => f.getBoundingClientRect())
    inicio.current = {
      y0: e.clientY,
      centros: rects.map((r) => r.top + r.height / 2),
      // Lo que se corre cada vecina: el alto de la fila arrastrada más el espacio entre filas.
      salto: rects[1].top - rects[0].top - rects[0].height + rects[i].height,
    }
    setEstado({ desde: i, hasta: i, dy: 0 })
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const ini = inicio.current
    if (!ini || !estado) return
    const dy = e.clientY - ini.y0
    const centro = ini.centros[estado.desde] + dy
    const hasta = ini.centros.filter((c, j) => j !== estado.desde && c < centro).length
    setEstado({ ...estado, dy, hasta })
  }

  function onPointerUp() {
    if (estado && estado.hasta !== estado.desde) onSoltar(estado.desde, estado.hasta)
    inicio.current = null
    setEstado(null)
  }

  /** Estilo de cada fila mientras se arrastra. */
  function estilo(j: number): CSSProperties | undefined {
    if (!estado || !inicio.current) return undefined
    const { desde, hasta, dy } = estado
    if (j === desde) return { transform: `translateY(${dy}px)`, position: 'relative', zIndex: 2 }
    const s = inicio.current.salto
    if (desde < j && j <= hasta) return { transform: `translateY(${-s}px)`, transition: 'transform 0.15s' }
    if (hasta <= j && j < desde) return { transform: `translateY(${s}px)`, transition: 'transform 0.15s' }
    return { transition: 'transform 0.15s' }
  }

  const manija = (i: number) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => onPointerDown(e, i),
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  })

  return { arrastrando: estado?.desde ?? null, estilo, manija }
}

/** Orden nuevo para un ítem movido de `desde` a `hasta`, entre sus nuevos vecinos. */
export function ordenEntre(ordenes: number[], desde: number, hasta: number): number {
  const resto = ordenes.filter((_, j) => j !== desde)
  const antes = resto[hasta - 1]
  const despues = resto[hasta]
  if (antes !== undefined && despues !== undefined) return (antes + despues) / 2
  if (antes !== undefined) return antes + 1000
  return despues - 1000
}
