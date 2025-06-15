import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TradingViewBacktest from '../components/TradingViewBacktest';
import { openaiApi } from '../services/api';

// Types
interface StrategyConfig {
  name: string;
  coinPair: string;
  signalSource: 'technical' | 'ml';
  technicalIndicator?: {
    type: string;
    timeframe: string;
    settings: any;
  };
  mlModel?: {
    type: 'lstm' | 'randomForest' | 'svm' | 'neuralNetwork';
    confidence: number;
    features: string[];
  };
  confirmingIndicators: Array<{
    type: string;
    timeframe: string;
    settings: any;
    enabled: boolean;
  }>;
  riskManagement: {
    positionSize: number;
    stopLoss: number;
    takeProfit: number;
    maxDailyTrades: number;
  };
}

// Available indicators
const TECHNICAL_INDICATORS = [
  { id: 'macd', name: 'MACD', timeframes: ['5m', '15m', '30m', '1h', '4h'] },
  { id: 'rsi', name: 'RSI', timeframes: ['5m', '15m', '30m', '1h', '4h'] },
  { id: 'supertrend', name: 'SuperTrend', timeframes: ['15m', '30m', '1h', '4h'] },
  { id: 'ema', name: 'EMA Crossover', timeframes: ['5m', '15m', '30m', '1h'] },
  { id: 'bollinger', name: 'Bollinger Bands', timeframes: ['15m', '30m', '1h', '4h'] },
];

const ML_MODELS = [
  { id: 'lstm', name: 'LSTM Neural Network', description: 'Deep learning for price prediction' },
  { id: 'randomForest', name: 'Random Forest', description: 'Ensemble method for trend detection' },
  { id: 'svm', name: 'Support Vector Machine', description: 'Pattern recognition classifier' },
  { id: 'neuralNetwork', name: 'Deep Neural Network', description: 'Multi-layer complex patterns' },
];

const COINS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT'];

