import { useMemo, useRef, useState } from 'react'
import { Chips } from '../components/Chips'
import { setAjuste } from '../db/db'
import type { Datos } from '../lib/datos'
import {
  agregarItem,
  borrarItem,
  crearLista,
  existeLista,
  extraerListaId,
  filtrar,
  limpiarComprados,
  linkLista,
  marcarComprado,
  sincronizacionDisponible,
  useLista,
  type Filtros,
  type ItemLista,
} from '../lib/listaCompras'
import { sugerirDescripciones } from '../lib/sugerencias'

export interface PrefillGasto {
  descripcion: string
  marca?: string
  cantidad?: number
}

interface Props {
  datos: Datos
  /** Código recibido por link (?lista=...). */
  invitacion: string | null
  onInvitacionUsada: () => void
  onCargarGasto: (p: PrefillGasto) => void
  onAviso: (t: string) => void
}

export default function Lista(props: Props) {
  const { datos, invitacion } = props
  if (!sincronizacionDisponible)
    return (
      <section className="pantalla">
        <p className="vacio">La lista compartida todavía no está conectada a internet.</p>
      </section>
    )
  if (invitacion && invitacion !== datos.listaId) return <Invitacion {...props} codigo={invitacion} />
  if (!datos.listaId) return <SinLista {...props} />
  return <ListaActiva {...props} listaId={datos.listaId} />
}

async function unirse(id: string, onAviso: (t: string) => void): Promise<boolean> {
  try {
    if (!(await existeLista(id))) {
      alert('No existe una lista con ese código. Revisá el link.')
      return false
    }
  } catch {
    alert('No se pudo comprobar la lista. Revisá la conexión e intentá de nuevo.')
    return false
  }
  await setAjuste('listaId', id)
  onAviso('Te uniste a la lista')
  return true
}

function Invitacion({ datos, codigo, onInvitacionUsada, onAviso }: Props & { codigo: string }) {
  return (
    <section className="pantalla">
      <div className="tarjeta">
        <h3>Te invitaron a una lista de compras</h3>
        {datos.listaId && <p className="nota">Vas a dejar la lista en la que estás ahora (sus ítems no se borran).</p>}
        <div className="botones">
          <button className="primario" onClick={async () => (await unirse(codigo, onAviso)) && onInvitacionUsada()}>
            Unirme a la lista
          </button>
          <button className="secundario" onClick={onInvitacionUsada}>
            Ahora no
          </button>
        </div>
      </div>
    </section>
  )
}

function SinLista({ onAviso }: Props) {
  const [codigo, setCodigo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  return (
    <section className="pantalla">
      <div className="tarjeta">
        <h3>Lista de compras compartida</h3>
        <p className="nota">
          Anotá lo que falta antes de ir al súper. Todos los que tengan el link ven y editan la misma lista.
        </p>
        <button
          className="primario"
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true)
            try {
              await setAjuste('listaId', await crearLista('Súper'))
              onAviso('Lista creada')
            } catch {
              alert('No se pudo crear la lista. Revisá la conexión.')
            } finally {
              setOcupado(false)
            }
          }}
        >
          Crear lista
        </button>
      </div>
      <div className="tarjeta">
        <h3>Unirme a una lista</h3>
        <form
          className="fila"
          onSubmit={async (e) => {
            e.preventDefault()
            const id = extraerListaId(codigo)
            if (!id) return alert('Pegá el link que te mandaron.')
            setOcupado(true)
            await unirse(id, onAviso)
            setOcupado(false)
          }}
        >
          <label className="campo crece">
            <span>Link o código</span>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="https://…?lista=…" />
          </label>
          <button className="secundario boton-campo" disabled={ocupado || !codigo.trim()}>
            Unirme
          </button>
        </form>
      </div>
    </section>
  )
}

const SIN_FILTROS: Filtros = { texto: '', estado: null, persona: null }

