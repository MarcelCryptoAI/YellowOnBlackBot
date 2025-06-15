#!/usr/bin/env python3
"""
Database Service - CTB Trading Bot
SQLite database voor persistent data storage
"""

import sqlite3
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import asdict
import os
from contextlib import contextmanager

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Temporarily disable performance optimizer
PERFORMANCE_OPTIMIZATION_ENABLED = False
performance_optimizer = None
logger.warning("Performance optimizer not available - running without optimization")

class DatabaseService:
    """
    Database service voor persistent data storage
    """
    
    def __init__(self, db_path: str = "ctb_trading_bot.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database tables"""
        with self.get_connection() as conn:
            # Strategies table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS strategies (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    connection_id TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    status TEXT NOT NULL,
                    config TEXT NOT NULL,
                    risk_limits TEXT,
                    performance TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_execution TIMESTAMP,
                    last_signal TEXT
                )
            """)
            
            # Trades table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS trades (
                    id TEXT PRIMARY KEY,
                    strategy_id TEXT,
                    connection_id TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    side TEXT NOT NULL,
                    order_type TEXT NOT NULL,
                    quantity REAL NOT NULL,
                    price REAL,
                    executed_price REAL,
                    executed_quantity REAL,
                    status TEXT NOT NULL,
                    order_id TEXT,
                    pnl REAL DEFAULT 0,
                    fees REAL DEFAULT 0,
                    leverage INTEGER DEFAULT 1,
                    take_profit REAL,
                    stop_loss REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    executed_at TIMESTAMP,
                    closed_at TIMESTAMP,
                    metadata TEXT,
                    FOREIGN KEY (strategy_id) REFERENCES strategies (id)
                )
            """)
            
            # Risk alerts table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS risk_alerts (
                    id TEXT PRIMARY KEY,
                    alert_type TEXT NOT NULL,
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    strategy_id TEXT,
                    symbol TEXT,
                    current_value REAL,
                    limit_value REAL,
                    metadata TEXT,
                    resolved BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    resolved_at TIMESTAMP
                )
            """)
            
            # Performance metrics table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS performance_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    strategy_id TEXT,
                    metric_type TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    value REAL NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT,
                    FOREIGN KEY (strategy_id) REFERENCES strategies (id)
                )
            """)
            
            # System metrics table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS system_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    metric_name TEXT NOT NULL,
                    value REAL NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    labels TEXT
                )
            """)
            
            # Positions table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS positions (
                    id TEXT PRIMARY KEY,
                    strategy_id TEXT,
                    connection_id TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    side TEXT NOT NULL,
                    size REAL NOT NULL,
                    entry_price REAL NOT NULL,
                    current_price REAL,
                    unrealized_pnl REAL DEFAULT 0,
                    realized_pnl REAL DEFAULT 0,
                    leverage INTEGER DEFAULT 1,
                    margin_mode TEXT,
                    take_profit REAL,
                    stop_loss REAL,
                    status TEXT DEFAULT 'OPEN',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    closed_at TIMESTAMP,
                    metadata TEXT,
                    FOREIGN KEY (strategy_id) REFERENCES strategies (id)
                )
            """)
            
            # Market data table (for backtesting and analysis)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS market_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    open_price REAL NOT NULL,
                    high_price REAL NOT NULL,
                    low_price REAL NOT NULL,
                    close_price REAL NOT NULL,
                    volume REAL NOT NULL,
                    interval_type TEXT NOT NULL,
                    UNIQUE(symbol, timestamp, interval_type)
                )
            """)
            
            # Configuration table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS configuration (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            conn.commit()
            logger.info("✅ Database initialized successfully")
    
    @contextmanager
    def get_connection(self):
        """Get database connection with proper cleanup"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable column access by name
        try:
            yield conn
        finally:
            conn.close()
    
    # Strategy CRUD operations
    def save_strategy(self, strategy: Dict[str, Any]) -> bool:
        """Save or update strategy"""
        try:
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO strategies 
                    (id, name, connection_id, symbol, status, config, risk_limits, performance, 
                     last_execution, last_signal, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    strategy['id'],
                    strategy['name'],
                    strategy['connection_id'],
                    strategy['symbol'],
                    strategy['status'],
                    json.dumps(strategy['config']),
                    json.dumps(strategy.get('risk_limits')),
                    json.dumps(strategy.get('performance')),
                    strategy.get('last_execution'),
                    json.dumps(strategy.get('last_signal'))
                ))
                conn.commit()
                logger.info(f"✅ Strategy {strategy['id']} saved to database")
                return True
        except Exception as e:
            logger.error(f"❌ Error saving strategy: {e}")
            return False
    
    def load_strategy(self, strategy_id: str) -> Optional[Dict[str, Any]]:
        """Load strategy by ID"""
        try:
            with self.get_connection() as conn:
                row = conn.execute(
                    "SELECT * FROM strategies WHERE id = ?", (strategy_id,)
                ).fetchone()
                
                if row:
                    strategy = dict(row)
                    strategy['config'] = json.loads(strategy['config'])
                    strategy['risk_limits'] = json.loads(strategy['risk_limits']) if strategy['risk_limits'] else None
                    strategy['performance'] = json.loads(strategy['performance']) if strategy['performance'] else None
                    strategy['last_signal'] = json.loads(strategy['last_signal']) if strategy['last_signal'] else None
                    return strategy
                return None
        except Exception as e:
            logger.error(f"❌ Error loading strategy: {e}")
            return None
    
    def load_all_strategies(self) -> List[Dict[str, Any]]:
        """Load all strategies"""
        async def _load_strategies():
            try:
                with self.get_connection() as conn:
                    rows = conn.execute("SELECT * FROM strategies ORDER BY created_at DESC").fetchall()
                    strategies = []
                    
                    for row in rows:
                        strategy = dict(row)
                        strategy['config'] = json.loads(strategy['config'])
                        strategy['risk_limits'] = json.loads(strategy['risk_limits']) if strategy['risk_limits'] else None
                        strategy['performance'] = json.loads(strategy['performance']) if strategy['performance'] else None
                        strategy['last_signal'] = json.loads(strategy['last_signal']) if strategy['last_signal'] else None
                        strategies.append(strategy)
                    
                    return strategies
            except Exception as e:
                logger.error(f"❌ Error loading strategies: {e}")
                return []
        
        # Use performance optimization if available
        if PERFORMANCE_OPTIMIZATION_ENABLED:
            try:
                import asyncio
                loop = asyncio.get_event_loop()
                return loop.run_until_complete(
                    performance_optimizer.optimized_db_operation(_load_strategies)
                )
            except Exception as e:
                logger.warning(f"Performance optimization failed, falling back to direct DB access: {e}")
                
        # Fallback to direct execution
        return asyncio.run(_load_strategies())
    
    def delete_strategy(self, strategy_id: str) -> bool:
        """Delete strategy"""
        try:
            with self.get_connection() as conn:
                conn.execute("DELETE FROM strategies WHERE id = ?", (strategy_id,))
                conn.commit()
                logger.info(f"✅ Strategy {strategy_id} deleted from database")
                return True
        except Exception as e:
            logger.error(f"❌ Error deleting strategy: {e}")
            return False
    
    # Trade CRUD operations
    def save_trade(self, trade: Dict[str, Any]) -> bool:
        """Save trade"""
        try:
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO trades 
                    (id, strategy_id, connection_id, symbol, side, order_type, quantity, price, 
                     executed_price, executed_quantity, status, order_id, pnl, fees, leverage,
                     take_profit, stop_loss, executed_at, closed_at, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    trade['id'],
                    trade.get('strategy_id'),
                    trade['connection_id'],
                    trade['symbol'],
                    trade['side'],
                    trade['order_type'],
                    trade['quantity'],
                    trade.get('price'),
                    trade.get('executed_price'),
                    trade.get('executed_quantity'),
                    trade['status'],
                    trade.get('order_id'),
                    trade.get('pnl', 0),
                    trade.get('fees', 0),
                    trade.get('leverage', 1),
                    trade.get('take_profit'),
                    trade.get('stop_loss'),
                    trade.get('executed_at'),
                    trade.get('closed_at'),
                    json.dumps(trade.get('metadata'))
                ))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"❌ Error saving trade: {e}")
            return False
    
    def load_trades(self, strategy_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Load trades"""
        async def _load_trades():
            try:
                with self.get_connection() as conn:
                    if strategy_id:
                        rows = conn.execute(
                            "SELECT * FROM trades WHERE strategy_id = ? ORDER BY created_at DESC LIMIT ?",
                            (strategy_id, limit)
                        ).fetchall()
                    else:
                        rows = conn.execute(
                            "SELECT * FROM trades ORDER BY created_at DESC LIMIT ?",
                            (limit,)
                        ).fetchall()
                    
                    trades = []
                    for row in rows:
                        trade = dict(row)
                        trade['metadata'] = json.loads(trade['metadata']) if trade['metadata'] else None
                        trades.append(trade)
                    
                    return trades
            except Exception as e:
                logger.error(f"❌ Error loading trades: {e}")
                return []
        
        # Use performance optimization if available
        if PERFORMANCE_OPTIMIZATION_ENABLED:
            try:
                import asyncio
                loop = asyncio.get_event_loop()
                return loop.run_until_complete(
                    performance_optimizer.optimized_db_operation(_load_trades)
                )
            except Exception as e:
                logger.warning(f"Performance optimization failed, falling back to direct DB access: {e}")
                
        # Fallback to direct execution
        return asyncio.run(_load_trades())
    
    # Risk alerts CRUD operations
    def save_risk_alert(self, alert: Dict[str, Any]) -> bool:
        """Save risk alert"""
        try:
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT INTO risk_alerts 
                    (id, alert_type, level, message, strategy_id, symbol, current_value,
                     limit_value, metadata, resolved, resolved_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    alert['id'],
                    alert['alert_type'],
                    alert['level'],
                    alert['message'],
                    alert.get('strategy_id'),
                    alert.get('symbol'),
                    alert.get('current_value'),
                    alert.get('limit_value'),
                    json.dumps(alert.get('metadata')),
                    alert.get('resolved', False),
                    alert.get('resolved_at')
                ))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"❌ Error saving risk alert: {e}")
            return False
    
    def load_risk_alerts(self, resolved: Optional[bool] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Load risk alerts"""
        try:
            with self.get_connection() as conn:
                if resolved is not None:
                    rows = conn.execute(
                        "SELECT * FROM risk_alerts WHERE resolved = ? ORDER BY created_at DESC LIMIT ?",
                        (resolved, limit)
                    ).fetchall()
                else:
                    rows = conn.execute(
                        "SELECT * FROM risk_alerts ORDER BY created_at DESC LIMIT ?",
                        (limit,)
                    ).fetchall()
                
                alerts = []
                for row in rows:
                    alert = dict(row)
                    alert['metadata'] = json.loads(alert['metadata']) if alert['metadata'] else None
                    alerts.append(alert)
                
                return alerts
        except Exception as e:
            logger.error(f"❌ Error loading risk alerts: {e}")
            return []
    
    def resolve_risk_alert(self, alert_id: str) -> bool:
        """Resolve risk alert"""
        try:
            with self.get_connection() as conn:
                conn.execute(
                    "UPDATE risk_alerts SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (alert_id,)
                )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"❌ Error resolving risk alert: {e}")
            return False
    
    # Performance metrics
    def save_performance_metric(self, strategy_id: Optional[str], metric_type: str, 
                               metric_name: str, value: float, metadata: Optional[Dict] = None) -> bool:
        """Save performance metric"""
        try:
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT INTO performance_metrics 
                    (strategy_id, metric_type, metric_name, value, metadata)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    strategy_id,
                    metric_type,
                    metric_name,
                    value,
                    json.dumps(metadata) if metadata else None
                ))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"❌ Error saving performance metric: {e}")
            return False
    
    def load_performance_metrics(self, strategy_id: Optional[str] = None, 
                                metric_name: Optional[str] = None, 
                                hours: int = 24) -> List[Dict[str, Any]]:
        """Load performance metrics"""
        try:
            with self.get_connection() as conn:
                query = """
                    SELECT * FROM performance_metrics 
                    WHERE timestamp > datetime('now', '-{} hours')
                """.format(hours)
                params = []
                
                if strategy_id:
                    query += " AND strategy_id = ?"
                    params.append(strategy_id)
                
                if metric_name:
                    query += " AND metric_name = ?"
                    params.append(metric_name)
                
                query += " ORDER BY timestamp DESC"
                
                rows = conn.execute(query, params).fetchall()
                
                metrics = []
                for row in rows:
                    metric = dict(row)
                    metric['metadata'] = json.loads(metric['metadata']) if metric['metadata'] else None
                    metrics.append(metric)
                
                return metrics
        except Exception as e:
            logger.error(f"❌ Error loading performance metrics: {e}")
            return []
    
    # System metrics
    def save_system_metric(self, metric_name: str, value: float, labels: Optional[Dict] = None) -> bool:
        """Save system metric"""
        try:
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT INTO system_metrics (metric_name, value, labels)
                    VALUES (?, ?, ?)
                """, (
                    metric_name,
                    value,
                    json.dumps(labels) if labels else None
                ))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"❌ Error saving system metric: {e}")
            return False
    
    def load_system_metrics(self, metric_name: Optional[str] = None, hours: int = 24) -> List[Dict[str, Any]]:
        """Load system metrics"""
        try:
            with self.get_connection() as conn:
                if metric_name:
                    rows = conn.execute("""
                        SELECT * FROM system_metrics 
                        WHERE metric_name = ? AND timestamp > datetime('now', '-{} hours')
                        ORDER BY timestamp DESC
                    """.format(hours), (metric_name,)).fetchall()
                else:
                    rows = conn.execute("""
                        SELECT * FROM system_metrics 
                        WHERE timestamp > datetime('now', '-{} hours')
                        ORDER BY timestamp DESC
                    """.format(hours)).fetchall()
                
                metrics = []
                for row in rows:
                    metric = dict(row)
                    metric['labels'] = json.loads(metric['labels']) if metric['labels'] else None
                    metrics.append(metric)
                
                return metrics
        except Exception as e:
            logger.error(f"❌ Error loading system metrics: {e}")
            return []
    
    # Positions CRUD operations
    def save_position(self, position: Dict[str, Any]) -> bool:
        """Save or update position"""
        try:
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO positions 
                    (id, strategy_id, connection_id, symbol, side, size, entry_price, current_price,
                     unrealized_pnl, realized_pnl, leverage, margin_mode, take_profit, stop_loss,
                     status, updated_at, closed_at, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
                """, (
                    position['id'],
                    position.get('strategy_id'),
                    position['connection_id'],
                    position['symbol'],
                    position['side'],
                    position['size'],
                    position['entry_price'],
                    position.get('current_price'),
                    position.get('unrealized_pnl', 0),
                    position.get('realized_pnl', 0),
                    position.get('leverage', 1),
                    position.get('margin_mode'),
                    position.get('take_profit'),
                    position.get('stop_loss'),
                    position.get('status', 'OPEN'),
                    position.get('closed_at'),
                    json.dumps(position.get('metadata'))
                ))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"❌ Error saving position: {e}")
            return False
    
    def load_positions(self, strategy_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Load positions"""
        try:
            with self.get_connection() as conn:
                query = "SELECT * FROM positions WHERE 1=1"
                params = []
                
                if strategy_id:
                    query += " AND strategy_id = ?"
                    params.append(strategy_id)
                
                if status:
                    query += " AND status = ?"
                    params.append(status)
                
                query += " ORDER BY created_at DESC"
                
                rows = conn.execute(query, params).fetchall()
                
                positions = []
                for row in rows:
                    position = dict(row)
                    position['metadata'] = json.loads(position['metadata']) if position['metadata'] else None
                    positions.append(position)
                
                return positions
        except Exception as e:
            logger.error(f"❌ Error loading positions: {e}")
            return []
    
    # Configuration management
    def save_config(self, key: str, value: Any) -> bool:
        """Save configuration value"""
        try:
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO configuration (key, value, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                """, (key, json.dumps(value)))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"❌ Error saving config: {e}")
            return False
    
    def load_config(self, key: str, default: Any = None) -> Any:
        """Load configuration value"""
        try:
            with self.get_connection() as conn:
                row = conn.execute("SELECT value FROM configuration WHERE key = ?", (key,)).fetchone()
                if row:
                    return json.loads(row['value'])
                return default
        except Exception as e:
            logger.error(f"❌ Error loading config: {e}")
            return default
    
    def load_all_config(self) -> Dict[str, Any]:
        """Load all configuration"""
        try:
            with self.get_connection() as conn:
                rows = conn.execute("SELECT key, value FROM configuration").fetchall()
                config = {}
                for row in rows:
                    config[row['key']] = json.loads(row['value'])
                return config
        except Exception as e:
            logger.error(f"❌ Error loading all config: {e}")
            return {}
    
    # Analytics and reporting
    def get_trading_stats(self, strategy_id: Optional[str] = None, days: int = 30) -> Dict[str, Any]:
        """Get trading statistics"""
        try:
            with self.get_connection() as conn:
                query = """
                    SELECT 
                        COUNT(*) as total_trades,
                        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
                        SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
                        SUM(pnl) as total_pnl,
                        AVG(CASE WHEN pnl > 0 THEN pnl END) as avg_win,
                        AVG(CASE WHEN pnl < 0 THEN pnl END) as avg_loss,
                        MAX(pnl) as max_win,
                        MIN(pnl) as max_loss
                    FROM trades 
                    WHERE created_at > datetime('now', '-{} days')
                """.format(days)
                
                params = []
                if strategy_id:
                    query += " AND strategy_id = ?"
                    params.append(strategy_id)
                
                row = conn.execute(query, params).fetchone()
                
                if row:
                    stats = dict(row)
                    stats['win_rate'] = (stats['winning_trades'] / stats['total_trades']) if stats['total_trades'] > 0 else 0
                    stats['profit_factor'] = abs(stats['avg_win'] * stats['winning_trades'] / (stats['avg_loss'] * stats['losing_trades'])) if stats['avg_loss'] and stats['losing_trades'] else 0
                    return stats
                
                return {
                    'total_trades': 0, 'winning_trades': 0, 'losing_trades': 0,
                    'total_pnl': 0, 'win_rate': 0, 'avg_win': 0, 'avg_loss': 0,
                    'max_win': 0, 'max_loss': 0, 'profit_factor': 0
                }
        except Exception as e:
            logger.error(f"❌ Error getting trading stats: {e}")
            return {}
    
    def cleanup_old_data(self, days: int = 90):
        """Cleanup old data"""
        try:
            with self.get_connection() as conn:
                # Clean old metrics
                conn.execute(
                    "DELETE FROM performance_metrics WHERE timestamp < datetime('now', '-{} days')".format(days)
                )
                conn.execute(
                    "DELETE FROM system_metrics WHERE timestamp < datetime('now', '-{} days')".format(days)
                )
                
                # Clean old resolved alerts
                conn.execute(
                    "DELETE FROM risk_alerts WHERE resolved = TRUE AND resolved_at < datetime('now', '-{} days')".format(days)
                )
                
                conn.commit()
                logger.info(f"✅ Cleaned up data older than {days} days")
        except Exception as e:
            logger.error(f"❌ Error cleaning up data: {e}")

# Global database instance
database = DatabaseService()

def get_database() -> DatabaseService:
    """Get database instance"""
    return database