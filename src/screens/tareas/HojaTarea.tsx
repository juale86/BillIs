import { useState } from 'react'
import { avisar, avisarError } from '../../lib/avisos'
import { BotonCerrar } from '../../components/BotonCerrar'
import { fmtFechaHora } from '../../lib/historial'
import { permisosDe, type Lista } from '../../lib/listaCompras'
import { borrarTarea, editarTarea, restaurarTarea, type DatosTarea, type Tarea } from '../../lib/tareas'

/** Hoja de una tarea: corregirla, elegir responsable, fecha y nota, o borrarla. */
export function HojaTarea(props: { lista: Lista; tarea: Tarea; uid: string; onCerrar: () => void }) {
  const { lista, tarea, uid, onCerrar } = props
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
    editarTarea(lista.id, tarea.id, d).catch(() => avisarError('No se pudo guardar la tarea'))
    onCerrar()
  }

  function borrar() {
    borrarTarea(lista.id, tarea.id).catch(() => avisarError('No se pudo borrar'))
    avisar(`Borraste "${tarea.texto}"`, () => restaurarTarea(lista.id, tarea).catch(() => avisarError('No se pudo recuperar')))
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
