import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BotonCompartir, Invitacion, Login, Miembros } from '../components/Compartir'
import { Modal } from '../components/Modal'
import { BotonCerrar } from '../components/BotonCerrar'
import type { Datos } from '../lib/datos'
import { setAjuste } from '../db/db'
import { fmtFechaHora } from '../lib/historial'
import {
  borrarLista,
  cerrarSesionGoogle,
  crearLista,
  esDeTareas,
  esDueno,
  permisosDe,
  renombrarLista,
  salirDeLista,
  sincronizacionDisponible,
  useMisListas,
  useUsuario,
  type Lista,
  type Subseccion,
} from '../lib/listaCompras'
import {
  agregarTarea,
  borrarTarea,
  editarTarea,
  fmtVence,
  guardarSubsecciones,
  hoyISO,
  nuevoIdSubseccion,
  porVence,
  restaurarTarea,
  tildarTarea,
  useTareas,
  type DatosTarea,
  type Tarea,
} from '../lib/tareas'

export interface Props {
  datos: Datos
  /** Código recibido por link (?tareas=...). */
  invitacion: string | null
  setInvitacion: (id: string | null) => void
  onAviso: (t: string, deshacer?: () => void) => void
}

const TODO = 'todo'

const accionCon = (onAviso: Props['onAviso']) => (p: Promise<unknown>, ok?: string) =>
  p.then(() => ok && onAviso(ok)).catch(() => alert('No se pudo completar. Revisá la conexión.'))

export default function Tareas(props: Props) {
  const { usuario, cargando } = useUsuario()
  if (!sincronizacionDisponible)
    return (
      <section className="pantalla">
        <p className="vacio">Las tareas no están disponibles en esta versión.</p>
      </section>
    )
  if (cargando) return <p className="vacio pantalla">Cargando…</p>
  if (!usuario)
    return (
      <Login
        titulo="Tareas"
        texto="Organizá lo que hay que hacer, por ejemplo para un viaje, y compartilo con quien quieras. Cada persona inicia sesión con su cuenta de Google. Las secciones que no compartís las ves solo vos."
      />
    )
  return <ConUsuario {...props} uid={usuario.uid} email={usuario.email ?? ''} />
}

