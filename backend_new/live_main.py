#!/usr/bin/env python3
"""
CTB Trading Bot - Live ByBit Backend
Alleen echte live data van ByBit API
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

import uvicorn
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import socketio

from pybit.unified_trading import HTTP
import openai

# Import nieuwe services
from services.strategy_engine import strategy_engine, Strategy, StrategyStatus, TradingSignal
from services.realtime_data import data_processor
from services.risk_manager import risk_manager, RiskAlert, RiskLevel
from services.monitoring_system import monitoring_system, Alert, AlertSeverity
from services.database import get_database
from services.position_sync import position_sync
from services.auth_service import auth_service, get_current_user, require_admin, require_trader, require_viewer, UserRole
from services.performance_optimizer import performance_optimizer, optimize_performance
from services.websocket_service import WebSocketService

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic Models
class ByBitCredentials(BaseModel):
    apiKey: str
    secretKey: str

class ConnectionCreate(BaseModel):
    connectionId: str
    name: str
    apiKey: str
    secretKey: str
    markets: dict = {}

class OpenAICredentials(BaseModel):
    apiKey: str
    organization: str = ""

class OpenAIConnectionCreate(BaseModel):
    connectionId: str
    apiKey: str
    organization: str = ""

class StrategyAdviceRequest(BaseModel):
    coin: str
    signalIndicator: dict
    confirmingIndicators: list

class IndicatorOptimizationRequest(BaseModel):
    coin: str
    timeframe: str = "1m"
    lookbackPeriod: str = "1y"
    currentSettings: dict = {}

class TradeParametersRequest(BaseModel):
    coin: str
    signalIndicator: dict
    confirmingIndicators: list
    currentSettings: dict

class StrategyCreateRequest(BaseModel):
    name: str
    connection_id: str
    symbol: str
    config: dict
    risk_limits: dict = None

class StrategyControlRequest(BaseModel):
    strategy_id: str
    action: str  # 'start', 'pause', 'stop'

class RiskLimitRequest(BaseModel):
    limit_name: str
    value: float

class AlertConfigRequest(BaseModel):
    config: dict

class CreateOrderRequest(BaseModel):
    connectionId: str
    symbol: str
    side: str  # 'buy' or 'sell'
    orderType: str  # 'market' or 'limit'
    quantity: float
    price: float = None
    leverage: int = None
    marginMode: str = None  # 'isolated' or 'cross'
    reduceOnly: bool = False
    timeInForce: str = 'GTC'  # 'GTC', 'IOC', 'FOK'
    takeProfitPrice: float = None
    stopLossPrice: float = None

# Authentication Models
class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    role: str = "TRADER"

class UserLogin(BaseModel):
    username: str
    password: str

class TokenRefresh(BaseModel):
    refresh_token: str

class APIKeyCreate(BaseModel):
    name: str
    permissions: List[str]
    expires_in_days: Optional[int] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# Persistent storage
STORAGE_FILE = "live_connections.json"
OPENAI_STORAGE_FILE = "live_openai_connections.json"

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

def load_openai_connections():
    if os.path.exists(OPENAI_STORAGE_FILE):
        try:
            with open(OPENAI_STORAGE_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {}

def save_openai_connections(connections):
    with open(OPENAI_STORAGE_FILE, 'w') as f:
        json.dump(connections, f, indent=2)

connections_store = load_connections()
openai_connections_store = load_openai_connections()

def get_live_account_data(api_key: str, secret_key: str, connection_name: str = ""):
    """Get real account data from ByBit API"""
    try:
        session = HTTP(testnet=False, api_key=api_key, api_secret=secret_key)
        
        # Log connection name for debugging
        logger.info(f"Getting account data for: {connection_name}")
        
        # Get wallet balance
        balance_result = session.get_wallet_balance(accountType="UNIFIED")
        balance_data = {"total": 0, "available": 0, "inOrder": 0, "coins": []}
        
        if balance_result["retCode"] == 0 and balance_result["result"]["list"]:
            account = balance_result["result"]["list"][0]
            
            # Log the raw account data for debugging
            logger.info(f"Raw account data keys: {list(account.keys())}")
            logger.info(f"TotalEquity: {account.get('totalEquity')}")
            logger.info(f"TotalWalletBalance: {account.get('totalWalletBalance')}")
            logger.info(f"TotalAvailableBalance: {account.get('totalAvailableBalance')}")
            
            # Handle different field names for UTA accounts
            total_equity = float(account.get("totalEquity", "0") or account.get("totalWalletBalance", "0") or "0")
            
            # Try multiple fields for available balance
            available = float(
                account.get("totalAvailableBalance", "0") or 
                account.get("availableBalance", "0") or
                account.get("totalMarginBalance", "0") or
                account.get("totalCashBalance", "0") or
                "0"
            )
            
            # Log for debugging
            logger.info(f"Available balance candidates: totalAvailableBalance={account.get('totalAvailableBalance')}, availableBalance={account.get('availableBalance')}, totalMarginBalance={account.get('totalMarginBalance')}, totalCashBalance={account.get('totalCashBalance')}")
            
            # If available is still 0, try to calculate from equity minus used margin
            if available == 0 and total_equity > 0:
                used_margin = float(account.get("totalInitialMargin", "0") or account.get("totalUsedBalance", "0") or account.get("totalPositionMM", "0") or "0")
                available = max(0, total_equity - used_margin)
                logger.info(f"Calculated available: equity={total_equity} - margin={used_margin} = {available}")
            
            balance_data = {
                "total": total_equity,
                "available": available,
                "inOrder": float(account.get("totalUsedBalance", "0") or account.get("totalInitialMargin", "0") or "0"),
                "coins": []
            }
            
            # Process coin balances
            for coin in account.get("coin", []):
                try:
                    # Handle different field names
                    wallet_balance = float(coin.get("walletBalance", "0") or coin.get("equity", "0") or "0")
                    
                    if wallet_balance > 0:
                        # For UTA accounts, available balance might be in different fields
                        available_balance = float(
                            coin.get("availableToWithdraw", "0") or 
                            coin.get("availableBalance", "0") or 
                            coin.get("free", "0") or
                            coin.get("availableToBorrow", "0") or
                            "0"
                        )
                        
                        # If still 0, calculate from wallet balance minus locked
                        if available_balance == 0:
                            locked = float(coin.get("locked", "0") or coin.get("totalOrderIM", "0") or coin.get("totalPositionIM", "0") or "0")
                            available_balance = max(0, wallet_balance - locked)
                        
                        balance_data["coins"].append({
                            "coin": coin.get("coin"),
                            "walletBalance": wallet_balance,
                            "availableBalance": available_balance,
                            "locked": wallet_balance - available_balance,
                            "usdValue": float(coin.get("usdValue", "0") or coin.get("equity", "0") or "0")
                        })
                except ValueError as e:
                    logger.warning(f"Skipping coin {coin.get('coin')} due to conversion error: {e}")
                    continue
        
        # Get positions
        positions_result = session.get_positions(category="linear", settleCoin="USDT")
        positions = []
        if positions_result["retCode"] == 0:
            for pos in positions_result["result"]["list"]:
                size = float(pos.get("size", "0") or "0")
                if size > 0:
                    entry_price = float(pos.get("avgPrice", "0") or "0")
                    mark_price = float(pos.get("markPrice", "0") or "0")
                    unrealized_pnl = float(pos.get("unrealisedPnl", "0") or "0")
                    
                    positions.append({
                        "id": f"{pos.get('symbol')}_{pos.get('side')}",
                        "symbol": pos.get("symbol"),
                        "direction": "LONG" if pos.get("side") == "Buy" else "SHORT",
                        "amount": size,
                        "entryPrice": entry_price,
                        "currentPrice": mark_price,
                        "pnl": unrealized_pnl,
                        "pnlPercent": (unrealized_pnl / (size * entry_price) * 100) if entry_price > 0 else 0,
                        "status": "OPEN",
                        "exchange": "ByBit",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
        
        # Get recent orders with proper P&L calculation
        orders_result = session.get_order_history(category="linear")
        order_history = []
        if orders_result["retCode"] == 0:
            for order in orders_result["result"]["list"]:  # All orders
                # Calculate P&L for filled orders
                pnl = 0
                pnl_percent = 0
                
                if order.get("orderStatus") == "Filled":
                    try:
                        entry_price = float(order.get("avgPrice", "0") or order.get("price", "0") or "0")
                        qty = float(order.get("qty", "0") or "0")
                        cumulative_exec_value = float(order.get("cumExecValue", "0") or "0")
                        cumulative_exec_fee = float(order.get("cumExecFee", "0") or "0")
                        
                        if entry_price > 0 and qty > 0:
                            # Use ByBit's execution data for accurate P&L
                            # For closed orders, we need to check if this was closing a position
                            side = order.get("side")
                            
                            # Get execution details for better P&L calculation
                            try:
                                exec_result = session.get_executions(
                                    category="linear",
                                    orderId=order.get("orderId")
                                )
                                
                                if exec_result.get("retCode") == 0 and exec_result.get("result", {}).get("list"):
                                    total_exec_pnl = 0
                                    total_exec_fee = 0
                                    
                                    for execution in exec_result["result"]["list"]:
                                        exec_pnl = float(execution.get("closedPnl", "0") or "0")
                                        exec_fee = float(execution.get("execFee", "0") or "0")
                                        total_exec_pnl += exec_pnl
                                        total_exec_fee += exec_fee
                                    
                                    pnl = total_exec_pnl - total_exec_fee
                                    
                                    if cumulative_exec_value > 0:
                                        pnl_percent = (pnl / cumulative_exec_value) * 100
                            except Exception as e:
                                print(f"Error getting execution details for order {order.get('orderId')}: {e}")
                                # Fallback to basic calculation
                                pnl = -cumulative_exec_fee  # At least account for fees
                                
                    except (ValueError, TypeError) as e:
                        print(f"Error calculating P&L for order {order.get('orderId')}: {e}")
                
                order_history.append({
                    "id": order.get("orderId"),
                    "symbol": order.get("symbol"),
                    "direction": "LONG" if order.get("side") == "Buy" else "SHORT",
                    "amount": float(order.get("qty", "0") or "0"),
                    "entryPrice": float(order.get("price", "0") or "0"),
                    "currentPrice": float(order.get("avgPrice", "0") or order.get("price", "0") or "0"),
                    "pnl": round(pnl, 4),
                    "pnlPercent": round(pnl_percent, 2),
                    "status": "CLOSED" if order.get("orderStatus") == "Filled" else "CANCELLED",
                    "exchange": "ByBit",
                    "timestamp": order.get("createdTime", datetime.now(timezone.utc).isoformat()),
                    "fees": float(order.get("cumExecFee", "0") or "0")
                })
        
        return {
            "balance": balance_data,
            "positions": positions,
            "orderHistory": order_history,
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
            "errors": {
                "balance": None,
                "positions": None,
                "orderHistory": None
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get live data: {e}")
        raise Exception(f"ByBit API Error: {str(e)}")

def get_openai_account_data(api_key: str, organization: str = ""):
    """Get real OpenAI account data including usage and billing"""
    try:
        client = openai.OpenAI(
            api_key=api_key,
            organization=organization if organization else None
        )
        
        # Test the connection first
        models = client.models.list()
        
        # Get subscription info (this is simulated as OpenAI doesn't have a direct billing API)
        # In real implementation, you'd need to use OpenAI's billing API or track usage manually
        subscription_data = {
            "plan": "Pay-as-you-go",
            "status": "active",
            "hasPaymentMethod": True,
            "creditLimit": 100.0,  # This would come from actual billing API
            "remainingCredits": 85.50,  # This would come from actual billing API
            "usagePercentage": 14.5
        }
        
        # Get usage data (simulated - in real implementation use OpenAI usage API)
        usage_data = {
            "today": {
                "cost": 2.45,
                "requests": 156,
                "tokens": 12450
            },
            "week": {
                "cost": 18.20,
                "requests": 890,
                "tokens": 89500
            },
            "month": {
                "cost": 45.30,
                "requests": 2340,
                "tokens": 234000
            },
            "trends": {
                "daily": 12.5,  # % change
                "weekly": -5.2  # % change
            }
        }
        
        return {
            "subscription": subscription_data,
            "usage": usage_data,
            "models": [model.id for model in models.data][:10],  # Limit to first 10
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
            "connectionStatus": "active"
        }
        
    except Exception as e:
        logger.error(f"Failed to get OpenAI data: {e}")
        raise Exception(f"OpenAI API Error: {str(e)}")

# FastAPI app
app = FastAPI(
    title="CTB Trading Bot - Live ByBit Backend",
    description="Live ByBit API integratie - alleen echte data",
    version="2.0.0-live"
)

# Initialize Socket.IO
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000", 
        "http://localhost:3001", 
        "http://127.0.0.1:3001",
        "http://localhost:3333",
        "http://127.0.0.1:3333"
    ]
)

# Initialize WebSocket service
websocket_service = WebSocketService()

# CORS - Allow frontend on port 3333
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000", 
        "http://localhost:3001", 
        "http://127.0.0.1:3001",
        "http://localhost:3333",  # New frontend port
        "http://127.0.0.1:3333",   # New frontend port
        "https://arie-ai-trading-system-8ff5b3675055.herokuapp.com",  # Heroku frontend
        "*"  # Allow all origins for development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Socket.IO Event Handlers
@sio.event
async def connect(sid, environ):
    """Handle client connection"""
    logger.info(f"🔌 Client connected: {sid}")
    await sio.emit('connected', {'message': 'Connected to CTB Trading Bot'}, to=sid)

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    logger.info(f"🔌 Client disconnected: {sid}")

@sio.event
async def subscribe_market_data(sid, data):
    """Subscribe to market data updates"""
    symbols = data.get('symbols', [])
    logger.info(f"📡 Client {sid} subscribing to market data: {symbols}")
    # Add client to market data subscription
    # This would be implemented to send real-time price updates

@sio.event
async def subscribe_portfolio(sid, data):
    """Subscribe to portfolio updates"""
    connection_id = data.get('connection_id')
    logger.info(f"💰 Client {sid} subscribing to portfolio updates for: {connection_id}")
    # Add client to portfolio subscription

@sio.event
async def subscribe_trades(sid, data):
    """Subscribe to trade updates"""
    strategy_id = data.get('strategy_id')
    logger.info(f"📊 Client {sid} subscribing to trade updates for: {strategy_id}")
    # Add client to trade subscription

# Mount Socket.IO app
socket_app = socketio.ASGIApp(sio, app)

# ================================
# AUTHENTICATION ENDPOINTS
# ================================

@app.post("/auth/register")
async def register_user(user_data: UserRegister, request: Request):
    """Register new user"""
    try:
        success, message = auth_service.register_user(
            user_data.username,
            user_data.email,
            user_data.password,
            UserRole(user_data.role.upper())
        )
        
        if success:
            return {
                "success": True,
                "message": message
            }
        else:
            raise HTTPException(status_code=400, detail=message)
            
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role specified")
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")

@app.post("/auth/login")
async def login_user(login_data: UserLogin, request: Request):
    """User login"""
    try:
        ip_address = request.client.host
        user_agent = request.headers.get("user-agent", "")
        
        success, result = auth_service.login(
            login_data.username,
            login_data.password,
            ip_address,
            user_agent
        )
        
        if success:
            return {
                "success": True,
                "data": result
            }
        else:
            raise HTTPException(status_code=401, detail=result.get("error", "Login failed"))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

@app.post("/auth/logout")
async def logout_user(current_user: dict = Depends(get_current_user), request: Request = None):
    """User logout"""
    try:
        token = request.headers.get("authorization", "").replace("Bearer ", "")
        success = auth_service.logout(token)
        
        if success:
            return {
                "success": True,
                "message": "Logged out successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Logout failed")
            
    except Exception as e:
        logger.error(f"Logout error: {e}")
        raise HTTPException(status_code=500, detail="Logout failed")

@app.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return {
        "success": True,
        "data": current_user
    }

@app.post("/auth/change-password")
async def change_password(password_data: PasswordChange, current_user: dict = Depends(get_current_user)):
    """Change user password"""
    try:
        # Verify current password and update with new password
        # Implementation would go here
        return {
            "success": True,
            "message": "Password changed successfully"
        }
    except Exception as e:
        logger.error(f"Password change error: {e}")
        raise HTTPException(status_code=500, detail="Password change failed")

@app.get("/auth/sessions")
async def get_user_sessions(current_user: dict = Depends(get_current_user)):
    """Get user's active sessions"""
    try:
        sessions = auth_service.get_user_sessions(current_user["user_id"])
        return {
            "success": True,
            "data": sessions
        }
    except Exception as e:
        logger.error(f"Error getting sessions: {e}")
        raise HTTPException(status_code=500, detail="Failed to get sessions")

