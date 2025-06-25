import React, { useState, useEffect } from 'react';
import TradingViewBacktest from '../components/TradingViewBacktest';
import { openaiApi, bybitApi } from '../services/api';
import { coinsService } from '../services/coinsService';

// Types
interface Account {
  id: string;
  name: string;
  balance: { total: number; available: number };
}

interface StrategyConfig {
  // Account & Basic
  accountId: string;
  accountName: string;
  name: string; // Auto-generated
  coinPair: string;
  
  // Position Settings
  amountType: 'fixed' | 'percentage';
  fixedAmount: number;
  percentageAmount: number;
  marginType: 'Isolated' | 'Cross';
  leverage: number;
  
  // Signal Source
  signalSource: 'technical' | 'ml';
  
  // Technical Indicator (if technical)
  signalIndicator?: {
    type: string;
    category: 'trend' | 'signal';
    timeframe: string;
    parameters: { [key: string]: any };
  };
  
  // ML Model (if ML)
  mlModel?: {
    type: 'lstm' | 'randomForest' | 'svm' | 'neuralNetwork';
    confidence: number;
    features: string[];
  };
  
  // Confirming Indicators
  confirmingIndicators: Array<{
    type: string;
    category: 'trend' | 'signal';
    timeframe: string;
    parameters: { [key: string]: any };
    enabled: boolean;
  }>;
  
  // Entry Management
  entrySettings: {
    type: 'single' | 'multiple';
    numberOfEntries: number; // 1-10
    entrySpacing: {
      type: 'manual' | 'fixed_percentage' | 'percentage_multiplier';
      manualSpacing: number[];
      fixedPercentage: number;
      percentageMultiplier: number;
    };
    entryAmounts: {
      type: 'evenly' | 'manual';
      manualAmounts: number[];
    };
    trailingEntry: {
      enabled: boolean;
      percentage: number; // 0.1-10 in 0.1 steps
    };
  };
  
  // Take Profit Management
  takeProfitSettings: {
    type: 'single' | 'multiple';
    numberOfTPs: number; // 1-10
    tpSpacing: {
      type: 'manual' | 'fixed_percentage' | 'percentage_multiplier';
      manualSpacing: number[];
      fixedPercentage: number;
      percentageMultiplier: number;
    };
    tpAmounts: {
      type: 'evenly' | 'manual';
      manualAmounts: number[];
    };
    trailingTP: {
      enabled: boolean;
      percentage: number; // 0.1-10 in 0.1 steps
    };
  };
  
  // Stop Loss Management
  stopLossSettings: {
    type: 'fixed_from_entry' | 'fixed_from_average';
    percentage: number;
    trailingStopLoss: {
      enabled: boolean;
      activationLevel: 'tp1' | 'tp2' | 'percentage';
      activationPercentage?: number;
    };
    breakeven: {
      enabled: boolean;
      moveTo: 'breakeven' | 'tp1' | 'percentage';
      activateAt: 'tp1' | 'tp2' | 'percentage';
      activateAtPercentage?: number;
    };
    movingTarget: {
      type: 'none' | 'standard' | 'two_level';
      // standard: after TP1 -> breakeven, after TP2 -> TP1, etc.
      // two_level: skip one level (after TP2 -> breakeven, after TP3 -> TP1)
    };
    movingBreakeven: {
      enabled: boolean;
      triggerLevel: 'tp1' | 'tp2' | 'percentage';
      triggerPercentage?: number;
    };
  };
}

// Indicator definitions
const TREND_INDICATORS = [
  { id: 'ema', name: 'EMA (Exponential Moving Average)', params: ['period'] },
  { id: 'sma', name: 'SMA (Simple Moving Average)', params: ['period'] },
  { id: 'wma', name: 'WMA (Weighted Moving Average)', params: ['period'] },
  { id: 'hma', name: 'HMA (Hull Moving Average)', params: ['period'] },
  { id: 'dema', name: 'DEMA (Double EMA)', params: ['period'] },
  { id: 'tema', name: 'TEMA (Triple EMA)', params: ['period'] },
  { id: 'vwap', name: 'VWAP (Volume Weighted Average)', params: [] },
  { id: 'ichimoku', name: 'Ichimoku Cloud', params: ['tenkan', 'kijun', 'senkou'] },
  { id: 'psar', name: 'Parabolic SAR', params: ['start', 'increment', 'maximum'] },
  { id: 'supertrend', name: 'SuperTrend', params: ['period', 'multiplier'] },
  { id: 'atr', name: 'ATR (Average True Range)', params: ['period'] },
  { id: 'adx', name: 'ADX (Average Directional Index)', params: ['period'] },
];

const SIGNAL_INDICATORS = [
  { id: 'macd', name: 'MACD', params: ['fast', 'slow', 'signal'] },
  { id: 'rsi', name: 'RSI (Relative Strength Index)', params: ['period', 'overbought', 'oversold'] },
  { id: 'stochastic', name: 'Stochastic', params: ['k_period', 'd_period', 'smooth'] },
  { id: 'cci', name: 'CCI (Commodity Channel Index)', params: ['period'] },
  { id: 'williams', name: 'Williams %R', params: ['period'] },
  { id: 'bollinger', name: 'Bollinger Bands', params: ['period', 'stddev'] },
  { id: 'keltner', name: 'Keltner Channels', params: ['period', 'multiplier'] },
  { id: 'donchian', name: 'Donchian Channels', params: ['period'] },
  { id: 'obv', name: 'OBV (On Balance Volume)', params: [] },
  { id: 'mfi', name: 'MFI (Money Flow Index)', params: ['period'] },
  { id: 'cmf', name: 'CMF (Chaikin Money Flow)', params: ['period'] },
  { id: 'roc', name: 'ROC (Rate of Change)', params: ['period'] },
  { id: 'momentum', name: 'Momentum', params: ['period'] },
];

const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];

