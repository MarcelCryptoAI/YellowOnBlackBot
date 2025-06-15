import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 2345,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:6789',
        changeOrigin: true,
      },
    },
  },
  css: {
    postcss: './postcss.config.cjs',
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps for production
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          api: ['axios', 'socket.io-client'],
        },
      },
    },
  },
  esbuild: {
    drop: ['console', 'debugger'], // Remove console logs in production
  },
})
