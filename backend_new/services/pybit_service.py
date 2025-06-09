#!/usr/bin/env python3
"""
PyBit Service - Directe integratie met ByBit API via PyBit
Geen CCXT overhead, volledig geoptimaliseerd voor ByBit
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from decimal import Decimal

from pybit.unified_trading import HTTP
from pybit.unified_trading import WebSocket

from config.settings import settings

logger = logging.getLogger(__name__)

class PyBitService:
    """PyBit service voor directe ByBit API integratie"""
    
    def __init__(self):
        self.connections: Dict[str, Dict[str, Any]] = {}
        self.http_sessions: Dict[str, HTTP] = {}
        self.websocket_sessions: Dict[str, WebSocket] = {}
        self.market_data_cache: Dict[str, Any] = {}
        self.last_market_update = None
        
        # Default symbols for market data
        self.default_symbols = [
            "BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT", "DOGEUSDT",
            "BNBUSDT", "XRPUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT"
        ]
        
        # Data update intervals
        self.update_intervals = {
            "balance": settings.BALANCE_UPDATE_INTERVAL,
            "positions": settings.POSITION_UPDATE_INTERVAL,
            "market_data": settings.MARKET_DATA_INTERVAL
        }
        
        # Background tasks
        self.background_tasks = {}
    
    async def initialize(self):
        """Initialize PyBit service"""
        logger.info("🚀 Initializing PyBit service...")
        
        # Start market data updates
        self.background_tasks["market_data"] = asyncio.create_task(
            self._market_data_updater()
        )
        
        logger.info("✅ PyBit service initialized")
    
    async def test_connection(
        self,
        api_key: str,
        secret_key: str,
        testnet: bool = False
    ) -> Dict[str, Any]:
        """Test ByBit API connection"""
        try:
            logger.info(f"🔗 Testing ByBit connection (testnet: {testnet})")
            
            # Create test HTTP session
            session = HTTP(
                testnet=testnet,
                api_key=api_key,
                api_secret=secret_key,
            )
            
            # Test with get_wallet_balance
            result = session.get_wallet_balance(accountType="UNIFIED")
            
            if result["retCode"] == 0:
                logger.info("✅ ByBit connection test successful")
                return {
                    "success": True,
                    "message": "Connection successful",
                    "account_type": "UNIFIED",
                    "testnet": testnet,
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                logger.error(f"❌ ByBit API error: {result['retMsg']}")
                raise Exception(f"API Error: {result['retMsg']}")
                
        except Exception as e:
            logger.error(f"❌ Connection test failed: {e}")
            raise Exception(f"Connection failed: {str(e)}")
    
    async def add_connection(
        self,
        connection_id: str,
        api_key: str,
        secret_key: str,
        testnet: bool = False,
        markets: Optional[Dict[str, bool]] = None
    ):
        """Add new ByBit connection"""
        try:
            logger.info(f"➕ Adding ByBit connection: {connection_id}")
            
            # Create HTTP session
            http_session = HTTP(
                testnet=testnet,
                api_key=api_key,
                api_secret=secret_key,
            )
            
            # Store connection info
            self.connections[connection_id] = {
                "api_key": api_key,
                "secret_key": secret_key,
                "testnet": testnet,
                "markets": markets or {"spot": True, "linear": True, "inverse": False, "option": False},
                "created_at": datetime.utcnow(),
                "last_updated": datetime.utcnow(),
                "status": "active",
                "data_cache": {
                    "balance": None,
                    "positions": [],
                    "orders": [],
                    "last_balance_update": None,
                    "last_positions_update": None
                }
            }
            
            self.http_sessions[connection_id] = http_session
            
            # Start data streaming for this connection
            await self.start_data_streaming(connection_id)
            
            logger.info(f"✅ ByBit connection added: {connection_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to add connection {connection_id}: {e}")
            raise
    
    async def remove_connection(self, connection_id: str):
        """Remove ByBit connection"""
        try:
            logger.info(f"🗑️ Removing ByBit connection: {connection_id}")
            
            # Stop background tasks
            task_key = f"data_stream_{connection_id}"
            if task_key in self.background_tasks:
                self.background_tasks[task_key].cancel()
                del self.background_tasks[task_key]
            
            # Clean up sessions
            if connection_id in self.http_sessions:
                del self.http_sessions[connection_id]
            
            if connection_id in self.websocket_sessions:
                # Close WebSocket if exists
                try:
                    self.websocket_sessions[connection_id].exit()
                except:
                    pass
                del self.websocket_sessions[connection_id]
            
            # Remove connection data
            if connection_id in self.connections:
                del self.connections[connection_id]
            
            logger.info(f"✅ ByBit connection removed: {connection_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to remove connection {connection_id}: {e}")
    
    async def start_data_streaming(self, connection_id: str):
        """Start background data streaming for connection"""
        try:
            # Cancel existing task if any
            task_key = f"data_stream_{connection_id}"
            if task_key in self.background_tasks:
                self.background_tasks[task_key].cancel()
            
            # Start new background task
            self.background_tasks[task_key] = asyncio.create_task(
                self._connection_data_updater(connection_id)
            )
            
            logger.info(f"📊 Started data streaming for connection: {connection_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to start data streaming for {connection_id}: {e}")
    
    async def _connection_data_updater(self, connection_id: str):
        """Background task to update connection data"""
        try:
            while connection_id in self.connections:
                await self._update_connection_data(connection_id)
                await asyncio.sleep(self.update_intervals["balance"])
                
        except asyncio.CancelledError:
            logger.info(f"🛑 Data updater cancelled for connection: {connection_id}")
        except Exception as e:
            logger.error(f"❌ Data updater error for {connection_id}: {e}")
    
    async def _update_connection_data(self, connection_id: str):
        """Update data for specific connection"""
        try:
            if connection_id not in self.http_sessions:
                return
            
            session = self.http_sessions[connection_id]
            conn_data = self.connections[connection_id]
            
            # Update balance
            try:
                balance_result = session.get_wallet_balance(accountType="UNIFIED")
                if balance_result["retCode"] == 0:
                    conn_data["data_cache"]["balance"] = self._process_balance_data(balance_result["result"])
                    conn_data["data_cache"]["last_balance_update"] = datetime.utcnow()
            except Exception as e:
                logger.error(f"Failed to update balance for {connection_id}: {e}")
            
            # Update positions
            try:
                positions_result = session.get_positions(category="linear", settleCoin="USDT")
                if positions_result["retCode"] == 0:
                    conn_data["data_cache"]["positions"] = self._process_positions_data(positions_result["result"])
                    conn_data["data_cache"]["last_positions_update"] = datetime.utcnow()
            except Exception as e:
                logger.error(f"Failed to update positions for {connection_id}: {e}")
            
            # Update last_updated timestamp
            conn_data["last_updated"] = datetime.utcnow()
            
        except Exception as e:
            logger.error(f"❌ Failed to update data for {connection_id}: {e}")
    
    def _process_balance_data(self, balance_result: Dict[str, Any]) -> Dict[str, Any]:
        """Process balance data from ByBit API"""
        try:
            account_data = balance_result["list"][0] if balance_result["list"] else {}
            
            total_equity = float(account_data.get("totalEquity", "0"))
            total_available = float(account_data.get("totalAvailableBalance", "0"))
            total_margin = float(account_data.get("totalInitialMargin", "0"))
            
            # Process individual coins
            coins = []
            for coin_data in account_data.get("coin", []):
                coin_balance = float(coin_data.get("walletBalance", "0"))
                if coin_balance > 0:  # Only include coins with balance
                    coins.append({
                        "coin": coin_data.get("coin"),
                        "walletBalance": coin_balance,
                        "availableBalance": float(coin_data.get("availableToWithdraw", "0")),
                        "locked": coin_balance - float(coin_data.get("availableToWithdraw", "0")),
                        "usdValue": float(coin_data.get("usdValue", "0"))
                    })
            
            return {
                "total": total_equity,
                "available": total_available,
                "inOrder": total_margin,
                "coins": coins,
                "lastUpdated": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to process balance data: {e}")
            return {
                "total": 0,
                "available": 0,
                "inOrder": 0,
                "coins": [],
                "lastUpdated": datetime.utcnow().isoformat()
            }
    
    def _process_positions_data(self, positions_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Process positions data from ByBit API"""
        try:
            positions = []
            
            for pos_data in positions_result.get("list", []):
                size = float(pos_data.get("size", "0"))
                if size > 0:  # Only active positions
                    entry_price = float(pos_data.get("avgPrice", "0"))
                    mark_price = float(pos_data.get("markPrice", "0"))
                    unrealized_pnl = float(pos_data.get("unrealisedPnl", "0"))
                    
                    position = {
                        "id": f"{pos_data.get('symbol')}_{pos_data.get('side')}",
                        "symbol": pos_data.get("symbol"),
                        "direction": "LONG" if pos_data.get("side") == "Buy" else "SHORT",
                        "amount": size,
                        "entryPrice": entry_price,
                        "currentPrice": mark_price,
                        "pnl": unrealized_pnl,
                        "pnlPercent": (unrealized_pnl / (size * entry_price) * 100) if entry_price > 0 else 0,
                        "status": "OPEN",
                        "exchange": "ByBit",
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    positions.append(position)
            
            return positions
            
        except Exception as e:
            logger.error(f"Failed to process positions data: {e}")
            return []
    
    async def get_connection_data(self, connection_id: str) -> Optional[Dict[str, Any]]:
        """Get all data for a specific connection"""
        try:
            if connection_id not in self.connections:
                return None
            
            conn_data = self.connections[connection_id]
            cache = conn_data["data_cache"]
            
            return {
                "connectionId": connection_id,
                "balance": cache.get("balance"),
                "positions": cache.get("positions", []),
                "orderHistory": cache.get("orders", []),
                "lastUpdated": conn_data["last_updated"].isoformat(),
                "errors": {
                    "balance": None,
                    "positions": None,
                    "orderHistory": None
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get connection data for {connection_id}: {e}")
            return None
    
    async def get_instruments(self) -> List[Dict[str, Any]]:
        """Get all available trading instruments/symbols from ByBit"""
        try:
            # Use any available session or create temporary one
            session = None
            if self.http_sessions:
                session = next(iter(self.http_sessions.values()))
            else:
                session = HTTP(testnet=False)
            
            # Get all linear instruments (USDT perpetuals)
            instruments_result = session.get_instruments_info(category="linear")
            
            instruments = []
            if instruments_result["retCode"] == 0:
                for instrument in instruments_result["result"]["list"]:
                    # Filter for active USDT pairs
                    if (instrument.get("status") == "Trading" and 
                        instrument.get("quoteCoin") == "USDT" and
                        instrument.get("symbol", "").endswith("USDT")):
                        
                        instruments.append({
                            "symbol": instrument.get("symbol"),
                            "baseCoin": instrument.get("baseCoin"),
                            "quoteCoin": instrument.get("quoteCoin"),
                            "status": instrument.get("status"),
                            "contractType": instrument.get("contractType", "LinearPerpetual")
                        })
            
            # Sort by symbol for better UX
            instruments.sort(key=lambda x: x["symbol"])
            logger.info(f"✅ Retrieved {len(instruments)} trading instruments")
            
            return instruments
            
        except Exception as e:
            logger.error(f"Failed to get instruments: {e}")
            return []

    async def get_market_data(self, symbols: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Get market ticker data"""
        try:
            # Use cached data if recent
            if (self.last_market_update and 
                datetime.utcnow() - self.last_market_update < timedelta(seconds=self.update_intervals["market_data"])):
                return list(self.market_data_cache.values())
            
            # Get fresh data
            symbols_to_fetch = symbols or self.default_symbols
            
            # Use any available session for market data (doesn't require auth)
            session = None
            if self.http_sessions:
                session = next(iter(self.http_sessions.values()))
            else:
                # Create temporary session for market data
                session = HTTP(testnet=False)
            
            market_data = []
            
            for symbol in symbols_to_fetch:
                try:
                    ticker_result = session.get_tickers(category="linear", symbol=symbol)
                    if ticker_result["retCode"] == 0 and ticker_result["result"]["list"]:
                        ticker = ticker_result["result"]["list"][0]
                        
                        last_price = float(ticker.get("lastPrice", "0"))
                        prev_price = float(ticker.get("prevPrice24h", last_price))
                        change_24h = last_price - prev_price
                        
                        market_item = {
                            "symbol": symbol,
                            "price": last_price,
                            "change24h": change_24h,
                            "volume24h": float(ticker.get("volume24h", "0")),
                            "high24h": float(ticker.get("highPrice24h", "0")),
                            "low24h": float(ticker.get("lowPrice24h", "0"))
                        }
                        
                        market_data.append(market_item)
                        self.market_data_cache[symbol] = market_item
                        
                except Exception as e:
                    logger.error(f"Failed to get market data for {symbol}: {e}")
            
            self.last_market_update = datetime.utcnow()
            return market_data
            
        except Exception as e:
            logger.error(f"Failed to get market data: {e}")
            return []
    
    async def _market_data_updater(self):
        """Background task to update market data"""
        try:
            while True:
                await self.get_market_data()
                await asyncio.sleep(self.update_intervals["market_data"])
                
        except asyncio.CancelledError:
            logger.info("🛑 Market data updater cancelled")
        except Exception as e:
            logger.error(f"❌ Market data updater error: {e}")
    
    async def get_portfolio_summary(self) -> Dict[str, Any]:
        """Get portfolio summary across all connections"""
        try:
            total_portfolio_value = 0
            total_pnl = 0
            active_positions = 0
            portfolio_data = []
            
            for connection_id in self.connections:
                conn_data = await self.get_connection_data(connection_id)
                if conn_data and conn_data["balance"]:
                    balance = conn_data["balance"]
                    positions = conn_data["positions"]
                    
                    total_portfolio_value += balance.get("total", 0)
                    active_positions += len(positions)
                    
                    # Calculate PnL from positions
                    connection_pnl = sum(pos.get("pnl", 0) for pos in positions)
                    total_pnl += connection_pnl
                    
                    portfolio_data.append({
                        "connectionId": connection_id,
                        "balance": balance,
                        "positionsCount": len(positions)
                    })
            
            return {
                "totalPortfolioValue": total_portfolio_value,
                "totalPnL": total_pnl,
                "activePositions": active_positions,
                "totalConnections": len(self.connections),
                "portfolioData": portfolio_data
            }
            
        except Exception as e:
            logger.error(f"Failed to get portfolio summary: {e}")
            return {
                "totalPortfolioValue": 0,
                "totalPnL": 0,
                "activePositions": 0,
                "totalConnections": 0,
                "portfolioData": []
            }
    
    def get_all_connections(self) -> List[str]:
        """Get list of all connection IDs"""
        return list(self.connections.keys())
    
    async def cleanup(self):
        """Cleanup PyBit service"""
        try:
            logger.info("🧹 Cleaning up PyBit service...")
            
            # Cancel all background tasks
            for task in self.background_tasks.values():
                task.cancel()
            
            # Wait for tasks to finish
            if self.background_tasks:
                await asyncio.gather(*self.background_tasks.values(), return_exceptions=True)
            
            # Close WebSocket connections
            for ws in self.websocket_sessions.values():
                try:
                    ws.exit()
                except:
                    pass
            
            self.connections.clear()
            self.http_sessions.clear()
            self.websocket_sessions.clear()
            self.background_tasks.clear()
            
            logger.info("✅ PyBit service cleanup completed")
            
        except Exception as e:
            logger.error(f"❌ PyBit cleanup failed: {e}")