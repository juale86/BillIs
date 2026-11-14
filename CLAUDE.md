# BillIs — guía para Claude

PWA (React 19 + TS estricto + Vite 8 + vite-plugin-pwa) para anotar gastos en Android. Publicada en GitHub Pages (`/BillIs/`) con cada push a `main`. Responder siempre en español. Detalle funcional en `docs/DISEÑO.md` (leer solo la sección que haga falta).

## Reglas de trabajo
- Cada cambio sube la versión (`npm version minor|patch --no-git-tag-version`); se ve en Ajustes.
- Actualizar `README.md` y `docs/DISEÑO.md` con cada función nueva.
- Commit y push solo cuando el usuario lo pide. Si cambió `firestore.rules`, antes del push: `npx firebase-tools deploy --only firestore:rules --project billis-juale86`.
- Cambios visuales grandes: mostrar capturas antes/después y esperar el OK.
- Verificar con `npx tsc -b`, `npm run lint` (hay 11 warnings conocidos: purity/Date.now, only-export-components, immutability en tareas.ts) y `npm run build`. Opcionales: `npx knip@5` (código sin usar, configurado en `knip.json`) y `npx jscpd src --min-lines 6 --min-tokens 60` (duplicados).

## Mapa del código
- `src/App.tsx`: pestañas (Movimientos, Listas, Tareas + íconos Resumen, Calculadora, Ajustes), formulario abierto (`Form`: nuevo, editando, prefill de lista, corrección), Pagar, registro de avisos con Deshacer, invitaciones `?lista=` / `?tareas=`, sincronización gasto → ítem (`sincronizarItem`).
- `src/components/FormMovimiento.tsx`: alta/edición de gasto o ingreso; modo `correccion` (el dueño corrige lo que compró otro); líneas `.antes`; `HistorialMov.tsx` al pie y `CamposPromo.tsx` (tipo de promo y sus números) aparte. Íconos y hooks chicos: `IconoLapiz.tsx`, `useUltimo.ts` (ref con la última versión de una función).
- `src/components/Pagar.tsx`: método, cuotas, pagador y "mi parte" para toda una compra.
- `src/components/Compartir.tsx`: Login, Invitacion, BotonCompartir, Miembros (permisos) — compartido entre Listas y Tareas.
- `src/screens/`: `Movimientos` (compras plegables, lo de otros en gris, aplica correcciones), `Lista` (lista de compras: login, invitación y elegir lista; `lista/VistaLista.tsx` la lista en sí, `lista/MenuListas.tsx` el menú), `Tareas` (secciones y vista; en `tareas/`: `AgregarTarea`, `Bloque` + `FilaTarea`, `HojaTarea`, `MenuSeccion`), `Resumen` + `Saldos`, `Ajustes`, `SelectorMes`.
- `src/db/`: Dexie (`movimientos`, `personas`, `metodosPago`, `categorias`, `ajustes`) y tipos (`Movimiento`, `GastoCargado`, `Historial`).
- `src/lib/`: `datos.ts` (useDatos reactivo), `listaCompras.ts` (Firebase: auth, listas, ítems, permisos, corrección), `tareas.ts` (tareas y subsecciones), `historial.ts` (cargaDe, cambios, aplicarCorreccion), `calculos.ts` (`claveCompra`), `conversor.ts` (cotizaciones contra el dólar, conversor de la calculadora), `promo.ts`, `sesion.ts` (compra en curso, 2 h), `avisos.ts` (`avisar(texto, deshacer?)`, `avisarError`, `accion(promesa, ok?)`: el aviso de abajo desde cualquier pantalla, sin props), `dialogos.ts` (`confirmar` / `pedirTexto` con el modal de la app: no usar `alert`/`confirm`/`prompt`, lo frena `no-alert`), `sugerencias.ts`, `grupos.ts`, `respaldo.ts`, `tema.ts`, `money.ts` (centavos).
- `src/index.css`: un solo archivo, tokens en `:root` (claro) y oscuro duplicado en `@media` y `[data-tema='oscuro']`.

## Modelo
- Gastos solo locales (Dexie). Montos en centavos. Borrado lógico (`borradoEn`).
- Firestore `listas/{id}` con `tipo: 'compras'` (o ausente) | `'tareas'`; subcolecciones `items` y `tareas`. Permisos por miembro (agregar / comprar=tildar / editar); el dueño todo. Reglas en `firestore.rules`.
- Todo gasto nuevo entra en la compra en curso (`compraId`); Pagar la cierra.

## Probar
- Playwright (`playwright-core@1.49.1`, chromium en `~/.cache/ms-playwright`) instalado en el scratchpad, viewport 360×760.
- Emuladores (requieren Java 21, bajarlo al scratchpad si no está): `JAVA_HOME=… npx firebase-tools emulators:start --only auth,firestore --project billis-juale86` y build con `VITE_EMULADORES=1 VITE_FIREBASE_API_KEY=demo npx vite build --outDir <scratch>/dist-emu`. Login del emulador: popup → "Add new account" → `#email-input` → `#sign-in`.
