#!/bin/bash

echo "🔧 Quick Fix for AI Crypto Platform"
echo "==================================="

echo "🧹 Removing problematic files..."
rm -f postcss.config.js
rm -f tailwind.config.js

echo "⚙️ Recreating PostCSS config as .cjs..."
cat > postcss.config.cjs << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

echo "⚙️ Recreating Tailwind config as .cjs..."
cat > tailwind.config.cjs << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'pulse-slow': 'pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
EOF

echo "⚙️ Updating Vite config..."
cat > vite.config.ts << 'EOF'
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
    port: 3000,
    host: true,
  },
  css: {
    postcss: './postcss.config.cjs',
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
EOF

echo "🎨 Updating CSS files..."
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  background: #000000;
  color: #ffffff;
  font-family: system-ui, -apple-system, sans-serif;
}
EOF

echo "📦 Reinstalling dependencies if needed..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "🔍 Checking TailwindCSS version..."
npm list tailwindcss

echo "✅ Quick fix completed!"
echo ""
echo "🚀 Try starting the server:"
echo "   npm run dev"
echo ""
echo "❌ If still having issues, run: ./complete-setup.sh"