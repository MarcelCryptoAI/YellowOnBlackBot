import React, { useState, useEffect } from 'react';
import { strategyEngineApi, Strategy } from '../services/api';
// import { webSocketService } from '../services/websocketService'; // Disabled - backend doesn't support socket.io
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

interface ImportedStrategy {
  id: string;
  name: string;
  coinPair: string;
  config: any;
  backtest_results?: {
    win_rate: number;
    total_trades: number;
    max_drawdown: number;
    total_pnl: number;
    sharpe_ratio: number;
  };
}

interface OptimizationCriteria {
  min_win_rate: number;
  max_drawdown: number;
  min_total_trades: number;
  min_profit_factor: number;
  min_sharpe_ratio: number;
}

interface MassOptimizationStatus {
  is_running: boolean;
  total_coins: number;
  processed_coins: number;
  current_coin: string;
  successful_deployments: number;
  failed_deployments: number;
  estimated_time_remaining: string;
  current_phase: 'strategy_testing' | 'optimization' | 'deployment' | 'monitoring';
  current_strategy_test: {
    strategy_name: string;
    indicators: string[];
    current_winrate: number;
    current_roi: number;
    best_winrate: number;
    best_roi: number;
  };
}

interface AutoTradingConfig {
  timeframe: '15m';
  min_winrate: 85;
  backtest_days: 90;
  target_roi_priority: boolean;
  auto_execute_trades: boolean;
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
  
  // New state for strategy import and mass optimization
  const [importedStrategies, setImportedStrategies] = useState<ImportedStrategy[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMassOptimization, setShowMassOptimization] = useState(false);
  const [optimizationCriteria, setOptimizationCriteria] = useState<OptimizationCriteria>({
    min_win_rate: 60,
    max_drawdown: 15,
    min_total_trades: 50,
    min_profit_factor: 1.5,
    min_sharpe_ratio: 1.0,
  });
  const [massOptimizationStatus, setMassOptimizationStatus] = useState<MassOptimizationStatus | null>(null);
  const [selectedStrategiesForImport, setSelectedStrategiesForImport] = useState<Set<string>>(new Set());
  
  // New state for full auto trading system
  const [showAutoTradingModal, setShowAutoTradingModal] = useState(false);
  const [isAutoTradingRunning, setIsAutoTradingRunning] = useState(false);
  const [autoTradingConfig, setAutoTradingConfig] = useState<AutoTradingConfig>({
    timeframe: '15m',
    min_winrate: 85,
    backtest_days: 90,
    target_roi_priority: true,
    auto_execute_trades: true,
  });

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

  // New functions for strategy import and mass optimization
  const loadStrategiesFromBuilder = async () => {
    try {
      setLoading(true);
      // Load strategies from localStorage where strategy builder saves them
      const savedStrategies = localStorage.getItem('saved_strategies');
      if (savedStrategies) {
        const strategies = JSON.parse(savedStrategies);
        const importableStrategies: ImportedStrategy[] = strategies.map((strategy: any, index: number) => ({
          id: `imported_${index}`,
          name: strategy.name || `Strategy ${index + 1}`,
          coinPair: strategy.coinPair || 'BTCUSDT',
          config: strategy,
          backtest_results: strategy.backtest_results || null,
        }));
        setImportedStrategies(importableStrategies);
      } else {
        setImportedStrategies([]);
      }
      setShowImportModal(true);
    } catch (error) {
      console.error('Error loading strategies from builder:', error);
      setError('Failed to load strategies from builder');
    } finally {
      setLoading(false);
    }
  };

  const importSelectedStrategies = async () => {
    try {
      setLoading(true);
      const strategiesToImport = importedStrategies.filter(strategy => 
        selectedStrategiesForImport.has(strategy.id)
      );

      for (const strategy of strategiesToImport) {
        // Convert strategy builder format to engine format
        const engineStrategy = {
          name: strategy.name,
          connection_id: connections[0]?.connectionId || '',
          symbol: strategy.coinPair,
          config: {
            type: 'imported',
            ...strategy.config,
            position_size: strategy.config.fixedAmount || 0.01,
            leverage: strategy.config.leverage || 1,
          },
          risk_limits: {
            max_position_size: strategy.config.fixedAmount ? strategy.config.fixedAmount * 10 : 1000,
            max_daily_loss: 500,
            max_drawdown: 0.20,
            max_leverage: strategy.config.leverage || 10,
          }
        };

        await strategyEngineApi.createStrategy(engineStrategy);
      }

      await loadEngineStatus();
      setShowImportModal(false);
      setSelectedStrategiesForImport(new Set());
      setError(null);
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to import strategies');
    } finally {
      setLoading(false);
    }
  };

