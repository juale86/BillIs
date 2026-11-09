import { useState } from 'react'
import { db, normalizar, nuevoBase, personaPorNombre } from '../db/db'
import type { Id, ModoParte, Moneda, Movimiento, Parte } from '../db/types'
import type { Datos } from '../lib/datos'
import { fmt } from '../lib/money'
import { miParte } from '../lib/promo'
import { cerrarSesion, guardarPagador, ultimoPagador } from '../lib/sesion'
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
  lugar?: string
  /** true: es la compra en curso (al confirmar se cierra). false: se corrige el pago de una compra ya cerrada. */
  enCurso: boolean
  gastos: Movimiento[]
  onCerrar: () => void
  onPagado: (texto: string) => void
}

/** Caja: resumen de la compra en curso; método de pago, cuotas, pagador y tu parte se eligen una vez y se cierra la compra. */
export function Pagar({ datos, lugar, enCurso, gastos, onCerrar, onPagado }: Props) {
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
  // Arranca con lo que ya tiene la compra (al corregir un pago) o con el último pagador (al pagar).
  const primero = gastos[0]
  const nombreDe = (id?: Id) => datos.personas.find((x) => x.id === id)?.nombre
  const [pagador, setPagador] = useState(() =>
    enCurso ? (ultimoPagador() ?? nombreYo) : (nombreDe(primero?.pagadorId) ?? nombreYo),
  )
  const [parteModo, setParteModo] = useState<ModoParte>(() => (enCurso ? 'todo' : (primero?.parte?.modo ?? 'todo')))
  const [partePct, setPartePct] = useState(() => String(primero?.parte?.pct ?? 50))
  const [contraparte, setContraparte] = useState(() => (enCurso ? '' : (nombreDe(primero?.contraparteId) ?? '')))
  const [error, setError] = useState('')
  const pagadorEsYo = normalizar(pagador.trim() || nombreYo) === normalizar(nombreYo)
  const parte: Parte =
    parteModo === 'pct' ? { modo: 'pct', pct: Math.min(100, Math.max(0, Number(partePct) || 0)) } : { modo: parteModo }
  // Lo que te toca y lo que le toca al otro, por moneda.
  const porMoneda = totalCompra(gastos)
  const mio = porMoneda.map(([m, c]) => [m, miParte(c, parte)] as [Moneda, number])
  const delOtro = porMoneda.map(([m, c], i) => [m, c - mio[i][1]] as [Moneda, number])
  const conMonto = (t: [Moneda, number][]) => textoTotal(t.filter(([, c]) => c > 0))

  async function confirmar() {
    const compartido = pagadorEsYo && parteModo !== 'todo'
    if (compartido && !contraparte.trim()) return setError('¿Con quién compartiste la compra?')
    setOcupado(true)
    const ahora = Date.now()
    const nombrePagador = pagador.trim() || nombreYo
    const esYo = pagadorEsYo
    const p = esYo && datos.yo ? datos.yo : await personaPorNombre(nombrePagador)
    const otro = compartido ? (await personaPorNombre(contraparte)).id : undefined
    guardarPagador(nombrePagador)
    await db.movimientos.bulkUpdate(
      gastos.map((g) => ({
        key: g.id,
        changes: {
          metodoPagoId: metodoId || undefined,
          pagadorId: p.id,
          // "Compartido con" solo tiene sentido si pagaste vos.
          contraparteId: otro,
          parte,
          miParteCent: miParte(g.totalCent, parte),
          modificadoEn: ahora,
          // Se reparte cada producto en las mismas cuotas, sin interés.
          ...(g.moneda === 'ARS' && { cuotas: n > 1 ? (g.cuotas?.cantidad === n ? g.cuotas : { cantidad: n }) : undefined }),
        },
      })),
    )
    if (enCurso) cerrarSesion()
    const metodo = datos.metodos.find((m) => m.id === metodoId)?.nombre
    if (!enCurso) return onPagado('Pago actualizado')
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
          <h3>
            {enCurso ? 'Pagar' : 'Pago'}
            {lugar ? ` en ${lugar}` : ''}
          </h3>
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
          <div className="campo">
            <span>Mi parte</span>
            <div className="segmentos">
              {(['todo', 'mitad', 'nada', 'pct'] as ModoParte[]).map((m) => (
                <button type="button" key={m} aria-pressed={parteModo === m} onClick={() => setParteModo(m)}>
                  {{ todo: 'Todo', mitad: 'Mitad', nada: 'Nada', pct: '%' }[m]}
                </button>
              ))}
            </div>
            {parteModo === 'pct' && (
              <input
                className="chico"
                value={partePct}
                inputMode="numeric"
                aria-label="Porcentaje que te toca"
                onChange={(e) => setPartePct(e.target.value)}
              />
            )}
          </div>
          {pagadorEsYo && parteModo !== 'todo' && (
            <label className="campo">
              <span>Compartido con *</span>
              <input
                value={contraparte}
                autoComplete="off"
                onChange={(e) => {
                  setContraparte(e.target.value)
                  setError('')
                }}
              />
              <Chips
                opciones={otras}
                activo={contraparte}
                onElegir={(c) => {
                  setContraparte(c)
                  setError('')
                }}
              />
            </label>
          )}
          {(parteModo !== 'todo' || !pagadorEsYo) && (
            <p className="calculo">
              {pagadorEsYo
                ? `${contraparte || 'La otra persona'} te debe ${conMonto(delOtro)}`
                : mio.some(([, c]) => c > 0)
                  ? `Le debés ${conMonto(mio)} a ${pagador}`
                  : 'Solo registro: no debés nada'}
            </p>
          )}
          {error && <p className="error">{error}</p>}
        </div>
        <div className="acciones">
          <button type="button" className="cancelar" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="primario" disabled={ocupado} onClick={confirmar}>
            {enCurso ? 'Confirmar pago' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