// Technical Indicator Builder
const TechnicalBuilder: React.FC = () => {
  const [config, setConfig] = useState<StrategyConfig>({
    name: '',
    coinPair: 'BTCUSDT',
    signalSource: 'technical',
    technicalIndicator: {
      type: 'macd',
      timeframe: '15m',
      settings: { fast: 12, slow: 26, signal: 9 }
    },
    confirmingIndicators: [
      { type: 'rsi', timeframe: '15m', settings: { period: 14, overbought: 70, oversold: 30 }, enabled: true },
      { type: 'supertrend', timeframe: '1h', settings: { period: 10, multiplier: 3 }, enabled: false },
      { type: 'ema', timeframe: '30m', settings: { fast: 8, slow: 21 }, enabled: false },
    ],
    riskManagement: {
      positionSize: 2,
      stopLoss: 2,
      takeProfit: 4,
      maxDailyTrades: 10
    }
  });

  const [isOptimizing, setIsOptimizing] = useState(false);

  const optimizeCurrentSettings = async () => {
    setIsOptimizing(true);
    try {
      const response = await openaiApi.optimizeIndicators({
        coin: config.coinPair,
        timeframe: config.technicalIndicator?.timeframe || '15m',
        lookbackPeriod: '3m',
        currentSettings: {
          signalIndicator: config.technicalIndicator,
          confirmingIndicators: config.confirmingIndicators.filter(ind => ind.enabled)
        }
      });

      if (response.success) {
        // Apply optimized settings
        const optimized = response.data;
        setConfig(prev => ({
          ...prev,
          technicalIndicator: {
            type: optimized.signal_indicator?.indicator?.toLowerCase() || prev.technicalIndicator?.type || 'macd',
            timeframe: optimized.signal_indicator?.timeframe || prev.technicalIndicator?.timeframe || '15m',
            settings: parseIndicatorSettings(optimized.signal_indicator?.indicator, optimized.signal_indicator?.parameters) || prev.technicalIndicator?.settings
          }
        }));
        alert('✅ Technical indicators optimized successfully!');
      }
    } catch (error) {
      alert('❌ Optimization failed. Please try again.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const parseIndicatorSettings = (indicator: string, parameters: string) => {
    // Simple parameter parsing - in production you'd have more sophisticated parsing
    try {
      if (indicator?.toLowerCase().includes('macd')) {
        return { fast: 12, slow: 26, signal: 9 };
      } else if (indicator?.toLowerCase().includes('rsi')) {
        return { period: 14, overbought: 70, oversold: 30 };
      } else if (indicator?.toLowerCase().includes('supertrend')) {
        return { period: 10, multiplier: 3 };
      }
      return {};
    } catch {
      return {};
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Technical Indicator Strategy</h2>
          <p className="text-gray-400">Build strategy using traditional technical analysis</p>
        </div>
        <button
          onClick={optimizeCurrentSettings}
          disabled={isOptimizing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-all"
        >
          {isOptimizing ? '🔄 Optimizing...' : '🎯 Optimize with AI'}
        </button>
      </div>

      {/* Basic Settings */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="text-white font-medium mb-4">Basic Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Strategy Name</label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
              placeholder="My Technical Strategy"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Coin Pair</label>
            <select
              value={config.coinPair}
              onChange={(e) => setConfig(prev => ({ ...prev, coinPair: e.target.value }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            >
              {COINS.map(coin => (
                <option key={coin} value={coin}>{coin}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Signal Indicator */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="text-white font-medium mb-4">Signal Indicator</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Indicator Type</label>
            <select
              value={config.technicalIndicator?.type || ''}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                technicalIndicator: {
                  ...prev.technicalIndicator!,
                  type: e.target.value,
                  settings: getDefaultSettings(e.target.value)
                }
              }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            >
              {TECHNICAL_INDICATORS.map(ind => (
                <option key={ind.id} value={ind.id}>{ind.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Timeframe</label>
            <select
              value={config.technicalIndicator?.timeframe || ''}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                technicalIndicator: {
                  ...prev.technicalIndicator!,
                  timeframe: e.target.value
                }
              }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            >
              {TECHNICAL_INDICATORS.find(ind => ind.id === config.technicalIndicator?.type)?.timeframes.map(tf => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Confirming Indicators */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="text-white font-medium mb-4">Confirming Indicators</h3>
        <div className="space-y-4">
          {config.confirmingIndicators.map((indicator, index) => (
            <div key={index} className="flex items-center space-x-4 p-3 bg-gray-800 rounded-lg">
              <input
                type="checkbox"
                checked={indicator.enabled}
                onChange={(e) => {
                  const updated = [...config.confirmingIndicators];
                  updated[index].enabled = e.target.checked;
                  setConfig(prev => ({ ...prev, confirmingIndicators: updated }));
                }}
                className="w-4 h-4"
              />
              <select
                value={indicator.type}
                onChange={(e) => {
                  const updated = [...config.confirmingIndicators];
                  updated[index].type = e.target.value;
                  setConfig(prev => ({ ...prev, confirmingIndicators: updated }));
                }}
                className="bg-gray-700 text-white px-3 py-1 rounded"
                disabled={!indicator.enabled}
              >
                {TECHNICAL_INDICATORS.map(ind => (
                  <option key={ind.id} value={ind.id}>{ind.name}</option>
                ))}
              </select>
              <select
                value={indicator.timeframe}
                onChange={(e) => {
                  const updated = [...config.confirmingIndicators];
                  updated[index].timeframe = e.target.value;
                  setConfig(prev => ({ ...prev, confirmingIndicators: updated }));
                }}
                className="bg-gray-700 text-white px-3 py-1 rounded"
                disabled={!indicator.enabled}
              >
                {TECHNICAL_INDICATORS.find(ind => ind.id === indicator.type)?.timeframes.map(tf => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Management */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="text-white font-medium mb-4">Risk Management</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Position Size (%)</label>
            <input
              type="number"
              value={config.riskManagement.positionSize}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                riskManagement: { ...prev.riskManagement, positionSize: Number(e.target.value) }
              }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Stop Loss (%)</label>
            <input
              type="number"
              value={config.riskManagement.stopLoss}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                riskManagement: { ...prev.riskManagement, stopLoss: Number(e.target.value) }
              }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Take Profit (%)</label>
            <input
              type="number"
              value={config.riskManagement.takeProfit}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                riskManagement: { ...prev.riskManagement, takeProfit: Number(e.target.value) }
              }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Max Daily Trades</label>
            <input
              type="number"
              value={config.riskManagement.maxDailyTrades}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                riskManagement: { ...prev.riskManagement, maxDailyTrades: Number(e.target.value) }
              }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Machine Learning Builder
const MLBuilder: React.FC = () => {
  const [config, setConfig] = useState<StrategyConfig>({
    name: '',
    coinPair: 'BTCUSDT',
    signalSource: 'ml',
    mlModel: {
      type: 'lstm',
      confidence: 0.7,
      features: ['price', 'volume', 'volatility']
    },
    confirmingIndicators: [
      { type: 'rsi', timeframe: '15m', settings: { period: 14, overbought: 70, oversold: 30 }, enabled: true },
      { type: 'supertrend', timeframe: '1h', settings: { period: 10, multiplier: 3 }, enabled: false },
      { type: 'ema', timeframe: '30m', settings: { fast: 8, slow: 21 }, enabled: false },
    ],
    riskManagement: {
      positionSize: 2,
      stopLoss: 2,
      takeProfit: 4,
      maxDailyTrades: 10
    }
  });

  const [isOptimizing, setIsOptimizing] = useState(false);

  const optimizeCurrentSettings = async () => {
    setIsOptimizing(true);
    try {
      const response = await openaiApi.optimizeTradeParameters({
        coin: config.coinPair,
        signalIndicator: { type: 'ML_Model', timeframe: '15m', settings: config.mlModel },
        confirmingIndicators: config.confirmingIndicators.filter(ind => ind.enabled),
        currentSettings: config.riskManagement
      });

      if (response.success) {
        // Apply optimized settings
        const optimized = response.data;
        if (optimized.risk_parameters) {
          setConfig(prev => ({
            ...prev,
            riskManagement: {
              positionSize: parseFloat(optimized.risk_parameters.max_portfolio_risk?.replace('%', '')) || prev.riskManagement.positionSize,
              stopLoss: prev.riskManagement.stopLoss,
              takeProfit: prev.riskManagement.takeProfit,
              maxDailyTrades: parseInt(optimized.risk_parameters.max_concurrent_trades) || prev.riskManagement.maxDailyTrades
            }
          }));
        }
        alert('✅ ML strategy optimized successfully!');
      }
    } catch (error) {
      alert('❌ Optimization failed. Please try again.');
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Machine Learning Strategy</h2>
          <p className="text-gray-400">AI-powered strategy with ML as primary signal</p>
        </div>
        <button
          onClick={optimizeCurrentSettings}
          disabled={isOptimizing}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-all"
        >
          {isOptimizing ? '🔄 Optimizing...' : '🤖 Optimize with AI'}
        </button>
      </div>

      {/* Basic Settings */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="text-white font-medium mb-4">Basic Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Strategy Name</label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
              placeholder="My ML Strategy"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Coin Pair</label>
            <select
              value={config.coinPair}
              onChange={(e) => setConfig(prev => ({ ...prev, coinPair: e.target.value }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            >
              {COINS.map(coin => (
                <option key={coin} value={coin}>{coin}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ML Model Configuration */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="text-white font-medium mb-4">🤖 ML Signal Model (Primary)</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Model Type</label>
            <div className="grid grid-cols-2 gap-4">
              {ML_MODELS.map(model => (
                <div
                  key={model.id}
                  onClick={() => setConfig(prev => ({
                    ...prev,
                    mlModel: { ...prev.mlModel!, type: model.id as any }
                  }))}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    config.mlModel?.type === model.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <h4 className="text-white font-medium">{model.name}</h4>
                  <p className="text-gray-400 text-sm">{model.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Confidence Threshold</label>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={config.mlModel?.confidence || 0.7}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  mlModel: { ...prev.mlModel!, confidence: parseFloat(e.target.value) }
                }))}
                className="w-full"
              />
              <span className="text-gray-400 text-sm">{(config.mlModel?.confidence || 0.7) * 100}%</span>
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Features</label>
              <div className="flex flex-wrap gap-2">
                {['price', 'volume', 'volatility', 'momentum', 'sentiment'].map(feature => (
                  <label key={feature} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.mlModel?.features.includes(feature) || false}
                      onChange={(e) => {
                        const features = config.mlModel?.features || [];
                        const updated = e.target.checked
                          ? [...features, feature]
                          : features.filter(f => f !== feature);
                        setConfig(prev => ({
                          ...prev,
                          mlModel: { ...prev.mlModel!, features: updated }
                        }));
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-300 text-sm capitalize">{feature}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirming Indicators */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="text-white font-medium mb-4">Technical Confirmations</h3>
        <p className="text-gray-400 text-sm mb-4">Additional technical indicators to confirm ML signals</p>
        <div className="space-y-4">
          {config.confirmingIndicators.map((indicator, index) => (
            <div key={index} className="flex items-center space-x-4 p-3 bg-gray-800 rounded-lg">
              <input
                type="checkbox"
                checked={indicator.enabled}
                onChange={(e) => {
                  const updated = [...config.confirmingIndicators];
                  updated[index].enabled = e.target.checked;
                  setConfig(prev => ({ ...prev, confirmingIndicators: updated }));
                }}
                className="w-4 h-4"
              />
              <select
                value={indicator.type}
                onChange={(e) => {
                  const updated = [...config.confirmingIndicators];
                  updated[index].type = e.target.value;
                  setConfig(prev => ({ ...prev, confirmingIndicators: updated }));
                }}
                className="bg-gray-700 text-white px-3 py-1 rounded"
                disabled={!indicator.enabled}
              >
                {TECHNICAL_INDICATORS.map(ind => (
                  <option key={ind.id} value={ind.id}>{ind.name}</option>
                ))}
              </select>
              <select
                value={indicator.timeframe}
                onChange={(e) => {
                  const updated = [...config.confirmingIndicators];
                  updated[index].timeframe = e.target.value;
                  setConfig(prev => ({ ...prev, confirmingIndicators: updated }));
                }}
                className="bg-gray-700 text-white px-3 py-1 rounded"
                disabled={!indicator.enabled}
              >
                {TECHNICAL_INDICATORS.find(ind => ind.id === indicator.type)?.timeframes.map(tf => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Management */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="text-white font-medium mb-4">Risk Management</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Position Size (%)</label>
            <input
              type="number"
              value={config.riskManagement.positionSize}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                riskManagement: { ...prev.riskManagement, positionSize: Number(e.target.value) }
              }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Stop Loss (%)</label>
            <input
              type="number"
              value={config.riskManagement.stopLoss}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                riskManagement: { ...prev.riskManagement, stopLoss: Number(e.target.value) }
              }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Take Profit (%)</label>
            <input
              type="number"
              value={config.riskManagement.takeProfit}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                riskManagement: { ...prev.riskManagement, takeProfit: Number(e.target.value) }
              }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Max Daily Trades</label>
            <input
              type="number"
              value={config.riskManagement.maxDailyTrades}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                riskManagement: { ...prev.riskManagement, maxDailyTrades: Number(e.target.value) }
              }))}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function
const getDefaultSettings = (indicatorType: string) => {
  switch (indicatorType) {
    case 'macd': return { fast: 12, slow: 26, signal: 9 };
    case 'rsi': return { period: 14, overbought: 70, oversold: 30 };
    case 'supertrend': return { period: 10, multiplier: 3 };
    case 'ema': return { fast: 8, slow: 21 };
    case 'bollinger': return { period: 20, deviation: 2 };
    default: return {};
  }
};

// Main Strategies Component
const NewStrategies: React.FC = () => {
  const [activeBuilder, setActiveBuilder] = useState<'technical' | 'ml'>('technical');
  const [showBacktest, setShowBacktest] = useState(true);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Strategy Builder</h1>
            <p className="text-gray-400">Build and optimize your trading strategies</p>
          </div>
          
          {/* Builder Toggle */}
          <div className="flex items-center space-x-1 bg-gray-900 p-1 rounded-lg">
            <button
              onClick={() => setActiveBuilder('technical')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeBuilder === 'technical'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📈 Technical
            </button>
            <button
              onClick={() => setActiveBuilder('ml')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeBuilder === 'ml'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🤖 Machine Learning
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-screen">
        {/* Builder Panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeBuilder === 'technical' ? <TechnicalBuilder /> : <MLBuilder />}
        </div>

        {/* Live Backtest Panel */}
        {showBacktest && (
          <div className="w-1/3 border-l border-gray-800 bg-gray-950 flex flex-col">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-white font-medium">Live Backtest</h3>
              <button
                onClick={() => setShowBacktest(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex-1">
              <TradingViewBacktest 
                strategyName={`${activeBuilder === 'ml' ? 'ML' : 'Technical'} Strategy`}
                isLoading={false}
                compact={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* Show backtest button if hidden */}
      {!showBacktest && (
        <button
          onClick={() => setShowBacktest(true)}
          className="fixed bottom-6 right-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
        >
          📈 Show Backtest
        </button>
      )}
    </div>
  );
};

export default NewStrategies;