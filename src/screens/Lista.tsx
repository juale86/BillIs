import { useEffect, useState } from 'react'
import { pedirTexto } from '../lib/dialogos'
import { avisar, avisarError } from '../lib/avisos'
import { BotonOrden } from '../components/BotonOrden'
import { BotonCompartir, Invitacion, Login } from '../components/Compartir'
import { setAjuste } from '../db/db'
import type { Movimiento } from '../db/types'
import type { Datos } from '../lib/datos'
import {
  esDeTareas,
  crearLista,
  esDueno,
  extraerListaId,
  guardarOrden,
  leerOrden,
  olvidarRecientes,
  sincronizacionDisponible,
  useMisListas,
  useUsuario,
  type FiltrosLista,
  type ItemLista,
  type OrdenLista,
} from '../lib/listaCompras'
import { OPCIONES_ORDEN } from '../lib/orden'
import { ListasCerradas, MenuListas } from './lista/MenuListas'
import { VistaLista } from './lista/VistaLista'

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
  /** El dueño corrige, con el formulario de gasto completo, lo que compró otro miembro. */
  onCorregir: (listaId: string, item: ItemLista) => void
}

export default function Lista(props: Props) {
  const { usuario, cargando } = useUsuario()
  if (!sincronizacionDisponible)
    return (
      <section className="pantalla">
        <p className="vacio">Las listas compartidas no están disponibles en esta versión.</p>
      </section>
    )
  if (cargando) return <p className="vacio pantalla">Cargando…</p>
  if (!usuario)
    return (
      <Login
        titulo="Listas de compras compartidas"
        texto="Anotá lo que falta, compartilo con tu familia y cargá los gastos desde la lista en el súper. Para eso cada persona inicia sesión con su cuenta de Google. Tus gastos siguen guardados solo en este teléfono."
      />
    )
  return <ConUsuario {...props} uid={usuario.uid} email={usuario.email ?? ''} />
}

function ConUsuario(props: Props & { uid: string; email: string }) {
  const { datos, uid, invitacion, setInvitacion } = props
  const yo = datos.yo?.nombre ?? 'Yo'
  const { listas: todas, cargando, error } = useMisListas(uid)
  // Las de tareas van en su pestaña.
  const listas = todas.filter((l) => !esDeTareas(l))
  const [menu, setMenu] = useState(false)
  // Orden de los pendientes, elegido por teléfono.
  const [orden, setOrden] = useState<OrdenLista>(leerOrden)

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

  // Los miembros de la lista actual quedan en el teléfono: Pagar los ofrece como pagadores.
  const miembrosActual = actual ? Object.entries(actual.miembros ?? {}).filter(([u]) => u !== uid).map(([, n]) => n) : null
  const claveMiembros = miembrosActual ? JSON.stringify(miembrosActual.sort()) : null
  useEffect(() => {
    if (claveMiembros && claveMiembros !== JSON.stringify(datos.miembrosLista)) setAjuste('miembrosLista', JSON.parse(claveMiembros))
  }, [claveMiembros, datos.miembrosLista])

  if (error) return <p className="error pantalla">No se pudieron leer tus listas: {error}</p>
  if (cargando) return <p className="vacio pantalla">Cargando listas…</p>
  if (invitacion && !yaEsMiembro) return <Invitacion codigo={invitacion} uid={uid} yo={yo} onListo={() => setInvitacion(null)} />

  async function nuevaLista() {
    const nombre = await pedirTexto({ titulo: 'Nueva lista', valor: abiertas.length ? '' : 'Súper', boton: 'Crear' })
    if (!nombre) return
    try {
      await setAjuste('listaId', await crearLista(nombre, yo))
      setMenu(false)
      avisar(`Lista "${nombre}" creada`)
    } catch {
      avisarError('No se pudo crear la lista. Revisá la conexión.')
    }
  }

  async function unirseConLink() {
    const id = extraerListaId((await pedirTexto({ titulo: 'Unirme con un link', texto: 'Pegá el link que te pasaron.', boton: 'Seguir' })) ?? '')
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
        {!actual.cerrada && <BotonCompartir listaId={actual.id} tipo="compras" />}
        <BotonOrden
          orden={orden}
          onCambiar={(o) => {
            // Cambiar de orden acomoda también lo recién agregado.
            olvidarRecientes(actual.id)
            guardarOrden(o)
            setOrden(o)
            const op = OPCIONES_ORDEN.find((x) => x.id === o)!
            avisar(`Orden ${op.etiqueta.toLowerCase()}: ${op.detalle}`)
          }}
        />
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

      <VistaLista {...props} key={actual.id} lista={actual} yo={yo} orden={orden} />
    </section>
  )
}
