import { normalizar } from '../db/db'

export interface Grupo {
  id: string
  /** Nombre corto, para el chip de cada ítem. */
  corto: string
  nombre: string
}

/** Grupos de compra que trae la app, en el orden en que se recorre el súper. */
const GRUPOS_BASE = [
  { id: 'almacen', corto: 'Almacén', nombre: 'Almacén (Secos y Conservas)' },
  { id: 'bebidas', corto: 'Bebidas', nombre: 'Bebidas' },
  { id: 'frescos', corto: 'Frescos', nombre: 'Frescos (Lácteos, Fiambrería y Masas)' },
  { id: 'carniceria', corto: 'Carnicería', nombre: 'Carnicería y Pescadería' },
  { id: 'verduleria', corto: 'Verdulería', nombre: 'Verdulería (Frutas y Verduras)' },
  { id: 'congelados', corto: 'Congelados', nombre: 'Congelados' },
  { id: 'mascotas', corto: 'Mascotas', nombre: 'Mascotas' },
  { id: 'limpieza', corto: 'Limpieza', nombre: 'Limpieza y Perfumería' },
  { id: 'herramientas', corto: 'Herramientas', nombre: 'Herramientas' },
] as const satisfies readonly Grupo[]

type GrupoId = (typeof GRUPOS_BASE)[number]['id']

/** Clave del ajuste con los grupos de este teléfono (renombrados, borrados o agregados). */
export const CLAVE_GRUPOS = 'gruposCompra'

/** Los grupos guardados, o los de la app si nunca se tocaron. */
export const gruposDesde = (guardados: Grupo[] | null | undefined): Grupo[] => guardados ?? [...GRUPOS_BASE]

export const grupoPorId = (grupos: Grupo[], id: string | null | undefined) => grupos.find((g) => g.id === id)

/** Id para un grupo agregado a mano. */
export const nuevoIdGrupo = () => `g${Date.now().toString(36)}`

/**
 * Palabras que delatan el grupo. Coinciden con el comienzo de una palabra del producto
 * ("galletit" → "galletitas"); si varias coinciden, gana la más larga ("leche en polvo" antes que "leche").
 */
