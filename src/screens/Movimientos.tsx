import { useMemo } from 'react'
import type { Movimiento } from '../db/types'
import { claveMes } from '../lib/calculos'
import type { Datos } from '../lib/datos'
import { fmt } from '../lib/money'
import { describirPromo } from '../lib/promo'
import { SelectorMes } from './SelectorMes'

interface Props {
  datos: Datos
  mes: number
  setMes: (m: number) => void
  onEditar: (m: Movimiento) => void
  onBorrar: (m: Movimiento) => void
}

const fmtDia = (t: number) =>
  new Date(t).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtHora = (t: number) => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

export function Movimientos({ datos, mes, setMes, onEditar, onBorrar }: Props) {
  const { movimientos, personas, categorias, yo } = datos
  const nombre = (id?: string) => personas.find((p) => p.id === id)?.nombre ?? ''

  /** Días → grupos (una compra o un movimiento suelto) → movimientos. */
  const dias = useMemo(() => {
    const delMes = movimientos.filter((m) => claveMes(m.fecha) === mes).sort((a, b) => b.fecha - a.fecha)
    const res: { dia: string; grupos: Movimiento[][] }[] = []
    for (const m of delMes) {
      const dia = new Date(m.fecha).toDateString()
      let d = res.at(-1)
      if (!d || d.dia !== dia) res.push((d = { dia, grupos: [] }))
      const g = d.grupos.find((g) => m.compraId && g[0].compraId === m.compraId)
      if (g) g.push(m)
      else d.grupos.push([m])
    }
    return res
  }, [movimientos, mes])

  function detalle(m: Movimiento): string {
    const partes: string[] = []
    if (m.marca) partes.push(m.marca)
    if (m.cantidad > 1) partes.push(`${m.cantidad} u.`)
    if (m.promo) partes.push(describirPromo(m.promo))
    if (m.cuotas) partes.push(`${m.cuotas.cantidad} cuotas`)
    const cat = categorias.find((c) => c.id === m.categoriaId)
    if (cat) partes.push(cat.nombre)
    if (m.tipo === 'gasto' && m.pagadorId && m.pagadorId !== yo?.id) partes.push(`pagó ${nombre(m.pagadorId)}`)
    if (m.tipo === 'pagoDeuda')
      partes.push(m.pagadorId === yo?.id ? `a ${nombre(m.contraparteId)}` : `de ${nombre(m.pagadorId)}`)
    return partes.join(', ')
  }

  const fila = (m: Movimiento) => (
    <li key={m.id}>
      <button
        className="mov"
        onClick={() =>
          m.tipo === 'pagoDeuda' ? confirm('¿Borrar este pago de deuda?') && onBorrar(m) : onEditar(m)
        }
      >
        <span className="mov-texto">
          <span className="mov-desc">{m.tipo === 'pagoDeuda' ? 'Pago de deuda' : m.descripcion}</span>
          <span className="mov-det">{detalle(m)}</span>
        </span>
        <span className={'mov-monto ' + m.tipo}>
          {m.tipo === 'ingreso' ? '+' : m.tipo === 'gasto' ? '−' : ''}
          {fmt(m.totalCent, m.moneda)}
          {m.tipo === 'gasto' && m.miParteCent !== undefined && m.miParteCent !== m.totalCent && (
            <small>tu parte {fmt(m.miParteCent, m.moneda)}</small>
          )}
        </span>
      </button>
    </li>
  )

  return (
    <section className="pantalla">
      <SelectorMes mes={mes} setMes={setMes} />
      {dias.length === 0 && <p className="vacio">No hay movimientos este mes.</p>}
      {dias.map((d) => (
        <div key={d.dia} className="dia">
          <h3>{fmtDia(d.grupos[0][0].fecha)}</h3>
          {d.grupos.map((g) =>
            g.length > 1 ? (
              <div key={g[0].id} className="compra">
                <div className="compra-cab">
                  <span>
                    {g[0].lugar || 'Compra'} <small>{fmtHora(g.at(-1)!.fecha)}, {g.length} ítems</small>
                  </span>
                  <span>{fmt(g.reduce((s, m) => s + m.totalCent, 0), g[0].moneda)}</span>
                </div>
                <ul className="lista">{g.map(fila)}</ul>
              </div>
            ) : (
              <ul key={g[0].id} className="lista">
                {fila(g[0])}
              </ul>
            ),
          )}
        </div>
      ))}
    </section>
  )
}
