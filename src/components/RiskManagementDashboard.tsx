import React, { useState, useEffect } from 'react';
import { riskManagementApi, RiskSummary } from '../services/api';
import { webSocketService } from '../services/websocketService';
import { GlassCard } from './GlassCard';

interface RiskLimitForm {
  limit_name: string;
  value: number;
}

export const RiskManagementDashboard: React.FC = () => {
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLimitForm, setShowLimitForm] = useState(false);
  const [limitForm, setLimitForm] = useState<RiskLimitForm>({
    limit_name: 'max_total_exposure',
    value: 50000,
  });
  const [alerts, setAlerts] = useState<any[]>([]);

  const riskLimitOptions = [
    { key: 'max_total_exposure', label: 'Max Total Exposure ($)', default: 50000 },
    { key: 'max_daily_loss', label: 'Max Daily Loss ($)', default: 2000 },
    { key: 'max_portfolio_drawdown', label: 'Max Portfolio Drawdown (%)', default: 0.15 },
    { key: 'max_position_risk', label: 'Max Risk Per Trade (%)', default: 0.02 },
    { key: 'max_correlation_risk', label: 'Max Correlation Risk (%)', default: 0.70 },
    { key: 'max_single_position', label: 'Max Single Position (%)', default: 0.10 },
    { key: 'max_leverage_global', label: 'Max Global Leverage', default: 10 },
    { key: 'max_positions', label: 'Max Number of Positions', default: 20 },
    { key: 'volatility_threshold', label: 'Volatility Threshold (%)', default: 0.05 },
  ];

  useEffect(() => {
    loadRiskSummary();
    
    // Setup WebSocket listeners
    webSocketService.on('risk_alert', handleRiskAlert);
    webSocketService.on('emergency_stop', handleEmergencyStop);
    webSocketService.on('portfolio_update', handlePortfolioUpdate);
    
    // Subscribe to risk alerts
    webSocketService.subscribeToRiskAlerts();
    
    // Refresh data periodically
    const interval = setInterval(() => {
      loadRiskSummary();
    }, 10000);
    
    return () => {
      clearInterval(interval);
      webSocketService.off('risk_alert', handleRiskAlert);
      webSocketService.off('emergency_stop', handleEmergencyStop);
      webSocketService.off('portfolio_update', handlePortfolioUpdate);
    };
  }, []);

  const handleRiskAlert = (data: { alert: any }) => {
    setAlerts(prev => [data.alert, ...prev.slice(0, 9)]); // Keep last 10 alerts
  };

  const handleEmergencyStop = (data: { reason: string; timestamp: string }) => {
    setError(`EMERGENCY STOP: ${data.reason}`);
    loadRiskSummary(); // Refresh to show updated status
  };

  const handlePortfolioUpdate = (data: { metrics: any }) => {
    if (riskSummary) {
      setRiskSummary({
        ...riskSummary,
        portfolio_metrics: data.metrics,
      });
    }
  };

  const loadRiskSummary = async () => {
    try {
      const response = await riskManagementApi.getRiskSummary();
      if (response.success) {
        setRiskSummary(response.data);
        setAlerts(response.data.recent_alerts || []);
      }
    } catch (error) {
      console.error('Error loading risk summary:', error);
    }
  };

  const startRiskMonitoring = async () => {
    setLoading(true);
    try {
      const response = await riskManagementApi.startRiskMonitoring();
      if (response.success) {
        await loadRiskSummary();
        setError(null);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to start risk monitoring');
    } finally {
      setLoading(false);
    }
  };

  const stopRiskMonitoring = async () => {
    setLoading(true);
    try {
      const response = await riskManagementApi.stopRiskMonitoring();
      if (response.success) {
        await loadRiskSummary();
        setError(null);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to stop risk monitoring');
    } finally {
      setLoading(false);
    }
  };

  const resetEmergencyStop = async () => {
    setLoading(true);
    try {
      const response = await riskManagementApi.resetEmergencyStop();
      if (response.success) {
        await loadRiskSummary();
        setError(null);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to reset emergency stop');
    } finally {
      setLoading(false);
    }
  };

  const updateRiskLimit = async () => {
    setLoading(true);
    try {
      const response = await riskManagementApi.setRiskLimit({
        limit_name: limitForm.limit_name,
        value: limitForm.value,
      });
      
      if (response.success) {
        await loadRiskSummary();
        setShowLimitForm(false);
        setError(null);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to update risk limit');
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'text-neon-green';
      case 'MEDIUM': return 'text-neon-yellow';
      case 'HIGH': return 'text-neon-orange';
      case 'CRITICAL': return 'text-neon-pink';
      default: return 'text-gray-400';
    }
  };

  const getRiskLevelIcon = (level: string) => {
    switch (level) {
      case 'LOW': return '🟢';
      case 'MEDIUM': return '🟡';
      case 'HIGH': return '🟠';
      case 'CRITICAL': return '🔴';
      default: return '⚪';
    }
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-orbitron font-bold text-holographic">
            Risk Management Center
          </h1>
          <p className="text-gray-400 mt-2">
            Monitor portfolio risk, set limits, and manage emergency stops
          </p>
        </div>
        
        <div className="flex space-x-4">
          <button
            onClick={() => setShowLimitForm(true)}
            className="glass-button glass-button-cyan"
            disabled={loading}
          >
            ⚙️ Set Limits
          </button>
          
          {riskSummary?.monitoring_active ? (
            <button
              onClick={stopRiskMonitoring}
              className="glass-button glass-button-pink"
              disabled={loading}
            >
              🛑 Stop Monitoring
            </button>
          ) : (
            <button
              onClick={startRiskMonitoring}
              className="glass-button glass-button-green"
              disabled={loading}
            >
              🛡️ Start Monitoring
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <GlassCard className="border-neon-pink/50 bg-red-500/10">
          <div className="flex items-center space-x-3">
            <span className="text-neon-pink text-xl">⚠️</span>
            <div className="flex-1">
              <h3 className="text-neon-pink font-rajdhani font-bold">Risk Alert</h3>
              <p className="text-gray-300">{error}</p>
            </div>
            {error.includes('EMERGENCY STOP') && (
              <button
                onClick={resetEmergencyStop}
                className="glass-button glass-button-pink px-3 py-1 text-sm"
                disabled={loading}
              >
                Reset
              </button>
            )}
            <button
              onClick={() => setError(null)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </GlassCard>
      )}

      {/* Risk Overview */}
      {riskSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Portfolio Metrics */}
          <GlassCard>
            <h2 className="text-xl font-rajdhani font-bold text-neon-cyan mb-6">
              📊 Portfolio Metrics
            </h2>
            
            {riskSummary.portfolio_metrics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-orbitron font-bold text-neon-green">
                      {formatCurrency(riskSummary.portfolio_metrics.total_equity)}
                    </div>
                    <div className="text-sm text-gray-400">Total Equity</div>
                  </div>
                  
                  <div className="text-center">
                    <div className={`text-2xl font-orbitron font-bold ${
                      riskSummary.portfolio_metrics.total_unrealized_pnl >= 0 
                        ? 'text-neon-green' : 'text-neon-pink'
                    }`}>
                      {formatCurrency(riskSummary.portfolio_metrics.total_unrealized_pnl)}
                    </div>
                    <div className="text-sm text-gray-400">Unrealized PnL</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-orbitron font-bold text-neon-purple">
                      {formatCurrency(riskSummary.portfolio_metrics.total_exposure)}
                    </div>
                    <div className="text-sm text-gray-400">Total Exposure</div>
                  </div>
                  
                  <div className="text-center">
                    <div className={`text-2xl font-orbitron font-bold ${
                      riskSummary.portfolio_metrics.current_drawdown < 0.05 
                        ? 'text-neon-green' 
                        : riskSummary.portfolio_metrics.current_drawdown < 0.10 
                        ? 'text-neon-yellow' : 'text-neon-pink'
                    }`}>
                      {formatPercentage(riskSummary.portfolio_metrics.current_drawdown)}
                    </div>
                    <div className="text-sm text-gray-400">Current Drawdown</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                  <div className="text-center">
                    <div className="text-lg font-rajdhani font-bold text-neon-cyan">
                      {formatPercentage(riskSummary.portfolio_metrics.win_rate)}
                    </div>
                    <div className="text-xs text-gray-400">Win Rate</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-lg font-rajdhani font-bold text-neon-orange">
                      {riskSummary.portfolio_metrics.sharpe_ratio.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">Sharpe Ratio</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-lg font-rajdhani font-bold text-neon-purple">
                      {riskSummary.portfolio_metrics.active_positions}
                    </div>
                    <div className="text-xs text-gray-400">Active Positions</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8">
                No portfolio data available
              </div>
            )}
          </GlassCard>

          {/* Risk Limits */}
          <GlassCard>
            <h2 className="text-xl font-rajdhani font-bold text-neon-cyan mb-6">
              ⚙️ Risk Limits
            </h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 glass-panel rounded-lg">
                <span className="text-gray-300">Max Total Exposure</span>
                <span className="text-neon-cyan font-bold">
                  {formatCurrency(riskSummary.global_limits.max_total_exposure)}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 glass-panel rounded-lg">
                <span className="text-gray-300">Max Daily Loss</span>
                <span className="text-neon-pink font-bold">
                  {formatCurrency(riskSummary.global_limits.max_daily_loss)}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 glass-panel rounded-lg">
                <span className="text-gray-300">Max Portfolio Drawdown</span>
                <span className="text-neon-yellow font-bold">
                  {formatPercentage(riskSummary.global_limits.max_portfolio_drawdown)}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 glass-panel rounded-lg">
                <span className="text-gray-300">Max Global Leverage</span>
                <span className="text-neon-orange font-bold">
                  {riskSummary.global_limits.max_leverage_global}x
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 glass-panel rounded-lg">
                <span className="text-gray-300">Max Positions</span>
                <span className="text-neon-purple font-bold">
                  {riskSummary.global_limits.max_positions}
                </span>
              </div>
            </div>
            
            {riskSummary.emergency_stop_triggered && (
              <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <span className="text-red-400 text-xl">🚨</span>
                  <div>
                    <h4 className="text-red-400 font-bold">EMERGENCY STOP ACTIVE</h4>
                    <p className="text-gray-300 text-sm">All trading has been halted</p>
                  </div>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Risk Alerts */}
      {alerts.length > 0 && (
        <GlassCard>
          <h2 className="text-xl font-rajdhani font-bold text-neon-cyan mb-6">
            🚨 Recent Risk Alerts
          </h2>
          
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert, index) => (
              <div key={index} className="p-4 glass-panel rounded-xl border border-neon-yellow/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">
                      {getRiskLevelIcon(alert.level)}
                    </span>
                    <div>
                      <h4 className={`font-rajdhani font-bold ${getRiskLevelColor(alert.level)}`}>
                        {alert.alert_type?.replace('_', ' ').toUpperCase()}
                      </h4>
                      <p className="text-gray-300 text-sm">{alert.message}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs text-gray-400">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                    {alert.current_value && alert.limit_value && (
                      <div className="text-xs text-gray-500 mt-1">
                        {alert.current_value.toFixed(2)} / {alert.limit_value.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Position Risks */}
      {riskSummary && Object.keys(riskSummary.position_risks).length > 0 && (
        <GlassCard>
          <h2 className="text-xl font-rajdhani font-bold text-neon-cyan mb-6">
            📍 Position Risk Analysis
          </h2>
          
          <div className="space-y-3">
            {Object.entries(riskSummary.position_risks).map(([symbol, risk]: [string, any]) => (
              <div key={symbol} className="p-4 glass-panel rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-xl">📊</div>
                    <div>
                      <h4 className="font-rajdhani font-bold text-white">{symbol}</h4>
                      <p className="text-sm text-gray-400">
                        Size: {risk.size} | Entry: ${risk.entry_price}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`font-bold ${
                      risk.unrealized_pnl >= 0 ? 'text-neon-green' : 'text-neon-pink'
                    }`}>
                      {formatCurrency(risk.unrealized_pnl)}
                    </div>
                    <div className="text-sm text-gray-400">
                      Risk: {formatPercentage(risk.position_risk_ratio)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Risk Limit Form Modal */}
      {showLimitForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <GlassCard className="w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-rajdhani font-bold text-neon-cyan">
                ⚙️ Update Risk Limit
              </h2>
              <button
                onClick={() => setShowLimitForm(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Risk Limit</label>
                <select
                  value={limitForm.limit_name}
                  onChange={(e) => {
                    const option = riskLimitOptions.find(opt => opt.key === e.target.value);
                    setLimitForm({
                      limit_name: e.target.value,
                      value: option?.default || 0,
                    });
                  }}
                  className="glass-input w-full"
                >
                  {riskLimitOptions.map(option => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Value</label>
                <input
                  type="number"
                  step="any"
                  value={limitForm.value}
                  onChange={(e) => setLimitForm({ ...limitForm, value: parseFloat(e.target.value) || 0 })}
                  className="glass-input w-full"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-4">
              <button
                onClick={() => setShowLimitForm(false)}
                className="glass-button glass-button-gray"
              >
                Cancel
              </button>
              <button
                onClick={updateRiskLimit}
                className="glass-button glass-button-cyan"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Limit'}
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default RiskManagementDashboard;