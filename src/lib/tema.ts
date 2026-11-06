export type Tema = 'auto' | 'claro' | 'oscuro'

const CLAVE = 'billis.tema'

export function leerTema(): Tema {
  try {
    const t = localStorage.getItem(CLAVE)
    return t === 'claro' || t === 'oscuro' ? t : 'auto'
  } catch {
    return 'auto'
  }
}

/** Aplica el tema al <html>; 'auto' sigue al sistema. */
export function aplicarTema(t: Tema) {
  const html = document.documentElement
  if (t === 'auto') html.removeAttribute('data-tema')
  else html.dataset.tema = t
  const oscuro = t === 'oscuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#14161b' : '#f5f6f4')
}

export function guardarTema(t: Tema) {
  try {
    if (t === 'auto') localStorage.removeItem(CLAVE)
    else localStorage.setItem(CLAVE, t)
  } catch {
    /* sin almacenamiento: dura hasta cerrar */
  }
  aplicarTema(t)
}
