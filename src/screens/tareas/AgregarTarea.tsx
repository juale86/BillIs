import { useRef, useState } from 'react'
import { avisarError } from '../../lib/avisos'
import { pedirTexto } from '../../lib/dialogos'
import { esDueno, permisosDe, type Lista } from '../../lib/listaCompras'
import { agregarTarea, guardarSubsecciones, nuevoIdSubseccion } from '../../lib/tareas'

/** Campo para agregar: al escribir aparecen sección (en Todo), subsección, responsable y fecha límite. */
export function AgregarTarea(props: { secciones: Lista[]; actual: Lista | null; uid: string; yo: string }) {
  const { secciones, actual, uid, yo } = props
  const posibles = secciones.filter((l) => permisosDe(l, uid).agregar)
  const [texto, setTexto] = useState('')
  const [destinoId, setDestinoId] = useState<string | null>(null)
  const [subseccion, setSubseccion] = useState<string | null>(null)
  const [responsableUid, setResponsableUid] = useState<string | null>(null)
  const [vence, setVence] = useState('')
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

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
    ).catch(() => avisarError('No se pudo guardar la tarea'))
    // La subsección queda (para cargar varias seguidas); la fecha y el responsable, no.
    setTexto('')
    setVence('')
    setResponsableUid(null)
    ref.current?.focus()
  }

  // Con los detalles plegados, el botón muestra un punto si hay alguno elegido.
  const conDetalles = !!sub || !!vence || !!responsableUid

  async function nuevaSub() {
    const nombre = await pedirTexto({
      titulo: `Nueva subsección en ${destino!.nombre}`,
      texto: 'Por ejemplo Qué hacer allá, Cosas para buscar o Comprar antes.',
      boton: 'Crear',
    })
    if (!nombre) return
    const s = { id: nuevoIdSubseccion(), nombre: nombre.slice(0, 40) }
    guardarSubsecciones(destino!, [...subs, s]).catch(() => avisarError('No se pudo crear la subsección'))
    setSubseccion(s.id)
    ref.current?.focus()
  }

  return (
    <form
      className="agregar-item agregar-tarea"
      onSubmit={(e) => {
        e.preventDefault()
        agregar()
      }}
    >
      {/* Subsección, responsable y fecha límite van plegados en el botón de la derecha. */}
      <div className="entrada-tarea">
        <div className="campo crece">
          <input
            ref={ref}
            value={texto}
            placeholder={actual ? `Nueva tarea en ${actual.nombre}` : 'Nueva tarea'}
            aria-label="Nueva tarea"
            autoComplete="off"
            enterKeyHint="done"
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={'icono borde detalles-tarea' + (conDetalles && !abierto ? ' con-detalles' : '')}
          aria-expanded={abierto}
          aria-label={abierto ? 'Ocultar subsección y fecha límite' : 'Elegir subsección y fecha límite'}
          onClick={() => setAbierto(!abierto)}
        >
          <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {abierto && (
        <div className="agregar-detalle">
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
                  onChange={(e) => (e.target.value === '+' ? nuevaSub() : setSubseccion(e.target.value || null))}
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
    </form>
  )
}
