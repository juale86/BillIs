import { db, nuevoBase, normalizar } from '../db/db'
import type { Moneda, Persona } from '../db/types'
import { saldos } from '../lib/calculos'
import type { Datos } from '../lib/datos'
import { fmt, montoAInput, parseMonto } from '../lib/money'

/** Cuenta corriente con cada persona (no depende del mes), con botón para saldar. */
export function Saldos({ datos, onAviso }: { datos: Datos; onAviso: (t: string) => void }) {
  const { movimientos, personas, yo } = datos
  if (!yo) return null
  const tabla = saldos(movimientos, yo.id)
  const filas = [...tabla.entries()]
    .flatMap(([pid, porMoneda]) =>
      [...porMoneda.entries()]
        .filter(([, v]) => v !== 0)
        .map(([moneda, v]) => ({ persona: personas.find((p) => p.id === pid), moneda, v })),
    )
    .filter((f): f is { persona: Persona; moneda: Moneda; v: number } => !!f.persona)
    .sort((a, b) => normalizar(a.persona.nombre).localeCompare(normalizar(b.persona.nombre)))

  async function saldar(persona: Persona, moneda: Moneda, v: number) {
    const texto = prompt(
      v > 0 ? `¿Cuánto te pagó ${persona.nombre}?` : `¿Cuánto le pagaste a ${persona.nombre}?`,
      montoAInput(Math.abs(v)),
    )
    if (texto === null) return
    const monto = parseMonto(texto)
    if (!monto || monto <= 0) return
    // v > 0: la persona te paga a vos; v < 0: vos le pagás.
    await db.movimientos.add({
      ...nuevoBase(),
      tipo: 'pagoDeuda',
      descripcion: 'Pago de deuda',
      descripcionNorm: 'pago de deuda',
      cantidad: 1,
      precioUnitCent: monto,
      totalCent: monto,
      moneda,
      fecha: Date.now(),
      pagadorId: v > 0 ? persona.id : yo!.id,
      contraparteId: v > 0 ? yo!.id : persona.id,
    })
    onAviso(`Pago registrado: ${fmt(monto, moneda)}`)
  }

  // Dentro de Resumen: si estás al día con todos, la sección no aparece.
  if (filas.length === 0) return null
  return (
    <section className="seccion-saldos">
      <h3>Saldos con personas</h3>
      <ul className="lista">
        {filas.map(({ persona, moneda, v }) => (
          <li key={persona.id + moneda} className="saldo">
            <span>
              <strong>{persona.nombre}</strong>
              <small>{v > 0 ? 'te debe' : 'le debés'}</small>
            </span>
            <span className={v > 0 ? 'ingreso' : 'gasto'}>{fmt(Math.abs(v), moneda)}</span>
            <button className="secundario" onClick={() => saldar(persona, moneda, v)}>
              Saldar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
