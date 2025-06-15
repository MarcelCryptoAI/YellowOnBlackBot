#!/usr/bin/env python3
"""
Monitoring and Alerting System - CTB Trading Bot
Real-time monitoring, performance tracking, alerting en logging
"""

import asyncio
import json
import logging
import smtplib
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from enum import Enum
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

import psutil
import pandas as pd
from .database import get_database

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AlertSeverity(Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class AlertChannel(Enum):
    EMAIL = "EMAIL"
    TELEGRAM = "TELEGRAM"
    DISCORD = "DISCORD"
    WEBHOOK = "WEBHOOK"
    LOG = "LOG"

class MetricType(Enum):
    COUNTER = "COUNTER"
    GAUGE = "GAUGE"
    HISTOGRAM = "HISTOGRAM"
    RATE = "RATE"

@dataclass
class Alert:
    id: str
    title: str
    message: str
    severity: AlertSeverity
    timestamp: datetime
    source: str
    tags: Dict[str, str] = None
    metadata: Dict[str, Any] = None
    resolved: bool = False
    resolved_at: Optional[datetime] = None

@dataclass
class Metric:
    name: str
    value: float
    metric_type: MetricType
    timestamp: datetime
    labels: Dict[str, str] = None
    description: str = ""

@dataclass
class SystemHealth:
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    network_io: Dict[str, float]
    uptime: float
    timestamp: datetime

@dataclass
class TradingPerformance:
    total_trades: int
    winning_trades: int
    losing_trades: int
    total_pnl: float
    win_rate: float
    avg_win: float
    avg_loss: float
    max_drawdown: float
    sharpe_ratio: float
    profit_factor: float
    timestamp: datetime

class MonitoringSystem:
    """
    Comprehensive monitoring en alerting systeem
    """
    
    def __init__(self):
        self.alerts: List[Alert] = []
        self.metrics: Dict[str, List[Metric]] = {}
        self.alert_handlers: Dict[AlertChannel, Callable] = {}
        self.is_monitoring = False
        
        # Performance data
        self.system_health_history = []
        self.trading_performance_history = []
        
        # Database reference
        from .database import get_database
        self.db = get_database()
        
        # Alert configuration
        self.alert_config = {
            'email': {
                'enabled': False,
                'smtp_server': 'smtp.gmail.com',
                'smtp_port': 587,
                'username': '',
                'password': '',
                'recipients': []
            },
            'telegram': {
                'enabled': False,
                'bot_token': '',
                'chat_ids': []
            },
            'discord': {
                'enabled': False,
                'webhook_url': ''
            }
        }
        
        # Monitoring thresholds
        self.thresholds = {
            'cpu_usage': 80.0,          # 80% CPU usage
            'memory_usage': 85.0,       # 85% memory usage
            'disk_usage': 90.0,         # 90% disk usage
            'response_time': 5.0,       # 5 second response time
            'error_rate': 0.05,         # 5% error rate
            'daily_loss': 1000.0,       # $1000 daily loss
            'drawdown': 0.10,           # 10% drawdown
            'uptime': 0.99              # 99% uptime
        }
        
        # Statistics
        self.stats = {
            'alerts_sent': 0,
            'metrics_collected': 0,
            'uptime_start': datetime.now(timezone.utc),
            'last_health_check': None,
            'system_errors': 0,
            'trading_errors': 0
        }
        
        # Tasks
        self.monitoring_tasks = []
        
        # Setup default alert handlers
        self._setup_alert_handlers()
    
    def _setup_alert_handlers(self):
        """Setup default alert handlers"""
        self.alert_handlers[AlertChannel.LOG] = self._log_alert
        self.alert_handlers[AlertChannel.EMAIL] = self._send_email_alert
        # Add more handlers as needed
    
    async def start_monitoring(self):
        """Start comprehensive monitoring"""
        if self.is_monitoring:
            logger.warning("Monitoring is al actief")
            return
            
        self.is_monitoring = True
        logger.info("📊 Monitoring systeem gestart")
        
        # Start monitoring tasks
        self.monitoring_tasks = [
            asyncio.create_task(self._system_health_monitor()),
            asyncio.create_task(self._trading_performance_monitor()),
            asyncio.create_task(self._alert_processor()),
            asyncio.create_task(self._metrics_collector()),
            asyncio.create_task(self._health_checker())
        ]
    
    async def stop_monitoring(self):
        """Stop monitoring"""
        self.is_monitoring = False
        
        # Cancel all tasks
        for task in self.monitoring_tasks:
            task.cancel()
            
        logger.info("🛑 Monitoring systeem gestopt")
    
    async def _system_health_monitor(self):
        """Monitor system health metrics"""
        while self.is_monitoring:
            try:
                # Get system metrics
                cpu_percent = psutil.cpu_percent(interval=1)
                memory = psutil.virtual_memory()
                disk = psutil.disk_usage('/')
                net_io = psutil.net_io_counters()
                
                # Calculate uptime
                uptime = (datetime.now(timezone.utc) - self.stats['uptime_start']).total_seconds()
                
                health = SystemHealth(
                    cpu_usage=cpu_percent,
                    memory_usage=memory.percent,
                    disk_usage=disk.percent,
                    network_io={
                        'bytes_sent': net_io.bytes_sent,
                        'bytes_recv': net_io.bytes_recv,
                        'packets_sent': net_io.packets_sent,
                        'packets_recv': net_io.packets_recv
                    },
                    uptime=uptime,
                    timestamp=datetime.now(timezone.utc)
                )
                
                # Store health data
                self.system_health_history.append(health)
                self._cleanup_old_data(self.system_health_history, hours=24)
                
                # Check thresholds and create alerts
                await self._check_system_thresholds(health)
                
                # Record metrics
                await self._record_system_metrics(health)
                
                self.stats['last_health_check'] = datetime.now(timezone.utc)
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Fout in system health monitor: {e}")
                self.stats['system_errors'] += 1
                await asyncio.sleep(60)
    
    async def _trading_performance_monitor(self):
        """Monitor trading performance"""
        while self.is_monitoring:
            try:
                # Get trading performance (would connect to actual trading data)
                performance = await self._calculate_trading_performance()
                
                if performance:
                    self.trading_performance_history.append(performance)
                    self._cleanup_old_data(self.trading_performance_history, hours=24)
                    
                    # Check trading thresholds
                    await self._check_trading_thresholds(performance)
                    
                    # Record trading metrics
                    await self._record_trading_metrics(performance)
                
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error(f"Fout in trading performance monitor: {e}")
                self.stats['trading_errors'] += 1
                await asyncio.sleep(120)
    
    async def _calculate_trading_performance(self) -> Optional[TradingPerformance]:
        """Calculate current trading performance from real database data"""
        try:
            # Get real trading statistics from database
            stats = self.db.get_trading_stats(days=30)
            
            if not stats or stats['total_trades'] == 0:
                # No trades yet - return zero performance
                return TradingPerformance(
                    total_trades=0,
                    winning_trades=0,
                    losing_trades=0,
                    total_pnl=0.0,
                    win_rate=0.0,
                    avg_win=0.0,
                    avg_loss=0.0,
                    max_drawdown=0.0,
                    sharpe_ratio=0.0,
                    profit_factor=0.0,
                    timestamp=datetime.now(timezone.utc)
                )
            
            # Calculate real performance metrics
            total_trades = stats['total_trades']
            winning_trades = stats['winning_trades']
            losing_trades = stats['losing_trades']
            total_pnl = stats['total_pnl']
            win_rate = stats['win_rate']
            avg_win = stats['avg_win'] or 0.0
            avg_loss = stats['avg_loss'] or 0.0
            max_win = stats['max_win'] or 0.0
            max_loss = stats['max_loss'] or 0.0
            
            # Calculate sharpe ratio (simplified)
            if losing_trades > 0 and avg_loss != 0:
                profit_factor = abs(avg_win * winning_trades / (avg_loss * losing_trades))
                sharpe_ratio = (total_pnl / total_trades) / (abs(avg_loss) if avg_loss != 0 else 1.0)
            else:
                profit_factor = float('inf') if total_pnl > 0 else 0.0
                sharpe_ratio = total_pnl / total_trades if total_trades > 0 else 0.0
            
            # Calculate max drawdown (simplified - based on max loss)
            max_drawdown = abs(max_loss / (max_win if max_win > 0 else 1000.0)) if max_loss < 0 else 0.0
            
            logger.info(f"📊 Real Trading Performance: {total_trades} trades, {win_rate:.1%} win rate, ${total_pnl:.2f} PnL")
            
            return TradingPerformance(
                total_trades=total_trades,
                winning_trades=winning_trades,
                losing_trades=losing_trades,
                total_pnl=total_pnl,
                win_rate=win_rate,
                avg_win=avg_win,
                avg_loss=avg_loss,
                max_drawdown=max_drawdown,
                sharpe_ratio=sharpe_ratio,
                profit_factor=profit_factor,
                timestamp=datetime.now(timezone.utc)
            )
            
        except Exception as e:
            logger.error(f"Fout bij calculating trading performance: {e}")
            return None
    
    async def _check_system_thresholds(self, health: SystemHealth):
        """Check system health thresholds"""
        try:
            # CPU usage check
            if health.cpu_usage > self.thresholds['cpu_usage']:
                await self._create_alert(
                    title="High CPU Usage",
                    message=f"CPU usage is {health.cpu_usage:.1f}% (threshold: {self.thresholds['cpu_usage']}%)",
                    severity=AlertSeverity.WARNING,
                    source="system_monitor",
                    tags={'metric': 'cpu_usage', 'value': str(health.cpu_usage)}
                )
            
            # Memory usage check
            if health.memory_usage > self.thresholds['memory_usage']:
                await self._create_alert(
                    title="High Memory Usage",
                    message=f"Memory usage is {health.memory_usage:.1f}% (threshold: {self.thresholds['memory_usage']}%)",
                    severity=AlertSeverity.WARNING,
                    source="system_monitor",
                    tags={'metric': 'memory_usage', 'value': str(health.memory_usage)}
                )
            
            # Disk usage check
            if health.disk_usage > self.thresholds['disk_usage']:
                await self._create_alert(
                    title="High Disk Usage",
                    message=f"Disk usage is {health.disk_usage:.1f}% (threshold: {self.thresholds['disk_usage']}%)",
                    severity=AlertSeverity.ERROR,
                    source="system_monitor",
                    tags={'metric': 'disk_usage', 'value': str(health.disk_usage)}
                )
            
        except Exception as e:
            logger.error(f"Fout bij checking system thresholds: {e}")
    
    async def _check_trading_thresholds(self, performance: TradingPerformance):
        """Check trading performance thresholds"""
        try:
            # Daily loss check
            if performance.total_pnl < -self.thresholds['daily_loss']:
                await self._create_alert(
                    title="Daily Loss Limit Approached",
                    message=f"Daily PnL is ${performance.total_pnl:,.2f} (threshold: -${self.thresholds['daily_loss']:,.2f})",
                    severity=AlertSeverity.ERROR,
                    source="trading_monitor",
                    tags={'metric': 'daily_pnl', 'value': str(performance.total_pnl)}
                )
            
            # Drawdown check
            if performance.max_drawdown > self.thresholds['drawdown']:
                await self._create_alert(
                    title="High Drawdown",
                    message=f"Max drawdown is {performance.max_drawdown:.2%} (threshold: {self.thresholds['drawdown']:.2%})",
                    severity=AlertSeverity.WARNING,
                    source="trading_monitor",
                    tags={'metric': 'drawdown', 'value': str(performance.max_drawdown)}
                )
            
            # Win rate check
            if performance.win_rate < 0.4:  # Less than 40% win rate
                await self._create_alert(
                    title="Low Win Rate",
                    message=f"Win rate is {performance.win_rate:.2%} - review strategy performance",
                    severity=AlertSeverity.WARNING,
                    source="trading_monitor",
                    tags={'metric': 'win_rate', 'value': str(performance.win_rate)}
                )
            
        except Exception as e:
            logger.error(f"Fout bij checking trading thresholds: {e}")
    
    async def _record_system_metrics(self, health: SystemHealth):
        """Record system metrics"""
        try:
            metrics = [
                Metric("system_cpu_usage", health.cpu_usage, MetricType.GAUGE, health.timestamp),
                Metric("system_memory_usage", health.memory_usage, MetricType.GAUGE, health.timestamp),
                Metric("system_disk_usage", health.disk_usage, MetricType.GAUGE, health.timestamp),
                Metric("system_uptime", health.uptime, MetricType.GAUGE, health.timestamp),
                Metric("network_bytes_sent", health.network_io['bytes_sent'], MetricType.COUNTER, health.timestamp),
                Metric("network_bytes_recv", health.network_io['bytes_recv'], MetricType.COUNTER, health.timestamp)
            ]
            
            for metric in metrics:
                await self._record_metric(metric)
                
        except Exception as e:
            logger.error(f"Fout bij recording system metrics: {e}")
    
    async def _record_trading_metrics(self, performance: TradingPerformance):
        """Record trading metrics"""
        try:
            metrics = [
                Metric("trading_total_pnl", performance.total_pnl, MetricType.GAUGE, performance.timestamp),
                Metric("trading_win_rate", performance.win_rate, MetricType.GAUGE, performance.timestamp),
                Metric("trading_total_trades", performance.total_trades, MetricType.COUNTER, performance.timestamp),
                Metric("trading_max_drawdown", performance.max_drawdown, MetricType.GAUGE, performance.timestamp),
                Metric("trading_sharpe_ratio", performance.sharpe_ratio, MetricType.GAUGE, performance.timestamp),
                Metric("trading_profit_factor", performance.profit_factor, MetricType.GAUGE, performance.timestamp)
            ]
            
            for metric in metrics:
                await self._record_metric(metric)
                
        except Exception as e:
            logger.error(f"Fout bij recording trading metrics: {e}")
    
    async def _record_metric(self, metric: Metric):
        """Record a metric"""
        try:
            if metric.name not in self.metrics:
                self.metrics[metric.name] = []
            
            self.metrics[metric.name].append(metric)
            
            # Keep only last 1000 metrics per type
            if len(self.metrics[metric.name]) > 1000:
                self.metrics[metric.name] = self.metrics[metric.name][-1000:]
            
            # Save to database
            db = get_database()
            db.save_system_metric(metric.name, metric.value, metric.labels)
            
            self.stats['metrics_collected'] += 1
            
        except Exception as e:
            logger.error(f"Fout bij recording metric: {e}")
    
    async def _create_alert(self, title: str, message: str, severity: AlertSeverity, 
                          source: str, tags: Dict[str, str] = None, metadata: Dict[str, Any] = None):
        """Create and send alert"""
        try:
            alert = Alert(
                id=f"alert_{int(time.time())}_{len(self.alerts)}",
                title=title,
                message=message,
                severity=severity,
                timestamp=datetime.now(timezone.utc),
                source=source,
                tags=tags or {},
                metadata=metadata or {}
            )
            
            self.alerts.append(alert)
            
            # Keep only last 1000 alerts
            if len(self.alerts) > 1000:
                self.alerts = self.alerts[-1000:]
            
            # Save to database as risk alert
            db = get_database()
            alert_data = {
                'id': alert.id,
                'alert_type': 'MONITORING',
                'level': severity.value,
                'message': f"{title}: {message}",
                'symbol': None,
                'current_value': None,
                'limit_value': None,
                'metadata': {'source': source, 'tags': tags, 'metadata': metadata}
            }
            db.save_risk_alert(alert_data)
            
            # Send alert through configured channels
            await self._send_alert(alert)
            
        except Exception as e:
            logger.error(f"Fout bij creating alert: {e}")
    
    async def _send_alert(self, alert: Alert):
        """Send alert through configured channels"""
        try:
            # Always log
            await self.alert_handlers[AlertChannel.LOG](alert)
            
            # Send through other channels based on severity
            if alert.severity in [AlertSeverity.ERROR, AlertSeverity.CRITICAL]:
                if self.alert_config['email']['enabled']:
                    await self.alert_handlers[AlertChannel.EMAIL](alert)
                
                if self.alert_config['telegram']['enabled']:
                    # Would implement Telegram sending
                    pass
                
                if self.alert_config['discord']['enabled']:
                    # Would implement Discord sending
                    pass
            
            self.stats['alerts_sent'] += 1
            
        except Exception as e:
            logger.error(f"Fout bij sending alert: {e}")
    
    async def _log_alert(self, alert: Alert):
        """Log alert"""
        try:
            log_level = {
                AlertSeverity.INFO: logging.INFO,
                AlertSeverity.WARNING: logging.WARNING,
                AlertSeverity.ERROR: logging.ERROR,
                AlertSeverity.CRITICAL: logging.CRITICAL
            }.get(alert.severity, logging.INFO)
            
            logger.log(log_level, f"🚨 [{alert.severity.value}] {alert.title}: {alert.message}")
            
        except Exception as e:
            logger.error(f"Fout bij logging alert: {e}")
    
    async def _send_email_alert(self, alert: Alert):
        """Send email alert"""
        try:
            if not self.alert_config['email']['enabled']:
                return
                
            config = self.alert_config['email']
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = config['username']
            msg['To'] = ', '.join(config['recipients'])
            msg['Subject'] = f"[CTB Trading Bot] {alert.severity.value}: {alert.title}"
            
            # Email body
            body = f"""
            Trading Bot Alert
            
            Severity: {alert.severity.value}
            Title: {alert.title}
            Message: {alert.message}
            Source: {alert.source}
            Time: {alert.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}
            
            Tags: {alert.tags}
            Metadata: {alert.metadata}
            
            ---
            CTB Trading Bot Monitoring System
            """
            
            msg.attach(MIMEText(body, 'plain'))
            
            # Send email
            server = smtplib.SMTP(config['smtp_server'], config['smtp_port'])
            server.starttls()
            server.login(config['username'], config['password'])
            server.sendmail(config['username'], config['recipients'], msg.as_string())
            server.quit()
            
            logger.info(f"Email alert verzonden: {alert.title}")
            
        except Exception as e:
            logger.error(f"Fout bij sending email alert: {e}")
    
    async def _alert_processor(self):
        """Process and manage alerts"""
        while self.is_monitoring:
            try:
                # Auto-resolve old alerts
                await self._auto_resolve_alerts()
                
                # Clean up old alerts
                cutoff_time = datetime.now(timezone.utc) - timedelta(hours=72)
                self.alerts = [alert for alert in self.alerts if alert.timestamp > cutoff_time]
                
                await asyncio.sleep(300)  # Process every 5 minutes
                
            except Exception as e:
                logger.error(f"Fout in alert processor: {e}")
                await asyncio.sleep(600)
    
    async def _auto_resolve_alerts(self):
        """Auto-resolve alerts based on conditions"""
        try:
            for alert in self.alerts:
                if alert.resolved:
                    continue
                    
                # Auto-resolve system alerts if conditions are back to normal
                if alert.source == "system_monitor" and alert.tags.get('metric'):
                    metric_name = alert.tags['metric']
                    
                    # Get latest system health
                    if self.system_health_history:
                        latest_health = self.system_health_history[-1]
                        
                        should_resolve = False
                        if metric_name == 'cpu_usage' and latest_health.cpu_usage < self.thresholds['cpu_usage'] * 0.9:
                            should_resolve = True
                        elif metric_name == 'memory_usage' and latest_health.memory_usage < self.thresholds['memory_usage'] * 0.9:
                            should_resolve = True
                        elif metric_name == 'disk_usage' and latest_health.disk_usage < self.thresholds['disk_usage'] * 0.9:
                            should_resolve = True
                        
                        if should_resolve:
                            alert.resolved = True
                            alert.resolved_at = datetime.now(timezone.utc)
                            logger.info(f"Auto-resolved alert: {alert.title}")
                            
        except Exception as e:
            logger.error(f"Fout bij auto-resolving alerts: {e}")
    
    async def _metrics_collector(self):
        """Collect custom metrics"""
        while self.is_monitoring:
            try:
                # Collect strategy engine metrics
                # This would connect to actual strategy engine
                
                # Collect API response times
                # This would measure actual API calls
                
                # Collect database metrics
                # This would connect to database
                
                await asyncio.sleep(60)  # Collect every minute
                
            except Exception as e:
                logger.error(f"Fout in metrics collector: {e}")
                await asyncio.sleep(120)
    
    async def _health_checker(self):
        """Overall health check"""
        while self.is_monitoring:
            try:
                # Check if all components are running
                components_health = {
                    'system_monitor': len(self.system_health_history) > 0,
                    'trading_monitor': len(self.trading_performance_history) > 0,
                    'alert_system': True,  # Always true if we're running
                    'metrics_collector': len(self.metrics) > 0
                }
                
                # Check for component failures
                failed_components = [comp for comp, healthy in components_health.items() if not healthy]
                
                if failed_components:
                    await self._create_alert(
                        title="Component Health Check Failed",
                        message=f"Failed components: {', '.join(failed_components)}",
                        severity=AlertSeverity.ERROR,
                        source="health_checker",
                        metadata={'failed_components': failed_components}
                    )
                
                # Calculate overall system health score
                health_score = sum(components_health.values()) / len(components_health)
                
                # Record health score metric
                await self._record_metric(Metric(
                    "system_health_score",
                    health_score,
                    MetricType.GAUGE,
                    datetime.now(timezone.utc),
                    description="Overall system health score (0-1)"
                ))
                
                await asyncio.sleep(300)  # Check every 5 minutes
                
            except Exception as e:
                logger.error(f"Fout in health checker: {e}")
                await asyncio.sleep(600)
    
    def _cleanup_old_data(self, data_list: List, hours: int = 24):
        """Remove old data from lists"""
        try:
            if not data_list:
                return
                
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
            
            # Keep only recent data
            filtered_data = [item for item in data_list if item.timestamp > cutoff_time]
            data_list.clear()
            data_list.extend(filtered_data)
            
        except Exception as e:
            logger.error(f"Fout bij cleaning up old data: {e}")
    
    def configure_alerts(self, config: Dict[str, Any]):
        """Configure alert settings"""
        try:
            self.alert_config.update(config)
            logger.info("Alert configuratie bijgewerkt")
        except Exception as e:
            logger.error(f"Fout bij configuring alerts: {e}")
    
    def set_threshold(self, metric: str, value: float):
        """Set monitoring threshold"""
        if metric in self.thresholds:
            old_value = self.thresholds[metric]
            self.thresholds[metric] = value
            logger.info(f"Threshold {metric} gewijzigd van {old_value} naar {value}")
        else:
            logger.warning(f"Unknown threshold metric: {metric}")
    
    def get_monitoring_dashboard(self) -> Dict[str, Any]:
        """Get comprehensive monitoring dashboard data"""
        try:
            # Latest system health
            latest_health = self.system_health_history[-1] if self.system_health_history else None
            
            # Latest trading performance
            latest_trading = self.trading_performance_history[-1] if self.trading_performance_history else None
            
            # Recent alerts
            recent_alerts = sorted(
                [alert for alert in self.alerts if not alert.resolved],
                key=lambda x: x.timestamp,
                reverse=True
            )[:10]
            
            # Metrics summary
            metrics_summary = {}
            for metric_name, metric_list in self.metrics.items():
                if metric_list:
                    latest_metric = metric_list[-1]
                    metrics_summary[metric_name] = {
                        'value': latest_metric.value,
                        'timestamp': latest_metric.timestamp.isoformat(),
                        'type': latest_metric.metric_type.value
                    }
            
            return {
                'system_health': asdict(latest_health) if latest_health else None,
                'trading_performance': asdict(latest_trading) if latest_trading else None,
                'active_alerts': [asdict(alert) for alert in recent_alerts],
                'metrics_summary': metrics_summary,
                'monitoring_stats': self.stats,
                'thresholds': self.thresholds,
                'is_monitoring': self.is_monitoring,
                'uptime': (datetime.now(timezone.utc) - self.stats['uptime_start']).total_seconds(),
                'last_update': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Fout bij creating monitoring dashboard: {e}")
            return {'error': str(e)}
    
    def get_metric_history(self, metric_name: str, hours: int = 24) -> List[Dict[str, Any]]:
        """Get metric history"""
        try:
            if metric_name not in self.metrics:
                return []
            
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
            recent_metrics = [
                metric for metric in self.metrics[metric_name]
                if metric.timestamp > cutoff_time
            ]
            
            return [
                {
                    'value': metric.value,
                    'timestamp': metric.timestamp.isoformat(),
                    'labels': metric.labels
                } for metric in recent_metrics
            ]
            
        except Exception as e:
            logger.error(f"Fout bij getting metric history: {e}")
            return []
    
    def resolve_alert(self, alert_id: str) -> bool:
        """Manually resolve an alert"""
        try:
            for alert in self.alerts:
                if alert.id == alert_id and not alert.resolved:
                    alert.resolved = True
                    alert.resolved_at = datetime.now(timezone.utc)
                    logger.info(f"Alert {alert_id} manually resolved")
                    return True
            return False
        except Exception as e:
            logger.error(f"Fout bij resolving alert: {e}")
            return False

# Global monitoring system instance
monitoring_system = MonitoringSystem()

# Import time for IDs
import time