import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { confirmar } from './lib/dialogos'
import { registrarErrores } from './lib/avisos'
import { BotonLupa } from './components/Buscador'
import { Calculadora } from './components/Calculadora'
import { FormMovimiento, type Correccion } from './components/FormMovimiento'
import { Pagar, textoTotal, totalCompra } from './components/Pagar'
import { db, inicializar, setAjuste } from './db/db'
import type { Movimiento } from './db/types'
import { claveCompra, claveMes } from './lib/calculos'
import { useDatos } from './lib/datos'
import { cargaDe, cargaDeItem } from './lib/historial'
import { hayFiltrosMov, SIN_FILTROS_MOV, type FiltrosMov } from './lib/filtrosMov'
import type { FiltrosLista, ItemLista } from './lib/listaCompras'
import { necesitaRespaldo, pedirPersistencia } from './lib/respaldo'
import { sesionAbierta } from './lib/sesion'
import { Ajustes } from './screens/Ajustes'
import { Movimientos } from './screens/Movimientos'
import { Resumen } from './screens/Resumen'

// Firebase pesa: las listas y las tareas se cargan recién cuando se abren.
const Lista = lazy(() => import('./screens/Lista'))
const Tareas = lazy(() => import('./screens/Tareas'))
const listaCompras = () => import('./lib/listaCompras')

type Pestana = 'movimientos' | 'resumen' | 'lista' | 'tareas' | 'ajustes'
interface Form {
  tipo: 'gasto' | 'ingreso'
  editando?: Movimiento
  prefill?: { descripcion: string; marca?: string; cantidad?: number; listaItem?: Movimiento['listaItem']; agregadoPor?: string }
  contexto?: 'lista'
  /** El dueño de una lista corrige lo que compró otro miembro. */
  correccion?: { listaId: string; item: ItemLista }
}

/** Pestañas con texto; Resumen, la calculadora y Ajustes van como íconos a la derecha. */
const TITULOS: Partial<Record<Pestana, string>> = {
  movimientos: 'Movimientos',
  lista: 'Listas',
  tareas: 'Tareas',
}
const SIN_FILTROS_LISTA: FiltrosLista = { texto: '', persona: null }
const invitacionUrl = () => new URLSearchParams(location.search).get('lista')
const invitacionTareasUrl = () => new URLSearchParams(location.search).get('tareas')

interface Aviso {
  texto: string
  deshacer?: () => void
  /** Algo salió mal: se ve en rojo, dura más y se cierra tocándolo. */
  error?: boolean
}

/** El ícono abre en "nuevo gasto"; el acceso directo ?nuevo=ingreso abre en ingreso; ?lista= abre la invitación. */
function formInicial(): Form | null {
  if (invitacionUrl() || invitacionTareasUrl()) return null
  const p = new URLSearchParams(location.search).get('nuevo')
  return { tipo: p === 'ingreso' ? 'ingreso' : 'gasto' }
}

