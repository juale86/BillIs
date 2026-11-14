# Informe 1.22.0: sin ventanas nativas y limpieza de código

Fecha: 13/11/2026. Abarca lo hecho desde la 1.21.2 (publicada) hasta la 1.22.0. La 1.21.3 no se llegó a publicar y quedó incluida en esta versión.

## Resumen

- Se sacaron todas las ventanas nativas del navegador: 7 `alert()`, 7 `confirm()` y 11 `prompt()`. Frenaban la pantalla y dejaban trabadas las pruebas automáticas. Ahora los errores salen en el aviso de abajo con un punto rojo, y las confirmaciones y los nombres se piden en el diálogo de la app.
- Una regla de lint (`no-alert`) impide que vuelvan.
- Se corrieron lint estricto, `knip` (código sin usar), `jscpd` (código duplicado), `/code-review` y `/simplify`, y se arregló lo que valía la pena.
- 27 archivos cambiados (+196 / −127 líneas).

## 1. Errores dentro de la app (en lugar de `alert`)

**Antes:** `alert('No se pudo…')`, una ventana del navegador que bloquea todo hasta tocar Aceptar.

**Ahora:** `avisarError('No se pudo…')` (`src/lib/avisos.ts`).
- Se ve en el mismo aviso negro de abajo, con un **punto rojo** adelante.
- Dura **7 s** y **se cierra tocándolo**.
- Queda **por encima de las hojas y menús** (z-index 25), así que un error dentro del menú de una lista se ve y se puede tocar, y **debajo de los diálogos** (30).
- `App` registra una sola vez quién lo muestra. Cualquier pantalla lo llama sin recibir props.

Lugares que lo usan:

| Dónde | Mensaje |
|---|---|
| Login con Google | No se pudo iniciar sesión: … |
| Invitación | No se pudo enviar el pedido |
| Ajustes → Respaldo | El archivo no es un respaldo de BillIs / No se pudo importar |
| Listas y Tareas | No se pudo crear la lista / la sección |
| Menús de listas y secciones (aceptar, rechazar, permisos, renombrar, borrar, salir) | No se pudo completar. Revisá la conexión. |
| Lista de compras | No se pudo mover / guardar / quitar / cambiar el grupo… (7 mensajes que antes salían como aviso común) |
| Tareas | No se pudo tildar / guardar / borrar / crear la subsección… (6 mensajes, ídem) |
| Pagar una compra con ítems de la lista | No se pudo actualizar la lista de compras |

## 2. Confirmar y pedir texto con el diálogo de la app (en lugar de `confirm` / `prompt`)

Nuevo `src/lib/dialogos.ts`, que se usa con `await`:

```ts
if (await confirmar({ titulo: '¿Sacar a Ana?', texto: '…', boton: 'Sacar', peligro: true })) …
const nombre = await pedirTexto({ titulo: 'Nueva lista', valor: 'Súper', boton: 'Crear' })  // null si cancela
```

- Lo dibuja `<Dialogos />` (`src/components/Dialogos.tsx`), montado una sola vez en `main.tsx`, así existe desde el arranque. Usa el `Modal` que ya tenía la app; se le agregó `inputMode` para el teclado numérico.
- Escape o tocar afuera cancela. Las acciones destructivas tienen el botón en **rojo**.
- Se muestra uno por vez. Si se abre otro, el anterior cuenta como cancelado, y cada diálogo arranca limpio.

Reemplazos (con títulos y textos más claros):

| Antes | Ahora |
|---|---|
| `confirm('Esto reemplaza TODOS los datos…')` | **¿Restaurar este respaldo?** · Restaurar (rojo) |
| `confirm('¿Sacar a Ana?')` | **¿Sacar a Ana?** · "Deja de ver la lista. Puede volver a pedir unirse con el link." |
| `confirm('¿Cerrar "Súper"? …')` | **¿Cerrar "Súper"?** · Cerrar |
| `confirm('¿Abrir una lista nueva con los N pendientes…')` (2 lugares) | **¿Abrir una lista nueva con los N pendientes?** · Abrir |
| `confirm('"Súper" tiene compras de otro día…')` | **¿Empezar una lista nueva?** · Empezar |
| `confirm('¿Borrar también el gasto de $…?')` | ídem, botón rojo, "Si no, el gasto queda en Movimientos." |
| `confirm('¿Borrar este pago de deuda?')` | ídem, botón rojo |
| `prompt('Nombre')` en Ajustes | **Nuevo método de pago** / **Nueva categoría de gasto** / **de ingreso** |
| `prompt('Nuevo nombre', …)` | **Renombrar "Crédito"**, con el nombre ya escrito |
| `prompt('Nombre del grupo')` | **Nuevo grupo** · "Por ejemplo Verdulería o Limpieza." |
| `prompt('Tu nombre')` | **Tu nombre** · Guardar |
| `prompt('Nombre de la lista', 'Súper')` | **Nueva lista** · Crear |
| `prompt('Pegá el link de la lista')` | **Unirme con un link** · Seguir |
| `prompt('Nuevo método de pago')` (formulario y Pagar) | ídem · Agregar |
| `prompt('¿Cuánto te pagó Ana?', …)` en Saldos | ídem, con **teclado numérico** · Anotar |

