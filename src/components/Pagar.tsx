import { useState } from 'react'
import { db, nuevoBase } from '../db/db'
import type { Id, Moneda, Movimiento } from '../db/types'
import type { Datos } from '../lib/datos'
import { fmt } from '../lib/money'
import { cerrarSesion, type SesionCompra } from '../lib/sesion'

/** Total por moneda de los gastos de una compra. */
export function totalCompra(gastos: Movimiento[]): [Moneda, number][] {
  const t = new Map<Moneda, number>()
  for (const g of gastos) t.set(g.moneda, (t.get(g.moneda) ?? 0) + g.totalCent)
  return [...t.entries()]
}

export const textoTotal = (t: [Moneda, number][]) => t.map(([m, c]) => fmt(c, m)).join(' + ')

interface Props {
  datos: Datos
  sesion: SesionCompra
  gastos: Movimiento[]
  onCerrar: () => void
  onPagado: (texto: string) => void
}

/** Caja: resumen de la compra en curso, se elige el método de pago una vez y se cierra la compra. */
export function Pagar({ datos, sesion, gastos, onCerrar, onPagado }: Props) {
  const [metodoId, setMetodoId] = useState<Id | ''>(() => gastos.find((g) => g.metodoPagoId)?.metodoPagoId ?? '')
  const [ocupado, setOcupado] = useState(false)
  const total = textoTotal(totalCompra(gastos))

  async function confirmar() {
    setOcupado(true)
    const ahora = Date.now()
    await db.movimientos.bulkUpdate(
      gastos.map((g) => ({ key: g.id, changes: { metodoPagoId: metodoId || undefined, modificadoEn: ahora } })),
    )
    cerrarSesion()
    const metodo = datos.metodos.find((m) => m.id === metodoId)?.nombre
    onPagado(`Pagado ${total}${metodo ? ` con ${metodo}` : ''}`)
  }

  async function nuevoMetodo() {
    const nombre = prompt('Nuevo método de pago')?.trim()
    if (!nombre) return
    const base = nuevoBase()
    await db.metodosPago.add({ ...base, nombre })
    setMetodoId(base.id)
  }

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div className="hoja" role="dialog" aria-label="Pagar compra" onClick={(e) => e.stopPropagation()}>
        <div className="menu-seccion">
          <h3>Pagar en {sesion.lugar}</h3>
          <ul className="lista">
            {gastos.map((g) => (
              <li key={g.id} className="item-ajuste">
                <span>
                  {g.descripcion}
                  {g.cantidad > 1 && <small> ×{g.cantidad}</small>}
                </span>
                <span className="mov-monto">{fmt(g.totalCent, g.moneda)}</span>
              </li>
            ))}
          </ul>
          <p className="total-pagar">
            Total <strong>{total}</strong>
          </p>
          <label className="campo">
            <span>Método de pago</span>
            <select
              value={metodoId}
              onChange={(e) => (e.target.value === '+' ? void nuevoMetodo() : setMetodoId(e.target.value))}
            >
              <option value="">Sin especificar</option>
              {datos.metodos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
              <option value="+">+ Nuevo…</option>
            </select>
          </label>
        </div>
        <div className="acciones">
          <button type="button" className="cancelar" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="primario" disabled={ocupado} onClick={confirmar}>
            Confirmar pago
          </button>
        </div>
      </div>
    </div>
  )
}
