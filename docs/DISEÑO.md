# BillIs — Diseño v1

Registro rápido de gastos e ingresos personales. PWA instalable en Android.

## Plataforma

- Vite + React + TypeScript, `vite-plugin-pwa`, Dexie (IndexedDB).
- El ícono abre directo en "nuevo gasto". Accesos directos (mantener apretado): **Gasto** (`/?nuevo=gasto`) e **Ingreso** (`/?nuevo=ingreso`).
- 100 % local, pero preparado para sincronizar:
  - IDs UUID, `creadoEn` / `modificadoEn` en cada registro.
  - Borrado lógico (`borradoEn`).

## Formulario de gasto

Un interruptor arriba alterna Gasto / Ingreso (cambian los campos).

| Campo | Comportamiento |
|---|---|
| Descripción* | Autocompleta del historial. Al elegir precarga el último precio (busca por producto+marca+lugar → producto+marca → producto). Se guarda normalizada para agrupar. |
| Marca | Opcional. Sugiere marcas ya compradas de ese producto. |
| Precio* | Unitario. Precargado y seleccionado para pisar. |
| Cantidad | Default 1, colapsada. |
| Promo | NxM, N-ésima unidad al X % off, % de descuento, Otra/manual (escribís el total). Extensible: unión discriminada por `tipo`. |
| Categoría | Una por movimiento, lista editable. Se autocompleta por producto y, si no, por lugar. |
| Lugar | Se mantiene durante la compra; se borra al "Guardar y cerrar" o tras ~2 h sin cargar. Chips con los más usados. |
| Fecha | Default ahora. Si se cambia a mano, se mantiene durante la compra. |
| Método de pago | Lista editable (pocos y fijos). Se mantiene durante la compra. |
| Cuotas | Solo ARS. Cargás total financiado o valor de cuota y se calcula el otro. La 1ª cuota cae en el mes de compra. (`diaCierre` previsto en métodos de pago, sin uso todavía.) |
| Moneda | ARS por defecto; USD si se activa "Usar otras monedas". Sin conversión. |
| Pagador | Por defecto vos (nombre pedido al primer uso). Se mantiene siempre (último usado). |
| Mi parte | Todo / Mitad / Nada / %. Si pagaste vos y tu parte < total, se elige con quién se comparte. Genera saldos por persona. |

Botones: **Guardar y agregar otro** (mismo `compraId`, agrupa la compra) y **Guardar y cerrar** (cierra la compra).

## Ingreso

Descripción, monto, categoría de ingreso, origen, medio de cobro, fecha, moneda. Sin persona.

## Saldos

- Pagó otro → le debés `mi parte`.
- Pagaste vos y tu parte < total → la contraparte te debe la diferencia.
- "Saldar" registra un movimiento `pagoDeuda` (no cuenta como gasto).
- Saldos por persona y por moneda.

## Pantallas

1. **Movimientos**: por día y compra, filtro de mes. Editar / borrar con deshacer.
2. **Resumen del mes**: ingresos, gastos (solo tu parte; cuotas repartidas por mes), balance, por categoría, cuotas pendientes. Por moneda.
3. **Saldos**: quién te debe / a quién le debés, botón "Saldar".
4. **Ajustes**: tu nombre, métodos de pago, categorías, monedas, respaldo.

## Respaldo

- Exportar / importar JSON (restaura todo).
- Exportar CSV.
- Aviso si pasaron > 7 días sin respaldo.
- `navigator.storage.persist()` al iniciar.

## Montos

Enteros en centavos. Se muestran con `Intl` `es-AR` ($ 1.234,56).

## Compra y "Pagar"