Regla nueva en `.oxlintrc.json`: `"no-alert": "error"`, que bloquea `alert`, `confirm` y `prompt`.

## 3. Lint estricto (`npx oxlint -W suspicious -W pedantic src`)

Arreglado:
- **Nombres que tapaban a otros** (`no-shadow`) en `Pagar.tsx` (`n`), `Lista.tsx` (`lista`), `Movimientos.tsx` (`g`) y `sugerencias.ts` (`c`). Se renombraron para que no se confundan al leer.
- **`return reject(...)` dentro de una promesa** en `ubicacion.ts`: se separó en `reject(...)` + `return`.

Se dejaron, porque no son problemas:
- `react-in-jsx-scope` (828): con React 19 no hace falta importar React.
- `require-unicode-regexp`, `max-lines`, `max-lines-per-function`, `no-negated-condition`: son de estilo. Los archivos grandes (`Lista.tsx` 967 líneas, `FormMovimiento.tsx` 932, `Tareas.tsx` 853) se podrían partir más adelante.
- `no-underscore-dangle` en `__APP_VERSION__` y en las variables internas de Firebase.
- `react(immutability)` en `tareas.ts`: falso positivo, el `timer` vive dentro del efecto.
- `react(purity)` (`Date.now`): los conocidos. Hay **uno más** (`Ajustes.tsx:32`), también falso positivo: `Date.now()` corre al tocar "Borrar", no al dibujar.

## 4. Código sin usar (`npx knip@5`)

- No había código muerto. Había **12 `export` de más**: constantes, funciones y tipos que se usan solo dentro de su archivo. Se les sacó el `export`: `OPERADORES`, `repartir`, `imputaciones`, `Resumen`, `COTIZACIONES_INICIALES`, `GRUPOS_BASE`, `adivinarGrupo`, `DIAS_AVISO`, `distancia`, `FiltroActivo`, `SesionCompra`, `PedidoDialogo`.
- Nuevo `knip.json`: le dice a knip que `pwa-assets.config.ts` y `globals.d.ts` sí se usan (eran falsos positivos). Ahora `npx knip@5` no informa nada.
- Ojo: `knip@6` marca además dos tipos en `db/types.ts`. Por eso `CLAUDE.md` indica `knip@5`.

## 5. Código duplicado (`npx jscpd src --min-lines 6 --min-tokens 60`)

Había 4 duplicados (0,53 % del código). Se unificaron 3:
- **Pie de los menús** (correo, "Cerrar sesión", "Listo"), igual en Listas y Tareas → `PieMenu` en `Compartir.tsx`.
- **Ayudante `accion`** de los menús, casi igual en Listas y Tareas → `accionConAviso` en `avisos.ts`, con su tipo `Accion` que usa `Miembros`.
- **Filas Renombrar / Borrar** de Ajustes (métodos, categorías y grupos) → `FilaEditable`.

Se dejó el de las promos del formulario (3x2 / N-ésima): tienen etiquetas distintas y unirlos no lo haría más claro.

## 6. `/code-review` (revisión de errores)

Encontró 9 cosas. Se arreglaron 7:
1. **El aviso de error quedaba detrás de los menús** (z-index 10 < 20): un error dentro del menú de una lista no se veía y, al tocarlo, se cerraba el menú. → z-index 25.
2. **Un diálogo nuevo heredaba el texto del anterior** si tenía el mismo título. → cada diálogo tiene su número propio.
3. **Si `<Dialogos />` no estaba montado**, todo contaba como "cancelar" sin mostrar nada (por ejemplo, durante la pantalla de bienvenida). → se monta en `main.tsx`, siempre presente.
4. **Si `<Dialogos />` se desmontaba con un diálogo abierto**, quien esperaba la respuesta quedaba colgado. → al desmontarse, cuenta como cancelado.
5. **La clase `.error` general se mezclaba con el aviso** (negrita). → la clase pasó a ser `toast-error`.
6. **Tocar el aviso de error no cortaba su temporizador.** → un solo `cerrarAviso` que lo corta (también lo usa Deshacer).
7. y 8. **La documentación** (DISEÑO y `CLAUDE.md`) todavía decía que quedaban `confirm` y `prompt` y no mencionaba `dialogos.ts`. → actualizada.

