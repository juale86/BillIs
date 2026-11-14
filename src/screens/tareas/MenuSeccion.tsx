import { IconoLapiz } from '../../components/IconoLapiz'
import { accion, avisar } from '../../lib/avisos'
import { confirmar, pedirTexto } from '../../lib/dialogos'
import { Miembros, PieMenu } from '../../components/Compartir'
import { borrarLista, esDueno, renombrarLista, salirDeLista, type Lista, type Subseccion } from '../../lib/listaCompras'
import { guardarSubsecciones, nuevoIdSubseccion } from '../../lib/tareas'

/** Opciones de una sección: subsecciones, miembros y permisos, renombrar, borrar o salir. */
export function MenuSeccion(props: {
  lista: Lista
  uid: string
  email: string
  onCerrar: () => void
  onSalio: () => void
}) {
  const { lista, uid, email, onCerrar, onSalio } = props
  const dueno = esDueno(lista, uid)
  const subs = lista.subsecciones ?? []

  async function renombrar() {
    const n = await pedirTexto({ titulo: 'Renombrar sección', valor: lista.nombre, boton: 'Guardar' })
    if (n && n !== lista.nombre) accion(renombrarLista(lista, n), 'Sección renombrada')
  }

  /** Renombra `s`, o crea una nueva si es null. */
  async function editarSub(s: Subseccion | null) {
    const n = await pedirTexto(
      s
        ? { titulo: 'Renombrar subsección', valor: s.nombre, boton: 'Guardar' }
        : {
            titulo: `Nueva subsección en ${lista.nombre}`,
            texto: 'Por ejemplo Qué hacer allá, Cosas para buscar o Comprar antes.',
            boton: 'Crear',
          },
    )
    if (!n) return
    const nombre = n.slice(0, 40)
    accion(
      guardarSubsecciones(lista, s ? subs.map((x) => (x.id === s.id ? { ...x, nombre } : x)) : [...subs, { id: nuevoIdSubseccion(), nombre }]),
    )
  }

  /** El dueño la borra para todos; un miembro sale. */
  async function quitar() {
    const ok = await confirmar(
      dueno
        ? { titulo: `¿Borrar "${lista.nombre}"?`, texto: 'Se borra para todos los miembros, con sus tareas. No se puede deshacer.', boton: 'Borrar', peligro: true }
        : {
            titulo: `¿Salir de "${lista.nombre}"?`,
            texto: `Para volver a entrar vas a necesitar el link y que ${lista.duenoNombre} te acepte.`,
            boton: 'Salir',
            peligro: true,
          },
    )
    if (!ok) return
    if (dueno) accion(borrarLista(lista).then(onSalio), 'Sección borrada')
    else accion(salirDeLista(lista).then(onSalio), 'Saliste de la sección')
  }

  function quitarSub(s: Subseccion) {
    const antes = subs
    accion(guardarSubsecciones(lista, subs.filter((x) => x.id !== s.id)))
    avisar(`Borraste "${s.nombre}". Sus tareas quedan sin subsección`, () => {
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
              <button className="icono chico-icono" aria-label={`Renombrar ${lista.nombre}`} onClick={renombrar}>
                <IconoLapiz />
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
                    <button className="icono chico-icono" aria-label={`Renombrar ${s.nombre}`} onClick={() => editarSub(s)}>
                      <IconoLapiz />
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
              <button className="enlace" onClick={() => editarSub(null)}>
                + Nueva subsección
              </button>
            </div>
          )}
        </div>

        <div className="menu-seccion">
          <Miembros lista={lista} uid={uid} />
          {Object.keys(lista.miembros ?? {}).length < 2 && (
            <p className="nota">Solo la ves vos. Para compartirla, mandá el link con el botón de compartir.</p>
          )}
        </div>

        <div className="menu-seccion">
          <div className="botones">
            <button className="enlace peligro" onClick={quitar}>
              {dueno ? 'Borrar sección' : 'Salir de la sección'}
            </button>
          </div>
        </div>

        <PieMenu email={email} onCerrar={onCerrar} />
      </div>

    </div>
  )
}
