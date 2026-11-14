import { IconoLapiz } from '../../components/IconoLapiz'
import { confirmar, pedirTexto } from '../../lib/dialogos'
import { accion } from '../../lib/avisos'
import { Miembros, PieMenu } from '../../components/Compartir'
import { setAjuste } from '../../db/db'
import { borrarLista, esDueno, renombrarLista, salirDeLista, type Lista as TLista } from '../../lib/listaCompras'
import type { Props } from '../Lista'
import { fmtFecha } from './fecha'


export function ListasCerradas({ cerradas, onElegir }: { cerradas: TLista[]; onElegir: (l: TLista) => void }) {
  return (
    <div className="menu-seccion cerradas">
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

export function MenuListas(
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
  const { actual, abiertas, cerradas, uid, email, onCerrar, onNueva, onUnirse } = props
  const elegir = (l: TLista) => {
    setAjuste('listaId', l.id)
    onCerrar()
  }

  async function renombrar(l: TLista) {
    const n = await pedirTexto({ titulo: 'Renombrar lista', valor: l.nombre, boton: 'Guardar' })
    if (n && n !== l.nombre) accion(renombrarLista(l, n), 'Lista renombrada')
  }

  /** El dueño la borra para todos; un miembro sale. */
  async function quitar(l: TLista) {
    const dueno = esDueno(l, uid)
    const ok = await confirmar(
      dueno
        ? {
            titulo: `¿Borrar "${l.nombre}"?`,
            texto: 'Se borra para todos los miembros, con sus ítems. No se puede deshacer. Tus gastos no se tocan.',
            boton: 'Borrar',
            peligro: true,
          }
        : {
            titulo: `¿Salir de "${l.nombre}"?`,
            texto: `Para volver a entrar vas a necesitar el link y que ${l.duenoNombre} te acepte.`,
            boton: 'Salir',
            peligro: true,
          },
    )
    if (!ok) return
    const cerrarSiEra = () => l.id === actual.id && onCerrar()
    if (dueno) accion(borrarLista(l).then(cerrarSiEra), 'Lista borrada')
    else accion(salirDeLista(l).then(cerrarSiEra), 'Saliste de la lista')
  }

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
                      onClick={() => renombrar(l)}
                    >
                      <IconoLapiz />
                    </button>
                  )}
                  <button
                    className="icono chico-icono"
                    aria-label={mia ? `Borrar ${l.nombre}` : `Salir de ${l.nombre}`}
                    onClick={() => quitar(l)}
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
          <Miembros lista={actual} uid={uid} />
        </div>

        {cerradas.length > 0 && <ListasCerradas cerradas={cerradas} onElegir={elegir} />}

        <PieMenu email={email} onCerrar={onCerrar} />
      </div>

    </div>
  )
}
