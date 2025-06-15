import React, { useState, useEffect } from 'react';
import { monitoringApi, MonitoringDashboard as MonitoringData } from '../services/api';
import { webSocketService } from '../services/websocketService';
import { GlassCard } from './GlassCard';

export const MonitoringDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>('system_cpu_usage');
  const [metricHistory, setMetricHistory] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
    loadMetricHistory(selectedMetric);
    
    // Setup WebSocket listeners
    webSocketService.on('system_health_update', handleSystemHealthUpdate);
    webSocketService.on('trading_performance_update', handleTradingPerformanceUpdate);
    webSocketService.on('alert_created', handleAlertCreated);
    webSocketService.on('alert_resolved', handleAlertResolved);
    
    // Subscribe to monitoring alerts
    webSocketService.subscribeToMonitoringAlerts();
    
    // Refresh data periodically
    const interval = setInterval(() => {
      loadDashboard();
    }, 10000);
    
    return () => {
      clearInterval(interval);
      webSocketService.off('system_health_update', handleSystemHealthUpdate);
      webSocketService.off('trading_performance_update', handleTradingPerformanceUpdate);
      webSocketService.off('alert_created', handleAlertCreated);
      webSocketService.off('alert_resolved', handleAlertResolved);
    };
  }, []);

  useEffect(() => {
    loadMetricHistory(selectedMetric);
  }, [selectedMetric]);

  const handleSystemHealthUpdate = (data: { health: any }) => {
    if (dashboard) {
      setDashboard({
        ...dashboard,
        system_health: data.health,
      });
    }
  };

  const handleTradingPerformanceUpdate = (data: { performance: any }) => {
    if (dashboard) {
      setDashboard({
        ...dashboard,
        trading_performance: data.performance,
      });
    }
  };

  const handleAlertCreated = (data: { alert: any }) => {
    if (dashboard) {
      setDashboard({
        ...dashboard,
        active_alerts: [data.alert, ...dashboard.active_alerts.slice(0, 9)],
      });
    }
  };

  const handleAlertResolved = (data: { alert_id: string }) => {
    if (dashboard) {
      setDashboard({
        ...dashboard,
        active_alerts: dashboard.active_alerts.filter(alert => alert.id !== data.alert_id),
      });
    }
  };

  const loadDashboard = async () => {
    try {
      const response = await monitoringApi.getDashboard();
      if (response.success) {
        setDashboard(response.data);
      }
    } catch (error) {
      console.error('Error loading monitoring dashboard:', error);
    }
  };

  const loadMetricHistory = async (metricName: string) => {
    try {
      const response = await monitoringApi.getMetricHistory(metricName, 6); // Last 6 hours
      if (response.success) {
        setMetricHistory(response.data.history);
      }
    } catch (error) {
      console.error('Error loading metric history:', error);
      setMetricHistory([]);
    }
  };

  const startMonitoring = async () => {
    setLoading(true);
    try {
      const response = await monitoringApi.startMonitoring();
      if (response.success) {
        await loadDashboard();
        setError(null);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to start monitoring');
    } finally {
      setLoading(false);
    }
  };

  const stopMonitoring = async () => {
    setLoading(true);
    try {
      const response = await monitoringApi.stopMonitoring();
      if (response.success) {
        await loadDashboard();
        setError(null);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to stop monitoring');
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await monitoringApi.resolveAlert(alertId);
      if (response.success) {
        await loadDashboard();
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to resolve alert');
    }
  };

  const getHealthColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-neon-pink';
    if (value >= thresholds.warning) return 'text-neon-yellow';
    return 'text-neon-green';
  };

  const getHealthIcon = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return '🔴';
    if (value >= thresholds.warning) return '🟡';
    return '🟢';
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-neon-pink';
      case 'ERROR': return 'text-neon-orange';
      case 'WARNING': return 'text-neon-yellow';
      case 'INFO': return 'text-neon-cyan';
      default: return 'text-gray-400';
    }
  };

  const getAlertSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return '🚨';
      case 'ERROR': return '❌';
      case 'WARNING': return '⚠️';
      case 'INFO': return 'ℹ️';
      default: return '📝';
    }
  };

  const metricsOptions = [
    { key: 'system_cpu_usage', label: 'CPU Usage (%)' },
    { key: 'system_memory_usage', label: 'Memory Usage (%)' },
    { key: 'system_disk_usage', label: 'Disk Usage (%)' },
    { key: 'trading_total_pnl', label: 'Total PnL ($)' },
    { key: 'trading_win_rate', label: 'Win Rate (%)' },
    { key: 'trading_total_trades', label: 'Total Trades' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-orbitron font-bold text-holographic">
            System Monitoring Center
          </h1>
          <p className="text-gray-400 mt-2">
            Real-time system health, performance metrics, and alerts
          </p>
        </div>
        
        <div className="flex space-x-4">
          {dashboard?.is_monitoring ? (
            <button
              onClick={stopMonitoring}
              className="glass-button glass-button-pink"
              disabled={loading}
            >
              🛑 Stop Monitoring
            </button>
          ) : (
            <button
              onClick={startMonitoring}
              className="glass-button glass-button-green"
              disabled={loading}
            >
              📊 Start Monitoring
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <GlassCard className="border-neon-pink/50 bg-red-500/10">
          <div className="flex items-center space-x-3">
            <span className="text-neon-pink text-xl">⚠️</span>
            <div>
              <h3 className="text-neon-pink font-rajdhani font-bold">Monitoring Error</h3>
              <p className="text-gray-300">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </GlassCard>
      )}

      {/* System Health Overview */}
      {dashboard && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* System Health */}
          <GlassCard>
            <h2 className="text-xl font-rajdhani font-bold text-neon-cyan mb-6">
              🖥️ System Health
            </h2>
            
            {dashboard.system_health ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className={`text-3xl ${getHealthColor(dashboard.system_health.cpu_usage, { warning: 70, critical: 85 })}`}>
                      {getHealthIcon(dashboard.system_health.cpu_usage, { warning: 70, critical: 85 })}
                    </div>
                    <div className={`text-2xl font-orbitron font-bold ${getHealthColor(dashboard.system_health.cpu_usage, { warning: 70, critical: 85 })}`}>
                      {dashboard.system_health.cpu_usage.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400">CPU Usage</div>
                  </div>
                  
                  <div className="text-center">
                    <div className={`text-3xl ${getHealthColor(dashboard.system_health.memory_usage, { warning: 80, critical: 90 })}`}>
                      {getHealthIcon(dashboard.system_health.memory_usage, { warning: 80, critical: 90 })}
                    </div>
                    <div className={`text-2xl font-orbitron font-bold ${getHealthColor(dashboard.system_health.memory_usage, { warning: 80, critical: 90 })}`}>
                      {dashboard.system_health.memory_usage.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400">Memory Usage</div>
                  </div>
                  
                  <div className="text-center">
                    <div className={`text-3xl ${getHealthColor(dashboard.system_health.disk_usage, { warning: 80, critical: 90 })}`}>
                      {getHealthIcon(dashboard.system_health.disk_usage, { warning: 80, critical: 90 })}
                    </div>
                    <div className={`text-2xl font-orbitron font-bold ${getHealthColor(dashboard.system_health.disk_usage, { warning: 80, critical: 90 })}`}>
                      {dashboard.system_health.disk_usage.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400">Disk Usage</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-3xl text-neon-cyan">⏱️</div>
                    <div className="text-2xl font-orbitron font-bold text-neon-cyan">
                      {formatUptime(dashboard.system_health.uptime)}
                    </div>
                    <div className="text-sm text-gray-400">Uptime</div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-white/10">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Network Sent:</span>
                      <span className="text-neon-cyan ml-2">
                        {formatBytes(dashboard.system_health.network_io.bytes_sent)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Network Received:</span>
                      <span className="text-neon-purple ml-2">
                        {formatBytes(dashboard.system_health.network_io.bytes_recv)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8">
                No system health data available
              </div>
            )}
          </GlassCard>

          {/* Trading Performance */}
          <GlassCard>
            <h2 className="text-xl font-rajdhani font-bold text-neon-cyan mb-6">
              📈 Trading Performance
            </h2>
            
            {dashboard.trading_performance ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className={`text-2xl font-orbitron font-bold ${
                      dashboard.trading_performance.total_pnl >= 0 ? 'text-neon-green' : 'text-neon-pink'
                    }`}>
                      ${dashboard.trading_performance.total_pnl.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-400">Total PnL</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-orbitron font-bold text-neon-cyan">
                      {(dashboard.trading_performance.win_rate * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400">Win Rate</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-orbitron font-bold text-neon-purple">
                      {dashboard.trading_performance.total_trades}
                    </div>
                    <div className="text-sm text-gray-400">Total Trades</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-orbitron font-bold text-neon-orange">
                      {dashboard.trading_performance.sharpe_ratio.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-400">Sharpe Ratio</div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-white/10">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-neon-green font-bold">
                        ${dashboard.trading_performance.avg_win.toFixed(2)}
                      </div>
                      <div className="text-gray-400">Avg Win</div>
                    </div>
                    <div className="text-center">
                      <div className="text-neon-pink font-bold">
                        ${Math.abs(dashboard.trading_performance.avg_loss).toFixed(2)}
                      </div>
                      <div className="text-gray-400">Avg Loss</div>
                    </div>
                    <div className="text-center">
                      <div className="text-neon-yellow font-bold">
                        {(dashboard.trading_performance.max_drawdown * 100).toFixed(1)}%
                      </div>
                      <div className="text-gray-400">Max DD</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8">
                No trading performance data available
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Metrics Chart */}
      {dashboard && (
        <GlassCard>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-rajdhani font-bold text-neon-cyan">
              📊 Metrics History
            </h2>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="glass-input w-64"
            >
              {metricsOptions.map(option => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="h-64 flex items-center justify-center text-gray-400">
            {metricHistory.length > 0 ? (
              <div className="w-full">
                <div className="text-center mb-4">
                  Last {metricHistory.length} data points for {
                    metricsOptions.find(opt => opt.key === selectedMetric)?.label
                  }
                </div>
                <div className="flex items-end justify-center space-x-1 h-32">
                  {metricHistory.slice(-20).map((point, index) => (
                    <div
                      key={index}
                      className="bg-neon-cyan/30 w-4 rounded-t"
                      style={{
                        height: `${Math.max(5, (point.value / Math.max(...metricHistory.map(p => p.value)) * 100))}%`
                      }}
                      title={`${point.value} at ${new Date(point.timestamp).toLocaleTimeString()}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              'No metric data available for selected metric'
            )}
          </div>
        </GlassCard>
      )}

      {/* Active Alerts */}
      {dashboard && dashboard.active_alerts.length > 0 && (
        <GlassCard>
          <h2 className="text-xl font-rajdhani font-bold text-neon-cyan mb-6">
            🚨 Active Alerts
          </h2>
          
          <div className="space-y-3">
            {dashboard.active_alerts.map((alert, index) => (
              <div key={alert.id || index} className="p-4 glass-panel rounded-xl border border-neon-yellow/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">
                      {getAlertSeverityIcon(alert.severity)}
                    </span>
                    <div>
                      <h4 className={`font-rajdhani font-bold ${getAlertSeverityColor(alert.severity)}`}>
                        {alert.title}
                      </h4>
                      <p className="text-gray-300 text-sm">{alert.message}</p>
                      <div className="text-xs text-gray-500 mt-1">
                        Source: {alert.source} • {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="glass-button glass-button-green px-3 py-1 text-sm"
                  >
                    ✅ Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Monitoring Statistics */}
      {dashboard && (
        <GlassCard>
          <h2 className="text-xl font-rajdhani font-bold text-neon-cyan mb-6">
            📈 Monitoring Statistics
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-orbitron font-bold text-neon-green">
                {dashboard.monitoring_stats.alerts_sent || 0}
              </div>
              <div className="text-sm text-gray-400">Alerts Sent</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-orbitron font-bold text-neon-cyan">
                {dashboard.monitoring_stats.metrics_collected || 0}
              </div>
              <div className="text-sm text-gray-400">Metrics Collected</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-orbitron font-bold text-neon-purple">
                {dashboard.monitoring_stats.system_errors || 0}
              </div>
              <div className="text-sm text-gray-400">System Errors</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-orbitron font-bold text-neon-orange">
                {formatUptime(dashboard.uptime)}
              </div>
              <div className="text-sm text-gray-400">System Uptime</div>
            </div>
          </div>
          
          <div className="mt-6 p-4 glass-panel rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Monitoring Status</span>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  dashboard.is_monitoring ? 'bg-neon-green' : 'bg-gray-500'
                } animate-pulse`}></div>
                <span className={`font-bold ${
                  dashboard.is_monitoring ? 'text-neon-green' : 'text-gray-500'
                }`}>
                  {dashboard.is_monitoring ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default MonitoringDashboard;