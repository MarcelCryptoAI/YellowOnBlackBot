#!/usr/bin/env python3
"""
CTB Trading Bot - Startup Script
Start de PyBit backend server
"""

import os
import sys
import subprocess
import logging

def check_requirements():
    """Check if requirements are installed"""
    try:
        import fastapi
        import uvicorn
        import pybit
        print("✅ All required packages are installed")
        return True
    except ImportError as e:
        print(f"❌ Missing required package: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def create_storage_directory():
    """Create storage directory if it doesn't exist"""
    storage_path = "./storage"
    if not os.path.exists(storage_path):
        os.makedirs(storage_path)
        print(f"📁 Created storage directory: {storage_path}")

def main():
    """Main startup function"""
    print("🚀 Starting CTB Trading Bot - PyBit Backend")
    print("=" * 50)
    
    # Check requirements
    if not check_requirements():
        sys.exit(1)
    
    # Create storage directory
    create_storage_directory()
    
    # Set up environment
    if not os.path.exists(".env"):
        if os.path.exists(".env.example"):
            print("📄 Creating .env file from example...")
            with open(".env.example", "r") as src, open(".env", "w") as dst:
                dst.write(src.read())
        else:
            print("⚠️ No .env file found. Using default settings.")
    
    # Start the server
    print("🌟 Starting FastAPI server on http://localhost:8000")
    print("📚 API Documentation: http://localhost:8000/docs")
    print("🔗 WebSocket endpoint: ws://localhost:8000/ws")
    print("=" * 50)
    
    try:
        # Import and run
        import uvicorn
        from main import app
        
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()