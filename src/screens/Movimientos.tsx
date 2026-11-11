import { Fragment, lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { amPm } from '../lib/hora'
import { NombreItem } from '../components/NombreItem'
import { textoCantidad } from '../lib/cantidad'
import { BotonOrden } from '../components/BotonOrden'
import type { Otros } from '../components/CompradosDeOtros'
import { BotonLupa, Buscador } from '../components/Buscador'
import { normalizar } from '../db/db'
import type { Movimiento } from '../db/types'
import { claveCompra, claveMes, parteDe } from '../lib/calculos'
import type { Datos } from '../lib/datos'
import { fmt } from '../lib/money'
import { filtrarMovs, hayFiltrosMov, SIN_FILTROS_MOV, type FiltrosMov } from '../lib/filtrosMov'
import { sugerirGrupo } from '../lib/grupos'
import type { OrdenLista } from '../lib/orden'
import { firebaseConfig } from '../lib/firebase-config'
import type { ItemLista } from '../lib/listaCompras'
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

const CompradosDeOtros = lazy(() => import('../components/CompradosDeOtros'))

/** Un renglón de una compra: un gasto tuyo o algo que compró otro miembro de la lista (solo para ver). */
interface Renglon {
  id: string
  nombre: string
  marca: string
  /** Cuándo se cargó o se compró, para el orden manual. */
  t: number
  mov?: Movimiento
  ajeno?: ItemLista
}

const fmtDia = (t: number) =>
  new Date(t).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtHora = (t: number) => amPm(new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))

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

  // Las flechas del mes saltan entre los meses con movimientos (y el actual, para poder volver).
  const mesesConMovs = useMemo(
    () => [...new Set([...movimientos.map((m) => claveMes(m.fecha)), claveMes(Date.now())])],
    [movimientos],
  )

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

  // Cada compra tiene su propio orden y su propia lupa (texto; ausente = lupa cerrada). Viven mientras la app está abierta.
  const [ordenes, setOrdenes] = useState<Record<string, OrdenLista>>({})
  const [lupas, setLupas] = useState<Record<string, string>>({})
  const setLupa = (clave: string, texto: string | null) =>
    setLupas((prev) => {
      const n = { ...prev }
      if (texto === null) delete n[clave]
      else n[clave] = texto
      return n
    })

  // Lo que compraron los demás en las listas de este mes (se carga aparte, con Firebase).
  const listaIds = useMemo(
    () =>
      [...new Set(movimientos.filter((m) => claveMes(m.fecha) === mes && m.listaItem).map((m) => m.listaItem!.listaId))].sort(),
    [movimientos, mes],
  )
  const [otros, setOtros] = useState<Otros>({ uid: null, items: {} })

  /**
   * Lo que otros compraron, repartido entre tus compras por la lista: va a tu compra con esa lista.
   * Si usaste la lista en más de una compra, a la más cercana en el tiempo.
   */
  const ajenosPorCompra = useMemo(() => {
    const compras = new Map<string, { clave: string; desde: number; hasta: number }[]>()
    const mios = new Set<string>()
    for (const m of movimientos) {
      if (!m.listaItem) continue
      mios.add(m.listaItem.itemId)
      const delaLista = compras.get(m.listaItem.listaId) ?? []
      compras.set(m.listaItem.listaId, delaLista)
      const clave = claveCompra(m)
      const c = delaLista.find((x) => x.clave === clave)
      if (c) {
        c.desde = Math.min(c.desde, m.fecha)
        c.hasta = Math.max(c.hasta, m.fecha)
      } else delaLista.push({ clave, desde: m.fecha, hasta: m.fecha })
    }
    const res = new Map<string, ItemLista[]>()
    for (const [listaId, items] of Object.entries(otros.items)) {
      const candidatas = compras.get(listaId) ?? []
      for (const it of items) {
        if (mios.has(it.id) || candidatas.length === 0) continue
        const t = it.modificadoEn
        const lejos = (c: { desde: number; hasta: number }) => (t < c.desde ? c.desde - t : t > c.hasta ? t - c.hasta : 0)
        const c = candidatas.reduce((a, b) => (lejos(b) < lejos(a) ? b : a))
        res.set(c.clave, [...(res.get(c.clave) ?? []), it])
      }
    }
    return res
  }, [movimientos, otros])

  /** Los renglones de una compra filtrados por su lupa y en su orden, en secciones (una sola salvo "por grupos"). */
  function itemsDe(clave: string, renglones: Renglon[]): { titulo: string | null; items: Renglon[] }[] {
    const q = normalizar(lupas[clave] ?? '')
    const vistos = q ? renglones.filter((r) => normalizar(`${r.nombre} ${r.marca}`).includes(q)) : renglones
    const orden = ordenes[clave] ?? 'manual'
    // Manual: como se fueron cargando, lo último arriba (lo que ya se veía).
    if (orden === 'manual') return [{ titulo: null, items: vistos }]
    const az = [...vistos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    if (orden === 'alfabetico') return [{ titulo: null, items: az }]
    const grupoDe = (r: Renglon) =>
      (r.ajeno?.grupo && datos.grupos.some((x) => x.id === r.ajeno!.grupo) ? r.ajeno.grupo : null) ??
      sugerirGrupo(r.nombre, r.marca, datos.gruposAprendidos, [], datos.grupos)
    const secciones = datos.grupos.map((gr) => ({ titulo: gr.nombre, items: az.filter((r) => grupoDe(r) === gr.id) }))
    secciones.push({ titulo: 'Sin grupo', items: az.filter((r) => !grupoDe(r)) })
    return secciones.filter((x) => x.items.length > 0)
  }

  /** Total, tu parte y cómo se pagó (o que está en curso). */
  function infoCompra(g: Movimiento[]) {
    const clave = claveCompra(g[0])
    const enCurso = clave === compraEnCurso
    const ajenos = ajenosPorCompra.get(clave) ?? []
    const total = new Map<Movimiento['moneda'], number>()
    const mia = new Map<Movimiento['moneda'], number>()
    for (const m of g) {
      total.set(m.moneda, (total.get(m.moneda) ?? 0) + m.totalCent)
      mia.set(m.moneda, (mia.get(m.moneda) ?? 0) + parteDe(m))
    }
    const txt = (t: Map<Movimiento['moneda'], number>) => [...t].map(([mon, c]) => fmt(c, mon)).join(' + ')
    const distinta = [...total].some(([mon, c]) => mia.get(mon) !== c)
    // Total real: lo tuyo más lo que pagaron los demás por sus ítems.
    const real = new Map(total)
    for (const it of ajenos)
      if (it.montoCent !== null) real.set(it.moneda ?? 'ARS', (real.get(it.moneda ?? 'ARS') ?? 0) + it.montoCent)
    // Con lo de otros miembros, el pie dice "Total" (el real) y aparte "Solo lo tuyo", sin nombres.
    const conOtros = ajenos.length > 0 ? 'Total' : null
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
    return { clave, enCurso, ajenos, total: txt(total), real: txt(real), conOtros, mia: distinta ? txt(mia) : null, pago }
  }

  function compra(g: Movimiento[]) {
    const { clave, enCurso, ajenos, total, real, conOtros, mia, pago } = infoCompra(g)
    const abierto = abierta(clave)
    const renglones: Renglon[] = [
      ...g.map((m) => ({ id: m.id, nombre: m.descripcion, marca: m.marca ?? '', t: m.fecha, mov: m })),
      ...ajenos.map((it) => ({ id: `otro-${it.id}`, nombre: it.nombre, marca: it.marca ?? '', t: it.modificadoEn, ajeno: it })),
    ].sort((a, b) => b.t - a.t)
    const n = renglones.length
    const titulo = g[0].lugar || (n === 1 ? g[0].descripcion : 'Compra')
    // Lupa y orden solo tienen sentido abierta y con más de un ítem.
    const conAcciones = abierto && n > 1
    const lupa = lupas[clave]
    const secciones = conAcciones ? itemsDe(clave, renglones) : [{ titulo: null, items: renglones }]
    return (
      <div key={clave} className={'compra' + (abierto ? '' : ' plegada')}>
        <div className="compra-cab-fila">
          <button className="compra-cab" aria-expanded={abierto} onClick={() => alternar(clave)}>
            <span>
              {titulo}{' '}
              <small>
                {fmtHora(g.at(-1)!.fecha)}, {n} {n === 1 ? 'ítem' : 'ítems'}
                {!abierto && `, ${pago}`}
              </small>
            </span>
            {!abierto && (
              <span className="compra-cab-der">
                <strong>{conOtros ? real : total}</strong>
              </span>
            )}
          </button>
          {conAcciones && (
            <span className="compra-acciones">
              <BotonLupa
                abierto={lupa !== undefined}
                filtrando={!!lupa}
                chico
                onClick={() => setLupa(clave, lupa === undefined ? '' : null)}
              />
              <BotonOrden
                chico
                orden={ordenes[clave] ?? 'manual'}
                onCambiar={(o) => setOrdenes((prev) => ({ ...prev, [clave]: o }))}
              />
            </span>
          )}
          {/* Siempre a la derecha: lupa y orden aparecen a su izquierda al desplegar. */}
          <button
            className="icono borde chico compra-plegar"
            aria-expanded={abierto}
            aria-label={abierto ? `Plegar ${titulo}` : `Desplegar ${titulo}`}
            onClick={() => alternar(clave)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {conAcciones && lupa !== undefined && (
          <input
            className="compra-buscar"
            autoFocus
            value={lupa}
            onChange={(e) => setLupa(clave, e.target.value)}
            placeholder={`Buscar en ${titulo}`}
            aria-label={`Buscar en ${titulo}`}
          />
        )}
        {abierto && (
          <>
            {secciones.length === 0 && <p className="vacio chico">Nada coincide en esta compra.</p>}
            {secciones.map((sec) => (
              <Fragment key={sec.titulo ?? ''}>
                {sec.titulo && (
                  <div className="lista-sub grupo-tit">
                    <span>{sec.titulo}</span>
                  </div>
                )}
                <ul className="lista">{sec.items.map((r) => (r.mov ? fila(r.mov) : filaAjena(r.ajeno!)))}</ul>
              </Fragment>
            ))}
            <button className={'compra-pie' + (enCurso ? ' en-curso' : '')} onClick={() => onPagar(clave)}>
              {conOtros ? (
                <>
                  <span className="compra-pie-fila">
                    <span>{conOtros}</span>
                    <strong>{real}</strong>
                  </span>
                  <span className="compra-pie-fila solo-tuyo">
                    <span>Solo lo tuyo</span>
                    <span>{total}</span>
                  </span>
                </>
              ) : (
                <span className="compra-pie-fila">
                  <span>Total</span>
                  <strong>{total}</strong>
                </span>
              )}
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
    if (m.promo) partes.push(describirPromo(m.promo))
    if (m.cuotas) partes.push(`${m.cuotas.cantidad} cuotas`)
    if (m.tipo === 'gasto' && m.pagadorId && m.pagadorId !== yo?.id) partes.push(`pagó ${nombre(m.pagadorId)}`)
    if (m.tipo === 'pagoDeuda')
      partes.push(m.pagadorId === yo?.id ? `a ${nombre(m.contraparteId)}` : `de ${nombre(m.pagadorId)}`)
    if (m.comentario) partes.push(`“${m.comentario}”`)
    return partes.join(', ')
  }

  /** Lo que compró otro miembro: se ve y se busca, pero solo quien lo compró lo puede cambiar. */
  const filaAjena = (it: ItemLista) => (
    <li key={`otro-${it.id}`}>
      <div className="mov ajeno">
        <span className="mov-texto">
          <NombreItem nombre={it.nombre} marca={it.marca} cantidad={textoCantidad(it.cantidad)} />
          <span className="mov-det">compró {it.compradoPor ?? 'otro'}</span>
        </span>
        <span className="mov-monto">{it.montoCent !== null ? fmt(it.montoCent, it.moneda ?? 'ARS') : 'sin monto'}</span>
      </div>
    </li>
  )

  const fila = (m: Movimiento) => (
    <li key={m.id}>
      <button
        className="mov"
        onClick={() =>
          m.tipo === 'pagoDeuda' ? confirm('¿Borrar este pago de deuda?') && onBorrar(m) : onEditar(m)
        }
      >
        <span className="mov-texto">
          {m.tipo === 'pagoDeuda' ? (
            <span className="mov-desc">Pago de deuda</span>
          ) : (
            <NombreItem nombre={m.descripcion} marca={m.marca} cantidad={m.cantidad > 1 ? textoCantidad(m.cantidad) : ''} />
          )}
          {detalle(m) && <span className="mov-det">{detalle(m)}</span>}
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
      <SelectorMes mes={mes} setMes={setMes} extra={acciones} meses={mesesConMovs} />
      {firebaseConfig && listaIds.length > 0 && (
        <Suspense fallback={null}>
          <CompradosDeOtros listaIds={listaIds} onCambio={setOtros} />
        </Suspense>
      )}
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
