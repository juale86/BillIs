import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  arrayRemove,
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { normalizar } from '../db/db'
import type { Moneda } from '../db/types'
import { firebaseConfig } from './firebase-config'

/**
 * Listas de compras compartidas (Firestore + inicio de sesión con Google).
 *
 * listas/{listaId}
 *   nombre, duenoUid, duenoNombre, creadoEn, cerrada, cerradaEn
 *   miembros: { uid: nombre }, miembroUids: [uid]   ← quién ve y edita
 *   pendientes: { uid: nombre }                     ← pidieron unirse, falta aprobar
 * listas/{listaId}/items/{itemId}
 *   nombre, cantidad, marca, comprado, agregadoPorUid, agregadoPor,
 *   compradoPorUid, compradoPor, montoCent, moneda, creadoEn, modificadoEn, orden
 *
 * Permisos (firestore.rules): el dueño renombra, cierra, borra y aprueba;
 * los miembros agregan, compran y quitan sus propios ítems.
 */
export interface Lista {
  id: string
  nombre: string
  duenoUid: string
  duenoNombre: string
  miembros: Record<string, string>
  miembroUids: string[]
  pendientes: Record<string, string>
  cerrada: boolean
  cerradaEn: number | null
  creadoEn: number
}

export interface ItemLista {
  id: string
  nombre: string
  cantidad: string | null
  marca: string | null
  comprado: boolean
  agregadoPorUid: string
  agregadoPor: string
  compradoPorUid: string | null
  compradoPor: string | null
  /** Lo que se pagó (total del gasto), visible para todos. null = comprado sin gasto. */
  montoCent: number | null
  moneda: Moneda | null
  creadoEn: number
  modificadoEn: number
  /** Posición entre los pendientes (se ordena de menor a mayor). Los ítems viejos no lo tienen: usan creadoEn. */
  orden?: number
}

/** Posición de un ítem en la lista de pendientes. */
export const ordenDe = (it: ItemLista) => it.orden ?? it.creadoEn

export const sincronizacionDisponible = firebaseConfig !== null
const EMULADORES = import.meta.env.VITE_EMULADORES === '1'

let _app: FirebaseApp | null = null
let _fs: Firestore | null = null
let _auth: Auth | null = null

function app(): FirebaseApp {
  if (!firebaseConfig) throw new Error('Sincronización sin configurar')
  return (_app ??= initializeApp(firebaseConfig))
}