  const startMassOptimization = async () => {
    try {
      setLoading(true);
      
      // Start mass optimization process
      const API_BASE_URL = process.env.NODE_ENV === 'production' 
        ? 'https://ctb-backend-api-5b94a2e25dad.herokuapp.com/api'
        : 'http://localhost:8100/api';
        
      const response = await fetch(`${API_BASE_URL}/strategies/mass-optimization/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          criteria: optimizationCriteria,
          strategies: importedStrategies.map(s => s.config),
        }),
      });

      if (response.ok) {
        setShowMassOptimization(false);
        // Start polling for status
        pollMassOptimizationStatus();
      } else {
        throw new Error('Failed to start mass optimization');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to start mass optimization');
    } finally {
      setLoading(false);
    }
  };

  const pollMassOptimizationStatus = () => {
    const interval = setInterval(async () => {
      try {
        const API_BASE_URL = process.env.NODE_ENV === 'production' 
          ? 'https://ctb-backend-api-5b94a2e25dad.herokuapp.com/api'
          : 'http://localhost:8100/api';
          
        const response = await fetch(`${API_BASE_URL}/strategies/mass-optimization/status`);
        if (response.ok) {
          const status = await response.json();
          setMassOptimizationStatus(status.data);
          
          if (!status.data?.is_running) {
            clearInterval(interval);
            await loadEngineStatus(); // Reload strategies after completion
          }
        }
      } catch (error) {
        console.error('Error polling mass optimization status:', error);
      }
    }, 5000); // Poll every 5 seconds
  };

  const stopMassOptimization = async () => {
    try {
      const API_BASE_URL = process.env.NODE_ENV === 'production' 
        ? 'https://ctb-backend-api-5b94a2e25dad.herokuapp.com/api'
        : 'http://localhost:8100/api';
        
      await fetch(`${API_BASE_URL}/strategies/mass-optimization/stop`, { method: 'POST' });
      setMassOptimizationStatus(null);
    } catch (error) {
      console.error('Error stopping mass optimization:', error);
    }
  };

  // New functions for full auto trading system
  const startFullAutoTrading = async () => {
    try {
      setLoading(true);
      setIsAutoTradingRunning(true);
      
      const API_BASE_URL = process.env.NODE_ENV === 'production' 
        ? 'https://ctb-backend-api-5b94a2e25dad.herokuapp.com/api'
        : 'http://localhost:8100/api';
        
      const response = await fetch(`${API_BASE_URL}/strategies/auto-trading/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(autoTradingConfig),
      });

      if (response.ok) {
        setShowAutoTradingModal(false);
        // Start polling for detailed status
        pollAutoTradingStatus();
      } else {
        throw new Error('Failed to start auto trading');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to start auto trading');
      setIsAutoTradingRunning(false);
    } finally {
      setLoading(false);
    }
  };

  const pollAutoTradingStatus = () => {
    const interval = setInterval(async () => {
      try {
        const API_BASE_URL = process.env.NODE_ENV === 'production' 
          ? 'https://ctb-backend-api-5b94a2e25dad.herokuapp.com/api'
          : 'http://localhost:8100/api';
          
        const response = await fetch(`${API_BASE_URL}/strategies/auto-trading/status`);
        if (response.ok) {
          const status = await response.json();
          setMassOptimizationStatus(status.data);
          
          if (!status.data?.is_running) {
            clearInterval(interval);
            setIsAutoTradingRunning(false);
            await loadEngineStatus();
          }
        }
      } catch (error) {
        console.error('Error polling auto trading status:', error);
      }
    }, 3000); // Poll every 3 seconds for more detailed updates
  };

