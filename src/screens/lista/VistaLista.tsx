import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { IconoLapiz } from '../../components/IconoLapiz'
import { confirmar } from '../../lib/dialogos'
import { avisar, avisarError } from '../../lib/avisos'
import { NombreItem } from '../../components/NombreItem'
import { textoCantidad } from '../../lib/cantidad'
import { Buscador } from '../../components/Buscador'
import { ordenEntre, useArrastre } from '../../components/useArrastre'
import { db, normalizar, setAjuste } from '../../db/db'
import type { Moneda } from '../../db/types'
import {
  agregarItem,
  cambiarGrupo,
  permisosDe,
  editarItem,
  borrarItem,
  cerrarLista,
  esDueno,
  filtrar,
  hayFiltrosLista,
  marcarReciente,
  moverItem,
  nuevaConPendientes,
  ordenDe,
  recientesDe,
  restaurarItem,
  totales,
  useItems,
  volverAPendiente,
  type ItemLista,
  type OrdenLista,
  type Lista as TLista,
} from '../../lib/listaCompras'
import { grupoPorId, sugerirGrupo } from '../../lib/grupos'
import { fmt } from '../../lib/money'
import { sugerirDescripciones } from '../../lib/sugerencias'
import type { Props } from '../Lista'
import { fmtFecha } from './fecha'

const inicioDeHoy = () => new Date(new Date().toDateString()).getTime()
const fmtTotales = (t: [Moneda, number][]) => (t.length ? t.map(([m, c]) => fmt(c, m)).join(' + ') : fmt(0))

