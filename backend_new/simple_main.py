#!/usr/bin/env python3
"""
Simplified CTB Trading Bot Backend - PyBit Integration
Minimale versie die direct werkt
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from pybit.unified_trading import HTTP
    PYBIT_AVAILABLE = True  # Enable live mode for real data
    print("🚀 Live mode enabled - real ByBit API calls")
except ImportError:
    PYBIT_AVAILABLE = False
    print("⚠️ PyBit niet beschikbaar - demo mode")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic Models
class ByBitCredentials(BaseModel):
    apiKey: str
    secretKey: str
    testnet: bool = False

class ConnectionCreate(BaseModel):
    connectionId: str
    name: str
    apiKey: str
    secretKey: str
    testnet: bool = False
    markets: dict = {}

# Simple persistent storage
import json
import os

STORAGE_FILE = "connections.json"

def load_connections():
    if os.path.exists(STORAGE_FILE):
        try:
            with open(STORAGE_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {}

def save_connections(connections):
    with open(STORAGE_FILE, 'w') as f:
        json.dump(connections, f, indent=2)

connections_store = load_connections()

def get_live_account_data(api_key: str, secret_key: str, testnet: bool):
    """Get real account data from ByBit API"""
    if not PYBIT_AVAILABLE:
        return {
            "balance": {"total": 1000, "available": 950, "inOrder": 50},
            "positions": [],
            "orderHistory": []
        }
    
    try:
        session = HTTP(testnet=testnet, api_key=api_key, api_secret=secret_key)
        
        # Get wallet balance
        balance_result = session.get_wallet_balance(accountType="UNIFIED")
        balance_data = {"total": 0, "available": 0, "inOrder": 0}
        
        if balance_result["retCode"] == 0 and balance_result["result"]["list"]:
            account = balance_result["result"]["list"][0]
            balance_data = {
                "total": float(account.get("totalEquity", "0")),
                "available": float(account.get("totalAvailableBalance", "0")),
                "inOrder": float(account.get("totalInitialMargin", "0"))
            }
        
        # Get positions
        positions_result = session.get_positions(category="linear", settleCoin="USDT")
        positions = []
        if positions_result["retCode"] == 0:
            for pos in positions_result["result"]["list"]:
                if float(pos.get("size", "0")) > 0:
                    positions.append({
                        "id": f"{pos.get('symbol')}_{pos.get('side')}",
                        "symbol": pos.get("symbol"),
                        "direction": "LONG" if pos.get("side") == "Buy" else "SHORT",
                        "amount": float(pos.get("size", "0")),
                        "entryPrice": float(pos.get("avgPrice", "0")),
                        "currentPrice": float(pos.get("markPrice", "0")),
                        "pnl": float(pos.get("unrealisedPnl", "0")),
                        "pnlPercent": 0,  # Calculate if needed
                        "status": "OPEN",
                        "exchange": "ByBit",
                        "timestamp": datetime.utcnow().isoformat()
                    })
        
        return {
            "balance": balance_data,
            "positions": positions,
            "orderHistory": []
        }
        
    except Exception as e:
        logger.error(f"Failed to get live data: {e}")
        return {
            "balance": {"total": 0, "available": 0, "inOrder": 0},
            "positions": [],
            "orderHistory": []
        }

# FastAPI app
app = FastAPI(
    title="CTB Trading Bot - Simple PyBit Backend",
    description="Eenvoudige PyBit API integratie",
    version="2.0.0-simple"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "CTB Trading Bot - Simple PyBit Backend",
        "version": "2.0.0-simple",
        "status": "running",
        "pybit_available": PYBIT_AVAILABLE
    }

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "success": True,
        "message": "CTB Backend is running",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0-simple",
        "active_connections": len(connections_store),
        "pybit_available": PYBIT_AVAILABLE
    }

@app.post("/api/bybit/test-connection")
async def test_bybit_connection(credentials: ByBitCredentials):
    """Test ByBit API connection"""
    if not PYBIT_AVAILABLE:
        return {
            "success": True,
            "message": "Demo mode - connection would succeed",
            "testnet": credentials.testnet
        }
    
    try:
        session = HTTP(
            testnet=credentials.testnet,
            api_key=credentials.apiKey,
            api_secret=credentials.secretKey,
        )
        
        result = session.get_wallet_balance(accountType="UNIFIED")
        
        if result["retCode"] == 0:
            return {
                "success": True,
                "message": "Connection successful",
                "testnet": credentials.testnet
            }
        else:
            raise Exception(f"API Error: {result['retMsg']}")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/bybit/add-connection")
async def add_connection(connection: ConnectionCreate):
    """Add new ByBit connection"""
    try:
        # In demo mode, skip actual API test
        if PYBIT_AVAILABLE:
            # Test connection first
            session = HTTP(
                testnet=connection.testnet,
                api_key=connection.apiKey,
                api_secret=connection.secretKey,
            )
            result = session.get_wallet_balance(accountType="UNIFIED")
            if result["retCode"] != 0:
                raise Exception(f"API Error: {result['retMsg']}")
        
        # Store connection
        connections_store[connection.connectionId] = {
            "name": connection.name,
            "testnet": connection.testnet,
            "markets": connection.markets,
            "apiKey": connection.apiKey,
            "secretKey": connection.secretKey,
            "created_at": datetime.utcnow().isoformat(),
            "status": "active"
        }
        save_connections(connections_store)
        
        return {
            "success": True,
            "message": "Connection added successfully",
            "connectionId": connection.connectionId,
            "data": get_live_account_data(connection.apiKey, connection.secretKey, connection.testnet)
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/bybit/connections")
async def get_connections():
    """Get all connections"""
    connections = []
    
    for conn_id, conn_data in connections_store.items():
        connections.append({
            "connection_id": conn_id,
            "name": conn_data["name"],
            "testnet": conn_data["testnet"],
            "status": conn_data["status"],
            "created_at": conn_data["created_at"],
            "data": get_live_account_data(
                conn_data.get("apiKey", ""), 
                conn_data.get("secretKey", ""), 
                conn_data.get("testnet", False)
            )
        })
    
    return {"success": True, "connections": connections}

@app.get("/api/bybit/connection/{connection_id}")
async def get_connection(connection_id: str):
    """Get specific connection"""
    if connection_id not in connections_store:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    conn_data = connections_store[connection_id]
    
    return {
        "success": True,
        "data": {
            "connectionId": connection_id,
            "balance": {"total": 1000, "available": 950, "inOrder": 50},
            "positions": [],
            "orderHistory": [],
            "lastUpdated": datetime.utcnow().isoformat(),
            "metadata": conn_data
        }
    }

@app.delete("/api/bybit/connection/{connection_id}")
async def remove_connection(connection_id: str):
    """Remove connection"""
    if connection_id not in connections_store:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    del connections_store[connection_id]
    
    return {"success": True, "message": "Connection removed"}

@app.get("/api/market/tickers")
async def get_market_data():
    """Get market data"""
    # Demo market data
    demo_data = [
        {"symbol": "BTCUSDT", "price": 43000, "change24h": 500, "volume24h": 1000000},
        {"symbol": "ETHUSDT", "price": 2500, "change24h": -30, "volume24h": 500000},
        {"symbol": "SOLUSDT", "price": 85, "change24h": 2.5, "volume24h": 200000}
    ]
    
    return {"success": True, "data": demo_data}

@app.get("/api/portfolio/summary")
async def get_portfolio_summary():
    """Get portfolio summary"""
    return {
        "success": True,
        "summary": {
            "totalPortfolioValue": len(connections_store) * 1000,
            "totalPnL": 50,
            "activePositions": 0,
            "totalConnections": len(connections_store)
        }
    }

if __name__ == "__main__":
    print("🚀 Starting Simple CTB PyBit Backend")
    print("📍 Server: http://localhost:8000")
    print("📚 Docs: http://localhost:8000/docs")
    print("🔄 PyBit Available:", PYBIT_AVAILABLE)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")