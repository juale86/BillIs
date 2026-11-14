import { Fragment, type ReactNode } from 'react'
import { permisosDe, type Lista, type Subseccion } from '../../lib/listaCompras'
import { fmtVence, hoyISO, porVence, type Tarea } from '../../lib/tareas'

/** Las tareas pendientes de una sección, por subsección. */
export function Bloque(props: {
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

export function FilaTarea(props: { t: Tarea; uid: string; puedeTildar: boolean; extra?: string; onTildar: () => void; onAbrir: () => void }) {
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