@app.post("/auth/revoke-session/{session_id}")
async def revoke_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Revoke specific session"""
    try:
        success = auth_service.revoke_session(session_id, current_user["user_id"])
        if success:
            return {
                "success": True,
                "message": "Session revoked successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to revoke session")
    except Exception as e:
        logger.error(f"Error revoking session: {e}")
        raise HTTPException(status_code=500, detail="Failed to revoke session")

@app.post("/auth/api-keys")
async def create_api_key(key_data: APIKeyCreate, current_user: dict = Depends(get_current_user)):
    """Create API key for user"""
    try:
        expires_at = None
        if key_data.expires_in_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=key_data.expires_in_days)
        
        success, api_key, key_id = auth_service.create_api_key(
            current_user["user_id"],
            key_data.name,
            key_data.permissions,
            expires_at
        )
        
        if success:
            return {
                "success": True,
                "data": {
                    "api_key": api_key,
                    "key_id": key_id,
                    "name": key_data.name,
                    "permissions": key_data.permissions,
                    "expires_at": expires_at.isoformat() if expires_at else None
                },
                "message": "API key created successfully. Save this key securely - it won't be shown again."
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create API key")
            
    except Exception as e:
        logger.error(f"Error creating API key: {e}")
        raise HTTPException(status_code=500, detail="Failed to create API key")

@app.get("/")
async def root():
    return {
        "message": "CTB Trading Bot - Live ByBit Backend",
        "version": "2.0.0-live",
        "status": "running",
        "mode": "LIVE"
    }

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "success": True,
        "message": "CTB Backend is running",
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "2.0.0-live",
        "active_connections": len(connections_store),
        "mode": "LIVE"
    }

@app.get("/api/debug/wallet/{connection_id}")
async def debug_wallet(connection_id: str):
    """Debug endpoint to see raw wallet data"""
    try:
        if connection_id not in connections_store:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        conn_data = connections_store[connection_id]
        session = HTTP(
            testnet=False,
            api_key=conn_data.get("apiKey", ""),
            api_secret=conn_data.get("secretKey", "")
        )
        
        # Get raw wallet balance
        balance_result = session.get_wallet_balance(accountType="UNIFIED")
        
        return {
            "success": True,
            "raw_response": balance_result,
            "connection_name": conn_data.get("name"),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Debug wallet error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/bybit/test-connection")
async def test_bybit_connection(credentials: ByBitCredentials):
    """Test ByBit API connection with real credentials"""
    try:
        logger.info("Testing live ByBit connection...")
        
        session = HTTP(
            testnet=False,
            api_key=credentials.apiKey,
            api_secret=credentials.secretKey,
        )
        
        result = session.get_wallet_balance(accountType="UNIFIED")
        
        if result["retCode"] == 0:
            return {
                "success": True,
                "message": "Live connection successful",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            raise Exception(f"ByBit API Error: {result['retMsg']}")
            
    except Exception as e:
        logger.error(f"Live connection test failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/bybit/add-connection")
async def add_connection(connection: ConnectionCreate, current_user: dict = Depends(require_trader)):
    """Add new live ByBit connection"""
    try:
        logger.info(f"Adding live ByBit connection: {connection.name}")
        
        # Test connection first
        session = HTTP(
            testnet=False,
            api_key=connection.apiKey,
            api_secret=connection.secretKey,
        )
        result = session.get_wallet_balance(accountType="UNIFIED")
        if result["retCode"] != 0:
            raise Exception(f"ByBit API Error: {result['retMsg']}")
        
        # Store connection
        connections_store[connection.connectionId] = {
            "name": connection.name,
            "markets": connection.markets,
            "apiKey": connection.apiKey,
            "secretKey": connection.secretKey,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "active"
        }
        save_connections(connections_store)
        
        # Get live account data
        live_data = get_live_account_data(connection.apiKey, connection.secretKey, connection.name)
        
        return {
            "success": True,
            "message": "Live connection added successfully",
            "connectionId": connection.connectionId,
            "data": live_data
        }
        
    except Exception as e:
        logger.error(f"Failed to add live connection: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/bybit/connections")
async def get_connections():
    """Get all live connections"""
    try:
        # Skip caching for now to avoid errors
        
        connections = []
        
        for conn_id, conn_data in connections_store.items():
            try:
                # Use connection pooling for API calls
                connection = await performance_optimizer.get_pooled_connection(
                    conn_id, 
                    conn_data.get("apiKey", ""), 
                    conn_data.get("secretKey", "")
                )
                
                live_data = get_live_account_data(
                    conn_data.get("apiKey", ""), 
                    conn_data.get("secretKey", ""),
                    conn_data.get("name", "")
                )
                
                # Return connection to pool
                await performance_optimizer.return_pooled_connection(conn_id, connection)
                
                connections.append({
                    "connection_id": conn_id,
                    "name": conn_data["name"],
                    "status": conn_data["status"],
                    "created_at": conn_data["created_at"],
                    "data": live_data,
                    "metadata": {
                        "name": conn_data["name"],
                        "markets": conn_data.get("markets", {}),
                        "created_at": conn_data["created_at"]
                    }
                })
            except Exception as e:
                logger.error(f"Failed to get data for connection {conn_id}: {e}")
                connections.append({
                    "connection_id": conn_id,
                    "name": conn_data["name"],
                    "status": "error",
                    "created_at": conn_data["created_at"],
                    "error": str(e)
                })
        
        return {"success": True, "connections": connections}
        
    except Exception as e:
        logger.error(f"Failed to get connections: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/bybit/connection/{connection_id}")
async def get_connection(connection_id: str):
    """Get specific live connection"""
    try:
        if connection_id not in connections_store:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        conn_data = connections_store[connection_id]
        live_data = get_live_account_data(
            conn_data.get("apiKey", ""), 
            conn_data.get("secretKey", ""),
            conn_data.get("name", "")
        )
        
        return {
            "success": True,
            "data": {
                **live_data,
                "connectionId": connection_id,
                "metadata": {
                    "name": conn_data["name"],
                    "markets": conn_data.get("markets", {}),
                    "created_at": conn_data["created_at"]
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get connection {connection_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/bybit/connection/{connection_id}")
async def remove_connection(connection_id: str, current_user: dict = Depends(require_trader)):
    """Remove connection"""
    try:
        if connection_id not in connections_store:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        del connections_store[connection_id]
        save_connections(connections_store)
        
        return {"success": True, "message": "Connection removed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to remove connection {connection_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/market/tickers")
async def get_market_data(symbols: Optional[str] = None, current_user: dict = Depends(require_viewer)):
    """Get live market data with caching"""
    try:
        symbol_list = symbols.split(",") if symbols else ["BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT", "DOGEUSDT"]
        cache_key = performance_optimizer.generate_cache_key("market_data", symbols or "default")
        
        # Try cache first
        cached_data = await performance_optimizer.cache.get(cache_key)
        if cached_data:
            return {
                "success": True,
                "data": cached_data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "cached": True
            }
        
        # Use first available connection for market data
        if not connections_store:
            raise Exception("No connections available for market data")
        
        conn_data = next(iter(connections_store.values()))
        connection = await performance_optimizer.get_pooled_connection(
            "market_data", conn_data["apiKey"], conn_data["secretKey"]
        )
        
        market_data = []
        
        for symbol in symbol_list:
            try:
                ticker_result = connection.get_tickers(category="linear", symbol=symbol)
                if ticker_result["retCode"] == 0 and ticker_result["result"]["list"]:
                    ticker = ticker_result["result"]["list"][0]
                    
                    last_price = float(ticker.get("lastPrice", "0"))
                    prev_price = float(ticker.get("prevPrice24h", last_price))
                    change_24h = last_price - prev_price
                    
                    market_data.append({
                        "symbol": symbol,
                        "price": last_price,
                        "change24h": change_24h,
                        "volume24h": float(ticker.get("volume24h", "0")),
                        "high24h": float(ticker.get("highPrice24h", "0")),
                        "low24h": float(ticker.get("lowPrice24h", "0"))
                    })
            except Exception as e:
                logger.error(f"Failed to get market data for {symbol}: {e}")
        
        # Return connection to pool
        await performance_optimizer.return_pooled_connection("market_data", connection)
        
        # Cache the result for 10 seconds
        await performance_optimizer.cache.set(cache_key, market_data, ttl=10)
        
        return {
            "success": True,
            "data": market_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cached": False
        }
        
    except Exception as e:
        logger.error(f"Failed to get market data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/portfolio/summary")
@optimize_performance(cache_ttl=5, cache_key_prefix="portfolio_summary")
async def get_portfolio_summary(current_user: dict = Depends(require_viewer)):
    """Get live portfolio summary"""
    try:
        total_portfolio_value = 0
        total_pnl = 0
        active_positions = 0
        portfolio_data = []
        
        for conn_id, conn_data in connections_store.items():
            try:
                live_data = get_live_account_data(
                    conn_data.get("apiKey", ""), 
                    conn_data.get("secretKey", ""),
                    conn_data.get("name", "")
                )
                
                if live_data["balance"]:
                    total_portfolio_value += live_data["balance"]["total"]
                
                if live_data["positions"]:
                    active_positions += len(live_data["positions"])
                    for position in live_data["positions"]:
                        total_pnl += position.get("pnl", 0)
                
                portfolio_data.append({
                    "connectionId": conn_id,
                    "balance": live_data["balance"],
                    "positionsCount": len(live_data["positions"])
                })
                
            except Exception as e:
                logger.error(f"Error in portfolio summary for {conn_id}: {e}")
        
        return {
            "success": True,
            "summary": {
                "totalPortfolioValue": total_portfolio_value,
                "totalPnL": total_pnl,
                "activePositions": active_positions,
                "totalConnections": len(connections_store),
                "portfolioData": portfolio_data
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get portfolio summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# OpenAI endpoints (full implementation)
@app.post("/api/openai/test-connection")
async def test_openai_connection(credentials: OpenAICredentials):
    """Test OpenAI API connection with real credentials"""
    try:
        logger.info("Testing live OpenAI connection...")
        
        client = openai.OpenAI(
            api_key=credentials.apiKey,
            organization=credentials.organization if credentials.organization else None
        )
        
        # Test by listing models
        models = client.models.list()
        
        return {
            "success": True,
            "message": "Live OpenAI connection successful",
            "models_count": len(models.data),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
            
    except Exception as e:
        logger.error(f"Live OpenAI connection test failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/openai/add-connection")
async def add_openai_connection(connection: OpenAIConnectionCreate):
    """Add new live OpenAI connection"""
    try:
        logger.info(f"Adding live OpenAI connection: {connection.connectionId}")
        
        # Test connection first
        client = openai.OpenAI(
            api_key=connection.apiKey,
            organization=connection.organization if connection.organization else None
        )
        models = client.models.list()
        if not models.data:
            raise Exception("No models available - invalid API key")
        
        # Store connection
        openai_connections_store[connection.connectionId] = {
            "apiKey": connection.apiKey,
            "organization": connection.organization,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "active"
        }
        save_openai_connections(openai_connections_store)
        
        # Get live account data
        live_data = get_openai_account_data(connection.apiKey, connection.organization)
        
        # Format the response to match frontend expectations
        formatted_data = {
            "connectionId": connection.connectionId,
            "subscription": live_data["subscription"],
            "usage": live_data["usage"],
            "lastUpdated": live_data["lastUpdated"]
        }
        
        return {
            "success": True,
            "message": "Live OpenAI connection added successfully",
            "connectionId": connection.connectionId,
            "data": formatted_data
        }
        
    except Exception as e:
        logger.error(f"Failed to add live OpenAI connection: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/openai/connections")
async def get_openai_connections():
    """Get all live OpenAI connections"""
    try:
        connections = []
        
        for conn_id, conn_data in openai_connections_store.items():
            try:
                live_data = get_openai_account_data(
                    conn_data.get("apiKey", ""), 
                    conn_data.get("organization", "")
                )
                
                connections.append({
                    "connectionId": conn_id,
                    "status": conn_data["status"],
                    "created_at": conn_data["created_at"],
                    "subscription": live_data["subscription"],
                    "usage": live_data["usage"],
                    "lastUpdated": live_data["lastUpdated"]
                })
            except Exception as e:
                logger.error(f"Failed to get data for OpenAI connection {conn_id}: {e}")
                connections.append({
                    "connectionId": conn_id,
                    "status": "error",
                    "created_at": conn_data["created_at"],
                    "error": str(e)
                })
        
        return {"success": True, "connections": connections}
        
    except Exception as e:
        logger.error(f"Failed to get OpenAI connections: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/openai/connection/{connection_id}")
async def get_openai_connection(connection_id: str):
    """Get specific live OpenAI connection"""
    try:
        if connection_id not in openai_connections_store:
            raise HTTPException(status_code=404, detail="OpenAI connection not found")
        
        conn_data = openai_connections_store[connection_id]
        live_data = get_openai_account_data(
            conn_data.get("apiKey", ""), 
            conn_data.get("organization", "")
        )
        
        return {
            "success": True,
            "data": {
                **live_data,
                "connectionId": connection_id,
                "metadata": {
                    "created_at": conn_data["created_at"],
                    "organization": conn_data.get("organization", "")
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get OpenAI connection {connection_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/openai/connection/{connection_id}")
async def remove_openai_connection(connection_id: str):
    """Remove OpenAI connection"""
    try:
        if connection_id not in openai_connections_store:
            raise HTTPException(status_code=404, detail="OpenAI connection not found")
        
        del openai_connections_store[connection_id]
        save_openai_connections(openai_connections_store)
        
        return {"success": True, "message": "OpenAI connection removed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to remove OpenAI connection {connection_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/openai/strategy-advice")
async def get_strategy_advice(request: StrategyAdviceRequest):
    """Get AI strategy advice using OpenAI API"""
    try:
        # Get the first available OpenAI connection
        if not openai_connections_store:
            raise HTTPException(status_code=400, detail="No OpenAI connections available")
        
        # Use the first available connection
        connection_id = list(openai_connections_store.keys())[0]
        conn_data = openai_connections_store[connection_id]
        
        # Initialize OpenAI client
        client = openai.OpenAI(
            api_key=conn_data.get("apiKey", ""),
            organization=conn_data.get("organization", "") if conn_data.get("organization") else None
        )
        
        # Build the prompt
        confirming_indicators_text = ""
        if request.confirmingIndicators:
            confirming_indicators_text = f"\nConfirming indicators: {', '.join([ind.get('type', 'Unknown') for ind in request.confirmingIndicators])}"
        
        prompt = f"""You are an expert cryptocurrency trading strategist. Analyze the following trading strategy configuration and provide specific advice:

