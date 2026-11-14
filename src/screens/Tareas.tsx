import { useEffect, useMemo, useState } from 'react'
import { avisar, avisarError } from '../lib/avisos'
import { pedirTexto } from '../lib/dialogos'
import { BotonCompartir, Invitacion, Login } from '../components/Compartir'
import type { Datos } from '../lib/datos'
import { setAjuste } from '../db/db'
import {
  crearLista,
  esDeTareas,
  esDueno,
  permisosDe,
  sincronizacionDisponible,
  useMisListas,
  useUsuario,
  type Lista,
} from '../lib/listaCompras'
import { tildarTarea, useTareas, type Tarea } from '../lib/tareas'
import { Bloque, FilaTarea } from './tareas/Bloque'
import { AgregarTarea } from './tareas/AgregarTarea'
import { HojaTarea } from './tareas/HojaTarea'
import { MenuSeccion } from './tareas/MenuSeccion'

export interface Props {
  datos: Datos
  /** Código recibido por link (?tareas=...). */
  invitacion: string | null
  setInvitacion: (id: string | null) => void
}

const TODO = 'todo'

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
  const { datos, uid, email, invitacion, setInvitacion } = props
  const yo = datos.yo?.nombre ?? 'Yo'
  const { listas, cargando, error } = useMisListas(uid)
  const secciones = useMemo(() => listas.filter(esDeTareas), [listas])
  const ids = useMemo(() => secciones.map((l) => l.id), [secciones])
  const { porLista, cargando: cargandoTareas } = useTareas(ids)

  // La sección elegida queda guardada en el teléfono.
  const actual = secciones.find((l) => l.id === datos.tareasSeccion) ?? null
  const elegir = (id: string) => setAjuste('tareasSeccion', id)
  const [menu, setMenu] = useState(false)
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

  async function nuevaSeccion() {
    const nombre = await pedirTexto({
      titulo: 'Nueva sección',
      texto: 'Por ejemplo Viaje o Casa. Después le podés agregar subsecciones y compartirla.',
      boton: 'Crear',
    })
    if (!nombre) return
    try {
      elegir(await crearLista(nombre, yo, undefined, undefined, 'tareas'))
      avisar(`Sección "${nombre}" creada`)
    } catch {
      avisarError('No se pudo crear la sección. Revisá la conexión.')
    }
  }

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
            <button className="primario" onClick={nuevaSeccion}>
              Nueva sección
            </button>
          </div>
        </div>
      </section>
    )

  const tareasDe = (l: Lista) => (porLista[l.id] ?? []).filter((t) => !soloMias || t.responsableUid === uid)
  const vistas = actual ? [actual] : secciones
  const todas = vistas.flatMap(tareasDe)
  const hechas = todas.filter((t) => t.hecha).length
  const hayResponsables = vistas.some((l) => (porLista[l.id] ?? []).some((t) => t.responsableUid))
  const pendientesDe = (l: Lista) => (porLista[l.id] ?? []).filter((t) => !t.hecha).length
  const pedidosActual = actual && esDueno(actual, uid) ? Object.keys(actual.pendientes ?? {}).length : 0
  const otrosMiembros = actual ? Object.entries(actual.miembros ?? {}).filter(([u]) => u !== uid).map(([, n]) => n) : []

  function tildar(l: Lista, t: Tarea) {
    tildarTarea(l.id, t, !t.hecha, yo).catch(() => avisarError('No se pudo actualizar la tarea'))
    if (!t.hecha) avisar(`Hecha: ${t.texto}`, () => tildarTarea(l.id, t, false, yo).catch(() => {}))
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
          <button className="chip seccion-nueva" onClick={nuevaSeccion}>
            + Sección
          </button>
        </div>
        {actual && (
          <>
            <BotonCompartir listaId={actual.id} tipo="tareas" />
            <button
              className="icono borde con-aviso"
              aria-label={`Opciones de ${actual.nombre}` + (pedidosActual ? ': hay pedidos para unirse' : '')}
              onClick={() => setMenu(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="5" cy="12" r="2" fill="currentColor" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <circle cx="19" cy="12" r="2" fill="currentColor" />
              </svg>
              {/* Alguien pidió unirse: se acepta desde este menú. */}
              {pedidosActual > 0 && <span className="aviso-menu" aria-hidden="true" />}
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

      <AgregarTarea secciones={secciones} actual={actual} uid={uid} yo={yo} />

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

      {menu && actual && (
        <MenuSeccion
          lista={actual}
          uid={uid}
          email={email}
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
          onCerrar={() => setAbierta(null)}
        />
      )}
    </section>
  )
}
