#!/bin/bash

echo "📦 Installing AI Crypto Platform Dependencies"
echo "============================================="

echo "🔍 Checking Node.js version..."
node --version
npm --version

echo ""
echo "📦 Installing core dependencies..."
npm install react@18.2.0 react-dom@18.2.0

echo "📦 Installing TypeScript dependencies..."
npm install -D typescript@5.2.2
npm install -D @types/node@20.11.0
npm install -D @types/react@18.2.43
npm install -D @types/react-dom@18.2.17

echo "📦 Installing Vite..."
npm install -D vite@4.4.5
npm install -D @vitejs/plugin-react@4.0.3

echo "🎨 Installing TailwindCSS (STABLE VERSION)..."
npm install -D tailwindcss@3.4.1
npm install -D postcss@8.4.33
npm install -D autoprefixer@10.4.16

echo "🎯 Installing UI dependencies..."
npm install lucide-react@0.263.1

echo "📊 Installing chart dependencies (optional)..."
npm install recharts@2.8.0

echo "🌐 Installing HTTP client..."
npm install axios@1.6.7

echo "🔄 Installing React Query..."
npm install @tanstack/react-query@4.36.1

echo "🛣️ Installing Router..."
npm install react-router-dom@6.8.1
npm install -D @types/react-router-dom@5.3.3

echo ""
echo "✅ All dependencies installed!"
echo ""
echo "📋 Final package list:"
npm list --depth=0

echo ""
echo "🚀 Ready to run:"
echo "   npm run dev"