function ConUsuario(props: Props & { uid: string; email: string }) {
  const { datos, uid, email, invitacion, setInvitacion, onAviso } = props
  const yo = datos.yo?.nombre ?? 'Yo'
  const { listas, cargando, error } = useMisListas(uid)
  const secciones = useMemo(() => listas.filter(esDeTareas), [listas])
  const ids = useMemo(() => secciones.map((l) => l.id), [secciones])
  const { porLista, cargando: cargandoTareas } = useTareas(ids)

  // La sección elegida queda guardada en el teléfono.
  const actual = secciones.find((l) => l.id === datos.tareasSeccion) ?? null
  const elegir = (id: string) => setAjuste('tareasSeccion', id)
  const [menu, setMenu] = useState(false)
  const [creando, setCreando] = useState(false)
  const [abierta, setAbierta] = useState<{ lista: Lista; tarea: Tarea } | null>(null)
  const [soloMias, setSoloMias] = useState(false)
  const [verHechas, setVerHechas] = useState(false)
  const yaEsMiembro = !!invitacion && secciones.some((l) => l.id === invitacion)

  // Al ser aprobado (o si ya eras miembro) la sección compartida queda elegida.
  useEffect(() => {
    if (invitacion && yaEsMiembro) {
      setAjuste('tareasSeccion', invitacion)
      setInvitacion(null)
    }
  }, [invitacion, yaEsMiembro, setInvitacion])

  if (error) return <p className="error pantalla">No se pudieron leer tus tareas: {error}</p>
  if (cargando) return <p className="vacio pantalla">Cargando tareas…</p>
  if (invitacion && !yaEsMiembro) return <Invitacion codigo={invitacion} uid={uid} yo={yo} onListo={() => setInvitacion(null)} />

  const nuevaSeccion = (
    <Modal
      titulo="Nueva sección"
      valorInicial=""
      etiquetaConfirmar="Crear"
      onCancelar={() => setCreando(false)}
      onConfirmar={async (nombre) => {
        setCreando(false)
        try {
          elegir(await crearLista(nombre, yo, undefined, undefined, 'tareas'))
          onAviso(`Sección "${nombre}" creada`)
        } catch {
          alert('No se pudo crear la sección. Revisá la conexión.')
        }
      }}
    >
      Por ejemplo Viaje o Casa. Después le podés agregar subsecciones y compartirla.
    </Modal>
  )

  if (secciones.length === 0)
    return (
      <section className="pantalla">
        <div className="tarjeta">
          <h3>Organizá lo que hay que hacer</h3>
          <p className="nota">
            Creá una sección, por ejemplo Viaje, con subsecciones como Qué hacer allá o Comprar antes. La podés compartir con
            quien viaja con vos o dejarla solo para vos.
          </p>
          <div className="botones">
            <button className="primario" onClick={() => setCreando(true)}>
              Nueva sección
            </button>
          </div>
        </div>
        {creando && nuevaSeccion}
      </section>
    )

  const tareasDe = (l: Lista) => (porLista[l.id] ?? []).filter((t) => !soloMias || t.responsableUid === uid)
  const vistas = actual ? [actual] : secciones
  const todas = vistas.flatMap(tareasDe)
  const hechas = todas.filter((t) => t.hecha).length
  const hayResponsables = vistas.some((l) => (porLista[l.id] ?? []).some((t) => t.responsableUid))
  const pendientesDe = (l: Lista) => (porLista[l.id] ?? []).filter((t) => !t.hecha).length
  const otrosMiembros = actual ? Object.entries(actual.miembros ?? {}).filter(([u]) => u !== uid).map(([, n]) => n) : []

  function tildar(l: Lista, t: Tarea) {
    tildarTarea(l.id, t, !t.hecha, yo).catch(() => onAviso('No se pudo actualizar la tarea'))
    if (!t.hecha) onAviso(`Hecha: ${t.texto}`, () => tildarTarea(l.id, t, false, yo).catch(() => {}))
  }

  return (
    <section className="pantalla tareas">
      <div className="secciones-fila">
        <div className="chips secciones" role="tablist" aria-label="Secciones">
          <button role="tab" className="chip seccion-chip" aria-selected={!actual} onClick={() => elegir(TODO)}>
            Todo
          </button>
          {secciones.map((l) => {
            const pend = pendientesDe(l)
            const pedidos = esDueno(l, uid) ? Object.keys(l.pendientes ?? {}).length : 0
            return (
              <button key={l.id} role="tab" className="chip seccion-chip" aria-selected={actual?.id === l.id} onClick={() => elegir(l.id)}>
                {l.nombre}
                {pend > 0 && <small>{pend}</small>}
                {pedidos > 0 && <span className="insignia">{pedidos}</span>}
              </button>
            )
          })}
          <button className="chip seccion-nueva" onClick={() => setCreando(true)}>
            + Sección
          </button>
        </div>
        {actual && (
          <>
            <BotonCompartir listaId={actual.id} tipo="tareas" onAviso={onAviso} />
            <button className="icono borde" aria-label={`Opciones de ${actual.nombre}`} onClick={() => setMenu(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="5" cy="12" r="2" fill="currentColor" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <circle cx="19" cy="12" r="2" fill="currentColor" />
              </svg>
            </button>
          </>
        )}
      </div>

      {todas.length > 0 && (
        <div className="progreso">
          <span className="progreso-texto">
            {hechas} de {todas.length} {todas.length === 1 ? 'hecha' : 'hechas'}
            {actual && (
              <small>
                {otrosMiembros.length ? ` Compartida con ${otrosMiembros.join(', ')}.` : ' Solo la ves vos.'}
              </small>
            )}
          </span>
          {hayResponsables && (
            <button className="chip" aria-pressed={soloMias} onClick={() => setSoloMias(!soloMias)}>
              Mías
            </button>
          )}
          <span className="barra" aria-hidden="true">
            <span style={{ width: `${(hechas / todas.length) * 100}%` }} />
          </span>
        </div>
      )}

      <AgregarTarea secciones={secciones} actual={actual} uid={uid} yo={yo} onAviso={onAviso} />

      {cargandoTareas && <p className="vacio">Cargando…</p>}
      {!cargandoTareas && todas.length === 0 && (
        <p className="vacio">
          {soloMias ? 'No tenés tareas a tu cargo.' : actual ? `No hay tareas en ${actual.nombre}. Escribí la primera arriba.` : 'No hay tareas. Escribí la primera arriba.'}
        </p>
      )}

      {vistas.map((l) => (
        <Bloque
          key={l.id}
          lista={l}
          tareas={tareasDe(l).filter((t) => !t.hecha)}
          conTitulo={!actual}
          uid={uid}
          onElegir={() => elegir(l.id)}
          onTildar={(t) => tildar(l, t)}
          onAbrir={(t) => setAbierta({ lista: l, tarea: t })}
        />
      ))}

      {hechas > 0 && (
        <>
          <button className="lista-sub hechas-tit" aria-expanded={verHechas} onClick={() => setVerHechas(!verHechas)}>
            <span>Hechas ({hechas})</span>
            <span aria-hidden="true">{verHechas ? '▾' : '▸'}</span>
          </button>
          {verHechas && (
            <ul className="lista tareas">
              {vistas
                .flatMap((l) => tareasDe(l).filter((t) => t.hecha).map((t) => ({ l, t })))
                .sort((a, b) => (b.t.hechaEn ?? 0) - (a.t.hechaEn ?? 0))
                .map(({ l, t }) => (
                  <FilaTarea
                    key={t.id}
                    t={t}
                    uid={uid}
                    puedeTildar={permisosDe(l, uid).comprar}
                    extra={!actual ? l.nombre : undefined}
                    onTildar={() => tildar(l, t)}
                    onAbrir={() => setAbierta({ lista: l, tarea: t })}
                  />
                ))}
            </ul>
          )}
        </>
      )}

      {creando && nuevaSeccion}
      {menu && actual && (
        <MenuSeccion
          lista={actual}
          uid={uid}
          email={email}
          onAviso={onAviso}
          onCerrar={() => setMenu(false)}
          onSalio={() => {
            setMenu(false)
            elegir(TODO)
          }}
        />
      )}
      {abierta && (
        <HojaTarea
          key={abierta.tarea.id}
          lista={secciones.find((l) => l.id === abierta.lista.id) ?? abierta.lista}
          tarea={(porLista[abierta.lista.id] ?? []).find((t) => t.id === abierta.tarea.id) ?? abierta.tarea}
          uid={uid}
          onAviso={onAviso}
          onCerrar={() => setAbierta(null)}
        />
      )}
    </section>
  )
}

/** Las tareas pendientes de una sección, por subsección. */
function Bloque(props: {
  lista: Lista
  tareas: Tarea[]
  conTitulo: boolean
  uid: string
  onElegir: () => void
  onTildar: (t: Tarea) => void
  onAbrir: (t: Tarea) => void
}) {
  const { lista, tareas, conTitulo, uid, onElegir, onTildar, onAbrir } = props
  const subs = lista.subsecciones ?? []
  const puedeTildar = permisosDe(lista, uid).comprar
  const ordenadas = [...tareas].sort(porVence)
  const grupos: { sub: Subseccion | null; ts: Tarea[] }[] = [
    ...subs.map((sub) => ({ sub, ts: ordenadas.filter((t) => t.subseccion === sub.id) })),
    { sub: null, ts: ordenadas.filter((t) => !subs.some((x) => x.id === t.subseccion)) },
  ].filter((g) => g.ts.length > 0)
  if (conTitulo && grupos.length === 0) return null
  return (
    <div className="bloque-tareas">
      {conTitulo && (
        <button className="seccion-tit" onClick={onElegir}>
          {lista.nombre}
        </button>
      )}
      {grupos.map((g) => (
        <Fragment key={g.sub?.id ?? 'sin'}>
          {(g.sub || subs.length > 0) && (
            <div className="lista-sub grupo-tit">
              <span>{g.sub?.nombre ?? 'Sin subsección'}</span>
            </div>
          )}
          <ul className="lista tareas">
            {g.ts.map((t) => (
              <FilaTarea key={t.id} t={t} uid={uid} puedeTildar={puedeTildar} onTildar={() => onTildar(t)} onAbrir={() => onAbrir(t)} />
            ))}
          </ul>
        </Fragment>
      ))}
    </div>
  )
}

function FilaTarea(props: { t: Tarea; uid: string; puedeTildar: boolean; extra?: string; onTildar: () => void; onAbrir: () => void }) {
  const { t, uid, puedeTildar, extra, onTildar, onAbrir } = props
  const hoy = hoyISO()
  const det: ReactNode[] = []
  if (extra) det.push(extra)
  if (t.hecha) det.push(`hizo ${t.hechaPorUid === uid ? 'vos' : (t.hechaPor ?? 'otro')}`)
  else {
    if (t.responsable) det.push(t.responsableUid === uid ? 'vos' : t.responsable)
    if (t.vence)
      det.push(
        t.vence < hoy ? (
          <span key="v" className="vencida">
            venció el {fmtVence(t.vence)}
          </span>
        ) : t.vence === hoy ? (
          <span key="v" className="para-hoy">
            para hoy
          </span>
        ) : (
          `para el ${fmtVence(t.vence)}`
        ),
      )
  }
  if (t.nota) det.push('con nota')
  return (
    <li className={'tarea' + (t.hecha ? ' hecha' : '')}>
      <button
        className="tilde"
        role="checkbox"
        aria-checked={t.hecha}
        aria-label={t.texto}
        disabled={!puedeTildar}
        onClick={onTildar}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
          <circle cx="11" cy="11" r="9.25" />
          <path d="M6.6 11.4l3 3 5.8-6.3" />
        </svg>
      </button>
      <button className="tarea-texto" onClick={onAbrir}>
        <span className="tarea-nombre">{t.texto}</span>
        {det.length > 0 && (
          <span className="mov-det">
            {det.map((d, i) => (
              <Fragment key={i}>
                {i > 0 && ', '}
                {d}
              </Fragment>
            ))}
          </span>
        )}
      </button>
    </li>
  )
}

/** Campo para agregar: al escribir aparecen sección (en Todo), subsección, responsable y fecha límite. */
function AgregarTarea(props: { secciones: Lista[]; actual: Lista | null; uid: string; yo: string; onAviso: Props['onAviso'] }) {
  const { secciones, actual, uid, yo, onAviso } = props
  const posibles = secciones.filter((l) => permisosDe(l, uid).agregar)
  const [texto, setTexto] = useState('')
  const [destinoId, setDestinoId] = useState<string | null>(null)
  const [subseccion, setSubseccion] = useState<string | null>(null)
  const [responsableUid, setResponsableUid] = useState<string | null>(null)
  const [vence, setVence] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [nuevaSub, setNuevaSub] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const refDetalle = useRef<HTMLDivElement>(null)

  const destino = actual ?? posibles.find((l) => l.id === destinoId) ?? posibles[0] ?? null
  if (!destino || (actual && !permisosDe(actual, uid).agregar)) return null
  const subs = destino.subsecciones ?? []
  const miembros = Object.entries(destino.miembros ?? {})
  const dueno = esDueno(destino, uid)
  const sub = subs.some((s) => s.id === subseccion) ? subseccion : null

  function agregar() {
    if (!texto.trim() || !destino) return
    const resp = miembros.find(([u]) => u === responsableUid)
    agregarTarea(
      destino.id,
      { texto, subseccion: sub, responsableUid: resp?.[0] ?? null, responsable: resp?.[1] ?? null, vence: vence || null, nota: null },
      yo,
    ).catch(() => onAviso('No se pudo guardar la tarea'))
    // La subsección queda (para cargar varias seguidas); la fecha y el responsable, no.
    setTexto('')
    setVence('')
    setResponsableUid(null)
    ref.current?.focus()
  }

  /** Si el foco sale del formulario sin nada escrito, se cierra. */
  function quizasCerrar() {
    setTimeout(() => {
      const a = document.activeElement
      if (a !== ref.current && !refDetalle.current?.contains(a) && !ref.current?.value.trim()) setAbierto(false)
    }, 200)
  }

  return (
    <form
      className="agregar-item agregar-tarea"
      onSubmit={(e) => {
        e.preventDefault()
        agregar()
      }}
    >
      <div className="campo">
        <input
          ref={ref}
          value={texto}
          placeholder={actual ? `Nueva tarea en ${actual.nombre}` : 'Nueva tarea'}
          aria-label="Nueva tarea"
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setAbierto(true)}
          onBlur={quizasCerrar}
        />
      </div>
      {abierto && (
        <div className="agregar-detalle" ref={refDetalle} onBlur={quizasCerrar}>
          <div className="fila">
            {!actual && posibles.length > 1 && (
              <label className="campo crece">
                <select
                  aria-label="Sección"
                  value={destino.id}
                  onChange={(e) => {
                    setDestinoId(e.target.value)
                    setSubseccion(null)
                    setResponsableUid(null)
                  }}
                >
                  {posibles.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(subs.length > 0 || dueno) && (
              <label className="campo crece">
                <select
                  aria-label="Subsección"
                  value={sub ?? ''}
                  onChange={(e) => (e.target.value === '+' ? setNuevaSub(true) : setSubseccion(e.target.value || null))}
                >
                  <option value="">{subs.length ? 'Sin subsección' : 'Subsección'}</option>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                  {dueno && <option value="+">+ Nueva…</option>}
                </select>
              </label>
            )}
          </div>
          <div className="fila">
            {miembros.length > 1 && (
              <label className="campo crece">
                <select aria-label="Responsable" value={responsableUid ?? ''} onChange={(e) => setResponsableUid(e.target.value || null)}>
                  <option value="">Responsable</option>
                  {miembros.map(([u, n]) => (
                    <option key={u} value={u}>
                      {u === uid ? `${n} (vos)` : n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="campo crece fecha-limite">
              <input type="date" aria-label="Fecha límite" value={vence} onChange={(e) => setVence(e.target.value)} />
              {!vence && <span className="placeholder-fecha">Fecha límite</span>}
            </label>
          </div>
          <div className="fila botones-agregar">
            <button type="submit" className="primario" disabled={!texto.trim()}>
              Agregar
            </button>
          </div>
        </div>
      )}
      {nuevaSub && (
        <Modal
          titulo={`Nueva subsección en ${destino.nombre}`}
          valorInicial=""
          etiquetaConfirmar="Crear"
          onCancelar={() => setNuevaSub(false)}
          onConfirmar={(nombre) => {
            setNuevaSub(false)
            const s = { id: nuevoIdSubseccion(), nombre: nombre.slice(0, 40) }
            guardarSubsecciones(destino, [...subs, s]).catch(() => onAviso('No se pudo crear la subsección'))
            setSubseccion(s.id)
            ref.current?.focus()
          }}
        >
          Por ejemplo Qué hacer allá, Cosas para buscar o Comprar antes.
        </Modal>
      )}
    </form>
  )
}

/** Hoja de una tarea: corregirla, elegir responsable, fecha y nota, o borrarla. */
function HojaTarea(props: { lista: Lista; tarea: Tarea; uid: string; onAviso: Props['onAviso']; onCerrar: () => void }) {
  const { lista, tarea, uid, onAviso, onCerrar } = props
  const p = permisosDe(lista, uid)
  const editable = p.editar || (p.agregar && tarea.agregadoPorUid === uid)
  const subs = lista.subsecciones ?? []
  const miembros = Object.entries(lista.miembros ?? {})
  const [texto, setTexto] = useState(tarea.texto)
  const [subseccion, setSubseccion] = useState(subs.some((s) => s.id === tarea.subseccion) ? tarea.subseccion : null)
  const [responsableUid, setResponsableUid] = useState(tarea.responsableUid)
  const [vence, setVence] = useState(tarea.vence ?? '')
  const [nota, setNota] = useState(tarea.nota ?? '')

  function guardar() {
    if (!texto.trim()) return
    const resp = miembros.find(([u]) => u === responsableUid)
    const d: DatosTarea = {
      texto,
      subseccion,
      responsableUid: resp?.[0] ?? null,
      // Si el responsable ya no es miembro, se conserva el nombre que tenía.
      responsable: resp?.[1] ?? (responsableUid === tarea.responsableUid ? tarea.responsable : null),
      vence: vence || null,
      nota,
    }
    editarTarea(lista.id, tarea.id, d).catch(() => onAviso('No se pudo guardar la tarea'))
    onCerrar()
  }

  function borrar() {
    borrarTarea(lista.id, tarea.id).catch(() => onAviso('No se pudo borrar'))
    onAviso(`Borraste "${tarea.texto}"`, () => restaurarTarea(lista.id, tarea).catch(() => onAviso('No se pudo recuperar')))
    onCerrar()
  }

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <form
        className="hoja hoja-tarea"
        role="dialog"
        aria-label="Tarea"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
      >
        <div className="hoja-cab">
          <h3>{lista.nombre}</h3>
          <BotonCerrar onClick={onCerrar} />
        </div>
        <label className="campo">
          <input value={texto} aria-label="Tarea" disabled={!editable} onChange={(e) => setTexto(e.target.value)} />
        </label>
        <div className="fila">
          {subs.length > 0 && (
            <label className="campo crece">
              <select aria-label="Subsección" value={subseccion ?? ''} disabled={!editable} onChange={(e) => setSubseccion(e.target.value || null)}>
                <option value="">Sin subsección</option>
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          {miembros.length > 1 && (
            <label className="campo crece">
              <select
                aria-label="Responsable"
                value={responsableUid ?? ''}
                disabled={!editable}
                onChange={(e) => setResponsableUid(e.target.value || null)}
              >
                <option value="">Sin responsable</option>
                {miembros.map(([u, n]) => (
                  <option key={u} value={u}>
                    {u === uid ? `${n} (vos)` : n}
                  </option>
                ))}
                {tarea.responsableUid && !miembros.some(([u]) => u === tarea.responsableUid) && (
                  <option value={tarea.responsableUid}>{tarea.responsable}</option>
                )}
              </select>
            </label>
          )}
        </div>
        <label className="campo fecha-limite">
          <input type="date" aria-label="Fecha límite" value={vence} disabled={!editable} onChange={(e) => setVence(e.target.value)} />
          {!vence && <span className="placeholder-fecha">Fecha límite</span>}
        </label>
        <label className="campo">
          <textarea
            value={nota}
            rows={3}
            placeholder="Nota: número de reserva, dirección, link"
            aria-label="Nota"
            disabled={!editable}
            onChange={(e) => setNota(e.target.value)}
          />
        </label>
        <div className="historial">
          <p>
            La agregó {tarea.agregadoPorUid === uid ? 'vos' : tarea.agregadoPor} el {fmtFechaHora(tarea.creadoEn)}.
          </p>
          {tarea.hecha && tarea.hechaEn && (
            <p>
              La hizo {tarea.hechaPorUid === uid ? 'vos' : (tarea.hechaPor ?? 'otro')} el {fmtFechaHora(tarea.hechaEn)}.
            </p>
          )}
          {!editable && <p>Para cambiarla hace falta el permiso Editar, que da {lista.duenoNombre}.</p>}
        </div>
        {editable && (
          <button type="button" className="peligro" onClick={borrar}>
            Borrar tarea
          </button>
        )}
        <div className="acciones">
          <button type="button" className="secundario" onClick={onCerrar}>
            Cancelar
          </button>
          {editable && (
            <button type="submit" className="primario" disabled={!texto.trim()}>
              Guardar
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

/** Opciones de una sección: subsecciones, miembros y permisos, renombrar, borrar o salir. */
function MenuSeccion(props: {
  lista: Lista
  uid: string
  email: string
  onAviso: Props['onAviso']
  onCerrar: () => void
  onSalio: () => void
}) {
  const { lista, uid, email, onAviso, onCerrar, onSalio } = props
  const dueno = esDueno(lista, uid)
  const subs = lista.subsecciones ?? []
  const accion = accionCon(onAviso)
  const [modal, setModal] = useState<
    { tipo: 'renombrar' } | { tipo: 'borrar' } | { tipo: 'sub'; sub: Subseccion | null } | null
  >(null)
  const cerrarModal = () => setModal(null)

  function quitarSub(s: Subseccion) {
    const antes = subs
    accion(guardarSubsecciones(lista, subs.filter((x) => x.id !== s.id)))
    onAviso(`Borraste "${s.nombre}". Sus tareas quedan sin subsección`, () => {
      guardarSubsecciones(lista, antes).catch(() => {})
    })
  }

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div className="hoja" role="dialog" aria-label={`Opciones de ${lista.nombre}`} onClick={(e) => e.stopPropagation()}>
        <div className="menu-seccion">
          <div className="menu-fila">
            <h3 className="crece">
              {lista.nombre}
              {!dueno && <small> de {lista.duenoNombre}</small>}
            </h3>
            {dueno && (
              <button className="icono chico-icono" aria-label={`Renombrar ${lista.nombre}`} onClick={() => setModal({ tipo: 'renombrar' })}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 20l1-5L16 4l4 4L9 19z M14 6l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="menu-seccion">
          <h3>Subsecciones</h3>
          {subs.length === 0 && <p className="nota">{dueno ? 'Todavía no tiene. Agregá la primera.' : 'No tiene.'}</p>}
          <ul className="lista">
            {subs.map((s) => (
              <li key={s.id} className="menu-fila">
                <span className="menu-item">{s.nombre}</span>
                {dueno && (
                  <>
                    <button className="icono chico-icono" aria-label={`Renombrar ${s.nombre}`} onClick={() => setModal({ tipo: 'sub', sub: s })}>
                      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 20l1-5L16 4l4 4L9 19z M14 6l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button className="icono chico-icono" aria-label={`Borrar ${s.nombre}`} onClick={() => quitarSub(s)}>
                      ✕
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {dueno && (
            <div className="botones">
              <button className="enlace" onClick={() => setModal({ tipo: 'sub', sub: null })}>
                + Nueva subsección
              </button>
            </div>
          )}
        </div>

        <div className="menu-seccion">
          <Miembros lista={lista} uid={uid} accion={accion} />
          {Object.keys(lista.miembros ?? {}).length < 2 && (
            <p className="nota">Solo la ves vos. Para compartirla, mandá el link con el botón de compartir.</p>
          )}
        </div>

        <div className="menu-seccion">
          <div className="botones">
            <button className="enlace peligro" onClick={() => setModal({ tipo: 'borrar' })}>
              {dueno ? 'Borrar sección' : 'Salir de la sección'}
            </button>
          </div>
        </div>

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
          titulo="Renombrar sección"
          valorInicial={lista.nombre}
          etiquetaConfirmar="Guardar"
          onCancelar={cerrarModal}
          onConfirmar={(n) => {
            cerrarModal()
            if (n !== lista.nombre) accion(renombrarLista(lista, n), 'Sección renombrada')
          }}
        />
      )}
      {modal?.tipo === 'sub' && (
        <Modal
          titulo={modal.sub ? 'Renombrar subsección' : `Nueva subsección en ${lista.nombre}`}
          valorInicial={modal.sub?.nombre ?? ''}
          etiquetaConfirmar={modal.sub ? 'Guardar' : 'Crear'}
          onCancelar={cerrarModal}
          onConfirmar={(n) => {
            const s = modal.sub
            cerrarModal()
            const nombre = n.slice(0, 40)
            accion(
              guardarSubsecciones(
                lista,
                s ? subs.map((x) => (x.id === s.id ? { ...x, nombre } : x)) : [...subs, { id: nuevoIdSubseccion(), nombre }],
              ),
            )
          }}
        >
          {!modal.sub && 'Por ejemplo Qué hacer allá, Cosas para buscar o Comprar antes.'}
        </Modal>
      )}
      {modal?.tipo === 'borrar' &&
        (dueno ? (
          <Modal
            titulo={`¿Borrar "${lista.nombre}"?`}
            etiquetaConfirmar="Borrar"
            peligro
            onCancelar={cerrarModal}
            onConfirmar={() => {
              cerrarModal()
              accion(borrarLista(lista).then(onSalio), 'Sección borrada')
            }}
          >
            Se borra para todos los miembros, con sus tareas. No se puede deshacer.
          </Modal>
        ) : (
          <Modal
            titulo={`¿Salir de "${lista.nombre}"?`}
            etiquetaConfirmar="Salir"
            peligro
            onCancelar={cerrarModal}
            onConfirmar={() => {
              cerrarModal()
              accion(salirDeLista(lista).then(onSalio), 'Saliste de la sección')
            }}
          >
            Para volver a entrar vas a necesitar el link y que {lista.duenoNombre} te acepte.
          </Modal>
        ))}
    </div>
  )
}
