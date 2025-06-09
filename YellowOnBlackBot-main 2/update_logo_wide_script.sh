#!/bin/bash

echo "🖼️ Installing Wide Logo Version - AI Crypto Platform"
echo "===================================================="

# Check if header_logo.png exists
if [ ! -f "header_logo.png" ] && [ ! -f "public/header_logo.png" ]; then
    echo "⚠️  Warning: header_logo.png not found in root or public directory!"
    echo "📁 Please make sure header_logo.png is in one of these locations:"
    echo "   - ./header_logo.png (project root)"
    echo "   - ./public/header_logo.png (public directory)"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Update cancelled. Please add header_logo.png first."
        exit 1
    fi
else
    echo "✅ Found header_logo.png"
fi

# Move header_logo.png to public directory if it's in root
if [ -f "header_logo.png" ] && [ ! -f "public/header_logo.png" ]; then
    echo "📁 Moving header_logo.png to public directory..."
    mv header_logo.png public/header_logo.png
    echo "✅ Logo moved to public/header_logo.png"
fi

# Backup existing App.tsx
echo "📄 Creating backup of existing App.tsx..."
if [ -f "src/App.tsx" ]; then
    cp src/App.tsx src/App.tsx.backup
    echo "✅ Backup created: src/App.tsx.backup"
fi

echo "🎨 Installing wide logo version with clean header..."

# Just copy the updated app-no-icons content that's already updated in the artifact
echo "📝 Please manually copy the updated app-no-icons.tsx content to src/App.tsx"
echo "The content includes:"
echo "  ✅ Wide logo (w-20 h-12) instead of square"
echo "  ✅ Removed AI CRYPTO PLATFORM text"
echo "  ✅ Taller header with more padding (p-6)"
echo "  ✅ Enhanced drop shadows and glow effects"
echo "  ✅ Better spacing and layout"

echo ""
echo "🎯 New logo specifications:"
echo "  - Width: 80px (w-20)"
echo "  - Height: 48px (h-12)" 
echo "  - Format: Wide/horizontal logo recommended"
echo "  - Position: Left side of header"
echo "  - Style: Enhanced drop shadow and glow"
echo ""
echo "🚀 After copying the code, start with:"
echo "   npm run dev"