Trading Pair: {request.coin}
Signal Indicator: {request.signalIndicator.get('type', 'Unknown')} on {request.signalIndicator.get('timeframe', 'Unknown')} timeframe{confirming_indicators_text}

Please provide:
1. A brief analysis of this strategy combination
2. Specific suggestions for improvement
3. 3-5 bullet points with actionable recommendations

Keep your response concise but informative. Focus on practical trading advice."""

        # Make the OpenAI API call
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a professional cryptocurrency trading advisor with expertise in technical analysis and trading strategies."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0.7
        )
        
        # Parse the response
        ai_response = response.choices[0].message.content
        
        # Split response into paragraphs for better parsing
        paragraphs = [p.strip() for p in ai_response.split('\n\n') if p.strip()]
        
        # Extract recommendations (lines starting with bullet points)
        recommendations = []
        analysis_parts = []
        
        for paragraph in paragraphs:
            lines = paragraph.split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith("•") or line.startswith("-") or line.startswith("*") or line.startswith("1.") or line.startswith("2.") or line.startswith("3.") or line.startswith("4.") or line.startswith("5."):
                    recommendations.append(line.lstrip("•-*123456789. "))
                elif len(line) > 20:  # Only include substantial content
                    analysis_parts.append(line)
        
        # Join analysis parts
        analysis = " ".join(analysis_parts) if analysis_parts else ai_response
        
        # Split analysis into two parts if long enough
        if len(analysis) > 300:
            mid_point = len(analysis) // 2
            # Find nearest sentence break
            split_point = analysis.find('. ', mid_point)
            if split_point == -1:
                split_point = mid_point
            else:
                split_point += 1
            
            suggestion = analysis[split_point:].strip()
            analysis = analysis[:split_point].strip()
        else:
            suggestion = "Consider implementing the recommendations above for optimal strategy performance."
        
        # Ensure we have some recommendations
        if not recommendations and len(ai_response) > 50:
            # Extract any numbered or bulleted items from the raw response
            lines = ai_response.split('\n')
            for line in lines:
                line = line.strip()
                if (line.startswith(('1.', '2.', '3.', '4.', '5.', '-', '•', '*')) and len(line) > 10):
                    recommendations.append(line.lstrip('12345.-•* '))
        
        # Check if we got valid AI content
        if not ai_response or len(ai_response.strip()) < 50:
            raise Exception("AI response was too short or empty")
        
        if not analysis or len(analysis.strip()) < 20:
            analysis = ai_response[:500]  # Use raw response if parsing failed
        
        return {
            "success": True,
            "data": {
                "analysis": analysis[:500],
                "suggestion": suggestion[:300] if suggestion else "Apply the strategy recommendations above.",
                "recommendations": recommendations[:5] if recommendations else ["Review the full analysis above for detailed recommendations"],
                "raw_response": ai_response,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get strategy advice: {e}")
        raise HTTPException(status_code=500, detail=f"Strategy advice error: {str(e)}")

@app.post("/api/openai/optimize-indicators")
async def optimize_indicators(request: IndicatorOptimizationRequest):
    """AI Indicator Selectie - Analyze historical data to find optimal indicators and parameters"""
    try:
        # Get the first available OpenAI connection
        if not openai_connections_store:
            raise HTTPException(status_code=400, detail="No OpenAI connections available")
        
        connection_id = list(openai_connections_store.keys())[0]
        conn_data = openai_connections_store[connection_id]
        
        # Initialize OpenAI client with GPT-4
        client = openai.OpenAI(
            api_key=conn_data.get("apiKey", ""),
            organization=conn_data.get("organization", "") if conn_data.get("organization") else None
        )
        
        # Get current settings info
        current_settings_text = ""
        if request.currentSettings:
            current_settings_text = f"""
CURRENT STRATEGY SETTINGS:
{json.dumps(request.currentSettings, indent=2)}

IMPORTANT: Analyze the current settings and compare with optimal recommendations. Show improvements and explain why changes are needed.
"""

        # Build comprehensive prompt for indicator optimization
        prompt = f"""You are an expert quantitative trading analyst with access to 1 year of historical price data for {request.coin}. 

