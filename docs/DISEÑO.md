# BillIs — Diseño v1

Registro rápido de gastos e ingresos personales. PWA instalable en Android.

## Plataforma

- Vite + React + TypeScript, `vite-plugin-pwa`, Dexie (IndexedDB).
- El ícono abre directo en "nuevo gasto". Accesos directos (mantener apretado): **Gasto** (`/?nuevo=gasto`) e **Ingreso** (`/?nuevo=ingreso`).
- 100 % local, pero preparado para sincronizar:
  - IDs UUID, `creadoEn` / `modificadoEn` en cada registro.
  - Borrado lógico (`borradoEn`).
- Si algo falla al dibujar, se muestra el error con un botón **Recargar** en lugar de la pantalla vacía. Si iOS corta la conexión a IndexedDB (app instalada que vuelve de segundo plano), se recarga sola una vez por minuto como máximo (desde 1.8.5).

## Formulario de gasto

Un interruptor arriba alterna Gasto / Ingreso (cambian los campos). Al editar, o al comprar un ítem de la lista, no hay interruptor: solo el título "Editar gasto" / "Nuevo gasto" (desde 1.17.2).

| Campo | Comportamiento |
|---|---|
| Descripción* | El "Siguiente" del teclado salta al precio (desde 1.10). Autocompleta del historial. Al elegir precarga el último precio (busca por producto+marca+lugar → producto+marca → producto). Se guarda normalizada para agrupar. |
| Marca | Opcional. Las marcas ya compradas de ese producto (hasta 3, las que coinciden con lo escrito) aparecen como chips **dentro del campo**: un toque elige y las otras se van; si no está, se escribe al lado ("Otra"). Con chips, Marca y Cant bajan a su propio renglón (desde 1.18). |
| Precio* | Unitario. Precargado y seleccionado para pisar. |
| Cantidad | Vacía con placeholder "Cant" en letra chica; vacío = 1. Al tocarla se selecciona todo para escribir encima (desde 1.10). |
| Promo | NxM, N-ésima unidad al X % off, % de descuento, Otra/manual (escribís el total). Extensible: unión discriminada por `tipo`. |
| Categoría | Una por movimiento, lista editable. Se completa **mientras se escribe** el producto, hasta que se elige a mano: mismo producto ya cargado → producto que empieza igual (desde 3 letras) → lugar → el grupo que adivina el diccionario de la lista, llevado a una categoría que exista (Almacén/Frescos/… → Súper, Herramientas → Ferretería u Hogar) (desde 1.18). No se muestra debajo de cada movimiento. |
| Lugar | Se mantiene durante la compra; se borra al "Guardar y cerrar" o tras ~2 h sin cargar. Chips con los más usados. |
| Fecha | Default ahora. Si se cambia a mano, se mantiene durante la compra. |
| Método de pago | Lista editable (pocos y fijos). Se mantiene durante la compra. |
| Cuotas | Solo ARS. Cargás total financiado o valor de cuota y se calcula el otro. La 1ª cuota cae en el mes de compra. (`diaCierre` previsto en métodos de pago, sin uso todavía.) |
| Moneda | ARS por defecto; USD si se activa "Usar otras monedas". Sin conversión. |
| Pagador | Se elige en Pagar con un **desplegable**: vos y quienes comparten la lista actual (sus nombres quedan en el teléfono al abrir Listas). Se mantiene el último usado (desde 1.12). |
| Mi parte | Todo / Mitad / Nada / %. Si pagaste vos y tu parte < total, se elige con quién se comparte. Genera saldos por persona. |

Botones: **Guardar y agregar otro** y **Guardar**. Para salir sin guardar, una **X arriba a la derecha** del título (desde 1.12, en lugar de Cancelar al pie; igual en Pagar).

## Ingreso

Descripción, monto, categoría de ingreso, origen, medio de cobro, fecha, moneda. Sin persona.

## Saldos

- Pagó otro → le debés `mi parte`.
- Pagaste vos y tu parte < total → la contraparte te debe la diferencia.
- "Saldar" registra un movimiento `pagoDeuda` (no cuenta como gasto).
- Saldos por persona y por moneda.

## Pantallas

