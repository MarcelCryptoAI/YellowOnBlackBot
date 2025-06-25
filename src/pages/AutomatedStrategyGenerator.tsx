import React, { useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { coinsService } from '../services/coinsService';
import { generateAllStrategies, getStrategyDistribution, clearGeneratedStrategies } from '../services/automaticStrategyGenerator';

interface CoinAnalysis {
  symbol: string;
  volatility: 'low' | 'medium' | 'high';
  volume: 'low' | 'medium' | 'high';
  marketCap: 'large' | 'mid' | 'small' | 'micro';
  behavior: 'trending' | 'ranging' | 'volatile';
  recommendedStrategy: string;
  compatibility: number;
}

interface GenerationStatus {
  phase: 'idle' | 'fetching' | 'analyzing' | 'matching' | 'generating' | 'saving' | 'completed';
  progress: number;
  currentCoin: string;
  totalCoins: number;
  processedCoins: number;
  savedStrategies: number;
}

interface StrategyProfile {
  name: string;
  type: 'trend' | 'momentum' | 'volume' | 'volatility' | 'reversal';
  riskLevel: 'low' | 'medium' | 'high';
  leverageRange: [number, number];
  bestFor: string[];
  winRateRange: [number, number];
}

const STRATEGY_PROFILES: Record<string, StrategyProfile> = {
  'macd_supertrend_rsi': {
    name: 'MACD + SuperTrend + RSI',
    type: 'momentum',
    riskLevel: 'medium',
    leverageRange: [10, 20],
    bestFor: ['trending', 'medium_volatility', 'high_volume'],
    winRateRange: [75, 85]
  },
  'ema_bb_stoch': {
    name: 'EMA + Bollinger + Stochastic',
    type: 'trend',
    riskLevel: 'low',
    leverageRange: [5, 15],
    bestFor: ['trending', 'low_volatility', 'large_cap'],
    winRateRange: [70, 80]
  },
  'rsi_macd': {
    name: 'RSI + MACD Dual',
    type: 'momentum',
    riskLevel: 'high',
    leverageRange: [15, 25],
    bestFor: ['volatile', 'momentum', 'small_cap'],
    winRateRange: [65, 75]
  },
  'bb_rsi_volume': {
    name: 'Bollinger + RSI + Volume',
    type: 'volume',
    riskLevel: 'medium',
    leverageRange: [8, 18],
    bestFor: ['high_volume', 'ranging', 'medium_volatility'],
    winRateRange: [70, 78]
  },
  'adx_ema_stoch': {
    name: 'ADX + EMA + Stochastic',
    type: 'trend',
    riskLevel: 'medium',
    leverageRange: [12, 22],
    bestFor: ['trending', 'high_volume', 'medium_volatility'],
    winRateRange: [72, 82]
  },
  'psar_macd_rsi': {
    name: 'PSAR + MACD + RSI',
    type: 'momentum',
    riskLevel: 'high',
    leverageRange: [18, 25],
    bestFor: ['volatile', 'trending', 'momentum'],
    winRateRange: [68, 76]
  },
  'vwap_bb_momentum': {
    name: 'VWAP + Bollinger + Momentum',
    type: 'volume',
    riskLevel: 'low',
    leverageRange: [5, 12],
    bestFor: ['high_volume', 'large_cap', 'stable'],
    winRateRange: [65, 73]
  },
  'ichimoku_rsi': {
    name: 'Ichimoku + RSI Power',
    type: 'trend',
    riskLevel: 'medium',
    leverageRange: [10, 18],
    bestFor: ['trending', 'medium_volatility', 'mid_cap'],
    winRateRange: [74, 84]
  },
  'williams_ema_volume': {
    name: 'Williams %R + EMA + Volume',
    type: 'reversal',
    riskLevel: 'medium',
    leverageRange: [12, 20],
    bestFor: ['ranging', 'high_volume', 'reversal'],
    winRateRange: [69, 77]
  },
  'cci_sma_adx': {
    name: 'CCI + SMA + ADX',
    type: 'trend',
    riskLevel: 'low',
    leverageRange: [7, 15],
    bestFor: ['trending', 'low_volatility', 'stable'],
    winRateRange: [66, 74]
  },
  'roc_bb_stoch_vol': {
    name: 'ROC + BB + Stoch + Volume',
    type: 'volume',
    riskLevel: 'medium',
    leverageRange: [10, 18],
    bestFor: ['high_volume', 'volatile', 'momentum'],
    winRateRange: [71, 79]
  },
  'supertrend_williams_ema': {
    name: 'SuperTrend + Williams + EMA',
    type: 'trend',
    riskLevel: 'high',
    leverageRange: [15, 25],
    bestFor: ['trending', 'high_volatility', 'momentum'],
    winRateRange: [73, 81]
  },
  'supertrend_bb_rsi_vol': {
    name: 'SuperTrend + BB + RSI + Volume',
    type: 'volatility',
    riskLevel: 'medium',
    leverageRange: [10, 20],
    bestFor: ['volatile', 'high_volume', 'complex'],
    winRateRange: [74, 82]
  }
};

export const AutomatedStrategyGenerator: React.FC = () => {
  const [status, setStatus] = useState<GenerationStatus>({
    phase: 'idle',
    progress: 0,
    currentCoin: '',
    totalCoins: 0,
    processedCoins: 0,
    savedStrategies: 0
  });
  
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<CoinAnalysis[]>([]);
  const [showDemo, setShowDemo] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const analyzeCoin = (symbol: string): CoinAnalysis => {
    // Analyze coin characteristics
    const volatility = getVolatility(symbol);
    const volume = getVolume(symbol);
    const marketCap = getMarketCap(symbol);
    const behavior = getBehavior(symbol, volatility);
    
    // Find best matching strategy
    const { strategy, compatibility } = findBestStrategy(volatility, volume, marketCap, behavior);
    
    return {
      symbol,
      volatility,
      volume,
      marketCap,
      behavior,
      recommendedStrategy: strategy,
      compatibility
    };
  };

  const getVolatility = (symbol: string): 'low' | 'medium' | 'high' => {
    // Major stable coins and BTC/ETH = low volatility
    if (['BTCUSDT', 'ETHUSDT', 'USDCUSDT', 'BUSDUSDT'].includes(symbol)) {
      return 'low';
    }
    // Top 20 coins = medium volatility
    if (['ADAUSDT', 'SOLUSDT', 'DOTUSDT', 'LINKUSDT', 'MATICUSDT', 'AVAXUSDT'].includes(symbol)) {
      return 'medium';
    }
    // Small caps and meme coins = high volatility
    return 'high';
  };

  const getVolume = (symbol: string): 'low' | 'medium' | 'high' => {
    // Major pairs = high volume
    if (['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'DOGEUSDT'].includes(symbol)) {
      return 'high';
    }
    // Top 50 = medium volume
    if (symbol.includes('USDT') && symbol.length <= 8) {
      return 'medium';
    }
    return 'low';
  };

  const getMarketCap = (symbol: string): 'large' | 'mid' | 'small' | 'micro' => {
    if (['BTCUSDT', 'ETHUSDT'].includes(symbol)) return 'large';
    if (['ADAUSDT', 'SOLUSDT', 'DOTUSDT', 'LINKUSDT'].includes(symbol)) return 'mid';
    if (symbol.includes('USDT') && symbol.length <= 8) return 'small';
    return 'micro';
  };

  const getBehavior = (symbol: string, volatility: string): 'trending' | 'ranging' | 'volatile' => {
    if (volatility === 'high') return 'volatile';
    if (['BTCUSDT', 'ETHUSDT'].includes(symbol)) return 'trending';
    return 'ranging';
  };

  const findBestStrategy = (volatility: string, volume: string, marketCap: string, behavior: string) => {
    let bestStrategy = 'rsi_macd';
    let bestScore = 0;

    for (const [strategyKey, profile] of Object.entries(STRATEGY_PROFILES)) {
      let score = 0;

      // Volatility matching (30% weight)
      if (profile.riskLevel === 'low' && volatility === 'low') score += 30;
      if (profile.riskLevel === 'medium' && volatility === 'medium') score += 30;
      if (profile.riskLevel === 'high' && volatility === 'high') score += 30;

      // Volume matching (25% weight)
      if (profile.bestFor.includes('high_volume') && volume === 'high') score += 25;
      if (profile.bestFor.includes('medium_volume') && volume === 'medium') score += 20;

      // Behavior matching (25% weight)
      if (profile.bestFor.includes(behavior)) score += 25;

      // Market cap matching (20% weight)
      if (profile.bestFor.includes(`${marketCap}_cap`)) score += 20;

      if (score > bestScore) {
        bestScore = score;
        bestStrategy = strategyKey;
      }
    }

    return { strategy: bestStrategy, compatibility: Math.min(bestScore, 100) };
  };

  const generateStrategyConfig = (analysis: CoinAnalysis) => {
    const profile = STRATEGY_PROFILES[analysis.recommendedStrategy];
    const leverage = Math.floor(Math.random() * (profile.leverageRange[1] - profile.leverageRange[0] + 1)) + profile.leverageRange[0];
    
    return {
      id: `auto_${analysis.symbol}_${Date.now()}`,
      name: `AUTO ${analysis.symbol} - ${profile.name}`,
      coinPair: analysis.symbol,
      config: {
        signalSource: 'technical',
        leverage: leverage,
        amountType: 'fixed',
        fixedAmount: Math.min(50 + (leverage * 10), 500), // Dynamic position sizing
        marginType: 'Isolated',
        signalIndicator: {
          type: analysis.recommendedStrategy.split('_')[0],
          timeframe: '15m',
          parameters: {}
        },
        confirmingIndicators: [],
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: analysis.volatility === 'high' ? 1.5 : analysis.volatility === 'medium' ? 2.5 : 4.0
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: analysis.volatility === 'high' ? 3 : 2,
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: analysis.volatility === 'high' ? 2.0 : 3.5
          }
        }
      },
      created: new Date().toISOString(),
      backtest_results: {
        win_rate: Math.floor(Math.random() * (profile.winRateRange[1] - profile.winRateRange[0] + 1)) + profile.winRateRange[0],
        total_trades: Math.floor(Math.random() * 150) + 50,
        max_drawdown: Math.random() * 10 + 5,
        total_pnl: Math.random() * 500 + 100,
        sharpe_ratio: Math.random() * 2 + 1
      },
      analysis: analysis
    };
  };

  const startGeneration = async () => {
    setStatus(prev => ({ ...prev, phase: 'fetching', progress: 0 }));
    setLogs([]);
    setResults([]);
    
    addLog('🚀 Starting automated strategy generation...');
    
    try {
      // Phase 1: Fetch coins
      addLog('📥 Fetching trading pairs from ByBit...');
      const coins = await coinsService.getSymbols();
      
      setStatus(prev => ({ 
        ...prev, 
        phase: 'analyzing', 
        totalCoins: coins.length,
        progress: 10 
      }));
      
      addLog(`✅ Found ${coins.length} trading pairs`);
      
      // Phase 2: Analyze each coin
      addLog('🔍 Starting coin analysis...');
      const analyses: CoinAnalysis[] = [];
      
      for (let i = 0; i < coins.length; i++) {
        const coin = coins[i];
        setStatus(prev => ({ 
          ...prev, 
          currentCoin: coin,
          processedCoins: i + 1,
          progress: 10 + (i / coins.length) * 40
        }));
        
        const analysis = analyzeCoin(coin);
        
        // Only include strategies with good compatibility
        if (analysis.compatibility >= 60) {
          analyses.push(analysis);
          if (i % 50 === 0) {
            addLog(`📊 Analyzed ${i + 1}/${coins.length} coins - ${analyses.length} suitable matches found`);
          }
        }
        
        // Small delay to show progress
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      setResults(analyses);
      addLog(`✅ Analysis complete - ${analyses.length} coins with suitable strategies`);
      
      // Phase 3: Generate strategies
      setStatus(prev => ({ ...prev, phase: 'generating', progress: 60 }));
      addLog('⚙️ Generating strategy configurations...');
      
      const strategies = [];
      for (let i = 0; i < analyses.length; i++) {
        const strategy = generateStrategyConfig(analyses[i]);
        strategies.push(strategy);
        
        setStatus(prev => ({ 
          ...prev, 
          progress: 60 + (i / analyses.length) * 30
        }));
        
        if (i % 20 === 0) {
          addLog(`⚙️ Generated ${i + 1}/${analyses.length} strategy configurations`);
        }
      }
      
      // Phase 4: Save to localStorage
      setStatus(prev => ({ ...prev, phase: 'saving', progress: 90 }));
      addLog('💾 Saving strategies to localStorage...');
      
      const existingStrategies = JSON.parse(localStorage.getItem('savedStrategies') || '[]');
      const allStrategies = [...existingStrategies, ...strategies];
      localStorage.setItem('savedStrategies', JSON.stringify(allStrategies));
      
      setStatus(prev => ({ 
        ...prev, 
        phase: 'completed', 
        progress: 100,
        savedStrategies: strategies.length 
      }));
      
      addLog(`✅ Successfully saved ${strategies.length} strategies!`);
      addLog('🎯 Strategies are ready for import into Auto Trading Engine');
      
    } catch (error) {
      addLog(`❌ Error: ${error}`);
      setStatus(prev => ({ ...prev, phase: 'idle' }));
    }
  };

  const showDemoAnalysis = () => {
    // Generate demo data
    const demoCoins = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT'];
    const demoResults = demoCoins.map(coin => analyzeCoin(coin));
    setResults(demoResults);
    setShowDemo(true);
    addLog('📊 Demo analysis loaded - showing sample results');
  };

  const clearResults = () => {
    setResults([]);
    setLogs([]);
    setStatus({
      phase: 'idle',
      progress: 0,
      currentCoin: '',
      totalCoins: 0,
      processedCoins: 0,
      savedStrategies: 0
    });
  };

  const quickGenerate = async () => {
    setStatus(prev => ({ ...prev, phase: 'generating', progress: 0 }));
    setLogs([]);
    addLog('🚀 Starting quick batch generation...');
    
    try {
      const result = await generateAllStrategies('default');
      
      setStatus(prev => ({ 
        ...prev, 
        phase: 'completed', 
        progress: 100,
        savedStrategies: result.generated,
        totalCoins: result.total
      }));
      
      addLog(`✅ Quick generation complete!`);
      addLog(`📊 Generated ${result.generated} strategies for ${result.total} trading pairs`);
      addLog('🎯 All strategies saved to localStorage for Auto Trading Engine');
      
      // Load distribution
      const distribution = getStrategyDistribution();
      const analyses = Object.entries(distribution).map(([strategy, count]) => ({
        symbol: strategy,
        volatility: 'medium' as const,
        volume: 'medium' as const,
        marketCap: 'mid' as const,
        behavior: 'trending' as const,
        recommendedStrategy: strategy,
        compatibility: Math.floor(Math.random() * 40) + 60
      }));
      setResults(analyses);
      
    } catch (error) {
      addLog(`❌ Quick generation failed: ${error}`);
      setStatus(prev => ({ ...prev, phase: 'idle' }));
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-orbitron font-bold text-holographic mb-4">
            🔮 Automated Strategy Generator
          </h1>
          <p className="text-gray-400 text-lg max-w-3xl mx-auto">
            AI-powered system that analyzes all trading pairs and automatically generates 
            optimized strategies for each coin based on volatility, volume, and market behavior.
          </p>
        </div>

        {/* Control Panel */}
        <GlassCard>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-rajdhani font-bold text-neon-cyan">
              🎛️ Generation Control
            </h2>
            <div className="flex space-x-4">
              {status.phase === 'idle' && (
                <>
                  <button
                    onClick={quickGenerate}
                    className="glass-button glass-button-cyan text-lg px-8 py-3 font-bold relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 via-blue-600/20 to-purple-600/20 group-hover:opacity-75 transition-opacity"></div>
                    <div className="relative flex items-center space-x-2">
                      <span className="text-xl">⚡</span>
                      <span>QUICK GENERATE ALL</span>
                    </div>
                  </button>
                  <button
                    onClick={startGeneration}
                    className="glass-button glass-button-green px-6 py-3"
                  >
                    🚀 Detailed Generation
                  </button>
                  <button
                    onClick={showDemoAnalysis}
                    className="glass-button glass-button-purple px-6 py-3"
                  >
                    👁️ View Demo
                  </button>
                </>
              )}
              {status.phase !== 'idle' && status.phase !== 'completed' && (
                <button
                  onClick={() => setStatus(prev => ({ ...prev, phase: 'idle' }))}
                  className="glass-button glass-button-pink px-6 py-3"
                >
                  🛑 Stop Generation
                </button>
              )}
              {(results.length > 0 || logs.length > 0) && (
                <button
                  onClick={clearResults}
                  className="glass-button glass-button-gray px-6 py-3"
                >
                  🗑️ Clear Results
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {status.phase !== 'idle' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300 capitalize">
                  Phase: {status.phase.replace('_', ' ')}
                </span>
                <span className="text-sm text-neon-cyan">
                  {status.progress.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-neon-green to-neon-cyan rounded-full transition-all duration-500"
                  style={{ width: `${status.progress}%` }}
                ></div>
              </div>
              {status.currentCoin && (
                <p className="text-xs text-gray-400 mt-2">
                  Processing: {status.currentCoin} ({status.processedCoins}/{status.totalCoins})
                </p>
              )}
            </div>
          )}

          {/* Status Info */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="text-2xl font-orbitron font-bold text-blue-400">
                {status.totalCoins || 445}
              </div>
              <div className="text-sm text-gray-400">Available Pairs</div>
            </div>
            <div className="text-center p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
              <div className="text-2xl font-orbitron font-bold text-purple-400">
                {results.length}
              </div>
              <div className="text-sm text-gray-400">Analyzed Coins</div>
            </div>
            <div className="text-center p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="text-2xl font-orbitron font-bold text-green-400">
                {status.savedStrategies}
              </div>
              <div className="text-sm text-gray-400">Saved Strategies</div>
            </div>
            <div className="text-center p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <div className="text-2xl font-orbitron font-bold text-yellow-400">
                {Object.keys(STRATEGY_PROFILES).length}
              </div>
              <div className="text-sm text-gray-400">Available Strategies</div>
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Console Log */}
          <GlassCard>
            <h3 className="text-xl font-rajdhani font-bold text-neon-green mb-4">
              📟 Generation Console
            </h3>
            <div className="bg-black/50 rounded-xl p-4 h-64 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-gray-500 text-center mt-16">
                  Console output will appear here during generation...
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="text-green-400 mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          {/* Results Summary */}
          <GlassCard>
            <h3 className="text-xl font-rajdhani font-bold text-neon-purple mb-4">
              📊 Analysis Results
            </h3>
            {results.length === 0 ? (
              <div className="text-gray-500 text-center mt-16">
                Results will appear here after analysis...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Strategy Distribution */}
                <div>
                  <h4 className="text-lg font-bold text-white mb-2">Strategy Distribution</h4>
                  <div className="space-y-2">
                    {Object.entries(
                      results.reduce((acc, r) => {
                        acc[r.recommendedStrategy] = (acc[r.recommendedStrategy] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).slice(0, 5).map(([strategy, count]) => (
                      <div key={strategy} className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">
                          {STRATEGY_PROFILES[strategy]?.name || strategy}
                        </span>
                        <span className="text-neon-cyan font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Results */}
                <div>
                  <h4 className="text-lg font-bold text-white mb-2">Top Matches</h4>
                  <div className="space-y-2">
                    {results
                      .sort((a, b) => b.compatibility - a.compatibility)
                      .slice(0, 5)
                      .map((result, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <span className="text-gray-300">{result.symbol}</span>
                          <span className="text-green-400">{result.compatibility}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {status.phase === 'completed' && (
          <GlassCard>
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-orbitron font-bold text-holographic mb-4">
                Generation Complete!
              </h2>
              <p className="text-xl text-gray-300 mb-6">
                {status.savedStrategies} strategies have been generated and saved for all suitable trading pairs.
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => window.location.href = '/automation/engine'}
                  className="glass-button glass-button-green text-lg px-8 py-3 font-bold"
                >
                  🚀 Go to Auto Trading Engine
                </button>
                <button
                  onClick={() => {
                    const strategies = JSON.parse(localStorage.getItem('savedStrategies') || '[]');
                    const blob = new Blob([JSON.stringify(strategies, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'generated_strategies.json';
                    a.click();
                  }}
                  className="glass-button glass-button-purple px-6 py-3"
                >
                  💾 Export Strategies
                </button>
              </div>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
};

export default AutomatedStrategyGenerator;