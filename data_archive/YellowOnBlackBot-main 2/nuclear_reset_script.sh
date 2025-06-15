#!/bin/bash

echo "💥 NUCLEAR RESET - AI Crypto Platform"
echo "======================================"
echo "⚠️  This will DELETE EVERYTHING and start fresh!"
echo ""
read -p "Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Reset cancelled."
    exit 1
fi

echo ""
echo "🗑️  Deleting ALL project files..."

# Remove all node/build related files
rm -rf node_modules/
rm -rf dist/
rm -rf .next/
rm -rf build/
rm -f package-lock.json
rm -f yarn.lock
rm -f pnpm-lock.yaml

# Remove all config files
rm -f vite.config.ts
rm -f vite.config.js
rm -f postcss.config.js
rm -f postcss.config.cjs
rm -f tailwind.config.js
rm -f tailwind.config.cjs
rm -f tsconfig.json
rm -f tsconfig.node.json

# Remove source files (keep backup)
if [ -d "src" ]; then
    echo "📄 Creating backup of src/ folder..."
    mv src src_backup_$(date +%Y%m%d_%H%M%S)
fi

# Remove other files
rm -f index.html
rm -f package.json
rm -f README.md

echo "✅ Complete cleanup finished!"
echo ""
echo "🚀 Now run the complete setup:"
echo "   chmod +x complete-setup.sh"
echo "   ./complete-setup.sh"
echo ""
echo "📁 Your old files are backed up in src_backup_* folder"