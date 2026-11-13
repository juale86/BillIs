import { useEffect, useRef } from 'react'

/**
 * Un ref que siempre tiene la última versión de `valor` (por ejemplo, una función que lee el
 * estado). Sirve para escuchar eventos con una sola suscripción sin quedarse con datos viejos.
 */
export function useUltimo<T>(valor: T) {
  const ref = useRef(valor)
  useEffect(() => {
    ref.current = valor
  })
  return ref
}
