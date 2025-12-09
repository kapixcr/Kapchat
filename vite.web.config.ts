import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/',
  root: 'src/renderer',
  envDir: '../../', // Buscar .env en la raíz del proyecto
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/kapix': {
        target: 'https://kpixs.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/kapix/, '/api'),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Agregar el header de autenticación
            const authToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiS2VubmV0aCIsIm5hbWUiOiJLYXBpeCBBUEkiLCJBUElfVElNRSI6MTcyMTQ0NzI4Nn0.2vfJW3If8KeDoRFTwlRgIHSL6Eitxt1MWAkSVZNvrsM';
            proxyReq.setHeader('authtoken', authToken);
            // Asegurar que Content-Type esté presente
            if (!proxyReq.getHeader('Content-Type')) {
              proxyReq.setHeader('Content-Type', 'application/json');
            }
            // Log para debugging
            console.log('[Vite Proxy] Request:', {
              method: proxyReq.method,
              path: proxyReq.path,
              headers: {
                authtoken: authToken.substring(0, 20) + '...',
                'content-type': proxyReq.getHeader('Content-Type'),
              },
            });
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('[Vite Proxy] Response:', {
              statusCode: proxyRes.statusCode,
              statusMessage: proxyRes.statusMessage,
              path: req.url,
            });
          });
          proxy.on('error', (err, req, res) => {
            console.error('[Vite Proxy] Error:', err);
          });
        },
      },
    },
  },
})

