import { useEffect } from 'react'
import { useCompradosDeOtros, type ItemLista } from '../lib/listaCompras'

export interface Otros {
  uid: string | null
  items: Record<string, ItemLista[]>
}

/**
 * Trae de las listas compartidas lo que compraron los demás y se lo pasa a Movimientos.
 * Va aparte (y se carga cuando hace falta) para no sumar Firebase a la pantalla principal.
 */
export default function CompradosDeOtros({ listaIds, onCambio }: { listaIds: string[]; onCambio: (o: Otros) => void }) {
  const otros = useCompradosDeOtros(listaIds)
  useEffect(() => onCambio(otros), [otros, onCambio])
  return null
}
