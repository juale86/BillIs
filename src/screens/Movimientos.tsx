import { useMemo, useState, type ReactNode } from 'react'
import { Buscador } from '../components/Buscador'
import type { Movimiento } from '../db/types'
import { claveCompra, claveMes, parteDe } from '../lib/calculos'
import type { Datos } from '../lib/datos'
import { fmt } from '../lib/money'
import { filtrarMovs, hayFiltrosMov, SIN_FILTROS_MOV, type FiltrosMov } from '../lib/filtrosMov'
import { describirPromo } from '../lib/promo'
import { SelectorMes } from './SelectorMes'

interface Props {
  datos: Datos
  mes: number
  setMes: (m: number) => void
  onEditar: (m: Movimiento) => void
  onBorrar: (m: Movimiento) => void
  /** Abre el pago de una compra (en curso o ya pagada) por su clave. */
  onPagar: (clave: string) => void
  /** Clave de la compra en curso, si hay. */
  compraEnCurso: string | null
  buscando: boolean
  /** Botones al lado del mes (alertas, lupa). */
  acciones: ReactNode
  /** Se muestra debajo del mes (alertas abiertas). */
  panel?: ReactNode
  filtros: FiltrosMov
  setFiltros: (f: FiltrosMov) => void
}

const fmtDia = (t: number) =>
  new Date(t).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtHora = (t: number) => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

