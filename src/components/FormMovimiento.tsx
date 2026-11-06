import { useEffect, useMemo, useRef, useState } from 'react'
import { db, normalizar, nuevoBase, personaPorNombre } from '../db/db'
import type { Id, ModoParte, Moneda, Movimiento, Parte, Promo } from '../db/types'
import { MONEDAS } from '../db/types'
import type { Datos } from '../lib/datos'
import { fmt, montoAInput, parseMonto } from '../lib/money'
import { cantidadSugerida, miParte, totalConPromo } from '../lib/promo'
import { cerrarSesion, guardarPagador, guardarSesion, sesionActual, ultimoPagador } from '../lib/sesion'
import {
  sugerirCategoria,
  sugerirDescripciones,
  sugerirLugares,
  sugerirMarcas,
  ultimoPrecio,
} from '../lib/sugerencias'
import { Chips } from './Chips'

type TipoForm = 'gasto' | 'ingreso'
type TipoPromo = '' | Promo['tipo']

interface Props {
  datos: Datos
  tipoInicial: TipoForm
  editando?: Movimiento
  onCerrar: () => void
  onBorrar?: (m: Movimiento) => void
  onGuardado?: (texto: string) => void
}

const aInputFecha = (t: number) => {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const num = (s: string, def: number) => {
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && s.trim() !== '' ? n : def
}

export function FormMovimiento({ datos, tipoInicial, editando, onCerrar, onBorrar, onGuardado }: Props) {
  const { movimientos, personas, metodos, categorias, yo, multimoneda } = datos
  const nombreYo = yo?.nombre ?? 'Yo'
  const [sesion] = useState(sesionActual)
  const [lugarSesion, setLugarSesion] = useState(sesion.lugar)
  const nombrePersona = (id?: Id) => personas.find((p) => p.id === id)?.nombre ?? ''

  const [tipo, setTipo] = useState<TipoForm>(editando ? (editando.tipo === 'ingreso' ? 'ingreso' : 'gasto') : tipoInicial)
  const [descripcion, setDescripcion] = useState(editando?.descripcion ?? '')
  const [verSugDesc, setVerSugDesc] = useState(false)
  const [marca, setMarca] = useState(editando?.marca ?? '')
  const [precio, setPrecio] = useState(editando ? montoAInput(editando.precioUnitCent) : '')
  const [precioTocado, setPrecioTocado] = useState(!!editando)
  const [cantidad, setCantidad] = useState(String(editando?.cantidad ?? 1))
  const [verCantidad, setVerCantidad] = useState((editando?.cantidad ?? 1) !== 1 || !!editando?.promo)
  const [promoTipo, setPromoTipo] = useState<TipoPromo>(editando?.promo?.tipo ?? '')
  const [promoA, setPromoA] = useState(() => {
    const p = editando?.promo
    if (p?.tipo === 'nxm') return String(p.lleva)
    if (p?.tipo === 'nesima') return String(p.n)
    if (p?.tipo === 'pct') return String(p.pct)
    if (p?.tipo === 'manual') return montoAInput(p.totalCent)
    return ''
  })
  const [promoB, setPromoB] = useState(() => {
    const p = editando?.promo
    if (p?.tipo === 'nxm') return String(p.paga)
    if (p?.tipo === 'nesima') return String(p.pct)
    return ''
  })
  const [categoriaId, setCategoriaId] = useState<Id | ''>(editando?.categoriaId ?? '')
  const [categoriaManual, setCategoriaManual] = useState(!!editando?.categoriaId)
  const [lugar, setLugar] = useState(editando ? (editando.lugar ?? '') : tipoInicial === 'gasto' ? sesion.lugar : '')
  const [fecha, setFecha] = useState(() => editando?.fecha ?? sesion.fecha ?? Date.now())
  const [fechaManual, setFechaManual] = useState(!!editando || sesion.fecha !== undefined)
  const [metodoPagoId, setMetodoPagoId] = useState<Id | ''>(editando ? (editando.metodoPagoId ?? '') : (sesion.metodoPagoId ?? ''))
  const [moneda, setMoneda] = useState<Moneda>(editando?.moneda ?? 'ARS')
  const [cuotasN, setCuotasN] = useState(String(editando?.cuotas?.cantidad ?? 1))
  const [totalFin, setTotalFin] = useState(editando?.cuotas ? montoAInput(editando.totalCent) : '')
  const [valorCuota, setValorCuota] = useState(
    editando?.cuotas ? montoAInput(Math.round(editando.totalCent / editando.cuotas.cantidad)) : '',
  )
  const [finTocado, setFinTocado] = useState(!!editando?.cuotas?.precioContadoCent)
  const [pagador, setPagador] = useState(
    editando ? nombrePersona(editando.pagadorId) || nombreYo : (ultimoPagador() ?? nombreYo),
  )
  const [parteModo, setParteModo] = useState<ModoParte>(editando?.parte?.modo ?? 'todo')
  const [partePct, setPartePct] = useState(String(editando?.parte?.pct ?? 50))
  const [contraparte, setContraparte] = useState(editando ? nombrePersona(editando.contraparteId) : '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const refDesc = useRef<HTMLInputElement>(null)
  const refPrecio = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editando) refDesc.current?.focus()
  }, [editando])

  const esGasto = tipo === 'gasto'
  const pagadorEsYo = normalizar(pagador || nombreYo) === normalizar(nombreYo)

  // ---- Cálculos en vivo ----
  const precioCent = parseMonto(precio)
  const cant = Math.max(1, Math.round(num(cantidad, 1)))
  const promo: Promo | undefined = useMemo(() => {
    switch (promoTipo) {
      case 'nxm':
        return { tipo: 'nxm', lleva: num(promoA, 3), paga: num(promoB, 2) }
      case 'nesima':
        return { tipo: 'nesima', n: num(promoA, 2), pct: num(promoB, 50) }
      case 'pct':
        return { tipo: 'pct', pct: num(promoA, 0) }
      case 'manual':
        return { tipo: 'manual', totalCent: parseMonto(promoA) ?? 0 }
      default:
        return undefined
    }
  }, [promoTipo, promoA, promoB])
  const contado = esGasto ? totalConPromo(precioCent ?? 0, cant, promo) : (precioCent ?? 0)
  const ahorro = esGasto && promo ? (precioCent ?? 0) * cant - contado : 0
  const nCuotas = esGasto && moneda === 'ARS' ? Math.max(1, Math.round(num(cuotasN, 1))) : 1
  const total = nCuotas > 1 && finTocado ? (parseMonto(totalFin) ?? contado) : contado
  const totalFinTxt = finTocado ? totalFin : montoAInput(contado)
  const valorCuotaTxt = finTocado ? valorCuota : montoAInput(Math.round(contado / nCuotas))
  const parte: Parte = parteModo === 'pct' ? { modo: 'pct', pct: num(partePct, 50) } : { modo: parteModo }
  const miParteCent = miParte(total, parte)

  // ---- Sugerencias ----
  const sugDesc = useMemo(
    () => (verSugDesc ? sugerirDescripciones(movimientos, tipo, descripcion) : []),
    [verSugDesc, movimientos, tipo, descripcion],
  )
  const sugLugares = useMemo(() => sugerirLugares(movimientos, tipo), [movimientos, tipo])
  const sugMarcas = useMemo(() => (esGasto ? sugerirMarcas(movimientos, descripcion) : []), [esGasto, movimientos, descripcion])
  const otrasPersonas = personas.filter((p) => !p.esYo).map((p) => p.nombre)
  const cats = categorias.filter((c) => c.tipo === tipo)

  function autocompletar(desc: string, mar: string, lug: string, enfocarPrecio: boolean) {
    if (!categoriaManual) {
      const c = sugerirCategoria(movimientos, tipo, desc, lug)
      if (c) setCategoriaId(c)
    }
    if (!esGasto || precioTocado) return
    const ult = ultimoPrecio(movimientos, desc, mar, lug)
    if (!ult) return
    setPrecio(montoAInput(ult.cent))
    if (multimoneda) setMoneda(ult.moneda)
    if (enfocarPrecio) {
      requestAnimationFrame(() => {
        refPrecio.current?.focus()
        refPrecio.current?.select()
      })
    }
  }

  function elegirDescripcion(d: string) {
    setDescripcion(d)
    setVerSugDesc(false)
    autocompletar(d, marca, lugar, true)
  }

  function cambiarTipo(t: TipoForm) {
    if (t === tipo) return
    setTipo(t)
    setCategoriaId('')
    setCategoriaManual(false)
    if (!editando) setLugar(t === 'gasto' ? lugarSesion : '')
  }

  function elegirPromo(t: TipoPromo) {
    setPromoTipo(t)
    const defaults: Record<string, [string, string]> = { nxm: ['3', '2'], nesima: ['2', '70'], pct: ['20', ''], manual: ['', ''] }
    const [a, b] = defaults[t] ?? ['', '']
    setPromoA(a)
    setPromoB(b)
    if (t === 'nxm' || t === 'nesima') {
      const sug = cantidadSugerida(t === 'nxm' ? { tipo: t, lleva: 3, paga: 2 } : { tipo: t, n: 2, pct: 70 })
      if (cant < sug) setCantidad(String(sug))
    }
  }

  async function agregarOpcion(cual: 'metodo' | 'categoria') {
    const nombre = window.prompt(cual === 'metodo' ? 'Nuevo método de pago' : 'Nueva categoría')?.trim()
    if (!nombre) return
    const base = nuevoBase()
    const id = base.id
    if (cual === 'metodo') {
      await db.metodosPago.add({ ...base, nombre })
      setMetodoPagoId(id)
    } else {
      await db.categorias.add({ ...base, nombre, tipo })
      setCategoriaId(id)
      setCategoriaManual(true)
    }
  }

  function limpiarParaOtro() {
    setDescripcion('')
    setMarca('')
    setPrecio('')
    setPrecioTocado(false)
    setCantidad('1')
    setVerCantidad(false)
    setPromoTipo('')
    setCategoriaId('')
    setCategoriaManual(false)
    setCuotasN('1')
    setFinTocado(false)
    setParteModo('todo')
    if (!fechaManual) setFecha(Date.now())
    setError('')
    refDesc.current?.focus()
  }

  async function guardar(cerrar: boolean) {
    setError('')
    if (!descripcion.trim()) return setError('Falta la descripción')
    if (precioCent === null || precioCent <= 0) return setError(esGasto ? 'Falta el precio' : 'Falta el monto')
    if (promoTipo === 'manual' && !(parseMonto(promoA) ?? 0)) return setError('Escribí el total que pagaste con la promo')
    if (esGasto && pagadorEsYo && parteModo !== 'todo' && !contraparte.trim())
      return setError('¿Con quién compartiste el gasto?')

    setGuardando(true)
    try {
      let pagadorId: Id | undefined
      let contraparteId: Id | undefined
      if (esGasto) {
        const p = pagadorEsYo && yo ? yo : await personaPorNombre(pagador || nombreYo)
        pagadorId = p.id
        if (pagadorEsYo && parteModo !== 'todo') contraparteId = (await personaPorNombre(contraparte)).id
      }
      const ahora = Date.now()
      const base = editando
        ? { id: editando.id, creadoEn: editando.creadoEn, modificadoEn: ahora, borradoEn: null }
        : nuevoBase()
      const mov: Movimiento = {
        ...base,
        tipo,
        descripcion: descripcion.trim(),
        descripcionNorm: normalizar(descripcion),
        marca: esGasto && marca.trim() ? marca.trim() : undefined,
        categoriaId: categoriaId || undefined,
        cantidad: esGasto ? cant : 1,
        precioUnitCent: precioCent,
        promo: esGasto ? promo : undefined,
        totalCent: total,
        moneda,
        fecha,
        lugar: lugar.trim() || undefined,
        metodoPagoId: metodoPagoId || undefined,
        pagadorId,
        contraparteId,
        parte: esGasto ? parte : undefined,
        miParteCent: esGasto ? miParteCent : undefined,
        cuotas: nCuotas > 1 ? { cantidad: nCuotas, precioContadoCent: contado !== total ? contado : undefined } : undefined,
        compraId: esGasto ? (editando?.compraId ?? sesion.compraId) : undefined,
      }
      await db.movimientos.put(mov)

      if (editando) return onCerrar()

      if (esGasto) guardarPagador(pagador.trim() || nombreYo)
      onGuardado?.(`${tipo === 'gasto' ? 'Gasto' : 'Ingreso'} guardado: ${fmt(total, moneda)}`)
      if (cerrar) {
        cerrarSesion()
        onCerrar()
      } else {
        guardarSesion({
          compraId: sesion.compraId,
          lugar: esGasto ? lugar.trim() : lugarSesion,
          fecha: fechaManual ? fecha : undefined,
          metodoPagoId: metodoPagoId || undefined,
        })
        if (esGasto) setLugarSesion(lugar.trim())
        limpiarParaOtro()
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        guardar(false)
      }}
    >
      <header className="form-cab">
        <div className={'switch switch-' + tipo} role="radiogroup" aria-label="Tipo">
          <button type="button" role="radio" aria-checked={esGasto} onClick={() => cambiarTipo('gasto')}>
            Gasto
          </button>
          <button type="button" role="radio" aria-checked={!esGasto} onClick={() => cambiarTipo('ingreso')}>
            Ingreso
          </button>
        </div>
        <button type="button" className="icono" aria-label="Cerrar" onClick={onCerrar}>
          ✕
        </button>
      </header>

      <div className="campos">
        <label className="campo">
          <span>Descripción *</span>
          <input
            ref={refDesc}
            value={descripcion}
            placeholder={esGasto ? 'Leche entera' : 'Sueldo'}
            autoComplete="off"
            enterKeyHint="next"
            onChange={(e) => {
              setDescripcion(e.target.value)
              setVerSugDesc(true)
            }}
            onFocus={() => setVerSugDesc(true)}
            onBlur={() => {
              setVerSugDesc(false)
              if (descripcion.trim() && !precio) autocompletar(descripcion, marca, lugar, false)
            }}
          />
          {sugDesc.length > 0 && (
            <ul className="sugerencias">
              {sugDesc.map((s) => (
                <li key={s}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => elegirDescripcion(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>

        {esGasto && (
          <label className="campo">
            <span>Marca</span>
            <input
              value={marca}
              placeholder="Opcional"
              autoComplete="off"
              onChange={(e) => setMarca(e.target.value)}
              onBlur={() => autocompletar(descripcion, marca, lugar, false)}
            />
            <Chips
              opciones={sugMarcas}
              activo={marca}
              onElegir={(m) => {
                setMarca(m)
                autocompletar(descripcion, m, lugar, true)
              }}
            />
          </label>
        )}

        <div className="fila">
          <label className="campo crece">
            <span>{esGasto ? (cant > 1 ? 'Precio unitario *' : 'Precio *') : 'Monto *'}</span>
            <input
              ref={refPrecio}
              className="monto"
              value={precio}
              inputMode="decimal"
              placeholder="0"
              autoComplete="off"
              onChange={(e) => {
                setPrecio(e.target.value)
                setPrecioTocado(true)
              }}
            />
          </label>
          {multimoneda && (
            <label className="campo">
              <span>Moneda</span>
              <select
                value={moneda}
                onChange={(e) => {
                  const m = e.target.value as Moneda
                  setMoneda(m)
                  if (m !== 'ARS') setCuotasN('1')
                }}
              >
                {MONEDAS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {esGasto && !verCantidad && (
          <button type="button" className="enlace" onClick={() => setVerCantidad(true)}>
            + Cantidad o promo
          </button>
        )}

        {esGasto && verCantidad && (
          <fieldset className="grupo">
            <div className="fila">
              <label className="campo chico">
                <span>Cantidad</span>
                <input value={cantidad} inputMode="numeric" onChange={(e) => setCantidad(e.target.value)} />
              </label>
              <label className="campo crece">
                <span>Promo</span>
                <select value={promoTipo} onChange={(e) => elegirPromo(e.target.value as TipoPromo)}>
                  <option value="">Sin promo</option>
                  <option value="nxm">Lleva N, paga M (3x2)</option>
                  <option value="nesima">N-ésima unidad con descuento</option>
                  <option value="pct">% de descuento</option>
                  <option value="manual">Otra (escribo el total)</option>
                </select>
              </label>
            </div>
            {promoTipo === 'nxm' && (
              <div className="fila">
                <label className="campo chico">
                  <span>Lleva</span>
                  <input value={promoA} inputMode="numeric" onChange={(e) => setPromoA(e.target.value)} />
                </label>
                <label className="campo chico">
                  <span>Paga</span>
                  <input value={promoB} inputMode="numeric" onChange={(e) => setPromoB(e.target.value)} />
                </label>
              </div>
            )}
            {promoTipo === 'nesima' && (
              <div className="fila">
                <label className="campo chico">
                  <span>Unidad nº</span>
                  <input value={promoA} inputMode="numeric" onChange={(e) => setPromoA(e.target.value)} />
                </label>
                <label className="campo chico">
                  <span>% off</span>
                  <input value={promoB} inputMode="numeric" onChange={(e) => setPromoB(e.target.value)} />
                </label>
              </div>
            )}
            {promoTipo === 'pct' && (
              <label className="campo chico">
                <span>% off</span>
                <input value={promoA} inputMode="numeric" onChange={(e) => setPromoA(e.target.value)} />
              </label>
            )}
            {promoTipo === 'manual' && (
              <label className="campo">
                <span>Total que pagaste</span>
                <input value={promoA} inputMode="decimal" onChange={(e) => setPromoA(e.target.value)} />
              </label>
            )}
          </fieldset>
        )}

        {esGasto && (cant > 1 || promo) && precioCent !== null && (
          <p className="calculo">
            Total {fmt(contado, moneda)}
            {cant > 1 && <> · {fmt(Math.round(contado / cant), moneda)} c/u</>}
            {ahorro > 0 && <> · ahorrás {fmt(ahorro, moneda)}</>}
          </p>
        )}

        <label className="campo">
          <span>Categoría</span>
          <select
            value={categoriaId}
            onChange={(e) => {
              if (e.target.value === '+') return void agregarOpcion('categoria')
              setCategoriaId(e.target.value)
              setCategoriaManual(true)
            }}
          >
            <option value="">Sin categoría</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
            <option value="+">+ Nueva…</option>
          </select>
        </label>

        <label className="campo">
          <span>{esGasto ? 'Lugar de compra' : 'Origen'}</span>
          <div className="con-boton">
            <input
              value={lugar}
              placeholder="Opcional"
              autoComplete="off"
              onChange={(e) => setLugar(e.target.value)}
              onBlur={() => autocompletar(descripcion, marca, lugar, false)}
            />
            {lugar && (
              <button type="button" className="icono" aria-label="Vaciar lugar" onClick={() => setLugar('')}>
                ✕
              </button>
            )}
          </div>
          <Chips
            opciones={sugLugares}
            activo={lugar}
            onElegir={(l) => {
              setLugar(l)
              autocompletar(descripcion, marca, l, false)
            }}
          />
        </label>

        <label className="campo">
          <span>Fecha</span>
          <div className="con-boton">
            <input
              type="datetime-local"
              value={aInputFecha(fecha)}
              onChange={(e) => {
                const t = new Date(e.target.value).getTime()
                if (Number.isFinite(t)) {
                  setFecha(t)
                  setFechaManual(true)
                }
              }}
            />
            {fechaManual && !editando && (
              <button
                type="button"
                className="enlace"
                onClick={() => {
                  setFecha(Date.now())
                  setFechaManual(false)
                }}
              >
                Ahora
              </button>
            )}
          </div>
        </label>

        <label className="campo">
          <span>{esGasto ? 'Método de pago' : 'Medio de cobro'}</span>
          <select
            value={metodoPagoId}
            onChange={(e) => {
              if (e.target.value === '+') return void agregarOpcion('metodo')
              setMetodoPagoId(e.target.value)
            }}
          >
            <option value="">—</option>
            {metodos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
            <option value="+">+ Nuevo…</option>
          </select>
        </label>

        {esGasto && moneda === 'ARS' && (
          <fieldset className="grupo">
            <div className="fila">
              <label className="campo chico">
                <span>Cuotas</span>
                <input
                  value={cuotasN}
                  inputMode="numeric"
                  onChange={(e) => {
                    setCuotasN(e.target.value)
                    setFinTocado(false)
                  }}
                />
              </label>
              {nCuotas > 1 && (
                <>
                  <label className="campo crece">
                    <span>Total financiado</span>
                    <input
                      value={totalFinTxt}
                      inputMode="decimal"
                      onChange={(e) => {
                        setFinTocado(true)
                        setTotalFin(e.target.value)
                        const c = parseMonto(e.target.value)
                        setValorCuota(c ? montoAInput(Math.round(c / nCuotas)) : '')
                      }}
                    />
                  </label>
                  <label className="campo crece">
                    <span>Valor cuota</span>
                    <input
                      value={valorCuotaTxt}
                      inputMode="decimal"
                      onChange={(e) => {
                        setFinTocado(true)
                        setValorCuota(e.target.value)
                        const c = parseMonto(e.target.value)
                        setTotalFin(c ? montoAInput(c * nCuotas) : '')
                      }}
                    />
                  </label>
                </>
              )}
            </div>
            {nCuotas > 1 && total > contado && contado > 0 && (
              <p className="calculo">
                Interés {fmt(total - contado)} ({(((total - contado) / contado) * 100).toFixed(1)}%)
              </p>
            )}
          </fieldset>
        )}

        {esGasto && (
          <>
            <label className="campo">
              <span>Pagador</span>
              <input value={pagador} autoComplete="off" onChange={(e) => setPagador(e.target.value)} />
              <Chips opciones={[nombreYo, ...otrasPersonas]} activo={pagador} onElegir={setPagador} />
            </label>

            <div className="campo">
              <span>Mi parte</span>
              <div className="segmentos">
                {(['todo', 'mitad', 'nada', 'pct'] as ModoParte[]).map((m) => (
                  <button
                    type="button"
                    key={m}
                    aria-pressed={parteModo === m}
                    onClick={() => setParteModo(m)}
                  >
                    {{ todo: 'Todo', mitad: 'Mitad', nada: 'Nada', pct: '%' }[m]}
                  </button>
                ))}
              </div>
              {parteModo === 'pct' && (
                <input
                  className="chico"
                  value={partePct}
                  inputMode="numeric"
                  aria-label="Porcentaje que te toca"
                  onChange={(e) => setPartePct(e.target.value)}
                />
              )}
            </div>

            {pagadorEsYo && parteModo !== 'todo' && (
              <label className="campo">
                <span>Compartido con *</span>
                <input value={contraparte} autoComplete="off" onChange={(e) => setContraparte(e.target.value)} />
                <Chips opciones={otrasPersonas} activo={contraparte} onElegir={setContraparte} />
              </label>
            )}

            {precioCent !== null && (parteModo !== 'todo' || !pagadorEsYo) && (
              <p className="calculo">
                {pagadorEsYo
                  ? `${contraparte || 'La otra persona'} te debe ${fmt(total - miParteCent, moneda)}`
                  : miParteCent > 0
                    ? `Le debés ${fmt(miParteCent, moneda)} a ${pagador}`
                    : `Solo registro: no debés nada`}
              </p>
            )}
          </>
        )}

        {error && <p className="error">{error}</p>}

        {editando && onBorrar && (
          <button type="button" className="peligro" onClick={() => onBorrar(editando)}>
            Borrar movimiento
          </button>
        )}
      </div>

      <footer className="acciones">
        {editando ? (
          <button type="button" className="primario" disabled={guardando} onClick={() => guardar(true)}>
            Guardar cambios
          </button>
        ) : (
          <>
            <button type="submit" className="secundario" disabled={guardando}>
              Guardar y agregar otro
            </button>
            <button type="button" className="primario" disabled={guardando} onClick={() => guardar(true)}>
              Guardar y cerrar
            </button>
          </>
        )}
      </footer>
    </form>
  )
}