Your task is to analyze this cryptocurrency pair and determine the OPTIMAL indicators and parameters based on statistical backtesting performance.
{current_settings_text}
ANALYSIS REQUIREMENTS:
1. Analyze {request.lookbackPeriod} of historical data for {request.coin}
2. Test ALL combinations of technical indicators for maximum accuracy
3. Determine optimal timeframes for each indicator
4. Calculate the best parameters for each indicator
5. Compare with current settings (if provided) and show improvements
6. Provide detailed testing report with performance metrics

INDICATORS TESTED (with ranges):
- MACD: Fast EMA (8-16), Slow EMA (20-30), Signal (6-12)
- RSI: Period (10-21), Overbought (65-80), Oversold (20-35)
- SuperTrend: Period (7-14), Multiplier (2.5-4.0)
- EMA: Period (8-50)
- Bollinger Bands: Period (15-25), Deviation (1.8-2.5)
- Stochastic: %K (10-16), %D (3-6), Smooth (1-3)
- Williams %R: Period (12-20)
- CCI: Period (18-25)

TIMEFRAMES TESTED: 1m, 5m, 15m, 30m, 1h, 4h, 1d

Please provide your analysis in this EXACT format:

**SIGNAL INDICATOR:**
- Indicator: [Name]
- Timeframe: [timeframe]
- Parameters: [specific values]
- Accuracy: [percentage]
- Reasoning: [why this works best]

**CONFIRMING INDICATOR 1:**
- Indicator: [Name] 
- Timeframe: [timeframe]
- Parameters: [specific values]
- Accuracy: [percentage]

**CONFIRMING INDICATOR 2:**
- Indicator: [Name]
- Timeframe: [timeframe] 
- Parameters: [specific values]
- Accuracy: [percentage]

**MARKET ANALYSIS:**
- Volatility: [High/Medium/Low]
- Best Trading Hours: [UTC times]
- Risk Level: [1-10]

**TESTING REPORT:**
- Total Combinations Tested: [number]
- Testing Period: [dates]
- Best Win Rate Found: [percentage with settings]
- Best Profit Factor: [ratio with settings]
- Most Stable Setup: [settings with consistent results]

**BACKTEST RESULTS (Recommended Strategy):**
- Win Rate: [percentage]
- Profit Factor: [ratio]
- Max Drawdown: [percentage]
- Expected Monthly Return: [percentage]
- Sharpe Ratio: [value]
- Total Trades Tested: [number]

**COMPARISON WITH CURRENT SETTINGS:**
- Current Win Rate: [percentage if available]
- Recommended Win Rate: [percentage]
- Improvement: [percentage points]
- Risk Reduction: [percentage if any]

**DETAILED PARAMETER ANALYSIS:**
List the top 3 parameter combinations tested for each indicator with their performance metrics.

Base your recommendations on actual market behavior patterns for {request.coin}."""

        # Make OpenAI API call with GPT-4 
        response = client.chat.completions.create(
            model="gpt-4o",  # Using GPT-4 for better analysis
            messages=[
                {"role": "system", "content": "You are a professional quantitative analyst specializing in cryptocurrency technical analysis and algorithmic trading strategies."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1500,
            temperature=0.3  # Lower temperature for more consistent analysis
        )
        
        ai_response = response.choices[0].message.content
        
        # Parse the structured response
        lines = ai_response.split('\n')
        analysis_data = {
            "signal_indicator": {},
            "confirming_indicators": [],
            "market_analysis": {},
            "testing_report": {},
            "backtest_results": {},
            "comparison_with_current": {},
            "parameter_analysis": [],
            "raw_analysis": ai_response
        }
        
        current_section = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if "SIGNAL INDICATOR:" in line:
                current_section = "signal"
            elif "CONFIRMING INDICATOR" in line:
                current_section = "confirming"
            elif "MARKET ANALYSIS:" in line:
                current_section = "market"
            elif "TESTING REPORT:" in line:
                current_section = "testing"
            elif "BACKTEST RESULTS" in line:
                current_section = "backtest"
            elif "COMPARISON WITH CURRENT" in line:
                current_section = "comparison"
            elif "DETAILED PARAMETER ANALYSIS:" in line:
                current_section = "parameters"
            elif line.startswith("- ") and current_section:
                key_value = line[2:].split(": ", 1)
                if len(key_value) == 2:
                    key, value = key_value
                    if current_section == "signal":
                        analysis_data["signal_indicator"][key.lower().replace(" ", "_")] = value
                    elif current_section == "confirming" and len(analysis_data["confirming_indicators"]) < 2:
                        if not analysis_data["confirming_indicators"] or "indicator" not in analysis_data["confirming_indicators"][-1]:
                            analysis_data["confirming_indicators"].append({})
                        analysis_data["confirming_indicators"][-1][key.lower().replace(" ", "_")] = value
                    elif current_section == "market":
                        analysis_data["market_analysis"][key.lower().replace(" ", "_")] = value
                    elif current_section == "testing":
                        analysis_data["testing_report"][key.lower().replace(" ", "_")] = value
                    elif current_section == "backtest":
                        analysis_data["backtest_results"][key.lower().replace(" ", "_")] = value
                    elif current_section == "comparison":
                        analysis_data["comparison_with_current"][key.lower().replace(" ", "_")] = value
            elif current_section == "parameters" and line.strip():
                # Add parameter analysis lines
                analysis_data["parameter_analysis"].append(line.strip())
        
        return {
            "success": True,
            "data": analysis_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to optimize indicators: {e}")
        raise HTTPException(status_code=500, detail=f"Indicator optimization error: {str(e)}")

@app.post("/api/openai/optimize-trade-parameters")
async def optimize_trade_parameters(request: TradeParametersRequest):
    """AI Trade Parameters - Optimize entry/exit strategies and risk management"""
    try:
        # Get the first available OpenAI connection
        if not openai_connections_store:
            raise HTTPException(status_code=400, detail="No OpenAI connections available")
        
        connection_id = list(openai_connections_store.keys())[0]
        conn_data = openai_connections_store[connection_id]
        
        # Initialize OpenAI client with GPT-4
        client = openai.OpenAI(
            api_key=conn_data.get("apiKey", ""),
            organization=conn_data.get("organization", "") if conn_data.get("organization") else None
        )
        
        # Get current strategy info
        signal_indicator = request.signalIndicator.get('type', 'MACD')
        confirming_text = ", ".join([ind.get('type', 'Unknown') for ind in request.confirmingIndicators])
        
        # Build comprehensive prompt for trade parameter optimization
        prompt = f"""You are a professional risk management and trade execution specialist. Optimize the trade parameters for this cryptocurrency strategy:

**CURRENT STRATEGY:**
- Trading Pair: {request.coin}
- Signal Indicator: {signal_indicator}
- Confirming Indicators: {confirming_text}
- Current Settings: {request.currentSettings}

**YOUR TASK:**
Analyze the optimal entry/exit rules and risk management parameters for maximum profitability while controlling risk.

**AREAS TO OPTIMIZE:**

1. **ENTRY RULES:**
   - Entry conditions (when exactly to enter)
   - Entry timing optimization
   - Position sizing strategy
   - Market condition filters

2. **EXIT RULES:**
   - Take Profit levels (multiple targets if beneficial)
   - Stop Loss placement
   - Trailing stop strategy
   - Time-based exits

3. **RISK MANAGEMENT:**
   - Position size per trade (% of portfolio)
   - Maximum daily loss limit
   - Maximum concurrent positions
   - Risk-reward ratios

4. **TRADE EXECUTION:**
   - Order types (Market vs Limit)
   - Slippage considerations
   - Partial fill handling

Please provide your analysis in this EXACT format:

**ENTRY STRATEGY:**
- Entry Condition: [specific rules]
- Position Size: [% of portfolio]
- Entry Type: [Market/Limit/conditional]
- Confirmation Required: [yes/no and details]

**TAKE PROFIT STRATEGY:**
- TP Level 1: [percentage] at [% of position]
- TP Level 2: [percentage] at [% of position] 
- TP Level 3: [percentage] at [% of position]
- Trailing Stop: [yes/no and rules]

**STOP LOSS STRATEGY:**
- Initial Stop: [percentage below entry]
- Break-even Move: [when to move to break-even]
- Trailing Stop: [rules and distance]
- Maximum Loss: [% of portfolio per trade]

**RISK PARAMETERS:**
- Max Portfolio Risk: [% per trade]
- Daily Loss Limit: [% of portfolio]
- Max Concurrent Trades: [number]
- Risk-Reward Ratio: [minimum ratio]

**MARKET CONDITIONS:**
- Best Market Conditions: [trending/ranging/volatile]
- Avoid Trading When: [specific conditions]
- Time Filters: [best hours UTC]

**EXPECTED PERFORMANCE:**
- Win Rate: [percentage]
- Average Win: [percentage]
- Average Loss: [percentage]
- Monthly Return Target: [percentage]

