/**
 * Confirmar y pedir un texto con el modal de la app en lugar de confirm() y prompt():
 * los nativos frenan la pantalla (y las pruebas automáticas) hasta que alguien contesta.
 * Se usan con await; el diálogo lo dibuja <Dialogos /> en App.
 */

interface PedidoDialogo {
  titulo: string
  /** Explicación debajo del título. */
  texto?: string
  /** Texto del botón que acepta. */
  boton?: string
  /** Acción destructiva: botón rojo. */
  peligro?: boolean
  /** Solo al pedir texto: lo que ya viene escrito y el teclado del teléfono. */
  valor?: string
  inputMode?: 'text' | 'decimal'
}

export interface Dialogo extends PedidoDialogo {
  /** Distinto en cada diálogo: uno nuevo arranca limpio aunque tenga el mismo título. */
  id: number
  responder: (valor: string | null) => void
}

let mostrar: ((d: Dialogo | null) => void) | null = null
let abierto: Dialogo | null = null
let ultimoId = 0

/** Para <Dialogos />: quién dibuja el diálogo abierto. Al desmontarse, lo abierto cuenta como cancelado. */
export function registrarDialogos(f: ((d: Dialogo | null) => void) | null) {
  if (!f) abierto?.responder(null)
  mostrar = f
}

/** Con `valor` (aunque sea '') pide un texto; sin él, solo confirma. */
function abrir(p: PedidoDialogo): Promise<string | null> {
  // <Dialogos /> está montado en la raíz desde el arranque; sin él no se acepta nada.
  if (!mostrar) return Promise.resolve(null)
  // Uno solo por vez: si había otro abierto, cuenta como cancelado.
  abierto?.responder(null)
  return new Promise((resolver) => {
    const d: Dialogo = {
      ...p,
      id: ++ultimoId,
      responder: (v) => {
        if (abierto !== d) return
        abierto = null
        mostrar?.(null)
        resolver(v)
      },
    }
    abierto = d
    mostrar!(d)
  })
}

/** true si aceptó. */
export const confirmar = async (p: Omit<PedidoDialogo, 'valor' | 'inputMode'>) => (await abrir(p)) !== null

/** El texto escrito (sin espacios de más), o null si canceló. */
export const pedirTexto = (p: PedidoDialogo) => abrir({ ...p, valor: p.valor ?? '' })