  const stopAutoTrading = async () => {
    try {
      const API_BASE_URL = process.env.NODE_ENV === 'production' 
        ? 'https://ctb-backend-api-5b94a2e25dad.herokuapp.com/api'
        : 'http://localhost:8100/api';
        
      await fetch(`${API_BASE_URL}/strategies/auto-trading/stop`, { method: 'POST' });
      setMassOptimizationStatus(null);
      setIsAutoTradingRunning(false);
    } catch (error) {
      console.error('Error stopping auto trading:', error);
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
          {/* Main START button for full auto trading */}
          {isAutoTradingRunning ? (
            <button
              onClick={stopAutoTrading}
              className="glass-button glass-button-pink text-lg px-6 py-3 animate-pulse"
              disabled={loading}
            >
              🛑 STOP AUTO TRADING
            </button>
          ) : (
            <button
              onClick={() => setShowAutoTradingModal(true)}
              className="glass-button glass-button-green text-lg px-6 py-3 font-bold relative overflow-hidden group"
              disabled={loading}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 via-cyan-600/20 to-blue-600/20 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative flex items-center space-x-2">
                <span className="text-xl">🚀</span>
                <span>START AUTO TRADING</span>
              </div>
            </button>
          )}
          
          <button
            onClick={loadStrategiesFromBuilder}
            className="glass-button glass-button-purple"
            disabled={loading || isAutoTradingRunning}
          >
            📥 Import Strategies
          </button>
          
          <button
            onClick={() => setShowMassOptimization(true)}
            className="glass-button glass-button-yellow"
            disabled={loading || importedStrategies.length === 0 || isAutoTradingRunning}
          >
            🎯 Mass Optimization
          </button>
          
          <button
            onClick={() => setShowCreateForm(true)}
            className="glass-button glass-button-cyan"
            disabled={loading || isAutoTradingRunning}
          >
            ➕ Create Strategy
          </button>
          
          {engineStatus?.is_running ? (
            <button
              onClick={stopEngine}
              className="glass-button glass-button-pink"
              disabled={loading || isAutoTradingRunning}
            >
              🛑 Stop Engine
            </button>
          ) : (
            <button
              onClick={startEngine}
              className="glass-button glass-button-green"
              disabled={loading || isAutoTradingRunning}
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

      {/* Auto Trading Status */}
      {massOptimizationStatus && (
        <GlassCard className={`${
          massOptimizationStatus.current_phase === 'strategy_testing' ? 'border-neon-blue/50 bg-blue-500/10' :
          massOptimizationStatus.current_phase === 'optimization' ? 'border-neon-yellow/50 bg-yellow-500/10' :
          massOptimizationStatus.current_phase === 'deployment' ? 'border-neon-purple/50 bg-purple-500/10' :
          'border-neon-green/50 bg-green-500/10'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-rajdhani font-bold text-white">
              {massOptimizationStatus.current_phase === 'strategy_testing' && '🧪 Testing Strategies'}
              {massOptimizationStatus.current_phase === 'optimization' && '🎯 AI Optimization'}
              {massOptimizationStatus.current_phase === 'deployment' && '🚀 Deploying Strategy'}
              {massOptimizationStatus.current_phase === 'monitoring' && '📊 Live Monitoring'}
            </h2>
            {massOptimizationStatus.is_running && (
              <button
                onClick={stopAutoTrading}
                className="glass-button glass-button-pink text-sm"
              >
                🛑 Stop
              </button>
            )}
          </div>
          
          {/* Current Coin & Phase Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="text-3xl font-orbitron font-bold text-neon-cyan">
                {massOptimizationStatus.current_coin}
              </div>
              <div className="text-sm text-gray-400 mt-1">Current Coin</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-orbitron font-bold text-neon-purple">
                {massOptimizationStatus.processed_coins}/{massOptimizationStatus.total_coins}
              </div>
              <div className="text-sm text-gray-400 mt-1">Progress</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-orbitron font-bold text-neon-yellow">
                {massOptimizationStatus.estimated_time_remaining}
              </div>
              <div className="text-sm text-gray-400 mt-1">ETA</div>
            </div>
          </div>
          
          {/* Strategy Testing Details */}
          {massOptimizationStatus.current_phase === 'strategy_testing' && massOptimizationStatus.current_strategy_test && (
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <h4 className="text-neon-blue font-bold mb-4 flex items-center">
                🧪 Strategy Testing: {massOptimizationStatus.current_strategy_test.strategy_name}
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className={`text-xl font-bold ${
                    massOptimizationStatus.current_strategy_test.current_winrate >= 85 ? 'text-neon-green' : 
                    massOptimizationStatus.current_strategy_test.current_winrate >= 70 ? 'text-neon-yellow' : 'text-neon-pink'
                  }`}>
                    {massOptimizationStatus.current_strategy_test.current_winrate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-400">Win Rate</div>
                </div>
                
                <div className="text-center">
                  <div className={`text-xl font-bold ${
                    massOptimizationStatus.current_strategy_test.current_roi >= 20 ? 'text-neon-green' : 
                    massOptimizationStatus.current_strategy_test.current_roi >= 10 ? 'text-neon-yellow' : 'text-neon-pink'
                  }`}>
                    {massOptimizationStatus.current_strategy_test.current_roi.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-400">ROI</div>
                </div>
                
                <div className="text-center">
                  <div className="text-xl font-bold text-neon-green">
                    {massOptimizationStatus.current_strategy_test.best_winrate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-400">Best Win Rate</div>
                </div>
                
                <div className="text-center">
                  <div className="text-xl font-bold text-neon-green">
                    {massOptimizationStatus.current_strategy_test.best_roi.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-400">Best ROI</div>
                </div>
              </div>
              
              <div className="text-sm text-gray-300">
                <strong>Testing Indicators:</strong> {massOptimizationStatus.current_strategy_test.indicators.join(', ')}
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-orbitron font-bold text-neon-yellow">
                {massOptimizationStatus.processed_coins}/{massOptimizationStatus.total_coins}
              </div>
              <div className="text-sm text-gray-400 mt-1">Progress</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-orbitron font-bold text-neon-green">
                {massOptimizationStatus.successful_deployments}
              </div>
              <div className="text-sm text-gray-400 mt-1">Deployed</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-orbitron font-bold text-neon-pink">
                {massOptimizationStatus.failed_deployments}
              </div>
              <div className="text-sm text-gray-400 mt-1">Failed</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-orbitron font-bold text-neon-cyan">
                {massOptimizationStatus.current_coin}
              </div>
              <div className="text-sm text-gray-400 mt-1">Current Coin</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-orbitron font-bold text-neon-purple">
                {massOptimizationStatus.estimated_time_remaining}
              </div>
              <div className="text-sm text-gray-400 mt-1">ETA</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
            <div 
              className="bg-gradient-to-r from-neon-cyan to-neon-purple h-3 rounded-full transition-all duration-500"
              style={{ 
                width: `${(massOptimizationStatus.processed_coins / massOptimizationStatus.total_coins) * 100}%` 
              }}
            />
          </div>
          
          <div className="text-center text-sm text-gray-400">
            {massOptimizationStatus.is_running ? (
              <span className="text-neon-yellow">🔄 Optimizing strategies for all trading pairs...</span>
            ) : (
              <span className="text-neon-green">✅ Mass optimization completed!</span>
            )}
          </div>
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

      {/* Strategy Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl h-[80vh] glass-card animate-fadeInUp">
            <div className="p-6 border-b border-neon-purple/20">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-rajdhani font-bold text-neon-purple">
                  📥 Import Strategies from Builder
                </h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Select strategies from the Strategy Builder to import into the automation engine
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto h-[calc(100%-120px)]">
              {importedStrategies.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <h3 className="text-xl font-rajdhani font-bold text-gray-400 mb-2">
                    No Strategies Found
                  </h3>
                  <p className="text-gray-500">
                    Create some strategies in the Strategy Builder first, then come back to import them.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {importedStrategies.map((strategy) => (
                    <div 
                      key={strategy.id}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedStrategiesForImport.has(strategy.id)
                          ? 'border-neon-purple bg-purple-500/20'
                          : 'border-gray-600 hover:border-neon-purple/50'
                      }`}
                      onClick={() => {
                        const newSelected = new Set(selectedStrategiesForImport);
                        if (newSelected.has(strategy.id)) {
                          newSelected.delete(strategy.id);
                        } else {
                          newSelected.add(strategy.id);
                        }
                        setSelectedStrategiesForImport(newSelected);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="text-2xl">
                            {selectedStrategiesForImport.has(strategy.id) ? '✅' : '⭕'}
                          </div>
                          <div>
                            <h3 className="font-rajdhani font-bold text-white">
                              {strategy.name}
                            </h3>
                            <p className="text-sm text-gray-400">
                              {strategy.coinPair} • {strategy.config.signalSource || 'Technical'}
                            </p>
                          </div>
                        </div>
                        
                        {strategy.backtest_results && (
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="text-center">
                              <div className={`font-bold ${
                                strategy.backtest_results.win_rate >= 60 ? 'text-neon-green' : 
                                strategy.backtest_results.win_rate >= 40 ? 'text-neon-yellow' : 'text-neon-pink'
                              }`}>
                                {strategy.backtest_results.win_rate.toFixed(1)}%
                              </div>
                              <div className="text-gray-400">Win Rate</div>
                            </div>
                            <div className="text-center">
                              <div className="text-neon-cyan font-bold">
                                {strategy.backtest_results.total_trades}
                              </div>
                              <div className="text-gray-400">Trades</div>
                            </div>
                            <div className="text-center">
                              <div className={`font-bold ${
                                strategy.backtest_results.total_pnl >= 0 ? 'text-neon-green' : 'text-neon-pink'
                              }`}>
                                ${strategy.backtest_results.total_pnl.toFixed(2)}
                              </div>
                              <div className="text-gray-400">PnL</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {selectedStrategiesForImport.size} of {importedStrategies.length} strategies selected
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="glass-button glass-button-gray"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={importSelectedStrategies}
                    disabled={selectedStrategiesForImport.size === 0 || loading}
                    className="glass-button glass-button-purple"
                  >
                    Import {selectedStrategiesForImport.size} Strategies
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mass Optimization Modal */}
      {showMassOptimization && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-card animate-fadeInUp">
            <div className="p-6 border-b border-neon-yellow/20">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-rajdhani font-bold text-neon-yellow">
                  🎯 Mass Strategy Optimization
                </h3>
                <button
                  onClick={() => setShowMassOptimization(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Configure criteria for AI-powered strategy optimization across all trading pairs
              </p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Minimum Win Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={optimizationCriteria.min_win_rate}
                    onChange={(e) => setOptimizationCriteria({
                      ...optimizationCriteria,
                      min_win_rate: parseFloat(e.target.value)
                    })}
                    className="w-full p-3 bg-black/30 border border-gray-600 rounded-xl text-white focus:border-neon-yellow focus:ring-1 focus:ring-neon-yellow"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Maximum Drawdown (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={optimizationCriteria.max_drawdown}
                    onChange={(e) => setOptimizationCriteria({
                      ...optimizationCriteria,
                      max_drawdown: parseFloat(e.target.value)
                    })}
                    className="w-full p-3 bg-black/30 border border-gray-600 rounded-xl text-white focus:border-neon-yellow focus:ring-1 focus:ring-neon-yellow"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Minimum Total Trades
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={optimizationCriteria.min_total_trades}
                    onChange={(e) => setOptimizationCriteria({
                      ...optimizationCriteria,
                      min_total_trades: parseInt(e.target.value)
                    })}
                    className="w-full p-3 bg-black/30 border border-gray-600 rounded-xl text-white focus:border-neon-yellow focus:ring-1 focus:ring-neon-yellow"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Minimum Profit Factor
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={optimizationCriteria.min_profit_factor}
                    onChange={(e) => setOptimizationCriteria({
                      ...optimizationCriteria,
                      min_profit_factor: parseFloat(e.target.value)
                    })}
                    className="w-full p-3 bg-black/30 border border-gray-600 rounded-xl text-white focus:border-neon-yellow focus:ring-1 focus:ring-neon-yellow"
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Minimum Sharpe Ratio
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={optimizationCriteria.min_sharpe_ratio}
                    onChange={(e) => setOptimizationCriteria({
                      ...optimizationCriteria,
                      min_sharpe_ratio: parseFloat(e.target.value)
                    })}
                    className="w-full p-3 bg-black/30 border border-gray-600 rounded-xl text-white focus:border-neon-yellow focus:ring-1 focus:ring-neon-yellow"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <h4 className="text-neon-yellow font-bold mb-2">🤖 AI Optimization Process</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Backtests all imported strategies on 445+ trading pairs</li>
                  <li>• AI optimizes parameters for each coin individually</li>
                  <li>• Deploys only strategies meeting your criteria</li>
                  <li>• Estimated time: 2-4 hours for complete optimization</li>
                </ul>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {importedStrategies.length} strategies available for optimization
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowMassOptimization(false)}
                    className="glass-button glass-button-gray"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startMassOptimization}
                    disabled={loading || importedStrategies.length === 0}
                    className="glass-button glass-button-yellow"
                  >
                    🚀 Start Mass Optimization
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto Trading Modal */}
      {showAutoTradingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900/95 border border-gray-700 rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-orbitron font-bold text-holographic">
                🚀 Start Automated Trading System
              </h2>
              <button
                onClick={() => setShowAutoTradingModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              {/* System Configuration */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <h3 className="text-neon-cyan font-bold mb-3">🔧 System Configuration</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Timeframe:</span>
                    <span className="text-neon-cyan ml-2 font-bold">15 minutes</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Backtest Period:</span>
                    <span className="text-neon-cyan ml-2 font-bold">90 days</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Min Win Rate:</span>
                    <span className="text-neon-green ml-2 font-bold">85%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Available Coins:</span>
                    <span className="text-neon-purple ml-2 font-bold">445+ pairs</span>
                  </div>
                </div>
              </div>

              {/* Process Overview */}
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <h3 className="text-neon-green font-bold mb-3">🤖 AI Process Overview</h3>
                <div className="space-y-3 text-sm text-gray-300">
                  <div className="flex items-start space-x-3">
                    <span className="text-neon-yellow">1.</span>
                    <span>Test all indicator combinations for each coin (MA, RSI, MACD, Bollinger, etc.)</span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-neon-yellow">2.</span>
                    <span>AI optimizes parameters: indicators, take profit, stop loss, position size</span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-neon-yellow">3.</span>
                    <span>Select strategy with highest win rate (≥85%) + highest ROI</span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-neon-yellow">4.</span>
                    <span>Deploy strategy, monitor signals, execute trades automatically</span>
                  </div>
                </div>
              </div>

              {/* Risk Warning */}
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <h3 className="text-neon-pink font-bold mb-3">⚠️ Risk Warning</h3>
                <div className="text-sm text-gray-300 space-y-2">
                  <p>• This system will trade automatically across ALL available coins</p>
                  <p>• Estimated processing time: 2-6 hours for complete setup</p>
                  <p>• Only strategies meeting 85% win rate criteria will be deployed</p>
                  <p>• Monitor your account balance and risk management settings</p>
                </div>
              </div>

              {/* Auto Execute Setting */}
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-neon-purple font-bold">🎯 Automatic Trade Execution</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Execute trades automatically when signals are generated
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoTradingConfig.auto_execute_trades}
                      onChange={(e) => setAutoTradingConfig(prev => ({
                        ...prev,
                        auto_execute_trades: e.target.checked
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>

              {/* Estimated Time */}
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-center">
                <h3 className="text-neon-yellow font-bold mb-2">⏱️ Estimated Completion Time</h3>
                <p className="text-2xl font-orbitron font-bold text-white">2-6 Hours</p>
                <p className="text-sm text-gray-400 mt-1">
                  Depends on market conditions and optimization complexity
                </p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                Ready to start fully automated trading system
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowAutoTradingModal(false)}
                  className="glass-button glass-button-gray"
                >
                  Cancel
                </button>
                <button
                  onClick={startFullAutoTrading}
                  disabled={loading}
                  className="glass-button glass-button-green font-bold text-lg px-8 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 via-cyan-600/20 to-blue-600/20 group-hover:opacity-75 transition-opacity"></div>
                  <div className="relative flex items-center space-x-2">
                    <span className="text-xl">🚀</span>
                    <span>START AUTO TRADING</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategyEngineDashboard;