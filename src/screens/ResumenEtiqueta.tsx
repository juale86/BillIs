import { useMemo } from 'react'
import { setAjuste } from '../db/db'
import type { Moneda } from '../db/types'
import { IconoPin } from '../components/IconoPin'
import { resumenMes } from '../lib/calculos'
import { convertir } from '../lib/conversor'
import type { Datos } from '../lib/datos'
import { CLAVE_FIJA, mismaEtiqueta, tieneEtiqueta } from '../lib/etiquetas'
import { fmt } from '../lib/money'
import { fmtFecha } from '../lib/fecha'
import { Saldos } from './Saldos'


/**
 * Resumen de una etiqueta (ej. un viaje): todo lo que la lleva, sin importar el mes. Los gastos son tu parte
 * con las cuotas completas; con varias monedas, el total se suma en pesos con las cotizaciones de Ajustes.
 */
export function ResumenEtiqueta({ datos, etiqueta }: { datos: Datos; etiqueta: string }) {
  const { categorias, cotizaciones, etiquetaFija } = datos
  const movs = useMemo(() => datos.movimientos.filter((m) => tieneEtiqueta(m, etiqueta)), [datos.movimientos, etiqueta])
  const monedas = useMemo(() => {
    const usadas = new Set<Moneda>(movs.flatMap((m) => (m.cambio ? [m.moneda, m.cambio.moneda] : [m.moneda])))
    return [...usadas].sort((a, b) => Number(b === 'ARS') - Number(a === 'ARS'))
  }, [movs])
  const fija = !!etiquetaFija && mismaEtiqueta(etiquetaFija, etiqueta)
  const fechas = movs.map((m) => m.fecha)
  const desde = fmtFecha(Math.min(...fechas))
  const hasta = fmtFecha(Math.max(...fechas))
  const porMoneda = monedas.map((moneda) => ({ moneda, r: resumenMes(movs, null, moneda) }))
  // Todo en pesos: null si falta alguna cotización.
  const enPesos = porMoneda.reduce<number | null>((t, { moneda, r }) => {
    const c = convertir(r.gastos, moneda, 'ARS', cotizaciones)
    return t === null || c === null ? null : t + c
  }, 0)

  return (
    <>
      <div className="tarjeta">
        <div className="etiqueta-cab">
          <h3 className="crece">{etiqueta}</h3>
          <button
            className="icono chico-icono fijar"
            aria-label={fija ? `Dejar de fijar ${etiqueta}` : `Fijar ${etiqueta} en cada gasto nuevo`}
            aria-pressed={fija}
            onClick={() => setAjuste(CLAVE_FIJA, fija ? null : etiqueta)}
          >
            <IconoPin />
          </button>
        </div>
        {movs.length === 0 ? (
          <p className="nota">Todavía no hay movimientos con esta etiqueta.</p>
        ) : (
          <p className="nota">
            {movs.length} {movs.length === 1 ? 'movimiento' : 'movimientos'}
            {desde === hasta ? `, el ${desde}` : `, del ${desde} al ${hasta}`}
            {fija && '. Se pone sola en cada gasto nuevo'}
          </p>
        )}
        {monedas.length > 1 && enPesos !== null && (
          <p className="total-etiqueta">
            Gastaste <strong className="gasto">{fmt(Math.round(enPesos))}</strong> <small>en pesos, con tus cotizaciones</small>
          </p>
        )}
      </div>
      {porMoneda.map(({ moneda, r }) => {
        const cats = [...r.porCategoria].sort((a, b) => b[1] - a[1])
        const max = Math.max(1, ...cats.map(([, c]) => c))
        return (
          <div key={moneda} className="tarjeta">
            {monedas.length > 1 && <h3>{moneda}</h3>}
            <div className="kpis">
              <div>
                <span>Gastos</span>
                <strong className="gasto">{fmt(r.gastos, moneda)}</strong>
              </div>
              {r.ingresos > 0 && (
                <div>
                  <span>Ingresos</span>
                  <strong className="ingreso">{fmt(r.ingresos, moneda)}</strong>
                </div>
              )}
              {r.cambios !== 0 && (
                <div>
                  <span>Cambios</span>
                  <strong>{fmt(r.cambios, moneda)}</strong>
                </div>
              )}
            </div>
            {cats.length > 0 && (
              <ul className="barras">
                {cats.map(([id, monto]) => (
                  <li key={id || 'sin'} className="barra-fila">
                    <span className="barra-nombre">{categorias.find((c) => c.id === id)?.nombre ?? 'Sin categoría'}</span>
                    <span className="barra">
                      <span style={{ width: `${(monto / max) * 100}%` }} />
                    </span>
                    <span className="barra-monto">{fmt(monto, moneda)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
      <p className="nota">Los gastos cuentan solo tu parte y las cuotas enteras. También cuentan en el resumen de cada mes.</p>
      <Saldos datos={{ ...datos, movimientos: movs }} etiqueta={etiqueta} />
    </>
  )
}
