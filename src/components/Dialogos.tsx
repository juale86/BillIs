import { useEffect, useState } from 'react'
import { registrarDialogos, type Dialogo } from '../lib/dialogos'
import { Modal } from './Modal'

/** Dibuja el diálogo que piden confirmar() y pedirTexto(). Va una sola vez, en App. */
export function Dialogos() {
  const [d, setD] = useState<Dialogo | null>(null)
  useEffect(() => {
    registrarDialogos(setD)
    return () => registrarDialogos(null)
  }, [])
  if (!d) return null
  return (
    <Modal
      // Uno nuevo arranca con su propio texto.
      key={d.id}
      titulo={d.titulo}
      valorInicial={d.valor}
      inputMode={d.inputMode}
      etiquetaConfirmar={d.boton ?? 'Aceptar'}
      peligro={d.peligro}
      onConfirmar={(v) => d.responder(v)}
      onCancelar={() => d.responder(null)}
    >
      {d.texto}
    </Modal>
  )
}
