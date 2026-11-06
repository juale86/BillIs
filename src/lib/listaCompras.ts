import { initializeApp } from 'firebase/app'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { normalizar } from '../db/db'
import { firebaseConfig } from './firebase-config'

/**
 * Lista de compras compartida (Firestore).
 * listas/{listaId}            { nombre, creadoEn }
 * listas/{listaId}/items/{id} { nombre, cantidad, marca, comprado, agregadoPor, compradoPor, creadoEn, modificadoEn }
 * El listaId es largo y al azar: tenerlo es el permiso para ver y editar la lista.
 */
export interface ItemLista {
  id: string
  nombre: string
  cantidad: string | null
  marca: string | null
  comprado: boolean
  agregadoPor: string
  compradoPor: string | null
  creadoEn: number
  modificadoEn: number
}

export const sincronizacionDisponible = firebaseConfig !== null

let _fs: Firestore | null = null
function fs(): Firestore {
  if (!firebaseConfig) throw new Error('Sincronización sin configurar')
  if (!_fs) {
    // Caché persistente: la lista funciona sin señal y se sincroniza al volver.
    _fs = initializeFirestore(initializeApp(firebaseConfig), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  }
  return _fs
}

const items = (listaId: string) => collection(fs(), 'listas', listaId, 'items')

export async function crearLista(nombre: string): Promise<string> {
  const ref = doc(collection(fs(), 'listas'))
  await setDoc(ref, { nombre, creadoEn: Date.now() })
  return ref.id
}

/** Acepta el link completo o solo el código. */
export function extraerListaId(texto: string): string | null {
  const t = texto.trim()
  const m = t.match(/[?&]lista=([A-Za-z0-9]{20,})/)
  if (m) return m[1]
  return /^[A-Za-z0-9]{20,}$/.test(t) ? t : null
}

export async function existeLista(listaId: string): Promise<boolean> {
  return (await getDoc(doc(fs(), 'listas', listaId))).exists()
}

export const linkLista = (listaId: string) => `${location.origin}${import.meta.env.BASE_URL}?lista=${listaId}`

export function agregarItem(listaId: string, datos: { nombre: string; cantidad: string; marca: string }, quien: string) {
  const ref = doc(items(listaId))
  const ahora = Date.now()
  const item: Omit<ItemLista, 'id'> = {
    nombre: datos.nombre.trim().slice(0, 100),
    cantidad: datos.cantidad.trim().slice(0, 30) || null,
    marca: datos.marca.trim().slice(0, 60) || null,
    comprado: false,
    agregadoPor: quien.slice(0, 60),
    compradoPor: null,
    creadoEn: ahora,
    modificadoEn: ahora,
  }
  // Sin await: con caché local se ve al instante y se sube cuando hay señal.
  return setDoc(ref, item)
}

export function marcarComprado(listaId: string, item: ItemLista, comprado: boolean, quien: string) {
  return updateDoc(doc(items(listaId), item.id), {
    comprado,
    compradoPor: comprado ? quien.slice(0, 60) : null,
    modificadoEn: Date.now(),
  })
}

export const borrarItem = (listaId: string, item: ItemLista) => deleteDoc(doc(items(listaId), item.id))

export function limpiarComprados(listaId: string, lista: ItemLista[]) {
  const b = writeBatch(fs())
  for (const it of lista) if (it.comprado) b.delete(doc(items(listaId), it.id))
  return b.commit()
}

export interface EstadoLista {
  nombre: string
  items: ItemLista[]
  cargando: boolean
  error: string | null
  /** true si hay cambios propios que todavía no llegaron al servidor. */
  pendiente: boolean
}

/** Suscripción en vivo a la lista. */
export function useLista(listaId: string | null): EstadoLista {
  const [estado, setEstado] = useState<EstadoLista>({ nombre: '', items: [], cargando: true, error: null, pendiente: false })

  useEffect(() => {
    if (!listaId || !sincronizacionDisponible) return
    const offLista = onSnapshot(
      doc(fs(), 'listas', listaId),
      (s) => setEstado((e) => ({ ...e, nombre: (s.data()?.nombre as string) ?? 'Lista' })),
      (err) => setEstado((e) => ({ ...e, error: err.message, cargando: false })),
    )
    const offItems = onSnapshot(
      items(listaId),
      { includeMetadataChanges: true },
      (s) =>
        setEstado((e) => ({
          ...e,
          cargando: false,
          error: null,
          pendiente: s.metadata.hasPendingWrites,
          items: s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ItemLista, 'id'>) })),
        })),
      (err) => setEstado((e) => ({ ...e, error: err.message, cargando: false })),
    )
    return () => {
      offLista()
      offItems()
    }
  }, [listaId])

  return estado
}

export interface Filtros {
  texto: string
  estado: 'pendientes' | 'comprados' | null
  persona: string | null
}

export function filtrar(lista: ItemLista[], f: Filtros): ItemLista[] {
  const q = normalizar(f.texto)
  return lista.filter(
    (it) =>
      (!q || normalizar(`${it.nombre} ${it.marca ?? ''}`).includes(q)) &&
      (f.estado === null || (f.estado === 'comprados') === it.comprado) &&
      (f.persona === null || it.agregadoPor === f.persona),
  )
}
