import type { Correccion } from './FormMovimiento'
import { normalizar } from '../db/db'
import type { GastoCargado, Movimiento } from '../db/types'
import type { Datos } from '../lib/datos'
import { cambios, cargaDe, ETIQUETA_CAMPO, fmtFechaHora, textoCampo, type CampoCarga } from '../lib/historial'

/**
 * Quién lo cargó y cuándo, quién hizo el último cambio y cuándo, y qué cambió desde lo que se cargó primero.
 * Muestra lo guardado, no lo que se está escribiendo (eso aparece debajo de cada campo).
 */
export function HistorialMov({
  editando,
  correccion,
  yo,
  categorias,
}: {
  editando?: Movimiento
  correccion?: Correccion
  yo: string
  categorias: Datos['categorias']
}) {
  const quien = (n: string) => (normalizar(n) === normalizar(yo) ? 'vos' : n)
  let cargo: string
  let cargadoEn: number
  let edicion: { por: string; en: number } | null = null
  let lista: CampoCarga[] = []
  let original: GastoCargado | undefined
  let actual: GastoCargado | undefined
  if (correccion) {
    cargo = correccion.quien
    cargadoEn = correccion.original.cargadoEn
    if (correccion.corregidoPor && correccion.corregidoEn) edicion = { por: correccion.corregidoPor, en: correccion.corregidoEn }
    original = correccion.original
    actual = correccion.actual
  } else {
    const m = editando!
    cargo = yo
    cargadoEn = m.creadoEn
    if (m.historial) {
      edicion = { por: m.historial.editadoPor, en: m.historial.editadoEn }
      original = m.historial.original
      actual = cargaDe(m, categorias)
    }
  }
  if (original && actual) lista = cambios(original, actual)
  const cargoQuien = quien(cargo)
  return (
    <div className="historial">
      <p>
        {cargoQuien === 'vos' ? 'Lo cargaste vos' : `Lo cargó ${cargoQuien}`} el {fmtFechaHora(cargadoEn)}.
      </p>
      {edicion && (
        <p>
          {quien(edicion.por) === 'vos' ? (correccion ? 'Lo corregiste vos' : 'Lo modificaste vos') : `Lo corrigió ${edicion.por}`} el{' '}
          {fmtFechaHora(edicion.en)}
          {lista.length ? ':' : ', sin cambios respecto de lo que se cargó.'}
        </p>
      )}
      {edicion && lista.length > 0 && original && actual && (
        <ul>
          {lista.map((c) => (
            <li key={c}>
              {ETIQUETA_CAMPO[c]}: <s>{textoCampo(c, original)}</s> {textoCampo(c, actual)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
