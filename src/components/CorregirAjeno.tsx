import { useState } from 'react'
import { editarItem, type ItemLista } from '../lib/listaCompras'
import { BotonCerrar } from './BotonCerrar'

/**
 * El dueño de la lista corrige lo que compró otro miembro: producto, marca y cantidad.
 * El monto no: es el gasto de esa persona y vive en su teléfono.
 */
export default function CorregirAjeno({ listaId, item, onCerrar }: { listaId: string; item: ItemLista; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(item.nombre)
  const [marca, setMarca] = useState(item.marca ?? '')
  const [cantidad, setCantidad] = useState(item.cantidad ?? '')
  const [error, setError] = useState('')

  const guardar = () => {
    if (!nombre.trim()) return setError('Falta el producto')
    editarItem(listaId, item.id, { nombre, marca, cantidad, grupo: item.grupo ?? null })
      .then(onCerrar)
      .catch(() => setError('No se pudo guardar. Revisá la conexión.'))
  }

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <form
        className="hoja"
        role="dialog"
        aria-label={`Corregir ${item.nombre}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
      >
        <div className="hoja-cab">
          <h3>Corregir lo que compró {item.compradoPor ?? 'otro'}</h3>
          <BotonCerrar onClick={onCerrar} />
        </div>
        <div className="fila">
          <label className="campo crece">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Producto" aria-label="Producto" enterKeyHint="next" />
          </label>
        </div>
        <div className="fila">
          <label className="campo crece">
            <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca" aria-label="Marca" />
          </label>
          <label className="campo cant">
            <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cant" aria-label="Cantidad" />
          </label>
        </div>
        <p className="nota">El monto lo cambia solo quien lo compró.</p>
        {error && <p className="error">{error}</p>}
        <div className="acciones">
          <button type="button" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="primario">
            Guardar
          </button>
        </div>
      </form>
    </div>
  )
}
