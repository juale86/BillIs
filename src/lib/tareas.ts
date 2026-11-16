import { deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { coleccionTareas, desdeDoc, refLista, uidActual, useAlVolver, type Lista, type Subseccion } from './listaCompras'

/**
 * Tareas compartidas. Cada sección (ej. "Viaje") es una lista con tipo 'tareas': se comparte, se aprueba
 * a quien pide unirse y se dan permisos igual que en las de compras ("Tildar" en vez de "Comprar").
 * Una sección sin otros miembros la ve solo quien la creó.
 *
 * listas/{listaId}.subsecciones: [{ id, nombre }]  ← en orden; las corrige el dueño
 * listas/{listaId}/tareas/{tareaId}
 *   texto, hecha, hechaPorUid, hechaPor, hechaEn, conclusion, agregadoPorUid, agregadoPor,
 *   responsableUid, responsable, vence ('AAAA-MM-DD'), nota, subseccion, creadoEn, modificadoEn
 */
export interface Tarea {
  id: string
  texto: string
  hecha: boolean
  hechaPorUid: string | null
  hechaPor: string | null
  hechaEn: number | null
  /** Cómo terminó: se escribe al tildarla. Ausente en las tareas viejas. */
  conclusion?: string | null
  agregadoPorUid: string
  agregadoPor: string
  /** Quién se encarga (un miembro). */
  responsableUid: string | null
  responsable: string | null
  /** Fecha límite, sin hora. */
  vence: string | null
  nota: string | null
  /** Id de la subsección; null o una que ya no existe = sin subsección. */
  subseccion: string | null
  creadoEn: number
  modificadoEn: number
}

export interface DatosTarea {
  texto: string
  subseccion: string | null
  responsableUid: string | null
  responsable: string | null
  vence: string | null
  nota: string | null
}

const limpiar = (d: DatosTarea) => ({
  texto: d.texto.trim().slice(0, 200),
  subseccion: d.subseccion,
  responsableUid: d.responsableUid,
  responsable: d.responsable?.slice(0, 60) ?? null,
  vence: d.vence || null,
  nota: d.nota?.trim().slice(0, 1000) || null,
})

/** Agrega una tarea (sin esperar a la señal: con la caché local se ve al instante). */
export function agregarTarea(listaId: string, d: DatosTarea, quien: string): Promise<void> {
  const ahora = Date.now()
  const t: Omit<Tarea, 'id'> = {
    ...limpiar(d),
    hecha: false,
    hechaPorUid: null,
    hechaPor: null,
    hechaEn: null,
    agregadoPorUid: uidActual(),
    agregadoPor: quien.slice(0, 60),
    creadoEn: ahora,
    modificadoEn: ahora,
  }
  return setDoc(doc(coleccionTareas(listaId)), t)
}

const limpiarConclusion = (c: string | null | undefined) => c?.trim().slice(0, 1000) || null

/** Al tildarla se guarda la conclusión; al destildarla se conserva, por si se vuelve a tildar. */
export const tildarTarea = (listaId: string, t: Tarea, hecha: boolean, quien: string, conclusion?: string | null) =>
  updateDoc(doc(coleccionTareas(listaId), t.id), {
    hecha,
    hechaPorUid: hecha ? uidActual() : null,
    hechaPor: hecha ? quien.slice(0, 60) : null,
    hechaEn: hecha ? Date.now() : null,
    ...(hecha ? { conclusion: limpiarConclusion(conclusion) } : {}),
    modificadoEn: Date.now(),
  })

/** Corrige la conclusión de una tarea hecha (quien la hizo, o con permiso de editarla). */
export const guardarConclusion = (listaId: string, id: string, conclusion: string) =>
  updateDoc(doc(coleccionTareas(listaId), id), { conclusion: limpiarConclusion(conclusion), modificadoEn: Date.now() })

export const editarTarea = (listaId: string, id: string, d: DatosTarea) =>
  updateDoc(doc(coleccionTareas(listaId), id), { ...limpiar(d), modificadoEn: Date.now() })

export const borrarTarea = (listaId: string, id: string) => deleteDoc(doc(coleccionTareas(listaId), id))

/** Vuelve a crear una tarea borrada, igual que estaba (Deshacer). */
export function restaurarTarea(listaId: string, t: Tarea) {
  const { id, ...datos } = t
  return setDoc(doc(coleccionTareas(listaId), id), datos)
}

/** El dueño agrega, renombra, ordena o borra subsecciones. */
export const guardarSubsecciones = (l: Lista, subs: Subseccion[]) => updateDoc(refLista(l.id), { subsecciones: subs })

export const nuevoIdSubseccion = () => Math.random().toString(36).slice(2, 10)

/** Las tareas de varias secciones, en vivo. cargando: hasta que respondieron todas. */
export function useTareas(listaIds: string[]): { porLista: Record<string, Tarea[]>; cargando: boolean } {
  const [porLista, setPorLista] = useState<Record<string, Tarea[]>>({})
  // Reintento: una sección recién creada (o recién aprobada) puede no estar aún en el servidor
  // cuando se abre, y Firestore corta la suscripción ante el primer rechazo.
  // Se cuenta por cada conjunto de secciones y cada vuelta del fondo: al cambiar, vuelve a probar.
  const vuelta = useAlVolver()
  const clave = listaIds.join(',')
  const [reintento, setReintento] = useState({ de: '', n: 0 })
  const de = `${clave}|${vuelta}`
  const intento = reintento.de === de ? reintento.n : 0
  useEffect(() => {
    if (!clave) return
    let timer: number | undefined
    const offs = clave.split(',').map((id) =>
      onSnapshot(
        coleccionTareas(id),
        (s) => setPorLista((prev) => ({ ...prev, [id]: s.docs.map((d) => desdeDoc<Tarea>(d.id, d.data())) })),
        () => {
          setPorLista((prev) => (id in prev ? prev : { ...prev, [id]: [] }))
          if (intento < 6 && timer === undefined) timer = window.setTimeout(() => setReintento({ de, n: intento + 1 }), 800 * (intento + 1))
        },
      ),
    )
    return () => {
      offs.forEach((off) => off())
      clearTimeout(timer)
    }
  }, [clave, intento, de])
  const cargando = listaIds.some((id) => !(id in porLista))
  return { porLista, cargando }
}

// ---------- Fechas límite ----------

/** Hoy como 'AAAA-MM-DD' (hora local). */
export function hoyISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** '2026-11-20' → "vie 20/11" */
export function fmtVence(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  const dia = new Date(a, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')
  return `${dia} ${d}/${m}`
}

/** La última que se agregó, arriba. */
export const masNuevaPrimero = (a: Tarea, b: Tarea) => b.creadoEn - a.creadoEn
