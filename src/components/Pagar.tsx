import { useState } from 'react'
import { db, normalizar, nuevoBase, personaPorNombre } from '../db/db'
import type { Id, Moneda, Movimiento } from '../db/types'
import type { Datos } from '../lib/datos'
import { fmt } from '../lib/money'
import { cerrarSesion, guardarPagador, ultimoPagador, type SesionCompra } from '../lib/sesion'
import { Chips } from './Chips'
import { MetodoCuotas } from './MetodoCuotas'

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

/** Caja: resumen de la compra en curso; método de pago, cuotas y pagador se eligen una vez y se cierra la compra. */
export function Pagar({ datos, sesion, gastos, onCerrar, onPagado }: Props) {
  const [metodoId, setMetodoId] = useState<Id | ''>(() => gastos.find((g) => g.metodoPagoId)?.metodoPagoId ?? '')
  const [ocupado, setOcupado] = useState(false)
  const total = textoTotal(totalCompra(gastos))
  // Las cuotas aplican a los gastos en pesos (en dólares no se usan cuotas).
  const enPesos = gastos.filter((g) => g.moneda === 'ARS')
  const [cuotas, setCuotas] = useState(() => String(enPesos.find((g) => g.cuotas)?.cuotas?.cantidad ?? 1))
  const n = Math.max(1, Math.round(Number(cuotas) || 1))
  const totalPesos = enPesos.reduce((t, g) => t + g.totalCent, 0)
  const nombreYo = datos.yo?.nombre ?? 'Yo'
  const otras = datos.personas.filter((p) => !p.esYo).map((p) => p.nombre)
  const [pagador, setPagador] = useState(() => ultimoPagador() ?? nombreYo)

  async function confirmar() {
    setOcupado(true)
    const ahora = Date.now()
    const nombrePagador = pagador.trim() || nombreYo
    const esYo = normalizar(nombrePagador) === normalizar(nombreYo)
    const p = esYo && datos.yo ? datos.yo : await personaPorNombre(nombrePagador)
    guardarPagador(nombrePagador)
    await db.movimientos.bulkUpdate(
      gastos.map((g) => ({
        key: g.id,
        changes: {
          metodoPagoId: metodoId || undefined,
          pagadorId: p.id,
          // "Compartido con" solo tiene sentido si pagaste vos.
          ...(!esYo && { contraparteId: undefined }),
          modificadoEn: ahora,
          // Se reparte cada producto en las mismas cuotas, sin interés.
          ...(g.moneda === 'ARS' && { cuotas: n > 1 ? { cantidad: n } : undefined }),
        },
      })),
    )
    cerrarSesion()
    const metodo = datos.metodos.find((m) => m.id === metodoId)?.nombre
    onPagado(`${esYo ? 'Pagado' : `Pagó ${nombrePagador}`} ${total}${metodo ? ` con ${metodo}` : ''}${n > 1 ? ` en ${n} cuotas` : ''}`)
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
          <div className="fila">
            <MetodoCuotas
              etiqueta="Método de pago"
              vacio="Sin especificar"
              metodos={datos.metodos}
              metodoId={metodoId}
              onMetodo={setMetodoId}
              onNuevoMetodo={() => void nuevoMetodo()}
              cuotas={enPesos.length ? cuotas : undefined}
              onCuotas={setCuotas}
            />
          </div>
          {n > 1 && totalPesos > 0 && (
            <p className="calculo">
              {n} cuotas de {fmt(Math.round(totalPesos / n))}
            </p>
          )}
          <label className="campo">
            <span>Pagador</span>
            <input value={pagador} autoComplete="off" onChange={(e) => setPagador(e.target.value)} />
            <Chips opciones={otras.length ? [nombreYo, ...otras] : []} activo={pagador} onElegir={setPagador} />
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