export function Movimientos(props: Props) {
  const { datos, mes, setMes, onEditar, onBorrar, onPagar, compraEnCurso, buscando, acciones, panel, filtros, setFiltros } = props
  const { movimientos, personas, categorias, metodos, yo } = datos
  const nombre = (id?: string) => personas.find((p) => p.id === id)?.nombre ?? ''

  /** Días → grupos (una compra o un movimiento suelto) → movimientos. */
  const dias = useMemo(() => {
    const delMes = filtrarMovs(movimientos, filtros, yo?.id)
      .filter((m) => claveMes(m.fecha) === mes)
      .sort((a, b) => b.fecha - a.fecha)
    const res: { dia: string; grupos: Movimiento[][] }[] = []
    for (const m of delMes) {
      const dia = new Date(m.fecha).toDateString()
      let d = res.at(-1)
      if (!d || d.dia !== dia) res.push((d = { dia, grupos: [] }))
      const g = m.tipo === 'gasto' ? d.grupos.find((g) => g[0].tipo === 'gasto' && claveCompra(g[0]) === claveCompra(m)) : undefined
      if (g) g.push(m)
      else d.grupos.push([m])
    }
    return res
  }, [movimientos, mes, filtros, yo?.id])

  /** Totales de lo que se ve: tu parte de los gastos e ingresos, por moneda. */
  const totales = useMemo(() => {
    const movs = dias.flatMap((d) => d.grupos.flat())
    const gastos = new Map<string, number>()
    const ingresos = new Map<string, number>()
    for (const m of movs) {
      if (m.tipo === 'gasto') gastos.set(m.moneda, (gastos.get(m.moneda) ?? 0) + parteDe(m))
      if (m.tipo === 'ingreso') ingresos.set(m.moneda, (ingresos.get(m.moneda) ?? 0) + m.totalCent)
    }
    const txt = (t: Map<string, number>) => [...t].map(([mon, c]) => fmt(c, mon as Movimiento['moneda'])).join(' + ')
    return { cantidad: movs.length, gastos: gastos.size ? txt(gastos) : fmt(0), ingresos: ingresos.size ? txt(ingresos) : null }
  }, [dias])
  const resumen = useMemo(() => {
    const { cantidad, gastos, ingresos } = totales
    const partes = [`${cantidad} ${cantidad === 1 ? 'resultado' : 'resultados'}`, `gastaste ${gastos} (tu parte)`]
    if (ingresos) partes.push(`cobraste ${ingresos}`)
    return partes.join(', ')
  }, [totales])

  // Solo la última compra (y la que está en curso) se ven abiertas; el resto se pliega.
  // Con filtros se abren todas para ver qué coincidió. Tocar la cabecera invierte.
  const [invertidas, setInvertidas] = useState<Set<string>>(() => new Set())
  const ultima = dias.flatMap((d) => d.grupos).find((g) => g[0].tipo === 'gasto')
  const abierta = (clave: string) =>
    (clave === (ultima && claveCompra(ultima[0])) || clave === compraEnCurso || hayFiltrosMov(filtros)) !==
    invertidas.has(clave)
  const alternar = (clave: string) =>
    setInvertidas((prev) => {
      const n = new Set(prev)
      if (!n.delete(clave)) n.add(clave)
      return n
    })

  /** Total, tu parte y cómo se pagó (o que está en curso). */
  function infoCompra(g: Movimiento[]) {
    const clave = claveCompra(g[0])
    const enCurso = clave === compraEnCurso
    const total = new Map<Movimiento['moneda'], number>()
    const mia = new Map<Movimiento['moneda'], number>()
    for (const m of g) {
      total.set(m.moneda, (total.get(m.moneda) ?? 0) + m.totalCent)
      mia.set(m.moneda, (mia.get(m.moneda) ?? 0) + parteDe(m))
    }
    const txt = (t: Map<Movimiento['moneda'], number>) => [...t].map(([mon, c]) => fmt(c, mon)).join(' + ')
    const distinta = [...total].some(([mon, c]) => mia.get(mon) !== c)
    const p = g[0]
    const pago = enCurso
      ? 'En curso: tocá para pagar'
      : [
          metodos.find((x) => x.id === p.metodoPagoId)?.nombre ?? 'Sin método',
          p.cuotas && `${p.cuotas.cantidad} cuotas`,
          p.pagadorId && p.pagadorId !== yo?.id && `pagó ${nombre(p.pagadorId)}`,
          p.contraparteId && p.parte?.modo !== 'todo' && `con ${nombre(p.contraparteId)}`,
        ]
          .filter(Boolean)
          .join(', ')
    return { clave, enCurso, total: txt(total), mia: distinta ? txt(mia) : null, pago }
  }

  function compra(g: Movimiento[]) {
    const { clave, enCurso, total, mia, pago } = infoCompra(g)
    const abierto = abierta(clave)
    const titulo = g[0].lugar || (g.length === 1 ? g[0].descripcion : 'Compra')
    return (
      <div key={clave} className={'compra' + (abierto ? '' : ' plegada')}>
        <button className="compra-cab" aria-expanded={abierto} onClick={() => alternar(clave)}>
          <span>
            {titulo}{' '}
            <small>
              {fmtHora(g.at(-1)!.fecha)}, {g.length} {g.length === 1 ? 'ítem' : 'ítems'}
              {!abierto && `, ${pago}`}
            </small>
          </span>
          <span className="compra-cab-der">
            {!abierto && <strong>{total}</strong>}
            <span aria-hidden="true">{abierto ? '▾' : '▸'}</span>
          </span>
        </button>
        {abierto && (
          <>
            <ul className="lista">{g.map(fila)}</ul>
            <button className={'compra-pie' + (enCurso ? ' en-curso' : '')} onClick={() => onPagar(clave)}>
              <span className="compra-pie-fila">
                <span>Total</span>
                <strong>{total}</strong>
              </span>
              <span className="compra-pie-fila">
                <small>{pago}</small>
                {mia && <small>tu parte {mia}</small>}
              </span>
            </button>
          </>
        )}
      </div>
    )
  }

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
    if (m.comentario) partes.push(`“${m.comentario}”`)
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
      <SelectorMes mes={mes} setMes={setMes} extra={acciones} />
      {panel}
      <Buscador
        abierto={buscando}
        texto={filtros.texto}
        setTexto={(texto) => setFiltros({ ...filtros, texto })}
        placeholder="Buscar en el mes"
        opciones={[
          ...(filtros.tipo
            ? []
            : [
                { etiqueta: 'Gastos', onElegir: () => setFiltros({ ...filtros, tipo: 'gasto' }) },
                { etiqueta: 'Ingresos', onElegir: () => setFiltros({ ...filtros, tipo: 'ingreso' }) },
              ]),
          ...(filtros.pagoOtro ? [] : [{ etiqueta: 'Pagó otro', onElegir: () => setFiltros({ ...filtros, pagoOtro: true }) }]),
          ...(filtros.categoriaId
            ? []
            : categorias
                .filter((c) => !filtros.tipo || c.tipo === filtros.tipo)
                .map((c) => ({ etiqueta: c.nombre, onElegir: () => setFiltros({ ...filtros, categoriaId: c.id }) }))),
        ]}
        activos={[
          ...(filtros.tipo
            ? [{ etiqueta: filtros.tipo === 'gasto' ? 'Gastos' : 'Ingresos', onQuitar: () => setFiltros({ ...filtros, tipo: null }) }]
            : []),
          ...(filtros.pagoOtro ? [{ etiqueta: 'Pagó otro', onQuitar: () => setFiltros({ ...filtros, pagoOtro: false }) }] : []),
          ...(filtros.categoriaId
            ? [
                {
                  etiqueta: categorias.find((c) => c.id === filtros.categoriaId)?.nombre ?? 'Categoría',
                  onQuitar: () => setFiltros({ ...filtros, categoriaId: null }),
                },
              ]
            : []),
        ]}
        resumen={resumen}
        onLimpiar={() => setFiltros(SIN_FILTROS_MOV)}
      />
      {dias.length === 0 && (
        <p className="vacio">{hayFiltrosMov(filtros) ? 'Nada coincide con los filtros en este mes.' : 'No hay movimientos este mes.'}</p>
      )}
      {dias.map((d) => (
        <div key={d.dia} className="dia">
          <h3>{fmtDia(d.grupos[0][0].fecha)}</h3>
          {d.grupos.map((g) =>
            g[0].tipo === 'gasto' ? (
              compra(g)
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
