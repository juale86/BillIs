import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Buscador } from '../components/Buscador'
import { db, setAjuste } from '../db/db'
import type { Moneda, Movimiento } from '../db/types'
import type { Datos } from '../lib/datos'
import {
  agregarItem,
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
  iniciarSesion,
  linkLista,
  nuevaConPendientes,
  pedirUnirse,
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
  type Lista as TLista,
} from '../lib/listaCompras'
import { fmt } from '../lib/money'
import { sugerirDescripciones, ultimoPrecio } from '../lib/sugerencias'

export interface Props {
  datos: Datos
  /** Código recibido por link (?lista=...). */
  invitacion: string | null
  setInvitacion: (id: string | null) => void
  buscando: boolean
  /** Botón de búsqueda, al lado del nombre de la lista. */
  lupa: ReactNode
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
        {props.lupa}
        {!actual.cerrada && <BotonCompartir listaId={actual.id} onAviso={onAviso} />}
      </div>

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

      <VistaLista {...props} key={actual.id} lista={actual} yo={yo} />
    </section>
  )
}

function BotonCompartir({ listaId, onAviso }: { listaId: string; onAviso: (t: string) => void }) {
  return (
    <button
      className="secundario boton-chico"
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
      Compartir
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

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div className="hoja" role="dialog" aria-label="Listas" onClick={(e) => e.stopPropagation()}>
        <div className="menu-seccion">
          <h3>Tus listas</h3>
          <ul className="lista">
            {abiertas.map((l) => (
              <li key={l.id}>
                <button className="menu-item" aria-current={l.id === actual.id} onClick={() => elegir(l)}>
                  {l.nombre}
                  {l.duenoUid !== uid && <small> de {l.duenoNombre}</small>}
                </button>
              </li>
            ))}
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
          <h3>"{actual.nombre}"</h3>
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
          <p className="nota">Miembros:</p>
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
          <div className="botones">
            {dueno && !actual.cerrada && (
              <button
                className="enlace"
                onClick={() => {
                  const n = prompt('Nuevo nombre', actual.nombre)?.trim()
                  if (n) accion(renombrarLista(actual, n))
                }}
              >
                Renombrar
              </button>
            )}
            {dueno && (
              <button
                className="enlace peligro"
                onClick={() =>
                  confirm(`¿Borrar "${actual.nombre}" para todos? No se puede deshacer.`) &&
                  accion(borrarLista(actual).then(onCerrar), 'Lista borrada')
                }
              >
                Borrar lista
              </button>
            )}
            {!dueno && (
              <button
                className="enlace peligro"
                onClick={() =>
                  confirm(`¿Salir de "${actual.nombre}"?`) && accion(salirDeLista(actual).then(onCerrar), 'Saliste de la lista')
                }
              >
                Salir de la lista
              </button>
            )}
          </div>
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
    </div>
  )
}