1. **Movimientos**: por día y compra, filtro de mes. Las flechas del mes saltan solo entre meses con movimientos y el actual (desde 1.12). Editar / borrar con deshacer. Cada compra abierta con más de un ítem tiene, a la derecha del título, **su propia lupa** (busca en descripción y marca de esa compra) y **su botón de orden**: manual (como se cargó), A..Z o por grupos (el grupo se adivina como en la lista). Duran mientras la app está abierta (desde 1.15). El botón de plegar/desplegar (flecha) es un botón propio, siempre a la derecha; al desplegar, la lupa y el orden aparecen a su izquierda (desde 1.18). Si la compra tiene ítems de una lista compartida, también muestra **lo que otros miembros compraron de esa lista**, en gris y con "compró Ana": se ven, se buscan y se ordenan, pero solo quien lo compró lo cambia. Se une por el **id de la lista** (que ya guardan los gastos comprados desde ella, en `listaItem`); si usaste la lista en más de una compra, cada ítem va a la más cercana en el tiempo. El pie muestra **"Total"** (el real, con lo de todos; sin nombres, porque la lista puede tener muchos miembros, desde 1.18.3) y **"Solo lo tuyo"**; Resumen y Saldos siguen contando solo lo tuyo, porque lo de Ana ya está en su teléfono (desde 1.16).
2. **Resumen del mes**: ingresos, gastos (solo tu parte; cuotas repartidas por mes), balance, por categoría, cuotas pendientes. Por moneda.
3. **Saldos**: dentro de Resumen, debajo del mes (desde 1.8.1). Quién te debe / a quién le debés, botón "Saldar"; la sección no aparece si estás al día.
4. **Ajustes**: tu nombre, métodos de pago, categorías, monedas, grupos de la lista, respaldo. Métodos, categorías y grupos se renombran, borran y agregan; renombrar y borrar muestran un aviso con **Deshacer** (borrar ya no pide confirmación) (desde 1.14).
5. **Calculadora**: botón al lado del engranaje (lo vuelve a tocar o tocar afuera la cierra), abre una hoja apoyada sobre las pestañas, sin título ni ✕, con + − × ÷ %, ( ), punto, C, ⌫ e =. Se evalúa con un parser propio (sin `eval`); los paréntesis sin cerrar se cierran solos y `200 + 10%` da 220. Debajo de la cuenta se ve el resultado parcial. Sin historial: recuerda solo la última cuenta mientras la app está abierta (desde 1.17.1). Funciona también con el teclado físico (desde 1.17).

## Respaldo

- Exportar / importar JSON (restaura todo).
- Exportar CSV.
- Aviso si pasaron > 7 días sin respaldo.
- `navigator.storage.persist()` al iniciar.

## Montos

Enteros en centavos. Se muestran con `Intl` `es-AR` ($ 1.234,56).

## Compra y "Pagar"

- Desde 1.8.3 **todo gasto nuevo** es parte de la compra en curso (con o sin lugar): guardar nunca la cierra; el lugar se repite y los gastos quedan agrupados. Si cambia el lugar, empieza otra compra.
- El formulario de alta no pide método de pago, cuotas, pagador ni "Mi parte": hasta pagar, el gasto queda con el último pagador y "Todo".
- Mientras hay una compra abierta aparece **"Pagar $total"** al lado del +. Abre el ticket como formulario: **método de pago + cuotas, pagador, Mi parte y Compartido con**, una vez para todos los gastos, y se cierra la compra.
- Tampoco aparecen al **editar** un gasto: se corrigen para toda la compra tocando su **Total** en Movimientos, que abre el mismo formulario de Pagar ("Guardar cambios").
- En Movimientos cada compra, terminada o en curso, tiene su propio **Total** al pie con el método, las cuotas, quién pagó y tu parte. Un gasto sin compra (datos viejos) cuenta como compra de un ítem.
- Si no se paga, la compra se cierra sola tras 2 h sin actividad.
- ~~Un gasto sin lugar (Netflix, nafta) se guarda directo~~: reemplazado en 1.8.3, también pasa por Pagar.
- Formulario nuevo: Guardar y agregar otro / Guardar. Editando: Guardar cambios. Desde la lista: Guardar (+ "Ya comprado, sin gasto" y, en chiquito al final, quién agregó el ítem). En todos, la X de arriba cierra sin guardar.

## Listas de compras compartidas