No se cambió en la 1.22.0 (**se arregló en la 1.22.1**, ver la sección 9):
9. Mientras está abierto "¿Borrar también el gasto?", el gasto puede cambiar, y al confirmar se usaban los datos de antes de preguntar.

## 7. `/simplify` (cuatro revisiones: reutilización, simplificación, eficiencia y profundidad)

Arreglado:
- **`App` tenía un `useRef` + efecto de más** para conectar los errores con el aviso. → se registra una vez, sin ref.
- **Dos mecanismos distintos para lo mismo**: los errores iban por un evento de `window` y los diálogos por registro. → los dos usan registro (`registrarErrores` / `registrarDialogos`), sin eventos ni conversiones de tipo.
- **`conTexto` era un dato derivable**: ahora, si el pedido trae `valor`, es para escribir; si no, es solo confirmar.
- **Errores con dos estilos**: 14 mensajes "No se pudo…" salían todavía como aviso común. → todos por `avisarError`, en rojo.
- **El tipo de `accion` estaba escrito a mano** en `Miembros`. → `Accion = ReturnType<typeof accionConAviso>`.
- **Prop `onAviso` sin uso** en `AgregarTarea`. → quitada.

Quedó pendiente en la 1.22.0 y **se hizo en la 1.22.1** (ver la sección 9):
- ~~Los menús de listas y secciones todavía arman sus propios `<Modal>`.~~
- ~~Los avisos comunes viajan como prop `onAviso`.~~

- ~~El patrón "ref con la última versión de una función" se repite en `Calculadora.tsx` y `Modal.tsx`.~~ También en la 1.22.1.

## 8. Cómo se probó

- `npx tsc -b`, `npm run lint` y `npm run build` pasan. `npx knip@5` no informa nada.
- Playwright (360×760), contando cualquier ventana nativa que apareciera: **0** en todas las pruebas.
  - Ajustes: cambiar tu nombre, agregar y renombrar un método, que Escape cierre, cancelar y aceptar "Restaurar" con un archivo inválido (sale el error rojo y se cierra al tocarlo), y que un diálogo nuevo arranque vacío.
  - Con los emuladores de Firebase: crear lista ("Súper" ya escrito), Ana pide unirse, Juan acepta y la saca con el diálogo nuevo.
  - Pruebas de antes que se repitieron: Tareas compartidas (secciones, subsecciones, responsables, tildar) y corrección de lo que compró otro (historial y propagación al gasto de Ana).
- Las pruebas que contestaban el `prompt()` nativo se actualizaron para usar el diálogo.

## 9. 1.22.1: los dos pendientes de `/simplify`

**Un solo tipo de diálogo.** Los menús ya no arman su propio `<Modal>` con estado:
- **Listas:** renombrar una lista y borrarla (dueño) o salir (miembro).
- **Tareas:** nueva sección (en la pantalla vacía y en el chip "+ Sección"), nueva subsección desde el campo de agregar tarea y, en el menú ⋯, renombrar la sección, crear o renombrar subsecciones y borrar o salir.

Todo pasa por `await pedirTexto(...)` / `await confirmar(...)`, con los mismos textos que antes. Ahora `Modal` lo usa solo `<Dialogos />`. Se fueron los estados `modal`, `creando` y `nuevaSub`, el `cerrarModal` y el fragmento que envolvía el formulario de tareas solo para poner el modal afuera.

**Un solo camino para los avisos.** `lib/avisos.ts` tiene:
- `avisar(texto, deshacer?)` para avisos comunes y con Deshacer;
- `avisarError(texto)` para errores en rojo;
- `accion(promesa, ok?)` para los menús.

App se registra una vez con `registrarAvisos`. Se sacó la prop `onAviso` de Lista, Tareas, Resumen, Saldos, Ajustes, `BotonCompartir`, `MenuListas`, `MenuSeccion` y `HojaTarea`, `onGuardado` de `FormMovimiento` y `accion` de `Miembros`. Ajustes solo recibe `onRespaldo`, que vuelve a mirar si hace falta el recordatorio de respaldo después de exportar o restaurar, como antes.

**Hook `useUltimo`** (`src/components/useUltimo.ts`). Es un ref que siempre tiene la última versión de un valor. Reemplaza el `useRef` + efecto que estaba repetido en la calculadora (teclado físico) y en `Modal` (Escape).

