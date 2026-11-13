import { useRef, useState } from 'react'
import { confirmar, pedirTexto } from '../lib/dialogos'
import { avisar, avisarError } from '../lib/avisos'
import { Bandera } from '../components/Bandera'
import { amPm } from '../lib/hora'
import { db, getAjuste, nuevoBase, setAjuste } from '../db/db'
import type { Categoria, MetodoPago } from '../db/types'
import type { Datos } from '../lib/datos'
import { CLAVE_COTIZACIONES, MONEDAS_CONVERSOR, type Cotizaciones, type MonedaConversor } from '../lib/conversor'
import { CLAVE_GRUPOS, nuevoIdGrupo, type Grupo } from '../lib/grupos'
import { exportarCSV, exportarJSON, importarJSON } from '../lib/respaldo'
import { guardarTema, leerTema, type Tema } from '../lib/tema'

type Tabla = 'metodosPago' | 'categorias'

export function Ajustes({ datos, onRespaldo }: { datos: Datos; onRespaldo: () => void }) {
  const { yo, metodos, categorias, multimoneda, grupos } = datos
  const refArchivo = useRef<HTMLInputElement>(null)
  const [tema, setTema] = useState<Tema>(leerTema)

  async function renombrar(tabla: Tabla, item: MetodoPago | Categoria) {
    const nombre = await pedirTexto({ titulo: `Renombrar "${item.nombre}"`, valor: item.nombre, boton: 'Renombrar' })
    if (!nombre || nombre === item.nombre) return
    await db.table(tabla).update(item.id, { nombre, modificadoEn: Date.now() })
    avisar(`Renombraste "${item.nombre}" a "${nombre}"`, () =>
      db.table(tabla).update(item.id, { nombre: item.nombre, modificadoEn: Date.now() }),
    )
  }

  /** Sin confirmar: el aviso ofrece Deshacer. Los movimientos que lo usan lo conservan. */
  async function borrar(tabla: Tabla, item: MetodoPago | Categoria) {
    const ahora = Date.now()
    await db.table(tabla).update(item.id, { borradoEn: ahora, modificadoEn: ahora })
    avisar(`Borraste "${item.nombre}"`, () =>
      db.table(tabla).update(item.id, { borradoEn: null, modificadoEn: Date.now() }),
    )
  }

  // Grupos de la lista: se guardan enteros en un ajuste de este teléfono.
  const guardarGrupos = (gs: Grupo[]) => setAjuste(CLAVE_GRUPOS, gs)

  async function renombrarGrupo(g: Grupo) {
    const nombre = await pedirTexto({ titulo: `Renombrar "${g.nombre}"`, valor: g.nombre, boton: 'Renombrar' })
    if (!nombre || nombre === g.nombre) return
    await guardarGrupos(grupos.map((x) => (x.id === g.id ? { ...x, nombre, corto: nombre } : x)))
    avisar(`Renombraste "${g.nombre}" a "${nombre}"`, () =>
      guardarGrupos(grupos.map((x) => (x.id === g.id ? g : x))),
    )
  }

  async function borrarGrupo(g: Grupo) {
    const i = grupos.findIndex((x) => x.id === g.id)
    await guardarGrupos(grupos.filter((x) => x.id !== g.id))
    // Se repone en su lugar, sobre los grupos que haya en ese momento.
    avisar(`Borraste "${g.nombre}". Sus ítems quedan sin grupo`, async () => {
      const ahora = await getAjuste<Grupo[] | null>(CLAVE_GRUPOS, null)
      const resto = (ahora ?? []).filter((x) => x.id !== g.id)
      await guardarGrupos([...resto.slice(0, i), g, ...resto.slice(i)])
    })
  }

  async function agregarGrupo() {
    const nombre = await pedirTexto({ titulo: 'Nuevo grupo', texto: 'Por ejemplo Verdulería o Limpieza.', boton: 'Agregar' })
    if (!nombre) return
    await guardarGrupos([...grupos, { id: nuevoIdGrupo(), nombre, corto: nombre }])
  }

  async function agregar(tabla: Tabla, tipo?: 'gasto' | 'ingreso') {
    const nombre = await pedirTexto({
      titulo: tabla === 'metodosPago' ? 'Nuevo método de pago' : tipo === 'ingreso' ? 'Nueva categoría de ingreso' : 'Nueva categoría de gasto',
      boton: 'Agregar',
    })
    if (!nombre) return
    await db.table(tabla).add(tipo ? { ...nuevoBase(), nombre, tipo } : { ...nuevoBase(), nombre })
  }

  async function importar(f: File) {
    const ok = await confirmar({
      titulo: '¿Restaurar este respaldo?',
      texto: 'Reemplaza todos los datos de este teléfono por los del archivo.',
      boton: 'Restaurar',
      peligro: true,
    })
    if (!ok) return
    try {
      await importarJSON(f)
      avisar('Respaldo restaurado')
      onRespaldo()
    } catch (e) {
      avisarError(e instanceof Error ? e.message : 'No se pudo importar')
    }
  }

  const lista = (titulo: string, tabla: Tabla, items: (MetodoPago | Categoria)[], tipo?: 'gasto' | 'ingreso') => (
    <div className="tarjeta">
      <h3>{titulo}</h3>
      <ul className="lista">
        {items.map((it) => (
          <FilaEditable key={it.id} nombre={it.nombre} onRenombrar={() => renombrar(tabla, it)} onBorrar={() => borrar(tabla, it)} />
        ))}
      </ul>
      <button className="enlace" onClick={() => agregar(tabla, tipo)}>
        + Agregar
      </button>
    </div>
  )

  return (
    <section className="pantalla">
      <div className="tarjeta">
        <h3>Tu nombre</h3>
        <div className="item-ajuste">
          <span>{yo?.nombre}</span>
          <button
            className="enlace"
            onClick={async () => {
              const nombre = await pedirTexto({ titulo: 'Tu nombre', valor: yo?.nombre ?? '', boton: 'Guardar' })
              if (nombre && yo) await db.personas.update(yo.id, { nombre, modificadoEn: Date.now() })
            }}
          >
            Cambiar
          </button>
        </div>
      </div>

      <div className="tarjeta">
        <h3>Apariencia</h3>
        <div className="segmentos">
          {(['auto', 'claro', 'oscuro'] as Tema[]).map((t) => (
            <button
              key={t}
              aria-pressed={tema === t}
              onClick={() => {
                setTema(t)
                guardarTema(t)
              }}
            >
              {{ auto: 'Automático', claro: 'Claro', oscuro: 'Oscuro' }[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="tarjeta">
        <label className="interruptor">
          <input type="checkbox" checked={multimoneda} onChange={(e) => setAjuste('multimoneda', e.target.checked)} />
          <span>Usar otras monedas (USD)</span>
        </label>
      </div>

      <div className="tarjeta">
        <h3>Cotizaciones</h3>
        <p className="nota">Para el conversor de la calculadora: cuántos dólares vale cada moneda.</p>
        <ul className="lista">
          {MONEDAS_CONVERSOR.filter((m) => m.codigo !== 'USD').map((m) => (
            <FilaCotizacion key={m.codigo} moneda={m} cotizaciones={datos.cotizaciones} />
          ))}
        </ul>
      </div>

      {lista('Métodos de pago', 'metodosPago', metodos)}
      {lista('Categorías de gasto', 'categorias', categorias.filter((c) => c.tipo === 'gasto'), 'gasto')}
      {lista('Categorías de ingreso', 'categorias', categorias.filter((c) => c.tipo === 'ingreso'), 'ingreso')}

      <div className="tarjeta">
        <h3>Grupos de la lista de compras</h3>
        <p className="nota">El orden "Por grupos" de la lista sigue este recorrido del súper.</p>
        <ul className="lista">
          {grupos.map((g) => (
            <FilaEditable key={g.id} nombre={g.nombre} onRenombrar={() => renombrarGrupo(g)} onBorrar={() => borrarGrupo(g)} />
          ))}
        </ul>
        <button className="enlace" onClick={agregarGrupo}>
          + Agregar
        </button>
      </div>

      <div className="tarjeta">
        {/* Una caja abierta: la flecha sale por la boca hacia arriba a la derecha al exportar y entra desde arriba a la izquierda al importar. */}
        <div className="respaldo-cab">
          <h3>Respaldo</h3>
          <div className="botones-respaldo">
            <button
              className="icono borde respaldo"
              aria-label="Exportar respaldo"
              title="Exportar respaldo"
              onClick={() =>
                exportarJSON().then(() => {
                  avisar('Respaldo exportado')
                  onRespaldo()
                })
              }
            >
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11.5l9-3.5 9 3.5-9 3.5z" />
              <path d="M3 11.5v7l9 3.5 9-3.5v-7M12 15v7" />
              <path d="M3 11.5L1 14.5l9 3.5 2-3M21 11.5l2 3-9 3.5-2-3" />
                <path d="M12 12.5L18.5 2.5" className="halo" />
                <path d="M12 12.5L18.5 2.5M14 2.8l4.5-.3.5 4.4" />
              </svg>
            </button>
            <button className="icono borde respaldo" aria-label="Exportar CSV" title="Exportar CSV" onClick={() => exportarCSV()}>
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H11l4 4v11.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 20.5z" />
                <path d="M11 5v4h4" />
                <text x="4.3" y="18.6" fontSize="5.2" fontWeight="700" fill="currentColor" stroke="none">
                  CSV
                </text>
                <path d="M9.5 12.5L20.5 3" className="halo" />
                <path d="M9.5 12.5L20.5 3M15.5 3h5v5" />
              </svg>
            </button>
            <button className="icono borde respaldo" aria-label="Importar respaldo" title="Importar respaldo" onClick={() => refArchivo.current?.click()}>
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11.5l9-3.5 9 3.5-9 3.5z" />
              <path d="M3 11.5v7l9 3.5 9-3.5v-7M12 15v7" />
              <path d="M3 11.5L1 14.5l9 3.5 2-3M21 11.5l2 3-9 3.5-2-3" />
                <path d="M5.5 2.5L12 12.5" className="halo" />
                <path d="M5.5 2.5L12 12.5M12.3 7.8l-.3 4.7-4.4-1" />
              </svg>
            </button>
          </div>
        </div>
        <p className="nota">
          Los datos viven solo en este teléfono. Exportá un respaldo y guardalo en Drive o donde quieras.
        </p>
        <input
          ref={refArchivo}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importar(f)
            e.target.value = ''
          }}
        />
      </div>

      <p className="nota version">
        BillIs {__APP_VERSION__}, publicada el{' '}
        {amPm(new Date(__APP_FECHA__).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }))}
      </p>
    </section>
  )
}

const fmtCot = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 2 })