const PALABRAS: Record<GrupoId, string[]> = {
  almacen: [
    'arroz', 'fideo', 'tallarin', 'spaghetti', 'harina', 'azucar', 'sal', 'aceite', 'vinagre', 'yerba', 'cafe', 'te ',
    'mate cocido', 'cacao', 'galletit', 'bizcocho', 'tostada', 'pan rallado', 'rebozador', 'polenta', 'lenteja',
    'garbanzo', 'poroto', 'arveja', 'choclo en lata', 'atun', 'caballa', 'sardina', 'pure de tomate', 'tomate triturado',
    'salsa', 'mayonesa', 'ketchup', 'mostaza', 'mermelada', 'miel', 'cereal', 'avena', 'granola', 'leche en polvo',
    'caldo', 'sopa', 'condimento', 'oregano', 'pimienta', 'especia', 'snack', 'papas fritas', 'mani', 'nuez',
    'almendra', 'chocolate', 'alfajor', 'golosina', 'caramelo', 'chicle', 'turron', 'bizcochuelo', 'gelatina',
    'flan en polvo', 'polvo de hornear', 'levadura seca', 'esencia', 'conserva', 'aceituna', 'durazno en almibar',
    'edulcorante', 'premezcla', 'pochoclo', 'maicena', 'fecula',
  ],
  bebidas: [
    'agua', 'gaseosa', 'coca', 'sprite', 'fanta', 'pepsi', 'seven up', '7up', 'soda', 'jugo', 'cerveza', 'birra',
    'vino', 'fernet', 'aperitivo', 'vermut', 'whisky', 'vodka', 'gin', 'ron', 'champagne', 'espumante', 'sidra',
    'energizante', 'isotonica', 'gatorade', 'powerade', 'tonica', 'licor', 'amargo', 'speed',
  ],
  frescos: [
    'leche', 'yogur', 'yogurt', 'queso', 'manteca', 'crema', 'dulce de leche', 'ricota', 'muzzarella', 'mozzarella',
    'jamon', 'salame', 'mortadela', 'fiambre', 'salchich', 'paleta', 'bondiola', 'lomito', 'huevo', 'tapa de empanada',
    'tapas de empanada', 'tapa de tarta', 'tapas de tarta', 'masa', 'pascualina', 'pan', 'pan lactal', 'facturas',
    'medialuna', 'tortilla', 'tofu', 'postre', 'flan', 'levadura fresca', 'margarina', 'queso crema', 'casancrem',
    'ravioles', 'noquis', 'sorrentinos', 'pasta fresca',
  ],
  carniceria: [
    'carne', 'asado', 'vacio', 'matambre', 'nalga', 'peceto', 'cuadrada', 'bola de lomo', 'lomo', 'colita', 'entraña',
    'entrana', 'molida', 'picada', 'milanesa', 'bife', 'costilla', 'chorizo', 'morcilla', 'chinchulin', 'molleja',
    'pollo', 'pechuga', 'pata muslo', 'muslo', 'ala de pollo', 'cerdo', 'pechito', 'carre', 'cordero', 'pescado',
    'merluza', 'salmon', 'filet', 'langostino', 'calamar', 'mariscos', 'osobuco', 'roast beef', 'tapa de asado',
  ],
  verduleria: [
    'papa', 'batata', 'cebolla', 'ajo', 'tomate', 'lechuga', 'zanahoria', 'zapallo', 'zapallito', 'calabaza',
    'morron', 'pimiento', 'berenjena', 'pepino', 'acelga', 'espinaca', 'rucula', 'repollo', 'brocoli', 'coliflor',
    'choclo', 'remolacha', 'apio', 'puerro', 'verdeo', 'perejil', 'albahaca', 'cilantro', 'palta', 'limon', 'banana',
    'manzana', 'naranja', 'mandarina', 'pera', 'durazno', 'ciruela', 'uva', 'frutilla', 'kiwi', 'anana', 'melon',
    'sandia', 'pomelo', 'mango', 'cereza', 'arandano', 'fruta', 'verdura', 'hongo', 'champinon', 'jengibre',
  ],
  congelados: [
    'helado', 'congelad', 'hamburguesa', 'nuggets', 'bastones', 'papas congeladas', 'pizza congelada', 'empanadas congeladas',
    'vegetales congelados', 'hielo', 'patitas', 'medallon', 'formitas', 'croqueta',
  ],
  mascotas: [
    'alimento para perro', 'alimento para gato', 'balanceado', 'dog chow', 'cat chow', 'pedigree', 'whiskas', 'excellent',
    'piedras sanitarias', 'arena para gato', 'perro', 'gato', 'mascota', 'pipeta', 'antipulga', 'collar',
  ],
  limpieza: [
    'lavandina', 'detergente', 'jabon', 'jabon en polvo', 'suavizante', 'limpiador', 'desengrasante', 'cif', 'mr musculo',
    'virulana', 'esponja', 'trapo', 'rejilla', 'escoba', 'secador', 'balde', 'bolsas de residuo', 'bolsa de residuo',
    'papel higienico', 'rollo de cocina', 'servilleta', 'panuelo', 'desodorante', 'shampoo', 'champu', 'acondicionador',
    'crema de enjuague', 'pasta dental', 'dentifrico', 'cepillo de dientes', 'hilo dental', 'enjuague bucal',
    'afeitadora', 'maquinita', 'espuma de afeitar', 'toallita', 'toalla femenina', 'tampon', 'protector diario',
    'panal', 'algodon', 'hisopo', 'alcohol', 'alcohol en gel', 'repelente', 'insecticida', 'raid', 'fuyi',
    'perfume', 'colonia', 'protector solar', 'crema de manos', 'quitamanchas', 'blem', 'lustramuebles', 'aromatizante',
    'glade', 'poett', 'pato', 'lysoform', 'skip', 'ariel', 'ala ', 'magistral', 'ayudin', 'procenex', 'film', 'papel aluminio',
  ],
  herramientas: [
    'herramienta', 'destornillador', 'martillo', 'pinza', 'alicate', 'llave inglesa', 'llave francesa', 'llave allen',
    'taladro', 'mecha', 'clavo', 'tornillo', 'tarugo', 'tuerca', 'arandela', 'bulon', 'cinta aisladora', 'cinta de embalar',
    'cinta metrica', 'cinta doble faz', 'cinta de papel', 'pegamento', 'poxipol', 'la gotita', 'silicona', 'precinto',
    'lamparita', 'lampara', 'foco', 'pila', 'bateria', 'linterna', 'alargue', 'zapatilla electrica', 'enchufe', 'adaptador',
    'cable', 'lija', 'pincel', 'rodillo', 'pintura', 'serrucho', 'cuter', 'trincheta', 'candado', 'manguera',
  ],
}

// Palabras ordenadas de más larga a más corta, así la más específica gana.
const INDICE: [string, GrupoId][] = (Object.entries(PALABRAS) as [GrupoId, string[]][])
  // Un espacio al final ("te ") pide la palabra entera, para no confundir "té" con "tenedor".
  .flatMap(([g, ps]) => ps.map((p) => [normalizar(p) + (p.endsWith(' ') ? ' ' : ''), g] as [string, GrupoId]))
  .sort((a, b) => b[0].length - a[0].length)

/** Adivina el grupo por las palabras del nombre (y la marca), entre los grupos que siguen existiendo. */
function adivinarGrupo(nombre: string, marca: string, grupos: Grupo[]): string | null {
  const texto = ` ${normalizar(`${nombre} ${marca}`)} `
  for (const [palabra, g] of INDICE) if (texto.includes(` ${palabra}`) && grupoPorId(grupos, g)) return g
  return null
}

/**
 * Grupo sugerido para un producto: primero lo que ya se eligió antes para ese nombre
 * (en este teléfono o en la lista), y si no, el diccionario.
 */
export function sugerirGrupo(
  nombre: string,
  marca: string,
  aprendidos: Record<string, string>,
  enLista: { nombre: string; grupo?: string | null }[],
  grupos: Grupo[],
): string | null {
  const n = normalizar(nombre)
  if (!n) return null
  const guardado = aprendidos[n]
  if (grupoPorId(grupos, guardado)) return guardado
  const otro = enLista.find((it) => it.grupo && normalizar(it.nombre) === n)
  if (grupoPorId(grupos, otro?.grupo)) return otro!.grupo!
  return adivinarGrupo(nombre, marca, grupos)
}