export function VistaLista(props: Props & { uid: string; lista: TLista; yo: string; orden: OrdenLista }) {
  const { datos, lista, uid, yo, orden, filtros, setFiltros, onComprar, onVerGasto, onBorrarGasto, onCorregir } = props
  const { items, cargando, error, pendiente } = useItems(lista.id)
  const dueno = esDueno(lista, uid)
  const cerrada = lista.cerrada
  const puede = permisosDe(lista, uid)
  /** Abierta: con permiso de editar, o con el de agregar si el ítem es tuyo. Cerrada: solo el dueño. */
  const corrige = (it: ItemLista) => (cerrada ? dueno : puede.editar || (puede.agregar && it.agregadoPorUid === uid))
  const agrega = !cerrada && puede.agregar

  // Qué se muestra debajo de los dos campos: el formulario de agregar o los filtros de búsqueda.
  const [modo, setModo] = useState<'agregar' | 'buscar' | null>(null)
  // Ítem cuyo nombre se está corrigiendo en el campo "Agregar a la lista" (lápiz).
  const [editando, setEditando] = useState<ItemLista | null>(null)
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
  const grupoPropuesto = sugerirGrupo(nuevo, marca, datos.gruposAprendidos, items, datos.grupos)
  const grupoNuevo = grupoElegido === undefined ? grupoPropuesto : grupoElegido

  // Al buscar solo importan los pendientes: lo comprado no se muestra.
  const buscando = modo === 'buscar' || hayFiltrosLista(filtros)
  const todosPendientes = useMemo(() => items.filter((i) => !i.comprado), [items])
  const pendientes = filtrar(todosPendientes, filtros)
  const comprados = buscando ? [] : items.filter((i) => i.comprado).sort((a, b) => b.modificadoEn - a.modificadoEn)
  // Quién puede haber agregado: los miembros de la lista y quien haya agregado algo (aunque ya no esté).
  const quienes = new Map<string, string>(items.map((i) => [i.agregadoPorUid, i.agregadoPor]))
  for (const [u, n] of Object.entries(lista.miembros ?? {})) quienes.set(u, n)
  const personas = [...quienes].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  const gastado = totales(items)

  const alfabetico = (a: ItemLista, b: ItemLista) => a.nombre.localeCompare(b.nombre, 'es')
  // Manual: por orden (lo último agregado tiene el menor). Los otros órdenes dejan arriba lo recién agregado.
  const enManual = [...pendientes].sort((a, b) => ordenDe(a) - ordenDe(b))
  const idsRecientes = orden === 'manual' ? [] : recientesDe(lista.id)
  const recientes = idsRecientes.flatMap((id) => pendientes.filter((it) => it.id === id))
  const resto = pendientes.filter((it) => !idsRecientes.includes(it.id)).sort(alfabetico)

  // Los pendientes se reordenan arrastrando la manija de cada fila (solo en orden manual).
  const { arrastrando, estilo, manija } = useArrastre((desde, hasta) => {
    const it = enManual[desde]
    const nuevoOrden = ordenEntre(enManual.map(ordenDe), desde, hasta)
    moverItem(lista.id, it.id, nuevoOrden).catch(() => avisarError('No se pudo mover el ítem'))
  })

  const miGasto = (it: ItemLista) => datos.movimientos.find((m) => m.listaItem?.itemId === it.id)

  // Otro día, otra lista: si ya hubo compras en un día anterior, al dueño se le ofrece (una vez por día) empezar una nueva.
  const deOtroDia = !cargando && !cerrada && dueno && items.some((it) => it.comprado && it.modificadoEn < inicioDeHoy())
  useEffect(() => {
    if (!deOtroDia) return
    const clave = `billis.nuevaListaPreguntada.${lista.id}`
    const hoy = new Date().toDateString()
    try {
      if (localStorage.getItem(clave) === hoy) return
    } catch {
      /* sin almacenamiento: se pregunta igual */
    }
    const t = setTimeout(async () => {
      // Se anota recién al preguntar: si la pantalla se cerró antes, se vuelve a ofrecer.
      try {
        localStorage.setItem(clave, hoy)
      } catch {
        /* idem */
      }
      const n = items.filter((it) => !it.comprado).length
      const ok = await confirmar({
        titulo: '¿Empezar una lista nueva?',
        texto: `"${lista.nombre}" tiene compras de otro día.${n ? ` La nueva arranca con los ${n} pendientes.` : ''}`,
        boton: 'Empezar',
      })
      if (!ok) return
      await cerrarLista(lista)
      await setAjuste('listaId', await nuevaConPendientes(lista, items.filter((it) => !it.comprado), yo))
      avisar('Lista nueva para hoy')
    }, 300)
    return () => clearTimeout(t)
    // Solo cuando se cumple la condición; items y lista se leen en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deOtroDia, lista.id])

  /** Recuerda en este teléfono el grupo elegido a mano para un producto. */
  function aprender(nombre: string, grupo: string | null) {
    const n = normalizar(nombre)
    if (!n || !grupo) return
    if (datos.gruposAprendidos[n] !== grupo) setAjuste('gruposLista', { ...datos.gruposAprendidos, [n]: grupo })
  }

  /** Lápiz: abre el mismo formulario de agregar, con los datos del ítem para corregirlos. */
  function empezarAEditar(it: ItemLista) {
    setEditando(it)
    setNuevo(it.nombre)
    setCantidad(it.cantidad ?? '')
    setMarca(it.marca ?? '')
    // Con grupo se respeta el que tiene; sin grupo, la app lo propone con el nombre (como al agregar).
    setGrupoElegido(grupoPorId(datos.grupos, it.grupo) ? it.grupo : undefined)
    setModo('agregar')
    requestAnimationFrame(() => {
      refNuevo.current?.focus()
      refNuevo.current?.select()
    })
  }

  /** Sale de la edición y deja el formulario vacío. */
  function terminarDeEditar() {
    setEditando(null)
    setNuevo('')
    setCantidad('')
    setMarca('')
    setGrupoElegido(undefined)
  }

  /** Guarda lo corregido: nombre, cantidad, marca y grupo. El ítem no cambia de lugar. */
  function guardarEdicion() {
    const it = editando
    if (!it || !nuevo.trim()) return
    if (grupoNuevo && grupoNuevo !== it.grupo) aprender(nuevo, grupoNuevo)
    editarItem(lista.id, it.id, { nombre: nuevo, cantidad, marca, grupo: grupoNuevo }).catch(() =>
      avisarError('No se pudo guardar el cambio'),
    )
    terminarDeEditar()
    setModo(null)
    refNuevo.current?.blur()
  }

  /** Agrega arriba de todo. comprar: además abre el gasto, por si lo encontraste en el súper. */
  function agregar(comprar: boolean) {
    if (!nuevo.trim()) return
    if (grupoElegido !== undefined) aprender(nuevo, grupoElegido)
    const { id, item, guardado } = agregarItem(lista.id, { nombre: nuevo, cantidad, marca, grupo: grupoNuevo }, yo)
    guardado.catch(() => avisarError('No se pudo guardar el ítem'))
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
    const borrarGasto =
      !!g &&
      (await confirmar({
        titulo: `¿Borrar también el gasto de ${fmt(g.totalCent, g.moneda)}?`,
        texto: 'Si no, el gasto queda en Movimientos.',
        boton: 'Borrar',
        peligro: true,
      }))
    // Mientras se preguntaba el gasto pudo cambiar (otra pestaña, una corrección): se usa como está ahora,
    // y si ya lo borraron o dejó de ser de este ítem, no se toca.
    const ahora = g && (await db.movimientos.get(g.id))
    const sigue = !!ahora && !ahora.borradoEn && ahora.listaItem?.itemId === it.id
    if (sigue && borrarGasto) return onBorrarGasto(ahora)
    if (sigue) await db.movimientos.update(ahora.id, { listaItem: undefined, modificadoEn: Date.now() })
    volverAPendiente(lista.id, it.id).catch(() => avisarError('No se pudo actualizar el ítem'))
  }

  async function cerrar() {
    const ok = await confirmar({ titulo: `¿Cerrar "${lista.nombre}"?`, texto: 'Queda archivada con su total y ya nadie puede editarla.', boton: 'Cerrar' })
    if (!ok) return
    await cerrarLista(lista)
    avisar('Lista cerrada')
    if (todosPendientes.length) await ofrecerNueva()
  }

  async function ofrecerNueva() {
    const ok = await confirmar({ titulo: `¿Abrir una lista nueva con los ${todosPendientes.length} pendientes?`, texto: 'Con los mismos miembros.', boton: 'Abrir' })
    if (!ok) return
    await setAjuste('listaId', await nuevaConPendientes(lista, todosPendientes, yo))
    avisar('Lista nueva creada')
  }

  const filtrosActivos = filtros.persona
    ? [{ etiqueta: `Agregado por ${quienes.get(filtros.persona) ?? 'otro'}`, onQuitar: () => setFiltros({ ...filtros, persona: null }) }]
    : []

  /** Quita un ítem y ofrece deshacerlo. */
  function quitar(it: ItemLista) {
    borrarItem(lista.id, it.id).catch(() => avisarError('No se pudo quitar'))
    avisar(`Quitaste ${it.nombre}`, () => {
      restaurarItem(lista.id, it).catch(() => avisarError('No se pudo volver a agregar'))
    })
  }

  const lapiz = (it: ItemLista) => (
    <button className="icono chico-icono lapiz" aria-label={`Corregir ${it.nombre}`} onClick={() => empezarAEditar(it)}>
      <IconoLapiz tam={19} />
    </button>
  )

  /** Fila de un pendiente. i: posición en la lista manual, si se puede arrastrar. */
  function filaPendiente(it: ItemLista, i?: number) {
    const g = grupoPorId(datos.grupos, it.grupo)
    const arrastrable = i !== undefined && !cerrada && puede.editar && enManual.length > 1
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
        <button
          className="item-boton item-renglon"
          disabled={cerrada || !puede.comprar}
          aria-label={!cerrada && !puede.comprar ? `${it.nombre} (no tenés permiso para comprar)` : undefined}
          onClick={() => onComprar(lista.id, it)}
        >
          <NombreItem nombre={it.nombre} marca={it.marca} cantidad={textoCantidad(it.cantidad)} />
        </button>
        {corrige(it) && (
          <button
            className={'chip-grupo' + (g ? '' : ' vacio')}
            aria-label={g ? `Grupo ${g.corto}, cambiar` : `Elegir grupo de ${it.nombre}`}
            onClick={() => setEligiendoGrupo(it)}
          >
            {/* Todos los nombres apilados e invisibles: el chip toma el ancho del más largo. */}
            <span className="chip-grupo-ancho">
              {[...datos.grupos.map((x) => x.corto), 'Grupo'].map((n) => (
                <span key={n} aria-hidden="true">
                  {n}
                </span>
              ))}
              <span className="chip-grupo-texto">{g ? g.corto : 'Grupo'}</span>
            </span>
            <span aria-hidden="true">▾</span>
          </button>
        )}
        {corrige(it) && (
          // Lápiz y ✕ juntos, como un par de acciones sobre el ítem.
          <span className="item-acciones-par">
            {lapiz(it)}
            {!cerrada && (
              <button className="icono chico-icono quitar" aria-label={`Quitar ${it.nombre}`} onClick={() => quitar(it)}>
                ✕
              </button>
            )}
          </span>
        )}
      </li>
    )
  }

  const seccion = (titulo: string, filas: ItemLista[]) =>
    filas.length > 0 && (
      <Fragment key={titulo}>
        <div className="lista-sub grupo-tit">
          <span>{titulo}</span>
        </div>
        <ul className={'lista' + (orden === 'grupos' ? ' en-grupo' : '')}>{filas.map((it) => filaPendiente(it))}</ul>
      </Fragment>
    )

  return (
    <>
      {pendiente && <p className="nota">Sin conexión: se sincroniza al volver la señal.</p>}

      {cerrada && (
        <div className="banner">
          Lista cerrada el {fmtFecha(lista.cerradaEn ?? Date.now())}.{' '}
          {dueno ? 'Solo vos podés corregir sus ítems.' : 'Ya no se puede editar.'}
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
          if (editando) guardarEdicion()
          else agregar(false)
        }}
      >
        <div className="entradas-lista">
          {(agrega || editando) && (
            <div className="campo">
              <input
                ref={refNuevo}
                value={nuevo}
                placeholder="Agregar a la lista"
                aria-label={editando ? `Producto (corrigiendo ${editando.nombre})` : 'Agregar a la lista'}
                autoComplete="off"
                enterKeyHint="next"
                onChange={(e) => {
                  setNuevo(e.target.value)
                  setVerSug(true)
                }}
                onKeyDown={(e) => {
                  // "Siguiente" del teclado: pasa a la cantidad (y de ahí a la marca) en vez de agregar.
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  setVerSug(false)
                  if (nuevo.trim()) refDetalle.current?.querySelector<HTMLInputElement>('input[aria-label="Cantidad"]')?.focus()
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
              {!editando && sugerencias.length > 0 && (
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
              onFocus={() => {
                if (editando) terminarDeEditar()
                setModo('buscar')
              }}
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

        {modo === 'agregar' && (agrega || editando) && (
          <div className="agregar-detalle" ref={refDetalle} onBlur={quizasCerrarAgregar}>
            <div className="fila">
              <label className="campo chico">
                <input
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="Cant"
                  aria-label="Cantidad"
                  enterKeyHint="next"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    refDetalle.current?.querySelector<HTMLInputElement>('input[aria-label="Marca"]')?.focus()
                  }}
                />
              </label>
              <label className="campo crece">
                <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca" aria-label="Marca" enterKeyHint="done" />
              </label>
              <label className="campo grupo-campo">
                <select
                  aria-label="Grupo"
                  className={grupoNuevo ? '' : 'resaltado'}
                  value={grupoNuevo ?? ''}
                  onChange={(e) => setGrupoElegido(e.target.value || null)}
                >
                  <option value="">Grupo</option>
                  {datos.grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.corto}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {/* Mismo formulario para agregar y para corregir (lápiz); solo cambian los botones. */}
            <div className="fila botones-agregar">
              {editando ? (
                <>
                  <button type="submit" className="primario" disabled={!nuevo.trim()}>
                    Guardar
                  </button>
                  <button
                    type="button"
                    className="secundario"
                    onClick={() => {
                      terminarDeEditar()
                      setModo(null)
                    }}
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button type="submit" className="primario" disabled={!nuevo.trim()}>
                    Agregar
                  </button>
                  {puede.comprar && (
                    <button type="button" className="secundario" disabled={!nuevo.trim()} onClick={() => agregar(true)}>
                      Agregar y comprar
                    </button>
                  )}
                </>
              )}
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
          filtros.persona
            ? []
            : personas.map(([u, n]) => ({ etiqueta: `Agregado por ${n}`, onElegir: () => setFiltros({ ...filtros, persona: u }) }))
        }
        activos={filtrosActivos}
        onLimpiar={() => setFiltros({ texto: '', persona: null })}
      />

      {error && <p className="error">No se pudo leer la lista: {error}</p>}
      {cargando && !error && <p className="vacio">Cargando…</p>}
      {!cargando && items.length === 0 && !cerrada && <p className="vacio">La lista está vacía. Anotá lo que falta.</p>}
      {!cargando && buscando && hayFiltrosLista(filtros) && todosPendientes.length > 0 && pendientes.length === 0 && (
        <p className="vacio">No hay coincidencias en la lista</p>
      )}

      {orden === 'manual' && enManual.length > 0 && <ul className="lista">{enManual.map((it, i) => filaPendiente(it, i))}</ul>}
      {orden !== 'manual' && seccion('Recién agregados', recientes)}
      {orden === 'alfabetico' && resto.length > 0 && (
        <>
          {recientes.length > 0 && <div className="lista-sub grupo-tit"><span>Pendientes</span></div>}
          <ul className="lista">{resto.map((it) => filaPendiente(it))}</ul>
        </>
      )}
      {orden === 'grupos' && (
        <>
          {datos.grupos.map((g) => seccion(g.nombre, resto.filter((it) => it.grupo === g.id)))}
          {seccion('Sin grupo', resto.filter((it) => !grupoPorId(datos.grupos, it.grupo)))}
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
              // Lo que compró otro: el dueño lo corrige con el formulario de gasto completo.
              const ajeno = it.compradoPorUid !== uid
              const corrigeAjeno = dueno && ajeno
              return (
                <li key={it.id} className="item-lista comprado">
                  <button
                    className="item-boton"
                    disabled={!g && !corrigeAjeno}
                    aria-label={g ? `Ver gasto de ${it.nombre}` : corrigeAjeno ? `Corregir ${it.nombre}` : undefined}
                    onClick={() => (g ? onVerGasto(g) : corrigeAjeno && onCorregir(lista.id, it))}
                  >
                    <span className="item-fila">
                      <NombreItem nombre={it.nombre} marca={it.marca} cantidad={textoCantidad(it.cantidad)} />
                      <span className="mov-monto">{it.montoCent !== null ? fmt(it.montoCent, it.moneda ?? 'ARS') : 'sin gasto'}</span>
                    </span>
                    <span className="mov-det">
                      compró {it.compradoPor ?? '—'}
                      {it.corregidoPor && `, corrigió ${it.corregidoPor}`}
                    </span>
                  </button>
                  {corrigeAjeno && (
                    <button className="icono chico-icono lapiz" aria-label={`Corregir ${it.nombre}`} onClick={() => onCorregir(lista.id, it)}>
                      <IconoLapiz tam={19} />
                    </button>
                  )}
                  {/* Lo suyo, cerrada la lista, el dueño lo corrige como ítem (su gasto se abre tocándolo). */}
                  {dueno && cerrada && !ajeno && lapiz(it)}
                  {!cerrada && puede.comprar && (
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

      {/* Fijo abajo, sobre las pestañas: la lista se desplaza por detrás. */}
      <div className="totales-lista total-pie total-fijo">
        <span className="total-fila">
          <span>
            Total
            {dueno && !cerrada && items.length > 0 && (
              <button className="enlace cerrar-lista" onClick={cerrar}>
                Cerrar lista
              </button>
            )}
          </span>
          <strong>{fmtTotales(gastado)}</strong>
        </span>
      </div>

      {eligiendoGrupo && (
        <HojaOpciones
          titulo={`Grupo de ${eligiendoGrupo.nombre}`}
          opciones={[...datos.grupos.map((g) => ({ id: g.id, etiqueta: g.nombre })), { id: '', etiqueta: 'Sin grupo' }]}
          actual={eligiendoGrupo.grupo ?? ''}
          onElegir={(id) => {
            const it = eligiendoGrupo
            aprender(it.nombre, id || null)
            cambiarGrupo(lista.id, it.id, id || null).catch(() => avisarError('No se pudo cambiar el grupo'))
          }}
          onCerrar={() => setEligiendoGrupo(null)}
        />
      )}
    </>
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
