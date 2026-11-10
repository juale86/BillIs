import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Buscador } from '../components/Buscador'
import { Modal } from '../components/Modal'
import { ordenEntre, useArrastre } from '../components/useArrastre'
import { db, normalizar, setAjuste } from '../db/db'
import type { Moneda, Movimiento } from '../db/types'
import type { Datos } from '../lib/datos'
import {
  agregarItem,
  cambiarGrupo,
  aprobar,
  borrarItem,
  borrarLista,
  cancelarPedido,
  cerrarLista,
  cerrarSesionGoogle,
  crearLista,
  esDueno,
  extraerListaId,
  filtrar,
  guardarOrden,
  hayFiltrosLista,
  iniciarSesion,
  leerOrden,
  linkLista,
  marcarReciente,
  moverItem,
  nuevaConPendientes,
  olvidarRecientes,
  ordenDe,
  pedirUnirse,
  recientesDe,
  rechazar,
  renombrarLista,
  sacarMiembro,
  salirDeLista,
  sincronizacionDisponible,
  totales,
  useItems,
  useListaDoc,
  useMisListas,
  useUsuario,
  volverAPendiente,
  type FiltrosLista,
  type ItemLista,
  type OrdenLista,
  type Lista as TLista,
} from '../lib/listaCompras'
import { GRUPOS, grupoPorId, sugerirGrupo } from '../lib/grupos'
import { fmt } from '../lib/money'
import { sugerirDescripciones, ultimoPrecio } from '../lib/sugerencias'

export interface Props {
  datos: Datos
  /** Código recibido por link (?lista=...). */
  invitacion: string | null
  setInvitacion: (id: string | null) => void
  filtros: FiltrosLista
  setFiltros: (f: FiltrosLista) => void
  onComprar: (listaId: string, item: ItemLista) => void
  onVerGasto: (m: Movimiento) => void
  onBorrarGasto: (m: Movimiento) => void
  onAviso: (t: string) => void
}

const fmtFecha = (t: number) => new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })
const fmtTotales = (t: [Moneda, number][]) => (t.length ? t.map(([m, c]) => fmt(c, m)).join(' + ') : fmt(0))

export default function Lista(props: Props) {
  const { usuario, cargando } = useUsuario()
  if (!sincronizacionDisponible)
    return (
      <section className="pantalla">
        <p className="vacio">Las listas compartidas no están disponibles en esta versión.</p>
      </section>
    )
  if (cargando) return <p className="vacio pantalla">Cargando…</p>
  if (!usuario) return <Login />
  return <ConUsuario {...props} uid={usuario.uid} email={usuario.email ?? ''} />
}

function Login() {
  const [ocupado, setOcupado] = useState(false)
  return (
    <section className="pantalla">
      <div className="tarjeta">
        <h3>Listas de compras compartidas</h3>
        <p className="nota">
          Anotá lo que falta, compartilo con tu familia y cargá los gastos desde la lista en el súper. Para eso cada
          persona inicia sesión con su cuenta de Google. Tus gastos siguen guardados solo en este teléfono.
        </p>
        <button
          className="primario"
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true)
            try {
              await iniciarSesion()
            } catch (e) {
              alert(`No se pudo iniciar sesión: ${e instanceof Error ? e.message : e}`)
            } finally {
              setOcupado(false)
            }
          }}
        >
          Iniciar sesión con Google
        </button>
      </div>
    </section>
  )
}