/** "[bandera] 1 BRL = [0,18] US$", y debajo la cuenta al revés ("1 US$ = 5,56 BRL"). Se guarda al escribir un número válido. */
function FilaCotizacion({ moneda, cotizaciones }: { moneda: MonedaConversor; cotizaciones: Cotizaciones }) {
  const actual = cotizaciones[moneda.codigo]
  const [texto, setTexto] = useState(() => String(actual).replace('.', ','))
  const valor = Number(texto.trim().replace(',', '.'))
  const valido = texto.trim() !== '' && Number.isFinite(valor) && valor > 0
  return (
    <li className="item-ajuste cotizacion">
      <span>
        <span className="cotizacion-moneda">
          <Bandera codigo={moneda.codigo} /> 1 {moneda.codigo} =
        </span>
        {valido && <small>1 US$ = {fmtCot(1 / valor)} {moneda.codigo}</small>}
      </span>
      <label className="campo">
        <input
          value={texto}
          inputMode="decimal"
          aria-label={`Cuántos dólares vale 1 ${moneda.nombre.toLowerCase()}`}
          aria-invalid={!valido}
          onChange={(e) => {
            const t = e.target.value
            setTexto(t)
            const v = Number(t.trim().replace(',', '.'))
            if (t.trim() && Number.isFinite(v) && v > 0 && v !== actual)
              setAjuste(CLAVE_COTIZACIONES, { ...cotizaciones, [moneda.codigo]: v })
          }}
        />
      </label>
      <span className="cotizacion-usd">US$</span>
    </li>
  )
}

/** Un método, categoría o grupo con Renombrar y Borrar. */
function FilaEditable({ nombre, onRenombrar, onBorrar }: { nombre: string; onRenombrar: () => void; onBorrar: () => void }) {
  return (
    <li className="item-ajuste">
      <span>{nombre}</span>
      <button className="enlace" onClick={onRenombrar}>
        Renombrar
      </button>
      <button className="enlace peligro" onClick={onBorrar}>
        Borrar
      </button>
    </li>
  )
}