export default function App() {
  const datos = useDatos()
  const [form, setForm] = useState<Form | null>(formInicial)
  const [pestana, setPestana] = useState<Pestana>(() =>
    invitacionUrl() ? 'lista' : invitacionTareasUrl() ? 'tareas' : 'movimientos',
  )
  const [invitacion, setInvitacionState] = useState(invitacionUrl)
  const [invitacionTareas, setInvitacionTareasState] = useState(invitacionTareasUrl)
  const [mes, setMes] = useState(() => claveMes(Date.now()))
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [avisoRespaldo, setAvisoRespaldo] = useState(false)
  // Compra cuyo pago se está viendo (clave de compra), o null.
  const [pagando, setPagando] = useState<string | null>(null)
  const [verAlertas, setVerAlertas] = useState(false)
  const [calculadora, setCalculadora] = useState(false)
  const [, setVersionSesion] = useState(0)
  // Búsquedas: los filtros siguen aplicados aunque se cierre la lupa (testigo).
  const [buscandoMov, setBuscandoMov] = useState(false)
  const [filtrosMov, setFiltrosMov] = useState<FiltrosMov>(SIN_FILTROS_MOV)
  const [filtrosLista, setFiltrosLista] = useState<FiltrosLista>(SIN_FILTROS_LISTA)
  const timer = useRef<number>(undefined)

  useEffect(() => {
    pedirPersistencia()
    necesitaRespaldo().then(setAvisoRespaldo)
  }, [])

  const setInvitacion = useCallback((id: string | null) => {
    setInvitacionState(id)
    if (!id) history.replaceState(null, '', location.pathname)
  }, [])
  const setInvitacionTareas = useCallback((id: string | null) => {
    setInvitacionTareasState(id)
    if (!id) history.replaceState(null, '', location.pathname)
  }, [])

  function mostrarAviso(a: Aviso) {
    clearTimeout(timer.current)
    setAviso(a)
    timer.current = window.setTimeout(() => setAviso(null), a.error ? 7000 : a.deshacer ? 6000 : 2500)
  }
  function cerrarAviso() {
    clearTimeout(timer.current)
    setAviso(null)
  }
  // mostrarAviso solo usa setAviso y timer, que no cambian: alcanza con registrarla una vez.
  useEffect(() => {
    registrarErrores((texto) => mostrarAviso({ texto, error: true }))
    return () => registrarErrores(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const yo = datos?.yo?.nombre ?? 'Yo'
  const fallaLista = () => mostrarAviso({ texto: 'No se pudo actualizar la lista de compras', error: true })

  /** Mantiene el ítem de la lista sincronizado con su gasto. */
  function sincronizarItem(m: Movimiento) {
    if (!m.listaItem || !datos) return
    const { listaId, itemId } = m.listaItem
    const gasto = cargaDe(m, datos.categorias)
    listaCompras()
      .then((lc) => lc.comprarItem(listaId, itemId, yo, gasto))
      .catch(fallaLista)
  }

  /** El dueño de la lista abre lo que compró otro miembro en el formulario de gasto, para corregirlo. */
  const corregir = (listaId: string, item: ItemLista) => setForm({ tipo: 'gasto', correccion: { listaId, item } })

  function datosCorreccion(c: NonNullable<Form['correccion']>): Correccion {
    const { listaId, item } = c
    const actual = cargaDeItem(item)
    const original = item.original ?? actual
    return {
      quien: item.compradoPor ?? 'otra persona',
      actual,
      original,
      corregidoPor: item.corregidoPor ?? null,
      corregidoEn: item.corregidoEn ?? null,
      sinMonto: item.montoCent === null,
      onGuardar: (g) =>
        listaCompras()
          .then((lc) => lc.corregirComprado(listaId, item, g, yo, original))
          .catch(fallaLista),
    }
  }

  /** Al pagar una compra con ítems de tu lista, la lista se cierra; si quedó algo pendiente, se ofrece una nueva. */
  async function cerrarListaPagada(listaId: string) {
    try {
      const lc = await listaCompras()
      const r = await lc.cerrarAlPagar(listaId)
      if (!r) return
      mostrarAviso({ texto: `Lista "${r.lista.nombre}" cerrada` })
      const n = r.pendientes.length
      if (n && (await confirmar({ titulo: `¿Abrir una lista nueva con los ${n} pendientes?`, texto: 'Con los mismos miembros.', boton: 'Abrir' })))
        await setAjuste('listaId', await lc.nuevaConPendientes(r.lista, r.pendientes, yo))
    } catch {
      fallaLista()
    }
  }

  async function borrar(m: Movimiento) {
    const ahora = Date.now()
    await db.movimientos.update(m.id, { borradoEn: ahora, modificadoEn: ahora })
    setForm(null)
    if (m.listaItem) {
      const { listaId, itemId } = m.listaItem
      listaCompras()
        .then((lc) => lc.volverAPendiente(listaId, itemId))
        .catch(fallaLista)
    }
    mostrarAviso({
      texto: 'Movimiento borrado',
      deshacer: () => {
        db.movimientos.update(m.id, { borradoEn: null, modificadoEn: Date.now() })
        sincronizarItem(m)
      },
    })
  }

  function comprarDesdeLista(listaId: string, item: ItemLista) {
    // Al volver a la lista, el campo de búsqueda arranca vacío.
    setFiltrosLista((f) => ({ ...f, texto: '' }))
    setForm({
      tipo: 'gasto',
      contexto: 'lista',
      prefill: {
        descripcion: item.nombre,
        marca: item.marca ?? undefined,
        cantidad: /^\d+$/.test(item.cantidad ?? '') ? Number(item.cantidad) : undefined,
        listaItem: { listaId, itemId: item.id },
        agregadoPor: item.agregadoPor,
      },
    })
  }

  if (!datos) return null
  if (!datos.yo) return <Bienvenida />

  // Compra en curso (gastos con lugar todavía sin pagar).
  const sesion = sesionAbierta()
  const gastosDe = (clave: string) => datos.movimientos.filter((m) => m.tipo === 'gasto' && claveCompra(m) === clave)
  const gastosCompra = sesion ? gastosDe(sesion.compraId) : []
  const compraEnCurso = sesion && gastosCompra.length > 0 ? sesion.compraId : null
  const gastosPagando = pagando ? gastosDe(pagando) : []
  // La lista tiene su propio campo de búsqueda siempre visible; la lupa es solo de Movimientos.
  const lupa =
    pestana === 'movimientos'
      ? { abierto: buscandoMov, filtrando: hayFiltrosMov(filtrosMov), onClick: () => setBuscandoMov(!buscandoMov) }
      : null

  // Alertas: se avisan con un botón al lado del mes y se leen debajo de él.
  const alertas = avisoRespaldo
    ? [
        {
          id: 'respaldo',
          texto: 'Hace más de una semana que no hacés un respaldo.',
          accion: { etiqueta: 'Ir a respaldo', onClick: () => setPestana('ajustes') },
          descartar: () => setAvisoRespaldo(false),
        },
      ]
    : []
  const botonAlertas = alertas.length > 0 && (
    <button
      className="icono borde alertas"
      aria-label={`Alertas (${alertas.length})`}
      aria-pressed={verAlertas}
      onClick={() => setVerAlertas(!verAlertas)}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M10 21h4" stroke="currentColor" strokeWidth="2.2" />
      </svg>
      <span className="insignia-alerta">{alertas.length}</span>
    </button>
  )
  const panelAlertas = verAlertas && alertas.length > 0 && (
    <ul className="alertas-panel" aria-label="Alertas">
      {alertas.map((a) => (
        <li key={a.id} className="banner">
          <span className="alerta-texto">
            {a.texto}{' '}
            <button className="enlace" onClick={a.accion.onClick}>
              {a.accion.etiqueta}
            </button>
          </span>
          <button className="icono" aria-label="Descartar alerta" onClick={a.descartar}>
            ✕
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="app">
      {form ? (
        <FormMovimiento
          key={form.editando?.id ?? form.correccion?.item.id ?? form.prefill?.listaItem?.itemId ?? form.tipo}
          datos={datos}
          tipoInicial={form.tipo}
          editando={form.editando}
          prefill={form.prefill}
          contexto={form.contexto}
          correccion={form.correccion && datosCorreccion(form.correccion)}
          onCerrar={() => {
            setForm(null)
            if (!invitacion) history.replaceState(null, '', location.pathname)
          }}
          onBorrar={borrar}
          onGuardado={(texto) => mostrarAviso({ texto })}
          onGuardadoMov={sincronizarItem}
          onSinGasto={() => {
            const li = form.prefill?.listaItem
            setForm(null)
            if (li)
              listaCompras()
                .then((lc) => lc.comprarItem(li.listaId, li.itemId, yo, null))
                .catch(fallaLista)
          }}
        />
      ) : (
        <>
          <main>
            {pestana === 'movimientos' && (
              <Movimientos
                datos={datos}
                mes={mes}
                setMes={setMes}
                onEditar={(m) => setForm({ tipo: m.tipo === 'ingreso' ? 'ingreso' : 'gasto', editando: m })}
                onBorrar={borrar}
                onPagar={setPagando}
                compraEnCurso={compraEnCurso}
                buscando={buscandoMov}
                acciones={
                  <>
                    {botonAlertas}
                    {lupa && <BotonLupa {...lupa} />}
                  </>
                }
                panel={panelAlertas}
                filtros={filtrosMov}
                setFiltros={setFiltrosMov}
                onCorregir={corregir}
              />
            )}
            {pestana === 'resumen' && (
              <Resumen
                datos={datos}
                mes={mes}
                setMes={setMes}
                acciones={botonAlertas}
                panel={panelAlertas}
                onAviso={(texto) => mostrarAviso({ texto })}
              />
            )}
            {pestana === 'lista' && (
              <Suspense fallback={<p className="vacio">Cargando…</p>}>
                <Lista
                  datos={datos}
                  invitacion={invitacion}
                  setInvitacion={setInvitacion}
                  filtros={filtrosLista}
                  setFiltros={setFiltrosLista}
                  onComprar={comprarDesdeLista}
                  onVerGasto={(m) => setForm({ tipo: 'gasto', editando: m })}
                  onBorrarGasto={borrar}
                  onCorregir={corregir}
                  onAviso={(texto, deshacer) => mostrarAviso({ texto, deshacer })}
                />
              </Suspense>
            )}
            {pestana === 'tareas' && (
              <Suspense fallback={<p className="vacio">Cargando…</p>}>
                <Tareas
                  datos={datos}
                  invitacion={invitacionTareas}
                  setInvitacion={setInvitacionTareas}
                  onAviso={(texto, deshacer) => mostrarAviso({ texto, deshacer })}
                />
              </Suspense>
            )}
            {pestana === 'ajustes' && (
              <Ajustes
                datos={datos}
                onAviso={(texto, deshacer) => {
                  mostrarAviso({ texto, deshacer })
                  necesitaRespaldo().then(setAvisoRespaldo)
                }}
              />
            )}
          </main>

          {pestana !== 'ajustes' && (
            <div className={'flotantes' + (pestana === 'lista' ? ' sobre-total' : '')}>
              {sesion && gastosCompra.length > 0 && (
                <button className="pagar" onClick={() => setPagando(sesion.compraId)}>
                  Pagar {textoTotal(totalCompra(gastosCompra))}
                </button>
              )}
              {pestana !== 'lista' && pestana !== 'tareas' && (
                <button className="fab" aria-label="Nuevo gasto" onClick={() => setForm({ tipo: 'gasto' })}>
                  +
                </button>
              )}
            </div>
          )}

          <nav
            className="tabs"
            // Tocar otra pestaña cierra la calculadora (su propio botón la alterna).
            onClickCapture={(e) => !(e.target as Element).closest('.boton-calc') && setCalculadora(false)}
          >
            {(['movimientos', 'lista', 'tareas'] as Pestana[]).map((p) => (
              <button key={p} aria-current={pestana === p} onClick={() => setPestana(p)}>
                {TITULOS[p]}
              </button>
            ))}
            <button className="ajustes" aria-label="Resumen" aria-current={pestana === 'resumen'} onClick={() => setPestana('resumen')}>
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <rect x="5" y="11" width="3.6" height="7" rx="0.8" fill="currentColor" />
                <rect x="10.2" y="6" width="3.6" height="12" rx="0.8" fill="currentColor" />
                <rect x="15.4" y="13.5" width="3.6" height="4.5" rx="0.8" fill="currentColor" />
              </svg>
            </button>
            <button
              className="ajustes boton-calc"
              aria-label="Calculadora"
              aria-current={calculadora}
              onClick={() => setCalculadora((c) => !c)}
            >
              <svg width="20" height="22" viewBox="0 0 20 22" aria-hidden="true">
                <rect x="2" y="1.5" width="16" height="19" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <rect x="5" y="4.5" width="10" height="4" fill="currentColor" />
                <g fill="currentColor">
                  <circle cx="6" cy="12.5" r="1.3" /><circle cx="10" cy="12.5" r="1.3" /><circle cx="14" cy="12.5" r="1.3" />
                  <circle cx="6" cy="16.5" r="1.3" /><circle cx="10" cy="16.5" r="1.3" /><circle cx="14" cy="16.5" r="1.3" />
                </g>
              </svg>
            </button>
            <button
              className="ajustes"
              aria-label="Ajustes"
              aria-current={pestana === 'ajustes'}
              onClick={() => setPestana(pestana === 'ajustes' ? 'movimientos' : 'ajustes')}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeDasharray="3.14 3.14" />
                <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </button>
          </nav>
        </>
      )}

      {calculadora && <Calculadora cotizaciones={datos.cotizaciones} onCerrar={() => setCalculadora(false)} />}

      {pagando && gastosPagando.length > 0 && (
        <Pagar
          key={pagando}
          datos={datos}
          lugar={gastosPagando.find((g) => g.lugar)?.lugar}
          enCurso={pagando === compraEnCurso}
          gastos={gastosPagando}
          onCerrar={() => setPagando(null)}
          onPagado={(texto) => {
            const listas = pagando === compraEnCurso ? [...new Set(gastosPagando.flatMap((g) => g.listaItem?.listaId ?? []))] : []
            setPagando(null)
            setVersionSesion((v) => v + 1)
            mostrarAviso({ texto })
            listas.forEach(cerrarListaPagada)
          }}
        />
      )}

      {aviso && (
        <div
          className={'toast' + (aviso.error ? ' toast-error' : '')}
          role={aviso.error ? 'alert' : 'status'}
          onClick={aviso.error ? cerrarAviso : undefined}
        >
          <span>{aviso.texto}</span>
          {aviso.deshacer && (
            <button
              className="enlace"
              onClick={() => {
                aviso.deshacer!()
                cerrarAviso()
              }}
            >
              Deshacer
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Bienvenida() {
  const [nombre, setNombre] = useState('')
  return (
    <form
      className="bienvenida"
      onSubmit={(e) => {
        e.preventDefault()
        if (nombre.trim()) inicializar(nombre)
      }}
    >
      <h1>BillIs</h1>
      <p>Anotá gastos e ingresos en segundos. Todo queda en este teléfono.</p>
      <label className="campo">
        <span>¿Cómo te llamás?</span>
        <input value={nombre} autoFocus onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" />
      </label>
      <p className="nota">Va a ser el pagador por defecto de tus gastos.</p>
      <button className="primario" disabled={!nombre.trim()}>
        Empezar
      </button>
    </form>
  )
}
