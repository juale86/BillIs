import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
import { CamposPromo, type TipoPromo } from './CamposPromo'
import { avisar } from '../lib/avisos'
import { pedirTexto } from '../lib/dialogos'
import { db, normalizar, nuevoBase, personaPorNombre, uuid } from '../db/db'
import type { GastoCargado, Id, Moneda, Movimiento, Parte, Promo, Ubicacion } from '../db/types'
import { MONEDAS } from '../db/types'
import type { Datos } from '../lib/datos'
import { cambios, ETIQUETA_CAMPO, historialAlEditar, textoCampo, type CampoCarga } from '../lib/historial'
import { fmt, montoAInput, parseMonto } from '../lib/money'
import { cantidadSugerida, miParte, totalConPromo } from '../lib/promo'
import { guardarSesion, sesionActual, ultimoPagador } from '../lib/sesion'
import { sugerirCategoria, sugerirDescripciones, sugerirLugares, sugerirMarcas, ultimoPrecio } from '../lib/sugerencias'
import { linkMapa, lugarCercano, obtenerUbicacion } from '../lib/ubicacion'
import { BotonCerrar } from './BotonCerrar'
import { Chips } from './Chips'
import { MetodoCuotas } from './MetodoCuotas'
import { HistorialMov } from './HistorialMov'

type TipoForm = 'gasto' | 'ingreso'

/** El dueño de una lista corrige lo que compró otro miembro: el mismo formulario, pero se guarda en la lista. */
export interface Correccion {
  /** Quién lo compró. */
  quien: string
  /** Lo que tiene cargado ahora (con las correcciones anteriores). */
  actual: GastoCargado
  /** Lo que cargó quien lo compró: los cambios se muestran siempre contra esto. */
  original: GastoCargado
  corregidoPor: string | null
  corregidoEn: number | null
  /** Se marcó comprado sin gasto: se puede dejar sin precio. */
  sinMonto: boolean
  onGuardar: (g: GastoCargado) => void
}

interface Props {
  datos: Datos
  tipoInicial: TipoForm
  editando?: Movimiento
  /** Datos iniciales (ej. desde la lista de compras). */
  prefill?: { descripcion: string; marca?: string; cantidad?: number; listaItem?: Movimiento['listaItem']; agregadoPor?: string }
  /** 'lista': se abrió tocando un ítem de la lista de compras (Cancelar / Guardar, vuelve a la lista). */
  contexto?: 'lista'
  onCerrar: () => void
  onBorrar?: (m: Movimiento) => void
  /** Se llama con el movimiento guardado (alta o edición). */
  onGuardadoMov?: (m: Movimiento) => void
  /** "Ya comprado, sin gasto" (solo desde la lista). */
  onSinGasto?: () => void
  correccion?: Correccion
}

