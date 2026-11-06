import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Íconos generados desde public/logo.svg: `npx pwa-assets-generator`
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0.22, resizeOptions: { background: '#2a46b8' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#2a46b8' } },
  },
  images: ['public/logo.svg'],
})
