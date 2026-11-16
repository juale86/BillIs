import { useMemo, type ReactNode } from 'react'
import type { Moneda } from '../db/types'
import { claveMes, parteDe, resumenMes } from '../lib/calculos'
import type { Datos } from '../lib/datos'
import { setAjuste } from '../db/db'
import { avisar } from '../lib/avisos'
import { pedirTexto } from '../lib/dialogos'
import { fmt, montoAInput, parseMonto } from '../lib/money'
import { Saldos } from './Saldos'
import { SelectorMes } from './SelectorMes'

interface Props {
  datos: Datos
  mes: number
  setMes: (m: number) => void
  /** Botón de alertas al lado del mes y su panel. */
  acciones?: ReactNode
  panel?: ReactNode
}

export function Resumen({ datos, mes, setMes, acciones, panel }: Props) {
  const { movimientos, categorias, presupuestos } = datos
  const fechaAnterior = new Date(Math.floor((mes - 1) / 12), (mes - 1) % 12, 1)
  const mesAnterior = fechaAnterior.toLocaleDateString('es-AR', { month: 'long' })
  // En las categorías, abreviado ("oct."), para que entre en el renglón.
  const mesCorto = fechaAnterior.toLocaleDateString('es-AR', { month: 'short' })
  const monedas = useMemo(() => {
    const usadas = new Set<Moneda>(movimientos.flatMap((m) => (m.cambio ? [m.moneda, m.cambio.moneda] : [m.moneda])))
    usadas.add('ARS')
    // Pesos primero.
    return [...usadas].sort((a, b) => Number(b === 'ARS') - Number(a === 'ARS'))
  }, [movimientos])

  /** Pide el presupuesto mensual de una categoría; vacío lo quita. */
  async function presupuesto(id: string, nombre: string) {
    const actual = presupuestos[id]
    const texto = await pedirTexto({
      titulo: `Presupuesto mensual de ${nombre}`,
      texto: 'Cuánto querés gastar por mes como máximo. Dejalo vacío para quitarlo.',
      valor: actual ? montoAInput(actual) : '',
      inputMode: 'decimal',
      boton: 'Guardar',
      vacioOk: true,
    })
    if (texto === null) return
    const cent = parseMonto(texto)
    const nuevos = { ...presupuestos }
    if (cent && cent > 0) nuevos[id] = cent
    else delete nuevos[id]
    await setAjuste('presupuestos', nuevos)
    avisar(cent && cent > 0 ? `Presupuesto de ${nombre}: ${fmt(cent)} por mes` : `Sin presupuesto para ${nombre}`)
  }

  return (
    <section className="pantalla">
      <SelectorMes mes={mes} setMes={setMes} extra={acciones} />
      {panel}
      {monedas.map((moneda) => {
        const r = resumenMes(movimientos, mes, moneda)
        const ant = resumenMes(movimientos, mes - 1, moneda)
        // Los cambios de moneda pasan plata de una moneda a la otra: entran al balance, no a gastos ni ingresos.
        const balance = r.ingresos - r.gastos + r.cambios
        // Presupuestos (solo en pesos): también se ven las categorías con tope que todavía no tienen gastos.
        const topes = moneda === 'ARS' ? presupuestos : {}
        const ids = new Set<string>([...r.porCategoria.keys(), ...Object.keys(topes).filter((id) => categorias.some((c) => c.id === id))])
        const cats = [...ids].map((id) => [id, r.porCategoria.get(id) ?? 0] as const).sort((a, b) => b[1] - a[1])
        const max = Math.max(1, ...cats.map(([, monto]) => monto))
        // Facturas de este mes que todavía no se pagaron (ya cuentan en Gastos).
        const porPagar = movimientos
          .filter((m) => m.porPagar && m.moneda === moneda && claveMes(m.fecha) === mes)
          .reduce((t, m) => t + parteDe(m), 0)
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
                <Variacion actual={r.gastos} antes={ant.gastos} mes={mesAnterior} />
              </div>
              <div>
                <span>Balance</span>
                <strong className={balance < 0 ? 'gasto' : 'ingreso'}>{fmt(balance, moneda)}</strong>
              </div>
            </div>
            {r.cambios !== 0 && (
              <p className="nota">
                Cambio de moneda: {r.cambios > 0 ? '+' : '−'}
                {fmt(Math.abs(r.cambios), moneda)} (ya está en el balance)
              </p>
            )}
            {cats.length > 0 && (
              <ul className="barras">
                {cats.map(([id, monto]) => {
                  const cat = categorias.find((c) => c.id === id)
                  const tope = topes[id]
                  const pasado = !!tope && monto > tope
                  const contenido = (
                    <>
                      <span className="barra-nombre">{cat?.nombre ?? 'Sin categoría'}</span>
                      <span className="barra">
                        <span
                          className={pasado ? 'pasado' : undefined}
                          style={{ width: `${Math.min(100, (monto / (tope || max)) * 100)}%` }}
                        />
                      </span>
                      <span className="barra-monto">{fmt(monto, moneda)}</span>
                      {(tope || ant.porCategoria.get(id)) && (
                        <span className="barra-det">
                          {tope ? (
                            <span className={pasado ? 'gasto' : undefined}>
                              {pasado ? `te pasaste ${fmt(monto - tope, moneda)} de ` : 'de '}
                              {fmt(tope, moneda)}
                            </span>
                          ) : null}
                          <Variacion actual={monto} antes={ant.porCategoria.get(id) ?? 0} mes={mesCorto} />
                        </span>
                      )}
                    </>
                  )
                  return (
                    <li key={id || 'sin'}>
                      {moneda === 'ARS' && cat ? (
                        <button className="barra-fila" aria-label={`Presupuesto de ${cat.nombre}`} onClick={() => presupuesto(cat.id, cat.nombre)}>
                          {contenido}
                        </button>
                      ) : (
                        <div className="barra-fila">{contenido}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {porPagar > 0 && <p className="nota">Facturas por pagar este mes: {fmt(porPagar, moneda)}</p>}
            {r.cuotasPendientes > 0 && (
              <p className="nota">Cuotas pendientes después de este mes: {fmt(r.cuotasPendientes, moneda)}</p>
            )}
            <p className="nota">
              Los gastos cuentan solo tu parte; las cuotas se reparten por mes.
              {moneda === 'ARS' && cats.length > 0 && ' Tocá una categoría para ponerle un presupuesto mensual.'}
            </p>
          </div>
        )
      })}
      <Saldos datos={datos} />
    </section>
  )
}

/** "+12% vs octubre": cuánto cambió contra el mes anterior (nada si el mes anterior fue cero). */
function Variacion({ actual, antes, mes }: { actual: number; antes: number; mes: string }) {
  if (!antes) return null
  const pct = Math.round(((actual - antes) / antes) * 100)
  return (
    <small className={'variacion' + (pct > 0 ? ' sube' : pct < 0 ? ' baja' : '')}>
      {pct > 0 ? '+' : ''}
      {pct}% vs {mes}
    </small>
  )
}
