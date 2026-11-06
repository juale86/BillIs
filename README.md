# BillIs

Registro rápido de gastos e ingresos. PWA instalable en Android, datos locales (IndexedDB).

Diseño completo: [docs/DISEÑO.md](docs/DISEÑO.md)

```bash
npm install
npm run dev        # desarrollo
npm run build      # build de producción (incluye service worker)
npm run preview    # servir el build
```

Para instalarla en el teléfono hay que servirla por HTTPS (o `localhost`), abrirla en Chrome y elegir **Agregar a pantalla principal**.
Manteniendo apretado el ícono aparecen los accesos **Gasto** e **Ingreso**.
