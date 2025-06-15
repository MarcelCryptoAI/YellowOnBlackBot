#!/usr/bin/env python3
"""
Comprehensive Risk Management System - CTB Trading Bot
Advanced risk management met portfolio limits, drawdown protection, en emergency stops
"""

import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import math

import pandas as pd
import numpy as np
from .database import get_database

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RiskLevel(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class RiskAlertType(Enum):
    POSITION_SIZE = "POSITION_SIZE"
    DRAWDOWN = "DRAWDOWN"
    CORRELATION = "CORRELATION"
    VOLATILITY = "VOLATILITY"
    EXPOSURE = "EXPOSURE"
    DAILY_LOSS = "DAILY_LOSS"
    EMERGENCY_STOP = "EMERGENCY_STOP"

@dataclass
class RiskAlert:
    alert_type: RiskAlertType
    level: RiskLevel
    message: str
    timestamp: datetime
    strategy_id: Optional[str] = None
    symbol: Optional[str] = None
    current_value: float = 0.0
    limit_value: float = 0.0
    metadata: Dict[str, Any] = None

@dataclass
class PortfolioMetrics:
    total_equity: float
    total_unrealized_pnl: float
    total_exposure: float
    daily_pnl: float
    max_drawdown: float
    current_drawdown: float
    win_rate: float
    sharpe_ratio: float
    active_positions: int
    total_trades_today: int
    timestamp: datetime

@dataclass
class PositionRisk:
    symbol: str
    size: float
    entry_price: float
    current_price: float
    unrealized_pnl: float
    risk_per_trade: float
    position_risk_ratio: float
    correlation_risk: float
    volatility: float
    var_95: float  # Value at Risk 95%
    timestamp: datetime

class RiskManager:
    """
    Comprehensive risk management systeem voor live trading
    """
    
    def __init__(self):
        # Database reference
        from .database import get_database
        self.db = get_database()
        
        # Risk limits
        self.global_limits = {
            'max_total_exposure': 50000.0,          # Max total position value
            'max_daily_loss': 2000.0,               # Max daily loss
            'max_portfolio_drawdown': 0.15,         # 15% max portfolio drawdown
            'max_position_risk': 0.02,              # 2% risk per trade
            'max_correlation_risk': 0.70,           # Max correlation between positions
            'max_single_position': 0.10,            # 10% of portfolio in single position
            'max_sector_exposure': 0.30,            # 30% in single sector
            'min_account_balance': 1000.0,          # Min account balance
            'max_leverage_global': 10,              # Global max leverage
            'max_positions': 20,                    # Max number of positions
            'volatility_threshold': 0.05            # 5% volatility threshold
        }
        
        # Strategy specific limits
        self.strategy_limits = {}
        
        # Risk tracking
        self.portfolio_metrics: Optional[PortfolioMetrics] = None
        self.position_risks: Dict[str, PositionRisk] = {}
        self.risk_alerts: List[RiskAlert] = []
        self.emergency_stop_triggered = False
        
        # Historical data voor metrics
        self.daily_pnl_history = []
        self.drawdown_history = []
        self.trade_history = []
        
        # Performance tracking
        self.risk_stats = {
            'total_alerts': 0,
            'emergency_stops': 0,
            'trades_blocked': 0,
            'risk_checks': 0,
            'last_update': datetime.now(timezone.utc)
        }
        
        # Active monitoring
        self.is_monitoring = False
        self.monitoring_task = None
        
    def set_global_limit(self, limit_name: str, value: float):
        """Set global risk limit"""
        if limit_name in self.global_limits:
            old_value = self.global_limits[limit_name]
            self.global_limits[limit_name] = value
            logger.info(f"Global limit {limit_name} gewijzigd van {old_value} naar {value}")
        else:
            logger.warning(f"Unknown global limit: {limit_name}")
    
    def set_strategy_limits(self, strategy_id: str, limits: Dict[str, float]):
        """Set strategy specific limits"""
        self.strategy_limits[strategy_id] = limits
        logger.info(f"Strategy limits ingesteld voor {strategy_id}: {limits}")
    
    async def start_monitoring(self):
        """Start risk monitoring"""
        if self.is_monitoring:
            logger.warning("Risk monitoring is al actief")
            return
            
        self.is_monitoring = True
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        logger.info("🛡️ Risk monitoring gestart")
    
    async def stop_monitoring(self):
        """Stop risk monitoring"""
        self.is_monitoring = False
        if self.monitoring_task:
            self.monitoring_task.cancel()
        logger.info("🛑 Risk monitoring gestopt")
    
    async def _monitoring_loop(self):
        """Continuous risk monitoring loop"""
        while self.is_monitoring:
            try:
                await self._update_portfolio_metrics()
                await self._check_all_risks()
                await self._cleanup_old_alerts()
                await asyncio.sleep(5)  # Check every 5 seconds
                
            except Exception as e:
                logger.error(f"Fout in risk monitoring loop: {e}")
                await asyncio.sleep(10)
    
    async def validate_trade(self, strategy_id: str, symbol: str, side: str, 
                           quantity: float, price: float, leverage: int = 1) -> Tuple[bool, List[str]]:
        """
        Validate trade tegen alle risk limits
        Returns (is_valid, list_of_violations)
        """
        self.risk_stats['risk_checks'] += 1
        violations = []
        
        try:
            # Calculate trade value
            trade_value = quantity * price * leverage
            
            # Check global limits
            violations.extend(await self._check_global_trade_limits(
                trade_value, symbol, side, leverage))
            
            # Check strategy limits
            violations.extend(await self._check_strategy_trade_limits(
                strategy_id, trade_value, symbol))
            
            # Check portfolio limits
            violations.extend(await self._check_portfolio_trade_limits(
                trade_value, symbol))
            
            # Check position limits
            violations.extend(await self._check_position_trade_limits(
                symbol, side, quantity, price))
            
            # Check correlation limits
            violations.extend(await self._check_correlation_limits(symbol))
            
            # Check emergency stop
            if self.emergency_stop_triggered:
                violations.append("Emergency stop is active - geen nieuwe trades toegestaan")
            
            is_valid = len(violations) == 0
            
            if not is_valid:
                self.risk_stats['trades_blocked'] += 1
                logger.warning(f"Trade geweigerd voor {symbol}: {violations}")
            
            return is_valid, violations
            
        except Exception as e:
            logger.error(f"Fout bij trade validation: {e}")
            return False, [f"Risk validation error: {str(e)}"]
    
    async def _check_global_trade_limits(self, trade_value: float, symbol: str, 
                                       side: str, leverage: int) -> List[str]:
        """Check global trading limits"""
        violations = []
        
        try:
            # Check leverage
            if leverage > self.global_limits['max_leverage_global']:
                violations.append(f"Leverage {leverage}x overschrijdt limiet van {self.global_limits['max_leverage_global']}x")
            
            # Check minimum balance
            if self.portfolio_metrics and self.portfolio_metrics.total_equity < self.global_limits['min_account_balance']:
                violations.append(f"Account balance ({self.portfolio_metrics.total_equity}) onder minimum ({self.global_limits['min_account_balance']})")
            
            # Check max exposure
            if self.portfolio_metrics:
                new_exposure = self.portfolio_metrics.total_exposure + trade_value
                if new_exposure > self.global_limits['max_total_exposure']:
                    violations.append(f"Total exposure ({new_exposure}) zou limiet overschrijden ({self.global_limits['max_total_exposure']})")
            
            # Check daily loss limit
            if self.portfolio_metrics and self.portfolio_metrics.daily_pnl < -self.global_limits['max_daily_loss']:
                violations.append(f"Daily loss limit bereikt ({self.portfolio_metrics.daily_pnl})")
            
            # Check max positions
            if len(self.position_risks) >= self.global_limits['max_positions']:
                violations.append(f"Maximum aantal posities bereikt ({self.global_limits['max_positions']})")
            
            return violations
            
        except Exception as e:
            logger.error(f"Fout bij global limits check: {e}")
            return [f"Error checking global limits: {str(e)}"]
    
    async def _check_strategy_trade_limits(self, strategy_id: str, trade_value: float, 
                                         symbol: str) -> List[str]:
        """Check strategy specific limits"""
        violations = []
        
        try:
            if strategy_id not in self.strategy_limits:
                return violations  # No strategy specific limits
            
            limits = self.strategy_limits[strategy_id]
            
            # Check strategy max exposure
            if 'max_exposure' in limits:
                # Calculate current strategy exposure (would need strategy position tracking)
                # For now, check against trade value
                if trade_value > limits['max_exposure']:
                    violations.append(f"Strategy exposure limiet overschreden voor {strategy_id}")
            
            # Check strategy max risk per trade
            if 'max_risk_per_trade' in limits and self.portfolio_metrics:
                risk_percent = (trade_value * 0.02) / self.portfolio_metrics.total_equity  # Assume 2% risk
                if risk_percent > limits['max_risk_per_trade']:
                    violations.append(f"Strategy risk per trade limiet overschreden voor {strategy_id}")
            
            return violations
            
        except Exception as e:
            logger.error(f"Fout bij strategy limits check: {e}")
            return [f"Error checking strategy limits: {str(e)}"]
    
    async def _check_portfolio_trade_limits(self, trade_value: float, symbol: str) -> List[str]:
        """Check portfolio level limits"""
        violations = []
        
        try:
            if not self.portfolio_metrics:
                return violations
            
            # Check single position limit
            position_percent = trade_value / self.portfolio_metrics.total_equity
            if position_percent > self.global_limits['max_single_position']:
                violations.append(f"Single position limit overschreden: {position_percent:.2%} > {self.global_limits['max_single_position']:.2%}")
            
            # Check portfolio drawdown
            if self.portfolio_metrics.current_drawdown > self.global_limits['max_portfolio_drawdown']:
                violations.append(f"Portfolio drawdown limit overschreden: {self.portfolio_metrics.current_drawdown:.2%}")
            
            return violations
            
        except Exception as e:
            logger.error(f"Fout bij portfolio limits check: {e}")
            return [f"Error checking portfolio limits: {str(e)}"]
    
    async def _check_position_trade_limits(self, symbol: str, side: str, 
                                         quantity: float, price: float) -> List[str]:
        """Check position specific limits"""
        violations = []
        
        try:
            # Check if we already have position in this symbol
            if symbol in self.position_risks:
                existing_position = self.position_risks[symbol]
                
                # Check if we're adding to position or reversing
                current_size = existing_position.size
                new_size = current_size + (quantity if side.upper() == 'BUY' else -quantity)
                
                # Calculate new position risk
                if self.portfolio_metrics:
                    position_value = abs(new_size * price)
                    position_risk = position_value / self.portfolio_metrics.total_equity
                    
                    if position_risk > self.global_limits['max_single_position']:
                        violations.append(f"Position risk te hoog na trade: {position_risk:.2%}")
            
            return violations
            
        except Exception as e:
            logger.error(f"Fout bij position limits check: {e}")
            return [f"Error checking position limits: {str(e)}"]
    
    async def _check_correlation_limits(self, symbol: str) -> List[str]:
        """Check correlation limits"""
        violations = []
        
        try:
            # Simplified correlation check
            # In real implementation, you'd calculate actual correlations
            if len(self.position_risks) > 5:  # If we have many positions
                # Check if we're overexposed to similar assets
                crypto_positions = [pos for pos in self.position_risks.keys() if 'USDT' in pos]
                if len(crypto_positions) > 10:  # Too many crypto positions
                    violations.append("Te veel gecorreleerde crypto posities")
            
            return violations
            
        except Exception as e:
            logger.error(f"Fout bij correlation check: {e}")
            return [f"Error checking correlations: {str(e)}"]
    
    async def _update_portfolio_metrics(self):
        """Update portfolio metrics from real data"""
        try:
            current_time = datetime.now(timezone.utc)
            
            # Calculate metrics from actual position risks
            total_unrealized_pnl = sum(pos.unrealized_pnl for pos in self.position_risks.values())
            total_exposure = sum(abs(pos.size * pos.current_price) for pos in self.position_risks.values())
            
            # Get real trading statistics from database
            stats = self.db.get_trading_stats(days=1)  # Today's stats
            monthly_stats = self.db.get_trading_stats(days=30)  # Monthly for drawdown/win rate
            
            # Calculate daily PnL from today's trades
            daily_pnl = stats.get('total_pnl', 0.0) if stats else 0.0
            
            # Calculate win rate from monthly data
            win_rate = monthly_stats.get('win_rate', 0.0) if monthly_stats else 0.0
            
            # Get positions from database to calculate real equity
            positions = self.db.load_positions(status='OPEN')
            real_equity = 0.0
            
            # Sum up realized equity from all positions
            for position in positions:
                real_equity += position.get('realized_pnl', 0.0)
            
            # Add current unrealized PnL
            total_equity = real_equity + total_unrealized_pnl
            
            # Calculate current drawdown based on max historical equity
            max_equity = max(total_equity, self.portfolio_metrics.total_equity if self.portfolio_metrics else total_equity)
            current_drawdown = max(0, (max_equity - total_equity) / max_equity) if max_equity > 0 else 0.0
            
            # Calculate max drawdown from historical data
            max_drawdown = monthly_stats.get('max_loss', 0.0) if monthly_stats else 0.0
            if max_drawdown < 0:
                max_drawdown = abs(max_drawdown / max_equity) if max_equity > 0 else 0.0
            else:
                max_drawdown = current_drawdown
            
            # Count today's trades
            today_trades = stats.get('total_trades', 0) if stats else 0
            
            # Calculate simplified Sharpe ratio from monthly returns
            sharpe_ratio = 0.0
            if monthly_stats and monthly_stats.get('total_trades', 0) > 0:
                avg_return = monthly_stats['total_pnl'] / monthly_stats['total_trades']
                std_dev = abs(monthly_stats.get('avg_loss', 1.0))
                sharpe_ratio = avg_return / std_dev if std_dev > 0 else 0.0
            
            # Create real portfolio metrics
            self.portfolio_metrics = PortfolioMetrics(
                total_equity=total_equity,
                total_unrealized_pnl=total_unrealized_pnl,
                total_exposure=total_exposure,
                daily_pnl=daily_pnl,
                max_drawdown=max_drawdown,
                current_drawdown=current_drawdown,
                win_rate=win_rate,
                sharpe_ratio=sharpe_ratio,
                active_positions=len(self.position_risks),
                total_trades_today=today_trades,
                timestamp=current_time
            )
            
            logger.info(f"💰 Real Portfolio Metrics: ${total_equity:.2f} equity, {len(self.position_risks)} positions, {win_rate:.1%} win rate")
            
        except Exception as e:
            logger.error(f"Fout bij updating portfolio metrics: {e}")
    
    async def _check_all_risks(self):
        """Check alle risk conditions"""
        try:
            await self._check_drawdown_risk()
            await self._check_exposure_risk()
            await self._check_position_risks()
            await self._check_correlation_risk()
            await self._check_volatility_risk()
            
        except Exception as e:
            logger.error(f"Fout bij checking risks: {e}")
    
    async def _check_drawdown_risk(self):
        """Check drawdown risk"""
        if not self.portfolio_metrics:
            return
            
        current_dd = self.portfolio_metrics.current_drawdown
        max_dd_limit = self.global_limits['max_portfolio_drawdown']
        
        if current_dd > max_dd_limit * 0.8:  # 80% of limit
            level = RiskLevel.HIGH if current_dd > max_dd_limit * 0.95 else RiskLevel.MEDIUM
            
            alert = RiskAlert(
                alert_type=RiskAlertType.DRAWDOWN,
                level=level,
                message=f"Portfolio drawdown {current_dd:.2%} nadert limiet van {max_dd_limit:.2%}",
                timestamp=datetime.now(timezone.utc),
                current_value=current_dd,
                limit_value=max_dd_limit
            )
            
            await self._add_risk_alert(alert)
            
            # Emergency stop if critical
            if current_dd > max_dd_limit:
                await self._trigger_emergency_stop("Portfolio drawdown limit overschreden")
    
    async def _check_exposure_risk(self):
        """Check exposure risk"""
        if not self.portfolio_metrics:
            return
            
        current_exposure = self.portfolio_metrics.total_exposure
        max_exposure = self.global_limits['max_total_exposure']
        
        if current_exposure > max_exposure * 0.8:  # 80% of limit
            level = RiskLevel.HIGH if current_exposure > max_exposure * 0.95 else RiskLevel.MEDIUM
            
            alert = RiskAlert(
                alert_type=RiskAlertType.EXPOSURE,
                level=level,
                message=f"Total exposure ${current_exposure:,.0f} nadert limiet van ${max_exposure:,.0f}",
                timestamp=datetime.now(timezone.utc),
                current_value=current_exposure,
                limit_value=max_exposure
            )
            
            await self._add_risk_alert(alert)
    
    async def _check_position_risks(self):
        """Check individual position risks"""
        for symbol, position in self.position_risks.items():
            # Check position size risk
            if self.portfolio_metrics:
                position_value = abs(position.size * position.current_price)
                position_risk = position_value / self.portfolio_metrics.total_equity
                max_position_risk = self.global_limits['max_single_position']
                
                if position_risk > max_position_risk * 0.8:
                    level = RiskLevel.HIGH if position_risk > max_position_risk * 0.95 else RiskLevel.MEDIUM
                    
                    alert = RiskAlert(
                        alert_type=RiskAlertType.POSITION_SIZE,
                        level=level,
                        message=f"Position {symbol} risk {position_risk:.2%} nadert limiet van {max_position_risk:.2%}",
                        timestamp=datetime.now(timezone.utc),
                        symbol=symbol,
                        current_value=position_risk,
                        limit_value=max_position_risk
                    )
                    
                    await self._add_risk_alert(alert)
    
    async def _check_correlation_risk(self):
        """Check correlation risk"""
        # Simplified correlation check
        if len(self.position_risks) > 5:
            crypto_count = len([s for s in self.position_risks.keys() if 'USDT' in s])
            total_positions = len(self.position_risks)
            crypto_ratio = crypto_count / total_positions
            
            if crypto_ratio > 0.8:  # More than 80% crypto
                alert = RiskAlert(
                    alert_type=RiskAlertType.CORRELATION,
                    level=RiskLevel.MEDIUM,
                    message=f"Hoge crypto concentratie: {crypto_ratio:.1%} van posities",
                    timestamp=datetime.now(timezone.utc),
                    current_value=crypto_ratio,
                    limit_value=0.7
                )
                
                await self._add_risk_alert(alert)
    
    async def _check_volatility_risk(self):
        """Check volatility risk"""
        high_vol_positions = []
        
        for symbol, position in self.position_risks.items():
            if position.volatility > self.global_limits['volatility_threshold']:
                high_vol_positions.append(symbol)
        
        if len(high_vol_positions) > len(self.position_risks) * 0.5:  # More than 50% high vol
            alert = RiskAlert(
                alert_type=RiskAlertType.VOLATILITY,
                level=RiskLevel.MEDIUM,
                message=f"Te veel hoge volatiliteit posities: {high_vol_positions}",
                timestamp=datetime.now(timezone.utc),
                metadata={"symbols": high_vol_positions}
            )
            
            await self._add_risk_alert(alert)
    
    async def _add_risk_alert(self, alert: RiskAlert):
        """Add risk alert"""
        self.risk_alerts.append(alert)
        self.risk_stats['total_alerts'] += 1
        
        # Save to database
        db = get_database()
        alert_data = {
            'id': f"alert_{int(time.time())}_{len(self.risk_alerts)}",
            'alert_type': alert.alert_type.value,
            'level': alert.level.value,
            'message': alert.message,
            'strategy_id': alert.strategy_id,
            'symbol': alert.symbol,
            'current_value': alert.current_value,
            'limit_value': alert.limit_value,
            'metadata': alert.metadata
        }
        db.save_risk_alert(alert_data)
        
        logger.warning(f"🚨 Risk Alert [{alert.level.value}]: {alert.message}")
        
        # In real implementation, this would send notifications
        # (email, Telegram, Discord, etc.)
    
    async def _trigger_emergency_stop(self, reason: str):
        """Trigger emergency stop"""
        if self.emergency_stop_triggered:
            return  # Already triggered
            
        self.emergency_stop_triggered = True
        self.risk_stats['emergency_stops'] += 1
        
        logger.critical(f"🚨🚨🚨 EMERGENCY STOP TRIGGERED: {reason} 🚨🚨🚨")
        
        alert = RiskAlert(
            alert_type=RiskAlertType.EMERGENCY_STOP,
            level=RiskLevel.CRITICAL,
            message=f"Emergency stop geactiveerd: {reason}",
            timestamp=datetime.now(timezone.utc),
            metadata={"reason": reason}
        )
        
        await self._add_risk_alert(alert)
        
        # In real implementation:
        # 1. Send immediate notifications to all channels
        # 2. Close all positions (optional, be very careful!)
        # 3. Disable all strategy execution
        # 4. Log to audit trail
    
    async def _cleanup_old_alerts(self):
        """Remove old alerts"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
        self.risk_alerts = [alert for alert in self.risk_alerts if alert.timestamp > cutoff_time]
    
    def update_position_risk(self, symbol: str, size: float, entry_price: float, 
                           current_price: float, unrealized_pnl: float):
        """Update position risk data"""
        try:
            # Calculate risk metrics
            position_value = abs(size * current_price)
            
            # Simple volatility calculation (would use historical data in real implementation)
            price_change = abs(current_price - entry_price) / entry_price
            volatility = min(price_change, 0.1)  # Cap at 10%
            
            # Value at Risk (simplified)
            var_95 = position_value * volatility * 1.645  # 95% confidence
            
            position_risk = PositionRisk(
                symbol=symbol,
                size=size,
                entry_price=entry_price,
                current_price=current_price,
                unrealized_pnl=unrealized_pnl,
                risk_per_trade=position_value * 0.02,  # Assume 2% risk
                position_risk_ratio=position_value / 10000 if self.portfolio_metrics else 0,  # Simplified
                correlation_risk=0.5,  # Would calculate real correlation
                volatility=volatility,
                var_95=var_95,
                timestamp=datetime.now(timezone.utc)
            )
            
            self.position_risks[symbol] = position_risk
            
            # Save to database
            db = get_database()
            position_data = {
                'id': f"pos_{symbol}_{int(time.time())}",
                'symbol': symbol,
                'connection_id': 'default',  # Would get from context
                'side': 'long' if size > 0 else 'short',
                'size': abs(size),
                'entry_price': entry_price,
                'current_price': current_price,
                'unrealized_pnl': unrealized_pnl,
                'metadata': asdict(position_risk)
            }
            db.save_position(position_data)
            
        except Exception as e:
            logger.error(f"Fout bij updating position risk voor {symbol}: {e}")
    
    def remove_position_risk(self, symbol: str):
        """Remove position risk tracking"""
        if symbol in self.position_risks:
            del self.position_risks[symbol]
            logger.info(f"Position risk tracking verwijderd voor {symbol}")
    
    def reset_emergency_stop(self):
        """Reset emergency stop (admin only)"""
        self.emergency_stop_triggered = False
        logger.info("🟢 Emergency stop gereset")
    
    def get_risk_summary(self) -> Dict[str, Any]:
        """Get comprehensive risk summary"""
        try:
            return {
                'global_limits': self.global_limits,
                'portfolio_metrics': asdict(self.portfolio_metrics) if self.portfolio_metrics else None,
                'emergency_stop_triggered': self.emergency_stop_triggered,
                'active_positions': len(self.position_risks),
                'position_risks': {
                    symbol: asdict(risk) for symbol, risk in self.position_risks.items()
                },
                'recent_alerts': [
                    asdict(alert) for alert in self.risk_alerts[-10:]  # Last 10 alerts
                ],
                'risk_stats': self.risk_stats,
                'monitoring_active': self.is_monitoring,
                'last_update': datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            logger.error(f"Fout bij creating risk summary: {e}")
            return {'error': str(e)}
    
    def get_position_risk_report(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get detailed risk report for specific position"""
        if symbol in self.position_risks:
            position = self.position_risks[symbol]
            return {
                'symbol': symbol,
                'risk_metrics': asdict(position),
                'risk_assessment': self._assess_position_risk(position),
                'recommendations': self._get_position_recommendations(position)
            }
        return None
    
    def _assess_position_risk(self, position: PositionRisk) -> str:
        """Assess position risk level"""
        if position.position_risk_ratio > 0.08:  # More than 8% of portfolio
            return "HIGH"
        elif position.position_risk_ratio > 0.05:  # More than 5% of portfolio
            return "MEDIUM"
        else:
            return "LOW"
    
    def _get_position_recommendations(self, position: PositionRisk) -> List[str]:
        """Get risk management recommendations for position"""
        recommendations = []
        
        if position.position_risk_ratio > 0.08:
            recommendations.append("Consider reducing position size")
        
        if position.volatility > 0.05:
            recommendations.append("High volatility - consider tighter stop loss")
        
        if abs(position.unrealized_pnl) > position.risk_per_trade * 2:
            if position.unrealized_pnl > 0:
                recommendations.append("Consider taking partial profits")
            else:
                recommendations.append("Position showing significant loss - review exit strategy")
        
        return recommendations

# Global risk manager instance
risk_manager = RiskManager()

# Import time for IDs
import time