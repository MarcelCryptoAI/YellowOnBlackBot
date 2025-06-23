#!/usr/bin/env python3
"""
Mass Symbol Manager - CTB Trading Bot
Manages 500+ cryptocurrency trading pairs with intelligent prioritization
"""

import asyncio
import json
import logging
import sqlite3
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from pybit.unified_trading import HTTP

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class SymbolInfo:
    symbol: str
    base_coin: str
    quote_coin: str
    status: str
    volume_24h: float
    price_change_24h: float
    priority_score: float
    last_analyzed: Optional[datetime] = None

class MassSymbolManager:
    """
    Manages and prioritizes 500+ trading symbols for AI analysis
    """
    
    def __init__(self):
        self.all_symbols: Dict[str, SymbolInfo] = {}
        self.high_priority_symbols: List[str] = []
        self.medium_priority_symbols: List[str] = []
        self.low_priority_symbols: List[str] = []
        self.connections = {}
        
    async def initialize(self):
        """Initialize symbol manager with all available symbols"""
        logger.info("🚀 Initializing Mass Symbol Manager...")
        
        await self._load_connections()
        await self._fetch_all_symbols()
        await self._prioritize_symbols()
        await self._create_mass_strategies()
        
        logger.info(f"✅ Mass Symbol Manager initialized with {len(self.all_symbols)} symbols")
    
    async def _load_connections(self):
        """Load ByBit connections"""
        try:
            with open('live_connections.json', 'r') as f:
                connections_data = json.load(f)
            
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
    
    async def _fetch_all_symbols(self):
        """Fetch all available trading symbols from ByBit"""
        try:
            session = list(self.connections.values())[0]
            
            # Get instruments
            instruments = session.get_instruments_info(category='linear')
            if instruments['retCode'] != 0:
                raise Exception(f"Failed to fetch instruments: {instruments}")
            
            # Get 24h tickers for volume/price data
            tickers = session.get_tickers(category='linear')
            ticker_data = {ticker['symbol']: ticker for ticker in tickers['result']['list']}
            
            # Process symbols
            for instrument in instruments['result']['list']:
                if (instrument['quoteCoin'] == 'USDT' and 
                    instrument['status'] == 'Trading' and
                    instrument['contractType'] == 'LinearPerpetual'):
                    
                    symbol = instrument['symbol']
                    ticker = ticker_data.get(symbol, {})
                    
                    symbol_info = SymbolInfo(
                        symbol=symbol,
                        base_coin=instrument['baseCoin'],
                        quote_coin=instrument['quoteCoin'],
                        status=instrument['status'],
                        volume_24h=float(ticker.get('volume24h', 0)),
                        price_change_24h=float(ticker.get('price24hPcnt', 0)) * 100,
                        priority_score=0.0
                    )
                    
                    self.all_symbols[symbol] = symbol_info
            
            logger.info(f"📊 Fetched {len(self.all_symbols)} USDT trading pairs")
            
        except Exception as e:
            logger.error(f"❌ Error fetching symbols: {e}")
    
    async def _prioritize_symbols(self):
        """Prioritize symbols based on volume, volatility, and market cap"""
        try:
            # Calculate priority scores
            for symbol, info in self.all_symbols.items():
                score = 0.0
                
                # Volume score (higher volume = higher priority)
                if info.volume_24h > 10000000:  # > $10M volume
                    score += 50
                elif info.volume_24h > 1000000:  # > $1M volume
                    score += 30
                elif info.volume_24h > 100000:   # > $100K volume
                    score += 10
                
                # Volatility score (moderate volatility preferred)
                abs_change = abs(info.price_change_24h)
                if 2 <= abs_change <= 15:  # 2-15% change (good for trading)
                    score += 30
                elif abs_change > 15:      # High volatility
                    score += 20
                elif abs_change > 1:       # Low volatility
                    score += 10
                
                # Major coin bonus
                major_coins = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'BNB', 'AVAX', 'DOT', 'LINK']
                if any(major in symbol for major in major_coins):
                    score += 40
                
                # Meme coin bonus (often high volatility opportunities)
                meme_indicators = ['PEPE', 'SHIB', 'FLOKI', 'DOGE', 'MEME', 'BABY', 'ELON']
                if any(meme in symbol for meme in meme_indicators):
                    score += 20
                
                info.priority_score = score
            
            # Sort into priority tiers
            sorted_symbols = sorted(self.all_symbols.items(), key=lambda x: x[1].priority_score, reverse=True)
            
            # Top 50 high priority (most volume/activity)
            self.high_priority_symbols = [s[0] for s in sorted_symbols[:50]]
            
            # Next 150 medium priority
            self.medium_priority_symbols = [s[0] for s in sorted_symbols[50:200]]
            
            # Remaining low priority
            self.low_priority_symbols = [s[0] for s in sorted_symbols[200:]]
            
            logger.info(f"📊 Symbol prioritization complete:")
            logger.info(f"   🔥 High Priority: {len(self.high_priority_symbols)} symbols")
            logger.info(f"   🟡 Medium Priority: {len(self.medium_priority_symbols)} symbols")
            logger.info(f"   🟢 Low Priority: {len(self.low_priority_symbols)} symbols")
            
            # Log top 10 symbols
            logger.info("🎯 Top 10 priority symbols:")
            for i, symbol in enumerate(self.high_priority_symbols[:10]):
                info = self.all_symbols[symbol]
                logger.info(f"   {i+1:2d}. {symbol} (Score: {info.priority_score:.1f}, Vol: ${info.volume_24h:,.0f})")
            
        except Exception as e:
            logger.error(f"❌ Error prioritizing symbols: {e}")
    
    async def _create_mass_strategies(self):
        """Create AI strategies for all symbols"""
        try:
            conn = sqlite3.connect('ctb_trading_bot.db')
            cursor = conn.cursor()
            
            # Clear existing mass strategies
            cursor.execute("DELETE FROM strategies WHERE name LIKE 'AI Mass %'")
            
            created_count = 0
            
            # Create strategies for all symbols
            all_symbols_list = (self.high_priority_symbols + 
                              self.medium_priority_symbols + 
                              self.low_priority_symbols)
            
            for symbol in all_symbols_list:
                strategy_id = f'ai_mass_{symbol.lower()}_{created_count+1:03d}'
                info = self.all_symbols[symbol]
                
                # Determine analysis frequency based on priority
                if symbol in self.high_priority_symbols:
                    analysis_interval = 180    # 3 minutes
                    priority_level = "HIGH"
                elif symbol in self.medium_priority_symbols:
                    analysis_interval = 600    # 10 minutes  
                    priority_level = "MEDIUM"
                else:
                    analysis_interval = 1800   # 30 minutes
                    priority_level = "LOW"
                
                strategy_config = {
                    'id': strategy_id,
                    'name': f'AI Mass {symbol}',
                    'connection_id': 'marcel_1749306780000',  # Crypto Oppulence
                    'symbol': symbol,
                    'status': 'ACTIVE',
                    'config': json.dumps({
                        'type': 'ai_mass_trading',
                        'leverage': 25,
                        'position_size': 5.0,
                        'ai_optimized': True,
                        'dynamic_parameters': True,
                        'priority_level': priority_level,
                        'analysis_interval': analysis_interval,
                        'volume_24h': info.volume_24h,
                        'priority_score': info.priority_score,
                        'min_confidence': 0.75,
                        'stop_loss_pct': 'AI_DETERMINED',
                        'take_profit_pct': 'AI_DETERMINED',
                    }),
                    'risk_limits': json.dumps({
                        'max_position_size': 50.0,
                        'max_daily_loss': 25.0,
                        'max_drawdown': 0.08,
                        'max_leverage': 25,
                        'max_concurrent_positions': 1,
                    }),
                    'performance': json.dumps({
                        'total_trades': 0,
                        'win_rate': 0.0,
                        'total_pnl': 0.0,
                        'max_drawdown': 0.0,
                        'sharpe_ratio': 0.0,
                        'ai_confidence_avg': 0.0
                    }),
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }
                
                cursor.execute('''
                    INSERT INTO strategies (
                        id, name, connection_id, symbol, status, config, risk_limits,
                        performance, created_at, updated_at, last_execution, last_signal
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    strategy_config['id'],
                    strategy_config['name'],
                    strategy_config['connection_id'],
                    strategy_config['symbol'],
                    strategy_config['status'],
                    strategy_config['config'],
                    strategy_config['risk_limits'],
                    strategy_config['performance'],
                    strategy_config['created_at'],
                    strategy_config['updated_at'],
                    None,
                    None
                ))
                
                created_count += 1
            
            conn.commit()
            conn.close()
            
            logger.info(f"✅ Created {created_count} mass AI strategies!")
            logger.info(f"   🔥 High Priority: {len(self.high_priority_symbols)} strategies (3min analysis)")
            logger.info(f"   🟡 Medium Priority: {len(self.medium_priority_symbols)} strategies (10min analysis)")
            logger.info(f"   🟢 Low Priority: {len(self.low_priority_symbols)} strategies (30min analysis)")
            
        except Exception as e:
            logger.error(f"❌ Error creating mass strategies: {e}")
    
    def get_symbols_by_priority(self, priority: str) -> List[str]:
        """Get symbols by priority level"""
        if priority.upper() == 'HIGH':
            return self.high_priority_symbols
        elif priority.upper() == 'MEDIUM':
            return self.medium_priority_symbols
        elif priority.upper() == 'LOW':
            return self.low_priority_symbols
        else:
            return list(self.all_symbols.keys())
    
    def get_symbol_info(self, symbol: str) -> Optional[SymbolInfo]:
        """Get symbol information"""
        return self.all_symbols.get(symbol)

# Global mass symbol manager
mass_symbol_manager = MassSymbolManager()