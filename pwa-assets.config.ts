import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Íconos generados desde public/logo.svg: `npx pwa-assets-generator`
// El logo ya trae fondo y deja el dibujo dentro de la zona segura, así que no lleva relleno extra.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#14161b' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#14161b' } },
  },
  images: ['public/logo.svg'],
})