function VistaLista(props: Props & { uid: string; lista: TLista; yo: string }) {
  const { datos, lista, uid, yo, buscando, filtros, setFiltros, onComprar, onVerGasto, onBorrarGasto, onAviso } = props
  const { items, cargando, error, pendiente } = useItems(lista.id)
  const dueno = esDueno(lista, uid)
  const cerrada = lista.cerrada

  const [nuevo, setNuevo] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [marca, setMarca] = useState('')
  const [verSug, setVerSug] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)

  const sugerencias = useMemo(
    () => (verSug ? sugerirDescripciones(datos.movimientos, 'gasto', nuevo).slice(0, 4) : []),
    [verSug, datos.movimientos, nuevo],
  )
  const todosPendientes = useMemo(() => items.filter((i) => !i.comprado), [items])
  const visibles = filtrar(items, filtros)
  const pendientes = visibles.filter((i) => !i.comprado).sort((a, b) => a.creadoEn - b.creadoEn)
  const comprados = visibles.filter((i) => i.comprado).sort((a, b) => b.modificadoEn - a.modificadoEn)
  const personas = [...new Set(items.map((i) => i.agregadoPor))].sort()
  const gastado = totales(items)

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

  const miGasto = (it: ItemLista) => datos.movimientos.find((m) => m.listaItem?.itemId === it.id)

  function agregar() {
    if (!nuevo.trim()) return
    agregarItem(lista.id, { nombre: nuevo, cantidad, marca }, yo).catch(() => onAviso('No se pudo guardar el ítem'))
    setNuevo('')
    setCantidad('')
    setMarca('')
  }

  async function aPendiente(it: ItemLista) {
    const g = miGasto(it)
    setAbierto(null)
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

  const filtrosActivos = [
    ...(filtros.estado
      ? [{ etiqueta: filtros.estado === 'pendientes' ? 'Pendientes' : 'Comprados', onQuitar: () => setFiltros({ ...filtros, estado: null }) }]
      : []),
    ...(filtros.persona ? [{ etiqueta: `Agregó ${filtros.persona}`, onQuitar: () => setFiltros({ ...filtros, persona: null }) }] : []),
  ]

  return (
    <>
      <div className="totales-lista">
        <span>
          Gastado <strong>{fmtTotales(gastado)}</strong>
        </span>
        {!cerrada && estimado.conPrecio > 0 && (
          <span className="nota">
            Falta ~{fmt(estimado.cent)}
            {estimado.conPrecio < todosPendientes.length && ` (${estimado.conPrecio} de ${todosPendientes.length} con precio conocido)`}
          </span>
        )}
      </div>
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

      <Buscador
        abierto={buscando}
        texto={filtros.texto}
        setTexto={(texto) => setFiltros({ ...filtros, texto })}
        placeholder="Buscar en la lista"
        opciones={[
          ...(filtros.estado
            ? []
            : [
                { etiqueta: 'Pendientes', onElegir: () => setFiltros({ ...filtros, estado: 'pendientes' }) },
                { etiqueta: 'Comprados', onElegir: () => setFiltros({ ...filtros, estado: 'comprados' }) },
              ]),
          ...(filtros.persona ? [] : personas.map((p) => ({ etiqueta: `Agregó ${p}`, onElegir: () => setFiltros({ ...filtros, persona: p }) }))),
        ]}
        activos={filtrosActivos}
        resumen={`${visibles.length} de ${items.length} ítems`}
        onLimpiar={() => setFiltros({ texto: '', estado: null, persona: null })}
      />

      {!cerrada && !buscando && (
        <form
          className="agregar-item"
          onSubmit={(e) => {
            e.preventDefault()
            agregar()
          }}
        >
          <div className="campo">
            <input
              value={nuevo}
              placeholder="Agregar a la lista"
              aria-label="Agregar a la lista"
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => {
                setNuevo(e.target.value)
                setVerSug(true)
              }}
              onFocus={() => setVerSug(true)}
              onBlur={() => setVerSug(false)}
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
          {nuevo.trim() && (
            <div className="fila">
              <label className="campo chico">
                <span>Cantidad</span>
                <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="3, 1 kg" />
              </label>
              <label className="campo crece">
                <span>Marca</span>
                <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Opcional" />
              </label>
              <button className="primario boton-campo">Agregar</button>
            </div>
          )}
        </form>
      )}

      {error && <p className="error">No se pudo leer la lista: {error}</p>}
      {cargando && !error && <p className="vacio">Cargando…</p>}
      {!cargando && items.length === 0 && !cerrada && <p className="vacio">La lista está vacía. Anotá lo que falta.</p>}
      {!cargando && items.length > 0 && visibles.length === 0 && <p className="vacio">Nada coincide con los filtros.</p>}

      {pendientes.length > 0 && (
        <ul className="lista">
          {pendientes.map((it) => (
            <li key={it.id} className="item-lista">
              <button className="item-boton" disabled={cerrada} onClick={() => onComprar(lista.id, it)}>
                <span className="mov-desc">{it.nombre}</span>
                <span className="mov-det">
                  {[it.cantidad, it.marca].filter(Boolean).join(', ')}
                  {(it.cantidad || it.marca) && ' — '}agregó {it.agregadoPor}
                </span>
              </button>
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
          ))}
        </ul>
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
                  <button className="item-boton" onClick={() => setAbierto(abierto === it.id ? null : it.id)} aria-expanded={abierto === it.id}>
                    <span className="item-fila">
                      <span className="mov-desc">{it.nombre}</span>
                      <span className="mov-monto">{it.montoCent !== null ? fmt(it.montoCent, it.moneda ?? 'ARS') : 'sin gasto'}</span>
                    </span>
                    <span className="mov-det">
                      {[it.cantidad, it.marca].filter(Boolean).join(', ')}
                      {(it.cantidad || it.marca) && ' — '}compró {it.compradoPor ?? '—'}
                    </span>
                  </button>
                  {abierto === it.id && (
                    <div className="item-acciones">
                      {!cerrada && (
                        <button className="enlace" onClick={() => aPendiente(it)}>
                          Volver a pendientes
                        </button>
                      )}
                      {g && (
                        <button className="enlace" onClick={() => onVerGasto(g)}>
                          Ver gasto
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {dueno && !cerrada && items.length > 0 && (
        <button className="enlace cerrar-lista" onClick={cerrar}>
          Cerrar lista
        </button>
      )}
    </>
  )
}