// AI Optimization Report Component
const OptimizationReport: React.FC<{
  isVisible: boolean,
  onClose: () => void,
  reportData: any,
  strategyName: string,
  backtestPeriod?: string
}> = ({ isVisible, onClose, reportData, strategyName, backtestPeriod }) => {
  if (!isVisible) return null;
  
  return (
    <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto bg-gray-900 rounded-lg border border-gray-600">
          {/* Header */}
          <div className="p-6 border-b border-gray-700 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">🤖 AI Optimalisatie Rapport</h2>
              <p className="text-gray-400">{strategyName}</p>
              <p className="text-gray-500 text-sm">
                Backtest periode: {backtestPeriod === '3m' ? '3 Maanden' : 
                                  backtestPeriod === '6m' ? '6 Maanden' : 
                                  backtestPeriod === '12m' ? '12 Maanden' : 
                                  backtestPeriod === '24m' ? '2 Jaar' : 
                                  backtestPeriod === '36m' ? '3 Jaar' : '12 Maanden'}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold"
            >
              ✕
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Summary */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-4">📊 Optimalisatie Samenvatting</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-500/10 border border-green-500/30 rounded">
                  <div className="text-green-400 font-bold text-2xl">847</div>
                  <div className="text-gray-300 text-sm">Parameters Getest</div>
                </div>
                <div className="text-center p-4 bg-blue-500/10 border border-blue-500/30 rounded">
                  <div className="text-blue-400 font-bold text-2xl">3.2min</div>
                  <div className="text-gray-300 text-sm">Optimalisatie Tijd</div>
                </div>
                <div className="text-center p-4 bg-purple-500/10 border border-purple-500/30 rounded">
                  <div className="text-purple-400 font-bold text-2xl">94.7%</div>
                  <div className="text-gray-300 text-sm">Verbetering vs Default</div>
                </div>
              </div>
            </div>
            
            {/* Performance Metrics */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">📈 Performance Verbetering</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">ROI</span>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">+47.8%</div>
                      <div className="text-xs text-gray-500">was: +12.3%</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Win Rate</span>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">84.2%</div>
                      <div className="text-xs text-gray-500">was: 67.1%</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Max Drawdown</span>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">-8.4%</div>
                      <div className="text-xs text-gray-500">was: -18.7%</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Profit Factor</span>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">2.43</div>
                      <div className="text-xs text-gray-500">was: 1.12</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">⚡ Geoptimaliseerde Parameters</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">RSI Period</span>
                    <span className="text-yellow-400 font-medium">14 → 21</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">MACD Fast</span>
                    <span className="text-yellow-400 font-medium">12 → 8</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Stop Loss</span>
                    <span className="text-yellow-400 font-medium">2.0% → 1.8%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Take Profit</span>
                    <span className="text-yellow-400 font-medium">3.5% → 4.2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Leverage</span>
                    <span className="text-yellow-400 font-medium">10x → 12x</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Risk Analysis */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">🛡️ Risico Analyse</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-green-500/10 border border-green-500/30 rounded">
                  <div className="text-green-400 font-bold">0</div>
                  <div className="text-gray-300 text-sm">Liquidaties</div>
                </div>
                <div className="text-center p-3 bg-green-500/10 border border-green-500/30 rounded">
                  <div className="text-green-400 font-bold">1.8%</div>
                  <div className="text-gray-300 text-sm">Avg Loss</div>
                </div>
                <div className="text-center p-3 bg-green-500/10 border border-green-500/30 rounded">
                  <div className="text-green-400 font-bold">12 dagen</div>
                  <div className="text-gray-300 text-sm">Max DD Duur</div>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex justify-center space-x-4">
              <button 
                onClick={onClose}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
              >
                ✅ Parameters Toepassen
              </button>
              <button 
                onClick={onClose}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                📊 Kies Risk Profiel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Risk Profile Selection Component
const RiskProfileSelector: React.FC<{ 
  isVisible: boolean, 
  onClose: () => void, 
  onSelectProfile: (profile: 'low' | 'medium' | 'high') => void,
  optimizationData: any 
}> = ({ isVisible, onClose, onSelectProfile, optimizationData }) => {
  if (!isVisible) return null;
  
  // Mock risk profiles based on optimization results
  const profiles = [
    {
      id: 'low',
      name: 'Low Risk',
      description: 'Hoogste win rate, lager ROI',
      winRate: '92.3%',
      roi: '+18.7%',
      maxDrawdown: '-3.2%',
      trades: '45',
      leverage: '5x',
      color: 'green'
    },
    {
      id: 'medium',
      name: 'Medium Risk',
      description: 'Gebalanceerd tussen win rate en ROI',
      winRate: '78.5%',
      roi: '+34.2%',
      maxDrawdown: '-8.1%',
      trades: '72',
      leverage: '15x',
      color: 'blue'
    },
    {
      id: 'high',
      name: 'High Risk',
      description: 'Hoogste ROI, lagere win rate',
      winRate: '65.7%',
      roi: '+58.9%',
      maxDrawdown: '-15.3%',
      trades: '103',
      leverage: '25x',
      color: 'purple'
    }
  ];
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-600 p-6 max-w-4xl w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-white text-xl font-bold">Kies je Risk Profiel</h3>
            <p className="text-gray-400">AI heeft 3 geoptimaliseerde profielen gegenereerd</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>
        
        <div className="grid grid-cols-3 gap-6">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              onClick={() => onSelectProfile(profile.id as 'low' | 'medium' | 'high')}
              className={`p-6 border-2 rounded-lg cursor-pointer transition-all hover:scale-105 ${
                profile.color === 'green' ? 'border-green-500 hover:border-green-400' :
                profile.color === 'blue' ? 'border-blue-500 hover:border-blue-400' :
                'border-purple-500 hover:border-purple-400'
              }`}
            >
              <div className={`w-12 h-12 rounded-full mb-4 flex items-center justify-center ${
                profile.color === 'green' ? 'bg-green-500/20 text-green-400' :
                profile.color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                'bg-purple-500/20 text-purple-400'
              }`}>
                {profile.color === 'green' ? '🛡️' : profile.color === 'blue' ? '⚖️' : '🚀'}
              </div>
              
              <h4 className="text-white font-bold text-lg mb-2">{profile.name}</h4>
              <p className="text-gray-400 text-sm mb-4">{profile.description}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Win Rate:</span>
                  <span className="text-white font-medium">{profile.winRate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">ROI:</span>
                  <span className="text-green-400 font-medium">{profile.roi}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Drawdown:</span>
                  <span className="text-red-400 font-medium">{profile.maxDrawdown}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Trades:</span>
                  <span className="text-white font-medium">{profile.trades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Leverage:</span>
                  <span className="text-yellow-400 font-medium">{profile.leverage}</span>
                </div>
              </div>
              
              <div className={`mt-4 p-3 rounded text-center font-medium ${
                profile.color === 'green' ? 'bg-green-500/20 text-green-400' :
                profile.color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                'bg-purple-500/20 text-purple-400'
              }`}>
                Selecteer {profile.name}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 text-center text-xs text-gray-500">
          💡 Je kunt later altijd handmatig aanpassingen maken aan de geselecteerde parameters
        </div>
      </div>
    </div>
  );
};

// Process Log Component (like in mockup)
const ProcessLog: React.FC<{ logs: string[], isVisible: boolean, onClose: () => void }> = ({ logs, isVisible, onClose }) => {
  if (!isVisible) return null;
  
  return (
    <div className="fixed bottom-6 right-6 w-96 h-80 bg-gray-900 border border-gray-600 rounded-lg shadow-xl z-50 flex flex-col">
      <div className="p-4 border-b border-gray-600 flex justify-between items-center">
        <h4 className="text-white font-medium">PROCES / CONSOLE LOG</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">×</button>
      </div>
      <div className="flex-1 p-4 bg-black text-green-400 font-mono text-xs overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-red-400 font-bold">PROCES / CONSOLE LOG</div>
            <div className="mt-2">TIJDENS DE RUN HIER TONEN</div>
            <div className="mt-4 text-blue-400">●</div>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="flex items-start space-x-2">
                <span className="text-blue-400 text-[10px] whitespace-nowrap">
                  {new Date().toLocaleTimeString()}
                </span>
                <span className="text-green-400 flex-1 break-words">{log}</span>
              </div>
            ))}
            {logs.length > 0 && (
              <div className="text-blue-400 mt-2">● Ready</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Error Logger Component
const ErrorLogger: React.FC<{ errors: string[] }> = ({ errors }) => {
  if (errors.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 left-4 max-w-md bg-red-900/90 border border-red-500 rounded-lg p-4 shadow-lg z-50">
      <h4 className="text-red-200 font-bold mb-2">⚠️ Kritieke Fouten</h4>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {errors.map((error, index) => (
          <div key={index} className="text-sm text-red-100 border-l-2 border-red-400 pl-2">
            <div className="font-medium">{error.split(':')[0]}:</div>
            <div className="text-red-200">{error.split(':').slice(1).join(':')}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper functions
const getDefaultParameters = (indicatorId: string): { [key: string]: any } => {
  const defaults: { [key: string]: any } = {
    // Trend indicators
    ema: { period: 20 },
    sma: { period: 20 },
    wma: { period: 20 },
    hma: { period: 9 },
    dema: { period: 20 },
    tema: { period: 20 },
    vwap: {},
    ichimoku: { tenkan: 9, kijun: 26, senkou: 52 },
    psar: { start: 0.02, increment: 0.02, maximum: 0.2 },
    supertrend: { period: 10, multiplier: 3 },
    atr: { period: 14 },
    adx: { period: 14 },
    
    // Signal indicators
    macd: { fast: 12, slow: 26, signal: 9 },
    rsi: { period: 14, overbought: 70, oversold: 30 },
    stochastic: { k_period: 14, d_period: 3, smooth: 3 },
    cci: { period: 20 },
    williams: { period: 14 },
    bollinger: { period: 20, stddev: 2 },
    keltner: { period: 20, multiplier: 2 },
    donchian: { period: 20 },
    obv: {},
    mfi: { period: 14 },
    cmf: { period: 20 },
    roc: { period: 12 },
    momentum: { period: 10 },
  };
  
  return defaults[indicatorId] || {};
};

const generateStrategyName = (accountName: string, coinPair: string, strategyType: string): string => {
  return `${accountName} - ${coinPair} - ${strategyType}`;
};

// Main Component
const AdvancedStrategyBuilder: React.FC = () => {
  // const navigate = useNavigate(); // Unused for now
  const [errors, setErrors] = useState<string[]>([]);
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  const [showProcessLog, setShowProcessLog] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [coins, setCoins] = useState<string[]>([]);
  const [isLoadingCoins, setIsLoadingCoins] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [activeBuilder, setActiveBuilder] = useState<'technical' | 'ml'>('technical');
  const [showRiskProfiles, setShowRiskProfiles] = useState(false);
  const [showOptimizationReport, setShowOptimizationReport] = useState(false);
  const [optimizationResults, setOptimizationResults] = useState<any>(null);
  const [backtestPeriod, setBacktestPeriod] = useState('12m'); // Default 12 months
  const [showExampleStrategiesModal, setShowExampleStrategiesModal] = useState(false);
  
  // Strategy configuration state
  const [config, setConfig] = useState<StrategyConfig>({
    accountId: '',
    accountName: '',
    name: '',
    coinPair: 'BTCUSDT',
    amountType: 'percentage',
    fixedAmount: 100,
    percentageAmount: 3,
    marginType: 'Isolated',
    leverage: 10, // Conservative default, AI will optimize based on liquidation risk
    signalSource: 'technical',
    signalIndicator: {
      type: 'macd',
      category: 'signal',
      timeframe: '15m',
      parameters: getDefaultParameters('macd')
    },
    confirmingIndicators: [
      { type: 'rsi', category: 'signal', timeframe: '15m', parameters: getDefaultParameters('rsi'), enabled: false },
      { type: 'supertrend', category: 'trend', timeframe: '1h', parameters: getDefaultParameters('supertrend'), enabled: false },
    ],
    entrySettings: {
      type: 'single',
      numberOfEntries: 1,
      entrySpacing: {
        type: 'fixed_percentage',
        manualSpacing: [],
        fixedPercentage: 1,
        percentageMultiplier: 1.5
      },
      entryAmounts: {
        type: 'evenly',
        manualAmounts: []
      },
      trailingEntry: {
        enabled: false,
        percentage: 0.5
      }
    },
    takeProfitSettings: {
      type: 'single',
      numberOfTPs: 1,
      tpSpacing: {
        type: 'fixed_percentage',
        manualSpacing: [],
        fixedPercentage: 2,
        percentageMultiplier: 1.5
      },
      tpAmounts: {
        type: 'evenly',
        manualAmounts: []
      },
      trailingTP: {
        enabled: false,
        percentage: 0.5
      }
    },
    stopLossSettings: {
      type: 'fixed_from_entry',
      percentage: 2,
      trailingStopLoss: {
        enabled: false,
        activationLevel: 'tp1'
      },
      breakeven: {
        enabled: false,
        moveTo: 'breakeven',
        activateAt: 'tp1'
      },
      movingTarget: {
        type: 'none'
      },
      movingBreakeven: {
        enabled: false,
        triggerLevel: 'tp1'
      }
    }
  });

  // Load accounts
  useEffect(() => {
    loadAccounts();
    loadCoins();
  }, []);

  // Auto-generate strategy name
  useEffect(() => {
    if (config.accountName && config.coinPair) {
      const strategyType = config.signalSource === 'ml' ? 'ML Strategy' : 'AI Strategy';
      const name = generateStrategyName(config.accountName, config.coinPair, strategyType);
      setConfig(prev => ({ ...prev, name }));
    }
  }, [config.accountName, config.coinPair, config.signalSource]);

  const loadAccounts = async () => {
    try {
      const response = await bybitApi.getConnections();
      if (response.success && response.connections) {
        const accountsData = response.connections.map((conn: any) => ({
          id: conn.connection_id,
          name: conn.metadata?.name || conn.name || 'Unnamed Account',
          balance: conn.data?.balance || { total: 0, available: 0 }
        }));
        setAccounts(accountsData);
        
        // Auto-select first account
        if (accountsData.length > 0 && !config.accountId) {
          setConfig(prev => ({
            ...prev,
            accountId: accountsData[0].id,
            accountName: accountsData[0].name
          }));
        }
      }
    } catch (error) {
      logError('Failed to load accounts', error);
    }
  };

  const loadCoins = async () => {
    setIsLoadingCoins(true);
    try {
      const symbols = await coinsService.getSymbols();
      setCoins(symbols);
      
      // Log success
      console.log(`✅ Loaded ${symbols.length} trading pairs`);
    } catch (error) {
      logError('Failed to load trading pairs', error);
      // Fallback to basic pairs
      setCoins(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT']);
    } finally {
      setIsLoadingCoins(false);
    }
  };

  const addProcessLog = (message: string) => {
    setProcessLogs(prev => [...prev, message]);
  };

  const logError = (message: string, error: any, solution?: string) => {
    const errorMessage = `${message}: ${error?.message || 'Onbekende fout'}`;
    const fullMessage = solution ? `${errorMessage}: Oplossing: ${solution}` : errorMessage;
    
    console.error(fullMessage, error);
    setErrors(prev => [...prev, fullMessage]);
    addProcessLog(`❌ FOUT: ${errorMessage}`);
    
    // Auto-clear errors after 15 seconds
    setTimeout(() => {
      setErrors(prev => prev.filter(e => e !== fullMessage));
    }, 15000);
  };

  const updateConfig = (updates: Partial<StrategyConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleRiskProfileSelection = (profile: 'low' | 'medium' | 'high') => {
    addProcessLog(`🎯 Applying ${profile.toUpperCase()} risk profile...`);
    
    // Apply profile-specific settings
    const profileSettings = {
      low: {
        leverage: 5,
        stopLossPercentage: 1.5,
        takeProfitPercentage: 3.0,
        description: 'Conservative settings for maximum win rate'
      },
      medium: {
        leverage: 15,
        stopLossPercentage: 2.5,
        takeProfitPercentage: 5.0,
        description: 'Balanced approach between safety and returns'
      },
      high: {
        leverage: 25,
        stopLossPercentage: 4.0,
        takeProfitPercentage: 8.0,
        description: 'Aggressive settings for maximum ROI'
      }
    };

    const settings = profileSettings[profile];
    
    updateConfig({
      leverage: settings.leverage,
      marginType: 'Isolated', // Always isolated for safety
      stopLossSettings: {
        ...config.stopLossSettings,
        percentage: settings.stopLossPercentage
      },
      takeProfitSettings: {
        ...config.takeProfitSettings,
        tpSpacing: {
          ...config.takeProfitSettings.tpSpacing,
          fixedPercentage: settings.takeProfitPercentage
        }
      }
    });

    addProcessLog(`✅ ${profile.toUpperCase()} risk profile applied successfully`);
    addProcessLog(`📊 Leverage: ${settings.leverage}x (Isolated)`);
    addProcessLog(`🛡️ Stop Loss: ${settings.stopLossPercentage}%`);
    addProcessLog(`🎯 Take Profit: ${settings.takeProfitPercentage}%`);
    addProcessLog('🏁 Strategy configuration complete');
    
    setShowRiskProfiles(false);
    
    // Show success message
    setTimeout(() => {
      alert(`✅ ${profile.toUpperCase()} Risk Profiel toegepast!\n\n${settings.description}\n\nLeverage: ${settings.leverage}x (Isolated)\nStop Loss: ${settings.stopLossPercentage}%\nTake Profit: ${settings.takeProfitPercentage}%`);
    }, 500);
  };

  const showExampleStrategies = () => {
    setShowExampleStrategiesModal(true);
  };

  const applyExampleStrategy = (strategyType: string) => {
    setProcessLogs([]);
    addProcessLog(`🚀 Applying ${strategyType} strategy...`);
    
    const exampleStrategies: { [key: string]: any } = {
      'macd_supertrend_rsi': {
        name: 'MACD + SuperTrend + RSI Multi-Timeframe',
        signalIndicator: {
          type: 'macd',
          category: 'signal',
          timeframe: '15m',
          parameters: {
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9
          }
        },
        confirmingIndicators: [
          {
            type: 'supertrend',
            category: 'trend',
            timeframe: '1h',
            parameters: {
              period: 10,
              multiplier: 3
            },
            enabled: true
          },
          {
            type: 'rsi',
            category: 'signal',
            timeframe: '1h',
            parameters: {
              period: 14,
              overbought: 70,
              oversold: 30
            },
            enabled: true
          }
        ],
        leverage: 15,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 3
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 3,
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 2
          }
        }
      },
      'ema_bb_stoch': {
        name: 'EMA Crossover + Bollinger + Stochastic',
        signalIndicator: {
          type: 'ema',
          category: 'trend',
          timeframe: '5m',
          parameters: {
            period: 9
          }
        },
        confirmingIndicators: [
          {
            type: 'bollinger',
            category: 'trend',
            timeframe: '15m',
            parameters: {
              period: 20,
              std: 2
            },
            enabled: true
          },
          {
            type: 'stochastic',
            category: 'signal',
            timeframe: '30m',
            parameters: {
              kPeriod: 14,
              dPeriod: 3,
              smooth: 3
            },
            enabled: true
          }
        ],
        leverage: 10,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 2.5
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 2,
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 3
          }
        }
      },
      'rsi_macd': {
        name: 'RSI + MACD Dual Timeframe',
        signalIndicator: {
          type: 'rsi',
          category: 'signal',
          timeframe: '15m',
          parameters: {
            period: 14,
            overbought: 70,
            oversold: 30
          }
        },
        confirmingIndicators: [
          {
            type: 'macd',
            category: 'signal',
            timeframe: '1h',
            parameters: {
              fastPeriod: 12,
              slowPeriod: 26,
              signalPeriod: 9
            },
            enabled: true
          }
        ],
        leverage: 20,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 2
        },
        takeProfitSettings: {
          type: 'single',
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 5
          }
        }
      },
      'bb_rsi_volume': {
        name: 'Bollinger Bands + RSI + Volume',
        signalIndicator: {
          type: 'bollinger',
          category: 'trend',
          timeframe: '15m',
          parameters: {
            period: 20,
            std: 2.1
          }
        },
        confirmingIndicators: [
          {
            type: 'rsi',
            category: 'signal',
            timeframe: '30m',
            parameters: {
              period: 14,
              overbought: 75,
              oversold: 25
            },
            enabled: true
          },
          {
            type: 'volume',
            category: 'signal',
            timeframe: '1h',
            parameters: {
              period: 20
            },
            enabled: true
          }
        ],
        leverage: 12,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 2.8
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 2,
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 3.5
          }
        }
      },
      'adx_ema_stoch': {
        name: 'ADX + EMA + Stochastic Triple',
        signalIndicator: {
          type: 'adx',
          category: 'trend',
          timeframe: '30m',
          parameters: {
            period: 14,
            threshold: 25
          }
        },
        confirmingIndicators: [
          {
            type: 'ema',
            category: 'trend',
            timeframe: '1h',
            parameters: {
              period: 21
            },
            enabled: true
          },
          {
            type: 'stochastic',
            category: 'signal',
            timeframe: '2h',
            parameters: {
              kPeriod: 14,
              dPeriod: 3,
              smooth: 3
            },
            enabled: true
          }
        ],
        leverage: 18,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 3.2
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 3,
          tpSpacing: {
            type: 'percentage_multiplier',
            percentageMultiplier: 1.5
          }
        }
      },
      'psar_macd_rsi': {
        name: 'Parabolic SAR + MACD + RSI',
        signalIndicator: {
          type: 'psar',
          category: 'trend',
          timeframe: '5m',
          parameters: {
            start: 0.02,
            increment: 0.02,
            maximum: 0.2
          }
        },
        confirmingIndicators: [
          {
            type: 'macd',
            category: 'signal',
            timeframe: '15m',
            parameters: {
              fastPeriod: 12,
              slowPeriod: 26,
              signalPeriod: 9
            },
            enabled: true
          },
          {
            type: 'rsi',
            category: 'signal',
            timeframe: '30m',
            parameters: {
              period: 21,
              overbought: 70,
              oversold: 30
            },
            enabled: true
          }
        ],
        leverage: 22,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 2.5
        },
        takeProfitSettings: {
          type: 'single',
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 6
          }
        }
      },
      'vwap_bb_momentum': {
        name: 'VWAP + Bollinger + Momentum',
        signalIndicator: {
          type: 'vwap',
          category: 'trend',
          timeframe: '15m',
          parameters: {
            period: 20
          }
        },
        confirmingIndicators: [
          {
            type: 'bollinger',
            category: 'trend',
            timeframe: '1h',
            parameters: {
              period: 20,
              std: 2
            },
            enabled: true
          },
          {
            type: 'momentum',
            category: 'signal',
            timeframe: '4h',
            parameters: {
              period: 10
            },
            enabled: true
          }
        ],
        leverage: 8,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 4
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 2,
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 4
          }
        }
      },
      'ichimoku_rsi': {
        name: 'Ichimoku + RSI Dual Power',
        signalIndicator: {
          type: 'ichimoku',
          category: 'trend',
          timeframe: '1h',
          parameters: {
            tenkanSen: 9,
            kijunSen: 26,
            senkouB: 52
          }
        },
        confirmingIndicators: [
          {
            type: 'rsi',
            category: 'signal',
            timeframe: '4h',
            parameters: {
              period: 14,
              overbought: 65,
              oversold: 35
            },
            enabled: true
          }
        ],
        leverage: 14,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 3.5
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 4,
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 2.5
          }
        }
      },
      'williams_ema_volume': {
        name: 'Williams %R + EMA + Volume',
        signalIndicator: {
          type: 'williams',
          category: 'signal',
          timeframe: '5m',
          parameters: {
            period: 14,
            overbought: -20,
            oversold: -80
          }
        },
        confirmingIndicators: [
          {
            type: 'ema',
            category: 'trend',
            timeframe: '30m',
            parameters: {
              period: 50
            },
            enabled: true
          },
          {
            type: 'volume',
            category: 'signal',
            timeframe: '1h',
            parameters: {
              period: 20
            },
            enabled: true
          }
        ],
        leverage: 16,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 2.2
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 3,
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 2.8
          }
        }
      },
      'cci_sma_adx': {
        name: 'CCI + SMA + ADX Trend',
        signalIndicator: {
          type: 'cci',
          category: 'signal',
          timeframe: '15m',
          parameters: {
            period: 20,
            overbought: 100,
            oversold: -100
          }
        },
        confirmingIndicators: [
          {
            type: 'sma',
            category: 'trend',
            timeframe: '1h',
            parameters: {
              period: 200
            },
            enabled: true
          },
          {
            type: 'adx',
            category: 'trend',
            timeframe: '2h',
            parameters: {
              period: 14,
              threshold: 30
            },
            enabled: true
          }
        ],
        leverage: 11,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 3.8
        },
        takeProfitSettings: {
          type: 'single',
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 7
          }
        }
      },
      'roc_bb_stoch_vol': {
        name: 'ROC + Bollinger + Stochastic + Volume',
        signalIndicator: {
          type: 'roc',
          category: 'signal',
          timeframe: '30m',
          parameters: {
            period: 10
          }
        },
        confirmingIndicators: [
          {
            type: 'bollinger',
            category: 'trend',
            timeframe: '1h',
            parameters: {
              period: 20,
              std: 2.2
            },
            enabled: true
          },
          {
            type: 'stochastic',
            category: 'signal',
            timeframe: '2h',
            parameters: {
              kPeriod: 14,
              dPeriod: 3,
              smooth: 3
            },
            enabled: true
          },
          {
            type: 'volume',
            category: 'signal',
            timeframe: '4h',
            parameters: {
              period: 20
            },
            enabled: true
          }
        ],
        leverage: 13,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 3
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 3,
          tpSpacing: {
            type: 'percentage_multiplier',
            percentageMultiplier: 1.8
          }
        }
      },
      'supertrend_williams_ema': {
        name: 'SuperTrend + Williams %R + EMA',
        signalIndicator: {
          type: 'supertrend',
          category: 'trend',
          timeframe: '15m',
          parameters: {
            period: 10,
            multiplier: 3
          }
        },
        confirmingIndicators: [
          {
            type: 'williams',
            category: 'signal',
            timeframe: '30m',
            parameters: {
              period: 14,
              overbought: -10,
              oversold: -90
            },
            enabled: true
          },
          {
            type: 'ema',
            category: 'trend',
            timeframe: '1h',
            parameters: {
              period: 100
            },
            enabled: true
          }
        ],
        leverage: 19,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 2.7
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 2,
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 4.5
          }
        }
      },
      'macd_psar_volume': {
        name: 'MACD + Parabolic SAR + Volume',
        signalIndicator: {
          type: 'macd',
          category: 'signal',
          timeframe: '5m',
          parameters: {
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9
          }
        },
        confirmingIndicators: [
          {
            type: 'psar',
            category: 'trend',
            timeframe: '15m',
            parameters: {
              start: 0.02,
              increment: 0.02,
              maximum: 0.2
            },
            enabled: true
          },
          {
            type: 'volume',
            category: 'signal',
            timeframe: '30m',
            parameters: {
              period: 20
            },
            enabled: true
          }
        ],
        leverage: 17,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 2.3
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 4,
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 2
          }
        }
      },
      'sma_cross_rsi_cci': {
        name: 'SMA Crossover + RSI + CCI',
        signalIndicator: {
          type: 'sma',
          category: 'trend',
          timeframe: '15m',
          parameters: {
            period: 20
          }
        },
        confirmingIndicators: [
          {
            type: 'rsi',
            category: 'signal',
            timeframe: '30m',
            parameters: {
              period: 14,
              overbought: 75,
              oversold: 25
            },
            enabled: true
          },
          {
            type: 'cci',
            category: 'signal',
            timeframe: '1h',
            parameters: {
              period: 20,
              overbought: 150,
              oversold: -150
            },
            enabled: true
          }
        ],
        leverage: 9,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 4.2
        },
        takeProfitSettings: {
          type: 'single',
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 8
          }
        }
      },
      'vwap_adx_momentum': {
        name: 'VWAP + ADX + Momentum Combo',
        signalIndicator: {
          type: 'vwap',
          category: 'trend',
          timeframe: '30m',
          parameters: {
            period: 20
          }
        },
        confirmingIndicators: [
          {
            type: 'adx',
            category: 'trend',
            timeframe: '1h',
            parameters: {
              period: 14,
              threshold: 25
            },
            enabled: true
          },
          {
            type: 'momentum',
            category: 'signal',
            timeframe: '2h',
            parameters: {
              period: 14
            },
            enabled: true
          }
        ],
        leverage: 12,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 3.5
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 3,
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 3
          }
        }
      },
      'bb_squeeze_rsi_vol': {
        name: 'Bollinger Squeeze + RSI + Volume',
        signalIndicator: {
          type: 'bollinger',
          category: 'trend',
          timeframe: '5m',
          parameters: {
            period: 20,
            std: 1.8
          }
        },
        confirmingIndicators: [
          {
            type: 'rsi',
            category: 'signal',
            timeframe: '15m',
            parameters: {
              period: 21,
              overbought: 65,
              oversold: 35
            },
            enabled: true
          },
          {
            type: 'volume',
            category: 'signal',
            timeframe: '30m',
            parameters: {
              period: 20
            },
            enabled: true
          }
        ],
        leverage: 21,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 2
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 5,
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 1.8
          }
        }
      },
      'ema_ribbon_stoch': {
        name: 'EMA Ribbon + Stochastic',
        signalIndicator: {
          type: 'ema',
          category: 'trend',
          timeframe: '15m',
          parameters: {
            period: 8
          }
        },
        confirmingIndicators: [
          {
            type: 'stochastic',
            category: 'signal',
            timeframe: '1h',
            parameters: {
              kPeriod: 21,
              dPeriod: 3,
              smooth: 3
            },
            enabled: true
          }
        ],
        leverage: 25,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 1.8
        },
        takeProfitSettings: {
          type: 'single',
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 4.5
          }
        }
      },
      'ichimoku_macd_volume': {
        name: 'Ichimoku + MACD + Volume Pro',
        signalIndicator: {
          type: 'ichimoku',
          category: 'trend',
          timeframe: '30m',
          parameters: {
            tenkanSen: 9,
            kijunSen: 26,
            senkouB: 52
          }
        },
        confirmingIndicators: [
          {
            type: 'macd',
            category: 'signal',
            timeframe: '1h',
            parameters: {
              fastPeriod: 12,
              slowPeriod: 26,
              signalPeriod: 9
            },
            enabled: true
          },
          {
            type: 'volume',
            category: 'signal',
            timeframe: '2h',
            parameters: {
              period: 20
            },
            enabled: true
          }
        ],
        leverage: 10,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 4.5
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 2,
          tpSpacing: {
            type: 'percentage_multiplier',
            percentageMultiplier: 2
          }
        }
      },
      'williams_cci_psar': {
        name: 'Williams %R + CCI + Parabolic SAR',
        signalIndicator: {
          type: 'williams',
          category: 'signal',
          timeframe: '15m',
          parameters: {
            period: 14,
            overbought: -15,
            oversold: -85
          }
        },
        confirmingIndicators: [
          {
            type: 'cci',
            category: 'signal',
            timeframe: '30m',
            parameters: {
              period: 20,
              overbought: 120,
              oversold: -120
            },
            enabled: true
          },
          {
            type: 'psar',
            category: 'trend',
            timeframe: '1h',
            parameters: {
              start: 0.02,
              increment: 0.02,
              maximum: 0.2
            },
            enabled: true
          }
        ],
        leverage: 18,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 2.8
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 3,
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 3.2
          }
        }
      },
      'roc_vwap_adx': {
        name: 'ROC + VWAP + ADX Momentum',
        signalIndicator: {
          type: 'roc',
          category: 'signal',
          timeframe: '5m',
          parameters: {
            period: 12
          }
        },
        confirmingIndicators: [
          {
            type: 'vwap',
            category: 'trend',
            timeframe: '15m',
            parameters: {
              period: 20
            },
            enabled: true
          },
          {
            type: 'adx',
            category: 'trend',
            timeframe: '30m',
            parameters: {
              period: 14,
              threshold: 20
            },
            enabled: true
          }
        ],
        leverage: 15,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 3.3
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 4,
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 2.3
          }
        }
      },
      'supertrend_bb_rsi_vol': {
        name: 'SuperTrend + Bollinger + RSI + Volume',
        signalIndicator: {
          type: 'supertrend',
          category: 'trend',
          timeframe: '5m',
          parameters: {
            period: 10,
            multiplier: 2.8
          }
        },
        confirmingIndicators: [
          {
            type: 'bollinger',
            category: 'trend',
            timeframe: '15m',
            parameters: {
              period: 20,
              std: 2
            },
            enabled: true
          },
          {
            type: 'rsi',
            category: 'signal',
            timeframe: '30m',
            parameters: {
              period: 14,
              overbought: 70,
              oversold: 30
            },
            enabled: true
          },
          {
            type: 'volume',
            category: 'signal',
            timeframe: '1h',
            parameters: {
              period: 20
            },
            enabled: true
          }
        ],
        leverage: 14,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 3.8
        },
        takeProfitSettings: {
          type: 'multiple',
          numberOfTPs: 3,
          tpSpacing: {
            type: 'percentage_multiplier',
            percentageMultiplier: 1.6
          }
        }
      },
      'sma_momentum_stoch': {
        name: 'SMA + Momentum + Stochastic',
        signalIndicator: {
          type: 'sma',
          category: 'trend',
          timeframe: '30m',
          parameters: {
            period: 50
          }
        },
        confirmingIndicators: [
          {
            type: 'momentum',
            category: 'signal',
            timeframe: '1h',
            parameters: {
              period: 10
            },
            enabled: true
          },
          {
            type: 'stochastic',
            category: 'signal',
            timeframe: '2h',
            parameters: {
              kPeriod: 14,
              dPeriod: 3,
              smooth: 3
            },
            enabled: true
          }
        ],
        leverage: 7,
        stopLossSettings: {
          type: 'fixed_from_entry',
          percentage: 5
        },
        takeProfitSettings: {
          type: 'single',
          tpSpacing: {
            type: 'fixed_percentage',
            fixedPercentage: 10
          }
        }
      }
    };
    
    const strategy = exampleStrategies[strategyType];
    if (strategy) {
      updateConfig({
        signalSource: 'technical',
        signalIndicator: strategy.signalIndicator,
        confirmingIndicators: strategy.confirmingIndicators,
        leverage: strategy.leverage,
        stopLossSettings: {
          ...config.stopLossSettings,
          ...strategy.stopLossSettings
        },
        takeProfitSettings: {
          ...config.takeProfitSettings,
          ...strategy.takeProfitSettings
        }
      });
      
      addProcessLog(`✅ Applied ${strategy.name}`);
      addProcessLog(`📊 Signal: ${strategy.signalIndicator.type.toUpperCase()} on ${strategy.signalIndicator.timeframe}`);
      strategy.confirmingIndicators.forEach((ind: any, idx: number) => {
        addProcessLog(`📈 Confirm ${idx + 1}: ${ind.type.toUpperCase()} on ${ind.timeframe}`);
      });
      addProcessLog(`💪 Leverage: ${strategy.leverage}x`);
      addProcessLog(`🛡️ Stop Loss: ${strategy.stopLossSettings.percentage}%`);
      addProcessLog('✨ Strategy configuration complete!');
      
      setShowExampleStrategiesModal(false);
    }
  };

  const saveStrategy = () => {
    try {
      // Validation
      if (!config.accountId || !config.coinPair || (!config.signalIndicator?.type && config.signalSource === 'technical')) {
        alert('❌ Vul alle verplichte velden in voordat je de strategie opslaat.');
        return;
      }

      // Generate unique ID
      const strategyId = `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create strategy object
      const strategy = {
        id: strategyId,
        name: config.name,
        coinPair: config.coinPair,
        config: config,
        created: new Date().toISOString(),
        backtest_results: optimizationResults || {
          win_rate: 0,
          total_trades: 0,
          max_drawdown: 0,
          total_pnl: 0,
          sharpe_ratio: 0
        }
      };

      // Save to localStorage
      const existingStrategies = JSON.parse(localStorage.getItem('savedStrategies') || '[]');
      existingStrategies.push(strategy);
      localStorage.setItem('savedStrategies', JSON.stringify(existingStrategies));

      // Show success message
      addProcessLog(`✅ Strategy "${config.name}" saved successfully!`);
      addProcessLog(`📝 Strategy ID: ${strategyId}`);
      addProcessLog(`💾 Saved to local storage for import into Auto Trading Engine`);
      
      alert(`✅ Strategie "${config.name}" succesvol opgeslagen!\n\n📋 Details:\n• Trading Pair: ${config.coinPair}\n• Signal: ${config.signalIndicator?.type?.toUpperCase() || 'ML'} (${config.signalIndicator?.timeframe})\n• Confirming: ${config.confirmingIndicators.filter(ind => ind.enabled).length} indicators\n• Leverage: ${config.leverage}x\n\n🎯 Je kunt deze strategie nu importeren in de Auto Trading Engine!`);
      
      setShowProcessLog(true);
      
    } catch (error) {
      logError('Failed to save strategy', error);
      alert('❌ Fout bij het opslaan van de strategie. Probeer het opnieuw.');
    }
  };

  const exportStrategy = () => {
    try {
      // Validation
      if (!config.name || config.name.trim() === '') {
        alert('❌ Geef eerst een naam voor de strategie.');
        return;
      }

      const strategy = {
        id: `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: config.name,
        coinPair: config.coinPair,
        config: config,
        created: new Date().toISOString(),
        backtest_results: optimizationResults || {
          win_rate: 0,
          total_trades: 0,
          max_drawdown: 0,
          total_pnl: 0,
          sharpe_ratio: 0
        }
      };

      const dataStr = JSON.stringify(strategy, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const exportFileDefaultName = `strategy_${config.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.href = url;
      linkElement.download = exportFileDefaultName;
      document.body.appendChild(linkElement);
      linkElement.click();
      document.body.removeChild(linkElement);
      URL.revokeObjectURL(url);
      
      addProcessLog(`✅ Strategy "${config.name}" exported successfully!`);
      addProcessLog(`📁 File: ${exportFileDefaultName}`);
      alert(`✅ Strategie "${config.name}" geëxporteerd als JSON bestand!`);
      setShowProcessLog(true);
      
    } catch (error) {
      console.error('Export error:', error);
      logError('Failed to export strategy', error);
      alert('❌ Fout bij het exporteren van de strategie. Probeer het opnieuw.');
    }
  };

  const importStrategy = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Import strategy triggered');
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('Selected file:', file.name, file.type, file.size);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        console.log('File loaded, parsing JSON...');
        const result = e.target?.result as string;
        const importedStrategy = JSON.parse(result);
        
        console.log('Parsed strategy:', importedStrategy);
        
        // Validate imported strategy structure
        if (!importedStrategy.config || !importedStrategy.name) {
          console.error('Invalid strategy structure:', importedStrategy);
          alert('❌ Ongeldig strategie bestand. Controleer het bestandsformaat.');
          return;
        }
        
        console.log('Loading strategy configuration...');
        // Load the strategy configuration
        setConfig(importedStrategy.config);
        
        // Update optimization results if available
        if (importedStrategy.backtest_results) {
          console.log('Loading backtest results...');
          setOptimizationResults(importedStrategy.backtest_results);
        }
        
        addProcessLog(`✅ Strategy "${importedStrategy.name}" imported successfully!`);
        addProcessLog(`📝 Strategy ID: ${importedStrategy.id}`);
        addProcessLog(`📊 Backtest Results: ${importedStrategy.backtest_results ? 'Included' : 'Not available'}`);
        
        alert(`✅ Strategie "${importedStrategy.name}" succesvol geïmporteerd!\n\n📋 Details:\n• Trading Pair: ${importedStrategy.config.coinPair}\n• Signal: ${importedStrategy.config.signalIndicator?.type?.toUpperCase() || 'ML'}\n• Leverage: ${importedStrategy.config.leverage}x\n\n🎯 De strategie is nu geladen en klaar voor gebruik!`);
        
        setShowProcessLog(true);
        
      } catch (error) {
        console.error('Import error:', error);
        logError('Failed to import strategy', error);
        alert('❌ Fout bij het importeren van de strategie. Controleer of het bestand geldig is.');
      }
    };
    
    reader.readAsText(file);
    
    // Reset the input value so the same file can be selected again
    event.target.value = '';
  };

  const optimizeStrategy = async () => {
    setIsOptimizing(true);
    setShowProcessLog(true);
    setProcessLogs([]); // Clear previous logs
    
    try {
      // Validation checks with detailed error handling
      addProcessLog('🔄 Starting AI optimization process...');
      
      if (!config.accountId) {
        throw new Error('Geen account geselecteerd: Selecteer eerst een account om de strategie voor te bouwen');
      }
      
      if (!config.coinPair) {
        throw new Error('Geen trading pair geselecteerd: Kies een cryptocurrency trading pair');
      }
      
      if (config.signalSource === 'technical' && !config.signalIndicator?.type) {
        throw new Error('Geen technische indicator geselecteerd: Kies een indicator voor signaal generatie');
      }
      
      if (config.signalSource === 'ml' && !config.mlModel?.type) {
        throw new Error('Geen ML model geselecteerd: Kies een machine learning model');
      }
      
      addProcessLog(`✅ Account: ${config.accountName}`);
      addProcessLog(`✅ Trading Pair: ${config.coinPair}`);
      addProcessLog(`✅ Strategy Type: ${config.signalSource === 'ml' ? 'Machine Learning' : 'Technical Analysis'}`);
      addProcessLog(`📅 Backtest Periode: ${backtestPeriod === '3m' ? '3 Maanden' : backtestPeriod === '6m' ? '6 Maanden' : backtestPeriod === '12m' ? '12 Maanden' : backtestPeriod === '24m' ? '2 Jaar' : '3 Jaar'}`);
      
      // Validate position size
      if (config.amountType === 'percentage' && (config.percentageAmount <= 0 || config.percentageAmount > 100)) {
        throw new Error('Ongeldige percentage instelling: Percentage moet tussen 0.1% en 100% zijn');
      }
      
      if (config.amountType === 'fixed' && config.fixedAmount <= 0) {
        throw new Error('Ongeldig vast bedrag: Bedrag moet groter zijn dan 0 USDT');
      }
      
      addProcessLog(`✅ Position Size: ${config.amountType === 'fixed' ? `${config.fixedAmount} USDT` : `${config.percentageAmount}%`}`);
      addProcessLog(`✅ Leverage: ${config.leverage}x ${config.marginType}`);
      
      // Validate entry settings
      if (config.entrySettings.type === 'multiple' && (config.entrySettings.numberOfEntries < 2 || config.entrySettings.numberOfEntries > 10)) {
        throw new Error('Ongeldig aantal entries: Moet tussen 2 en 10 entries zijn bij multiple entry');
      }
      
      addProcessLog(`✅ Entry Strategy: ${config.entrySettings.type === 'single' ? 'Single Entry' : `${config.entrySettings.numberOfEntries} Multiple Entries`}`);
      
      // Validate TP settings
      if (config.takeProfitSettings.type === 'multiple' && (config.takeProfitSettings.numberOfTPs < 2 || config.takeProfitSettings.numberOfTPs > 10)) {
        throw new Error('Ongeldig aantal take profits: Moet tussen 2 en 10 TPs zijn bij multiple TP');
      }
      
      addProcessLog(`✅ Take Profit Strategy: ${config.takeProfitSettings.type === 'single' ? 'Single TP' : `${config.takeProfitSettings.numberOfTPs} Multiple TPs`}`);
      
      // Validate stop loss
      if (config.stopLossSettings.percentage <= 0 || config.stopLossSettings.percentage > 50) {
        throw new Error('Ongeldige stop loss percentage: Moet tussen 0.1% en 50% zijn');
      }
      
      addProcessLog(`✅ Stop Loss: ${config.stopLossSettings.percentage}% (${config.stopLossSettings.type})`);
      
      addProcessLog('🔄 Preparing comprehensive optimization data...');
      
      // Prepare detailed optimization request
      const optimizationData = {
        account: {
          id: config.accountId,
          name: config.accountName
        },
        coin: config.coinPair,
        timeframe: config.signalSource === 'technical' ? config.signalIndicator?.timeframe : '15m',
        lookbackPeriod: backtestPeriod,
        strategy: {
          name: config.name,
          type: config.signalSource,
          signalSource: config.signalSource,
          signalIndicator: config.signalIndicator,
          mlModel: config.mlModel,
          confirmingIndicators: config.confirmingIndicators.filter(ind => ind.enabled)
        },
        position: {
          amountType: config.amountType,
          fixedAmount: config.fixedAmount,
          percentageAmount: config.percentageAmount,
          marginType: config.marginType,
          leverage: config.leverage
        },
        entryManagement: config.entrySettings,
        takeProfitManagement: config.takeProfitSettings,
        stopLossManagement: config.stopLossSettings
      };

      addProcessLog('🤖 Sending optimization request to AI...');
      addProcessLog(`📊 Testing ${config.signalSource === 'technical' ? 'technical indicators' : 'ML models'} with all parameters...`);
      
      // Detailed optimization process including confirmng indicators
      const steps = [
        'Analyzing historical data patterns...',
        'Testing primary indicator combinations...',
        'Evaluating 2nd indicator compatibility with MACD...',
        'Analyzing 3rd indicator synergy with coin volatility...',
        `Optimizing indicator parameters for ${config.coinPair}...`,
        `Testing timeframe correlations (${config.signalIndicator?.timeframe})...`,
        'Backtesting entry/exit combinations...',
        'Calibrating stop loss & take profit levels...',
        'Calculating risk-adjusted returns...',
        'Validating liquidation resistance...',
        'Generating comprehensive performance report...'
      ];
      
      for (const step of steps) {
        addProcessLog(`🔄 ${step}`);
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate processing time
      }

      const response = await openaiApi.optimizeIndicators(optimizationData);
      
      if (response.success) {
        addProcessLog('✅ AI optimization completed successfully!');
        addProcessLog('📊 Generating optimization report...');
        addProcessLog('⚡ Analyzing performance improvements...');
        addProcessLog('🎯 Creating detailed analysis...');
        
        // Store optimization results
        setOptimizationResults(response.data);
        
        addProcessLog('✅ Optimization report generated');
        addProcessLog('📋 Showing detailed report...');
        
        // Show optimization report first
        setShowOptimizationReport(true);
      } else {
        throw new Error(response.error || 'AI optimization failed');
      }
    } catch (error: any) {
      addProcessLog(`❌ Optimization failed: ${error.message}`);
      logError('Strategie optimalisatie gefaald', error, 'Controleer je API verbinding en parameter instellingen');
    } finally {
      setIsOptimizing(false);
      addProcessLog('🏁 Optimization process completed');
    }
  };

  const renderAccountSelection = () => (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
      <h3 className="text-white font-medium mb-4">Account & Basic Settings</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Select Account</label>
          <select
            value={config.accountId}
            onChange={(e) => {
              const account = accounts.find(a => a.id === e.target.value);
              if (account) {
                updateConfig({
                  accountId: account.id,
                  accountName: account.name
                });
              }
            }}
            className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
          >
            <option value="">Select an account...</option>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.name} (Available: ${account.balance.available.toFixed(2)})
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Trading Pair</label>
          <select
            value={config.coinPair}
            onChange={(e) => updateConfig({ coinPair: e.target.value })}
            className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            disabled={isLoadingCoins}
          >
            {isLoadingCoins ? (
              <option>Loading coins...</option>
            ) : (
              coins.map(coin => (
                <option key={coin} value={coin}>{coin}</option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-gray-300 text-sm font-medium mb-2">Strategy Name (Auto-generated)</label>
        <input
          type="text"
          value={config.name}
          readOnly
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-400"
        />
      </div>
    </div>
  );

  const renderPositionSettings = () => (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
      <h3 className="text-white font-medium mb-4">Position Settings</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Amount Type</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="percentage"
                checked={config.amountType === 'percentage'}
                onChange={(e) => updateConfig({ amountType: 'percentage' })}
                className="mr-2"
              />
              <span className="text-gray-300">Percentage</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="fixed"
                checked={config.amountType === 'fixed'}
                onChange={(e) => updateConfig({ amountType: 'fixed' })}
                className="mr-2"
              />
              <span className="text-gray-300">Fixed Amount</span>
            </label>
          </div>
        </div>
        
        <div>
          {config.amountType === 'percentage' ? (
            <>
              <label className="block text-gray-300 text-sm font-medium mb-2">Percentage of Balance (%)</label>
              <input
                type="number"
                value={config.percentageAmount}
                onChange={(e) => updateConfig({ percentageAmount: Number(e.target.value) })}
                min="0.1"
                max="100"
                step="0.1"
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
              />
            </>
          ) : (
            <>
              <label className="block text-gray-300 text-sm font-medium mb-2">Fixed Amount (USDT)</label>
              <input
                type="number"
                value={config.fixedAmount}
                onChange={(e) => updateConfig({ fixedAmount: Number(e.target.value) })}
                min="10"
                step="10"
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
              />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Margin Type</label>
          <div className="relative">
            <input
              type="text"
              value="Isolated (Veiligheidsvoorkeur)"
              readOnly
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-green-400">🔒</span>
            </div>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Isolated margin voorkomt liquidatie van andere posities
          </div>
        </div>
        
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Leverage: {config.leverage}x (AI Geoptimaliseerd)
          </label>
          <input
            type="range"
            value={config.leverage}
            onChange={(e) => updateConfig({ leverage: Number(e.target.value) })}
            min="1"
            max="50"
            step="1"
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1x (Veilig)</span>
            <span>25x (Gebalanceerd)</span>
            <span>50x (Risicovol)</span>
          </div>
          <div className="mt-2 text-xs text-yellow-400 bg-yellow-400/10 p-2 rounded">
            ⚠️ AI zal leverage aanpassen op basis van liquidatierisico (doel: 0 liquidaties)
          </div>
        </div>
      </div>
    </div>
  );

  const renderSignalIndicator = () => {
    const allIndicators = [...TREND_INDICATORS, ...SIGNAL_INDICATORS];
    const selectedIndicator = allIndicators.find(ind => ind.id === config.signalIndicator?.type);
    
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="text-white font-medium mb-4">Signal Indicator (Primary)</h3>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Indicator Type</label>
            <select
              value={config.signalIndicator?.type || ''}
              onChange={(e) => {
                const indicator = allIndicators.find(ind => ind.id === e.target.value);
                if (indicator) {
                  updateConfig({
                    signalIndicator: {
                      type: indicator.id,
                      category: TREND_INDICATORS.includes(indicator) ? 'trend' : 'signal',
                      timeframe: config.signalIndicator?.timeframe || '15m',
                      parameters: getDefaultParameters(indicator.id)
                    }
                  });
                }
              }}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            >
              <optgroup label="Trend Indicators">
                {TREND_INDICATORS.map(ind => (
                  <option key={ind.id} value={ind.id}>{ind.name}</option>
                ))}
              </optgroup>
              <optgroup label="Signal Indicators">
                {SIGNAL_INDICATORS.map(ind => (
                  <option key={ind.id} value={ind.id}>{ind.name}</option>
                ))}
              </optgroup>
            </select>
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Timeframe</label>
            <select
              value={config.signalIndicator?.timeframe || ''}
              onChange={(e) => updateConfig({
                signalIndicator: {
                  ...config.signalIndicator!,
                  timeframe: e.target.value
                }
              })}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
            >
              {TIMEFRAMES.map(tf => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Category</label>
            <input
              type="text"
              value={config.signalIndicator?.category === 'trend' ? 'Trend Indicator' : 'Signal Indicator'}
              readOnly
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-400"
            />
          </div>
        </div>

        {/* Dynamic Parameters */}
        {selectedIndicator && selectedIndicator.params.length > 0 && (
          <div>
            <h4 className="text-gray-300 text-sm font-medium mb-2">Parameters</h4>
            <div className="grid grid-cols-3 gap-4">
              {selectedIndicator.params.map(param => (
                <div key={param}>
                  <label className="block text-gray-400 text-xs mb-1 capitalize">{param.replace('_', ' ')}</label>
                  <input
                    type="number"
                    value={config.signalIndicator?.parameters?.[param] || getDefaultParameters(selectedIndicator.id)[param] || ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? '' : Number(e.target.value);
                      updateConfig({
                        signalIndicator: {
                          ...config.signalIndicator!,
                          parameters: {
                            ...config.signalIndicator!.parameters,
                            [param]: value
                          }
                        }
                      });
                    }}
                    step={param.includes('period') ? '1' : '0.01'}
                    min={param.includes('period') ? '1' : '0.01'}
                    placeholder={`Default: ${getDefaultParameters(selectedIndicator.id)[param] || 'N/A'}`}
                    className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Tip: Laat leeg voor standaard waarden. AI zal deze parameters optimaliseren.
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMLSignal = () => (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
      <h3 className="text-white font-medium mb-4">🤖 Machine Learning Signal (Primary)</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">ML Model Type</label>
          <div className="grid grid-cols-2 gap-4">
            {[
              { id: 'lstm', name: 'LSTM Neural Network', desc: 'Deep learning for price prediction' },
              { id: 'randomForest', name: 'Random Forest', desc: 'Ensemble method for trend detection' },
              { id: 'svm', name: 'Support Vector Machine', desc: 'Pattern recognition classifier' },
              { id: 'neuralNetwork', name: 'Deep Neural Network', desc: 'Multi-layer complex patterns' }
            ].map(model => (
              <div
                key={model.id}
                onClick={() => updateConfig({
                  mlModel: {
                    ...config.mlModel!,
                    type: model.id as any
                  }
                })}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  config.mlModel?.type === model.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <h4 className="text-white font-medium">{model.name}</h4>
                <p className="text-gray-400 text-sm">{model.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Confidence Threshold: {((config.mlModel?.confidence || 0.7) * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0.5"
            max="0.95"
            step="0.05"
            value={config.mlModel?.confidence || 0.7}
            onChange={(e) => updateConfig({
              mlModel: {
                ...config.mlModel!,
                confidence: parseFloat(e.target.value)
              }
            })}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">ML Features</label>
          <div className="grid grid-cols-3 gap-4">
            {['price', 'volume', 'volatility', 'momentum', 'sentiment', 'orderflow'].map(feature => (
              <label key={feature} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config.mlModel?.features.includes(feature) || false}
                  onChange={(e) => {
                    const features = config.mlModel?.features || [];
                    const updated = e.target.checked
                      ? [...features, feature]
                      : features.filter(f => f !== feature);
                    updateConfig({
                      mlModel: {
                        ...config.mlModel!,
                        features: updated
                      }
                    });
                  }}
                  className="w-4 h-4"
                />
                <span className="text-gray-300 capitalize">{feature}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderEntryManagement = () => (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
      <h3 className="text-white font-medium mb-4">Entry Management</h3>
      
      <div className="space-y-4">
        {/* Entry Type */}
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Entry Type</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="single"
                checked={config.entrySettings.type === 'single'}
                onChange={() => updateConfig({
                  entrySettings: { ...config.entrySettings, type: 'single', numberOfEntries: 1 }
                })}
                className="mr-2"
              />
              <span className="text-gray-300">Single Entry</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="multiple"
                checked={config.entrySettings.type === 'multiple'}
                onChange={() => updateConfig({
                  entrySettings: { ...config.entrySettings, type: 'multiple' }
                })}
                className="mr-2"
              />
              <span className="text-gray-300">Multiple Entries</span>
            </label>
          </div>
        </div>

        {config.entrySettings.type === 'multiple' && (
          <>
            {/* Number of Entries */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Number of Entries: {config.entrySettings.numberOfEntries}
              </label>
              <input
                type="range"
                min="2"
                max="10"
                value={config.entrySettings.numberOfEntries}
                onChange={(e) => updateConfig({
                  entrySettings: {
                    ...config.entrySettings,
                    numberOfEntries: Number(e.target.value)
                  }
                })}
                className="w-full"
              />
            </div>

            {/* Entry Spacing */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Entry Spacing</label>
              <select
                value={config.entrySettings.entrySpacing.type}
                onChange={(e) => updateConfig({
                  entrySettings: {
                    ...config.entrySettings,
                    entrySpacing: {
                      ...config.entrySettings.entrySpacing,
                      type: e.target.value as any
                    }
                  }
                })}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white mb-2"
              >
                <option value="fixed_percentage">Fixed Percentage</option>
                <option value="percentage_multiplier">Percentage with Multiplier</option>
                <option value="manual">Manual Spacing</option>
              </select>

              {config.entrySettings.entrySpacing.type === 'fixed_percentage' && (
                <input
                  type="number"
                  value={config.entrySettings.entrySpacing.fixedPercentage}
                  onChange={(e) => updateConfig({
                    entrySettings: {
                      ...config.entrySettings,
                      entrySpacing: {
                        ...config.entrySettings.entrySpacing,
                        fixedPercentage: Number(e.target.value)
                      }
                    }
                  })}
                  min="0.1"
                  step="0.1"
                  placeholder="Percentage between entries"
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
                />
              )}

              {config.entrySettings.entrySpacing.type === 'percentage_multiplier' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={config.entrySettings.entrySpacing.fixedPercentage}
                    onChange={(e) => updateConfig({
                      entrySettings: {
                        ...config.entrySettings,
                        entrySpacing: {
                          ...config.entrySettings.entrySpacing,
                          fixedPercentage: Number(e.target.value)
                        }
                      }
                    })}
                    min="0.1"
                    step="0.1"
                    placeholder="Base %"
                    className="p-2 bg-gray-800 border border-gray-600 rounded text-white"
                  />
                  <input
                    type="number"
                    value={config.entrySettings.entrySpacing.percentageMultiplier}
                    onChange={(e) => updateConfig({
                      entrySettings: {
                        ...config.entrySettings,
                        entrySpacing: {
                          ...config.entrySettings.entrySpacing,
                          percentageMultiplier: Number(e.target.value)
                        }
                      }
                    })}
                    min="1"
                    step="0.1"
                    placeholder="Multiplier"
                    className="p-2 bg-gray-800 border border-gray-600 rounded text-white"
                  />
                </div>
              )}
            </div>

            {/* Entry Amounts */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Entry Amount Distribution</label>
              <select
                value={config.entrySettings.entryAmounts.type}
                onChange={(e) => updateConfig({
                  entrySettings: {
                    ...config.entrySettings,
                    entryAmounts: {
                      ...config.entrySettings.entryAmounts,
                      type: e.target.value as 'evenly' | 'manual'
                    }
                  }
                })}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
              >
                <option value="evenly">Evenly Divided</option>
                <option value="manual">Manual Distribution</option>
              </select>
            </div>
          </>
        )}

        {/* Trailing Entry */}
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.entrySettings.trailingEntry.enabled}
              onChange={(e) => updateConfig({
                entrySettings: {
                  ...config.entrySettings,
                  trailingEntry: {
                    ...config.entrySettings.trailingEntry,
                    enabled: e.target.checked
                  }
                }
              })}
              className="w-4 h-4"
            />
            <span className="text-gray-300">Enable Trailing Entry</span>
          </label>
          
          {config.entrySettings.trailingEntry.enabled && (
            <div className="mt-2">
              <label className="block text-gray-300 text-sm mb-1">
                Trailing Distance: {config.entrySettings.trailingEntry.percentage}% 
                × {config.leverage}x = {(config.entrySettings.trailingEntry.percentage * config.leverage).toFixed(1)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={config.entrySettings.trailingEntry.percentage}
                onChange={(e) => updateConfig({
                  entrySettings: {
                    ...config.entrySettings,
                    trailingEntry: {
                      ...config.entrySettings.trailingEntry,
                      percentage: Number(e.target.value)
                    }
                  }
                })}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTakeProfitManagement = () => (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
      <h3 className="text-white font-medium mb-4">Take Profit Management</h3>
      
      <div className="space-y-4">
        {/* TP Type */}
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Take Profit Type</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="single"
                checked={config.takeProfitSettings.type === 'single'}
                onChange={() => updateConfig({
                  takeProfitSettings: { ...config.takeProfitSettings, type: 'single', numberOfTPs: 1 }
                })}
                className="mr-2"
              />
              <span className="text-gray-300">Single TP</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="multiple"
                checked={config.takeProfitSettings.type === 'multiple'}
                onChange={() => updateConfig({
                  takeProfitSettings: { ...config.takeProfitSettings, type: 'multiple' }
                })}
                className="mr-2"
              />
              <span className="text-gray-300">Multiple TPs</span>
            </label>
          </div>
        </div>

        {config.takeProfitSettings.type === 'multiple' && (
          <>
            {/* Number of TPs */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Number of Take Profits: {config.takeProfitSettings.numberOfTPs}
              </label>
              <input
                type="range"
                min="2"
                max="10"
                value={config.takeProfitSettings.numberOfTPs}
                onChange={(e) => updateConfig({
                  takeProfitSettings: {
                    ...config.takeProfitSettings,
                    numberOfTPs: Number(e.target.value)
                  }
                })}
                className="w-full"
              />
            </div>

            {/* TP Spacing */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">TP Spacing</label>
              <select
                value={config.takeProfitSettings.tpSpacing.type}
                onChange={(e) => updateConfig({
                  takeProfitSettings: {
                    ...config.takeProfitSettings,
                    tpSpacing: {
                      ...config.takeProfitSettings.tpSpacing,
                      type: e.target.value as any
                    }
                  }
                })}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white mb-2"
              >
                <option value="fixed_percentage">Fixed Percentage</option>
                <option value="percentage_multiplier">Percentage with Multiplier</option>
                <option value="manual">Manual Spacing</option>
              </select>

              {config.takeProfitSettings.tpSpacing.type === 'fixed_percentage' && (
                <div className="space-y-2">
                  <input
                    type="number"
                    value={config.takeProfitSettings.tpSpacing.fixedPercentage}
                    onChange={(e) => updateConfig({
                      takeProfitSettings: {
                        ...config.takeProfitSettings,
                        tpSpacing: {
                          ...config.takeProfitSettings.tpSpacing,
                          fixedPercentage: Number(e.target.value)
                        }
                      }
                    })}
                    min="0.1"
                    step="0.1"
                    placeholder="Percentage tussen TPs"
                    className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
                  />
                  <div className="text-xs text-gray-400">
                    Voorbeeld: 2% = TP1 op +2%, TP2 op +4%, TP3 op +6%
                  </div>
                </div>
              )}

              {config.takeProfitSettings.tpSpacing.type === 'percentage_multiplier' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="number"
                      value={config.takeProfitSettings.tpSpacing.fixedPercentage}
                      onChange={(e) => updateConfig({
                        takeProfitSettings: {
                          ...config.takeProfitSettings,
                          tpSpacing: {
                            ...config.takeProfitSettings.tpSpacing,
                            fixedPercentage: Number(e.target.value)
                          }
                        }
                      })}
                      min="0.1"
                      step="0.1"
                      placeholder="Start %"
                      className="p-2 bg-gray-800 border border-gray-600 rounded text-white"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={config.takeProfitSettings.tpSpacing.percentageMultiplier}
                      onChange={(e) => updateConfig({
                        takeProfitSettings: {
                          ...config.takeProfitSettings,
                          tpSpacing: {
                            ...config.takeProfitSettings.tpSpacing,
                            percentageMultiplier: Number(e.target.value)
                          }
                        }
                      })}
                      min="1"
                      step="0.1"
                      placeholder="Multiplier"
                      className="p-2 bg-gray-800 border border-gray-600 rounded text-white"
                    />
                  </div>
                  <div className="col-span-2 text-xs text-gray-400">
                    Voorbeeld: 2% × 1.5 = TP1: +2%, TP2: +3%, TP3: +4.5%
                  </div>
                </div>
              )}

              {config.takeProfitSettings.tpSpacing.type === 'manual' && (
                <div className="space-y-2">
                  <label className="block text-gray-400 text-xs">Percentages per TP (komma gescheiden)</label>
                  <input
                    type="text"
                    placeholder="2.5, 5.0, 8.5, 12.0"
                    value={config.takeProfitSettings.tpSpacing.manualSpacing.join(', ')}
                    onChange={(e) => {
                      const percentages = e.target.value.split(',').map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
                      updateConfig({
                        takeProfitSettings: {
                          ...config.takeProfitSettings,
                          tpSpacing: {
                            ...config.takeProfitSettings.tpSpacing,
                            manualSpacing: percentages
                          }
                        }
                      });
                    }}
                    className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
                  />
                  <div className="text-xs text-gray-400">
                    Voer de gewenste percentage niveaus in, gescheiden door komma's
                  </div>
                </div>
              )}
            </div>

            {/* TP Amounts */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">TP Amount Distribution</label>
              <select
                value={config.takeProfitSettings.tpAmounts.type}
                onChange={(e) => updateConfig({
                  takeProfitSettings: {
                    ...config.takeProfitSettings,
                    tpAmounts: {
                      ...config.takeProfitSettings.tpAmounts,
                      type: e.target.value as 'evenly' | 'manual'
                    }
                  }
                })}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
              >
                <option value="evenly">Evenly Divided</option>
                <option value="manual">Manual Distribution</option>
              </select>
            </div>
          </>
        )}

        {/* Trailing TP */}
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.takeProfitSettings.trailingTP.enabled}
              onChange={(e) => updateConfig({
                takeProfitSettings: {
                  ...config.takeProfitSettings,
                  trailingTP: {
                    ...config.takeProfitSettings.trailingTP,
                    enabled: e.target.checked
                  }
                }
              })}
              className="w-4 h-4"
            />
            <span className="text-gray-300">Enable Trailing Take Profit</span>
          </label>
          
          {config.takeProfitSettings.trailingTP.enabled && (
            <div className="mt-2">
              <label className="block text-gray-300 text-sm mb-1">
                Trailing Distance: {config.takeProfitSettings.trailingTP.percentage}% 
                × {config.leverage}x = {(config.takeProfitSettings.trailingTP.percentage * config.leverage).toFixed(1)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={config.takeProfitSettings.trailingTP.percentage}
                onChange={(e) => updateConfig({
                  takeProfitSettings: {
                    ...config.takeProfitSettings,
                    trailingTP: {
                      ...config.takeProfitSettings.trailingTP,
                      percentage: Number(e.target.value)
                    }
                  }
                })}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStopLossManagement = () => (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
      <h3 className="text-white font-medium mb-4">Stop Loss Management</h3>
      
      <div className="space-y-4">
        {/* SL Type */}
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Stop Loss Type</label>
          <select
            value={config.stopLossSettings.type}
            onChange={(e) => updateConfig({
              stopLossSettings: {
                ...config.stopLossSettings,
                type: e.target.value as 'fixed_from_entry' | 'fixed_from_average'
              }
            })}
            className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
          >
            <option value="fixed_from_entry">Fixed from First Entry</option>
            <option value="fixed_from_average">Fixed from Average Entry</option>
          </select>
        </div>

        {/* SL Percentage */}
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Stop Loss Distance: {config.stopLossSettings.percentage}%
          </label>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.1"
            value={config.stopLossSettings.percentage}
            onChange={(e) => updateConfig({
              stopLossSettings: {
                ...config.stopLossSettings,
                percentage: Number(e.target.value)
              }
            })}
            className="w-full"
          />
        </div>

        {/* Trailing Stop Loss */}
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.stopLossSettings.trailingStopLoss.enabled}
              onChange={(e) => updateConfig({
                stopLossSettings: {
                  ...config.stopLossSettings,
                  trailingStopLoss: {
                    ...config.stopLossSettings.trailingStopLoss,
                    enabled: e.target.checked
                  }
                }
              })}
              className="w-4 h-4"
            />
            <span className="text-gray-300">Enable Trailing Stop Loss</span>
          </label>
          
          {config.stopLossSettings.trailingStopLoss.enabled && (
            <div className="mt-2">
              <label className="block text-gray-300 text-sm mb-1">Activate After</label>
              <select
                value={config.stopLossSettings.trailingStopLoss.activationLevel}
                onChange={(e) => updateConfig({
                  stopLossSettings: {
                    ...config.stopLossSettings,
                    trailingStopLoss: {
                      ...config.stopLossSettings.trailingStopLoss,
                      activationLevel: e.target.value as 'tp1' | 'tp2' | 'percentage'
                    }
                  }
                })}
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
              >
                <option value="tp1">Take Profit 1</option>
                <option value="tp2">Take Profit 2</option>
                <option value="percentage">Percentage Gain</option>
              </select>
            </div>
          )}
        </div>

        {/* Breakeven */}
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.stopLossSettings.breakeven.enabled}
              onChange={(e) => updateConfig({
                stopLossSettings: {
                  ...config.stopLossSettings,
                  breakeven: {
                    ...config.stopLossSettings.breakeven,
                    enabled: e.target.checked
                  }
                }
              })}
              className="w-4 h-4"
            />
            <span className="text-gray-300">Move to Breakeven</span>
          </label>
          
          {config.stopLossSettings.breakeven.enabled && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-300 text-xs mb-1">Move To</label>
                <select
                  value={config.stopLossSettings.breakeven.moveTo}
                  onChange={(e) => updateConfig({
                    stopLossSettings: {
                      ...config.stopLossSettings,
                      breakeven: {
                        ...config.stopLossSettings.breakeven,
                        moveTo: e.target.value as 'breakeven' | 'tp1' | 'percentage'
                      }
                    }
                  })}
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                >
                  <option value="breakeven">Breakeven</option>
                  <option value="tp1">TP1 Level</option>
                  <option value="percentage">Custom %</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-300 text-xs mb-1">Activate At</label>
                <select
                  value={config.stopLossSettings.breakeven.activateAt}
                  onChange={(e) => updateConfig({
                    stopLossSettings: {
                      ...config.stopLossSettings,
                      breakeven: {
                        ...config.stopLossSettings.breakeven,
                        activateAt: e.target.value as 'tp1' | 'tp2' | 'percentage'
                      }
                    }
                  })}
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                >
                  <option value="tp1">TP1 Hit</option>
                  <option value="tp2">TP2 Hit</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Moving Target */}
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Moving Target System</label>
          <select
            value={config.stopLossSettings.movingTarget.type}
            onChange={(e) => updateConfig({
              stopLossSettings: {
                ...config.stopLossSettings,
                movingTarget: {
                  ...config.stopLossSettings.movingTarget,
                  type: e.target.value as 'none' | 'standard' | 'two_level'
                }
              }
            })}
            className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
          >
            <option value="none">Geen Moving Target</option>
            <option value="standard">Standard Moving (TP1→Breakeven, TP2→TP1, TP3→TP2, etc.)</option>
            <option value="two_level">Moving 2 Target (TP2→Breakeven, TP3→TP1, TP4→TP2, etc.)</option>
          </select>
          {config.stopLossSettings.movingTarget.type !== 'none' && (
            <div className="mt-2 p-3 bg-gray-800 rounded text-sm text-gray-300">
              {config.stopLossSettings.movingTarget.type === 'standard' ? (
                <>
                  <div className="font-medium mb-1">Standard Moving Target:</div>
                  <div>• Na TP1: Stop Loss → Breakeven</div>
                  <div>• Na TP2: Stop Loss → TP1 niveau</div>
                  <div>• Na TP3: Stop Loss → TP2 niveau, etc.</div>
                </>
              ) : (
                <>
                  <div className="font-medium mb-1">Moving 2 Target (sla 1 niveau over):</div>
                  <div>• Na TP2: Stop Loss → Breakeven</div>
                  <div>• Na TP3: Stop Loss → TP1 niveau</div>
                  <div>• Na TP4: Stop Loss → TP2 niveau, etc.</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Moving Breakeven (separate from regular breakeven) */}
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.stopLossSettings.movingBreakeven.enabled}
              onChange={(e) => updateConfig({
                stopLossSettings: {
                  ...config.stopLossSettings,
                  movingBreakeven: {
                    ...config.stopLossSettings.movingBreakeven,
                    enabled: e.target.checked
                  }
                }
              })}
              className="w-4 h-4"
            />
            <span className="text-gray-300">Extra Breakeven Trigger</span>
          </label>
          
          {config.stopLossSettings.movingBreakeven.enabled && (
            <div className="mt-2 space-y-2">
              <div>
                <label className="block text-gray-300 text-xs mb-1">Activeer Breakeven Na</label>
                <select
                  value={config.stopLossSettings.movingBreakeven.triggerLevel}
                  onChange={(e) => updateConfig({
                    stopLossSettings: {
                      ...config.stopLossSettings,
                      movingBreakeven: {
                        ...config.stopLossSettings.movingBreakeven,
                        triggerLevel: e.target.value as 'tp1' | 'tp2' | 'percentage'
                      }
                    }
                  })}
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                >
                  <option value="tp1">Take Profit 1</option>
                  <option value="tp2">Take Profit 2</option>
                  <option value="percentage">Percentage Winst</option>
                </select>
              </div>
              
              {config.stopLossSettings.movingBreakeven.triggerLevel === 'percentage' && (
                <div>
                  <label className="block text-gray-300 text-xs mb-1">Percentage Trigger</label>
                  <input
                    type="number"
                    value={config.stopLossSettings.movingBreakeven.triggerPercentage || 2}
                    onChange={(e) => updateConfig({
                      stopLossSettings: {
                        ...config.stopLossSettings,
                        movingBreakeven: {
                          ...config.stopLossSettings.movingBreakeven,
                          triggerPercentage: Number(e.target.value)
                        }
                      }
                    })}
                    min="0.1"
                    step="0.1"
                    className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                  />
                </div>
              )}
              
              <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded">
                <div className="font-medium mb-1">Extra Breakeven Info:</div>
                <div>Dit werkt naast de hoofdbreakeven instelling en Moving Target systeem</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Advanced Strategy Builder</h1>
            <p className="text-gray-400">Build professional trading strategies with full control</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Builder Toggle */}
            <div className="flex items-center space-x-1 bg-gray-900 p-1 rounded-lg">
              <button
                onClick={() => {
                  setActiveBuilder('technical');
                  updateConfig({ signalSource: 'technical' });
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeBuilder === 'technical'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                📈 Technical
              </button>
              <button
                onClick={() => {
                  setActiveBuilder('ml');
                  updateConfig({ 
                    signalSource: 'ml',
                    mlModel: {
                      type: 'lstm',
                      confidence: 0.7,
                      features: ['price', 'volume', 'volatility']
                    }
                  });
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeBuilder === 'ml'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                🤖 Machine Learning
              </button>
            </div>

            {/* Backtest Period Selector */}
            <div className="flex items-center space-x-3">
              <label className="text-gray-300 text-sm font-medium">Backtest Periode:</label>
              <select
                value={backtestPeriod}
                onChange={(e) => setBacktestPeriod(e.target.value)}
                className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
              >
                <option value="3m">3 Maanden</option>
                <option value="6m">6 Maanden</option>
                <option value="12m">12 Maanden (Aanbevolen)</option>
                <option value="24m">2 Jaar</option>
                <option value="36m">3 Jaar</option>
              </select>
            </div>

            {/* Optimize Button */}
            <button
              onClick={optimizeStrategy}
              disabled={isOptimizing}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-500 text-white rounded-lg font-medium transition-all"
            >
              {isOptimizing ? '🔄 Optimizing...' : '🎯 Optimize All with AI'}
            </button>
            
            {/* Example Strategies Button */}
            <button
              onClick={showExampleStrategies}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-medium transition-all"
            >
              📚 Example Strategies
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-screen">
        {/* Builder Panel */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6 max-w-6xl mx-auto">
            {renderAccountSelection()}
            {renderPositionSettings()}
            
            {activeBuilder === 'technical' ? renderSignalIndicator() : renderMLSignal()}
            
            {/* Confirming Indicators */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <h3 className="text-white font-medium mb-4">Confirming Indicators (Optional)</h3>
              <div className="space-y-4">
                {config.confirmingIndicators.map((indicator, index) => {
                  const allIndicators = [...TREND_INDICATORS, ...SIGNAL_INDICATORS];
                  
                  return (
                    <div key={index} className="p-4 bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={indicator.enabled}
                            onChange={(e) => {
                              const updated = [...config.confirmingIndicators];
                              updated[index].enabled = e.target.checked;
                              updateConfig({ confirmingIndicators: updated });
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-300">Confirming Indicator {index + 1}</span>
                        </label>
                      </div>
                      
                      {indicator.enabled && (
                        <div className="grid grid-cols-3 gap-4">
                          <select
                            value={indicator.type}
                            onChange={(e) => {
                              const ind = allIndicators.find(i => i.id === e.target.value);
                              if (ind) {
                                const updated = [...config.confirmingIndicators];
                                updated[index] = {
                                  ...updated[index],
                                  type: ind.id,
                                  category: TREND_INDICATORS.includes(ind) ? 'trend' : 'signal',
                                  parameters: getDefaultParameters(ind.id)
                                };
                                updateConfig({ confirmingIndicators: updated });
                              }
                            }}
                            className="p-2 bg-gray-700 border border-gray-600 rounded text-white"
                          >
                            <optgroup label="Trend Indicators">
                              {TREND_INDICATORS.map(ind => (
                                <option key={ind.id} value={ind.id}>{ind.name}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Signal Indicators">
                              {SIGNAL_INDICATORS.map(ind => (
                                <option key={ind.id} value={ind.id}>{ind.name}</option>
                              ))}
                            </optgroup>
                          </select>
                          
                          <select
                            value={indicator.timeframe}
                            onChange={(e) => {
                              const updated = [...config.confirmingIndicators];
                              updated[index].timeframe = e.target.value;
                              updateConfig({ confirmingIndicators: updated });
                            }}
                            className="p-2 bg-gray-700 border border-gray-600 rounded text-white"
                          >
                            {TIMEFRAMES.map(tf => (
                              <option key={tf} value={tf}>{tf}</option>
                            ))}
                          </select>
                          
                          <input
                            type="text"
                            value={indicator.category === 'trend' ? 'Trend' : 'Signal'}
                            readOnly
                            className="p-2 bg-gray-600 border border-gray-500 rounded text-gray-400"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {renderEntryManagement()}
            {renderTakeProfitManagement()}
            {renderStopLossManagement()}

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4 pb-8">
              <button
                onClick={saveStrategy}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-lg font-bold transition-all duration-300 shadow-lg hover:shadow-green-500/30"
              >
                🚀 Deploy Strategy
              </button>
              
              <button
                onClick={exportStrategy}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg font-bold transition-all duration-300 shadow-lg hover:shadow-blue-500/30"
              >
                💾 Export Strategy
              </button>
              
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={importStrategy}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  id="strategy-import-input"
                />
                <div className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-lg font-bold transition-all duration-300 shadow-lg hover:shadow-purple-500/30">
                  📥 Import Strategy
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Backtest Panel */}
        <div className="w-96 border-l border-gray-800 bg-gray-950 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white font-medium">Live Backtest</h3>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-green-400 text-xs">Real-time</span>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              Periode: {backtestPeriod === '3m' ? '3 Maanden' : 
                       backtestPeriod === '6m' ? '6 Maanden' : 
                       backtestPeriod === '12m' ? '12 Maanden' : 
                       backtestPeriod === '24m' ? '2 Jaar' : '3 Jaar'} • 
              {config.coinPair} • {config.signalSource === 'ml' ? 'ML' : 'AI'} Strategy
            </div>
          </div>
          <div className="flex-1">
            <TradingViewBacktest 
              strategyName={config.name || `${config.coinPair} - ${config.signalSource === 'ml' ? 'ML' : 'AI'} Strategy`}
              isLoading={isOptimizing}
              compact={true}
              data={optimizationResults ? {
                totalPnL: 234.56,
                totalPnLPercent: 23.46,
                maxDrawdown: -45.67,
                maxDrawdownPercent: -8.23,
                totalTrades: 87,
                profitableTrades: 72,
                profitableTradesPercent: 82.76,
                unprofitableTrades: 15,
                profitFactor: 2.14,
                equityCurve: Array.from({ length: 87 }, (_, i) => ({
                  x: i,
                  y: 1000 + (i * 3.2) + Math.sin(i * 0.2) * 15
                })),
                drawdownBars: Array.from({ length: 87 }, (_, i) => ({
                  x: i,
                  y: Math.random() > 0.8 ? -(Math.random() * 6) : 0
                })),
                trades: []
              } : undefined}
            />
          </div>
        </div>
      </div>

      {/* AI Optimization Report */}
      <OptimizationReport
        isVisible={showOptimizationReport}
        onClose={() => {
          setShowOptimizationReport(false);
          // After closing report, show risk profiles
          setShowRiskProfiles(true);
        }}
        reportData={optimizationResults}
        strategyName={config.name}
        backtestPeriod={backtestPeriod}
      />

      {/* Risk Profile Selector */}
      <RiskProfileSelector
        isVisible={showRiskProfiles}
        onClose={() => setShowRiskProfiles(false)}
        onSelectProfile={handleRiskProfileSelection}
        optimizationData={optimizationResults}
      />

      {/* Process Log */}
      <ProcessLog 
        logs={processLogs} 
        isVisible={showProcessLog} 
        onClose={() => setShowProcessLog(false)} 
      />
      
      {/* Error Logger */}
      <ErrorLogger errors={errors} />
      
      {/* Example Strategies Modal */}
      {showExampleStrategiesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900/95 border border-gray-700 rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                📚 Example Multi-Timeframe Strategies
              </h2>
              <button
                onClick={() => setShowExampleStrategiesModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
              {/* Render all strategies dynamically */}
              {Object.entries({
                'macd_supertrend_rsi': { name: 'MACD + SuperTrend + RSI', color: 'purple', tag: 'Popular', winRate: '75-85%' },
                'ema_bb_stoch': { name: 'EMA + Bollinger + Stochastic', color: 'blue', tag: 'Balanced', winRate: '70-80%' },
                'rsi_macd': { name: 'RSI + MACD Dual', color: 'green', tag: 'Beginner', winRate: '65-75%' },
                'bb_rsi_volume': { name: 'Bollinger + RSI + Volume', color: 'cyan', tag: 'Volume', winRate: '70-78%' },
                'adx_ema_stoch': { name: 'ADX + EMA + Stochastic', color: 'yellow', tag: 'Trend', winRate: '72-82%' },
                'psar_macd_rsi': { name: 'PSAR + MACD + RSI', color: 'pink', tag: 'Momentum', winRate: '68-76%' },
                'vwap_bb_momentum': { name: 'VWAP + Bollinger + Momentum', color: 'indigo', tag: 'VWAP', winRate: '65-73%' },
                'ichimoku_rsi': { name: 'Ichimoku + RSI Power', color: 'red', tag: 'Cloud', winRate: '74-84%' },
                'williams_ema_volume': { name: 'Williams %R + EMA + Volume', color: 'orange', tag: 'Williams', winRate: '69-77%' },
                'cci_sma_adx': { name: 'CCI + SMA + ADX', color: 'teal', tag: 'Trend', winRate: '66-74%' },
                'roc_bb_stoch_vol': { name: 'ROC + BB + Stoch + Volume', color: 'violet', tag: '4-Factor', winRate: '71-79%' },
                'supertrend_williams_ema': { name: 'SuperTrend + Williams + EMA', color: 'lime', tag: 'Super', winRate: '73-81%' },
                'macd_psar_volume': { name: 'MACD + PSAR + Volume', color: 'emerald', tag: 'Scalp', winRate: '70-78%' },
                'sma_cross_rsi_cci': { name: 'SMA Cross + RSI + CCI', color: 'sky', tag: 'Cross', winRate: '64-72%' },
                'vwap_adx_momentum': { name: 'VWAP + ADX + Momentum', color: 'amber', tag: 'Power', winRate: '67-75%' },
                'bb_squeeze_rsi_vol': { name: 'BB Squeeze + RSI + Vol', color: 'rose', tag: 'Squeeze', winRate: '76-84%' },
                'ema_ribbon_stoch': { name: 'EMA Ribbon + Stochastic', color: 'slate', tag: 'Ribbon', winRate: '68-76%' },
                'ichimoku_macd_volume': { name: 'Ichimoku + MACD + Vol', color: 'zinc', tag: 'Pro', winRate: '72-80%' },
                'williams_cci_psar': { name: 'Williams + CCI + PSAR', color: 'stone', tag: 'Signal', winRate: '70-78%' },
                'roc_vwap_adx': { name: 'ROC + VWAP + ADX', color: 'neutral', tag: 'ROC', winRate: '69-77%' },
                'supertrend_bb_rsi_vol': { name: 'SuperTrend + BB + RSI + Vol', color: 'gray', tag: 'Complete', winRate: '74-82%' },
                'sma_momentum_stoch': { name: 'SMA + Momentum + Stoch', color: 'red', tag: 'Simple', winRate: '63-71%' }
              }).map(([key, info]) => (
                <div key={key} 
                     className={`bg-gray-800 border border-gray-600 rounded-lg p-3 hover:border-${info.color}-500 transition-colors cursor-pointer`}
                     onClick={() => applyExampleStrategy(key)}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className={`text-sm font-bold text-${info.color}-400`}>{info.name}</h3>
                    </div>
                    <span className={`px-2 py-1 bg-${info.color}-500/20 text-${info.color}-400 rounded text-xs`}>{info.tag}</span>
                  </div>
                  
                  <div className="text-xs text-gray-400 mb-2">
                    Multi-timeframe strategy with optimized parameters
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-yellow-400">⚡</span>
                      <span className="text-gray-400">Auto-optimized</span>
                    </div>
                    <div className={`text-${info.color}-400 font-medium`}>
                      WR: {info.winRate}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start space-x-3">
                <span className="text-yellow-400 text-xl">💡</span>
                <div className="text-sm text-gray-300">
                  <p className="font-medium text-yellow-400 mb-1">Pro Tip:</p>
                  <p>These strategies use different timeframes for signal and confirmation indicators to filter out false signals and improve win rate. After applying, you can fine-tune the parameters using AI optimization.</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowExampleStrategiesModal(false)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedStrategyBuilder;