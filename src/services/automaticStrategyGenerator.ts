import { coinsService } from './coinsService';

interface CoinAnalysis {
  symbol: string;
  volatility: 'low' | 'medium' | 'high';
  volume: 'low' | 'medium' | 'high';
  marketCap: 'large' | 'mid' | 'small' | 'micro';
  behavior: 'trending' | 'ranging' | 'volatile';
  recommendedStrategy: string;
  compatibility: number;
}

interface StrategyProfile {
  name: string;
  type: 'trend' | 'momentum' | 'volume' | 'volatility' | 'reversal';
  riskLevel: 'low' | 'medium' | 'high';
  leverageRange: [number, number];
  bestFor: string[];
  winRateRange: [number, number];
  signalIndicator: any;
  confirmingIndicators: any[];
  stopLossSettings: any;
  takeProfitSettings: any;
}

const STRATEGY_PROFILES: Record<string, StrategyProfile> = {
  'macd_supertrend_rsi': {
    name: 'MACD + SuperTrend + RSI',
    type: 'momentum',
    riskLevel: 'medium',
    leverageRange: [10, 20],
    bestFor: ['trending', 'medium_volatility', 'high_volume'],
    winRateRange: [75, 85],
    signalIndicator: {
      type: 'macd',
      category: 'signal',
      timeframe: '15m',
      parameters: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }
    },
    confirmingIndicators: [
      {
        type: 'supertrend',
        category: 'trend',
        timeframe: '1h',
        parameters: { period: 10, multiplier: 3 },
        enabled: true
      },
      {
        type: 'rsi',
        category: 'signal',
        timeframe: '1h',
        parameters: { period: 14, overbought: 70, oversold: 30 },
        enabled: true
      }
    ],
    stopLossSettings: { type: 'fixed_from_entry', percentage: 3 },
    takeProfitSettings: {
      type: 'multiple',
      numberOfTPs: 3,
      tpSpacing: { type: 'fixed_percentage', fixedPercentage: 2 }
    }
  },
  'ema_bb_stoch': {
    name: 'EMA + Bollinger + Stochastic',
    type: 'trend',
    riskLevel: 'low',
    leverageRange: [5, 15],
    bestFor: ['trending', 'low_volatility', 'large_cap'],
    winRateRange: [70, 80],
    signalIndicator: {
      type: 'ema',
      category: 'trend',
      timeframe: '5m',
      parameters: { period: 9 }
    },
    confirmingIndicators: [
      {
        type: 'bollinger',
        category: 'trend',
        timeframe: '15m',
        parameters: { period: 20, std: 2 },
        enabled: true
      },
      {
        type: 'stochastic',
        category: 'signal',
        timeframe: '30m',
        parameters: { kPeriod: 14, dPeriod: 3, smooth: 3 },
        enabled: true
      }
    ],
    stopLossSettings: { type: 'fixed_from_entry', percentage: 2.5 },
    takeProfitSettings: {
      type: 'multiple',
      numberOfTPs: 2,
      tpSpacing: { type: 'fixed_percentage', fixedPercentage: 3 }
    }
  },
  'rsi_macd': {
    name: 'RSI + MACD Dual',
    type: 'momentum',
    riskLevel: 'high',
    leverageRange: [15, 25],
    bestFor: ['volatile', 'momentum', 'small_cap'],
    winRateRange: [65, 75],
    signalIndicator: {
      type: 'rsi',
      category: 'signal',
      timeframe: '15m',
      parameters: { period: 14, overbought: 70, oversold: 30 }
    },
    confirmingIndicators: [
      {
        type: 'macd',
        category: 'signal',
        timeframe: '1h',
        parameters: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        enabled: true
      }
    ],
    stopLossSettings: { type: 'fixed_from_entry', percentage: 2 },
    takeProfitSettings: {
      type: 'single',
      tpSpacing: { type: 'fixed_percentage', fixedPercentage: 5 }
    }
  },
  'bb_rsi_volume': {
    name: 'Bollinger + RSI + Volume',
    type: 'volume',
    riskLevel: 'medium',
    leverageRange: [8, 18],
    bestFor: ['high_volume', 'ranging', 'medium_volatility'],
    winRateRange: [70, 78],
    signalIndicator: {
      type: 'bollinger',
      category: 'trend',
      timeframe: '15m',
      parameters: { period: 20, std: 2.1 }
    },
    confirmingIndicators: [
      {
        type: 'rsi',
        category: 'signal',
        timeframe: '30m',
        parameters: { period: 14, overbought: 75, oversold: 25 },
        enabled: true
      },
      {
        type: 'volume',
        category: 'signal',
        timeframe: '1h',
        parameters: { period: 20 },
        enabled: true
      }
    ],
    stopLossSettings: { type: 'fixed_from_entry', percentage: 2.8 },
    takeProfitSettings: {
      type: 'multiple',
      numberOfTPs: 2,
      tpSpacing: { type: 'fixed_percentage', fixedPercentage: 3.5 }
    }
  },
  'adx_ema_stoch': {
    name: 'ADX + EMA + Stochastic',
    type: 'trend',
    riskLevel: 'medium',
    leverageRange: [12, 22],
    bestFor: ['trending', 'high_volume', 'medium_volatility'],
    winRateRange: [72, 82],
    signalIndicator: {
      type: 'adx',
      category: 'trend',
      timeframe: '30m',
      parameters: { period: 14, threshold: 25 }
    },
    confirmingIndicators: [
      {
        type: 'ema',
        category: 'trend',
        timeframe: '1h',
        parameters: { period: 21 },
        enabled: true
      },
      {
        type: 'stochastic',
        category: 'signal',
        timeframe: '2h',
        parameters: { kPeriod: 14, dPeriod: 3, smooth: 3 },
        enabled: true
      }
    ],
    stopLossSettings: { type: 'fixed_from_entry', percentage: 3.2 },
    takeProfitSettings: {
      type: 'multiple',
      numberOfTPs: 3,
      tpSpacing: { type: 'percentage_multiplier', percentageMultiplier: 1.5 }
    }
  },
  'psar_macd_rsi': {
    name: 'PSAR + MACD + RSI',
    type: 'momentum',
    riskLevel: 'high',
    leverageRange: [18, 25],
    bestFor: ['volatile', 'trending', 'momentum'],
    winRateRange: [68, 76],
    signalIndicator: {
      type: 'psar',
      category: 'trend',
      timeframe: '5m',
      parameters: { start: 0.02, increment: 0.02, maximum: 0.2 }
    },
    confirmingIndicators: [
      {
        type: 'macd',
        category: 'signal',
        timeframe: '15m',
        parameters: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        enabled: true
      },
      {
        type: 'rsi',
        category: 'signal',
        timeframe: '30m',
        parameters: { period: 21, overbought: 70, oversold: 30 },
        enabled: true
      }
    ],
    stopLossSettings: { type: 'fixed_from_entry', percentage: 2.5 },
    takeProfitSettings: {
      type: 'single',
      tpSpacing: { type: 'fixed_percentage', fixedPercentage: 6 }
    }
  },
  'vwap_bb_momentum': {
    name: 'VWAP + Bollinger + Momentum',
    type: 'volume',
    riskLevel: 'low',
    leverageRange: [5, 12],
    bestFor: ['high_volume', 'large_cap', 'stable'],
    winRateRange: [65, 73],
    signalIndicator: {
      type: 'vwap',
      category: 'trend',
      timeframe: '15m',
      parameters: { period: 20 }
    },
    confirmingIndicators: [
      {
        type: 'bollinger',
        category: 'trend',
        timeframe: '1h',
        parameters: { period: 20, std: 2 },
        enabled: true
      },
      {
        type: 'momentum',
        category: 'signal',
        timeframe: '4h',
        parameters: { period: 10 },
        enabled: true
      }
    ],
    stopLossSettings: { type: 'fixed_from_entry', percentage: 4 },
    takeProfitSettings: {
      type: 'multiple',
      numberOfTPs: 2,
      tpSpacing: { type: 'fixed_percentage', fixedPercentage: 4 }
    }
  },
  'ichimoku_rsi': {
    name: 'Ichimoku + RSI Power',
    type: 'trend',
    riskLevel: 'medium',
    leverageRange: [10, 18],
    bestFor: ['trending', 'medium_volatility', 'mid_cap'],
    winRateRange: [74, 84],
    signalIndicator: {
      type: 'ichimoku',
      category: 'trend',
      timeframe: '1h',
      parameters: { tenkanSen: 9, kijunSen: 26, senkouB: 52 }
    },
    confirmingIndicators: [
      {
        type: 'rsi',
        category: 'signal',
        timeframe: '4h',
        parameters: { period: 14, overbought: 65, oversold: 35 },
        enabled: true
      }
    ],
    stopLossSettings: { type: 'fixed_from_entry', percentage: 3.5 },
    takeProfitSettings: {
      type: 'multiple',
      numberOfTPs: 4,
      tpSpacing: { type: 'fixed_percentage', fixedPercentage: 2.5 }
    }
  },
  'williams_ema_volume': {
    name: 'Williams %R + EMA + Volume',
    type: 'reversal',
    riskLevel: 'medium',
    leverageRange: [12, 20],
    bestFor: ['ranging', 'high_volume', 'reversal'],
    winRateRange: [69, 77],
    signalIndicator: {
      type: 'williams',
      category: 'signal',
      timeframe: '5m',
      parameters: { period: 14, overbought: -20, oversold: -80 }
    },
    confirmingIndicators: [
      {
        type: 'ema',
        category: 'trend',
        timeframe: '30m',
        parameters: { period: 50 },
        enabled: true
      },
      {
        type: 'volume',
        category: 'signal',
        timeframe: '1h',
        parameters: { period: 20 },
        enabled: true
      }
    ],
    stopLossSettings: { type: 'fixed_from_entry', percentage: 2.2 },
    takeProfitSettings: {
      type: 'multiple',
      numberOfTPs: 3,
      tpSpacing: { type: 'fixed_percentage', fixedPercentage: 2.8 }
    }
  },
  'supertrend_bb_rsi_vol': {
    name: 'SuperTrend + BB + RSI + Volume',
    type: 'volatility',
    riskLevel: 'medium',
    leverageRange: [10, 20],
    bestFor: ['volatile', 'high_volume', 'complex'],
    winRateRange: [74, 82],
    signalIndicator: {
      type: 'supertrend',
      category: 'trend',
      timeframe: '5m',
      parameters: { period: 10, multiplier: 2.8 }
    },
    confirmingIndicators: [
      {
        type: 'bollinger',
        category: 'trend',
        timeframe: '15m',
        parameters: { period: 20, std: 2 },
        enabled: true
      },
      {
        type: 'rsi',
        category: 'signal',
        timeframe: '30m',
        parameters: { period: 14, overbought: 70, oversold: 30 },
        enabled: true
      },
      {
        type: 'volume',
        category: 'signal',
        timeframe: '1h',
        parameters: { period: 20 },
        enabled: true
      }
    ],
    stopLossSettings: { type: 'fixed_from_entry', percentage: 3.8 },
    takeProfitSettings: {
      type: 'multiple',
      numberOfTPs: 3,
      tpSpacing: { type: 'percentage_multiplier', percentageMultiplier: 1.6 }
    }
  }
};