- Un gasto **con lugar** es parte de una compra: guardar nunca la cierra; el lugar se repite y los gastos quedan agrupados.
- Mientras hay una compra abierta aparece **"Pagar $total"** al lado del +. Abre el resumen del ticket, se elige **el método de pago una vez** para todos los gastos y se cierra la compra.
- Si no se paga, la compra se cierra sola tras 2 h sin actividad.
- Un gasto **sin lugar** (Netflix, nafta) se guarda directo con su método de pago y no pasa por Pagar.
- Formulario nuevo: Cancelar / Guardar y agregar otro / Guardar. Editando: Cancelar / Guardar cambios. Desde la lista: Cancelar / Guardar (+ "Ya comprado, sin gasto").

## Listas de compras compartidas

- Pestaña **Listas**. Firestore (proyecto `billis-juale86`, `southamerica-east1`) + inicio de sesión con **Google** (solo para las listas; los gastos siguen locales).
- **Varias listas**: la pestaña abre la última usada; el nombre con ▾ abre el menú (cambiar de lista, nueva, unirse con link, miembros, cerradas, cerrar sesión).
- **Compartir** por link; quien lo abre **pide unirse** y el dueño lo **aprueba** (insignia con la cantidad de pedidos).
- Permisos: el **dueño** renombra, cierra, borra, aprueba y saca miembros; los **miembros** ven, agregan, compran, quitan sus propios ítems y pueden salir. Reglas en `firestore.rules` (probadas con emulador: 30 casos).
- Tocar un ítem pendiente abre el formulario de gasto completo con nombre, marca, cantidad y último precio. Solo al **guardar** pasa a Comprados (con monto y quién lo compró) y se vuelve a la lista. "Ya comprado, sin gasto" lo marca sin monto.
- Comprados: tocar ofrece **Volver a pendientes** (si hay gasto propio pregunta si borrarlo) y **Ver gasto**.
- Gasto ↔ ítem sincronizados: editar el gasto actualiza el monto; borrarlo devuelve el ítem a pendientes (Deshacer lo restaura).
- **Total gastado** por moneda (suma de montos de comprados) y **estimado de lo pendiente** con tus últimos precios.
- **Cerrar lista** (dueño): queda archivada, de solo lectura, en "Cerradas"; ofrece abrir una nueva con los pendientes y los mismos miembros.
- Caché persistente: funciona sin señal y sincroniza al volver.
- Desarrollo con emuladores: `VITE_EMULADORES=1` + `npx firebase-tools emulators:start --only auth,firestore` (requiere Java 21).

## Búsqueda

- Lupa en Movimientos (solo el mes visible: texto en descripción, marca y lugar; chips Gastos / Ingresos / Categoría / Pagó otro; resumen "N resultados, gastaste $X (tu parte)") y en la lista (texto; Pendientes / Comprados / Agregó X).
- **Testigo**: los filtros siguen aplicados al cerrar la lupa; la lupa muestra un punto y los chips "Filtrando … ✕" quedan visibles.

## Apariencia

Ajustes → Apariencia: Automático (sigue al sistema) / Claro / Oscuro. Se guarda por dispositivo.

## Fuera de v1 (el modelo lo admite)

Facturas y gastos recurrentes (vencimiento, nº de factura), día de cierre de tarjeta, conversión de monedas, gráficos, búsqueda en movimientos, historial de precios, sincronización de gastos.

## Pendientes para charlar

- Historial de precios / búsqueda en varios meses (hoy la lupa de Movimientos busca solo en el mes visible).
- Link de "solo ver" para una lista (opción C de permisos), además del link con aprobación.
- Quién puede "Volver a pendientes" un ítem que compró otra persona (hoy: cualquier miembro).
- "Pagar" un ticket completo en cuotas (hoy las cuotas son por producto).
- Qué pasa con tus gastos vinculados a una lista si te sacan de ella o se borra (hoy el gasto queda y el vínculo se ignora).
- Tickets con productos en pesos y dólares mezclados en "Pagar".
- Monetización (consultado 2026-11-07): AdSense requiere dominio propio (no acepta github.io); AdMob requiere app nativa (Capacitor + Play Store). Alternativas: donaciones (Cafecito / Mercado Pago), freemium, patrocinio. Nunca anuncios en el formulario ni en la lista.