const aInputFecha = (t: number) => {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Al tocar el campo se selecciona todo, para escribir encima (como con doble clic). */
const seleccionarTodo = (e: FocusEvent<HTMLInputElement>) => {
  const el = e.currentTarget
  // En el celular el toque mueve el cursor después del foco: se selecciona un instante después.
  setTimeout(() => el.setSelectionRange(0, el.value.length), 0)
}

const num = (s: string, def: number) => {
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && s.trim() !== '' ? n : def
}

export function FormMovimiento({
  datos,
  tipoInicial,
  editando,
  prefill,
  contexto,
  onCerrar,
  onBorrar,
  onGuardadoMov,
  onSinGasto,
  correccion,
}: Props) {
  const { movimientos, metodos, categorias, yo, multimoneda } = datos
  // Para adivinar la categoría por el nombre, como el grupo en la lista.
  const dicc = { categorias, grupos: datos.grupos, aprendidos: datos.gruposAprendidos }
  const nombreYo = yo?.nombre ?? 'Yo'
  // Compra en curso: se mantiene entre guardados hasta "Pagar" (o 2 h sin actividad).
  const [sesion, setSesion] = useState(sesionActual)
  // La categoría de una corrección viene por nombre; si no la tenés, se ofrece igual ("~Nombre").
  const catDeNombre = (n: string | null) =>
    !n ? undefined : (categorias.find((c) => c.tipo === 'gasto' && normalizar(c.nombre) === normalizar(n))?.id ?? `~${n}`)
  // Valores con que arranca: el movimiento que se edita o lo que tiene cargado el ítem que se corrige.
  const [ini] = useState<Partial<Movimiento> | undefined>(() => {
    if (editando || !correccion) return editando
    const a = correccion.actual
    return {
      tipo: 'gasto',
      descripcion: a.descripcion,
      marca: a.marca ?? undefined,
      comentario: a.comentario ?? undefined,
      precioUnitCent: a.precioUnitCent,
      cantidad: a.cantidad,
      promo: a.promo ?? undefined,
      categoriaId: catDeNombre(a.categoria),
      lugar: a.lugar ?? undefined,
      fecha: a.fecha,
      moneda: a.moneda,
    }
  })

  const [tipo, setTipo] = useState<TipoForm>(ini ? (ini.tipo === 'ingreso' ? 'ingreso' : 'gasto') : tipoInicial)
  const [descripcion, setDescripcion] = useState(ini?.descripcion ?? prefill?.descripcion ?? '')
  const [verSugDesc, setVerSugDesc] = useState(false)
  const [marca, setMarca] = useState(ini?.marca ?? prefill?.marca ?? '')
  const [comentario, setComentario] = useState(ini?.comentario ?? '')
  const [precio, setPrecio] = useState(() => {
    if (ini) return ini.precioUnitCent ? montoAInput(ini.precioUnitCent) : ''
    const ult = prefill && ultimoPrecio(movimientos, prefill.descripcion, prefill.marca ?? '', sesion.lugar)
    return ult ? montoAInput(ult.cent) : ''
  })
  const [precioTocado, setPrecioTocado] = useState(!!ini)
  // Vacío = 1: así se ve el placeholder "Cant". Solo se escribe cuando es más de uno.
  const [cantidad, setCantidad] = useState(() => {
    const c = ini?.cantidad ?? prefill?.cantidad ?? 1
    return c > 1 ? String(c) : ''
  })
  const [verPromo, setVerPromo] = useState(!!ini?.promo)
  const [promoTipo, setPromoTipo] = useState<TipoPromo>(ini?.promo?.tipo ?? '')
  const [promoA, setPromoA] = useState(() => {
    const p = ini?.promo
    if (p?.tipo === 'nxm') return String(p.lleva)
    if (p?.tipo === 'nesima') return String(p.n)
    if (p?.tipo === 'pct') return String(p.pct)
    if (p?.tipo === 'manual') return montoAInput(p.totalCent)
    return ''
  })
  const [promoB, setPromoB] = useState(() => {
    const p = ini?.promo
    if (p?.tipo === 'nxm') return String(p.paga)
    if (p?.tipo === 'nesima') return String(p.pct)
    return ''
  })
  const [categoriaId, setCategoriaId] = useState<Id | ''>(
    () =>
      ini?.categoriaId ??
      (prefill ? sugerirCategoria(movimientos, 'gasto', prefill.descripcion, sesion.lugar, dicc) : undefined) ??
      '',
  )
  const [categoriaManual, setCategoriaManual] = useState(!!ini?.categoriaId)
  const [lugar, setLugar] = useState(ini ? (ini.lugar ?? '') : tipoInicial === 'gasto' ? sesion.lugar : '')
  const [ubicacion, setUbicacion] = useState<Ubicacion | undefined>(() =>
    ini ? ini.ubicacion : tipoInicial === 'gasto' ? sesion.ubicacion : undefined,
  )
  const [ubicando, setUbicando] = useState(false)
  const [fecha, setFecha] = useState(() => ini?.fecha ?? sesion.fecha ?? Date.now())
  const [fechaManual, setFechaManual] = useState(!!ini || sesion.fecha !== undefined)
  const [metodoPagoId, setMetodoPagoId] = useState<Id | ''>(ini?.metodoPagoId ?? '')
  const [moneda, setMoneda] = useState<Moneda>(ini?.moneda ?? 'ARS')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const refDesc = useRef<HTMLInputElement>(null)
  const refPrecio = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ini) return
    // Desde la lista la descripción ya viene: se arranca por el precio.
    const r = prefill ? refPrecio.current : refDesc.current
    r?.focus()
    if (prefill) r?.select()
  }, [ini, prefill])

  const esGasto = tipo === 'gasto'

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
  // Método, cuotas, pagador y tu parte se eligen en Pagar; al editar se conservan como están.
  // Si el gasto tenía interés de cuotas y el precio no cambió, se mantiene el total financiado.
  const cuotasPrev = esGasto && moneda === 'ARS' ? editando?.cuotas : undefined
  const conInteres = !!cuotasPrev?.precioContadoCent && cuotasPrev.precioContadoCent === contado
  const total = conInteres ? editando!.totalCent : contado
  const cuotas = cuotasPrev && { cantidad: cuotasPrev.cantidad, precioContadoCent: conInteres ? contado : undefined }
  const parte: Parte = editando?.parte ?? { modo: 'todo' }

  // ---- Sugerencias ----
  const sugDesc = useMemo(
    () => (verSugDesc ? sugerirDescripciones(movimientos, tipo, descripcion) : []),
    [verSugDesc, movimientos, tipo, descripcion],
  )
  const sugLugares = useMemo(() => sugerirLugares(movimientos, tipo), [movimientos, tipo])
  const sugMarcas = useMemo(() => (esGasto ? sugerirMarcas(movimientos, descripcion) : []), [esGasto, movimientos, descripcion])
  const cats = [
    ...categorias.filter((c) => c.tipo === tipo),
    // Corrigiendo: la categoría de quien lo compró, aunque no esté entre las tuyas.
    ...(categoriaId.startsWith('~') ? [{ id: categoriaId, nombre: categoriaId.slice(1) }] : []),
  ]
  const nombreCategoria = categoriaId.startsWith('~')
    ? categoriaId.slice(1)
    : (categorias.find((c) => c.id === categoriaId)?.nombre ?? null)

  // ---- Lo que se cargó antes ----
  // Corrigiendo: contra lo que cargó quien lo compró. Editando lo tuyo: contra lo primero que cargaste.
  const referencia = correccion?.original ?? editando?.historial?.original
  const carga: GastoCargado = {
    descripcion: descripcion.trim(),
    marca: (esGasto && marca.trim()) || null,
    cantidad: esGasto ? cant : 1,
    precioUnitCent: precioCent ?? 0,
    promo: (esGasto && promo) || null,
    totalCent: total,
    moneda,
    fecha,
    lugar: lugar.trim() || null,
    comentario: comentario.trim() || null,
    categoria: nombreCategoria,
    cargadoEn: referencia?.cargadoEn ?? editando?.creadoEn ?? 0,
  }
  const distintos = new Set(referencia ? cambios(referencia, carga) : [])
  const quienCargo = correccion ? `que cargó ${correccion.quien}` : 'que cargaste'
  /** Debajo de los campos cambiados, lo que se había cargado. */
  const antes = (...campos: CampoCarga[]) =>
    referencia &&
    campos
      .filter((c) => distintos.has(c))
      .map((c) => (
        <p key={c} className="antes">
          {ETIQUETA_CAMPO[c]} {quienCargo}: <span>{textoCampo(c, referencia)}</span>
        </p>
      ))
  // Dentro del campo Marca: las que coinciden con lo escrito (hasta 3); al elegir una, las otras se van.
  const chipsMarca = useMemo(() => {
    const q = normalizar(marca)
    return sugMarcas.filter((m) => normalizar(m) !== q && normalizar(m).includes(q)).slice(0, 3)
  }, [sugMarcas, marca])

  function autocompletar(desc: string, mar: string, lug: string, enfocarPrecio: boolean) {
    if (!categoriaManual) {
      const c = sugerirCategoria(movimientos, tipo, desc, lug, dicc)
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
    if (!editando) {
      setLugar(t === 'gasto' ? sesion.lugar : '')
      setUbicacion(t === 'gasto' ? sesion.ubicacion : undefined)
    }
  }

  /** Toma la posición del GPS; si ya compraste cerca y no hay lugar escrito, lo completa. */
  async function ubicar() {
    setUbicando(true)
    setError('')
    try {
      const u = await obtenerUbicacion()
      setUbicacion(u)
      const cerca = lugar.trim() ? null : lugarCercano(movimientos, u)
      if (cerca) {
        setLugar(cerca)
        autocompletar(descripcion, marca, cerca, false)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUbicando(false)
    }
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
    const nombre = await pedirTexto({ titulo: cual === 'metodo' ? 'Nuevo método de pago' : 'Nueva categoría', boton: 'Agregar' })
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
    setComentario('')
    setPrecio('')
    setPrecioTocado(false)
    setCantidad('')
    setVerPromo(false)
    setPromoTipo('')
    setCategoriaId('')
    setCategoriaManual(false)
    if (!fechaManual) setFecha(Date.now())
    setError('')
    refDesc.current?.focus()
  }

  /** otro: después de guardar deja el formulario listo para otro gasto. */
  async function guardar(otro: boolean) {
    setError('')
    if (!descripcion.trim()) return setError(esGasto ? 'Falta el producto' : 'Falta el concepto')
    const sinPrecioOk = correccion?.sinMonto && !precio.trim()
    if (!sinPrecioOk && (precioCent === null || precioCent <= 0)) return setError(esGasto ? 'Falta el precio' : 'Falta el monto')
    if (promoTipo === 'manual' && !(parseMonto(promoA) ?? 0)) return setError('Escribí el total que pagaste con la promo')

    // Corrigiendo lo que compró otro: se guarda en la lista (sin esperar a la señal) y su teléfono lo aplica.
    if (correccion) {
      if (cambios(correccion.actual, carga).length) {
        correccion.onGuardar(carga)
        avisar('Corrección guardada')
      }
      return onCerrar()
    }

    setGuardando(true)
    try {
      // Un gasto nuevo queda con el último pagador hasta que se paga la compra.
      let pagadorId = editando?.pagadorId
      if (esGasto && !pagadorId) {
        const ult = ultimoPagador() ?? nombreYo
        const esYo = normalizar(ult) === normalizar(nombreYo)
        pagadorId = esYo && yo ? yo.id : (await personaPorNombre(ult)).id
      }
      const contraparteId = esGasto ? editando?.contraparteId : undefined
      // Todo gasto nuevo es parte de la compra en curso: método, cuotas, pagador y tu parte se eligen al "Pagar".
      // Hasta entonces queda con el último pagador y "Todo" como tu parte.
      const enCompra = esGasto && !editando
      let compraId = esGasto ? editando?.compraId : undefined
      if (enCompra)
        compraId = sesion.lugar && normalizar(sesion.lugar) !== normalizar(lugar) ? uuid() : sesion.compraId
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
        comentario: comentario.trim() || undefined,
        categoriaId: categoriaId || undefined,
        cantidad: esGasto ? cant : 1,
        precioUnitCent: precioCent ?? 0,
        promo: esGasto ? promo : undefined,
        totalCent: total,
        moneda,
        fecha,
        lugar: lugar.trim() || undefined,
        ubicacion: esGasto ? ubicacion : undefined,
        metodoPagoId: enCompra ? undefined : metodoPagoId || undefined,
        pagadorId,
        contraparteId,
        parte: esGasto ? parte : undefined,
        miParteCent: esGasto ? miParte(total, parte) : undefined,
        cuotas: esGasto ? cuotas : undefined,
        compraId,
        listaItem: editando?.listaItem ?? prefill?.listaItem,
      }
      // Editando: se guarda lo primero que se cargó y quién hizo el último cambio.
      if (editando) mov.historial = historialAlEditar(editando, mov, nombreYo, categorias)
      await db.movimientos.put(mov)
      onGuardadoMov?.(mov)

      if (editando) return onCerrar()

      if (enCompra && compraId) {
        const nueva = { compraId, lugar: lugar.trim(), ubicacion, fecha: fechaManual ? fecha : undefined }
        guardarSesion(nueva)
        setSesion({ ...nueva, ultimaActividad: Date.now() })
      }
      avisar(`${tipo === 'gasto' ? 'Gasto' : 'Ingreso'} guardado: ${fmt(total, moneda)}`)
      if (otro) limpiarParaOtro()
      else onCerrar()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        guardar(!editando && !correccion && contexto !== 'lista')
      }}
    >
      <header className="form-cab">
        {correccion ? (
          <h2 className="tipo tipo-fijo tipo-gasto">
            <span className="tipo-texto">Corregir lo que compró {correccion.quien}</span>
          </h2>
        ) : editando || contexto === 'lista' ? (
          // Editando o comprando de la lista el tipo ya está decidido: solo el título, sin switch.
          <h2 className={'tipo tipo-fijo tipo-' + tipo}>
            <span className="tipo-texto">{editando ? 'Editar' : 'Nuevo'} {esGasto ? 'gasto' : 'ingreso'}</span>
          </h2>
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={!esGasto}
            aria-label="Es un ingreso"
            className={'tipo tipo-' + tipo}
            onClick={() => cambiarTipo(esGasto ? 'ingreso' : 'gasto')}
          >
            <span className="tipo-pista" aria-hidden="true">
              <span className="tipo-bola" />
            </span>
            <span className="tipo-texto">Nuevo {esGasto ? 'gasto' : 'ingreso'}</span>
          </button>
        )}
        <BotonCerrar onClick={onCerrar} />
      </header>

      <div className="campos">
        {contexto === 'lista' && onSinGasto && (
          <button type="button" className="enlace" onClick={onSinGasto}>
            Ya comprado, sin gasto
          </button>
        )}
        <div className="fila">
          <label className="campo crece">
            <input
              ref={refDesc}
              value={descripcion}
              placeholder={esGasto ? 'Ej. Leche entera' : 'Concepto, ej. Sueldo'}
              aria-label={esGasto ? 'Producto' : 'Concepto'}
              autoComplete="off"
              enterKeyHint="next"
              onChange={(e) => {
                const d = e.target.value
                setDescripcion(d)
                setVerSugDesc(true)
                // La categoría se va completando mientras se escribe, hasta que la elijas a mano.
                if (!categoriaManual) {
                  const c = d.trim() ? sugerirCategoria(movimientos, tipo, d, lugar, dicc) : undefined
                  if (c || !d.trim()) setCategoriaId(c ?? '')
                }
              }}
              onKeyDown={(e) => {
                // "Siguiente" del teclado: salta al precio en vez de intentar guardar.
                if (e.key !== 'Enter') return
                e.preventDefault()
                setVerSugDesc(false)
                refPrecio.current?.focus()
                // Si conoce el último precio lo completa y lo deja seleccionado para escribir encima.
                if (descripcion.trim()) autocompletar(descripcion, marca, lugar, true)
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
            <>
              {/* Las marcas ya compradas aparecen dentro del campo: un toque elige; si no está, se escribe al lado. */}
              <label className={'campo crece campo-marca' + (chipsMarca.length ? ' con-chips' : '')}>
                {chipsMarca.map((m) => (
                  <button
                    type="button"
                    key={m}
                    className="chip"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setMarca(m)
                      autocompletar(descripcion, m, lugar, true)
                    }}
                  >
                    {m}
                  </button>
                ))}
                <input
                  value={marca}
                  placeholder={chipsMarca.length ? 'Otra' : 'Marca'}
                  aria-label="Marca"
                  autoComplete="off"
                  onChange={(e) => setMarca(e.target.value)}
                  onBlur={() => autocompletar(descripcion, marca, lugar, false)}
                />
              </label>
              <label className="campo cant">
                <input
                  value={cantidad}
                  placeholder="Cant"
                  aria-label="Cantidad"
                  inputMode="numeric"
                  onChange={(e) => setCantidad(e.target.value)}
                  onFocus={seleccionarTodo}
                />
              </label>
            </>
          )}
        </div>
        {antes('descripcion', 'marca', 'cantidad')}

        <div className="fila fila-base">
          <label className="campo crece">
            <div className="monto-fila">
              <span className={'signo ' + tipo} aria-hidden="true">
                {moneda === 'USD' ? 'US$' : '$'}
              </span>
              <input
                ref={refPrecio}
                className="monto"
                aria-label={esGasto ? (cant > 1 ? 'Precio unitario' : 'Precio') : 'Monto'}
                value={precio}
                inputMode="decimal"
                placeholder="0"
                autoComplete="off"
                onChange={(e) => {
                  setPrecio(e.target.value)
                  setPrecioTocado(true)
                }}
              />
            </div>
          </label>
          {multimoneda && (
            <label className="campo">
              <select
                aria-label="Moneda"
                value={moneda}
                onChange={(e) => {
                  const m = e.target.value as Moneda
                  setMoneda(m)
                }}
              >
                {MONEDAS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
          <div className="campo fecha">
            {fechaManual && !editando && !correccion && (
              <button
                type="button"
                className="enlace mini ahora"
                onClick={() => {
                  setFecha(Date.now())
                  setFechaManual(false)
                }}
              >
                Ahora
              </button>
            )}
            <input
              type="datetime-local"
              aria-label="Fecha"
              value={aInputFecha(fecha)}
              onChange={(e) => {
                const t = new Date(e.target.value).getTime()
                if (Number.isFinite(t)) {
                  setFecha(t)
                  setFechaManual(true)
                }
              }}
            />
          </div>
        </div>
        {antes('precioUnitCent', 'moneda', 'fecha')}

        {esGasto && !verPromo && (
          <button type="button" className="enlace" onClick={() => setVerPromo(true)}>
            + Promo
          </button>
        )}

        {esGasto && verPromo && (
          <CamposPromo tipo={promoTipo} a={promoA} b={promoB} onTipo={elegirPromo} onA={setPromoA} onB={setPromoB} />
        )}

        {esGasto && (cant > 1 || promo) && precioCent !== null && (
          <p className="calculo">
            Total {fmt(contado, moneda)}
            {cant > 1 && <>, {fmt(Math.round(contado / cant), moneda)} c/u</>}
            {ahorro > 0 && <>, ahorrás {fmt(ahorro, moneda)}</>}
          </p>
        )}
        {antes('promo', 'totalCent')}

        <div className="fila">
          <label className="campo crece">
            <select
              aria-label="Categoría"
              value={categoriaId}
              onChange={(e) => {
                if (e.target.value === '+') return void agregarOpcion('categoria')
                setCategoriaId(e.target.value)
                setCategoriaManual(true)
              }}
            >
              <option value="">Categoría</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
              <option value="+">+ Nueva…</option>
            </select>
          </label>
          {!esGasto && (
            <MetodoCuotas
              etiqueta="Medio de cobro"
              sinEtiqueta
              vacio="Medio de cobro"
              metodos={metodos}
              metodoId={metodoPagoId}
              onMetodo={setMetodoPagoId}
              onNuevoMetodo={() => void agregarOpcion('metodo')}
            />
          )}
        </div>
        {antes('categoria')}

        <div className="campo">
          <div className="fila">
            <label className="campo crece">
              <div className="con-boton">
                <input
                  value={lugar}
                  placeholder={esGasto ? 'Almacén de Juan' : 'Origen, ej. Empresa'}
                  aria-label={esGasto ? 'Lugar de compra' : 'Origen'}
                  autoComplete="off"
                  onChange={(e) => setLugar(e.target.value)}
                  onBlur={() => autocompletar(descripcion, marca, lugar, false)}
                />
                {lugar && (
                  <button
                    type="button"
                    className="icono"
                    aria-label="Vaciar lugar"
                    onClick={() => {
                      setLugar('')
                      setUbicacion(undefined)
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </label>
            {esGasto && !correccion && (
              <div className="campo ubicacion">
                {ubicacion ? (
                  <div className="con-boton">
                    <a
                      className="ubicado"
                      href={linkMapa(ubicacion)}
                      target="_blank"
                      rel="noreferrer"
                      title="Ver en el mapa"
                    >
                      ±{ubicacion.precision} m
                    </a>
                    <button
                      type="button"
                      className="icono"
                      aria-label="Quitar ubicación"
                      onClick={() => setUbicacion(undefined)}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button type="button" className="ubicar" disabled={ubicando} onClick={ubicar}>
                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" fill="none" stroke="currentColor" strokeWidth="2.5" />
                      <circle cx="12" cy="9" r="2.5" fill="currentColor" />
                    </svg>
                    {ubicando ? 'Buscando…' : 'Ubicar'}
                  </button>
                )}
              </div>
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
        </div>
        {antes('lugar')}
        {esGasto && !correccion && (
          <p className="nota">
            {editando
              ? 'Método de pago, cuotas, pagador y tu parte se cambian tocando el Total de la compra.'
              : 'Método de pago, cuotas, pagador y tu parte se eligen al tocar Pagar.'}
          </p>
        )}

        {/* Al cargar se omiten: se eligen en Pagar. Al editar un gasto se pueden corregir acá. */}

        <label className="campo">
          <input
            value={comentario}
            placeholder="Comentario - Opcional"
            aria-label="Comentario"
            autoComplete="off"
            onChange={(e) => setComentario(e.target.value)}
          />
        </label>
        {antes('comentario')}

        {error && <p className="error">{error}</p>}

        {(editando || correccion) && <HistorialMov editando={editando} correccion={correccion} yo={nombreYo} categorias={categorias} />}

        {editando && onBorrar && (
          <button type="button" className="peligro" onClick={() => onBorrar(editando)}>
            Borrar movimiento
          </button>
        )}
        {prefill?.agregadoPor && <p className="nota agregado-por">Lo agregó a la lista {prefill.agregadoPor}</p>}
      </div>

      <footer className="acciones">
        {correccion ? (
          <button type="submit" className="primario" disabled={guardando}>
            Guardar corrección
          </button>
        ) : editando ? (
          <button type="button" className="primario" disabled={guardando} onClick={() => guardar(false)}>
            Guardar cambios
          </button>
        ) : contexto === 'lista' ? (
          <button type="submit" className="primario" disabled={guardando}>
            Guardar
          </button>
        ) : (
          <>
            <button type="submit" className="secundario" disabled={guardando}>
              Guardar y agregar otro
            </button>
            <button type="button" className="primario" disabled={guardando} onClick={() => guardar(false)}>
              Guardar
            </button>
          </>
        )}
      </footer>
    </form>
  )
}
