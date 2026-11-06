import { useEffect, useRef, useState } from 'react'
import { FormMovimiento } from './components/FormMovimiento'
import { db, inicializar } from './db/db'
import type { Movimiento } from './db/types'
import { claveMes } from './lib/calculos'
import { useDatos } from './lib/datos'
import { necesitaRespaldo, pedirPersistencia } from './lib/respaldo'
import { Ajustes } from './screens/Ajustes'
import { Movimientos } from './screens/Movimientos'
import { Resumen } from './screens/Resumen'
import { Saldos } from './screens/Saldos'

type Pestana = 'movimientos' | 'resumen' | 'saldos' | 'ajustes'
type Form = { tipo: 'gasto' | 'ingreso'; editando?: Movimiento } | null

interface Aviso {
  texto: string
  deshacer?: () => void
}

/** El ícono abre en "nuevo gasto"; el acceso directo ?nuevo=ingreso abre en ingreso. */
function formInicial(): Form {
  const p = new URLSearchParams(location.search).get('nuevo')
  return { tipo: p === 'ingreso' ? 'ingreso' : 'gasto' }
}

export default function App() {
  const datos = useDatos()
  const [form, setForm] = useState<Form>(formInicial)
  const [pestana, setPestana] = useState<Pestana>('movimientos')
  const [mes, setMes] = useState(() => claveMes(Date.now()))
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [avisoRespaldo, setAvisoRespaldo] = useState(false)
  const timer = useRef<number>(undefined)

  useEffect(() => {
    pedirPersistencia()
    necesitaRespaldo().then(setAvisoRespaldo)
  }, [])

  function mostrarAviso(a: Aviso) {
    clearTimeout(timer.current)
    setAviso(a)
    timer.current = window.setTimeout(() => setAviso(null), a.deshacer ? 6000 : 2500)
  }

  async function borrar(m: Movimiento) {
    const ahora = Date.now()
    await db.movimientos.update(m.id, { borradoEn: ahora, modificadoEn: ahora })
    setForm(null)
    mostrarAviso({
      texto: 'Movimiento borrado',
      deshacer: () => db.movimientos.update(m.id, { borradoEn: null, modificadoEn: Date.now() }),
    })
  }

  if (!datos) return null

  if (!datos.yo) return <Bienvenida />

  return (
    <div className="app">
      {form ? (
        <FormMovimiento
          key={form.editando?.id ?? form.tipo}
          datos={datos}
          tipoInicial={form.tipo}
          editando={form.editando}
          onCerrar={() => {
            setForm(null)
            history.replaceState(null, '', location.pathname)
          }}
          onBorrar={borrar}
          onGuardado={(texto) => mostrarAviso({ texto })}
        />
      ) : (
        <>
          <header className="barra-sup">
            <h1>{{ movimientos: 'Movimientos', resumen: 'Resumen', saldos: 'Saldos', ajustes: 'Ajustes' }[pestana]}</h1>
            <button
              className="icono ajustes"
              aria-label="Ajustes"
              aria-current={pestana === 'ajustes'}
              onClick={() => setPestana(pestana === 'ajustes' ? 'movimientos' : 'ajustes')}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeDasharray="3.14 3.14" />
                <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </button>
          </header>

          {avisoRespaldo && pestana !== 'ajustes' && (
            <div className="banner">
              Hace más de una semana que no hacés un respaldo.
              <button className="enlace" onClick={() => setPestana('ajustes')}>
                Ir a respaldo
              </button>
              <button className="icono" aria-label="Cerrar aviso" onClick={() => setAvisoRespaldo(false)}>
                ✕
              </button>
            </div>
          )}

          <main>
            {pestana === 'movimientos' && (
              <Movimientos
                datos={datos}
                mes={mes}
                setMes={setMes}
                onEditar={(m) => setForm({ tipo: m.tipo === 'ingreso' ? 'ingreso' : 'gasto', editando: m })}
                onBorrar={borrar}
              />
            )}
            {pestana === 'resumen' && <Resumen datos={datos} mes={mes} setMes={setMes} />}
            {pestana === 'saldos' && <Saldos datos={datos} onAviso={(texto) => mostrarAviso({ texto })} />}
            {pestana === 'ajustes' && (
              <Ajustes
                datos={datos}
                onAviso={(texto) => {
                  mostrarAviso({ texto })
                  necesitaRespaldo().then(setAvisoRespaldo)
                }}
              />
            )}
          </main>

          <button className="fab" aria-label="Nuevo gasto" onClick={() => setForm({ tipo: 'gasto' })}>
            +
          </button>

          <nav className="tabs">
            {(['movimientos', 'resumen', 'saldos'] as Pestana[]).map((p) => (
              <button key={p} aria-current={pestana === p} onClick={() => setPestana(p)}>
                {{ movimientos: 'Movimientos', resumen: 'Resumen', saldos: 'Saldos', ajustes: '' }[p]}
              </button>
            ))}
          </nav>
        </>
      )}

      {aviso && (
        <div className="toast" role="status">
          <span>{aviso.texto}</span>
          {aviso.deshacer && (
            <button
              className="enlace"
              onClick={() => {
                aviso.deshacer!()
                setAviso(null)
              }}
            >
              Deshacer
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Bienvenida() {
  const [nombre, setNombre] = useState('')
  return (
    <form
      className="bienvenida"
      onSubmit={(e) => {
        e.preventDefault()
        if (nombre.trim()) inicializar(nombre)
      }}
    >
      <h1>BillIs</h1>
      <p>Anotá gastos e ingresos en segundos. Todo queda en este teléfono.</p>
      <label className="campo">
        <span>¿Cómo te llamás?</span>
        <input value={nombre} autoFocus onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" />
      </label>
      <p className="nota">Va a ser el pagador por defecto de tus gastos.</p>
      <button className="primario" disabled={!nombre.trim()}>
        Empezar
      </button>
    </form>
  )
}
