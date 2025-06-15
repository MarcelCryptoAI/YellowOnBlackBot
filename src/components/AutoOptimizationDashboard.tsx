import React, { useState, useEffect } from 'react';
import { GlassCard, GlassButton, GlassMetric } from './GlassCard';
import { autoOptimizer, OptimizationMetrics, OptimizationAction } from '../services/autoOptimizer';

const AutoOptimizationDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<OptimizationMetrics | null>(null);
  const [actions, setActions] = useState<OptimizationAction[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationHistory, setOptimizationHistory] = useState<string[]>([]);

  useEffect(() => {
    const updateMetrics = async () => {
      try {
        const currentMetrics = await autoOptimizer.collectMetrics();
        setMetrics(currentMetrics);
        
        const suggestedActions = await autoOptimizer.analyzePerformance();
        setActions(suggestedActions);
      } catch (error) {
        console.error('Failed to collect metrics:', error);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const executeOptimization = async (action: OptimizationAction) => {
    setIsOptimizing(true);
    try {
      const success = await autoOptimizer.executeOptimization(action);
      if (success) {
        setOptimizationHistory(prev => [
          `${new Date().toLocaleTimeString()}: ${action.description}`,
          ...prev.slice(0, 9)
        ]);
        setActions(prev => prev.filter(a => a !== action));
      }
    } catch (error) {
      console.error('Optimization failed:', error);
    }
    setIsOptimizing(false);
  };

  const runAutoOptimization = async () => {
    setIsOptimizing(true);
    try {
      await autoOptimizer.autoOptimize();
    } catch (error) {
      console.error('Auto-optimization failed:', error);
    }
    setIsOptimizing(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-orbitron font-black text-holographic mb-2">
            ARIE AUTO-OPTIMIZER
          </h2>
          <p className="text-lg text-neon-cyan font-rajdhani uppercase tracking-wider">
            🤖 Self-Improving AI Trading System
          </p>
        </div>
        
        <GlassButton
          onClick={runAutoOptimization}
          disabled={isOptimizing}
          variant="cyan"
          className="flex items-center space-x-3 px-8 py-4"
        >
          <span className={`text-2xl ${isOptimizing ? 'animate-spin' : ''}`}>
            {isOptimizing ? '⚙️' : '🧠'}
          </span>
          <span className="font-rajdhani font-bold uppercase tracking-wider">
            {isOptimizing ? 'OPTIMIZING...' : 'RUN OPTIMIZATION'}
          </span>
        </GlassButton>
      </div>

      {/* Real-time Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <GlassMetric
            label="RESPONSE TIME"
            value={`${metrics.responseTime.toFixed(0)}ms`}
            change={metrics.responseTime < 1000 ? 'OPTIMAL' : 'NEEDS OPTIMIZATION'}
            changeType={metrics.responseTime < 1000 ? 'positive' : 'negative'}
            icon="⚡"
            color={metrics.responseTime < 1000 ? 'green' : 'red'}
          />
          
          <GlassMetric
            label="ERROR RATE"
            value={`${(metrics.errorRate * 100).toFixed(2)}%`}
            change={metrics.errorRate < 0.05 ? 'STABLE' : 'HIGH'}
            changeType={metrics.errorRate < 0.05 ? 'positive' : 'negative'}
            icon="🛡️"
            color={metrics.errorRate < 0.05 ? 'green' : 'red'}
          />
          
          <GlassMetric
            label="WIN RATE"
            value={`${(metrics.tradingPerformance.winRate * 100).toFixed(1)}%`}
            change={metrics.tradingPerformance.winRate > 0.6 ? 'PROFITABLE' : 'IMPROVING'}
            changeType={metrics.tradingPerformance.winRate > 0.6 ? 'positive' : 'negative'}
            icon="🎯"
            color={metrics.tradingPerformance.winRate > 0.6 ? 'green' : 'orange'}
          />
          
          <GlassMetric
            label="SHARPE RATIO"
            value={metrics.tradingPerformance.sharpeRatio.toFixed(2)}
            change={metrics.tradingPerformance.sharpeRatio > 1.5 ? 'EXCELLENT' : 'GOOD'}
            changeType={metrics.tradingPerformance.sharpeRatio > 1.5 ? 'positive' : 'neutral'}
            icon="📈"
            color={metrics.tradingPerformance.sharpeRatio > 1.5 ? 'green' : 'cyan'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Optimization Actions */}
        <GlassCard variant="neon" color="purple" className="p-6">
          <h3 className="text-2xl font-orbitron font-bold text-white mb-6 flex items-center">
            <span className="text-3xl mr-3">🎛️</span>
            OPTIMIZATION SUGGESTIONS
          </h3>
          
          <div className="space-y-4">
            {actions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4 animate-pulse">✨</div>
                <p className="text-neon-green font-rajdhani font-bold text-lg">
                  SYSTEM RUNNING OPTIMALLY
                </p>
                <p className="text-gray-400">No improvements needed at this time</p>
              </div>
            ) : (
              actions.slice(0, 3).map((action, index) => (
                <div key={index} className="glass-panel p-4 hover:scale-[1.02] transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-orbitron font-bold">
                      {action.description}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-neon-cyan text-sm font-rajdhani">
                        {(action.confidence * 100).toFixed(0)}% confidence
                      </span>
                      <span className="text-neon-green text-sm font-rajdhani">
                        +{(action.expectedImprovement * 100).toFixed(0)}% improvement
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">
                        {action.type === 'PARAMETER_ADJUST' ? '⚙️' : 
                         action.type === 'ALGORITHM_SWITCH' ? '🔄' :
                         action.type === 'RESOURCE_SCALE' ? '📈' : '🎯'}
                      </span>
                      <span className="text-sm text-gray-400 font-rajdhani uppercase">
                        {action.type.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <GlassButton
                      onClick={() => executeOptimization(action)}
                      disabled={isOptimizing}
                      variant="green"
                      size="sm"
                    >
                      {isOptimizing ? '⚙️' : '▶️'} EXECUTE
                    </GlassButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Optimization History */}
        <GlassCard variant="neon" color="green" className="p-6">
          <h3 className="text-2xl font-orbitron font-bold text-white mb-6 flex items-center">
            <span className="text-3xl mr-3">📊</span>
            OPTIMIZATION HISTORY
          </h3>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {optimizationHistory.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🚀</div>
                <p className="text-gray-400 font-rajdhani">
                  Optimization history will appear here
                </p>
              </div>
            ) : (
              optimizationHistory.map((entry, index) => (
                <div key={index} className="glass-panel p-3 text-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse"></div>
                    <span className="text-white font-rajdhani">{entry}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      {/* Auto-Optimization Status */}
      <GlassCard variant="glow" className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-orbitron font-bold text-white mb-2">
              AUTO-OPTIMIZATION STATUS
            </h3>
            <p className="text-neon-cyan font-rajdhani">
              ARIE continuously monitors and optimizes performance every 5 minutes
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="status-dot status-online animate-pulse"></div>
              <span className="text-neon-green font-rajdhani font-bold">ACTIVE</span>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-orbitron font-black text-holographic">
                {optimizationHistory.length}
              </div>
              <div className="text-sm text-gray-400 font-rajdhani">
                OPTIMIZATIONS PERFORMED
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default AutoOptimizationDashboard;