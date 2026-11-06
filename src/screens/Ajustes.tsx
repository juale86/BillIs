import { useRef, useState } from 'react'
import { db, nuevoBase, setAjuste } from '../db/db'
import type { Categoria, MetodoPago } from '../db/types'
import type { Datos } from '../lib/datos'
import { exportarCSV, exportarJSON, importarJSON } from '../lib/respaldo'
import { guardarTema, leerTema, type Tema } from '../lib/tema'

type Tabla = 'metodosPago' | 'categorias'

export function Ajustes({ datos, onAviso }: { datos: Datos; onAviso: (t: string) => void }) {
  const { yo, metodos, categorias, multimoneda } = datos
  const refArchivo = useRef<HTMLInputElement>(null)
  const [tema, setTema] = useState<Tema>(leerTema)

  async function renombrar(tabla: Tabla, item: MetodoPago | Categoria) {
    const nombre = prompt('Nuevo nombre', item.nombre)?.trim()
    if (!nombre || nombre === item.nombre) return
    await db.table(tabla).update(item.id, { nombre, modificadoEn: Date.now() })
  }

  async function borrar(tabla: Tabla, item: MetodoPago | Categoria) {
    if (!confirm(`¿Borrar "${item.nombre}"? Los movimientos que lo usan lo conservan.`)) return
    const ahora = Date.now()
    await db.table(tabla).update(item.id, { borradoEn: ahora, modificadoEn: ahora })
  }

  async function agregar(tabla: Tabla, tipo?: 'gasto' | 'ingreso') {
    const nombre = prompt('Nombre')?.trim()
    if (!nombre) return
    await db.table(tabla).add(tipo ? { ...nuevoBase(), nombre, tipo } : { ...nuevoBase(), nombre })
  }

  async function importar(f: File) {
    if (!confirm('Esto reemplaza TODOS los datos actuales por los del archivo. ¿Seguir?')) return
    try {
      await importarJSON(f)
      onAviso('Respaldo restaurado')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo importar')
    }
  }

  const lista = (titulo: string, tabla: Tabla, items: (MetodoPago | Categoria)[], tipo?: 'gasto' | 'ingreso') => (
    <div className="tarjeta">
      <h3>{titulo}</h3>
      <ul className="lista">
        {items.map((it) => (
          <li key={it.id} className="item-ajuste">
            <span>{it.nombre}</span>
            <button className="enlace" onClick={() => renombrar(tabla, it)}>
              Renombrar
            </button>
            <button className="enlace peligro" onClick={() => borrar(tabla, it)}>
              Borrar
            </button>
          </li>
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
              const nombre = prompt('Tu nombre', yo?.nombre)?.trim()
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

      {lista('Métodos de pago', 'metodosPago', metodos)}
      {lista('Categorías de gasto', 'categorias', categorias.filter((c) => c.tipo === 'gasto'), 'gasto')}
      {lista('Categorías de ingreso', 'categorias', categorias.filter((c) => c.tipo === 'ingreso'), 'ingreso')}

      <div className="tarjeta">
        <h3>Respaldo</h3>
        <p className="nota">
          Los datos viven solo en este teléfono. Exportá un respaldo y guardalo en Drive o donde quieras.
        </p>
        <div className="botones">
          <button className="primario" onClick={() => exportarJSON().then(() => onAviso('Respaldo exportado'))}>
            Exportar respaldo
          </button>
          <button className="secundario" onClick={() => exportarCSV()}>
            Exportar CSV
          </button>
          <button className="secundario" onClick={() => refArchivo.current?.click()}>
            Importar respaldo
          </button>
        </div>
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
    </section>
  )
}