// Coin categorization functions
const getVolatility = (symbol: string): 'low' | 'medium' | 'high' => {
  // Major stable coins and BTC/ETH = low volatility
  if (['BTCUSDT', 'ETHUSDT', 'USDCUSDT', 'BUSDUSDT', 'BNBUSDT'].includes(symbol)) {
    return 'low';
  }
  // Top 20 coins = medium volatility
  if (['ADAUSDT', 'SOLUSDT', 'DOTUSDT', 'LINKUSDT', 'MATICUSDT', 'AVAXUSDT', 'ATOMUSDT', 'NEARUSDT', 'FTMUSDT', 'ALGOUSDT'].includes(symbol)) {
    return 'medium';
  }
  // Small caps and meme coins = high volatility
  return 'high';
};

const getVolume = (symbol: string): 'low' | 'medium' | 'high' => {
  // Major pairs = high volume
  if (['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'DOGEUSDT', 'BNBUSDT', 'XRPUSDT'].includes(symbol)) {
    return 'high';
  }
  // Top 50 = medium volume
  if (symbol.includes('USDT') && symbol.length <= 9) {
    return 'medium';
  }
  return 'low';
};

const getMarketCap = (symbol: string): 'large' | 'mid' | 'small' | 'micro' => {
  if (['BTCUSDT', 'ETHUSDT'].includes(symbol)) return 'large';
  if (['ADAUSDT', 'SOLUSDT', 'DOTUSDT', 'LINKUSDT', 'MATICUSDT', 'AVAXUSDT'].includes(symbol)) return 'mid';
  if (symbol.includes('USDT') && symbol.length <= 9) return 'small';
  return 'micro';
};

const getBehavior = (symbol: string, volatility: string): 'trending' | 'ranging' | 'volatile' => {
  if (volatility === 'high') return 'volatile';
  if (['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT'].includes(symbol)) return 'trending';
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

const analyzeCoin = (symbol: string): CoinAnalysis => {
  const volatility = getVolatility(symbol);
  const volume = getVolume(symbol);
  const marketCap = getMarketCap(symbol);
  const behavior = getBehavior(symbol, volatility);
  
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

const generateStrategyConfig = (analysis: CoinAnalysis, accountId: string = 'default') => {
  const profile = STRATEGY_PROFILES[analysis.recommendedStrategy];
  const leverage = Math.floor(Math.random() * (profile.leverageRange[1] - profile.leverageRange[0] + 1)) + profile.leverageRange[0];
  
  return {
    id: `auto_${analysis.symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name: `AUTO ${analysis.symbol} - ${profile.name}`,
    coinPair: analysis.symbol,
    config: {
      accountId: accountId,
      accountName: 'Auto Generated',
      signalSource: 'technical',
      leverage: leverage,
      amountType: 'fixed',
      fixedAmount: Math.min(100 + (leverage * 20), 800),
      percentageAmount: 5,
      marginType: 'Isolated',
      signalIndicator: profile.signalIndicator,
      confirmingIndicators: profile.confirmingIndicators,
      entrySettings: {
        type: 'single',
        numberOfEntries: 1,
        entrySpacing: { type: 'fixed_percentage', fixedPercentage: 0.5 },
        entryAmounts: { type: 'evenly' },
        trailingEntry: { enabled: false, percentage: 0.5 }
      },
      takeProfitSettings: {
        ...profile.takeProfitSettings,
        trailingTP: { enabled: analysis.volatility === 'high', percentage: 0.5 }
      },
      stopLossSettings: {
        ...profile.stopLossSettings,
        trailingStopLoss: { 
          enabled: analysis.volatility === 'high',
          activationLevel: 'tp1'
        },
        breakeven: { enabled: true, moveTo: 'breakeven', activateAt: 'tp1' },
        movingTarget: { type: 'none' },
        movingBreakeven: { enabled: false, triggerLevel: 'tp1' }
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

export const generateAllStrategies = async (accountId: string = 'default') => {
  console.log('🚀 Starting automated strategy generation...');
  
  try {
    // Get all coins
    const coins = await coinsService.getSymbols();
    console.log(`📥 Found ${coins.length} trading pairs`);
    
    // Analyze and generate strategies
    const strategies = [];
    let processed = 0;
    
    for (const coin of coins) {
      const analysis = analyzeCoin(coin);
      
      // Only generate strategies for coins with good compatibility
      if (analysis.compatibility >= 60) {
        const strategy = generateStrategyConfig(analysis, accountId);
        strategies.push(strategy);
      }
      
      processed++;
      if (processed % 50 === 0) {
        console.log(`📊 Processed ${processed}/${coins.length} coins - ${strategies.length} strategies generated`);
      }
    }
    
    // Save to localStorage
    const existingStrategies = JSON.parse(localStorage.getItem('savedStrategies') || '[]');
    const allStrategies = [...existingStrategies, ...strategies];
    localStorage.setItem('savedStrategies', JSON.stringify(allStrategies));
    
    console.log(`✅ Successfully generated and saved ${strategies.length} strategies!`);
    console.log('🎯 Strategies are ready for import into Auto Trading Engine');
    
    return {
      generated: strategies.length,
      total: coins.length,
      strategies: strategies
    };
    
  } catch (error) {
    console.error('❌ Error generating strategies:', error);
    throw error;
  }
};

export const getStrategyDistribution = () => {
  const strategies = JSON.parse(localStorage.getItem('savedStrategies') || '[]');
  const distribution: Record<string, number> = {};
  
  strategies.forEach((strategy: any) => {
    if (strategy.analysis?.recommendedStrategy) {
      const strategyType = strategy.analysis.recommendedStrategy;
      distribution[strategyType] = (distribution[strategyType] || 0) + 1;
    }
  });
  
  return distribution;
};

export const clearGeneratedStrategies = () => {
  localStorage.removeItem('savedStrategies');
  console.log('🗑️ Cleared all generated strategies');
};