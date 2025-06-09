#!/usr/bin/env python3
"""
CTB Trading Bot - PyBit Backend Server
Volledig hergebouwd met PyBit voor veilige en efficiënte ByBit API integratie
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from services.pybit_service import PyBitService
from services.storage_service import SecureStorageService
from services.websocket_service import WebSocketService
from config.settings import Settings

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Global services
settings = Settings()
storage_service = SecureStorageService()
pybit_service = PyBitService()
websocket_service = WebSocketService()

# Pydantic Models
class ByBitCredentials(BaseModel):
    api_key: str = Field(..., min_length=1, description="ByBit API Key")
    secret_key: str = Field(..., min_length=1, description="ByBit Secret Key")
    testnet: bool = Field(default=False, description="Use testnet environment")

class ConnectionCreate(BaseModel):
    connection_id: str = Field(..., min_length=1, description="Unique connection identifier")
    name: str = Field(..., min_length=1, description="Display name for connection")
    credentials: ByBitCredentials
    markets: Dict[str, bool] = Field(default_factory=lambda: {
        "spot": True,
        "linear": True,
        "inverse": False,
        "option": False
    })

class ConnectionResponse(BaseModel):
    connection_id: str
    name: str
    testnet: bool
    markets: Dict[str, bool]
    status: str
    created_at: datetime
    last_updated: datetime

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str
    active_connections: int
    services: Dict[str, bool]

# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown"""
    logger.info("🚀 Starting CTB PyBit Backend...")
    
    # Initialize services
    await storage_service.initialize()
    await pybit_service.initialize()
    await websocket_service.initialize()
    
    # Load existing connections
    connections = await storage_service.get_all_connections()
    for conn_id, conn_data in connections.items():
        try:
            await pybit_service.add_connection(
                connection_id=conn_id,
                api_key=conn_data["credentials"]["api_key"],
                secret_key=conn_data["credentials"]["secret_key"],
                testnet=conn_data["credentials"]["testnet"],
                markets=conn_data["markets"]
            )
            logger.info(f"✅ Restored connection: {conn_id}")
        except Exception as e:
            logger.error(f"❌ Failed to restore connection {conn_id}: {e}")
    
    logger.info(f"✅ Backend initialized with {len(connections)} connections")
    
    yield
    
    # Cleanup
    logger.info("🛑 Shutting down CTB Backend...")
    await pybit_service.cleanup()
    await websocket_service.cleanup()

# FastAPI app
app = FastAPI(
    title="CTB Trading Bot - PyBit Backend",
    description="Veilige en efficiënte ByBit API integratie met PyBit",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Routes

@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint"""
    return {
        "message": "CTB Trading Bot - PyBit Backend",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    active_connections = len(pybit_service.get_all_connections())
    
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        version="2.0.0",
        active_connections=active_connections,
        services={
            "pybit": True,
            "storage": await storage_service.is_healthy(),
            "websocket": websocket_service.is_healthy()
        }
    )

@app.post("/api/bybit/test-connection")
async def test_bybit_connection(credentials: ByBitCredentials):
    """Test ByBit API connection"""
    try:
        result = await pybit_service.test_connection(
            api_key=credentials.api_key,
            secret_key=credentials.secret_key,
            testnet=credentials.testnet
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/bybit/add-connection", response_model=ConnectionResponse)
async def add_connection(connection: ConnectionCreate, background_tasks: BackgroundTasks):
    """Add new ByBit connection"""
    try:
        # Test connection first
        await pybit_service.test_connection(
            api_key=connection.credentials.api_key,
            secret_key=connection.credentials.secret_key,
            testnet=connection.credentials.testnet
        )
        
        # Add to PyBit service
        await pybit_service.add_connection(
            connection_id=connection.connection_id,
            api_key=connection.credentials.api_key,
            secret_key=connection.credentials.secret_key,
            testnet=connection.credentials.testnet,
            markets=connection.markets
        )
        
        # Store securely
        await storage_service.store_connection(
            connection_id=connection.connection_id,
            name=connection.name,
            credentials=connection.credentials.dict(),
            markets=connection.markets
        )
        
        # Start background data fetching
        background_tasks.add_task(
            pybit_service.start_data_streaming,
            connection.connection_id
        )
        
        return ConnectionResponse(
            connection_id=connection.connection_id,
            name=connection.name,
            testnet=connection.credentials.testnet,
            markets=connection.markets,
            status="active",
            created_at=datetime.utcnow(),
            last_updated=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Failed to add connection: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/bybit/connections")
async def get_all_connections():
    """Get all ByBit connections"""
    try:
        connections = pybit_service.get_all_connections()
        stored_connections = await storage_service.get_all_connections()
        
        result = []
        for conn_id in connections:
            stored_data = stored_connections.get(conn_id, {})
            connection_data = await pybit_service.get_connection_data(conn_id)
            
            result.append({
                "connection_id": conn_id,
                "name": stored_data.get("name", conn_id),
                "testnet": stored_data.get("credentials", {}).get("testnet", False),
                "markets": stored_data.get("markets", {}),
                "status": "active" if connection_data else "error",
                "data": connection_data,
                "last_updated": stored_data.get("last_updated", datetime.utcnow().isoformat())
            })
        
        return {"success": True, "connections": result}
        
    except Exception as e:
        logger.error(f"Failed to get connections: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/bybit/connection/{connection_id}")
async def get_connection(connection_id: str):
    """Get specific connection data"""
    try:
        if connection_id not in pybit_service.get_all_connections():
            raise HTTPException(status_code=404, detail="Connection not found")
        
        connection_data = await pybit_service.get_connection_data(connection_id)
        stored_data = await storage_service.get_connection(connection_id)
        
        return {
            "success": True,
            "data": {
                **connection_data,
                "metadata": stored_data
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get connection {connection_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/bybit/connection/{connection_id}")
async def remove_connection(connection_id: str):
    """Remove ByBit connection"""
    try:
        if connection_id not in pybit_service.get_all_connections():
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Remove from PyBit service
        await pybit_service.remove_connection(connection_id)
        
        # Remove from storage
        await storage_service.remove_connection(connection_id)
        
        return {"success": True, "message": "Connection removed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to remove connection {connection_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/market/instruments")
async def get_market_instruments():
    """Get all available trading instruments/symbols"""
    try:
        instruments = await pybit_service.get_instruments()
        
        return {
            "success": True,
            "data": instruments,
            "count": len(instruments),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get instruments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/market/tickers")
async def get_market_data(symbols: Optional[str] = None):
    """Get market ticker data"""
    try:
        symbol_list = symbols.split(",") if symbols else None
        market_data = await pybit_service.get_market_data(symbol_list)
        
        return {
            "success": True,
            "data": market_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get market data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/portfolio/summary")
async def get_portfolio_summary():
    """Get portfolio summary across all connections"""
    try:
        summary = await pybit_service.get_portfolio_summary()
        
        return {
            "success": True,
            "summary": summary,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get portfolio summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket endpoint for real-time data
@app.websocket("/ws")
async def websocket_endpoint(websocket):
    """WebSocket endpoint for real-time updates"""
    await websocket_service.connect(websocket)

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.detail}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error"}
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )