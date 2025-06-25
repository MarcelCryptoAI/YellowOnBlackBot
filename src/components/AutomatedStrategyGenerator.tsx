import React, { useState, useEffect } from 'react';
import { automatedStrategyMatcher, AVAILABLE_STRATEGIES, STRATEGY_PROFILES } from '../services/AutomatedStrategyMatcher';
import { GlassCard } from './GlassCard';
import StrategyAnalysisDemo from './StrategyAnalysisDemo';

interface GenerationProgress {
  phase: 'fetching' | 'analyzing' | 'matching' | 'configuring' | 'saving' | 'completed';
  current: number;
  total: number;
  message: string;
}

interface AnalysisResults {
  totalCoins: number;
  totalConfigurations: number;
  strategyDistribution: Record<string, number>;
  riskDistribution: Record<string, number>;
  volatilityDistribution: Record<string, number>;
}

export const AutomatedStrategyGenerator: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({
    phase: 'fetching',
    current: 0,
    total: 100,
    message: 'Initializing...'
  });
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfigurations, setShowConfigurations] = useState(false);
  const [configurations, setConfigurations] = useState<any[]>([]);
  const [showDemo, setShowDemo] = useState(false);

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    setLogs(prev => [...prev, logEntry]);
    console.log(logEntry);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const updateProgress = (phase: GenerationProgress['phase'], current: number, total: number, message: string) => {
    setProgress({ phase, current, total, message });
    addLog(message, 'info');
  };

  const startAutomatedGeneration = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setShowResults(false);
      setShowLogs(true);
      clearLogs();

      addLog('=== AUTOMATED STRATEGY GENERATION STARTED ===', 'info');
      addLog(`Available strategies: ${AVAILABLE_STRATEGIES.length}`, 'info');
      
      updateProgress('fetching', 0, 100, 'Fetching trading pairs from Bybit...');

      // Create progress callback for the analyzer
      const progressCallback = (message: string) => {
        addLog(message, 'info');
        
        if (message.includes('Fetching')) {
          updateProgress('fetching', 10, 100, message);
        } else if (message.includes('Analyzing')) {
          const match = message.match(/(\d+)\/(\d+)/);
          if (match) {
            const current = parseInt(match[1]);
            const total = parseInt(match[2]);
            const percentage = Math.floor((current / total) * 60) + 20; // 20-80% for analysis
            updateProgress('analyzing', percentage, 100, message);
          } else {
            updateProgress('analyzing', 20, 100, message);
          }
        } else if (message.includes('Generated')) {
          updateProgress('configuring', 85, 100, message);
        } else if (message.includes('complete')) {
          updateProgress('saving', 90, 100, message);
        }
      };

      // Run the comprehensive analysis
      const results = await automatedStrategyMatcher.analyzeAllCoinsAndCreateMappings(progressCallback);
      
      updateProgress('saving', 95, 100, 'Saving configurations to localStorage...');
      
      // Save to localStorage for Auto Trading Engine import
      automatedStrategyMatcher.saveToLocalStorage(results.configurations);
      
      addLog(`Saved ${results.configurations.length} strategy configurations`, 'success');
      
      // Get analysis summary
      const summary = automatedStrategyMatcher.getAnalysisSummary();
      setAnalysisResults(summary);
      setConfigurations(results.configurations);
      
      updateProgress('completed', 100, 100, 'Automated strategy generation completed!');
      
      addLog('=== GENERATION COMPLETED SUCCESSFULLY ===', 'success');
      addLog(`Total coins analyzed: ${summary.totalCoins}`, 'success');
      addLog(`Strategy configurations generated: ${summary.totalConfigurations}`, 'success');
      addLog(`Most used strategy: ${Object.entries(summary.strategyDistribution).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A'}`, 'success');
      
      setShowResults(true);
      
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred';
      setError(errorMessage);
      addLog(`ERROR: ${errorMessage}`, 'error');
      updateProgress('fetching', 0, 100, 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const loadExistingResults = () => {
    try {
      const savedConfigurations = localStorage.getItem('auto_trading_strategies');
      if (savedConfigurations) {
        const configs = JSON.parse(savedConfigurations);
        setConfigurations(configs);
        
        const summary = automatedStrategyMatcher.getAnalysisSummary();
        setAnalysisResults(summary);
        setShowResults(true);
        
        addLog(`Loaded ${configs.length} existing strategy configurations`, 'success');
      } else {
        addLog('No existing configurations found', 'warning');
      }
    } catch (error) {
      console.error('Error loading existing results:', error);
      setError('Failed to load existing results');
    }
  };

  const clearAllStrategies = () => {
    if (confirm('Are you sure you want to clear all automated strategies? This cannot be undone.')) {
      localStorage.removeItem('auto_trading_strategies');
      localStorage.removeItem('auto_trading_strategies_timestamp');
      setConfigurations([]);
      setAnalysisResults(null);
      setShowResults(false);
      addLog('All automated strategies cleared', 'warning');
    }
  };

  const exportForAutoTrading = () => {
    try {
      const dataStr = JSON.stringify(configurations, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `automated_strategies_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      addLog(`Exported ${configurations.length} strategies to file`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      setError('Failed to export strategies');
    }
  };

  useEffect(() => {
    // Check for existing configurations on mount
    const savedConfigurations = localStorage.getItem('auto_trading_strategies');
    if (savedConfigurations) {
      const configs = JSON.parse(savedConfigurations);
      if (configs.length > 0) {
        setConfigurations(configs);
        const summary = automatedStrategyMatcher.getAnalysisSummary();
        setAnalysisResults(summary);
      }
    }
  }, []);

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'fetching': return '📡';
      case 'analyzing': return '🔍';
      case 'matching': return '🎯';
      case 'configuring': return '⚙️';
      case 'saving': return '💾';
      case 'completed': return '✅';
      default: return '🔄';
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'fetching': return 'text-blue-400';
      case 'analyzing': return 'text-yellow-400';
      case 'matching': return 'text-purple-400';
      case 'configuring': return 'text-cyan-400';
      case 'saving': return 'text-green-400';
      case 'completed': return 'text-green-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassCard>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-orbitron font-bold text-holographic mb-2">
              🤖 Automated Strategy Generator
            </h2>
            <p className="text-gray-400">
              AI-powered system that analyzes all 445+ trading pairs and automatically matches optimal strategies
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {configurations.length > 0 && (
              <div className="text-right">
                <div className="text-2xl font-orbitron font-bold text-neon-green">
                  {configurations.length}
                </div>
                <div className="text-sm text-gray-400">Strategies Ready</div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-4 mb-6">
          {!isGenerating && configurations.length === 0 && (
            <button
              onClick={startAutomatedGeneration}
              className="glass-button glass-button-green text-lg px-8 py-4 font-bold relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 via-cyan-600/20 to-blue-600/20 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative flex items-center space-x-2">
                <span className="text-xl">🚀</span>
                <span>START AUTOMATED GENERATION</span>
              </div>
            </button>
          )}
          
          {!isGenerating && (
            <>
              <button
                onClick={loadExistingResults}
                className="glass-button glass-button-cyan"
              >
                📊 Load Existing Results
              </button>
              
              <button
                onClick={() => setShowDemo(!showDemo)}
                className="glass-button glass-button-indigo"
              >
                🔮 View Demo Analysis
              </button>
            </>
          )}
          
          {configurations.length > 0 && (
            <>
              <button
                onClick={() => setShowConfigurations(!showConfigurations)}
                className="glass-button glass-button-purple"
              >
                📋 View Configurations
              </button>
              
              <button
                onClick={exportForAutoTrading}
                className="glass-button glass-button-blue"
              >
                📁 Export for Auto Trading
              </button>
              
              <button
                onClick={clearAllStrategies}
                className="glass-button glass-button-pink"
              >
                🗑️ Clear All
              </button>
            </>
          )}
          
          {logs.length > 0 && (
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="glass-button glass-button-gray"
            >
              📋 {showLogs ? 'Hide' : 'Show'} Logs ({logs.length})
            </button>
          )}
        </div>

        {/* System Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="text-center p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="text-3xl font-orbitron font-bold text-neon-blue">445+</div>
            <div className="text-sm text-gray-400 mt-1">Trading Pairs</div>
          </div>
          
          <div className="text-center p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
            <div className="text-3xl font-orbitron font-bold text-neon-purple">23</div>
            <div className="text-sm text-gray-400 mt-1">Available Strategies</div>
          </div>
          
          <div className="text-center p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <div className="text-3xl font-orbitron font-bold text-neon-green">
              {analysisResults?.totalConfigurations || 0}
            </div>
            <div className="text-sm text-gray-400 mt-1">Generated Configs</div>
          </div>
        </div>

        {/* Process Overview */}
        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl">
          <h3 className="text-lg font-rajdhani font-bold text-neon-blue mb-3">🔄 Automated Process</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-neon-yellow">1.</span>
                <span className="text-gray-300">Fetch all 445+ trading pairs from Bybit</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-neon-yellow">2.</span>
                <span className="text-gray-300">Analyze coin characteristics (volatility, volume, market cap)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-neon-yellow">3.</span>
                <span className="text-gray-300">Categorize trend behavior (trending, ranging, volatile)</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-neon-yellow">4.</span>
                <span className="text-gray-300">Match optimal strategy from 23 available strategies</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-neon-yellow">5.</span>
                <span className="text-gray-300">Generate proper parameters (leverage, stop-loss, take-profit)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-neon-yellow">6.</span>
                <span className="text-gray-300">Save to localStorage for Auto Trading Engine import</span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

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

      {/* Progress Display */}
      {isGenerating && (
        <GlassCard className="border-neon-cyan/50 bg-cyan-500/10">
          <div className="flex items-center space-x-4 mb-4">
            <span className={`text-3xl ${getPhaseColor(progress.phase)}`}>
              {getPhaseIcon(progress.phase)}
            </span>
            <div className="flex-1">
              <h3 className="text-neon-cyan font-rajdhani font-bold text-lg">
                {progress.phase.charAt(0).toUpperCase() + progress.phase.slice(1)} Phase
              </h3>
              <p className="text-gray-300">{progress.message}</p>
            </div>
          </div>
          
          <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
            <div 
              className="bg-gradient-to-r from-neon-cyan to-neon-purple h-4 rounded-full transition-all duration-500"
              style={{ width: `${progress.current}%` }}
            />
          </div>
          
          <div className="flex justify-between text-sm text-gray-400">
            <span>{progress.current}%</span>
            <span>Estimated time: 2-5 minutes</span>
          </div>
        </GlassCard>
      )}

      {/* Results Display */}
      {showResults && analysisResults && (
        <GlassCard>
          <h3 className="text-xl font-rajdhani font-bold text-neon-green mb-6">
            📊 Analysis Results
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="text-4xl font-orbitron font-bold text-neon-cyan">
                {analysisResults.totalCoins}
              </div>
              <div className="text-sm text-gray-400 mt-1">Coins Analyzed</div>
            </div>
            
            <div className="text-center">
              <div className="text-4xl font-orbitron font-bold text-neon-green">
                {analysisResults.totalConfigurations}
              </div>
              <div className="text-sm text-gray-400 mt-1">Strategies Generated</div>
            </div>
            
            <div className="text-center">
              <div className="text-4xl font-orbitron font-bold text-neon-purple">
                {Math.round((analysisResults.totalConfigurations / analysisResults.totalCoins) * 100)}%
              </div>
              <div className="text-sm text-gray-400 mt-1">Match Rate</div>
            </div>
          </div>

          {/* Strategy Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
              <h4 className="text-lg font-rajdhani font-bold text-neon-purple mb-3">
                🎯 Strategy Distribution
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {Object.entries(analysisResults.strategyDistribution)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([strategy, count]) => (
                    <div key={strategy} className="flex justify-between items-center">
                      <span className="text-sm text-gray-300 truncate">
                        {STRATEGY_PROFILES[strategy]?.name || strategy}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-neon-purple h-2 rounded-full"
                            style={{ width: `${(count / analysisResults.totalConfigurations) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-neon-purple font-bold w-8 text-right">
                          {count}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <h4 className="text-lg font-rajdhani font-bold text-neon-yellow mb-3">
                ⚡ Risk Distribution
              </h4>
              <div className="space-y-3">
                {Object.entries(analysisResults.riskDistribution).map(([risk, count]) => (
                  <div key={risk} className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">{risk} Risk</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-700 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full ${
                            risk === 'Low' ? 'bg-green-500' :
                            risk === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${(count / analysisResults.totalConfigurations) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Strategy Configurations List */}
      {showConfigurations && configurations.length > 0 && (
        <GlassCard>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-rajdhani font-bold text-neon-cyan">
              📋 Generated Strategy Configurations
            </h3>
            <button
              onClick={() => setShowConfigurations(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          <div className="max-h-96 overflow-y-auto space-y-2">
            {configurations.slice(0, 50).map((config, index) => (
              <div 
                key={config.id}
                className="p-3 bg-gray-900/50 border border-gray-700/50 rounded-lg flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">
                    {config.riskScore <= 3 ? '🟢' : config.riskScore <= 6 ? '🟡' : '🔴'}
                  </span>
                  <div>
                    <div className="text-white font-medium text-sm">
                      {config.name}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {config.leverage}x leverage • {config.takeProfitPercentage}% TP • {config.stopLossPercentage}% SL
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-neon-green font-bold text-sm">
                    {config.expectedWinRate}% WR
                  </div>
                  <div className="text-gray-400 text-xs">
                    Score: {config.optimizationScore?.toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
            
            {configurations.length > 50 && (
              <div className="text-center text-gray-400 text-sm py-4">
                ... and {configurations.length - 50} more configurations
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Console Logs */}
      {showLogs && logs.length > 0 && (
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-rajdhani font-bold text-white">
              📋 Generation Console
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={clearLogs}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Clear
              </button>
              <button
                onClick={() => setShowLogs(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
          
          <div className="h-64 overflow-y-auto bg-black/50 p-4 font-mono text-sm rounded-lg">
            {logs.map((log, index) => {
              const isError = log.includes('ERROR:');
              const isSuccess = log.includes('SUCCESS:');
              const isWarning = log.includes('WARNING:');
              
              return (
                <div 
                  key={index}
                  className={`text-xs leading-relaxed ${
                    isError ? 'text-red-400' : 
                    isSuccess ? 'text-green-400' : 
                    isWarning ? 'text-yellow-400' : 
                    'text-gray-300'
                  }`}
                >
                  {log}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Import Instructions */}
      {configurations.length > 0 && (
        <GlassCard className="border-neon-blue/50 bg-blue-500/10">
          <h3 className="text-lg font-rajdhani font-bold text-neon-blue mb-3">
            📁 Auto Trading Engine Import Instructions
          </h3>
          <div className="space-y-2 text-sm text-gray-300">
            <p>• Your strategies have been automatically saved to localStorage</p>
            <p>• Go to the Strategy Engine Dashboard and click "Import Strategies"</p>
            <p>• All {configurations.length} strategies will be available for immediate deployment</p>
            <p>• Each strategy is pre-configured with optimal parameters for its assigned coin</p>
            <p>• Use the "Mass Optimization" feature for further AI-powered fine-tuning</p>
          </div>
        </GlassCard>
      )}

      {/* Demo Analysis Results */}
      {showDemo && (
        <div className="space-y-6">
          <GlassCard className="border-indigo-500/50 bg-indigo-500/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-rajdhani font-bold text-neon-indigo">
                🔮 Demo Analysis Results
              </h3>
              <button
                onClick={() => setShowDemo(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              This demonstration shows what the comprehensive analysis would look like when processing all 445+ trading pairs.
            </p>
          </GlassCard>
          
          <StrategyAnalysisDemo />
        </div>
      )}
    </div>
  );
};

export default AutomatedStrategyGenerator;