import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['BASE_', 'VITE_']);
  return {
    plugins: [
      preact(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: false },
        workbox: { globPatterns: ['**/*.{js,css,html}'] },
        manifest: { name: 'Proxy Viewer', short_name: 'Viewer', start_url: '.' }
      })
    ],
    base: env.BASE_PATH || '/viewer/',
    envPrefix: ['VITE_', 'BASE_'],
    build: { outDir: 'dist' }
  };
});
