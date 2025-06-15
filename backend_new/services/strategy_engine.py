#!/usr/bin/env python3
"""
Strategy Execution Engine - CTB Trading Bot
Volledig automatische strategy execution met real-time monitoring
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, asdict
from enum import Enum
import threading
from concurrent.futures import ThreadPoolExecutor

from pybit.unified_trading import HTTP
import pandas as pd
import numpy as np
from .database import get_database

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StrategyStatus(Enum):
    INACTIVE = "INACTIVE"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    ERROR = "ERROR"
    STOPPED = "STOPPED"

class SignalType(Enum):
    BUY = "BUY"
    SELL = "SELL"
    CLOSE_LONG = "CLOSE_LONG"
    CLOSE_SHORT = "CLOSE_SHORT"
    HOLD = "HOLD"

class OrderStatus(Enum):
    PENDING = "PENDING"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    PARTIAL = "PARTIAL"

@dataclass
class TradingSignal:
    strategy_id: str
    symbol: str
    signal_type: SignalType
    price: float
    quantity: float
    confidence: float
    timestamp: datetime
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    leverage: int = 1
    metadata: Dict[str, Any] = None

@dataclass
class Strategy:
    id: str
    name: str
    connection_id: str
    symbol: str
    status: StrategyStatus
    config: Dict[str, Any]
    last_signal: Optional[TradingSignal] = None
    last_execution: Optional[datetime] = None
    performance: Dict[str, float] = None
    risk_limits: Dict[str, float] = None
    created_at: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc)
        if self.performance is None:
            self.performance = {
                'total_pnl': 0.0,
                'win_rate': 0.0,
                'total_trades': 0,
                'current_drawdown': 0.0,
                'max_drawdown': 0.0
            }
        if self.risk_limits is None:
            self.risk_limits = {
                'max_position_size': 1000.0,
                'max_daily_loss': 500.0,
                'max_drawdown': 0.20,
                'max_leverage': 10
            }

class StrategyExecutionEngine:
    """
    Volledig automatische strategy execution engine
    """
    
    def __init__(self):
        self.strategies: Dict[str, Strategy] = {}
        self.active_connections: Dict[str, HTTP] = {}
        self.is_running = False
        self.executor = ThreadPoolExecutor(max_workers=10)
        self.execution_loop_task = None
        self.monitoring_task = None
        
        # Performance tracking
        self.execution_stats = {
            'total_signals': 0,
            'successful_executions': 0,
            'failed_executions': 0,
            'total_pnl': 0.0,
            'uptime_start': datetime.now(timezone.utc)
        }
        
        # Risk management
        self.global_risk_limits = {
            'max_total_exposure': 10000.0,
            'max_daily_loss': 1000.0,
            'max_portfolio_drawdown': 0.30,
            'emergency_stop_triggered': False
        }
        
        self.signal_queue = asyncio.Queue()
        self.position_monitor = {}
        
    def add_strategy(self, strategy: Strategy) -> bool:
        """Voeg nieuwe strategy toe aan execution engine"""
        try:
            self.strategies[strategy.id] = strategy
            
            # Save to database
            db = get_database()
            strategy_data = asdict(strategy)
            strategy_data['status'] = strategy.status.value
            db.save_strategy(strategy_data)
            
            logger.info(f"Strategy {strategy.name} ({strategy.id}) toegevoegd aan engine")
            return True
        except Exception as e:
            logger.error(f"Fout bij toevoegen strategy: {e}")
            return False
    
    def remove_strategy(self, strategy_id: str) -> bool:
        """Verwijder strategy uit execution engine"""
        try:
            if strategy_id in self.strategies:
                strategy = self.strategies[strategy_id]
                strategy.status = StrategyStatus.STOPPED
                del self.strategies[strategy_id]
                logger.info(f"Strategy {strategy_id} verwijderd uit engine")
                return True
            return False
        except Exception as e:
            logger.error(f"Fout bij verwijderen strategy: {e}")
            return False
    
    def activate_strategy(self, strategy_id: str) -> bool:
        """Activeer strategy voor automatische execution"""
        try:
            if strategy_id in self.strategies:
                self.strategies[strategy_id].status = StrategyStatus.ACTIVE
                logger.info(f"Strategy {strategy_id} geactiveerd")
                return True
            return False
        except Exception as e:
            logger.error(f"Fout bij activeren strategy: {e}")
            return False
    
    def pause_strategy(self, strategy_id: str) -> bool:
        """Pauzeer strategy execution"""
        try:
            if strategy_id in self.strategies:
                self.strategies[strategy_id].status = StrategyStatus.PAUSED
                logger.info(f"Strategy {strategy_id} gepauzeerd")
                return True
            return False
        except Exception as e:
            logger.error(f"Fout bij pauzeren strategy: {e}")
            return False
    
    def add_connection(self, connection_id: str, api_key: str, secret_key: str):
        """Voeg ByBit API connectie toe"""
        try:
            session = HTTP(
                testnet=False,
                api_key=api_key,
                api_secret=secret_key
            )
            
            # Test connection
            account_info = session.get_wallet_balance(accountType="UNIFIED")
            if account_info['retCode'] == 0:
                self.active_connections[connection_id] = session
                logger.info(f"ByBit connectie {connection_id} succesvol toegevoegd")
                return True
            else:
                logger.error(f"ByBit connectie test gefaald: {account_info}")
                return False
                
        except Exception as e:
            logger.error(f"Fout bij toevoegen connectie: {e}")
            return False
    
    async def start_engine(self):
        """Start de strategy execution engine"""
        if self.is_running:
            logger.warning("Engine is al actief")
            return
            
        # Load strategies from database
        await self._load_strategies_from_db()
            
        self.is_running = True
        logger.info("🚀 Strategy Execution Engine GESTART")
        
        # Start execution loop
        self.execution_loop_task = asyncio.create_task(self._execution_loop())
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        
        # Start signal processing
        asyncio.create_task(self._process_signals())
        
    async def stop_engine(self):
        """Stop de strategy execution engine"""
        self.is_running = False
        
        # Cancel tasks
        if self.execution_loop_task:
            self.execution_loop_task.cancel()
        if self.monitoring_task:
            self.monitoring_task.cancel()
            
        # Stop alle strategies
        for strategy in self.strategies.values():
            strategy.status = StrategyStatus.STOPPED
            
        logger.info("🛑 Strategy Execution Engine GESTOPT")
    
    async def _execution_loop(self):
        """Hoofdloop voor strategy execution"""
        logger.info("💫 Execution loop gestart")
        
        while self.is_running:
            try:
                await self._execute_strategies()
                await asyncio.sleep(1)  # 1 seconde tussen executions
                
            except Exception as e:
                logger.error(f"Fout in execution loop: {e}")
                await asyncio.sleep(5)  # Langere pauze bij errors
    
    async def _execute_strategies(self):
        """Executeer alle actieve strategies"""
        active_strategies = [
            s for s in self.strategies.values() 
            if s.status == StrategyStatus.ACTIVE
        ]
        
        if not active_strategies:
            return
            
        # Execute strategies parallel
        tasks = []
        for strategy in active_strategies:
            task = asyncio.create_task(self._execute_single_strategy(strategy))
            tasks.append(task)
            
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _execute_single_strategy(self, strategy: Strategy):
        """Executeer een enkele strategy"""
        try:
            # Check of connection beschikbaar is
            if strategy.connection_id not in self.active_connections:
                logger.warning(f"Connectie {strategy.connection_id} niet beschikbaar voor strategy {strategy.id}")
                return
                
            # Generate signal
            signal = await self._generate_signal(strategy)
            
            if signal and signal.signal_type != SignalType.HOLD:
                # Validate signal
                if await self._validate_signal(signal, strategy):
                    # Execute trade
                    success = await self._execute_trade(signal, strategy)
                    
                    if success:
                        strategy.last_signal = signal
                        strategy.last_execution = datetime.now(timezone.utc)
                        self.execution_stats['successful_executions'] += 1
                    else:
                        self.execution_stats['failed_executions'] += 1
                        
                self.execution_stats['total_signals'] += 1
                
        except Exception as e:
            logger.error(f"Fout bij executeren strategy {strategy.id}: {e}")
            strategy.status = StrategyStatus.ERROR
    
    async def _generate_signal(self, strategy: Strategy) -> Optional[TradingSignal]:
        """Genereer trading signal voor strategy"""
        try:
            # Get market data
            session = self.active_connections[strategy.connection_id]
            
            # Get kline data
            klines = session.get_kline(
                category="linear",
                symbol=strategy.symbol,
                interval="1",
                limit=100
            )
            
            if klines['retCode'] != 0:
                logger.error(f"Kan geen kline data ophalen: {klines}")
                return None
            
            # Convert to DataFrame
            df = pd.DataFrame(klines['result']['list'])
            df.columns = ['timestamp', 'open', 'high', 'low', 'close', 'volume', 'turnover']
            df = df.astype({
                'open': float, 'high': float, 'low': float, 
                'close': float, 'volume': float
            })
            df = df.sort_values('timestamp').reset_index(drop=True)
            
            # Apply strategy logic
            signal = self._apply_strategy_logic(df, strategy)
            
            return signal
            
        except Exception as e:
            logger.error(f"Fout bij genereren signal: {e}")
            return None
    
    def _apply_strategy_logic(self, df: pd.DataFrame, strategy: Strategy) -> Optional[TradingSignal]:
        """Apply strategy logic to generate signals"""
        try:
            config = strategy.config
            
            # Simple moving average crossover strategy
            if config.get('type') == 'ma_crossover':
                short_period = config.get('short_ma', 10)
                long_period = config.get('long_ma', 30)
                
                df['ma_short'] = df['close'].rolling(short_period).mean()
                df['ma_long'] = df['close'].rolling(long_period).mean()
                
                # Check crossover
                if len(df) >= long_period:
                    current_short = df['ma_short'].iloc[-1]
                    current_long = df['ma_long'].iloc[-1]
                    prev_short = df['ma_short'].iloc[-2]
                    prev_long = df['ma_long'].iloc[-2]
                    current_price = df['close'].iloc[-1]
                    
                    # Bullish crossover
                    if prev_short <= prev_long and current_short > current_long:
                        return TradingSignal(
                            strategy_id=strategy.id,
                            symbol=strategy.symbol,
                            signal_type=SignalType.BUY,
                            price=current_price,
                            quantity=config.get('position_size', 0.01),
                            confidence=0.7,
                            timestamp=datetime.now(timezone.utc),
                            stop_loss=current_price * 0.98,
                            take_profit=current_price * 1.04,
                            leverage=config.get('leverage', 1)
                        )
                    
                    # Bearish crossover
                    elif prev_short >= prev_long and current_short < current_long:
                        return TradingSignal(
                            strategy_id=strategy.id,
                            symbol=strategy.symbol,
                            signal_type=SignalType.SELL,
                            price=current_price,
                            quantity=config.get('position_size', 0.01),
                            confidence=0.7,
                            timestamp=datetime.now(timezone.utc),
                            stop_loss=current_price * 1.02,
                            take_profit=current_price * 0.96,
                            leverage=config.get('leverage', 1)
                        )
            
            # RSI strategy
            elif config.get('type') == 'rsi':
                period = config.get('rsi_period', 14)
                overbought = config.get('overbought', 70)
                oversold = config.get('oversold', 30)
                
                # Calculate RSI
                delta = df['close'].diff()
                gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
                loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
                rs = gain / loss
                df['rsi'] = 100 - (100 / (1 + rs))
                
                if len(df) >= period:
                    current_rsi = df['rsi'].iloc[-1]
                    current_price = df['close'].iloc[-1]
                    
                    # Oversold - Buy signal
                    if current_rsi < oversold:
                        return TradingSignal(
                            strategy_id=strategy.id,
                            symbol=strategy.symbol,
                            signal_type=SignalType.BUY,
                            price=current_price,
                            quantity=config.get('position_size', 0.01),
                            confidence=min(0.9, (oversold - current_rsi) / 10),
                            timestamp=datetime.now(timezone.utc),
                            stop_loss=current_price * 0.97,
                            take_profit=current_price * 1.05,
                            leverage=config.get('leverage', 1)
                        )
                    
                    # Overbought - Sell signal
                    elif current_rsi > overbought:
                        return TradingSignal(
                            strategy_id=strategy.id,
                            symbol=strategy.symbol,
                            signal_type=SignalType.SELL,
                            price=current_price,
                            quantity=config.get('position_size', 0.01),
                            confidence=min(0.9, (current_rsi - overbought) / 10),
                            timestamp=datetime.now(timezone.utc),
                            stop_loss=current_price * 1.03,
                            take_profit=current_price * 0.95,
                            leverage=config.get('leverage', 1)
                        )
            
            return None  # No signal
            
        except Exception as e:
            logger.error(f"Fout bij toepassen strategy logic: {e}")
            return None
    
    async def _validate_signal(self, signal: TradingSignal, strategy: Strategy) -> bool:
        """Valideer trading signal"""
        try:
            # Check risk limits
            if not self._check_risk_limits(signal, strategy):
                logger.warning(f"Signal gefaald op risk limits check: {signal.symbol}")
                return False
            
            # Check market conditions
            if not await self._check_market_conditions(signal):
                logger.warning(f"Signal gefaald op market conditions check: {signal.symbol}")
                return False
            
            # Check position limits
            if not self._check_position_limits(signal, strategy):
                logger.warning(f"Signal gefaald op position limits check: {signal.symbol}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Fout bij valideren signal: {e}")
            return False
    
    def _check_risk_limits(self, signal: TradingSignal, strategy: Strategy) -> bool:
        """Check risk management limits"""
        try:
            # Check strategy risk limits
            risk_limits = strategy.risk_limits
            
            # Check position size
            if signal.quantity > risk_limits.get('max_position_size', 1000):
                return False
            
            # Check leverage
            if signal.leverage > risk_limits.get('max_leverage', 10):
                return False
            
            # Check current drawdown
            if strategy.performance['current_drawdown'] > risk_limits.get('max_drawdown', 0.20):
                return False
            
            # Check global risk limits
            if self.global_risk_limits['emergency_stop_triggered']:
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Fout bij risk limits check: {e}")
            return False
    
    async def _check_market_conditions(self, signal: TradingSignal) -> bool:
        """Check market conditions"""
        try:
            # Basic market condition checks
            # Could be extended with volatility, volume, spread checks
            return True
            
        except Exception as e:
            logger.error(f"Fout bij market conditions check: {e}")
            return False
    
    def _check_position_limits(self, signal: TradingSignal, strategy: Strategy) -> bool:
        """Check position size limits"""
        try:
            # Check if we already have position in this symbol
            # This is a simplified check - in real implementation
            # we would check actual positions via API
            return True
            
        except Exception as e:
            logger.error(f"Fout bij position limits check: {e}")
            return False
    
    async def _execute_trade(self, signal: TradingSignal, strategy: Strategy) -> bool:
        """Execute trading signal"""
        try:
            session = self.active_connections[strategy.connection_id]
            
            # Set leverage if needed
            if signal.leverage > 1:
                leverage_result = session.set_leverage(
                    category="linear",
                    symbol=signal.symbol,
                    buyLeverage=str(signal.leverage),
                    sellLeverage=str(signal.leverage)
                )
                
                if leverage_result['retCode'] != 0:
                    logger.error(f"Kan leverage niet instellen: {leverage_result}")
                    return False
            
            # Place order
            side = "Buy" if signal.signal_type == SignalType.BUY else "Sell"
            
            order_params = {
                "category": "linear",
                "symbol": signal.symbol,
                "side": side,
                "orderType": "Market",
                "qty": str(signal.quantity),
                "timeInForce": "IOC"
            }
            
            # Add stop loss if provided
            if signal.stop_loss:
                order_params["stopLoss"] = str(signal.stop_loss)
            
            # Add take profit if provided
            if signal.take_profit:
                order_params["takeProfit"] = str(signal.take_profit)
            
            result = session.place_order(**order_params)
            
            if result['retCode'] == 0:
                order_id = result['result']['orderId']
                logger.info(f"✅ Order geplaatst: {order_id} - {side} {signal.quantity} {signal.symbol} @ {signal.price}")
                
                # Save trade to database
                db = get_database()
                trade_data = {
                    'id': f"trade_{int(time.time())}_{order_id}",
                    'strategy_id': strategy.id,
                    'connection_id': strategy.connection_id,
                    'symbol': signal.symbol,
                    'side': side.lower(),
                    'order_type': 'market',
                    'quantity': signal.quantity,
                    'price': signal.price,
                    'status': 'executed',
                    'order_id': order_id,
                    'leverage': signal.leverage,
                    'take_profit': signal.take_profit,
                    'stop_loss': signal.stop_loss,
                    'executed_at': datetime.now(timezone.utc).isoformat(),
                    'metadata': asdict(signal)
                }
                db.save_trade(trade_data)
                
                # Update performance
                strategy.performance['total_trades'] += 1
                
                # Update strategy in database
                strategy_data = asdict(strategy)
                strategy_data['status'] = strategy.status.value
                db.save_strategy(strategy_data)
                
                # Add to signal queue for monitoring
                await self.signal_queue.put(signal)
                
                return True
            else:
                logger.error(f"❌ Order gefaald: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Fout bij executeren trade: {e}")
            return False
    
    async def _monitoring_loop(self):
        """Monitor positions en performance"""
        logger.info("📊 Monitoring loop gestart")
        
        while self.is_running:
            try:
                await self._monitor_positions()
                await self._update_performance()
                await self._check_global_risk()
                await asyncio.sleep(5)  # Monitor elke 5 seconden
                
            except Exception as e:
                logger.error(f"Fout in monitoring loop: {e}")
                await asyncio.sleep(10)
    
    async def _monitor_positions(self):
        """Monitor open positions"""
        try:
            for connection_id, session in self.active_connections.items():
                positions = session.get_positions(category="linear")
                
                if positions['retCode'] == 0:
                    for pos in positions['result']['list']:
                        if float(pos['size']) > 0:  # Has position
                            await self._check_position_conditions(pos, connection_id, session)
                            
        except Exception as e:
            logger.error(f"Fout bij monitoren positions: {e}")
    
    async def _check_position_conditions(self, position: Dict, connection_id: str, session: HTTP):
        """Check position conditions (stop loss, take profit, etc.)"""
        try:
            symbol = position['symbol']
            size = float(position['size'])
            entry_price = float(position['avgPrice'])
            unrealised_pnl = float(position['unrealisedPnl'])
            
            # Check for trailing stop loss or other custom conditions
            # This is where you'd implement advanced position management
            
        except Exception as e:
            logger.error(f"Fout bij checken position conditions: {e}")
    
    async def _update_performance(self):
        """Update performance metrics"""
        try:
            for strategy in self.strategies.values():
                # Calculate performance metrics
                # This would be connected to actual trade history
                pass
                
        except Exception as e:
            logger.error(f"Fout bij updaten performance: {e}")
    
    async def _check_global_risk(self):
        """Check global risk management"""
        try:
            total_pnl = 0.0
            total_exposure = 0.0
            
            # Calculate from all connections
            for connection_id, session in self.active_connections.items():
                balance = session.get_wallet_balance(accountType="UNIFIED")
                if balance['retCode'] == 0:
                    for coin in balance['result']['list'][0]['coin']:
                        if coin['coin'] == 'USDT':
                            total_pnl += float(coin['unrealisedPnl'])
                            total_exposure += abs(float(coin['unrealisedPnl']))
            
            # Check limits
            if total_pnl < -self.global_risk_limits['max_daily_loss']:
                logger.warning("🚨 DAILY LOSS LIMIT BEREIKT - EMERGENCY STOP")
                self.global_risk_limits['emergency_stop_triggered'] = True
                await self._emergency_stop()
            
            if total_exposure > self.global_risk_limits['max_total_exposure']:
                logger.warning("🚨 TOTAL EXPOSURE LIMIT BEREIKT")
                # Reduce positions or pause strategies
                
        except Exception as e:
            logger.error(f"Fout bij global risk check: {e}")
    
    async def _emergency_stop(self):
        """Emergency stop all trading"""
        logger.critical("🚨🚨🚨 EMERGENCY STOP ACTIVATED 🚨🚨🚨")
        
        # Stop all strategies
        for strategy in self.strategies.values():
            strategy.status = StrategyStatus.STOPPED
        
        # Close all positions (optional - be careful!)
        # This is commented out for safety
        # await self._close_all_positions()
    
    async def _process_signals(self):
        """Process signals from queue"""
        while self.is_running:
            try:
                signal = await asyncio.wait_for(self.signal_queue.get(), timeout=1.0)
                # Process the signal (logging, notifications, etc.)
                logger.info(f"📡 Signal processed: {signal.symbol} {signal.signal_type.value}")
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Fout bij processing signals: {e}")
    
    def get_engine_status(self) -> Dict[str, Any]:
        """Get current engine status"""
        return {
            'is_running': self.is_running,
            'total_strategies': len(self.strategies),
            'active_strategies': len([s for s in self.strategies.values() if s.status == StrategyStatus.ACTIVE]),
            'total_connections': len(self.active_connections),
            'execution_stats': self.execution_stats,
            'global_risk_limits': self.global_risk_limits,
            'uptime': (datetime.now(timezone.utc) - self.execution_stats['uptime_start']).total_seconds()
        }
    
    def get_strategy_status(self, strategy_id: str) -> Optional[Dict[str, Any]]:
        """Get specific strategy status"""
        if strategy_id in self.strategies:
            strategy = self.strategies[strategy_id]
            return {
                'id': strategy.id,
                'name': strategy.name,
                'status': strategy.status.value,
                'symbol': strategy.symbol,
                'performance': strategy.performance,
                'last_execution': strategy.last_execution.isoformat() if strategy.last_execution else None,
                'last_signal': asdict(strategy.last_signal) if strategy.last_signal else None
            }
        return None
    
    async def _load_strategies_from_db(self):
        """Load strategies from database"""
        try:
            db = get_database()
            strategies = db.load_all_strategies()
            
            for strategy_data in strategies:
                if strategy_data['status'] in ['ACTIVE', 'PAUSED']:
                    strategy = Strategy(
                        id=strategy_data['id'],
                        name=strategy_data['name'],
                        connection_id=strategy_data['connection_id'],
                        symbol=strategy_data['symbol'],
                        status=StrategyStatus(strategy_data['status']),
                        config=strategy_data['config'],
                        risk_limits=strategy_data['risk_limits'],
                        performance=strategy_data['performance'] or {
                            'total_pnl': 0.0, 'win_rate': 0.0, 'total_trades': 0,
                            'current_drawdown': 0.0, 'max_drawdown': 0.0
                        },
                        created_at=datetime.fromisoformat(strategy_data['created_at']) if strategy_data['created_at'] else datetime.now(timezone.utc),
                        last_execution=datetime.fromisoformat(strategy_data['last_execution']) if strategy_data['last_execution'] else None,
                        last_signal=None  # Will be loaded separately if needed
                    )
                    self.strategies[strategy.id] = strategy
                    logger.info(f"✅ Strategy {strategy.name} loaded from database")
                    
        except Exception as e:
            logger.error(f"❌ Error loading strategies from database: {e}")

# Global engine instance
strategy_engine = StrategyExecutionEngine()

# Import time for trade IDs
import time