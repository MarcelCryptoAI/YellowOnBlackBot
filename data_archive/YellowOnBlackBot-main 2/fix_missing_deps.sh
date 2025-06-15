#!/bin/bash

echo "🔧 Fixing Missing Dependencies for AI Crypto Platform"
echo "====================================================="

echo "📦 Installing missing Lucide React icons..."
npm install lucide-react@0.263.1

echo "📦 Installing other missing dependencies..."
npm install @types/react@18.2.43 @types/react-dom@18.2.17

echo "🔍 Checking if all dependencies are installed..."
echo ""
echo "📋 Current dependencies:"
npm list lucide-react
npm list @types/react
npm list @types/react-dom

echo ""
echo "✅ Dependencies check complete!"
echo ""
echo "🚀 Try starting the server now:"
echo "   npm run dev"