- Pestaña **Listas**. Firestore (proyecto `billis-juale86`, `southamerica-east1`) + inicio de sesión con **Google** (solo para las listas; los gastos siguen locales).
- **Varias listas**: la pestaña abre la última usada; el nombre con ▾ abre el menú (cambiar de lista, nueva, unirse con link, miembros, cerradas, cerrar sesión).
- **Compartir** por link; quien lo abre **pide unirse** y el dueño lo **aprueba** (insignia con la cantidad de pedidos).
- Permisos: el **dueño** puede todo: renombra, cierra, borra, aprueba, saca miembros y **da permisos** a cada miembro con un toque en el menú (chips Agregar / Comprar / Editar, desde 1.16). Un miembro recién aceptado solo puede **agregar** (y corregir o quitar lo que agregó); **Comprar** permite marcar comprado y volver a pendiente; **Editar**, corregir, mover y quitar cualquier ítem. Todos ven, buscan y filtran, y pueden salir. Las listas viejas sin permisos guardados valen como estándar. Reglas en `firestore.rules` (probadas con emulador).
- Tocar un ítem pendiente abre el formulario de gasto completo con nombre, marca, cantidad y último precio. Solo al **guardar** pasa a Comprados (con monto y quién lo compró) y se vuelve a la lista. "Ya comprado, sin gasto" lo marca sin monto.
- Comprados: tocar ofrece **Volver a pendientes** (si hay gasto propio pregunta si borrarlo) y **Ver gasto**.
- Gasto ↔ ítem sincronizados: editar el gasto actualiza el monto; borrarlo devuelve el ítem a pendientes (Deshacer lo restaura).
- **Total gastado** por moneda (suma de montos de comprados), **fijo abajo** sobre las pestañas: la lista se desplaza por detrás (desde 1.13). ~~Estimado de lo pendiente con tus últimos precios~~: quitado en 1.11.
- **Cerrar lista** (dueño): enlace al lado del Total. Queda archivada en "Cerradas"; ofrece abrir una nueva con los pendientes, los mismos miembros y sus permisos.
- La lista también **se cierra al pagar**: cuando el dueño confirma el pago de una compra con ítems de esa lista (desde 1.16). No se cierra sola por cambiar el día.
- **Otro día, otra lista**: si la lista tiene compras de un día anterior, al dueño se le pregunta una vez por día si quiere empezar una lista nueva con los pendientes (desde 1.16). Se puede seguir con la misma, por ejemplo si la compra dura varios días.
- **Cerrada**, solo el dueño puede **corregir** nombre, cantidad, marca y grupo de los ítems (lápiz en pendientes y comprados); no se agrega, compra ni quita. Los demás solo la ven (desde 1.16).

### Agregar, corregir y quitar (desde 1.10)

- Arriba, siempre visibles, dos campos: **Agregar a la lista** y **Buscar y filtrar**. Tocar uno despliega debajo su formulario (Cant, Marca, Grupo y botones) o sus filtros.
- **Agregar** pone el ítem arriba de todo. **Agregar y comprar** además abre el gasto ya cargado, por si encontrás en el súper algo que no estaba anotado; si se cancela, queda pendiente.
- Cada ítem ocupa un renglón: producto, marca y cantidad pegados a la izquierda (`x2` si es un número; desde 1.17.3), igual en pendientes, comprados y Movimientos; debajo queda el resto del detalle ("compró Ana", cuotas, pagador). El chip de grupo toma el ancho del nombre más largo, así todos miden igual, con el nombre a la izquierda y la ▾ pegada a la derecha; lápiz y ✕ son un poco más grandes sin agrandar el renglón (desde 1.17.2). Quién lo agregó no se muestra en la lista: queda guardado y aparece al comprarlo (desde 1.11).
- **Lápiz** (al lado de la ✕): abre el **mismo formulario de agregar** con los datos del ítem (producto, cantidad, marca y grupo) para corregir cualquiera; los botones pasan a ser **Guardar** y **Cancelar**. El ítem no cambia de lugar. Si no tenía grupo, se propone con el nombre corregido (desde 1.13.1; en 1.13.0 corregía solo el nombre).
- **✕ quita** el ítem y muestra un aviso con **Deshacer**, que lo restaura igual (posición, grupo, quién lo agregó) (desde 1.12).

### Orden (desde 1.9)

- **Manual**: lo último agregado primero; se mueve arrastrando la manija ≡ (campo `orden`, fraccionario entre vecinos; los ítems viejos usan `creadoEn`).
- **Alfabético** y **Por grupos** (grupos en el orden del recorrido del súper, cada uno con su título discreto y sin conteo; adentro, alfabético). En grupos los ítems van más juntos y los grupos un poco más separados (desde 1.13).
- Un botón en la cabecera **alterna** los tres con cada toque y muestra el actual: mano, `A..Z` o cuatro cuadraditos; un aviso confirma el cambio (desde 1.10.1). El orden se guarda **por teléfono**.
- Lo recién agregado queda arriba, en "Recién agregados", hasta que se vuelve a elegir un orden (vive en memoria; sobrevive a abrir el formulario de gasto).

### Grupos de compra (desde 1.10)

