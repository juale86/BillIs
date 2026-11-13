import { useState } from 'react'
import { confirmar } from '../lib/dialogos'
import { accion, avisar, avisarError } from '../lib/avisos'
import {
  aprobar,
  cambiarPermiso,
  cancelarPedido,
  cerrarSesionGoogle,
  esDueno,
  etiquetasPermiso,
  iniciarSesion,
  linkLista,
  pedirUnirse,
  permisosDe,
  rechazar,
  sacarMiembro,
  useListaDoc,
  type Lista,
  type Permisos,
  type TipoLista,
} from '../lib/listaCompras'

/**
 * Lo que comparten las listas de compras y las de tareas: iniciar sesión, invitar por link,
 * pedir unirse y los miembros con sus permisos.
 */

export function Login({ titulo, texto }: { titulo: string; texto: string }) {
  const [ocupado, setOcupado] = useState(false)
  return (
    <section className="pantalla">
      <div className="tarjeta">
        <h3>{titulo}</h3>
        <p className="nota">{texto}</p>
        <button
          className="primario"
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true)
            try {
              await iniciarSesion()
            } catch (e) {
              avisarError(`No se pudo iniciar sesión: ${e instanceof Error ? e.message : e}`)
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

export function BotonCompartir({
  listaId,
  tipo,
}: {
  listaId: string
  tipo: TipoLista
}) {
  return (
    <button
      className="icono borde"
      aria-label={tipo === 'tareas' ? 'Compartir sección' : 'Compartir lista'}
      onClick={async () => {
        const url = linkLista(listaId, tipo)
        try {
          if (navigator.share)
            await navigator.share(
              tipo === 'tareas'
                ? { title: 'Tareas', text: 'Sumate a estas tareas en BillIs', url }
                : { title: 'Lista de compras', text: 'Sumate a mi lista de compras en BillIs', url },
            )
          else {
            await navigator.clipboard.writeText(url)
            avisar('Link copiado')
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

/** Quien abre un link de invitación: ve la lista y pide unirse; el dueño lo aprueba. */
export function Invitacion({ codigo, uid, yo, onListo }: { codigo: string; uid: string; yo: string; onListo: () => void }) {
  const lista = useListaDoc(codigo)
  if (lista === undefined) return <p className="vacio pantalla">Buscando…</p>
  if (lista === null)
    return (
      <section className="pantalla">
        <div className="tarjeta">
          <h3>No encontramos eso</h3>
          <p className="nota">El link puede estar incompleto o lo borraron.</p>
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
          <p className="nota">Le pediste unirte. Cuando {lista.duenoNombre} te apruebe, aparece acá sola.</p>
        ) : (
          <p className="nota">Pedí unirte y {lista.duenoNombre} te va a aprobar desde su teléfono.</p>
        )}
        <div className="botones">
          {!lista.cerrada && !pedido && (
            <button className="primario" onClick={() => pedirUnirse(codigo, yo).catch(() => avisarError('No se pudo enviar el pedido. Revisá la conexión.'))}>
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

/** Pedidos para unirse (el dueño los acepta) y miembros con sus permisos (el dueño los da con un toque). */
export function Miembros({
  lista,
  uid,
}: {
  lista: Lista
  uid: string
}) {
  const dueno = esDueno(lista, uid)
  const etiquetas = etiquetasPermiso(lista)
  const claves = Object.keys(etiquetas) as (keyof Permisos)[]
  const miembros = Object.entries(lista.miembros ?? {}).sort(
    ([a], [b]) => Number(b === lista.duenoUid) - Number(a === lista.duenoUid),
  )
  const pedidos = Object.entries(lista.pendientes ?? {})
  return (
    <>
      {dueno && pedidos.length > 0 && (
        <>
          <p className="nota">Quieren unirse:</p>
          <ul className="lista">
            {pedidos.map(([u, nombre]) => (
              <li key={u} className="item-ajuste">
                <span>{nombre}</span>
                <button
                  className="enlace"
                  onClick={() => accion(aprobar(lista, u), `${nombre} se unió. Dale más permisos abajo si hace falta`)}
                >
                  Aceptar
                </button>
                <button className="enlace peligro" onClick={() => accion(rechazar(lista, u))}>
                  Rechazar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>Miembros</h3>
      <ul className="lista">
        {miembros.map(([u, nombre]) => {
          const p = permisosDe(lista, u)
          const esElDueno = u === lista.duenoUid
          return (
            <li key={u} className="miembro">
              <div className="item-ajuste">
                <span>
                  {nombre}
                  {esElDueno && <small> (dueño)</small>}
                  {u === uid && <small> (vos)</small>}
                  {!esElDueno && !dueno && (
                    <small className="permisos-texto">
                      {' '}
                      puede{' '}
                      {claves
                        .filter((k) => p[k])
                        .map((k) => etiquetas[k].toLowerCase())
                        .join(', ') || 'solo ver'}
                    </small>
                  )}
                </span>
                {dueno && !esElDueno && !lista.cerrada && (
                  <div className="permisos" role="group" aria-label={`Permisos de ${nombre}`}>
                    {claves.map((k) => (
                      <button key={k} className="chip" aria-pressed={p[k]} onClick={() => accion(cambiarPermiso(lista, u, k, !p[k]))}>
                        {p[k] ? '✓ ' : ''}
                        {etiquetas[k]}
                      </button>
                    ))}
                  </div>
                )}
                {dueno && u !== uid && !lista.cerrada && (
                  <button
                    className="enlace peligro"
                    onClick={async () =>
                      (await confirmar({ titulo: `¿Sacar a ${nombre}?`, texto: 'Deja de ver la lista. Puede volver a pedir unirse con el link.', boton: 'Sacar', peligro: true })) &&
                      accion(sacarMiembro(lista, u))
                    }
                  >
                    Sacar
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** Pie de los menús de listas y secciones: con qué cuenta entraste, cerrar sesión y Listo. */
export function PieMenu({ email, onCerrar }: { email: string | null | undefined; onCerrar: () => void }) {
  return (
    <div className="menu-seccion menu-pie">
      <span className="nota">{email}</span>
      <button className="enlace" onClick={() => cerrarSesionGoogle().then(onCerrar)}>
        Cerrar sesión
      </button>
      <button className="primario" onClick={onCerrar}>
        Listo
      </button>
    </div>
  )
}
