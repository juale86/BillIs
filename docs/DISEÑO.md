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

## Lista de compras compartida

- Pestaña **Lista**. Sincronizada entre teléfonos con Firebase Firestore (proyecto `billis-juale86`, región `southamerica-east1`).
- Sin cuentas: el id de la lista (20 caracteres al azar) es el permiso. Se comparte como link `…/BillIs/?lista=<id>`; al abrirlo aparece "Unirme a la lista".
- Reglas (`firestore.rules`): no se pueden listar listas, solo abrir una por id; validación de campos y tamaños. Deploy: `npx firebase-tools deploy --only firestore`.
- Ítem: nombre*, cantidad (texto libre: "3", "1 kg"), marca, comprado, agregadoPor, compradoPor.
- Caché persistente: funciona sin señal y sincroniza al volver.
- Al tildar: pasa a "Comprados" con **Cargar gasto** (abre el formulario con nombre, marca, cantidad y último precio).
- Lupa: búsqueda por texto + filtros Pendientes / Comprados / Agregó X. Los filtros aplicados se muestran como chips con ✕.
- Firebase se carga solo al abrir la pestaña (chunk aparte).

## Apariencia

Ajustes → Apariencia: Automático (sigue al sistema) / Claro / Oscuro. Se guarda por dispositivo.

## Fuera de v1 (el modelo lo admite)

Facturas y gastos recurrentes (vencimiento, nº de factura), día de cierre de tarjeta, conversión de monedas, gráficos, búsqueda en movimientos, historial de precios, sincronización de gastos.
