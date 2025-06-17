import React, { useState, useEffect } from 'react';
import { strategyEngineApi, Strategy } from '../services/api';
import { webSocketService } from '../services/websocketService';
import { GlassCard } from './GlassCard';

interface EngineStatus {
  is_running: boolean;
  total_strategies: number;
  active_strategies: number;
  total_connections: number;
  execution_stats: {
    total_signals: number;
    successful_executions: number;
    failed_executions: number;
    total_pnl: number;
  };
  global_risk_limits: {
    emergency_stop_triggered: boolean;
  };
  uptime: number;
}

interface StrategyFormData {
  name: string;
  connection_id: string;
  symbol: string;
  type: 'ma_crossover' | 'rsi';
  position_size: number;
  leverage: number;
  // MA Crossover specific
  short_ma?: number;
  long_ma?: number;
  // RSI specific
  rsi_period?: number;
  overbought?: number;
  oversold?: number;
  // Risk limits
  max_position_size?: number;
  max_daily_loss?: number;
  max_drawdown?: number;
  max_leverage?: number;
}

export const StrategyEngineDashboard: React.FC = () => {
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<StrategyFormData>({
    name: '',
    connection_id: '',
    symbol: 'BTCUSDT',
    type: 'ma_crossover',
    position_size: 0.01,
    leverage: 1,
    short_ma: 10,
    long_ma: 30,
    rsi_period: 14,
    overbought: 70,
    oversold: 30,
    max_position_size: 1000,
    max_daily_loss: 500,
    max_drawdown: 0.20,
    max_leverage: 10,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<any[]>([]);

  useEffect(() => {
    loadEngineStatus();
    loadConnections();
    
    // Setup WebSocket listeners
    webSocketService.on('strategy_status_change', handleStrategyStatusChange);
    webSocketService.on('strategy_performance_update', handleStrategyPerformanceUpdate);
    webSocketService.on('strategy_execution', handleStrategyExecution);
    
    // Refresh data periodically
    const interval = setInterval(() => {
      loadEngineStatus();
    }, 60000);
    
    return () => {
      clearInterval(interval);
      webSocketService.off('strategy_status_change', handleStrategyStatusChange);
      webSocketService.off('strategy_performance_update', handleStrategyPerformanceUpdate);
      webSocketService.off('strategy_execution', handleStrategyExecution);
    };
  }, []);

  const handleStrategyStatusChange = (data: { strategy_id: string; status: string }) => {
    setStrategies(prev => prev.map(strategy => 
      strategy.id === data.strategy_id 
        ? { ...strategy, status: data.status as any }
        : strategy
    ));
  };

  const handleStrategyPerformanceUpdate = (data: { strategy_id: string; performance: any }) => {
    setStrategies(prev => prev.map(strategy => 
      strategy.id === data.strategy_id 
        ? { ...strategy, performance: data.performance }
        : strategy
    ));
  };

  const handleStrategyExecution = (data: { strategy_id: string; execution: any }) => {
    console.log('Strategy execution update:', data);
    // Could update last execution time or other execution details
  };

  const loadEngineStatus = async () => {
    try {
      const response = await strategyEngineApi.getEngineStatus();
      if (response.success) {
        setEngineStatus(response.data);
      }
    } catch (error) {
      console.error('Error loading engine status:', error);
    }
  };

  const loadConnections = async () => {
    try {
      // This would connect to existing connections API
      // For now, using placeholder
      setConnections([
        { connectionId: 'bybit_main', name: 'ByBit Main Account' },
        { connectionId: 'bybit_test', name: 'ByBit Test Account' }
      ]);
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  };

  const startEngine = async () => {
    setLoading(true);
    try {
      const response = await strategyEngineApi.startEngine();
      if (response.success) {
        await loadEngineStatus();
        setError(null);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to start engine');
    } finally {
      setLoading(false);
    }
  };

  const stopEngine = async () => {
    setLoading(true);
    try {
      const response = await strategyEngineApi.stopEngine();
      if (response.success) {
        await loadEngineStatus();
        setError(null);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to stop engine');
    } finally {
      setLoading(false);
    }
  };

  const createStrategy = async () => {
    setLoading(true);
    try {
      const config: Record<string, any> = {
        type: formData.type,
        position_size: formData.position_size,
        leverage: formData.leverage,
      };

      if (formData.type === 'ma_crossover') {
        config.short_ma = formData.short_ma;
        config.long_ma = formData.long_ma;
      } else if (formData.type === 'rsi') {
        config.rsi_period = formData.rsi_period;
        config.overbought = formData.overbought;
        config.oversold = formData.oversold;
      }

      const risk_limits = {
        max_position_size: formData.max_position_size!,
        max_daily_loss: formData.max_daily_loss!,
        max_drawdown: formData.max_drawdown!,
        max_leverage: formData.max_leverage!,
      };

      const response = await strategyEngineApi.createStrategy({
        name: formData.name,
        connection_id: formData.connection_id,
        symbol: formData.symbol,
        config,
        risk_limits,
      });

      if (response.success) {
        setShowCreateForm(false);
        await loadEngineStatus();
        setError(null);
        
        // Reset form
        setFormData({
          ...formData,
          name: '',
        });
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to create strategy');
    } finally {
      setLoading(false);
    }
  };

  const controlStrategy = async (strategyId: string, action: 'start' | 'pause' | 'stop') => {
    setLoading(true);
    try {
      const response = await strategyEngineApi.controlStrategy({
        strategy_id: strategyId,
        action,
      });

      if (response.success) {
        await loadEngineStatus();
        setError(null);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || `Failed to ${action} strategy`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-neon-green';
      case 'PAUSED': return 'text-neon-yellow';
      case 'ERROR': return 'text-neon-pink';
      case 'STOPPED': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '🟢';
      case 'PAUSED': return '🟡';
      case 'ERROR': return '🔴';
      case 'STOPPED': return '⚫';
      default: return '⚪';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-orbitron font-bold text-holographic">
            Strategy Engine Control
          </h1>
          <p className="text-gray-400 mt-2">
            Manage automated trading strategies and execution engine
          </p>
        </div>
        
        <div className="flex space-x-4">
          <button
            onClick={() => setShowCreateForm(true)}
            className="glass-button glass-button-cyan"
            disabled={loading}
          >
            ➕ Create Strategy
          </button>
          
          {engineStatus?.is_running ? (
            <button
              onClick={stopEngine}
              className="glass-button glass-button-pink"
              disabled={loading}
            >
              🛑 Stop Engine
            </button>
          ) : (
            <button
              onClick={startEngine}
              className="glass-button glass-button-green"
              disabled={loading}
            >
              🚀 Start Engine
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
              <h3 className="text-neon-pink font-rajdhani font-bold">Error</h3>
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

      {/* Engine Status */}
      {engineStatus && (
        <GlassCard>
          <h2 className="text-xl font-rajdhani font-bold text-neon-cyan mb-6">
            🤖 Engine Status
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className={`text-3xl font-orbitron font-bold ${
                engineStatus.is_running ? 'text-neon-green' : 'text-gray-500'
              }`}>
                {engineStatus.is_running ? '🟢' : '🔴'}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {engineStatus.is_running ? 'RUNNING' : 'STOPPED'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-orbitron font-bold text-neon-cyan">
                {engineStatus.active_strategies}
              </div>
              <div className="text-sm text-gray-400 mt-1">Active Strategies</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-orbitron font-bold text-neon-purple">
                {engineStatus.execution_stats.successful_executions}
              </div>
              <div className="text-sm text-gray-400 mt-1">Successful Trades</div>
            </div>
            
            <div className="text-center">
              <div className={`text-3xl font-orbitron font-bold ${
                engineStatus.execution_stats.total_pnl >= 0 ? 'text-neon-green' : 'text-neon-pink'
              }`}>
                ${engineStatus.execution_stats.total_pnl.toFixed(2)}
              </div>
              <div className="text-sm text-gray-400 mt-1">Total PnL</div>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Total Signals:</span>
              <span className="text-white ml-2">{engineStatus.execution_stats.total_signals}</span>
            </div>
            <div>
              <span className="text-gray-400">Failed Executions:</span>
              <span className="text-neon-pink ml-2">{engineStatus.execution_stats.failed_executions}</span>
            </div>
            <div>
              <span className="text-gray-400">Uptime:</span>
              <span className="text-neon-cyan ml-2">{Math.floor(engineStatus.uptime / 3600)}h</span>
            </div>
          </div>

          {engineStatus.global_risk_limits.emergency_stop_triggered && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl">
              <div className="flex items-center space-x-3">
                <span className="text-red-400 text-xl">🚨</span>
                <div>
                  <h4 className="text-red-400 font-bold">EMERGENCY STOP ACTIVE</h4>
                  <p className="text-gray-300 text-sm">All trading has been halted due to risk limits</p>
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* Create Strategy Form */}
      {showCreateForm && (
        <GlassCard>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-rajdhani font-bold text-neon-cyan">
              ➕ Create New Strategy
            </h2>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Strategy Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="glass-input w-full"
                placeholder="My Strategy"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Connection</label>
              <select
                value={formData.connection_id}
                onChange={(e) => setFormData({ ...formData, connection_id: e.target.value })}
                className="glass-input w-full"
              >
                <option value="">Select Connection</option>
                {connections.map(conn => (
                  <option key={conn.connectionId} value={conn.connectionId}>
                    {conn.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Symbol</label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                className="glass-input w-full"
                placeholder="BTCUSDT"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Strategy Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="glass-input w-full"
              >
                <option value="ma_crossover">Moving Average Crossover</option>
                <option value="rsi">RSI Strategy</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Position Size</label>
              <input
                type="number"
                step="0.001"
                value={formData.position_size}
                onChange={(e) => setFormData({ ...formData, position_size: parseFloat(e.target.value) })}
                className="glass-input w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Leverage</label>
              <input
                type="number"
                min="1"
                max="20"
                value={formData.leverage}
                onChange={(e) => setFormData({ ...formData, leverage: parseInt(e.target.value) })}
                className="glass-input w-full"
              />
            </div>
            
            {/* Strategy-specific parameters */}
            {formData.type === 'ma_crossover' && (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Short MA Period</label>
                  <input
                    type="number"
                    value={formData.short_ma}
                    onChange={(e) => setFormData({ ...formData, short_ma: parseInt(e.target.value) })}
                    className="glass-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Long MA Period</label>
                  <input
                    type="number"
                    value={formData.long_ma}
                    onChange={(e) => setFormData({ ...formData, long_ma: parseInt(e.target.value) })}
                    className="glass-input w-full"
                  />
                </div>
              </>
            )}
            
            {formData.type === 'rsi' && (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">RSI Period</label>
                  <input
                    type="number"
                    value={formData.rsi_period}
                    onChange={(e) => setFormData({ ...formData, rsi_period: parseInt(e.target.value) })}
                    className="glass-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Overbought Level</label>
                  <input
                    type="number"
                    value={formData.overbought}
                    onChange={(e) => setFormData({ ...formData, overbought: parseInt(e.target.value) })}
                    className="glass-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Oversold Level</label>
                  <input
                    type="number"
                    value={formData.oversold}
                    onChange={(e) => setFormData({ ...formData, oversold: parseInt(e.target.value) })}
                    className="glass-input w-full"
                  />
                </div>
              </>
            )}
          </div>
          
          <div className="mt-6 flex justify-end space-x-4">
            <button
              onClick={() => setShowCreateForm(false)}
              className="glass-button glass-button-gray"
            >
              Cancel
            </button>
            <button
              onClick={createStrategy}
              className="glass-button glass-button-cyan"
              disabled={!formData.name || !formData.connection_id || loading}
            >
              {loading ? 'Creating...' : 'Create Strategy'}
            </button>
          </div>
        </GlassCard>
      )}

      {/* Active Strategies */}
      {engineStatus && engineStatus.total_strategies > 0 && (
        <GlassCard>
          <h2 className="text-xl font-rajdhani font-bold text-neon-cyan mb-6">
            📊 Active Strategies
          </h2>
          
          <div className="space-y-4">
            {/* This would be populated with actual strategy data */}
            <div className="p-4 glass-panel rounded-xl border border-neon-cyan/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-2xl">🟢</div>
                  <div>
                    <h3 className="font-rajdhani font-bold text-white">Sample Strategy</h3>
                    <p className="text-sm text-gray-400">BTCUSDT • MA Crossover • 0.01 BTC</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-neon-green font-bold">+$125.50</div>
                    <div className="text-sm text-gray-400">PnL</div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button className="glass-button glass-button-yellow px-3 py-1 text-sm">
                      ⏸️ Pause
                    </button>
                    <button className="glass-button glass-button-pink px-3 py-1 text-sm">
                      🛑 Stop
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default StrategyEngineDashboard;