function fs(): Firestore {
  if (!_fs) {
    // Caché persistente: la lista funciona sin señal y se sincroniza al volver.
    _fs = initializeFirestore(app(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
    if (EMULADORES) connectFirestoreEmulator(_fs, '127.0.0.1', 8080)
  }
  return _fs
}

function auth(): Auth {
  if (!_auth) {
    _auth = getAuth(app())
    if (EMULADORES) connectAuthEmulator(_auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  }
  return _auth
}

function uidActual(): string {
  const u = auth().currentUser
  if (!u) throw new Error('Iniciá sesión para usar las listas')
  return u.uid
}

// ---------- Sesión ----------

export function useUsuario(): { usuario: User | null; cargando: boolean } {
  const [estado, setEstado] = useState<{ usuario: User | null; cargando: boolean }>({ usuario: null, cargando: true })
  useEffect(() => onAuthStateChanged(auth(), (usuario) => setEstado({ usuario, cargando: false })), [])
  return estado
}

export async function iniciarSesion() {
  const proveedor = new GoogleAuthProvider()
  proveedor.setCustomParameters({ prompt: 'select_account' })
  try {
    await signInWithPopup(auth(), proveedor)
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment')
      await signInWithRedirect(auth(), proveedor)
    else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') throw e
  }
}

export const cerrarSesionGoogle = () => signOut(auth())

// ---------- Listas ----------

const listas = () => collection(fs(), 'listas')
const refLista = (id: string) => doc(fs(), 'listas', id)
const items = (listaId: string) => collection(fs(), 'listas', listaId, 'items')
const desdeDoc = <T>(id: string, d: unknown) => ({ id, ...(d as object) }) as T

/** Listas en las que sos miembro (abiertas y cerradas), en vivo. */
export function useMisListas(uid: string | null): { listas: Lista[]; cargando: boolean; error: string | null } {
  const [estado, setEstado] = useState<{ listas: Lista[]; cargando: boolean; error: string | null }>({
    listas: [],
    cargando: true,
    error: null,
  })
  useEffect(() => {
    if (!uid) return
    return onSnapshot(
      query(listas(), where('miembroUids', 'array-contains', uid)),
      (s) =>
        setEstado({
          cargando: false,
          error: null,
          listas: s.docs.map((d) => desdeDoc<Lista>(d.id, d.data())).sort((a, b) => a.creadoEn - b.creadoEn),
        }),
      (e) => setEstado({ listas: [], cargando: false, error: e.message }),
    )
  }, [uid])
  return estado
}

/** Una lista puntual (para invitaciones), en vivo. undefined = cargando, null = no existe. */
export function useListaDoc(id: string | null): Lista | null | undefined {
  const [lista, setLista] = useState<Lista | null | undefined>(undefined)
  useEffect(() => {
    if (!id) return
    return onSnapshot(
      refLista(id),
      (s) => setLista(s.exists() ? desdeDoc<Lista>(s.id, s.data()) : null),
      () => setLista(null),
    )
  }, [id])
  return lista
}

export async function crearLista(
  nombre: string,
  quien: string,
  miembros?: Record<string, string>,
): Promise<string> {
  const uid = uidActual()
  const todos = { ...(miembros ?? {}), [uid]: quien }
  const ref = doc(listas())
  await setDoc(ref, {
    nombre: nombre.trim().slice(0, 60),
    duenoUid: uid,
    duenoNombre: quien,
    miembros: todos,
    miembroUids: Object.keys(todos),
    pendientes: {},
    cerrada: false,
    cerradaEn: null,
    creadoEn: Date.now(),
  })
  return ref.id
}

export const pedirUnirse = (id: string, quien: string) =>
  updateDoc(refLista(id), { [`pendientes.${uidActual()}`]: quien.slice(0, 60) })

export const cancelarPedido = (id: string) => updateDoc(refLista(id), { [`pendientes.${uidActual()}`]: deleteField() })

export const aprobar = (l: Lista, uid: string) =>
  updateDoc(refLista(l.id), {
    [`miembros.${uid}`]: l.pendientes[uid] ?? 'Invitado',
    miembroUids: arrayUnion(uid),
    [`pendientes.${uid}`]: deleteField(),
  })

export const rechazar = (l: Lista, uid: string) => updateDoc(refLista(l.id), { [`pendientes.${uid}`]: deleteField() })

/** Saca a un miembro (dueño) o te saca a vos (salir de la lista). */
export const sacarMiembro = (l: Lista, uid: string) =>
  updateDoc(refLista(l.id), { [`miembros.${uid}`]: deleteField(), miembroUids: arrayRemove(uid) })

export const salirDeLista = (l: Lista) => sacarMiembro(l, uidActual())

export const renombrarLista = (l: Lista, nombre: string) => updateDoc(refLista(l.id), { nombre: nombre.trim().slice(0, 60) })

export const cerrarLista = (l: Lista) => updateDoc(refLista(l.id), { cerrada: true, cerradaEn: Date.now() })

export async function borrarLista(l: Lista) {
  const b = writeBatch(fs())
  for (const d of (await getDocs(items(l.id))).docs) b.delete(d.ref)
  b.delete(refLista(l.id))
  await b.commit()
}

/** Abre una lista nueva con los mismos miembros y los ítems que quedaron pendientes. */
export async function nuevaConPendientes(l: Lista, pendientes: ItemLista[], quien: string): Promise<string> {
  const id = await crearLista(l.nombre, quien, l.miembros)
  const b = writeBatch(fs())
  const ahora = Date.now()
  for (const it of pendientes) {
    const { id: _viejo, ...datos } = it
    void _viejo
    b.set(doc(items(id)), { ...datos, comprado: false, compradoPorUid: null, compradoPor: null, montoCent: null, moneda: null, modificadoEn: ahora })
  }
  await b.commit()
  return id
}

export const esDueno = (l: Lista, uid: string) => l.duenoUid === uid

export const linkLista = (listaId: string) => `${location.origin}${import.meta.env.BASE_URL}?lista=${listaId}`

/** Acepta el link completo o solo el código. */
export function extraerListaId(texto: string): string | null {
  const t = texto.trim()
  const m = t.match(/[?&]lista=([A-Za-z0-9]{20,})/)
  if (m) return m[1]
  return /^[A-Za-z0-9]{20,}$/.test(t) ? t : null
}

// ---------- Ítems ----------

export function agregarItem(listaId: string, datos: { nombre: string; cantidad: string; marca: string }, quien: string) {
  const ahora = Date.now()
  const item: Omit<ItemLista, 'id'> = {
    nombre: datos.nombre.trim().slice(0, 100),
    cantidad: datos.cantidad.trim().slice(0, 30) || null,
    marca: datos.marca.trim().slice(0, 60) || null,
    comprado: false,
    agregadoPorUid: uidActual(),
    agregadoPor: quien.slice(0, 60),
    compradoPorUid: null,
    compradoPor: null,
    montoCent: null,
    moneda: null,
    creadoEn: ahora,
    modificadoEn: ahora,
    orden: ahora,
  }
  // Sin await: con caché local se ve al instante y se sube cuando hay señal.
  return setDoc(doc(items(listaId)), item)
}

/** Marca comprado. montoCent null = "ya comprado, sin gasto". */
export const comprarItem = (listaId: string, itemId: string, quien: string, montoCent: number | null, moneda: Moneda | null) =>
  updateDoc(doc(items(listaId), itemId), {
    comprado: true,
    compradoPorUid: uidActual(),
    compradoPor: quien.slice(0, 60),
    montoCent,
    moneda,
    modificadoEn: Date.now(),
  })

export const actualizarMonto = (listaId: string, itemId: string, montoCent: number, moneda: Moneda) =>
  updateDoc(doc(items(listaId), itemId), { montoCent, moneda, modificadoEn: Date.now() })

export const volverAPendiente = (listaId: string, itemId: string) =>
  updateDoc(doc(items(listaId), itemId), {
    comprado: false,
    compradoPorUid: null,
    compradoPor: null,
    montoCent: null,
    moneda: null,
    modificadoEn: Date.now(),
  })

/** Cambia la posición de un ítem (arrastrándolo en la lista). */
export const moverItem = (listaId: string, itemId: string, orden: number) =>
  updateDoc(doc(items(listaId), itemId), { orden, modificadoEn: Date.now() })

export const borrarItem = (listaId: string, itemId: string) => deleteDoc(doc(items(listaId), itemId))

export interface EstadoItems {
  items: ItemLista[]
  cargando: boolean
  error: string | null
  /** true si hay cambios propios que todavía no llegaron al servidor. */
  pendiente: boolean
}

export function useItems(listaId: string | null): EstadoItems {
  const [estado, setEstado] = useState<EstadoItems>({ items: [], cargando: true, error: null, pendiente: false })
  // Reintento: una lista recién creada (o recién aprobada) puede no estar aún en el servidor
  // cuando se abre, y Firestore corta la suscripción ante el primer rechazo.
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    if (!listaId) return
    let timer: number | undefined
    const off = onSnapshot(
      items(listaId),
      { includeMetadataChanges: true },
      (s) =>
        setEstado({
          cargando: false,
          error: null,
          pendiente: s.metadata.hasPendingWrites,
          items: s.docs.map((d) => desdeDoc<ItemLista>(d.id, d.data())),
        }),
      (e) => {
        if (intento < 5) timer = window.setTimeout(() => setIntento((i) => i + 1), 1000 * (intento + 1))
        else setEstado({ items: [], cargando: false, error: e.message, pendiente: false })
      },
    )
    return () => {
      off()
      clearTimeout(timer)
    }
  }, [listaId, intento])
  return estado
}

/** Total pagado por moneda de los ítems comprados. */
export function totales(lista: ItemLista[]): [Moneda, number][] {
  const t = new Map<Moneda, number>()
  for (const it of lista) if (it.comprado && it.montoCent !== null) t.set(it.moneda ?? 'ARS', (t.get(it.moneda ?? 'ARS') ?? 0) + it.montoCent)
  return [...t.entries()]
}

export interface FiltrosLista {
  texto: string
  estado: 'pendientes' | 'comprados' | null
  persona: string | null
}
export const SIN_FILTROS_LISTA: FiltrosLista = { texto: '', estado: null, persona: null }

export function filtrar(lista: ItemLista[], f: FiltrosLista): ItemLista[] {
  const q = normalizar(f.texto)
  return lista.filter(
    (it) =>
      (!q || normalizar(`${it.nombre} ${it.marca ?? ''}`).includes(q)) &&
      (f.estado === null || (f.estado === 'comprados') === it.comprado) &&
      (f.persona === null || it.agregadoPor === f.persona),
  )
}