- Vienen Almacén, Bebidas, Frescos, Carnicería, Verdulería, Congelados, Mascotas, Limpieza y Herramientas (`src/lib/grupos.ts`).
- Menú de listas (desde 1.17.3): el contenido de cada sección (Tus listas, Miembros, Cerradas) va más adentro que su título, y los permisos de cada miembro quedan a la derecha de su nombre.
- Desde 1.14 se **editan en Ajustes** (renombrar, borrar, agregar, con Deshacer). Se guardan en este teléfono (`gruposCompra` en ajustes; mientras no se tocan, valen los de la app). Los ítems guardan el id del grupo: renombrar no los mueve; si se borra un grupo, sus ítems se ven en "Sin grupo" y el diccionario deja de proponerlo. Un grupo agregado se ve "Sin grupo" en los teléfonos que no lo tienen.
- En el campo **Agregar a la lista**, la tecla del teclado es "Siguiente": pasa a Cant, de ahí a Marca, y en Marca "Listo" agrega (desde 1.18.3).
- Se **adivinan** por palabras del nombre (gana la coincidencia más larga: "leche en polvo" → Almacén, "leche" → Frescos). Antes que el diccionario, se usa lo elegido a mano en este teléfono (`gruposLista` en ajustes) y lo que ya tiene la lista para ese nombre.
- Sin adivinanza, el campo Grupo aparece **resaltado** pero es opcional. Cada pendiente tiene un **chip** con su grupo que se toca para corregirlo, y se recuerda.
- Caché persistente: funciona sin señal y sincroniza al volver.
- Desarrollo con emuladores: `VITE_EMULADORES=1` + `npx firebase-tools emulators:start --only auth,firestore` (requiere Java 21).

## Búsqueda

- Lupa en Movimientos (solo el mes visible: texto en descripción, marca y lugar; chips Gastos / Ingresos / Categoría / Pagó otro; resumen "N resultados, gastaste $X (tu parte)").
- **Testigo**: los filtros siguen aplicados al cerrar la lupa; la lupa muestra un punto y los chips "Filtrando … ✕" quedan visibles.
- En la lista no hay lupa (desde 1.10): el campo **Buscar y filtrar** está siempre a la vista y busca **solo en los pendientes**, porque sirve para encontrar en el súper lo que falta comprar; con la búsqueda activa los comprados no se muestran. Chips **"Agregado por …"** para cada miembro de la lista (filtra por uid). Al comprar un ítem y volver, el texto de búsqueda queda vacío (desde 1.12). Sin contador "N de M pendientes"; si nada coincide dice "No hay coincidencias en la lista" (desde 1.18.3).

## Apariencia

Ajustes → Apariencia: Automático (sigue al sistema) / Claro / Oscuro. Se guarda por dispositivo. La barra de arriba toma el color del fondo de la app (`theme-color` en la página: #f5f6f4 en claro, #14161b en oscuro) y lo sigue si cambia el tema. La barra de botones de Android abajo, en cambio, usa el color fijo del manifest (no admite claro/oscuro): va #14161b, el fondo oscuro (desde 1.19.1).

Ícono (desde 1.19.2): un billete verde con alas que se va volando, mira hacia atrás guiñando un ojo y saluda con la manito; las estelas azules quedan del lado al que saluda. Fondo oscuro del tema (#14161b), solo el dibujo, sin texto; se dibuja en `public/logo.svg` y los PNG salen de `npx pwa-assets-generator`.

## Fuera de v1 (el modelo lo admite)

Facturas y gastos recurrentes (vencimiento, nº de factura), día de cierre de tarjeta, conversión de monedas, gráficos, búsqueda en movimientos, historial de precios, sincronización de gastos.

## Pendientes para charlar

- Cambiar el orden de los grupos desde Ajustes. ¿Compartir los grupos con la lista en vez de por teléfono?
- Historial de precios / búsqueda en varios meses (hoy la lupa de Movimientos busca solo en el mes visible).
- Link de "solo ver" para una lista (opción C de permisos), además del link con aprobación.
- El dueño de la lista corrige producto, marca y cantidad de lo que compraron los demás: en la lista con el lápiz de cada comprado, y en Movimientos tocando el renglón gris (hoja "Corregir lo que compró Ana"). El monto no, porque es el gasto de esa persona y vive en su teléfono; tampoco cambia el gasto guardado en el teléfono de quien lo compró (desde 1.19.1).
- Quién puede "Volver a pendientes" un ítem que compró otra persona (hoy: cualquiera con permiso de comprar).
- ~~"Pagar" un ticket completo en cuotas~~: resuelto en 1.8.1 (cuotas dentro del método, se reparten por producto sin interés). Pendiente: interés al pagar un ticket en cuotas.
- Qué pasa con tus gastos vinculados a una lista si te sacan de ella o se borra (hoy el gasto queda y el vínculo se ignora).
- Tickets con productos en pesos y dólares mezclados en "Pagar".
- Monetización (consultado 2026-11-07): AdSense requiere dominio propio (no acepta github.io); AdMob requiere app nativa (Capacitor + Play Store). Alternativas: donaciones (Cafecito / Mercado Pago), freemium, patrocinio. Nunca anuncios en el formulario ni en la lista.
