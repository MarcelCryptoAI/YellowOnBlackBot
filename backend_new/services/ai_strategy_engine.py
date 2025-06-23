#!/usr/bin/env python3
"""
AI Strategy Engine - CTB Trading Bot
Volledig AI-gestuurde trading met dynamische parameter optimization
"""

import asyncio
import json
import logging
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import pandas as pd
import numpy as np

from .ai_trading_optimizer import ai_optimizer, AITradingSignal
from .database import DatabaseService

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class AIPosition:
    id: str
    symbol: str
    size: float
    leverage: int
    entry_price: float
    stop_loss: float
    take_profit: float
    pnl: float
    confidence: float
    created_at: datetime

class AIStrategyEngine:
    """
    AI-gestuurde strategy engine met volledig geautomatiseerde trading
    """
    
    def __init__(self):
        self.is_running = False
        self.active_positions: Dict[str, AIPosition] = {}
        self.pending_signals: Dict[str, AITradingSignal] = {}
        self.strategy_configs: Dict[str, Dict] = {}
        self.connections = {}
        self.db_service = DatabaseService()
        
        # AI trading limits
        self.max_concurrent_positions = 10
        self.max_position_size = 5.0  # $5 base
        self.leverage = 25
        self.min_ai_confidence = 0.75
        
        # Performance tracking
        self.total_trades = 0
        self.successful_trades = 0
        self.total_pnl = 0.0
        
    async def start_ai_engine(self):
        """Start de AI-gestuurde trading engine"""
        if self.is_running:
            logger.warning("AI Engine is al actief")
            return
            
        logger.info("🤖 Starting AI Trading Engine...")
        
        # Load strategies en connections
        await self._load_ai_strategies()
        await self._load_connections()
        
        self.is_running = True
        
        # Start AI loops
        asyncio.create_task(self._ai_analysis_loop())
        asyncio.create_task(self._ai_trading_loop())
        asyncio.create_task(self._ai_monitoring_loop())
        
        logger.info("✅ AI Trading Engine started!")
        
    async def stop_ai_engine(self):
        """Stop de AI engine"""
        self.is_running = False
        logger.info("🛑 AI Trading Engine stopped")
    
    async def _ai_analysis_loop(self):
        """AI analysis loop - elke 5 minuten nieuwe analyse"""
        logger.info("🧠 AI Analysis Loop started")
        
        while self.is_running:
            try:
                await self._perform_ai_market_analysis()
                await asyncio.sleep(300)  # 5 minuten
                
            except Exception as e:
                logger.error(f"❌ Error in AI analysis loop: {e}")
                await asyncio.sleep(60)
    
    async def _ai_trading_loop(self):
        """AI trading loop - elke 30 seconden check voor nieuwe trades"""
        logger.info("⚡ AI Trading Loop started")
        
        while self.is_running:
            try:
                await self._execute_ai_trades()
                await asyncio.sleep(30)  # 30 seconden
                
            except Exception as e:
                logger.error(f"❌ Error in AI trading loop: {e}")
                await asyncio.sleep(60)
    
    async def _ai_monitoring_loop(self):
        """AI monitoring loop - elke 10 seconden position monitoring"""
        logger.info("📊 AI Monitoring Loop started")
        
        while self.is_running:
            try:
                await self._monitor_ai_positions()
                await asyncio.sleep(10)  # 10 seconden
                
            except Exception as e:
                logger.error(f"❌ Error in AI monitoring loop: {e}")
                await asyncio.sleep(30)
    
    async def _perform_ai_market_analysis(self):
        """Perform AI market analysis voor alle symbols"""
        logger.info("🔍 Performing AI market analysis...")
        
        symbols = list(self.strategy_configs.keys())
        
        for symbol in symbols:
            try:
                # Get market data
                market_data = await self._get_market_data(symbol)
                current_price = market_data.get('price', 0)
                
                if current_price == 0:
                    continue
                
                # Generate AI signal
                ai_signal = await ai_optimizer.analyze_market_and_generate_signal(
                    symbol=symbol,
                    market_data=market_data,
                    current_price=current_price
                )
                
                if ai_signal and ai_signal.confidence >= self.min_ai_confidence:
                    self.pending_signals[symbol] = ai_signal
                    logger.info(f"🎯 AI Signal generated for {symbol}: {ai_signal.action} (confidence: {ai_signal.confidence:.2f})")
                
            except Exception as e:
                logger.error(f"❌ Error analyzing {symbol}: {e}")
    
    async def _execute_ai_trades(self):
        """Execute AI-generated trading signals"""
        if not self.pending_signals:
            return
            
        logger.info(f"⚡ Processing {len(self.pending_signals)} AI signals...")
        
        for symbol, signal in list(self.pending_signals.items()):
            try:
                # Check position limits
                if len(self.active_positions) >= self.max_concurrent_positions:
                    logger.warning(f"⚠️ Max positions reached ({self.max_concurrent_positions})")
                    break
                
                # Check if we already have position for this symbol
                symbol_positions = [p for p in self.active_positions.values() if p.symbol == symbol]
                if symbol_positions:
                    logger.info(f"📊 Already have position for {symbol}, skipping")
                    continue
                
                # Portfolio risk assessment
                current_positions_list = [
                    {
                        'symbol': p.symbol,
                        'size': p.size * p.leverage,
                        'pnl': p.pnl
                    } for p in self.active_positions.values()
                ]
                
                risk_assessment = await ai_optimizer.assess_portfolio_risk(
                    current_positions=current_positions_list,
                    pending_signal=signal
                )
                
                if risk_assessment.get('recommendation') != 'EXECUTE':
                    logger.warning(f"⚠️ Risk assessment rejected {symbol}: {risk_assessment.get('reasoning', 'Unknown')}")
                    del self.pending_signals[symbol]
                    continue
                
                # Execute the trade
                if signal.action in ['BUY', 'SELL']:
                    success = await self._place_ai_trade(signal)
                    if success:
                        logger.info(f"✅ AI trade executed for {symbol}")
                        self.total_trades += 1
                    else:
                        logger.error(f"❌ Failed to execute AI trade for {symbol}")
                
                # Remove processed signal
                del self.pending_signals[symbol]
                
            except Exception as e:
                logger.error(f"❌ Error executing trade for {symbol}: {e}")
    
    async def _place_ai_trade(self, signal: AITradingSignal) -> bool:
        """Place AI-generated trade with ByBit"""
        try:
            # Get connection for trading
            connection_id = list(self.connections.keys())[0]  # Use first available connection
            session = self.connections[connection_id]
            
            # Calculate position details
            position_size = self.max_position_size  # $5 base
            leverage = signal.leverage  # x25
            
            # Get current price for calculations
            ticker = session.get_tickers(category="linear", symbol=signal.symbol)
            if ticker['retCode'] != 0:
                logger.error(f"❌ Cannot get ticker for {signal.symbol}")
                return False
                
            current_price = float(ticker['result']['list'][0]['lastPrice'])
            
            # Calculate quantity (base position / price)
            quantity = round(position_size / current_price, 6)
            
            # Set leverage
            leverage_result = session.set_leverage(
                category="linear",
                symbol=signal.symbol,
                buyLeverage=str(leverage),
                sellLeverage=str(leverage)
            )
            
            if leverage_result['retCode'] != 0:
                logger.error(f"❌ Cannot set leverage for {signal.symbol}: {leverage_result}")
                return False
            
            # Place market order
            side = "Buy" if signal.action == "BUY" else "Sell"
            
            order_result = session.place_order(
                category="linear",
                symbol=signal.symbol,
                side=side,
                orderType="Market",
                qty=str(quantity),
                timeInForce="IOC"
            )
            
            if order_result['retCode'] != 0:
                logger.error(f"❌ Order failed for {signal.symbol}: {order_result}")
                return False
            
            # Calculate stop loss and take profit prices
            if signal.action == "BUY":
                stop_loss_price = current_price * (1 - signal.stop_loss_pct / 100)
                take_profit_price = current_price * (1 + signal.take_profit_pct / 100)
            else:
                stop_loss_price = current_price * (1 + signal.stop_loss_pct / 100)
                take_profit_price = current_price * (1 - signal.take_profit_pct / 100)
            
            # Place stop loss order
            session.place_order(
                category="linear",
                symbol=signal.symbol,
                side="Sell" if signal.action == "BUY" else "Buy",
                orderType="Market",
                qty=str(quantity),
                stopLoss=str(round(stop_loss_price, 4)),
                timeInForce="GTC"
            )
            
            # Place take profit order
            session.place_order(
                category="linear",
                symbol=signal.symbol,
                side="Sell" if signal.action == "BUY" else "Buy",
                orderType="Limit",
                qty=str(quantity),
                price=str(round(take_profit_price, 4)),
                timeInForce="GTC"
            )
            
            # Create position tracking
            position = AIPosition(
                id=f"ai_pos_{signal.symbol}_{int(datetime.now().timestamp())}",
                symbol=signal.symbol,
                size=position_size,
                leverage=leverage,
                entry_price=current_price,
                stop_loss=stop_loss_price,
                take_profit=take_profit_price,
                pnl=0.0,
                confidence=signal.confidence,
                created_at=datetime.now(timezone.utc)
            )
            
            self.active_positions[position.id] = position
            
            logger.info(f"🎯 AI Position opened: {signal.symbol} {signal.action} ${position_size} x{leverage}")
            logger.info(f"   📈 Entry: ${current_price:.4f}")
            logger.info(f"   🛡️ Stop Loss: ${stop_loss_price:.4f} ({signal.stop_loss_pct}%)")
            logger.info(f"   🎯 Take Profit: ${take_profit_price:.4f} ({signal.take_profit_pct}%)")
            logger.info(f"   🧠 AI Confidence: {signal.confidence:.2f}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error placing AI trade: {e}")
            return False
    
    async def _monitor_ai_positions(self):
        """Monitor active AI positions"""
        if not self.active_positions:
            return
            
        for position_id, position in list(self.active_positions.items()):
            try:
                # Get current price
                connection_id = list(self.connections.keys())[0]
                session = self.connections[connection_id]
                
                ticker = session.get_tickers(category="linear", symbol=position.symbol)
                if ticker['retCode'] != 0:
                    continue
                    
                current_price = float(ticker['result']['list'][0]['lastPrice'])
                
                # Calculate PnL
                if position.entry_price > 0:
                    price_change = (current_price - position.entry_price) / position.entry_price
                    position.pnl = price_change * position.size * position.leverage
                
                # Check for position closure conditions
                if (current_price <= position.stop_loss or 
                    current_price >= position.take_profit):
                    
                    if position.pnl > 0:
                        self.successful_trades += 1
                        
                    self.total_pnl += position.pnl
                    
                    logger.info(f"📊 Position closed: {position.symbol} PnL: ${position.pnl:.2f}")
                    del self.active_positions[position_id]
                
            except Exception as e:
                logger.error(f"❌ Error monitoring position {position_id}: {e}")
    
    async def _get_market_data(self, symbol: str) -> Dict[str, Any]:
        """Get market data for symbol"""
        try:
            connection_id = list(self.connections.keys())[0]
            session = self.connections[connection_id]
            
            ticker = session.get_tickers(category="linear", symbol=symbol)
            if ticker['retCode'] != 0:
                return {}
                
            data = ticker['result']['list'][0]
            
            return {
                'price': float(data['lastPrice']),
                'volume24h': float(data['volume24h']),
                'priceChange24h': float(data['price24hPcnt']) * 100,
                'high24h': float(data['highPrice24h']),
                'low24h': float(data['lowPrice24h'])
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting market data for {symbol}: {e}")
            return {}
    
    async def _load_ai_strategies(self):
        """Load AI strategies from database"""
        try:
            conn = sqlite3.connect('ctb_trading_bot.db')
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT symbol, config FROM strategies 
                WHERE status = 'ACTIVE' AND (config LIKE '%ai_multi_coin%' OR config LIKE '%ai_mass_trading%')
            ''')
            
            strategies = cursor.fetchall()
            
            for symbol, config_str in strategies:
                config = json.loads(config_str)
                self.strategy_configs[symbol] = config
                
            conn.close()
            logger.info(f"📊 Loaded {len(self.strategy_configs)} AI strategies")
            
            # Log priority breakdown
            high_priority = len([s for s in self.strategy_configs.values() if s.get('priority_level') == 'HIGH'])
            medium_priority = len([s for s in self.strategy_configs.values() if s.get('priority_level') == 'MEDIUM']) 
            low_priority = len([s for s in self.strategy_configs.values() if s.get('priority_level') == 'LOW'])
            
            logger.info(f"   🔥 High Priority: {high_priority} symbols")
            logger.info(f"   🟡 Medium Priority: {medium_priority} symbols") 
            logger.info(f"   🟢 Low Priority: {low_priority} symbols")
            
        except Exception as e:
            logger.error(f"❌ Error loading AI strategies: {e}")
    
    async def _load_connections(self):
        """Load ByBit connections"""
        try:
            with open('live_connections.json', 'r') as f:
                connections_data = json.load(f)
            
            # Import ByBit HTTP session
            from pybit.unified_trading import HTTP
            
            for conn_id, conn_data in connections_data.items():
                if conn_data.get('status') == 'active':
                    session = HTTP(
                        testnet=False,
                        api_key=conn_data['apiKey'],
                        api_secret=conn_data['secretKey']
                    )
                    self.connections[conn_id] = session
                    logger.info(f"✅ Connection loaded: {conn_data['name']}")
                    
        except Exception as e:
            logger.error(f"❌ Error loading connections: {e}")
    
    def get_ai_engine_status(self) -> Dict[str, Any]:
        """Get AI engine status"""
        win_rate = (self.successful_trades / self.total_trades * 100) if self.total_trades > 0 else 0
        
        return {
            "is_running": self.is_running,
            "active_positions": len(self.active_positions),
            "pending_signals": len(self.pending_signals),
            "total_strategies": len(self.strategy_configs),
            "performance": {
                "total_trades": self.total_trades,
                "successful_trades": self.successful_trades,
                "win_rate": round(win_rate, 2),
                "total_pnl": round(self.total_pnl, 2)
            },
            "limits": {
                "max_positions": self.max_concurrent_positions,
                "min_confidence": self.min_ai_confidence,
                "leverage": self.leverage
            }
        }

# Global AI engine instance
ai_strategy_engine = AIStrategyEngine()