function ConUsuario(props: Props & { uid: string; email: string }) {
  const { datos, uid, invitacion, setInvitacion, onAviso } = props
  const yo = datos.yo?.nombre ?? 'Yo'
  const { listas, cargando, error } = useMisListas(uid)
  const [menu, setMenu] = useState(false)
  // Orden de los pendientes, elegido por teléfono.
  const [orden, setOrden] = useState<OrdenLista>(leerOrden)
  const [eligiendoOrden, setEligiendoOrden] = useState(false)
  // Redibuja aunque se elija el mismo orden (para soltar los recién agregados).
  const [, setVueltas] = useState(0)

  const abiertas = listas.filter((l) => !l.cerrada)
  const cerradas = listas.filter((l) => l.cerrada).sort((a, b) => (b.cerradaEn ?? 0) - (a.cerradaEn ?? 0))
  const actual = listas.find((l) => l.id === datos.listaId) ?? abiertas[0] ?? null
  const yaEsMiembro = !!invitacion && listas.some((l) => l.id === invitacion)

  // Al ser aprobado (o si ya eras miembro) la invitación se convierte en tu lista actual.
  useEffect(() => {
    if (invitacion && yaEsMiembro) {
      setAjuste('listaId', invitacion)
      setInvitacion(null)
    }
  }, [invitacion, yaEsMiembro, setInvitacion])

  if (error) return <p className="error pantalla">No se pudieron leer tus listas: {error}</p>
  if (cargando) return <p className="vacio pantalla">Cargando listas…</p>
  if (invitacion && !yaEsMiembro) return <Invitacion codigo={invitacion} uid={uid} yo={yo} onListo={() => setInvitacion(null)} />

  async function nuevaLista() {
    const nombre = prompt('Nombre de la lista', abiertas.length ? '' : 'Súper')?.trim()
    if (!nombre) return
    try {
      await setAjuste('listaId', await crearLista(nombre, yo))
      setMenu(false)
      onAviso(`Lista "${nombre}" creada`)
    } catch {
      alert('No se pudo crear la lista. Revisá la conexión.')
    }
  }

  function unirseConLink() {
    const id = extraerListaId(prompt('Pegá el link de la lista') ?? '')
    if (id) {
      setMenu(false)
      setInvitacion(id)
    }
  }

  if (!actual)
    return (
      <section className="pantalla">
        <div className="tarjeta">
          <h3>Todavía no tenés listas</h3>
          <p className="nota">Creá una para anotar lo que falta, o unite a la de otra persona con su link.</p>
          <div className="botones">
            <button className="primario" onClick={nuevaLista}>
              Nueva lista
            </button>
            <button className="secundario" onClick={unirseConLink}>
              Unirme con un link
            </button>
          </div>
        </div>
        {cerradas.length > 0 && (
          <ListasCerradas cerradas={cerradas} onElegir={(l) => setAjuste('listaId', l.id)} />
        )}
      </section>
    )

  const pedidos = esDueno(actual, uid) ? Object.keys(actual.pendientes ?? {}).length : 0

  return (
    <section className="pantalla">
      <div className="lista-cab">
        <button className="selector-lista" aria-haspopup="dialog" onClick={() => setMenu(true)}>
          <strong>{actual.nombre}</strong>
          {actual.cerrada && <small> (cerrada)</small>}
          <span aria-hidden="true"> ▾</span>
          {pedidos > 0 && <span className="insignia">{pedidos}</span>}
        </button>
        {!actual.cerrada && <BotonCompartir listaId={actual.id} onAviso={onAviso} />}
        <button
          className="icono borde"
          aria-label={`Ordenar lista (${OPCIONES_ORDEN.find((o) => o.id === orden)?.etiqueta})`}
          onClick={() => setEligiendoOrden(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h11M4 18h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
          </svg>
        </button>
      </div>

      {eligiendoOrden && (
        <HojaOpciones
          titulo="Ordenar lista"
          opciones={OPCIONES_ORDEN}
          actual={orden}
          onElegir={(id) => {
            // Elegir un orden (aunque sea el mismo) acomoda también lo recién agregado.
            olvidarRecientes(actual.id)
            guardarOrden(id as OrdenLista)
            setOrden(id as OrdenLista)
            setVueltas((v) => v + 1)
          }}
          onCerrar={() => setEligiendoOrden(false)}
        />
      )}

      {menu && (
        <MenuListas
          {...props}
          actual={actual}
          abiertas={abiertas}
          cerradas={cerradas}
          yo={yo}
          onCerrar={() => setMenu(false)}
          onNueva={nuevaLista}
          onUnirse={unirseConLink}
        />
      )}

      <VistaLista {...props} key={actual.id} lista={actual} yo={yo} orden={orden} />
    </section>
  )
}

function BotonCompartir({ listaId, onAviso }: { listaId: string; onAviso: (t: string) => void }) {
  return (
    <button
      className="icono borde"
      aria-label="Compartir lista"
      onClick={async () => {
        const url = linkLista(listaId)
        try {
          if (navigator.share)
            await navigator.share({ title: 'Lista de compras', text: 'Sumate a mi lista de compras en BillIs', url })
          else {
            await navigator.clipboard.writeText(url)
            onAviso('Link copiado')
          }
        } catch {
          /* canceló */
        }
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="18" cy="5" r="2.8" fill="currentColor" />
        <circle cx="6" cy="12" r="2.8" fill="currentColor" />
        <circle cx="18" cy="19" r="2.8" fill="currentColor" />
        <path d="M8.5 10.7l7-4.2M8.5 13.3l7 4.2" stroke="currentColor" strokeWidth="2" />
      </svg>
    </button>
  )
}

function Invitacion({ codigo, uid, yo, onListo }: { codigo: string; uid: string; yo: string; onListo: () => void }) {
  const lista = useListaDoc(codigo)
  if (lista === undefined) return <p className="vacio pantalla">Buscando la lista…</p>
  if (lista === null)
    return (
      <section className="pantalla">
        <div className="tarjeta">
          <h3>No encontramos esa lista</h3>
          <p className="nota">El link puede estar incompleto o la lista fue borrada.</p>
          <button className="secundario" onClick={onListo}>
            Volver
          </button>
        </div>
      </section>
    )
  const pedido = !!lista.pendientes?.[uid]
  return (
    <section className="pantalla">
      <div className="tarjeta">
        <h3>
          {lista.duenoNombre} te invitó a "{lista.nombre}"
        </h3>
        {lista.cerrada ? (
          <p className="nota">Esta lista ya está cerrada.</p>
        ) : pedido ? (
          <p className="nota">Le pediste unirte. Cuando {lista.duenoNombre} te apruebe, la lista aparece acá sola.</p>
        ) : (
          <p className="nota">Pedí unirte y {lista.duenoNombre} te va a aprobar desde su teléfono.</p>
        )}
        <div className="botones">
          {!lista.cerrada && !pedido && (
            <button className="primario" onClick={() => pedirUnirse(codigo, yo).catch(() => alert('No se pudo enviar el pedido.'))}>
              Pedir unirme
            </button>
          )}
          {pedido && (
            <button className="secundario" onClick={() => cancelarPedido(codigo).then(onListo)}>
              Cancelar pedido
            </button>
          )}
          <button className="secundario" onClick={onListo}>
            Volver
          </button>
        </div>
      </div>
    </section>
  )
}

function ListasCerradas({ cerradas, onElegir }: { cerradas: TLista[]; onElegir: (l: TLista) => void }) {
  return (
    <div className="menu-seccion">
      <h3>Cerradas</h3>
      <ul className="lista">
        {cerradas.map((l) => (
          <li key={l.id}>
            <button className="menu-item" onClick={() => onElegir(l)}>
              {l.nombre} <small>cerrada el {fmtFecha(l.cerradaEn ?? l.creadoEn)}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MenuListas(
  props: Props & {
    uid: string
    email: string
    actual: TLista
    abiertas: TLista[]
    cerradas: TLista[]
    yo: string
    onCerrar: () => void
    onNueva: () => void
    onUnirse: () => void
  },
) {
  const { actual, abiertas, cerradas, uid, email, onCerrar, onNueva, onUnirse, onAviso } = props
  const dueno = esDueno(actual, uid)
  const elegir = (l: TLista) => {
    setAjuste('listaId', l.id)
    onCerrar()
  }
  const miembros = Object.entries(actual.miembros ?? {}).sort(([a], [b]) => Number(b === actual.duenoUid) - Number(a === actual.duenoUid))
  const pedidos = Object.entries(actual.pendientes ?? {})
  const accion = (p: Promise<unknown>, ok?: string) =>
    p.then(() => ok && onAviso(ok)).catch(() => alert('No se pudo completar. Revisá la conexión.'))
  // Lista sobre la que se abrió el modal de renombrar o de borrar/salir.
  const [modal, setModal] = useState<{ tipo: 'renombrar' | 'borrar'; lista: TLista } | null>(null)
  const cerrarModal = () => setModal(null)

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div className="hoja" role="dialog" aria-label="Listas" onClick={(e) => e.stopPropagation()}>
        <div className="menu-seccion">
          <h3>Tus listas</h3>
          <ul className="lista">
            {abiertas.map((l) => {
              const mia = esDueno(l, uid)
              return (
                <li key={l.id} className="menu-fila">
                  <button className="menu-item" aria-current={l.id === actual.id} onClick={() => elegir(l)}>
                    {l.nombre}
                    {!mia && <small> de {l.duenoNombre}</small>}
                  </button>
                  {mia && (
                    <button
                      className="icono chico-icono"
                      aria-label={`Renombrar ${l.nombre}`}
                      onClick={() => setModal({ tipo: 'renombrar', lista: l })}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 20l1-5L16 4l4 4L9 19z M14 6l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                  <button
                    className="icono chico-icono"
                    aria-label={mia ? `Borrar ${l.nombre}` : `Salir de ${l.nombre}`}
                    onClick={() => setModal({ tipo: 'borrar', lista: l })}
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="botones">
            <button className="enlace" onClick={onNueva}>
              + Nueva lista
            </button>
            <button className="enlace" onClick={onUnirse}>
              Unirme con un link
            </button>
          </div>
        </div>

        <div className="menu-seccion">
          {dueno && pedidos.length > 0 && (
            <>
              <p className="nota">Quieren unirse:</p>
              <ul className="lista">
                {pedidos.map(([u, nombre]) => (
                  <li key={u} className="item-ajuste">
                    <span>{nombre}</span>
                    <button className="enlace" onClick={() => accion(aprobar(actual, u), `${nombre} se unió`)}>
                      Aceptar
                    </button>
                    <button className="enlace peligro" onClick={() => accion(rechazar(actual, u))}>
                      Rechazar
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3>Miembros</h3>
          <ul className="lista">
            {miembros.map(([u, nombre]) => (
              <li key={u} className="item-ajuste">
                <span>
                  {nombre}
                  {u === actual.duenoUid && <small> (dueño)</small>}
                  {u === uid && <small> (vos)</small>}
                </span>
                {dueno && u !== uid && !actual.cerrada && (
                  <button
                    className="enlace peligro"
                    onClick={() => confirm(`¿Sacar a ${nombre} de la lista?`) && accion(sacarMiembro(actual, u))}
                  >
                    Sacar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {cerradas.length > 0 && <ListasCerradas cerradas={cerradas} onElegir={elegir} />}

        <div className="menu-seccion menu-pie">
          <span className="nota">{email}</span>
          <button className="enlace" onClick={() => cerrarSesionGoogle().then(onCerrar)}>
            Cerrar sesión
          </button>
          <button className="primario" onClick={onCerrar}>
            Listo
          </button>
        </div>
      </div>

      {modal?.tipo === 'renombrar' && (
        <Modal
          titulo="Renombrar lista"
          valorInicial={modal.lista.nombre}
          etiquetaConfirmar="Guardar"
          onCancelar={cerrarModal}
          onConfirmar={(n) => {
            setModal(null)
            if (n !== modal.lista.nombre) accion(renombrarLista(modal.lista, n), 'Lista renombrada')
          }}
        />
      )}
      {modal?.tipo === 'borrar' &&
        (esDueno(modal.lista, uid) ? (
          <Modal
            titulo={`¿Borrar "${modal.lista.nombre}"?`}
            etiquetaConfirmar="Borrar"
            peligro
            onCancelar={cerrarModal}
            onConfirmar={() => {
              setModal(null)
              accion(borrarLista(modal.lista).then(() => modal.lista.id === actual.id && onCerrar()), 'Lista borrada')
            }}
          >
            Se borra para todos los miembros, con sus ítems. No se puede deshacer. Tus gastos no se tocan.
          </Modal>
        ) : (
          <Modal
            titulo={`¿Salir de "${modal.lista.nombre}"?`}
            etiquetaConfirmar="Salir"
            peligro
            onCancelar={cerrarModal}
            onConfirmar={() => {
              setModal(null)
              accion(salirDeLista(modal.lista).then(() => modal.lista.id === actual.id && onCerrar()), 'Saliste de la lista')
            }}
          >
            Para volver a entrar vas a necesitar el link y que {modal.lista.duenoNombre} te acepte.
          </Modal>
        ))}
    </div>
  )
}

/** Hoja de abajo con opciones para elegir una (orden de la lista, grupo de un ítem). */
function HojaOpciones(props: {
  titulo: string
  opciones: { id: string; etiqueta: string; detalle?: string }[]
  actual: string | null
  onElegir: (id: string) => void
  onCerrar: () => void
}) {
  const { titulo, opciones, actual, onElegir, onCerrar } = props
  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div className="hoja" role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="menu-seccion">
          <h3>{titulo}</h3>
          <ul className="lista">
            {opciones.map((o) => (
              <li key={o.id}>
                <button
                  className="menu-item"
                  aria-current={o.id === actual}
                  onClick={() => {
                    onElegir(o.id)
                    onCerrar()
                  }}
                >
                  {o.etiqueta}
                  {o.detalle && <small> {o.detalle}</small>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

const OPCIONES_ORDEN: { id: OrdenLista; etiqueta: string; detalle: string }[] = [
  { id: 'manual', etiqueta: 'Manual', detalle: 'lo último agregado primero; arrastrá ≡ para mover' },
  { id: 'alfabetico', etiqueta: 'Alfabético', detalle: 'de la A a la Z' },
  { id: 'grupos', etiqueta: 'Por grupos', detalle: 'en el orden del súper' },
]

function VistaLista(props: Props & { uid: string; lista: TLista; yo: string; orden: OrdenLista }) {
  const { datos, lista, uid, yo, orden, filtros, setFiltros, onComprar, onVerGasto, onBorrarGasto, onAviso } = props
  const { items, cargando, error, pendiente } = useItems(lista.id)
  const dueno = esDueno(lista, uid)
  const cerrada = lista.cerrada

  // Qué se muestra debajo de los dos campos: el formulario de agregar o los filtros de búsqueda.
  const [modo, setModo] = useState<'agregar' | 'buscar' | null>(null)
  const [nuevo, setNuevo] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [marca, setMarca] = useState('')
  // undefined = el grupo lo propone la app; string/null = elegido a mano.
  const [grupoElegido, setGrupoElegido] = useState<string | null | undefined>(undefined)
  const [verSug, setVerSug] = useState(false)
  const [eligiendoGrupo, setEligiendoGrupo] = useState<ItemLista | null>(null)
  // Para redibujar al agregar (los recientes viven fuera de React).
  const [, setVersion] = useState(0)
  const refNuevo = useRef<HTMLInputElement>(null)
  const refDetalle = useRef<HTMLDivElement>(null)

  const sugerencias = useMemo(
    () => (verSug ? sugerirDescripciones(datos.movimientos, 'gasto', nuevo).slice(0, 4) : []),
    [verSug, datos.movimientos, nuevo],
  )
  const grupoPropuesto = sugerirGrupo(nuevo, marca, datos.gruposAprendidos, items)
  const grupoNuevo = grupoElegido === undefined ? grupoPropuesto : grupoElegido

  // Al buscar solo importan los pendientes: lo comprado no se muestra.
  const buscando = modo === 'buscar' || hayFiltrosLista(filtros)
  const todosPendientes = useMemo(() => items.filter((i) => !i.comprado), [items])
  const pendientes = filtrar(todosPendientes, filtros)
  const comprados = buscando ? [] : items.filter((i) => i.comprado).sort((a, b) => b.modificadoEn - a.modificadoEn)
  const personas = [...new Set(items.map((i) => i.agregadoPor))].sort()
  const gastado = totales(items)

  const alfabetico = (a: ItemLista, b: ItemLista) => a.nombre.localeCompare(b.nombre, 'es')
  // Manual: por orden (lo último agregado tiene el menor). Los otros órdenes dejan arriba lo recién agregado.
  const enManual = [...pendientes].sort((a, b) => ordenDe(a) - ordenDe(b))
  const idsRecientes = orden === 'manual' ? [] : recientesDe(lista.id)
  const recientes = idsRecientes.flatMap((id) => pendientes.filter((it) => it.id === id))
  const resto = pendientes.filter((it) => !idsRecientes.includes(it.id)).sort(alfabetico)

  // Estimado de lo pendiente con los últimos precios que pagaste.
  const estimado = useMemo(() => {
    let cent = 0
    let conPrecio = 0
    for (const it of todosPendientes) {
      const p = ultimoPrecio(datos.movimientos, it.nombre, it.marca ?? '', '')
      if (!p || p.moneda !== 'ARS') continue
      cent += p.cent * (/^\d+$/.test(it.cantidad ?? '') ? Number(it.cantidad) : 1)
      conPrecio++
    }
    return { cent, conPrecio }
  }, [todosPendientes, datos.movimientos])

  // Los pendientes se reordenan arrastrando la manija de cada fila (solo en orden manual).
  const { arrastrando, estilo, manija } = useArrastre((desde, hasta) => {
    const it = enManual[desde]
    const nuevoOrden = ordenEntre(enManual.map(ordenDe), desde, hasta)
    moverItem(lista.id, it.id, nuevoOrden).catch(() => onAviso('No se pudo mover el ítem'))
  })

  const miGasto = (it: ItemLista) => datos.movimientos.find((m) => m.listaItem?.itemId === it.id)

  /** Recuerda en este teléfono el grupo elegido a mano para un producto. */
  function aprender(nombre: string, grupo: string | null) {
    const n = normalizar(nombre)
    if (!n || !grupo) return
    if (datos.gruposAprendidos[n] !== grupo) setAjuste('gruposLista', { ...datos.gruposAprendidos, [n]: grupo })
  }

  /** Agrega arriba de todo. comprar: además abre el gasto, por si lo encontraste en el súper. */
  function agregar(comprar: boolean) {
    if (!nuevo.trim()) return
    if (grupoElegido !== undefined) aprender(nuevo, grupoElegido)
    const { id, item, guardado } = agregarItem(lista.id, { nombre: nuevo, cantidad, marca, grupo: grupoNuevo }, yo)
    guardado.catch(() => onAviso('No se pudo guardar el ítem'))
    marcarReciente(lista.id, id)
    setVersion((v) => v + 1)
    setNuevo('')
    setCantidad('')
    setMarca('')
    setGrupoElegido(undefined)
    if (comprar) onComprar(lista.id, item)
    else refNuevo.current?.focus()
  }

  /** Si el foco sale del formulario de agregar sin nada escrito, se cierra. */
  function quizasCerrarAgregar() {
    setTimeout(() => {
      const a = document.activeElement
      const adentro = a === refNuevo.current || !!refDetalle.current?.contains(a)
      if (!adentro && !refNuevo.current?.value.trim()) setModo((m) => (m === 'agregar' ? null : m))
    }, 200)
  }

  async function aPendiente(it: ItemLista) {
    const g = miGasto(it)
    if (g && confirm(`¿Borrar también el gasto de ${fmt(g.totalCent, g.moneda)}?`)) return onBorrarGasto(g)
    if (g) await db.movimientos.update(g.id, { listaItem: undefined, modificadoEn: Date.now() })
    volverAPendiente(lista.id, it.id).catch(() => onAviso('No se pudo actualizar el ítem'))
  }

  async function cerrar() {
    if (!confirm(`¿Cerrar "${lista.nombre}"? Queda archivada con su total y ya nadie puede editarla.`)) return
    await cerrarLista(lista)
    onAviso('Lista cerrada')
    if (todosPendientes.length) await ofrecerNueva()
  }

  async function ofrecerNueva() {
    if (!confirm(`¿Abrir una lista nueva con los ${todosPendientes.length} pendientes y los mismos miembros?`)) return
    await setAjuste('listaId', await nuevaConPendientes(lista, todosPendientes, yo))
    onAviso('Lista nueva creada')
  }

  const filtrosActivos = filtros.persona
    ? [{ etiqueta: `Agregó ${filtros.persona}`, onQuitar: () => setFiltros({ ...filtros, persona: null }) }]
    : []

  /** Fila de un pendiente. i: posición en la lista manual, si se puede arrastrar. */
  function filaPendiente(it: ItemLista, i?: number) {
    const g = grupoPorId(it.grupo)
    const arrastrable = i !== undefined && !cerrada && enManual.length > 1
    return (
      <li
        key={it.id}
        className={'item-lista' + (arrastrable && arrastrando === i ? ' arrastrando' : '')}
        style={arrastrable ? estilo(i) : undefined}
      >
        {arrastrable && (
          <span className="manija" role="button" aria-label={`Mover ${it.nombre}`} {...manija(i)}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M3 6.5h12M3 11.5h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </span>
        )}
        <button className="item-boton" disabled={cerrada} onClick={() => onComprar(lista.id, it)}>
          <span className="mov-desc">{it.nombre}</span>
          <span className="mov-det">
            {[it.cantidad, it.marca].filter(Boolean).join(', ')}
            {(it.cantidad || it.marca) && ' — '}agregó {it.agregadoPor}
          </span>
        </button>
        {!cerrada && (
          <button
            className={'chip-grupo' + (g ? '' : ' vacio')}
            aria-label={g ? `Grupo ${g.corto}, cambiar` : `Elegir grupo de ${it.nombre}`}
            onClick={() => setEligiendoGrupo(it)}
          >
            {g ? g.corto : 'Grupo'} ▾
          </button>
        )}
        {!cerrada && (it.agregadoPorUid === uid || dueno) && (
          <button
            className="icono chico-icono"
            aria-label={`Quitar ${it.nombre}`}
            onClick={() => borrarItem(lista.id, it.id).catch(() => onAviso('No se pudo quitar'))}
          >
            ✕
          </button>
        )}
      </li>
    )
  }

  const seccion = (titulo: string, lista: ItemLista[]) =>
    lista.length > 0 && (
      <Fragment key={titulo}>
        <div className="lista-sub">
          <span>
            {titulo} ({lista.length})
          </span>
        </div>
        <ul className="lista">{lista.map((it) => filaPendiente(it))}</ul>
      </Fragment>
    )

  return (
    <>
      {pendiente && <p className="nota">Sin conexión: se sincroniza al volver la señal.</p>}

      {cerrada && (
        <div className="banner">
          Lista cerrada el {fmtFecha(lista.cerradaEn ?? Date.now())}. Ya no se puede editar.
          {dueno && todosPendientes.length > 0 && (
            <button className="enlace" onClick={ofrecerNueva}>
              Nueva lista con {todosPendientes.length} pendientes
            </button>
          )}
        </div>
      )}

      <form
        className="agregar-item"
        onSubmit={(e) => {
          e.preventDefault()
          agregar(false)
        }}
      >
        <div className="entradas-lista">
          {!cerrada && (
            <div className="campo">
              <input
                ref={refNuevo}
                value={nuevo}
                placeholder="Agregar a la lista"
                aria-label="Agregar a la lista"
                autoComplete="off"
                enterKeyHint="done"
                onChange={(e) => {
                  setNuevo(e.target.value)
                  setVerSug(true)
                }}
                onFocus={() => {
                  setModo('agregar')
                  setVerSug(true)
                }}
                onBlur={() => {
                  setVerSug(false)
                  quizasCerrarAgregar()
                }}
              />
              {sugerencias.length > 0 && (
                <ul className="sugerencias">
                  {sugerencias.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setNuevo(s)
                          setVerSug(false)
                        }}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="campo">
            <input
              type="search"
              value={filtros.texto}
              placeholder="Buscar y filtrar"
              aria-label="Buscar y filtrar"
              autoComplete="off"
              enterKeyHint="search"
              onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
              onFocus={() => setModo('buscar')}
              onBlur={() => {
                if (!hayFiltrosLista(filtros)) setModo((m) => (m === 'buscar' ? null : m))
              }}
              onKeyDown={(e) => {
                // Enter acá busca (cierra el teclado), no agrega.
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
            />
          </div>
        </div>

        {modo === 'agregar' && !cerrada && (
          <div className="agregar-detalle" ref={refDetalle} onBlur={quizasCerrarAgregar}>
            <div className="fila">
              <label className="campo chico">
                <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cant" aria-label="Cantidad" />
              </label>
              <label className="campo crece">
                <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca" aria-label="Marca" />
              </label>
              <label className="campo grupo-campo">
                <select
                  aria-label="Grupo"
                  className={grupoNuevo ? '' : 'resaltado'}
                  value={grupoNuevo ?? ''}
                  onChange={(e) => setGrupoElegido(e.target.value || null)}
                >
                  <option value="">Grupo</option>
                  {GRUPOS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.corto}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="fila botones-agregar">
              <button type="submit" className="primario" disabled={!nuevo.trim()}>
                Agregar
              </button>
              <button type="button" className="secundario" disabled={!nuevo.trim()} onClick={() => agregar(true)}>
                Agregar y comprar
              </button>
            </div>
          </div>
        )}
      </form>

      <Buscador
        abierto={modo === 'buscar'}
        conCampo={false}
        texto={filtros.texto}
        setTexto={(texto) => setFiltros({ ...filtros, texto })}
        placeholder="Buscar y filtrar"
        opciones={
          filtros.persona ? [] : personas.map((p) => ({ etiqueta: `Agregó ${p}`, onElegir: () => setFiltros({ ...filtros, persona: p }) }))
        }
        activos={filtrosActivos}
        resumen={`${pendientes.length} de ${todosPendientes.length} pendientes`}
        onLimpiar={() => setFiltros({ texto: '', persona: null })}
      />

      {error && <p className="error">No se pudo leer la lista: {error}</p>}
      {cargando && !error && <p className="vacio">Cargando…</p>}
      {!cargando && items.length === 0 && !cerrada && <p className="vacio">La lista está vacía. Anotá lo que falta.</p>}
      {!cargando && buscando && hayFiltrosLista(filtros) && todosPendientes.length > 0 && pendientes.length === 0 && (
        <p className="vacio">Nada pendiente coincide con la búsqueda.</p>
      )}

      {orden === 'manual' && enManual.length > 0 && <ul className="lista">{enManual.map((it, i) => filaPendiente(it, i))}</ul>}
      {orden !== 'manual' && seccion('Recién agregados', recientes)}
      {orden === 'alfabetico' && resto.length > 0 && (
        <>
          {recientes.length > 0 && <div className="lista-sub"><span>Pendientes ({resto.length})</span></div>}
          <ul className="lista">{resto.map((it) => filaPendiente(it))}</ul>
        </>
      )}
      {orden === 'grupos' && (
        <>
          {GRUPOS.map((g) => seccion(g.nombre, resto.filter((it) => it.grupo === g.id)))}
          {seccion('Sin grupo', resto.filter((it) => !grupoPorId(it.grupo)))}
        </>
      )}

      {comprados.length > 0 && (
        <>
          <div className="lista-sub">
            <span>Comprados ({comprados.length})</span>
          </div>
          <ul className="lista">
            {comprados.map((it) => {
              const g = miGasto(it)
              return (
                <li key={it.id} className="item-lista comprado">
                  <button
                    className="item-boton"
                    disabled={!g}
                    aria-label={g ? `Ver gasto de ${it.nombre}` : undefined}
                    onClick={() => g && onVerGasto(g)}
                  >
                    <span className="item-fila">
                      <span className="mov-desc">{it.nombre}</span>
                      <span className="mov-monto">{it.montoCent !== null ? fmt(it.montoCent, it.moneda ?? 'ARS') : 'sin gasto'}</span>
                    </span>
                    <span className="mov-det">
                      {[it.cantidad, it.marca].filter(Boolean).join(', ')}
                      {(it.cantidad || it.marca) && ' — '}compró {it.compradoPor ?? '—'}
                    </span>
                  </button>
                  {!cerrada && (
                    <button
                      className="icono chico-icono"
                      aria-label={`Volver ${it.nombre} a pendientes`}
                      title="Volver a pendientes"
                      onClick={() => aPendiente(it)}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                        <path d="M1 7h12" stroke="currentColor" strokeWidth="2.5" />
                      </svg>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {dueno && !cerrada && items.length > 0 && !buscando && (
        <button className="enlace cerrar-lista" onClick={cerrar}>
          Cerrar lista
        </button>
      )}
      <div className="totales-lista total-pie">
        <span className="total-fila">
          Total <strong>{fmtTotales(gastado)}</strong>
        </span>
        {!cerrada && estimado.conPrecio > 0 && (
          <span className="nota">
            Falta ~{fmt(estimado.cent)}
            {estimado.conPrecio < todosPendientes.length && ` (${estimado.conPrecio} de ${todosPendientes.length} con precio conocido)`}
          </span>
        )}
      </div>

      {eligiendoGrupo && (
        <HojaOpciones
          titulo={`Grupo de ${eligiendoGrupo.nombre}`}
          opciones={[...GRUPOS.map((g) => ({ id: g.id, etiqueta: g.nombre })), { id: '', etiqueta: 'Sin grupo' }]}
          actual={eligiendoGrupo.grupo ?? ''}
          onElegir={(id) => {
            const it = eligiendoGrupo
            aprender(it.nombre, id || null)
            cambiarGrupo(lista.id, it.id, id || null).catch(() => onAviso('No se pudo cambiar el grupo'))
          }}
          onCerrar={() => setEligiendoGrupo(null)}
        />
      )}
    </>
  )
}
