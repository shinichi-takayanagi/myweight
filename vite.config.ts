import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/myweight/',
  server: {
    proxy: {
      "/status": {
        target: "https://www.healthplanet.jp",
        changeOrigin: true,
      },
    },
  },
  esbuild: {
    supported: {
      'top-level-await': true //browsers can handle top-level-await features
    },
  }
});
