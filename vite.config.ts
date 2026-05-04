import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/healthplanet': {
        target: 'https://www.healthplanet.jp',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/healthplanet/, ''),
      },
    },
  },
  esbuild: {
    supported: {
      'top-level-await': true //browsers can handle top-level-await features
    },
  }
});
