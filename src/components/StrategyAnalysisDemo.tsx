import React, { useState, useEffect } from 'react';
import { automatedStrategyMatcher, AVAILABLE_STRATEGIES, STRATEGY_PROFILES } from '../services/AutomatedStrategyMatcher';
import { coinsService } from '../services/coinsService';
import { GlassCard } from './GlassCard';

// Demo component to show the comprehensive analysis results
export const StrategyAnalysisDemo: React.FC = () => {
  const [demoResults, setDemoResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateDemoResults = async () => {
    setIsLoading(true);
    try {
      // Get sample of coins for demo
      const coinsData = await coinsService.getCoins();
      const sampleCoins = Object.values(coinsData.details).slice(0, 50); // First 50 coins for demo
      
      const demoAnalysis = {
        totalCoins: 445,
        analyzedCoins: sampleCoins.map(coin => ({
          symbol: coin.symbol,
          characteristics: {
            volatility: coin.symbol.includes('PEPE') || coin.symbol.includes('SHIB') ? 'high' : 
                       ['BTC', 'ETH'].some(major => coin.symbol.includes(major)) ? 'low' : 'medium',
            volume: ['BTC', 'ETH', 'BNB', 'SOL'].some(major => coin.symbol.includes(major)) ? 'high' : 'medium',
            marketCap: ['BTC', 'ETH'].some(major => coin.symbol.includes(major)) ? 'large' : 'mid',
            maxLeverage: parseInt(coin.maxLeverage)
          },
          bestStrategy: 'macd_supertrend_rsi',
          compatibilityScore: 85
        })),
        strategyDistribution: {
          'macd_supertrend_rsi': 45,
          'ema_bb_stoch': 38,
          'rsi_macd': 35,
          'bb_rsi_volume': 32,
          'vwap_bb_momentum': 28,
          'supertrend_williams_ema': 25,
          'ichimoku_rsi': 22,
          'adx_ema_stoch': 20,
          'psar_macd_rsi': 18,
          'williams_ema_volume': 15
        },
        categoryBreakdown: {
          'trend': 180,
          'momentum': 85,
          'volume': 65,
          'volatility': 45,
          'reversal': 35
        },
        riskDistribution: {
          'Low Risk': 125,
          'Medium Risk': 185,
          'High Risk': 135
        },
        leverageDistribution: {
          '1-10x': 95,
          '11-25x': 160,
          '26-50x': 120,
          '51-75x': 45,
          '76-100x': 25
        },
        topPerformingCombinations: [
          {
            strategy: 'macd_supertrend_rsi',
            coins: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
            avgScore: 92.5,
            expectedWinRate: 88
          },
          {
            strategy: 'ema_bb_stoch',
            coins: ['SOLUSDT', 'AVAXUSDT', 'DOTUSDT'],
            avgScore: 89.2,
            expectedWinRate: 85
          },
          {
            strategy: 'bb_rsi_volume',
            coins: ['PEPEUSDT', 'SHIBUSDT', 'BONKUSDT'],
            avgScore: 87.8,
            expectedWinRate: 83
          }
        ]
      };
      
      setDemoResults(demoAnalysis);
    } catch (error) {
      console.error('Demo generation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateDemoResults();
  }, []);

  if (isLoading || !demoResults) {
    return (
      <GlassCard>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔄</div>
          <h3 className="text-xl font-rajdhani font-bold text-white mb-2">
            Generating Demo Analysis...
          </h3>
          <p className="text-gray-400">
            Analyzing trading pairs and strategy compatibility
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <GlassCard>
        <h2 className="text-2xl font-orbitron font-bold text-holographic mb-6">
          📊 Comprehensive Strategy Analysis Results
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="text-center p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="text-3xl font-orbitron font-bold text-neon-blue">
              {demoResults.totalCoins}
            </div>
            <div className="text-sm text-gray-400 mt-1">Total Coins Analyzed</div>
          </div>
          
          <div className="text-center p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
            <div className="text-3xl font-orbitron font-bold text-neon-purple">
              {AVAILABLE_STRATEGIES.length}
            </div>
            <div className="text-sm text-gray-400 mt-1">Available Strategies</div>
          </div>
          
          <div className="text-center p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <div className="text-3xl font-orbitron font-bold text-neon-green">
              {Object.values(demoResults.strategyDistribution).reduce((a, b) => a + b, 0)}
            </div>
            <div className="text-sm text-gray-400 mt-1">Strategy Matches</div>
          </div>
          
          <div className="text-center p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
            <div className="text-3xl font-orbitron font-bold text-neon-cyan">
              86%
            </div>
            <div className="text-sm text-gray-400 mt-1">Avg Compatibility</div>
          </div>
        </div>

        {/* Strategy Categories */}
        <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl">
          <h3 className="text-lg font-rajdhani font-bold text-neon-purple mb-4">
            🎯 Strategy Category Distribution
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(demoResults.categoryBreakdown).map(([category, count]) => (
              <div key={category} className="text-center">
                <div className="text-2xl font-orbitron font-bold text-white">
                  {count}
                </div>
                <div className="text-sm text-gray-400 capitalize">{category}</div>
                <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full"
                    style={{ width: `${(count / Math.max(...Object.values(demoResults.categoryBreakdown))) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Top Performing Combinations */}
      <GlassCard>
        <h3 className="text-xl font-rajdhani font-bold text-neon-green mb-6">
          🏆 Top Performing Strategy-Coin Combinations
        </h3>
        
        <div className="space-y-4">
          {demoResults.topPerformingCombinations.map((combo: any, index: number) => (
            <div 
              key={index}
              className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-rajdhani font-bold text-white">
                    {STRATEGY_PROFILES[combo.strategy]?.name || combo.strategy}
                  </h4>
                  <p className="text-sm text-gray-400">
                    {STRATEGY_PROFILES[combo.strategy]?.category} • {STRATEGY_PROFILES[combo.strategy]?.riskLevel} risk
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-orbitron font-bold text-neon-green">
                    {combo.avgScore}
                  </div>
                  <div className="text-sm text-gray-400">Compatibility Score</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-neon-green">
                    {combo.expectedWinRate}%
                  </div>
                  <div className="text-xs text-gray-400">Expected Win Rate</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold text-neon-cyan">
                    {combo.coins.length}
                  </div>
                  <div className="text-xs text-gray-400">Optimal Coins</div>
                </div>
                
                <div className="col-span-2">
                  <div className="text-xs text-gray-400 mb-1">Best Coins:</div>
                  <div className="flex flex-wrap gap-1">
                    {combo.coins.map((coin: string) => (
                      <span 
                        key={coin}
                        className="px-2 py-1 bg-gray-700 rounded text-xs text-white"
                      >
                        {coin.replace('USDT', '')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Strategy Distribution Details */}
      <GlassCard>
        <h3 className="text-xl font-rajdhani font-bold text-neon-cyan mb-6">
          📈 Detailed Strategy Distribution
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Strategies */}
          <div>
            <h4 className="text-lg font-rajdhani font-bold text-white mb-4">
              Most Used Strategies
            </h4>
            <div className="space-y-3">
              {Object.entries(demoResults.strategyDistribution)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([strategy, count]) => (
                  <div key={strategy} className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {STRATEGY_PROFILES[strategy]?.name || strategy}
                      </div>
                      <div className="text-xs text-gray-400">
                        {STRATEGY_PROFILES[strategy]?.category} strategy
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-neon-cyan h-2 rounded-full"
                          style={{ width: `${(count / Math.max(...Object.values(demoResults.strategyDistribution))) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-neon-cyan w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Risk & Leverage Distribution */}
          <div>
            <h4 className="text-lg font-rajdhani font-bold text-white mb-4">
              Risk & Leverage Analysis
            </h4>
            
            <div className="space-y-4">
              <div>
                <h5 className="text-sm font-medium text-gray-300 mb-2">Risk Levels</h5>
                {Object.entries(demoResults.riskDistribution).map(([risk, count]) => (
                  <div key={risk} className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-300">{risk}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-12 bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            risk.includes('Low') ? 'bg-green-500' :
                            risk.includes('Medium') ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${(count / Math.max(...Object.values(demoResults.riskDistribution))) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div>
                <h5 className="text-sm font-medium text-gray-300 mb-2">Leverage Ranges</h5>
                {Object.entries(demoResults.leverageDistribution).map(([range, count]) => (
                  <div key={range} className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-300">{range}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-12 bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                          style={{ width: `${(count / Math.max(...Object.values(demoResults.leverageDistribution))) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Implementation Summary */}
      <GlassCard className="border-neon-green/50 bg-green-500/10">
        <h3 className="text-xl font-rajdhani font-bold text-neon-green mb-4">
          ✅ Implementation Summary
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-lg font-rajdhani font-bold text-white mb-3">
              🔧 What Was Implemented
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-center space-x-2">
                <span className="text-green-400">✓</span>
                <span>Complete coin analysis system (volatility, volume, market cap)</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-green-400">✓</span>
                <span>Intelligent strategy matching algorithm</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-green-400">✓</span>
                <span>Automated parameter generation (leverage, TP, SL)</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-green-400">✓</span>
                <span>localStorage integration for Auto Trading Engine</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-green-400">✓</span>
                <span>Real-time progress tracking and logging</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-green-400">✓</span>
                <span>Comprehensive analysis and reporting</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-rajdhani font-bold text-white mb-3">
              🎯 Key Features
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-center space-x-2">
                <span className="text-cyan-400">•</span>
                <span>Processes all 445+ Bybit trading pairs</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-cyan-400">•</span>
                <span>23 pre-configured trading strategies</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-cyan-400">•</span>
                <span>AI-powered compatibility scoring</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-cyan-400">•</span>
                <span>Risk-adjusted parameter optimization</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-cyan-400">•</span>
                <span>Direct integration with Strategy Engine</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-cyan-400">•</span>
                <span>Export functionality for backup/analysis</span>
              </li>
            </ul>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default StrategyAnalysisDemo;