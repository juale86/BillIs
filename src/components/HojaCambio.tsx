import { useState } from 'react'
import { db, normalizar, nuevoBase } from '../db/db'
import { NOMBRE_MONEDA, type Moneda, type Movimiento } from '../db/types'
import { avisar } from '../lib/avisos'
import { convertir } from '../lib/conversor'
import type { Datos } from '../lib/datos'
import { aInputFecha, desdeInput } from '../lib/fecha'
import { CampoFecha } from './CampoFecha'
import { conMiles, fmt, montoAInput, parseMonto, simbolo } from '../lib/money'
import { BotonCerrar } from './BotonCerrar'

interface Props {
  datos: Datos
  /** El cambio que se corrige; sin él, uno nuevo. */
  editando?: Movimiento
  onBorrar: (m: Movimiento) => void
  onCerrar: () => void
}

/**
 * Cambio de moneda: vendiste o compraste dólares (o reales) por pesos. No es gasto ni ingreso: en Resumen
 * pasa plata de una moneda a la otra (el balance en dólares baja y el de pesos sube), así no se cuenta dos veces.
 */
export function HojaCambio({ datos, editando, onBorrar, onCerrar }: Props) {
  // La otra moneda (no el peso) y si la vendiste o la compraste.
  const extranjeras: Moneda[] = datos.monedas.filter((m) => m !== 'ARS')
  const [ext, setExt] = useState<Moneda>(() => {
    if (editando) return editando.moneda !== 'ARS' ? editando.moneda : (editando.cambio?.moneda ?? 'USD')
    return extranjeras[0] ?? 'USD'
  })
  const opcionesExt = extranjeras.includes(ext) ? extranjeras : [...extranjeras, ext]
  const [vendi, setVendi] = useState(editando ? editando.moneda !== 'ARS' : true)
  const sale: Moneda = vendi ? ext : 'ARS'
  const entra: Moneda = vendi ? 'ARS' : ext
  const nombreExt = NOMBRE_MONEDA[ext].toLowerCase()
  const [montoSale, setMontoSale] = useState(editando ? conMiles(montoAInput(editando.totalCent)) : '')
  const [montoEntra, setMontoEntra] = useState(editando?.cambio ? conMiles(montoAInput(editando.cambio.totalCent)) : '')
  // Mientras no se escribe lo recibido, se propone con la cotización de Ajustes.
  const [entraTocado, setEntraTocado] = useState(!!editando)
  const [fecha, setFecha] = useState(() => editando?.fecha ?? Date.now())
  const [lugar, setLugar] = useState(editando?.lugar ?? '')
  const [error, setError] = useState('')

  const cSale = parseMonto(montoSale)
  const propuesto = cSale ? convertir(cSale, sale, entra, datos.cotizaciones) : null
  const cEntra = entraTocado ? parseMonto(montoEntra) : propuesto && Math.round(propuesto)
  // La cotización que resulta, siempre como "1 US$ = $ X" (o "1 R$ = $ X").
  const cExt = vendi ? cSale : cEntra
  const ars = vendi ? cEntra : cSale
  const cotizacion = cExt && ars ? Math.round((ars / cExt) * 100) : null

  async function guardar() {
    if (!cSale || cSale <= 0) return setError('¿Cuánto cambiaste?')
    if (!cEntra || cEntra <= 0) return setError('¿Cuánto recibiste?')
    const descripcion = `${vendi ? 'Venta' : 'Compra'} de ${nombreExt}`
    const base = editando ? { ...editando, modificadoEn: Date.now() } : nuevoBase()
    await db.movimientos.put({
      ...base,
      tipo: 'cambio',
      descripcion,
      descripcionNorm: normalizar(descripcion),
      cantidad: 1,
      precioUnitCent: cSale,
      totalCent: cSale,
      moneda: sale,
      cambio: { moneda: entra, totalCent: cEntra },
      fecha,
      lugar: lugar.trim() || undefined,
    })
    avisar(`${descripcion}: ${fmt(cSale, sale)} → ${fmt(cEntra, entra)}`)
    onCerrar()
  }

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div className="hoja" role="dialog" aria-label="Cambio de moneda" onClick={(e) => e.stopPropagation()}>
        <div className="menu-seccion">
          <div className="hoja-cab">
            <h3>Cambio de moneda</h3>
            <BotonCerrar onClick={onCerrar} />
          </div>
          <div className="segmentos" role="group" aria-label="Qué hiciste">
            {[true, false].map((v) => (
              <button type="button" key={String(v)} aria-pressed={vendi === v} onClick={() => setVendi(v)}>
                {v ? 'Vendí' : 'Compré'} {opcionesExt.length === 1 && nombreExt}
              </button>
            ))}
          </div>
          {opcionesExt.length > 1 && (
            <div className="segmentos" role="group" aria-label="Qué moneda">
              {opcionesExt.map((m) => (
                <button type="button" key={m} aria-pressed={ext === m} onClick={() => setExt(m)}>
                  {NOMBRE_MONEDA[m]}
                </button>
              ))}
            </div>
          )}
          <div className="cambio-fila">
            <span>{vendi ? 'Vendí' : 'Pagué'}</span>
            <label className="campo crece">
              <input
                value={montoSale}
                inputMode="decimal"
                placeholder="0"
                aria-label={`Monto en ${sale}`}
                onChange={(e) => {
                  setMontoSale(conMiles(e.target.value))
                  setError('')
                }}
              />
            </label>
            <span className="cambio-moneda">{simbolo(sale)}</span>
          </div>
          <div className="cambio-fila">
            <span>Recibí</span>
            <label className="campo crece">
              <input
                value={entraTocado ? montoEntra : cEntra ? conMiles(montoAInput(cEntra)) : ''}
                inputMode="decimal"
                placeholder="0"
                aria-label={`Monto en ${entra}`}
                onChange={(e) => {
                  setMontoEntra(conMiles(e.target.value))
                  setEntraTocado(true)
                  setError('')
                }}
              />
            </label>
            <span className="cambio-moneda">{simbolo(entra)}</span>
          </div>
          {cotizacion && (
            <p className="calculo">
              1 {simbolo(ext)} = {fmt(cotizacion)}
            </p>
          )}
          <div className="fila">
            <label className="campo crece">
              <input value={lugar} placeholder="Dónde, ej. banco o cueva" aria-label="Dónde" onChange={(e) => setLugar(e.target.value)} />
            </label>
            <label className="campo">
              <CampoFecha
                tipo="datetime-local"
                etiqueta="Fecha"
                valor={aInputFecha(fecha)}
                onCambio={(v) => {
                  const d = desdeInput(v)
                  if (d) setFecha(d.getTime())
                }}
              />
            </label>
          </div>
          <p className="nota">No cuenta como gasto ni ingreso: en Resumen pasa la plata de una moneda a la otra.</p>
          {error && <p className="error">{error}</p>}
        </div>
        <div className="acciones">
          {editando && (
            <button
              type="button"
              className="secundario boton-peligro"
              onClick={() => {
                onBorrar(editando)
                onCerrar()
              }}
            >
              Borrar
            </button>
          )}
          <button type="button" className="primario" onClick={guardar}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