**Datos frescos al confirmar** (punto 9 de `/code-review`). En "volver a pendiente", al responder "¿Borrar también el gasto?" el gasto se vuelve a leer de la base. Si mientras tanto lo borraron o dejó de ser de ese ítem, no se toca, y el ítem igual vuelve a pendiente. El ítem no hace falta releerlo: volverlo a pendiente da igual aunque otro ya lo haya hecho, y si lo borraron sale el aviso de error.

**Resultado:** el código duplicado bajó de 0,53 % a 0,28 %. Quedan 2 bloques: las promos y el ícono del lápiz.

**Cómo se probó:**
- `tsc`, `lint` (sin avisos nuevos), `build` y `knip@5` pasan.
- Con los emuladores:
  - diálogos de Ajustes;
  - crear, renombrar ("Lista renombrada") y cancelar el borrado de una lista (botón rojo);
  - sacar a un miembro;
  - Tareas completa (secciones, subsecciones desde el menú, unirse y aceptar);
  - corrección de compras.
  - volver a pendiente: cancelar deja el gasto sin vincular, aceptar lo borra (con Deshacer) y, si el gasto se borra con el diálogo abierto, no se vuelve a borrar y el ítem igual queda pendiente.
- Calculadora con el teclado físico: `12*3` Enter da 36 y Escape la cierra.
- Sin emuladores: "Ingreso guardado: $ 850.000,00" desde el formulario y "Respaldo exportado" con la descarga.
- **0** ventanas nativas en todas las pruebas.

## Archivos nuevos

- `src/lib/avisos.ts`: `avisarError`, `registrarErrores`, `accionConAviso`, tipo `Accion`.
- `src/lib/dialogos.ts`: `confirmar`, `pedirTexto`, `registrarDialogos`.
- `src/components/Dialogos.tsx`: dibuja el diálogo abierto.
- `knip.json`.
- `docs/informe-1.22.md`: este informe.

## 10. 1.22.2: archivos más chicos y sin duplicados

Se movieron bloques enteros tal cual, sin reescribirlos, y los imports de más se sacaron según lo que marcó el compilador.

| Antes | Ahora |
|---|---|
| `screens/Tareas.tsx` (~830 líneas) | `Tareas.tsx` (262) + `tareas/AgregarTarea.tsx` (167), `tareas/HojaTarea.tsx` (150), `tareas/MenuSeccion.tsx` (145), `tareas/Bloque.tsx` (113, con `FilaTarea`) |
| `screens/Lista.tsx` (~950) | `Lista.tsx` (178) + `lista/VistaLista.tsx` (656, con `HojaOpciones`), `lista/MenuListas.tsx` (~130, con `ListasCerradas`), `lista/fecha.ts` |
| `components/FormMovimiento.tsx` (~930) | `FormMovimiento.tsx` (812) + `HistorialMov.tsx` (70) + `CamposPromo.tsx` (59) |

Duplicados:
- **Lápiz**: las 5 copias del dibujo, en dos tamaños, ahora son `<IconoLapiz />` / `<IconoLapiz tam={19} />`.
- **Promos**: 3x2 y N-ésima usan los mismos dos campos y cambian solo las etiquetas.
- `jscpd` informa **0 duplicados**, y `knip@5` nada sin usar.

Cómo se probó:
- `tsc`, `lint` (los 11 avisos de siempre), `build` y `knip@5` pasan.
- Todas las pruebas con los emuladores: diálogos, listas (crear, renombrar, borrar, sacar miembro), volver a pendiente (incluido el gasto borrado con el diálogo abierto), Tareas completa y corrección de compras.
- Avisos del formulario y del respaldo.
- Promos: las etiquetas de cada tipo, 20 % sobre 3 × $3.000 = $7.200 y 3x2 = $6.000.

## Lo que queda

- `lista/VistaLista.tsx` (656) y `FormMovimiento.tsx` (812) siguen siendo un solo componente grande cada uno. Para achicarlos más habría que separar su estado (por ejemplo, un hook para el formulario), que ya es un cambio de diseño y no solo de mover código. No hace falta por ahora.

## Cómo seguir buscando code smells

```sh
npx oxlint -W suspicious -W pedantic src          # lint estricto (ignorar react-in-jsx-scope)
npx knip@5                                        # código, exports y dependencias sin usar
npx jscpd src --min-lines 6 --min-tokens 60       # bloques duplicados
```

Y en Claude Code: `/code-review` (errores) y `/simplify` (repeticiones y simplificación).
