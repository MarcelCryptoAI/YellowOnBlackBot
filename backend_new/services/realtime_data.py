#!/usr/bin/env python3
"""
Real-time Data Processing Pipeline - CTB Trading Bot
WebSocket data feeds en real-time market data processing
"""

import asyncio
import json
import logging
import websockets
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
import threading
from collections import deque
import time

import pandas as pd
import numpy as np

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class MarketData:
    symbol: str
    price: float
    volume: float
    timestamp: datetime
    high_24h: float = None
    low_24h: float = None
    change_24h: float = None
    bid: float = None
    ask: float = None

@dataclass
class KlineData:
    symbol: str
    open_price: float
    high_price: float
    low_price: float
    close_price: float
    volume: float
    timestamp: datetime
    interval: str

class RealTimeDataProcessor:
    """
    Real-time market data processing en WebSocket management
    """
    
    def __init__(self):
        self.websocket_connections: Dict[str, websockets.WebSocketServerProtocol] = {}
        self.market_data: Dict[str, MarketData] = {}
        self.kline_buffers: Dict[str, deque] = {}
        self.subscribers: Dict[str, List[Callable]] = {}
        
        # ByBit WebSocket URLs
        self.bybit_ws_url = "wss://stream.bybit.com/v5/public/linear"
        self.bybit_connection = None
        
        # Data processing
        self.is_running = False
        self.processing_tasks = []
        
        # Performance metrics
        self.stats = {
            'messages_received': 0,
            'messages_processed': 0,
            'errors': 0,
            'uptime_start': datetime.now(timezone.utc),
            'last_data_received': None
        }
        
        # Buffer size voor kline data
        self.max_buffer_size = 1000
        
    async def start_data_feeds(self, symbols: List[str]):
        """Start real-time data feeds voor gegeven symbols"""
        if self.is_running:
            logger.warning("Data feeds zijn al actief")
            return
            
        self.is_running = True
        logger.info(f"🔄 Starting real-time data feeds voor {len(symbols)} symbols")
        
        # Start ByBit WebSocket
        await self._start_bybit_websocket(symbols)
        
        # Start data processing tasks
        self.processing_tasks = [
            asyncio.create_task(self._process_market_data()),
            asyncio.create_task(self._update_indicators()),
            asyncio.create_task(self._broadcast_updates())
        ]
        
    async def stop_data_feeds(self):
        """Stop alle data feeds"""
        self.is_running = False
        
        # Close WebSocket connections
        if self.bybit_connection:
            await self.bybit_connection.close()
            
        # Cancel processing tasks
        for task in self.processing_tasks:
            task.cancel()
            
        logger.info("🛑 Real-time data feeds gestopt")
    
    async def _start_bybit_websocket(self, symbols: List[str]):
        """Start ByBit WebSocket connectie"""
        try:
            self.bybit_connection = await websockets.connect(self.bybit_ws_url)
            logger.info("✅ ByBit WebSocket verbonden")
            
            # Subscribe to tickers
            ticker_subscriptions = [f"tickers.{symbol}" for symbol in symbols]
            
            # Subscribe to klines (1m interval)
            kline_subscriptions = [f"kline.1.{symbol}" for symbol in symbols]
            
            all_subscriptions = ticker_subscriptions + kline_subscriptions
            
            subscribe_message = {
                "op": "subscribe",
                "args": all_subscriptions
            }
            
            await self.bybit_connection.send(json.dumps(subscribe_message))
            logger.info(f"📡 Subscribed to {len(all_subscriptions)} data streams")
            
            # Start message handler
            asyncio.create_task(self._handle_bybit_messages())
            
        except Exception as e:
            logger.error(f"Fout bij starten ByBit WebSocket: {e}")
    
    async def _handle_bybit_messages(self):
        """Handle incoming WebSocket messages van ByBit"""
        logger.info("📨 ByBit message handler gestart")
        
        while self.is_running and self.bybit_connection:
            try:
                message = await self.bybit_connection.recv()
                data = json.loads(message)
                
                self.stats['messages_received'] += 1
                self.stats['last_data_received'] = datetime.now(timezone.utc)
                
                await self._process_bybit_message(data)
                
            except websockets.exceptions.ConnectionClosed:
                logger.warning("ByBit WebSocket verbinding verloren")
                await self._reconnect_bybit()
                break
            except Exception as e:
                logger.error(f"Fout bij verwerken ByBit message: {e}")
                self.stats['errors'] += 1
                await asyncio.sleep(1)
    
    async def _process_bybit_message(self, data: Dict[str, Any]):
        """Process incoming ByBit WebSocket message"""
        try:
            if 'topic' not in data:
                return
                
            topic = data['topic']
            
            # Process ticker data
            if topic.startswith('tickers'):
                await self._process_ticker_data(data)
                
            # Process kline data
            elif topic.startswith('kline'):
                await self._process_kline_data(data)
                
            self.stats['messages_processed'] += 1
            
        except Exception as e:
            logger.error(f"Fout bij processing ByBit message: {e}")
            self.stats['errors'] += 1
    
    async def _process_ticker_data(self, data: Dict[str, Any]):
        """Process ticker data"""
        try:
            ticker_data = data['data']
            symbol = ticker_data['symbol']
            
            market_data = MarketData(
                symbol=symbol,
                price=float(ticker_data['lastPrice']),
                volume=float(ticker_data['volume24h']),
                timestamp=datetime.now(timezone.utc),
                high_24h=float(ticker_data['highPrice24h']),
                low_24h=float(ticker_data['lowPrice24h']),
                change_24h=float(ticker_data['price24hPcnt']),
                bid=float(ticker_data['bid1Price']),
                ask=float(ticker_data['ask1Price'])
            )
            
            self.market_data[symbol] = market_data
            
            # Notify subscribers
            await self._notify_subscribers('ticker', symbol, market_data)
            
        except Exception as e:
            logger.error(f"Fout bij processing ticker data: {e}")
    
    async def _process_kline_data(self, data: Dict[str, Any]):
        """Process kline data"""
        try:
            kline_list = data['data']
            
            for kline_raw in kline_list:
                symbol = kline_raw['symbol']
                
                kline_data = KlineData(
                    symbol=symbol,
                    open_price=float(kline_raw['open']),
                    high_price=float(kline_raw['high']),
                    low_price=float(kline_raw['low']),
                    close_price=float(kline_raw['close']),
                    volume=float(kline_raw['volume']),
                    timestamp=datetime.fromtimestamp(int(kline_raw['start']) / 1000, tz=timezone.utc),
                    interval=kline_raw['interval']
                )
                
                # Add to buffer
                if symbol not in self.kline_buffers:
                    self.kline_buffers[symbol] = deque(maxlen=self.max_buffer_size)
                
                self.kline_buffers[symbol].append(kline_data)
                
                # Notify subscribers
                await self._notify_subscribers('kline', symbol, kline_data)
                
        except Exception as e:
            logger.error(f"Fout bij processing kline data: {e}")
    
    async def _reconnect_bybit(self):
        """Reconnect to ByBit WebSocket"""
        logger.info("🔄 Reconnecting to ByBit WebSocket...")
        await asyncio.sleep(5)  # Wait before reconnecting
        
        # Get current symbols
        symbols = list(set([symbol for symbol in self.market_data.keys()]))
        
        if symbols:
            await self._start_bybit_websocket(symbols)
    
    async def _process_market_data(self):
        """Process en analyze market data"""
        while self.is_running:
            try:
                # Calculate market metrics
                await self._calculate_market_metrics()
                await asyncio.sleep(1)  # Update every second
                
            except Exception as e:
                logger.error(f"Fout bij processing market data: {e}")
                await asyncio.sleep(5)
    
    async def _calculate_market_metrics(self):
        """Calculate real-time market metrics"""
        try:
            for symbol, market_data in self.market_data.items():
                if symbol in self.kline_buffers and len(self.kline_buffers[symbol]) >= 20:
                    # Get recent klines
                    klines = list(self.kline_buffers[symbol])[-20:]  # Last 20 minutes
                    
                    # Convert to DataFrame
                    df = pd.DataFrame([{
                        'timestamp': k.timestamp,
                        'open': k.open_price,
                        'high': k.high_price,
                        'low': k.low_price,
                        'close': k.close_price,
                        'volume': k.volume
                    } for k in klines])
                    
                    # Calculate indicators
                    indicators = self._calculate_indicators(df)
                    
                    # Notify subscribers with indicators
                    await self._notify_subscribers('indicators', symbol, indicators)
                    
        except Exception as e:
            logger.error(f"Fout bij calculating market metrics: {e}")
    
    def _calculate_indicators(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate technical indicators"""
        try:
            indicators = {}
            
            # Moving averages
            indicators['sma_5'] = df['close'].rolling(5).mean().iloc[-1]
            indicators['sma_10'] = df['close'].rolling(10).mean().iloc[-1]
            indicators['sma_20'] = df['close'].rolling(20).mean().iloc[-1]
            
            # RSI
            delta = df['close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            indicators['rsi'] = (100 - (100 / (1 + rs))).iloc[-1]
            
            # MACD
            ema12 = df['close'].ewm(span=12).mean()
            ema26 = df['close'].ewm(span=26).mean()
            indicators['macd'] = (ema12 - ema26).iloc[-1]
            indicators['macd_signal'] = (ema12 - ema26).ewm(span=9).mean().iloc[-1]
            
            # Bollinger Bands
            sma20 = df['close'].rolling(20).mean()
            std20 = df['close'].rolling(20).std()
            indicators['bb_upper'] = (sma20 + (std20 * 2)).iloc[-1]
            indicators['bb_lower'] = (sma20 - (std20 * 2)).iloc[-1]
            indicators['bb_middle'] = sma20.iloc[-1]
            
            # Volume metrics
            indicators['avg_volume'] = df['volume'].rolling(10).mean().iloc[-1]
            indicators['volume_ratio'] = df['volume'].iloc[-1] / indicators['avg_volume']
            
            # Price action
            indicators['price_change_1m'] = ((df['close'].iloc[-1] - df['close'].iloc[-2]) / df['close'].iloc[-2]) * 100
            indicators['price_change_5m'] = ((df['close'].iloc[-1] - df['close'].iloc[-6]) / df['close'].iloc[-6]) * 100 if len(df) >= 6 else 0
            
            # Clean NaN values
            for key, value in indicators.items():
                if pd.isna(value):
                    indicators[key] = 0.0
                    
            return indicators
            
        except Exception as e:
            logger.error(f"Fout bij calculating indicators: {e}")
            return {}
    
    async def _update_indicators(self):
        """Update technical indicators"""
        while self.is_running:
            try:
                # This is handled in _calculate_market_metrics
                await asyncio.sleep(5)  # Update every 5 seconds
                
            except Exception as e:
                logger.error(f"Fout bij updating indicators: {e}")
                await asyncio.sleep(10)
    
    async def _broadcast_updates(self):
        """Broadcast updates to WebSocket clients"""
        while self.is_running:
            try:
                # Broadcast market data to connected clients
                if self.websocket_connections:
                    update_data = {
                        'type': 'market_update',
                        'timestamp': datetime.now(timezone.utc).isoformat(),
                        'data': {
                            symbol: {
                                'price': data.price,
                                'volume': data.volume,
                                'change_24h': data.change_24h,
                                'bid': data.bid,
                                'ask': data.ask
                            } for symbol, data in self.market_data.items()
                        }
                    }
                    
                    # Send to all connected clients
                    await self._broadcast_to_clients(update_data)
                
                await asyncio.sleep(1)  # Broadcast every second
                
            except Exception as e:
                logger.error(f"Fout bij broadcasting updates: {e}")
                await asyncio.sleep(5)
    
    async def _broadcast_to_clients(self, data: Dict[str, Any]):
        """Broadcast data to all WebSocket clients"""
        if not self.websocket_connections:
            return
            
        message = json.dumps(data)
        disconnected_clients = []
        
        for client_id, websocket in self.websocket_connections.items():
            try:
                await websocket.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected_clients.append(client_id)
            except Exception as e:
                logger.error(f"Fout bij sending to client {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Remove disconnected clients
        for client_id in disconnected_clients:
            del self.websocket_connections[client_id]
    
    async def _notify_subscribers(self, data_type: str, symbol: str, data: Any):
        """Notify subscribers van nieuwe data"""
        try:
            key = f"{data_type}_{symbol}"
            if key in self.subscribers:
                for callback in self.subscribers[key]:
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            await callback(data_type, symbol, data)
                        else:
                            callback(data_type, symbol, data)
                    except Exception as e:
                        logger.error(f"Fout bij calling subscriber callback: {e}")
                        
        except Exception as e:
            logger.error(f"Fout bij notifying subscribers: {e}")
    
    def subscribe(self, data_type: str, symbol: str, callback: Callable):
        """Subscribe to data updates"""
        key = f"{data_type}_{symbol}"
        if key not in self.subscribers:
            self.subscribers[key] = []
        self.subscribers[key].append(callback)
        logger.info(f"New subscriber voor {key}")
    
    def unsubscribe(self, data_type: str, symbol: str, callback: Callable):
        """Unsubscribe from data updates"""
        key = f"{data_type}_{symbol}"
        if key in self.subscribers and callback in self.subscribers[key]:
            self.subscribers[key].remove(callback)
            logger.info(f"Subscriber removed voor {key}")
    
    def add_websocket_client(self, client_id: str, websocket: websockets.WebSocketServerProtocol):
        """Add WebSocket client voor real-time updates"""
        self.websocket_connections[client_id] = websocket
        logger.info(f"WebSocket client {client_id} toegevoegd")
    
    def remove_websocket_client(self, client_id: str):
        """Remove WebSocket client"""
        if client_id in self.websocket_connections:
            del self.websocket_connections[client_id]
            logger.info(f"WebSocket client {client_id} verwijderd")
    
    def get_market_data(self, symbol: str) -> Optional[MarketData]:
        """Get current market data voor symbol"""
        return self.market_data.get(symbol)
    
    def get_kline_data(self, symbol: str, limit: int = 100) -> List[KlineData]:
        """Get recent kline data voor symbol"""
        if symbol in self.kline_buffers:
            return list(self.kline_buffers[symbol])[-limit:]
        return []
    
    def get_stats(self) -> Dict[str, Any]:
        """Get processor statistics"""
        return {
            **self.stats,
            'active_symbols': len(self.market_data),
            'websocket_clients': len(self.websocket_connections),
            'subscribers': len(self.subscribers),
            'buffer_sizes': {symbol: len(buffer) for symbol, buffer in self.kline_buffers.items()},
            'uptime': (datetime.now(timezone.utc) - self.stats['uptime_start']).total_seconds()
        }

# Global data processor instance
data_processor = RealTimeDataProcessor()