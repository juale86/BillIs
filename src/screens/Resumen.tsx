import { useMemo, type ReactNode } from 'react'
import type { Moneda } from '../db/types'
import { resumenMes } from '../lib/calculos'
import type { Datos } from '../lib/datos'
import { fmt } from '../lib/money'
import { Saldos } from './Saldos'
import { SelectorMes } from './SelectorMes'

interface Props {
  datos: Datos
  mes: number
  setMes: (m: number) => void
  /** Botón de alertas al lado del mes y su panel. */
  acciones?: ReactNode
  panel?: ReactNode
  onAviso: (t: string) => void
}

export function Resumen({ datos, mes, setMes, acciones, panel, onAviso }: Props) {
  const { movimientos, categorias } = datos
  const monedas = useMemo(() => {
    const usadas = new Set<Moneda>(movimientos.map((m) => m.moneda))
    usadas.add('ARS')
    return [...usadas]
  }, [movimientos])

  return (
    <section className="pantalla">
      <SelectorMes mes={mes} setMes={setMes} extra={acciones} />
      {panel}
      {monedas.map((moneda) => {
        const r = resumenMes(movimientos, mes, moneda)
        const balance = r.ingresos - r.gastos
        const cats = [...r.porCategoria.entries()].sort((a, b) => b[1] - a[1])
        const max = cats[0]?.[1] ?? 1
        return (
          <div key={moneda} className="tarjeta">
            {monedas.length > 1 && <h3>{moneda}</h3>}
            <div className="kpis">
              <div>
                <span>Ingresos</span>
                <strong className="ingreso">{fmt(r.ingresos, moneda)}</strong>
              </div>
              <div>
                <span>Gastos</span>
                <strong className="gasto">{fmt(r.gastos, moneda)}</strong>
              </div>
              <div>
                <span>Balance</span>
                <strong className={balance < 0 ? 'gasto' : 'ingreso'}>{fmt(balance, moneda)}</strong>
              </div>
            </div>
            {cats.length > 0 && (
              <ul className="barras">
                {cats.map(([id, monto]) => (
                  <li key={id || 'sin'}>
                    <span className="barra-nombre">{categorias.find((c) => c.id === id)?.nombre ?? 'Sin categoría'}</span>
                    <span className="barra">
                      <span style={{ width: `${(monto / max) * 100}%` }} />
                    </span>
                    <span className="barra-monto">{fmt(monto, moneda)}</span>
                  </li>
                ))}
              </ul>
            )}
            {r.cuotasPendientes > 0 && (
              <p className="nota">Cuotas pendientes después de este mes: {fmt(r.cuotasPendientes, moneda)}</p>
            )}
            <p className="nota">Los gastos cuentan solo tu parte; las cuotas se reparten por mes.</p>
          </div>
        )
      })}
      <Saldos datos={datos} onAviso={onAviso} />
    </section>
  )
}