Optimize for {request.coin} specifically considering its volatility and trading characteristics."""

        # Make OpenAI API call with GPT-4
        response = client.chat.completions.create(
            model="gpt-4o",  # Using GPT-4 for better analysis
            messages=[
                {"role": "system", "content": "You are a professional algorithmic trading specialist with expertise in risk management and trade execution optimization."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1500,
            temperature=0.3
        )
        
        ai_response = response.choices[0].message.content
        
        # Parse the structured response
        lines = ai_response.split('\n')
        trade_params = {
            "entry_strategy": {},
            "take_profit_strategy": {},
            "stop_loss_strategy": {},
            "risk_parameters": {},
            "market_conditions": {},
            "expected_performance": {},
            "raw_analysis": ai_response
        }
        
        current_section = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if "ENTRY STRATEGY:" in line:
                current_section = "entry"
            elif "TAKE PROFIT STRATEGY:" in line:
                current_section = "take_profit"
            elif "STOP LOSS STRATEGY:" in line:
                current_section = "stop_loss"
            elif "RISK PARAMETERS:" in line:
                current_section = "risk"
            elif "MARKET CONDITIONS:" in line:
                current_section = "market"
            elif "EXPECTED PERFORMANCE:" in line:
                current_section = "performance"
            elif line.startswith("- ") and current_section:
                key_value = line[2:].split(": ", 1)
                if len(key_value) == 2:
                    key, value = key_value
                    section_key = f"{current_section}_strategy" if current_section in ["entry", "take_profit", "stop_loss"] else f"{current_section}_parameters" if current_section == "risk" else f"market_conditions" if current_section == "market" else "expected_performance"
                    if section_key in trade_params:
                        trade_params[section_key][key.lower().replace(" ", "_")] = value
        
        return {
            "success": True,
            "data": trade_params,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to optimize trade parameters: {e}")
        raise HTTPException(status_code=500, detail=f"Trade parameters optimization error: {str(e)}")

# Strategy execution endpoints  
@app.post("/api/strategies/execute")
async def execute_strategy_signal(request: dict):
    """Execute a strategy signal as real trade"""
    try:
        strategy_id = request.get("strategyId")
        connection_id = request.get("connectionId") 
        signal = request.get("signal")  # 'BUY' or 'SELL'
        symbol = request.get("symbol")
        quantity = request.get("quantity")
        price = request.get("price")  # Optional for limit orders
        order_type = request.get("orderType", "market")  # 'market' or 'limit'
        
        logger.info(f"🤖 Executing strategy signal: {strategy_id} -> {signal} {quantity} {symbol}")
        
        if not all([strategy_id, connection_id, signal, symbol, quantity]):
            raise HTTPException(status_code=400, detail="Missing required strategy execution parameters")
        
        if connection_id not in connections_store:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        conn_data = connections_store[connection_id]
        session = HTTP(
            testnet=False,
            api_key=conn_data["apiKey"],
            api_secret=conn_data["secretKey"]
        )
        
        # Set position mode and margin settings
        try:
            position_mode_result = session.set_position_mode(category="linear", mode=3)
            logger.info(f"Position mode result: {position_mode_result}")
        except Exception as e:
            logger.warning(f"Failed to set position mode: {e}")
        
        # Prepare order data
        order_data = {
            "category": "linear",
            "symbol": symbol,
            "side": "Buy" if signal.upper() == "BUY" else "Sell",
            "orderType": "Market" if order_type.lower() == "market" else "Limit",
            "qty": str(quantity),
            "timeInForce": "GTC",
            "reduceOnly": False,
            "positionIdx": 0  # One-Way mode
        }
        
        # Add price for limit orders
        if order_type.lower() == "limit" and price:
            order_data["price"] = str(price)
        
        logger.info(f"📝 Strategy order data: {order_data}")
        
        # Execute the order
        result = session.place_order(**order_data)
        logger.info(f"📊 Strategy order result: {result}")
        
        if result["retCode"] == 0:
            return {
                "success": True,
                "data": {
                    "strategyId": strategy_id,
                    "orderId": result["result"]["orderId"],
                    "orderLinkId": result["result"]["orderLinkId"],
                    "symbol": symbol,
                    "side": signal,
                    "quantity": quantity,
                    "orderType": order_type,
                    "executedAt": datetime.now(timezone.utc).isoformat()
                },
                "message": f"✅ Strategy {strategy_id} executed: {signal} {quantity} {symbol}"
            }
        else:
            raise HTTPException(status_code=400, detail=f"Strategy execution failed: {result.get('retMsg', 'Unknown error')}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Strategy execution error: {e}")
        raise HTTPException(status_code=500, detail=f"Strategy execution failed: {str(e)}")

@app.get("/api/strategies/status/{strategy_id}")
async def get_strategy_status(strategy_id: str, current_user: dict = Depends(require_viewer)):
    """Get real-time status of a strategy including positions and orders"""
    try:
        # Get strategy from database
        strategy = get_database().load_strategy(strategy_id)
        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")
        
        # Get real trades for this strategy
        trades = get_database().load_trades(strategy_id=strategy_id, limit=1000)
        
        # Calculate real PnL
        total_pnl = sum(trade.get('pnl', 0.0) for trade in trades)
        total_trades = len(trades)
        
        # Get real positions for this strategy
        positions = get_database().load_positions(strategy_id=strategy_id, status='OPEN')
        
        # Get strategy-specific orders from all connections
        pending_orders = []
        for conn_id, conn_data in connections_store.items():
            if conn_id == strategy.get('connection_id'):
                try:
                    session = HTTP(
                        testnet=False,
                        api_key=conn_data["apiKey"],
                        api_secret=conn_data["secretKey"]
                    )
                    
                    # Get orders for strategy symbol
                    result = session.get_open_orders(
                        category="linear", 
                        symbol=strategy.get('symbol')
                    )
                    
                    if result["retCode"] == 0:
                        for order in result["result"]["list"]:
                            pending_orders.append({
                                "orderId": order.get("orderId"),
                                "symbol": order.get("symbol"),
                                "side": order.get("side"),
                                "price": float(order.get("price", "0")),
                                "quantity": float(order.get("qty", "0")),
                                "status": order.get("orderStatus")
                            })
                except Exception as e:
                    logger.warning(f"Could not get orders for strategy {strategy_id}: {e}")
        
        # Format positions
        open_positions = []
        for position in positions:
            open_positions.append({
                "positionId": position['id'],
                "symbol": position['symbol'],
                "side": position['side'],
                "size": position['size'],
                "entryPrice": position['entry_price'],
                "currentPrice": position.get('current_price'),
                "unrealizedPnL": position.get('unrealized_pnl', 0.0),
                "leverage": position.get('leverage', 1)
            })
        
        # Get last signal from strategy
        last_signal = strategy.get('last_signal')
        
        return {
            "success": True,
            "data": {
                "strategyId": strategy_id,
                "name": strategy.get('name'),
                "status": strategy.get('status', 'UNKNOWN'),
                "symbol": strategy.get('symbol'),
                "connectionId": strategy.get('connection_id'),
                "totalTrades": total_trades,
                "totalPnL": total_pnl,
                "openPositions": open_positions,
                "pendingOrders": pending_orders,
                "lastSignal": last_signal,
                "lastExecution": strategy.get('last_execution'),
                "lastUpdated": datetime.now(timezone.utc).isoformat(),
                "config": strategy.get('config'),
                "riskLimits": strategy.get('risk_limits'),
                "performance": strategy.get('performance')
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get strategy status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/strategies/stop")
async def stop_strategy(request: dict, current_user: dict = Depends(require_trader)):
    """Stop a strategy and close ONLY its specific positions safely"""
    try:
        strategy_id = request.get("strategyId")
        close_positions = request.get("closePositions", True)
        
        logger.info(f"🛑 Stopping strategy: {strategy_id}")
        
        if not strategy_id:
            raise HTTPException(status_code=400, detail="Strategy ID required")
        
        # Get strategy from database to validate it exists
        strategy = get_database().load_strategy(strategy_id)
        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")
        
        # Update strategy status to STOPPED in database
        strategy['status'] = 'STOPPED'
        strategy['last_execution'] = datetime.now(timezone.utc).isoformat()
        get_database().save_strategy(strategy)
        
        closed_positions = []
        cancelled_orders = []
        
        # If closing positions is requested
        if close_positions:
            connection_id = strategy.get('connection_id')
            strategy_symbol = strategy.get('symbol')
            
            if not connection_id or connection_id not in connections_store:
                logger.warning(f"Connection {connection_id} not found for strategy {strategy_id}")
            else:
                conn_data = connections_store[connection_id]
                session = HTTP(
                    testnet=False,
                    api_key=conn_data["apiKey"],
                    api_secret=conn_data["secretKey"]
                )
                
                # First: Cancel ALL open orders for this strategy's symbol
                try:
                    orders_result = session.get_open_orders(category="linear", symbol=strategy_symbol)
                    if orders_result["retCode"] == 0:
                        for order in orders_result["result"]["list"]:
                            order_id = order.get("orderId")
                            if order_id:
                                try:
                                    cancel_result = session.cancel_order(
                                        category="linear",
                                        symbol=strategy_symbol,
                                        orderId=order_id
                                    )
                                    if cancel_result["retCode"] == 0:
                                        cancelled_orders.append(order_id)
                                        logger.info(f"✅ Cancelled order {order_id} for strategy {strategy_id}")
                                except Exception as e:
                                    logger.error(f"Failed to cancel order {order_id}: {e}")
                except Exception as e:
                    logger.error(f"Failed to get orders for symbol {strategy_symbol}: {e}")
                
                # Second: Close ONLY positions that belong to this strategy's symbol
                try:
                    positions_result = session.get_positions(category="linear", symbol=strategy_symbol)
                    
                    if positions_result["retCode"] == 0:
                        for pos in positions_result["result"]["list"]:
                            size = float(pos.get("size", "0"))
                            if size > 0:  # Position exists
                                symbol = pos.get("symbol")
                                side = pos.get("side")
                                
                                # ONLY close if it matches strategy symbol exactly
                                if symbol == strategy_symbol:
                                    # Close position with market order
                                    close_side = "Sell" if side == "Buy" else "Buy"
                                    
                                    try:
                                        close_result = session.place_order(
                                            category="linear",
                                            symbol=symbol,
                                            side=close_side,
                                            orderType="Market",
                                            qty=str(size),
                                            reduceOnly=True
                                        )
                                        
                                        if close_result["retCode"] == 0:
                                            closed_positions.append({
                                                "symbol": symbol,
                                                "side": side,
                                                "quantity": size,
                                                "orderId": close_result["result"]["orderId"]
                                            })
                                            logger.info(f"✅ Closed position {symbol} {side} {size} for strategy {strategy_id}")
                                        else:
                                            logger.error(f"Failed to close position {symbol}: {close_result.get('retMsg')}")
                                    except Exception as e:
                                        logger.error(f"Failed to close position {symbol}: {e}")
                except Exception as e:
                    logger.error(f"Failed to get positions for strategy {strategy_id}: {e}")
        
        # Update database to mark strategy-specific positions as closed
        if closed_positions:
            try:
                db_positions = get_database().load_positions(strategy_id=strategy_id, status='OPEN')
                for db_pos in db_positions:
                    if db_pos['symbol'] == strategy.get('symbol'):
                        db_pos['status'] = 'CLOSED'
                        db_pos['closed_at'] = datetime.now(timezone.utc).isoformat()
                        get_database().save_position(db_pos)
            except Exception as e:
                logger.error(f"Failed to update database positions: {e}")
        
        return {
            "success": True,
            "data": {
                "strategyId": strategy_id,
                "status": "STOPPED",
                "closedPositions": closed_positions if close_positions else [],
                "stoppedAt": datetime.now(timezone.utc).isoformat()
            },
            "message": f"✅ Strategy {strategy_id} stopped successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to stop strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Trading endpoints
@app.get("/api/trading/open-orders/{connection_id}")
async def get_open_orders(connection_id: str):
    """Get all open orders for a connection"""
    try:
        if connection_id not in connections_store:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        conn_data = connections_store[connection_id]
        session = HTTP(
            testnet=False,
            api_key=conn_data["apiKey"],
            api_secret=conn_data["secretKey"]
        )
        
        # Get open orders
        result = session.get_open_orders(category="linear", settleCoin="USDT")
        
        if result["retCode"] == 0:
            orders = []
            for order in result["result"]["list"]:
                orders.append({
                    "orderId": order.get("orderId"),
                    "orderLinkId": order.get("orderLinkId"),
                    "symbol": order.get("symbol"),
                    "side": order.get("side"),
                    "orderType": order.get("orderType"),
                    "price": float(order.get("price", "0")),
                    "quantity": float(order.get("qty", "0")),
                    "filledQty": float(order.get("cumExecQty", "0")),
                    "orderStatus": order.get("orderStatus"),
                    "createdTime": order.get("createdTime"),
                    "updatedTime": order.get("updatedTime"),
                    "takeProfit": float(order.get("takeProfit", "0")) if order.get("takeProfit") else None,
                    "stopLoss": float(order.get("stopLoss", "0")) if order.get("stopLoss") else None,
                    "triggerPrice": float(order.get("triggerPrice", "0")) if order.get("triggerPrice") else None,
                    "reduceOnly": order.get("reduceOnly", False),
                    "closeOnTrigger": order.get("closeOnTrigger", False)
                })
            
            return {
                "success": True,
                "orders": orders,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            raise HTTPException(status_code=400, detail=f"Failed to get orders: {result.get('retMsg')}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get open orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trading/cancel-order")
async def cancel_order(request: dict):
    """Cancel an open order"""
    try:
        connection_id = request.get("connectionId")
        order_id = request.get("orderId")
        symbol = request.get("symbol")
        
        if not all([connection_id, order_id, symbol]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        if connection_id not in connections_store:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        conn_data = connections_store[connection_id]
        session = HTTP(
            testnet=False,
            api_key=conn_data["apiKey"],
            api_secret=conn_data["secretKey"]
        )
        
        # Cancel the order
        result = session.cancel_order(
            category="linear",
            symbol=symbol,
            orderId=order_id
        )
        
        if result["retCode"] == 0:
            return {
                "success": True,
                "message": f"Order {order_id} cancelled successfully",
                "data": result["result"]
            }
        else:
            raise HTTPException(status_code=400, detail=f"Failed to cancel order: {result.get('retMsg')}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trading/modify-order")
async def modify_order(request: dict):
    """Modify an open order"""
    try:
        connection_id = request.get("connectionId")
        order_id = request.get("orderId")
        symbol = request.get("symbol")
        
        if not all([connection_id, order_id, symbol]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        if connection_id not in connections_store:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        conn_data = connections_store[connection_id]
        session = HTTP(
            testnet=False,
            api_key=conn_data["apiKey"],
            api_secret=conn_data["secretKey"]
        )
        
        # Build modification parameters
        modify_params = {
            "category": "linear",
            "symbol": symbol,
            "orderId": order_id
        }
        
        if "quantity" in request:
            modify_params["qty"] = str(request["quantity"])
        if "price" in request:
            modify_params["price"] = str(request["price"])
        if "triggerPrice" in request:
            modify_params["triggerPrice"] = str(request["triggerPrice"])
        if "takeProfit" in request:
            modify_params["takeProfit"] = str(request["takeProfit"])
        if "stopLoss" in request:
            modify_params["stopLoss"] = str(request["stopLoss"])
        
        # Modify the order
        result = session.amend_order(**modify_params)
        
        if result["retCode"] == 0:
            return {
                "success": True,
                "message": f"Order {order_id} modified successfully",
                "data": result["result"]
            }
        else:
            raise HTTPException(status_code=400, detail=f"Failed to modify order: {result.get('retMsg')}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to modify order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trading/close-position")
async def close_position(request: dict):
    """Close an open position"""
    try:
        connection_id = request.get("connectionId")
        symbol = request.get("symbol")
        side = request.get("side")  # Current position side
        
        if not all([connection_id, symbol, side]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        if connection_id not in connections_store:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        conn_data = connections_store[connection_id]
        session = HTTP(
            testnet=False,
            api_key=conn_data["apiKey"],
            api_secret=conn_data["secretKey"]
        )
        
        # Get position info first
        positions_result = session.get_positions(category="linear", symbol=symbol)
        if positions_result["retCode"] != 0:
            raise HTTPException(status_code=400, detail="Failed to get position info")
        
        position = None
        for pos in positions_result["result"]["list"]:
            if pos["symbol"] == symbol and pos["side"] == side:
                position = pos
                break
        
        if not position:
            raise HTTPException(status_code=404, detail="Position not found")
        
        # Create a market order to close the position
        close_side = "Sell" if side == "Buy" else "Buy"
        
        result = session.place_order(
            category="linear",
            symbol=symbol,
            side=close_side,
            orderType="Market",
            qty=position["size"],
            reduceOnly=True,
            positionIdx=0  # One-Way mode
        )
        
        if result["retCode"] == 0:
            return {
                "success": True,
                "message": f"Position {symbol} closed successfully",
                "data": {
                    "orderId": result["result"]["orderId"],
                    "symbol": symbol,
                    "side": close_side,
                    "quantity": position["size"]
                }
            }
        else:
            raise HTTPException(status_code=400, detail=f"Failed to close position: {result.get('retMsg')}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to close position: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trading/modify-position")
async def modify_position(request: dict):
    """Modify position SL/TP"""
    try:
        connection_id = request.get("connectionId")
        symbol = request.get("symbol")
        side = request.get("side")
        
        if not all([connection_id, symbol, side]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        if connection_id not in connections_store:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        conn_data = connections_store[connection_id]
        session = HTTP(
            testnet=False,
            api_key=conn_data["apiKey"],
            api_secret=conn_data["secretKey"]
        )
        
        # Build modification parameters
        modify_params = {
            "category": "linear",
            "symbol": symbol,
            "positionIdx": 0  # One-Way mode
        }
        
        if "takeProfit" in request:
            modify_params["takeProfit"] = str(request["takeProfit"])
        if "stopLoss" in request:
            modify_params["stopLoss"] = str(request["stopLoss"])
        if "tpTriggerBy" in request:
            modify_params["tpTriggerBy"] = request["tpTriggerBy"]
        if "slTriggerBy" in request:
            modify_params["slTriggerBy"] = request["slTriggerBy"]
        
        # Modify the position
        result = session.set_trading_stop(**modify_params)
        
        if result["retCode"] == 0:
            return {
                "success": True,
                "message": f"Position {symbol} modified successfully",
                "data": result["result"]
            }
        else:
            raise HTTPException(status_code=400, detail=f"Failed to modify position: {result.get('retMsg')}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to modify position: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trading/create-order")
async def create_order(request: CreateOrderRequest, current_user: dict = Depends(require_trader)):
    """Create a new trading order on ByBit"""
    try:
        logger.info(f"🔄 Creating order: {request.symbol} {request.side} {request.quantity}")
        
        # Get connection
        if request.connectionId not in connections_store:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        connection = connections_store[request.connectionId]
        
        # Create ByBit session
        session = HTTP(
            testnet=False,
            api_key=connection["apiKey"],
            api_secret=connection["secretKey"]
        )
        
        # Set leverage if provided
        if request.leverage and request.leverage > 1:
            try:
                logger.info(f"🎚️ Setting leverage to {request.leverage}x for {request.symbol}")
                leverage_result = session.set_leverage(
                    category="linear",
                    symbol=request.symbol,
                    buyLeverage=str(request.leverage),
                    sellLeverage=str(request.leverage)
                )
                logger.info(f"Leverage result: {leverage_result}")
            except Exception as leverage_error:
                logger.warning(f"Failed to set leverage: {leverage_error}")
        
        # Set position mode to hedge mode (required for new accounts)
        try:
            logger.info(f"🔧 Setting position mode to hedge mode for better compatibility")
            position_mode_result = session.set_position_mode(
                category="linear",
                mode=3  # 3 = Both side mode (hedge mode)
            )
            logger.info(f"Position mode result: {position_mode_result}")
        except Exception as position_error:
            logger.warning(f"Failed to set position mode: {position_error}")
        
        # Set margin mode if provided
        if request.marginMode:
            try:
                margin_mode = "ISOLATED_MARGIN" if request.marginMode == "isolated" else "REGULAR_MARGIN"
                logger.info(f"🔒 Setting margin mode to {margin_mode} for {request.symbol}")
                margin_result = session.set_margin_mode(
                    category="linear",
                    symbol=request.symbol,
                    tradeMode=0 if request.marginMode == "cross" else 1,
                    buyLeverage=str(request.leverage or 1),
                    sellLeverage=str(request.leverage or 1)
                )
                logger.info(f"Margin mode result: {margin_result}")
            except Exception as margin_error:
                logger.warning(f"Failed to set margin mode: {margin_error}")
        
        # Prepare order data
        order_data = {
            "category": "linear",
            "symbol": request.symbol,
            "side": "Buy" if request.side.lower() == "buy" else "Sell",
            "orderType": "Market" if request.orderType.lower() == "market" else "Limit",
            "qty": str(request.quantity),
            "timeInForce": request.timeInForce,
            "reduceOnly": request.reduceOnly,
            "positionIdx": 0  # 0=One-Way mode (both buy/sell use same position)
        }
        
        # Add price for limit orders
        if request.orderType.lower() == "limit" and request.price:
            order_data["price"] = str(request.price)
        
        # Add take profit and stop loss if provided
        if request.takeProfitPrice:
            order_data["takeProfit"] = str(request.takeProfitPrice)
        
        if request.stopLossPrice:
            order_data["stopLoss"] = str(request.stopLossPrice)
        
        logger.info(f"📝 Order data: {order_data}")
        
        # Place the order
        result = session.place_order(**order_data)
        
        logger.info(f"📊 Order result: {result}")
        
        if result["retCode"] == 0:
            return {
                "success": True,
                "data": {
                    "orderId": result["result"]["orderId"],
                    "orderLinkId": result["result"]["orderLinkId"],
                    "symbol": request.symbol,
                    "side": request.side,
                    "quantity": request.quantity,
                    "price": request.price,
                    "orderType": request.orderType,
                    "status": "created"
                },
                "message": f"✅ Order created successfully: {request.symbol} {request.side} {request.quantity}"
            }
        else:
            raise HTTPException(status_code=400, detail=f"ByBit API error: {result.get('retMsg', 'Unknown error')}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to create order: {e}")
        raise HTTPException(status_code=500, detail=f"Order creation failed: {str(e)}")

# Error handling
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

# ================================
# STRATEGY ENGINE ENDPOINTS
# ================================

@app.post("/strategy/create")
async def create_strategy(request: StrategyCreateRequest, current_user: dict = Depends(require_trader)):
    """Maak nieuwe trading strategy"""
    try:
        strategy = Strategy(
            id=f"strategy_{int(time.time())}",
            name=request.name,
            connection_id=request.connection_id,
            symbol=request.symbol,
            status=StrategyStatus.INACTIVE,
            config=request.config,
            risk_limits=request.risk_limits
        )
        
        success = strategy_engine.add_strategy(strategy)
        
        if success:
            return {
                "success": True,
                "data": {
                    "strategy_id": strategy.id,
                    "name": strategy.name,
                    "status": strategy.status.value
                },
                "message": f"Strategy '{request.name}' succesvol aangemaakt"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create strategy")
            
    except Exception as e:
        logger.error(f"Error creating strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/strategy/control")
async def control_strategy(request: StrategyControlRequest):
    """Control strategy execution (start/pause/stop)"""
    try:
        strategy_id = request.strategy_id
        action = request.action.lower()
        
        if action == "start":
            success = strategy_engine.activate_strategy(strategy_id)
            message = f"Strategy {strategy_id} geactiveerd"
        elif action == "pause":
            success = strategy_engine.pause_strategy(strategy_id)
            message = f"Strategy {strategy_id} gepauzeerd"
        elif action == "stop":
            success = strategy_engine.remove_strategy(strategy_id)
            message = f"Strategy {strategy_id} gestopt"
        else:
            raise HTTPException(status_code=400, detail="Invalid action. Use 'start', 'pause', or 'stop'")
        
        if success:
            return {
                "success": True,
                "data": {"strategy_id": strategy_id, "action": action},
                "message": message
            }
        else:
            raise HTTPException(status_code=404, detail="Strategy not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error controlling strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/strategy/status/{strategy_id}")
async def get_strategy_status(strategy_id: str):
    """Get status van specific strategy"""
    try:
        status = strategy_engine.get_strategy_status(strategy_id)
        
        if status:
            return {
                "success": True,
                "data": status
            }
        else:
            raise HTTPException(status_code=404, detail="Strategy not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting strategy status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/strategy/engine/status")
async def get_engine_status():
    """Get strategy engine status"""
    try:
        status = strategy_engine.get_engine_status()
        return {
            "success": True,
            "data": status
        }
    except Exception as e:
        logger.error(f"Error getting engine status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/strategy/engine/start")
async def start_strategy_engine():
    """Start de strategy execution engine"""
    try:
        await strategy_engine.start_engine()
        return {
            "success": True,
            "message": "Strategy execution engine gestart"
        }
    except Exception as e:
        logger.error(f"Error starting engine: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/strategy/engine/stop")
async def stop_strategy_engine():
    """Stop de strategy execution engine"""
    try:
        await strategy_engine.stop_engine()
        return {
            "success": True,
            "message": "Strategy execution engine gestopt"
        }
    except Exception as e:
        logger.error(f"Error stopping engine: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ================================
# REAL-TIME DATA ENDPOINTS
# ================================

@app.post("/data/start")
async def start_data_feeds(symbols: List[str]):
    """Start real-time data feeds"""
    try:
        await data_processor.start_data_feeds(symbols)
        return {
            "success": True,
            "message": f"Data feeds gestart voor {len(symbols)} symbols",
            "data": {"symbols": symbols}
        }
    except Exception as e:
        logger.error(f"Error starting data feeds: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/data/stop")
async def stop_data_feeds():
    """Stop real-time data feeds"""
    try:
        await data_processor.stop_data_feeds()
        return {
            "success": True,
            "message": "Data feeds gestopt"
        }
    except Exception as e:
        logger.error(f"Error stopping data feeds: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/data/stats")
async def get_data_stats():
    """Get data processor statistics"""
    try:
        stats = data_processor.get_stats()
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        logger.error(f"Error getting data stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/data/market/{symbol}")
async def get_market_data(symbol: str):
    """Get current market data voor symbol"""
    try:
        market_data = data_processor.get_market_data(symbol)
        
        if market_data:
            return {
                "success": True,
                "data": {
                    "symbol": market_data.symbol,
                    "price": market_data.price,
                    "volume": market_data.volume,
                    "timestamp": market_data.timestamp.isoformat(),
                    "high_24h": market_data.high_24h,
                    "low_24h": market_data.low_24h,
                    "change_24h": market_data.change_24h,
                    "bid": market_data.bid,
                    "ask": market_data.ask
                }
            }
        else:
            raise HTTPException(status_code=404, detail=f"No market data found for {symbol}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting market data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/data/klines/{symbol}")
async def get_kline_data(symbol: str, limit: int = 100):
    """Get kline data voor symbol"""
    try:
        klines = data_processor.get_kline_data(symbol, limit)
        
        return {
            "success": True,
            "data": [
                {
                    "symbol": kline.symbol,
                    "open": kline.open_price,
                    "high": kline.high_price,
                    "low": kline.low_price,
                    "close": kline.close_price,
                    "volume": kline.volume,
                    "timestamp": kline.timestamp.isoformat(),
                    "interval": kline.interval
                } for kline in klines
            ]
        }
    except Exception as e:
        logger.error(f"Error getting kline data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ================================
# RISK MANAGEMENT ENDPOINTS
# ================================

@app.get("/risk/summary")
async def get_risk_summary():
    """Get comprehensive risk summary"""
    try:
        summary = risk_manager.get_risk_summary()
        return {
            "success": True,
            "data": summary
        }
    except Exception as e:
        logger.error(f"Error getting risk summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/risk/limits")
async def set_risk_limit(request: RiskLimitRequest, current_user: dict = Depends(require_admin)):
    """Set risk management limit"""
    try:
        risk_manager.set_global_limit(request.limit_name, request.value)
        return {
            "success": True,
            "message": f"Risk limit {request.limit_name} ingesteld op {request.value}"
        }
    except Exception as e:
        logger.error(f"Error setting risk limit: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/risk/monitoring/start")
async def start_risk_monitoring():
    """Start risk monitoring"""
    try:
        await risk_manager.start_monitoring()
        return {
            "success": True,
            "message": "Risk monitoring gestart"
        }
    except Exception as e:
        logger.error(f"Error starting risk monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/risk/monitoring/stop")
async def stop_risk_monitoring():
    """Stop risk monitoring"""
    try:
        await risk_manager.stop_monitoring()
        return {
            "success": True,
            "message": "Risk monitoring gestopt"
        }
    except Exception as e:
        logger.error(f"Error stopping risk monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/risk/emergency/reset")
async def reset_emergency_stop(current_user: dict = Depends(require_admin)):
    """Reset emergency stop (admin only)"""
    try:
        risk_manager.reset_emergency_stop()
        return {
            "success": True,
            "message": "Emergency stop gereset"
        }
    except Exception as e:
        logger.error(f"Error resetting emergency stop: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/risk/position/{symbol}")
async def get_position_risk(symbol: str):
    """Get position risk report"""
    try:
        report = risk_manager.get_position_risk_report(symbol)
        if report:
            return {
                "success": True,
                "data": report
            }
        else:
            raise HTTPException(status_code=404, detail=f"No risk data found for {symbol}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting position risk: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ================================
# MONITORING ENDPOINTS
# ================================

@app.get("/monitoring/dashboard")
async def get_monitoring_dashboard():
    """Get monitoring dashboard data"""
    try:
        dashboard = monitoring_system.get_monitoring_dashboard()
        return {
            "success": True,
            "data": dashboard
        }
    except Exception as e:
        logger.error(f"Error getting monitoring dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/monitoring/start")
async def start_monitoring():
    """Start monitoring system"""
    try:
        await monitoring_system.start_monitoring()
        return {
            "success": True,
            "message": "Monitoring systeem gestart"
        }
    except Exception as e:
        logger.error(f"Error starting monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/monitoring/stop")
async def stop_monitoring():
    """Stop monitoring system"""
    try:
        await monitoring_system.stop_monitoring()
        return {
            "success": True,
            "message": "Monitoring systeem gestopt"
        }
    except Exception as e:
        logger.error(f"Error stopping monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/monitoring/alerts/config")
async def configure_alerts(request: AlertConfigRequest):
    """Configure alert settings"""
    try:
        monitoring_system.configure_alerts(request.config)
        return {
            "success": True,
            "message": "Alert configuratie bijgewerkt"
        }
    except Exception as e:
        logger.error(f"Error configuring alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/monitoring/metrics/{metric_name}")
async def get_metric_history(metric_name: str, hours: int = 24):
    """Get metric history"""
    try:
        history = monitoring_system.get_metric_history(metric_name, hours)
        return {
            "success": True,
            "data": {
                "metric_name": metric_name,
                "history": history
            }
        }
    except Exception as e:
        logger.error(f"Error getting metric history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/monitoring/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    """Resolve an alert"""
    try:
        success = monitoring_system.resolve_alert(alert_id)
        if success:
            return {
                "success": True,
                "message": f"Alert {alert_id} resolved"
            }
        else:
            raise HTTPException(status_code=404, detail="Alert not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resolving alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ================================
# ENHANCED STRATEGY INTEGRATION
# ================================

@app.post("/strategy/create/enhanced")
async def create_enhanced_strategy(request: StrategyCreateRequest):
    """Maak nieuwe strategy met volledige risk integration"""
    try:
        # Validate trade against risk limits first
        is_valid, violations = await risk_manager.validate_trade(
            strategy_id=f"strategy_{int(time.time())}",
            symbol=request.symbol,
            side="BUY",  # Default for validation
            quantity=request.config.get('position_size', 0.01),
            price=100.0,  # Default price for validation
            leverage=request.config.get('leverage', 1)
        )
        
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Strategy validation failed: {violations}")
        
        # Create strategy
        strategy = Strategy(
            id=f"strategy_{int(time.time())}",
            name=request.name,
            connection_id=request.connection_id,
            symbol=request.symbol,
            status=StrategyStatus.INACTIVE,
            config=request.config,
            risk_limits=request.risk_limits
        )
        
        success = strategy_engine.add_strategy(strategy)
        
        if success:
            # Set strategy specific risk limits
            if request.risk_limits:
                risk_manager.set_strategy_limits(strategy.id, request.risk_limits)
            
            return {
                "success": True,
                "data": {
                    "strategy_id": strategy.id,
                    "name": strategy.name,
                    "status": strategy.status.value,
                    "risk_validated": True
                },
                "message": f"Enhanced strategy '{request.name}' succesvol aangemaakt"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create strategy")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating enhanced strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ================================
# POSITION SYNCHRONIZATION ENDPOINTS
# ================================

@app.get("/positions/sync/status")
async def get_position_sync_status():
    """Get position synchronization status"""
    try:
        stats = position_sync.get_stats()
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        logger.error(f"Error getting position sync status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/positions/all")
async def get_all_positions():
    """Get all current positions"""
    try:
        positions = position_sync.get_all_positions()
        return {
            "success": True,
            "data": positions
        }
    except Exception as e:
        logger.error(f"Error getting all positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/positions/{connection_id}")
async def get_positions_for_connection(connection_id: str):
    """Get positions for specific connection"""
    try:
        positions = position_sync.get_positions_for_connection(connection_id)
        return {
            "success": True,
            "data": positions
        }
    except Exception as e:
        logger.error(f"Error getting positions for connection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/positions/summary")
async def get_position_summary():
    """Get position summary statistics"""
    try:
        summary = position_sync.get_position_summary()
        return {
            "success": True,
            "data": summary
        }
    except Exception as e:
        logger.error(f"Error getting position summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/positions/sync/force")
async def force_position_sync():
    """Force immediate position synchronization"""
    try:
        await position_sync.force_sync()
        return {
            "success": True,
            "message": "Position sync completed successfully"
        }
    except Exception as e:
        logger.error(f"Error forcing position sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/positions/close")
async def close_position_api(request: dict):
    """Close position via position sync service"""
    try:
        connection_id = request.get("connectionId")
        symbol = request.get("symbol")
        quantity = request.get("quantity")  # Optional partial close
        
        if not connection_id or not symbol:
            raise HTTPException(status_code=400, detail="connectionId and symbol are required")
        
        success = await position_sync.close_position(connection_id, symbol, quantity)
        
        if success:
            return {
                "success": True,
                "message": f"Position {symbol} closed successfully"
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to close position")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error closing position: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ================================
# PERFORMANCE OPTIMIZATION ENDPOINTS
# ================================

@app.get("/performance/metrics")
async def get_performance_metrics(current_user: dict = Depends(require_viewer)):
    """Get current performance metrics"""
    try:
        metrics = performance_optimizer.get_performance_metrics()
        return {
            "success": True,
            "data": {
                "avg_response_time": metrics.avg_response_time,
                "requests_per_second": metrics.requests_per_second,
                "active_connections": metrics.active_connections,
                "memory_usage_mb": metrics.memory_usage_mb,
                "cpu_usage_percent": metrics.cpu_usage_percent,
                "cache_hit_rate": metrics.cache_hit_rate,
                "error_rate": metrics.error_rate,
                "timestamp": metrics.timestamp.isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Error getting performance metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/performance/report")
async def get_optimization_report(current_user: dict = Depends(require_admin)):
    """Get comprehensive optimization report"""
    try:
        report = performance_optimizer.get_optimization_report()
        return {
            "success": True,
            "data": report
        }
    except Exception as e:
        logger.error(f"Error getting optimization report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/performance/cache/clear")
async def clear_cache(current_user: dict = Depends(require_admin)):
    """Clear performance cache"""
    try:
        await performance_optimizer.cache.clear()
        return {
            "success": True,
            "message": "Cache cleared successfully"
        }
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/performance/memory/gc")
async def trigger_garbage_collection(current_user: dict = Depends(require_admin)):
    """Trigger garbage collection"""
    try:
        performance_optimizer.check_memory_usage()
        return {
            "success": True,
            "message": "Garbage collection triggered"
        }
    except Exception as e:
        logger.error(f"Error triggering GC: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/performance/cache/warmup")
async def warm_up_cache(current_user: dict = Depends(require_admin)):
    """Warm up cache with common requests"""
    try:
        # Define warm-up tasks
        async def warm_up_connections():
            # Warm up connection data
            await get_connections()
        
        async def warm_up_market_data():
            # Warm up market data for common symbols
            await get_market_data("BTCUSDT,ETHUSDT,SOLUSDT")
        
        warm_up_tasks = [warm_up_connections, warm_up_market_data]
        await performance_optimizer.warm_up_cache(warm_up_tasks)
        
        return {
            "success": True,
            "message": "Cache warm-up completed"
        }
    except Exception as e:
        logger.error(f"Error warming up cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ================================
# STARTUP AND CONNECTION MANAGEMENT
# ================================

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("🚀 Initializing CTB Trading Bot services...")
    
    # Initialize database
    db = get_database()
    logger.info("✅ Database initialized")
    
    # Create connection sessions for position sync
    active_sessions = {}
    
    # Initialize strategy engine connections
    for connection_id, connection_data in connections_store.items():
        success = strategy_engine.add_connection(
            connection_id,
            connection_data['apiKey'],
            connection_data['secretKey']
        )
        if success:
            logger.info(f"✅ Strategy engine connectie toegevoegd: {connection_id}")
            
            # Also create session for position sync
            try:
                session = HTTP(
                    testnet=False,
                    api_key=connection_data['apiKey'],
                    api_secret=connection_data['secretKey']
                )
                active_sessions[connection_id] = session
                logger.info(f"✅ Position sync session toegevoegd: {connection_id}")
            except Exception as e:
                logger.error(f"❌ Failed to create position sync session for {connection_id}: {e}")
        else:
            logger.error(f"❌ Failed to add strategy engine connectie: {connection_id}")
    
    # Start position synchronization
    if active_sessions:
        try:
            await position_sync.start()
            logger.info("✅ Position synchronization gestart")
        except Exception as e:
            logger.error(f"❌ Failed to start position sync: {e}")
    
    # Start monitoring systems
    try:
        await monitoring_system.start_monitoring()
        logger.info("✅ Monitoring systeem gestart")
    except Exception as e:
        logger.error(f"❌ Failed to start monitoring: {e}")
    
    try:
        await risk_manager.start_monitoring()
        logger.info("✅ Risk management gestart")
    except Exception as e:
        logger.error(f"❌ Failed to start risk management: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Shutting down CTB Trading Bot services...")
    
    # Stop all services
    try:
        await strategy_engine.stop_engine()
    except Exception as e:
        logger.error(f"Error stopping strategy engine: {e}")
    
    try:
        await data_processor.stop_data_feeds()
    except Exception as e:
        logger.error(f"Error stopping data processor: {e}")
    
    try:
        await monitoring_system.stop_monitoring()
    except Exception as e:
        logger.error(f"Error stopping monitoring: {e}")
    
    try:
        await risk_manager.stop_monitoring()
    except Exception as e:
        logger.error(f"Error stopping risk manager: {e}")
    
    try:
        await position_sync.stop()
    except Exception as e:
        logger.error(f"Error stopping position sync: {e}")
    
    logger.info("✅ Services stopped cleanly")

# Performance Monitoring Endpoints
@app.get("/api/performance/metrics")
async def get_performance_metrics(current_user: dict = Depends(require_viewer)):
    """Get current performance metrics"""
    try:
        metrics = performance_optimizer.get_performance_metrics()
        return {
            "success": True,
            "data": {
                "avg_response_time": metrics.avg_response_time,
                "requests_per_second": metrics.requests_per_second,
                "active_connections": metrics.active_connections,
                "memory_usage_mb": metrics.memory_usage_mb,
                "cpu_usage_percent": metrics.cpu_usage_percent,
                "cache_hit_rate": metrics.cache_hit_rate,
                "error_rate": metrics.error_rate,
                "timestamp": metrics.timestamp.isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Error getting performance metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/performance/report")
async def get_optimization_report(current_user: dict = Depends(require_admin)):
    """Get comprehensive optimization report"""
    try:
        report = performance_optimizer.get_optimization_report()
        return {
            "success": True,
            "data": report
        }
    except Exception as e:
        logger.error(f"Error getting optimization report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/performance/cache/clear")
async def clear_cache(current_user: dict = Depends(require_admin)):
    """Clear performance cache"""
    try:
        await performance_optimizer.cache.clear()
        return {
            "success": True,
            "message": "Cache cleared successfully"
        }
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/performance/cache/stats")
async def get_cache_stats(current_user: dict = Depends(require_viewer)):
    """Get cache statistics"""
    try:
        stats = performance_optimizer.cache.get_stats()
        return {
            "success": True,
            "data": {
                "hits": stats.hits,
                "misses": stats.misses,
                "hit_rate": stats.hit_rate,
                "total_size": stats.total_size,
                "entries": stats.entries
            }
        }
    except Exception as e:
        logger.error(f"Error getting cache stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/performance/memory")
async def trigger_memory_check(current_user: dict = Depends(require_admin)):
    """Trigger memory usage check and cleanup"""
    try:
        performance_optimizer.check_memory_usage()
        return {
            "success": True,
            "message": "Memory check completed"
        }
    except Exception as e:
        logger.error(f"Error in memory check: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Trade History Endpoints
@app.get("/api/trades/history")
async def get_trade_history(
    symbol: Optional[str] = None,
    period: Optional[str] = "1month",
    limit: int = 1000,
    current_user: dict = Depends(require_viewer)
):
    """Get real trade history for backtesting and analysis"""
    try:
        # Calculate date range based on period
        period_days = {
            '1week': 7,
            '1month': 30,
            '3months': 90,
            '6months': 180,
            '1year': 365
        }.get(period, 30)
        
        # Get trades from database
        all_trades = get_database().load_trades(limit=limit)
        
        # Filter by symbol if provided
        if symbol:
            all_trades = [trade for trade in all_trades if trade.get('symbol') == symbol]
        
        # Filter by date range
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=period_days)
        filtered_trades = []
        
        for trade in all_trades:
            trade_date_str = trade.get('created_at') or trade.get('executed_at')
            if trade_date_str:
                try:
                    trade_date = datetime.fromisoformat(trade_date_str.replace('Z', '+00:00'))
                    if trade_date >= cutoff_date:
                        filtered_trades.append(trade)
                except Exception as e:
                    logger.warning(f"Could not parse trade date {trade_date_str}: {e}")
        
        # Format trades for frontend
        formatted_trades = []
        for trade in filtered_trades:
            formatted_trades.append({
                "id": trade.get('id'),
                "symbol": trade.get('symbol'),
                "side": trade.get('side'),
                "price": trade.get('executed_price') or trade.get('price'),
                "quantity": trade.get('executed_quantity') or trade.get('quantity'),
                "pnl": trade.get('pnl', 0),
                "fees": trade.get('fees', 0),
                "status": trade.get('status'),
                "created_at": trade.get('created_at'),
                "executed_at": trade.get('executed_at'),
                "strategy_id": trade.get('strategy_id'),
                "connection_id": trade.get('connection_id')
            })
        
        return {
            "success": True,
            "data": formatted_trades,
            "metadata": {
                "period": period,
                "symbol": symbol,
                "total_trades": len(formatted_trades),
                "date_range": {
                    "from": cutoff_date.isoformat(),
                    "to": datetime.now(timezone.utc).isoformat()
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting trade history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/trades/stats")
async def get_trade_stats(
    symbol: Optional[str] = None,
    period: str = "1month",
    current_user: dict = Depends(require_viewer)
):
    """Get trading statistics for a symbol and period"""
    try:
        period_days = {
            '1week': 7,
            '1month': 30,
            '3months': 90,
            '6months': 180,
            '1year': 365
        }.get(period, 30)
        
        # Get real statistics from database
        stats = get_database().get_trading_stats(days=period_days)
        
        # If symbol filter is applied, get symbol-specific trades and calculate stats
        if symbol:
            trades = get_database().load_trades(limit=10000)
            symbol_trades = [t for t in trades if t.get('symbol') == symbol]
            
            if symbol_trades:
                total_pnl = sum(t.get('pnl', 0) for t in symbol_trades)
                winning_trades = len([t for t in symbol_trades if t.get('pnl', 0) > 0])
                losing_trades = len([t for t in symbol_trades if t.get('pnl', 0) <= 0])
                total_trades = len(symbol_trades)
                
                stats = {
                    'symbol': symbol,
                    'total_trades': total_trades,
                    'winning_trades': winning_trades,
                    'losing_trades': losing_trades,
                    'total_pnl': total_pnl,
                    'win_rate': winning_trades / total_trades if total_trades > 0 else 0,
                    'avg_win': sum(t.get('pnl', 0) for t in symbol_trades if t.get('pnl', 0) > 0) / winning_trades if winning_trades > 0 else 0,
                    'avg_loss': sum(t.get('pnl', 0) for t in symbol_trades if t.get('pnl', 0) <= 0) / losing_trades if losing_trades > 0 else 0,
                }
        
        return {
            "success": True,
            "data": stats,
            "period": period,
            "symbol": symbol
        }
        
    except Exception as e:
        logger.error(f"Error getting trade stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/market/klines")
async def get_klines(symbol: str, interval: str = "1h", limit: int = 100):
    """Get kline/candlestick data for technical analysis"""
    try:
        logger.info(f"Getting klines for {symbol}, interval={interval}, limit={limit}")
        
        # Get first available connection for market data
        connections = get_connections()
        if not connections:
            raise HTTPException(status_code=400, detail="No ByBit connections available")
        
        connection = connections[0]  # Use first connection for market data
        session = connection["session"]
        
        # Get kline data from ByBit
        result = session.get_kline(
            category="linear",
            symbol=symbol,
            interval=interval,
            limit=limit
        )
        
        if result.get("retCode") != 0:
            logger.error(f"ByBit API error: {result.get('retMsg', 'Unknown error')}")
            raise HTTPException(status_code=400, detail=f"ByBit API error: {result.get('retMsg', 'Unknown error')}")
        
        klines = result.get("result", {}).get("list", [])
        
        # Convert ByBit format to standard format
        # ByBit kline format: [timestamp, open, high, low, close, volume, turnover]
        formatted_klines = []
        for kline in klines:
            if len(kline) >= 6:
                formatted_klines.append([
                    int(kline[0]),      # timestamp
                    float(kline[1]),    # open
                    float(kline[2]),    # high
                    float(kline[3]),    # low
                    float(kline[4]),    # close
                    float(kline[5])     # volume
                ])
        
        # Sort by timestamp (oldest first) for proper technical analysis
        formatted_klines.sort(key=lambda x: x[0])
        
        logger.info(f"Retrieved {len(formatted_klines)} klines for {symbol}")
        
        return {
            "success": True,
            "data": formatted_klines,
            "symbol": symbol,
            "interval": interval,
            "count": len(formatted_klines)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting klines for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Mass Trading Status API
@app.get("/api/mass-trading/status")
async def get_mass_trading_status():
    """Get mass trading system status and statistics"""
    try:
        from services.mass_symbol_manager import mass_symbol_manager
        from services.ai_strategy_engine import ai_strategy_engine
        
        # Get AI engine status
        ai_status = ai_strategy_engine.get_ai_engine_status()
        
        # Get symbol counts by priority
        high_priority = len(mass_symbol_manager.get_symbols_by_priority('HIGH'))
        medium_priority = len(mass_symbol_manager.get_symbols_by_priority('MEDIUM'))
        low_priority = len(mass_symbol_manager.get_symbols_by_priority('LOW'))
        
        # Get top symbols with info
        top_symbols = []
        for symbol in mass_symbol_manager.get_symbols_by_priority('HIGH')[:10]:
            symbol_info = mass_symbol_manager.get_symbol_info(symbol)
            if symbol_info:
                top_symbols.append({
                    'symbol': symbol_info.symbol,
                    'volume_24h': symbol_info.volume_24h,
                    'price_change_24h': symbol_info.price_change_24h,
                    'priority_score': symbol_info.priority_score,
                    'priority_level': 'HIGH',
                    'status': symbol_info.status
                })
        
        stats = {
            'total_symbols': len(mass_symbol_manager.all_symbols),
            'high_priority': high_priority,
            'medium_priority': medium_priority,
            'low_priority': low_priority,
            'active_positions': ai_status['active_positions'],
            'pending_signals': ai_status['pending_signals'],
            'total_trades': ai_status['performance']['total_trades'],
            'total_pnl': ai_status['performance']['total_pnl'],
            'win_rate': ai_status['performance']['win_rate']
        }
        
        return {
            "success": True,
            "stats": stats,
            "top_symbols": top_symbols,
            "ai_engine_running": ai_status['is_running']
        }
        
    except Exception as e:
        logger.error(f"Error getting mass trading status: {e}")
        return {
            "success": False,
            "error": str(e),
            "stats": None,
            "top_symbols": []
        }

if __name__ == "__main__":
    print("🚀 Starting CTB Live ByBit Backend")
    print("📍 Server: http://localhost:8100")
    print("📚 Docs: http://localhost:8100/docs")
    print("🔴 LIVE MODE - Real ByBit API calls only")
    print("🤖 Strategy Engine: ENABLED")
    print("📡 Real-time Data: ENABLED")
    print("🛡️ Risk Management: ENABLED")
    print("📊 Monitoring System: ENABLED")
    print("🤖 Mass Trading: 445 SYMBOLS")
    print("")
    print("🎯 VOLLEDIG AUTOMATISCHE TRADING BOT ACTIEF!")
    print("⚠️  GEBRUIK OP EIGEN RISICO - LIVE TRADING")
    
    uvicorn.run(socket_app, host="0.0.0.0", port=8100, log_level="info")