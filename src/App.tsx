import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BotonLupa } from './components/Buscador'
import { FormMovimiento } from './components/FormMovimiento'
import { Pagar, textoTotal, totalCompra } from './components/Pagar'
import { db, inicializar } from './db/db'
import type { Movimiento } from './db/types'
import { claveMes } from './lib/calculos'
import { useDatos } from './lib/datos'
import { hayFiltrosMov, SIN_FILTROS_MOV, type FiltrosMov } from './lib/filtrosMov'
import type { FiltrosLista, ItemLista } from './lib/listaCompras'
import { necesitaRespaldo, pedirPersistencia } from './lib/respaldo'
import { sesionAbierta } from './lib/sesion'
import { Ajustes } from './screens/Ajustes'
import { Movimientos } from './screens/Movimientos'
import { Resumen } from './screens/Resumen'

// Firebase pesa: la lista se carga recién cuando se abre.
const Lista = lazy(() => import('./screens/Lista'))
const listaCompras = () => import('./lib/listaCompras')

type Pestana = 'movimientos' | 'resumen' | 'lista' | 'ajustes'
interface Form {
  tipo: 'gasto' | 'ingreso'
  editando?: Movimiento
  prefill?: { descripcion: string; marca?: string; cantidad?: number; listaItem?: Movimiento['listaItem'] }
  contexto?: 'lista'
}

const TITULOS: Record<Pestana, string> = {
  movimientos: 'Movimientos',
  resumen: 'Resumen',
  lista: 'Listas',
  ajustes: 'Ajustes',
}
const SIN_FILTROS_LISTA: FiltrosLista = { texto: '', estado: null, persona: null }
const invitacionUrl = () => new URLSearchParams(location.search).get('lista')

interface Aviso {
  texto: string
  deshacer?: () => void
}

/** El ícono abre en "nuevo gasto"; el acceso directo ?nuevo=ingreso abre en ingreso; ?lista= abre la invitación. */
function formInicial(): Form | null {
  if (invitacionUrl()) return null
  const p = new URLSearchParams(location.search).get('nuevo')
  return { tipo: p === 'ingreso' ? 'ingreso' : 'gasto' }
}

export default function App() {
  const datos = useDatos()
  const [form, setForm] = useState<Form | null>(formInicial)
  const [pestana, setPestana] = useState<Pestana>(() => (invitacionUrl() ? 'lista' : 'movimientos'))
  const [invitacion, setInvitacionState] = useState(invitacionUrl)
  const [mes, setMes] = useState(() => claveMes(Date.now()))
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [avisoRespaldo, setAvisoRespaldo] = useState(false)
  const [pagando, setPagando] = useState(false)
  const [verAlertas, setVerAlertas] = useState(false)
  const [, setVersionSesion] = useState(0)
  // Búsquedas: los filtros siguen aplicados aunque se cierre la lupa (testigo).
  const [buscandoMov, setBuscandoMov] = useState(false)
  const [filtrosMov, setFiltrosMov] = useState<FiltrosMov>(SIN_FILTROS_MOV)
  const [buscandoLista, setBuscandoLista] = useState(false)
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

  function mostrarAviso(a: Aviso) {
    clearTimeout(timer.current)
    setAviso(a)
    timer.current = window.setTimeout(() => setAviso(null), a.deshacer ? 6000 : 2500)
  }

  const yo = datos?.yo?.nombre ?? 'Yo'
  const fallaLista = () => mostrarAviso({ texto: 'No se pudo actualizar la lista de compras' })

  /** Mantiene el ítem de la lista sincronizado con su gasto. */
  function sincronizarItem(m: Movimiento) {
    if (!m.listaItem) return
    const { listaId, itemId } = m.listaItem
    listaCompras()
      .then((lc) => lc.comprarItem(listaId, itemId, yo, m.totalCent, m.moneda))
      .catch(fallaLista)
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
    setForm({
      tipo: 'gasto',
      contexto: 'lista',
      prefill: {
        descripcion: item.nombre,
        marca: item.marca ?? undefined,
        cantidad: /^\d+$/.test(item.cantidad ?? '') ? Number(item.cantidad) : undefined,
        listaItem: { listaId, itemId: item.id },
      },
    })
  }

  if (!datos) return null
  if (!datos.yo) return <Bienvenida />

  // Compra en curso (gastos con lugar todavía sin pagar).
  const sesion = sesionAbierta()
  const gastosCompra = sesion
    ? datos.movimientos.filter((m) => m.tipo === 'gasto' && m.compraId === sesion.compraId)
    : []
  const lupa =
    pestana === 'movimientos'
      ? { abierto: buscandoMov, filtrando: hayFiltrosMov(filtrosMov), onClick: () => setBuscandoMov(!buscandoMov) }
      : pestana === 'lista'
        ? {
            abierto: buscandoLista,
            filtrando: filtrosLista.texto !== '' || filtrosLista.estado !== null || filtrosLista.persona !== null,
            onClick: () => setBuscandoLista(!buscandoLista),
          }
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
          key={form.editando?.id ?? form.prefill?.listaItem?.itemId ?? form.tipo}
          datos={datos}
          tipoInicial={form.tipo}
          editando={form.editando}
          prefill={form.prefill}
          contexto={form.contexto}
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
                .then((lc) => lc.comprarItem(li.listaId, li.itemId, yo, null, null))
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
                  buscando={buscandoLista}
                  lupa={lupa && <BotonLupa {...lupa} />}
                  filtros={filtrosLista}
                  setFiltros={setFiltrosLista}
                  onComprar={comprarDesdeLista}
                  onVerGasto={(m) => setForm({ tipo: 'gasto', editando: m })}
                  onBorrarGasto={borrar}
                  onAviso={(texto) => mostrarAviso({ texto })}
                />
              </Suspense>
            )}
            {pestana === 'ajustes' && (
              <Ajustes
                datos={datos}
                onAviso={(texto) => {
                  mostrarAviso({ texto })
                  necesitaRespaldo().then(setAvisoRespaldo)
                }}
              />
            )}
          </main>

          {pestana !== 'ajustes' && (
            <div className="flotantes">
              {sesion && gastosCompra.length > 0 && (
                <button className="pagar" onClick={() => setPagando(true)}>
                  Pagar {textoTotal(totalCompra(gastosCompra))}
                </button>
              )}
              {pestana !== 'lista' && (
                <button className="fab" aria-label="Nuevo gasto" onClick={() => setForm({ tipo: 'gasto' })}>
                  +
                </button>
              )}
            </div>
          )}

          <nav className="tabs">
            {(['movimientos', 'resumen', 'lista'] as Pestana[]).map((p) => (
              <button key={p} aria-current={pestana === p} onClick={() => setPestana(p)}>
                {TITULOS[p]}
              </button>
            ))}
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

      {pagando && sesion && (
        <Pagar
          datos={datos}
          sesion={sesion}
          gastos={gastosCompra}
          onCerrar={() => setPagando(false)}
          onPagado={(texto) => {
            setPagando(false)
            setVersionSesion((v) => v + 1)
            mostrarAviso({ texto })
          }}
        />
      )}

      {aviso && (
        <div className="toast" role="status">
          <span>{aviso.texto}</span>
          {aviso.deshacer && (
            <button
              className="enlace"
              onClick={() => {
                aviso.deshacer!()
                setAviso(null)
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
