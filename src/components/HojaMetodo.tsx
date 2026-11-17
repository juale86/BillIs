import { useState } from 'react'
import { db, nuevoBase, personaPorNombre } from '../db/db'
import type { Id, MetodoPago, TipoMetodo } from '../db/types'
import type { Datos } from '../lib/datos'
import { pedirTexto } from '../lib/dialogos'
import { conTitular, tipoDe, TIPOS_METODO } from '../lib/metodos'
import { BotonCerrar } from './BotonCerrar'

/** Valor del select que pide el nombre de alguien nuevo. */
const OTRA = '\u0000otra'

/**
 * Un medio de pago: nombre, tipo (efectivo, billetera, débito, crédito, transferencia) y, las tarjetas,
 * de quién son. Con la tarjeta de otra persona, Pagar la propone como quien pagó.
 */
export function HojaMetodo(props: { datos: Datos; metodo?: MetodoPago; onCerrar: () => void; onGuardado?: (id: Id) => void }) {
  const { datos, metodo, onCerrar, onGuardado } = props
  const [nombre, setNombre] = useState(metodo?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoMetodo>(metodo ? tipoDe(metodo) : 'credito')
  const [titularId, setTitularId] = useState<Id>(metodo?.titularId ?? datos.yo?.id ?? '')
  const otras = datos.personas.filter((p) => !p.esYo)

  async function guardar() {
    const n = nombre.trim().slice(0, 40)
    if (!n) return
    const titular = conTitular(tipo) && titularId && titularId !== datos.yo?.id ? titularId : undefined
    const base = metodo ? { ...metodo, modificadoEn: Date.now() } : nuevoBase()
    await db.metodosPago.put({ ...base, nombre: n, tipo, titularId: titular })
    onGuardado?.(base.id)
    onCerrar()
  }

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <form
        className="hoja"
        role="dialog"
        aria-label={metodo ? `Medio de pago ${metodo.nombre}` : 'Nuevo medio de pago'}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
      >
        <div className="menu-seccion">
          <div className="hoja-cab">
            <h3>{metodo ? metodo.nombre : 'Nuevo medio de pago'}</h3>
            <BotonCerrar onClick={onCerrar} />
          </div>
          <label className="campo">
            <input
              value={nombre}
              autoFocus={!metodo}
              placeholder={tipo === 'credito' ? 'Nombre, ej. Visa Galicia' : 'Nombre, ej. Mercado Pago'}
              aria-label="Nombre"
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <label className="campo">
            <span>Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMetodo)}>
              {TIPOS_METODO.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
          {conTitular(tipo) && (
            <label className="campo">
              <span>De quién es la tarjeta</span>
              <select
                value={titularId}
                onChange={async (e) => {
                  if (e.target.value !== OTRA) return setTitularId(e.target.value)
                  const n = await pedirTexto({ titulo: '¿De quién es la tarjeta?', boton: 'Listo' })
                  if (n) setTitularId((await personaPorNombre(n)).id)
                }}
              >
                <option value={datos.yo?.id ?? ''}>{datos.yo?.nombre ?? 'Yo'} (vos)</option>
                {otras.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
                <option value={OTRA}>Otra persona…</option>
              </select>
            </label>
          )}
          <p className="nota">
            {tipo === 'credito'
              ? 'Con tarjeta de crédito se elige en cuántas cuotas. Si es de otra persona, al pagar queda como quien pagó.'
              : tipo === 'debito'
                ? 'Si es de otra persona, al pagar queda como quien pagó.'
                : 'Se elige al pagar una compra.'}
          </p>
        </div>
        <div className="acciones">
          <button type="button" className="secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="primario" disabled={!nombre.trim()}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  )
}