function ListaActiva({ datos, listaId, onCargarGasto, onAviso }: Props & { listaId: string }) {
  const { nombre, items, cargando, error, pendiente } = useLista(listaId)
  const yo = datos.yo?.nombre ?? 'Yo'

  const [nuevo, setNuevo] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [marca, setMarca] = useState('')
  const [verSug, setVerSug] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)
  const refNuevo = useRef<HTMLInputElement>(null)
  const refBuscar = useRef<HTMLInputElement>(null)

  const sugerencias = useMemo(
    () => (verSug ? sugerirDescripciones(datos.movimientos, 'gasto', nuevo).slice(0, 4) : []),
    [verSug, datos.movimientos, nuevo],
  )
  const visibles = filtrar(items, filtros)
  const pendientes = visibles.filter((i) => !i.comprado).sort((a, b) => a.creadoEn - b.creadoEn)
  const comprados = visibles.filter((i) => i.comprado).sort((a, b) => b.modificadoEn - a.modificadoEn)
  const personas = [...new Set(items.map((i) => i.agregadoPor))].sort()
  const hayFiltros = filtros.texto !== '' || filtros.estado !== null || filtros.persona !== null

  function agregar() {
    if (!nuevo.trim()) return
    agregarItem(listaId, { nombre: nuevo, cantidad, marca }, yo).catch(() => onAviso('No se pudo guardar el ítem'))
    setNuevo('')
    setCantidad('')
    setMarca('')
    refNuevo.current?.focus()
  }

  async function compartir() {
    const url = linkLista(listaId)
    try {
      if (navigator.share) await navigator.share({ title: 'Lista de compras', text: 'Sumate a mi lista de compras en BillIs', url })
      else {
        await navigator.clipboard.writeText(url)
        onAviso('Link copiado')
      }
    } catch {
      /* el usuario canceló */
    }
  }

  function cerrarBusqueda() {
    setBuscando(false)
    setFiltros(SIN_FILTROS)
  }

  const fila = (it: ItemLista) => {
    const det = [it.cantidad, it.marca].filter(Boolean).join(', ')
    const quien = it.comprado ? (it.compradoPor ? `compró ${it.compradoPor}` : '') : `agregó ${it.agregadoPor}`
    return (
      <li key={it.id} className={'item-lista' + (it.comprado ? ' comprado' : '')}>
        <label className="item-check">
          <input
            type="checkbox"
            checked={it.comprado}
            onChange={(e) => marcarComprado(listaId, it, e.target.checked, yo)}
          />
          <span className="mov-texto">
            <span className="mov-desc">{it.nombre}</span>
            <span className="mov-det">{[det, quien].filter(Boolean).join(' — ')}</span>
          </span>
        </label>
        {it.comprado && (
          <button
            className="enlace"
            onClick={() =>
              onCargarGasto({
                descripcion: it.nombre,
                marca: it.marca ?? undefined,
                cantidad: /^\d+$/.test(it.cantidad ?? '') ? Number(it.cantidad) : undefined,
              })
            }
          >
            Cargar gasto
          </button>
        )}
        <button className="icono chico-icono" aria-label={`Quitar ${it.nombre}`} onClick={() => borrarItem(listaId, it)}>
          ✕
        </button>
      </li>
    )
  }

  return (
    <section className="pantalla">
      <div className="lista-cab">
        <strong>{nombre || 'Lista'}</strong>
        <span className="nota">{pendiente ? 'Sin conexión: se sincroniza al volver la señal' : ''}</span>
        <button
          className="icono"
          aria-label="Buscar"
          aria-pressed={buscando}
          onClick={() => {
            if (buscando) return cerrarBusqueda()
            setBuscando(true)
            requestAnimationFrame(() => refBuscar.current?.focus())
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M15 15l6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
          </svg>
        </button>
        <button className="secundario boton-chico" onClick={compartir}>
          Compartir
        </button>
      </div>

      {buscando && (
        <div className="buscador">
          <div className="campo">
            <input
              ref={refBuscar}
              value={filtros.texto}
              placeholder="Buscar en la lista"
              aria-label="Buscar en la lista"
              onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
            />
          </div>
          <Chips
            opciones={[
              ...(filtros.estado ? [] : ['Pendientes', 'Comprados']),
              ...(filtros.persona ? [] : personas.map((p) => `Agregó ${p}`)),
            ]}
            onElegir={(o) => {
              if (o === 'Pendientes') setFiltros({ ...filtros, estado: 'pendientes' })
              else if (o === 'Comprados') setFiltros({ ...filtros, estado: 'comprados' })
              else setFiltros({ ...filtros, persona: o.replace(/^Agregó /, '') })
            }}
          />
          {hayFiltros && (
            <div className="filtros-activos" aria-label="Filtros aplicados">
              {filtros.texto && (
                <FiltroChip texto={`“${filtros.texto}”`} onQuitar={() => setFiltros({ ...filtros, texto: '' })} />
              )}
              {filtros.estado && (
                <FiltroChip
                  texto={filtros.estado === 'pendientes' ? 'Pendientes' : 'Comprados'}
                  onQuitar={() => setFiltros({ ...filtros, estado: null })}
                />
              )}
              {filtros.persona && (
                <FiltroChip texto={`Agregó ${filtros.persona}`} onQuitar={() => setFiltros({ ...filtros, persona: null })} />
              )}
            </div>
          )}
        </div>
      )}

      {!buscando && (
        <form
          className="agregar-item"
          onSubmit={(e) => {
            e.preventDefault()
            agregar()
          }}
        >
          <div className="campo">
            <input
              ref={refNuevo}
              value={nuevo}
              placeholder="Agregar a la lista"
              aria-label="Agregar a la lista"
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => {
                setNuevo(e.target.value)
                setVerSug(true)
              }}
              onFocus={() => setVerSug(true)}
              onBlur={() => setVerSug(false)}
            />
            {sugerencias.length > 0 && (
              <ul className="sugerencias">
                {sugerencias.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setNuevo(s)
                        setVerSug(false)
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {nuevo.trim() && (
            <div className="fila">
              <label className="campo chico">
                <span>Cantidad</span>
                <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="3, 1 kg" />
              </label>
              <label className="campo crece">
                <span>Marca</span>
                <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Opcional" />
              </label>
              <button className="primario boton-campo">Agregar</button>
            </div>
          )}
        </form>
      )}

      {error && <p className="error">No se pudo leer la lista: {error}</p>}
      {cargando && !error && <p className="vacio">Cargando lista…</p>}
      {!cargando && items.length === 0 && <p className="vacio">La lista está vacía. Anotá lo que falta.</p>}
      {!cargando && items.length > 0 && visibles.length === 0 && (
        <p className="vacio">Nada coincide con los filtros.</p>
      )}

      {pendientes.length > 0 && <ul className="lista">{pendientes.map(fila)}</ul>}

      {comprados.length > 0 && (
        <>
          <div className="lista-sub">
            <span>Comprados ({comprados.length})</span>
            <button
              className="enlace"
              onClick={() =>
                confirm('¿Quitar de la lista todo lo comprado?') &&
                limpiarComprados(listaId, comprados).then(() => onAviso('Comprados quitados'))
              }
            >
              Quitar comprados
            </button>
          </div>
          <ul className="lista">{comprados.map(fila)}</ul>
        </>
      )}

      <button
        className="enlace peligro"
        onClick={async () => {
          if (confirm('¿Salir de esta lista en este teléfono? La lista sigue existiendo para los demás.'))
            await setAjuste('listaId', null)
        }}
      >
        Salir de la lista
      </button>
    </section>
  )
}

function FiltroChip({ texto, onQuitar }: { texto: string; onQuitar: () => void }) {
  return (
    <span className="filtro">
      {texto}
      <button aria-label={`Quitar filtro ${texto}`} onClick={onQuitar}>
        ✕
      </button>
    </span>
  )
}
