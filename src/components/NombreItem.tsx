/** Producto con la marca y la cantidad pegadas a la derecha, en un solo renglón. */
export function NombreItem({ nombre, marca, cantidad }: { nombre: string; marca?: string | null; cantidad?: string }) {
  return (
    <span className="item-linea">
      <span className="mov-desc">{nombre}</span>
      {marca && <span className="item-marca">{marca}</span>}
      {cantidad && <span className="item-cant">{cantidad}</span>}
    </span>
  )
}
