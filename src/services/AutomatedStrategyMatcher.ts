// Comprehensive Automated Strategy Matching System
import { coinsService, CoinData } from './coinsService';

// Available strategies from the request
export const AVAILABLE_STRATEGIES = [
  'macd_supertrend_rsi',
  'ema_bb_stoch',
  'rsi_macd',
  'bb_rsi_volume',
  'adx_ema_stoch',
  'psar_macd_rsi',
  'vwap_bb_momentum',
  'ichimoku_rsi',
  'williams_ema_volume',
  'cci_sma_adx',
  'roc_bb_stoch_vol',
  'supertrend_williams_ema',
  'macd_psar_volume',
  'sma_cross_rsi_cci',
  'vwap_adx_momentum',
  'bb_squeeze_rsi_vol',
  'ema_ribbon_stoch',
  'ichimoku_macd_volume',
  'williams_cci_psar',
  'roc_vwap_adx',
  'supertrend_bb_rsi_vol',
  'sma_momentum_stoch'
];

// Coin categories based on characteristics
export interface CoinCharacteristics {
  symbol: string;
  volatility: 'low' | 'medium' | 'high';
  volume: 'low' | 'medium' | 'high';
  marketCap: 'micro' | 'small' | 'mid' | 'large';
  trendBehavior: 'trending' | 'ranging' | 'volatile';
  maxLeverage: number;
}

// Strategy categories and their optimal conditions
export interface StrategyProfile {
  name: string;
  category: 'trend' | 'reversal' | 'momentum' | 'volatility' | 'volume';
  optimalVolatility: ('low' | 'medium' | 'high')[];
  optimalVolume: ('low' | 'medium' | 'high')[];
  optimalBehavior: ('trending' | 'ranging' | 'volatile')[];
  leveragePreference: 'low' | 'medium' | 'high';
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
}

// Complete strategy mapping
export const STRATEGY_PROFILES: Record<string, StrategyProfile> = {
  'macd_supertrend_rsi': {
    name: 'MACD Supertrend RSI',
    category: 'trend',
    optimalVolatility: ['medium', 'high'],
    optimalVolume: ['medium', 'high'],
    optimalBehavior: ['trending'],
    leveragePreference: 'high',
    riskLevel: 'aggressive'
  },
  'ema_bb_stoch': {
    name: 'EMA Bollinger Stochastic',
    category: 'trend',
    optimalVolatility: ['low', 'medium'],
    optimalVolume: ['medium', 'high'],
    optimalBehavior: ['trending', 'ranging'],
    leveragePreference: 'medium',
    riskLevel: 'moderate'
  },
  'rsi_macd': {
    name: 'RSI MACD',
    category: 'momentum',
    optimalVolatility: ['medium', 'high'],
    optimalVolume: ['medium', 'high'],
    optimalBehavior: ['trending'],
    leveragePreference: 'medium',
    riskLevel: 'moderate'
  },
  'bb_rsi_volume': {
    name: 'Bollinger RSI Volume',
    category: 'volume',
    optimalVolatility: ['medium', 'high'],
    optimalVolume: ['high'],
    optimalBehavior: ['volatile', 'trending'],
    leveragePreference: 'medium',
    riskLevel: 'moderate'
  },
  'adx_ema_stoch': {
    name: 'ADX EMA Stochastic',
    category: 'trend',
    optimalVolatility: ['low', 'medium'],
    optimalVolume: ['medium', 'high'],
    optimalBehavior: ['trending'],
    leveragePreference: 'medium',
    riskLevel: 'moderate'
  },
  'psar_macd_rsi': {
    name: 'PSAR MACD RSI',
    category: 'trend',
    optimalVolatility: ['medium', 'high'],
    optimalVolume: ['medium', 'high'],
    optimalBehavior: ['trending'],
    leveragePreference: 'high',
    riskLevel: 'aggressive'
  },
  'vwap_bb_momentum': {
    name: 'VWAP Bollinger Momentum',
    category: 'momentum',
    optimalVolatility: ['medium', 'high'],
    optimalVolume: ['high'],
    optimalBehavior: ['trending', 'volatile'],
    leveragePreference: 'high',
    riskLevel: 'aggressive'
  },
  'ichimoku_rsi': {
    name: 'Ichimoku RSI',
    category: 'trend',
    optimalVolatility: ['low', 'medium'],
    optimalVolume: ['medium', 'high'],
    optimalBehavior: ['trending'],
    leveragePreference: 'low',
    riskLevel: 'conservative'
  },
  'williams_ema_volume': {
    name: 'Williams EMA Volume',
    category: 'volume',
    optimalVolatility: ['medium', 'high'],
    optimalVolume: ['high'],
    optimalBehavior: ['volatile', 'ranging'],
    leveragePreference: 'medium',
    riskLevel: 'moderate'
  },
  'cci_sma_adx': {
    name: 'CCI SMA ADX',
    category: 'trend',
    optimalVolatility: ['low', 'medium'],
    optimalVolume: ['medium'],
    optimalBehavior: ['trending'],
    leveragePreference: 'low',
    riskLevel: 'conservative'
  },
  'roc_bb_stoch_vol': {
    name: 'ROC Bollinger Stochastic Volume',
    category: 'volatility',
    optimalVolatility: ['high'],
    optimalVolume: ['high'],
    optimalBehavior: ['volatile'],
    leveragePreference: 'high',
    riskLevel: 'aggressive'
  },
  'supertrend_williams_ema': {
    name: 'Supertrend Williams EMA',
    category: 'trend',
    optimalVolatility: ['medium', 'high'],
    optimalVolume: ['medium', 'high'],
    optimalBehavior: ['trending'],
    leveragePreference: 'high',
    riskLevel: 'aggressive'
  },
  'macd_psar_volume': {
    name: 'MACD PSAR Volume',
    category: 'volume',
    optimalVolatility: ['medium', 'high'],
    optimalVolume: ['high'],
    optimalBehavior: ['trending', 'volatile'],
    leveragePreference: 'high',
    riskLevel: 'aggressive'
  },
  'sma_cross_rsi_cci': {
    name: 'SMA Cross RSI CCI',
    category: 'reversal',
    optimalVolatility: ['low', 'medium'],
    optimalVolume: ['medium'],
    optimalBehavior: ['ranging'],
    leveragePreference: 'low',
    riskLevel: 'conservative'
  },
  'vwap_adx_momentum': {
    name: 'VWAP ADX Momentum',
    category: 'momentum',
    optimalVolatility: ['medium', 'high'],
    optimalVolume: ['high'],
    optimalBehavior: ['trending'],
    leveragePreference: 'medium',
    riskLevel: 'moderate'
  },
  'bb_squeeze_rsi_vol': {
    name: 'Bollinger Squeeze RSI Volume',
    category: 'volatility',
    optimalVolatility: ['high'],
    optimalVolume: ['high'],
    optimalBehavior: ['volatile'],
    leveragePreference: 'high',
    riskLevel: 'aggressive'
  },
  'ema_ribbon_stoch': {
    name: 'EMA Ribbon Stochastic',
    category: 'trend',
    optimalVolatility: ['low', 'medium'],
    optimalVolume: ['medium'],
    optimalBehavior: ['trending'],
    leveragePreference: 'medium',
    riskLevel: 'moderate'
  },
  'ichimoku_macd_volume': {
    name: 'Ichimoku MACD Volume',
    category: 'volume',
    optimalVolatility: ['medium'],
    optimalVolume: ['high'],
    optimalBehavior: ['trending'],
    leveragePreference: 'low',
    riskLevel: 'conservative'
  },
  'williams_cci_psar': {
    name: 'Williams CCI PSAR',
    category: 'reversal',
    optimalVolatility: ['medium', 'high'],
    optimalVolume: ['medium'],
    optimalBehavior: ['ranging', 'volatile'],
    leveragePreference: 'medium',
    riskLevel: 'moderate'
  },
  'roc_vwap_adx': {
    name: 'ROC VWAP ADX',
    category: 'momentum',
    optimalVolatility: ['medium', 'high'],
    optimalVolume: ['high'],
    optimalBehavior: ['trending'],
    leveragePreference: 'medium',
    riskLevel: 'moderate'
  },
  'supertrend_bb_rsi_vol': {
    name: 'Supertrend Bollinger RSI Volume',
    category: 'volatility',
    optimalVolatility: ['high'],
    optimalVolume: ['high'],
    optimalBehavior: ['volatile', 'trending'],
    leveragePreference: 'high',
    riskLevel: 'aggressive'
  },
  'sma_momentum_stoch': {
    name: 'SMA Momentum Stochastic',
    category: 'momentum',
    optimalVolatility: ['low', 'medium'],
    optimalVolume: ['medium'],
    optimalBehavior: ['trending'],
    leveragePreference: 'low',
    riskLevel: 'conservative'
  }
};

// Strategy configuration interface
export interface StrategyConfiguration {
  id: string;
  name: string;
  symbol: string;
  strategy: string;
  timeframe: string;
  leverage: number;
  positionSize: number;
  takeProfitPercentage: number;
  stopLossPercentage: number;
  trailingStop: boolean;
  riskScore: number;
  expectedWinRate: number;
  optimizationScore: number;
  indicators: string[];
  config: {
    strategy: string;
    symbol: string;
    timeframe: string;
    leverage: number;
    positionSize: number;
    takeProfit: number;
    stopLoss: number;
    trailingStop: boolean;
    parameters: Record<string, any>;
  };
  created: string;
}

export class AutomatedStrategyMatcher {
  private static instance: AutomatedStrategyMatcher;
  private coinCharacteristics: Map<string, CoinCharacteristics> = new Map();
  private strategyMappings: Map<string, string[]> = new Map();

  static getInstance(): AutomatedStrategyMatcher {
    if (!AutomatedStrategyMatcher.instance) {
      AutomatedStrategyMatcher.instance = new AutomatedStrategyMatcher();
    }
    return AutomatedStrategyMatcher.instance;
  }

  // Analyze coin characteristics based on symbol patterns and leverage
  private analyzeCoinCharacteristics(coinData: CoinData): CoinCharacteristics {
    const symbol = coinData.symbol;
    const baseCoin = coinData.baseCoin;
    const maxLeverage = parseInt(coinData.maxLeverage);

    // Market cap categorization based on well-known coins
    let marketCap: 'micro' | 'small' | 'mid' | 'large';
    if (['BTC', 'ETH'].includes(baseCoin)) {
      marketCap = 'large';
    } else if (['BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'LINK', 'LTC', 'AVAX', 'UNI', 'ATOM'].includes(baseCoin)) {
      marketCap = 'mid';
    } else if (['ARB', 'OP', 'INJ', 'SUI', 'APT', 'NEAR', 'FIL', 'AAVE', 'MKR', 'AXS', 'SAND', 'MANA'].includes(baseCoin)) {
      marketCap = 'small';
    } else {
      marketCap = 'micro';
    }

    // Volatility based on coin type and leverage limits
    let volatility: 'low' | 'medium' | 'high';
    if (marketCap === 'large' && maxLeverage >= 75) {
      volatility = 'low';
    } else if (['PEPE', 'SHIB', 'BONK', 'WIF', 'FLOKI', 'DOGS', 'MEME', 'MOODENG'].some(meme => baseCoin.includes(meme))) {
      volatility = 'high';
    } else if (maxLeverage <= 25) {
      volatility = 'high';
    } else if (maxLeverage >= 50) {
      volatility = 'medium';
    } else {
      volatility = 'medium';
    }

    // Volume categorization based on market cap and popular coins
    let volume: 'low' | 'medium' | 'high';
    if (marketCap === 'large') {
      volume = 'high';
    } else if (marketCap === 'mid') {
      volume = 'medium';
    } else if (['PEPE', 'SHIB', 'DOGE', 'WIF', 'BONK'].some(popular => baseCoin.includes(popular))) {
      volume = 'high';
    } else {
      volume = 'low';
    }

    // Trend behavior based on coin characteristics
    let trendBehavior: 'trending' | 'ranging' | 'volatile';
    if (volatility === 'high') {
      trendBehavior = 'volatile';
    } else if (marketCap === 'large' || (marketCap === 'mid' && volume === 'high')) {
      trendBehavior = 'trending';
    } else {
      trendBehavior = 'ranging';
    }

    return {
      symbol,
      volatility,
      volume,
      marketCap,
      trendBehavior,
      maxLeverage
    };
  }

  // Calculate strategy compatibility score
  private calculateCompatibilityScore(coin: CoinCharacteristics, strategy: StrategyProfile): number {
    let score = 0;

    // Volatility match (30% weight)
    if (strategy.optimalVolatility.includes(coin.volatility)) {
      score += 30;
    }

    // Volume match (25% weight)
    if (strategy.optimalVolume.includes(coin.volume)) {
      score += 25;
    }

    // Behavior match (25% weight)
    if (strategy.optimalBehavior.includes(coin.trendBehavior)) {
      score += 25;
    }

    // Leverage compatibility (20% weight)
    const leverageScore = this.calculateLeverageScore(coin.maxLeverage, strategy.leveragePreference);
    score += leverageScore * 0.2;

    return Math.min(100, score);
  }

  private calculateLeverageScore(maxLeverage: number, preference: 'low' | 'medium' | 'high'): number {
    switch (preference) {
      case 'low':
        return maxLeverage >= 25 ? 100 : (maxLeverage / 25) * 100;
      case 'medium':
        return maxLeverage >= 50 ? 100 : (maxLeverage / 50) * 100;
      case 'high':
        return maxLeverage >= 75 ? 100 : (maxLeverage / 75) * 100;
      default:
        return 50;
    }
  }

  // Generate strategy parameters based on strategy type and coin characteristics
  private generateStrategyParameters(strategyName: string, coin: CoinCharacteristics): Record<string, any> {
    const strategy = STRATEGY_PROFILES[strategyName];
    const parameters: Record<string, any> = {};

    // Base parameters for all strategies
    parameters.timeframe = '15m';
    
    // Leverage based on risk level and coin characteristics
    let baseLeverage: number;
    switch (strategy.riskLevel) {
      case 'conservative':
        baseLeverage = Math.min(coin.maxLeverage, 10);
        break;
      case 'moderate':
        baseLeverage = Math.min(coin.maxLeverage, 20);
        break;
      case 'aggressive':
        baseLeverage = Math.min(coin.maxLeverage, Math.floor(coin.maxLeverage * 0.8));
        break;
    }
    parameters.leverage = baseLeverage;

    // Position size based on volatility and risk level
    let basePositionSize: number;
    if (coin.volatility === 'high') {
      basePositionSize = strategy.riskLevel === 'conservative' ? 50 : strategy.riskLevel === 'moderate' ? 100 : 200;
    } else if (coin.volatility === 'medium') {
      basePositionSize = strategy.riskLevel === 'conservative' ? 100 : strategy.riskLevel === 'moderate' ? 200 : 400;
    } else {
      basePositionSize = strategy.riskLevel === 'conservative' ? 200 : strategy.riskLevel === 'moderate' ? 400 : 800;
    }
    parameters.positionSize = basePositionSize;

    // Take profit and stop loss based on volatility and strategy type
    if (coin.volatility === 'high') {
      parameters.takeProfit = strategy.category === 'volatility' ? 8 : strategy.category === 'momentum' ? 6 : 4;
      parameters.stopLoss = strategy.riskLevel === 'conservative' ? 2 : strategy.riskLevel === 'moderate' ? 3 : 4;
    } else if (coin.volatility === 'medium') {
      parameters.takeProfit = strategy.category === 'trend' ? 4 : strategy.category === 'momentum' ? 3 : 2.5;
      parameters.stopLoss = strategy.riskLevel === 'conservative' ? 1.5 : strategy.riskLevel === 'moderate' ? 2 : 2.5;
    } else {
      parameters.takeProfit = strategy.category === 'trend' ? 2 : 1.5;
      parameters.stopLoss = strategy.riskLevel === 'conservative' ? 1 : strategy.riskLevel === 'moderate' ? 1.2 : 1.5;
    }

    // Trailing stop for high volatility or aggressive strategies
    parameters.trailingStop = coin.volatility === 'high' || strategy.riskLevel === 'aggressive';

    // Strategy-specific indicator parameters
    switch (strategyName) {
      case 'macd_supertrend_rsi':
        parameters.macd = { fast: 12, slow: 26, signal: 9 };
        parameters.supertrend = { period: 14, multiplier: 3 };
        parameters.rsi = { period: 14, overbought: 70, oversold: 30 };
        break;
      case 'ema_bb_stoch':
        parameters.ema = { period: coin.volatility === 'high' ? 21 : 20 };
        parameters.bollinger = { period: 20, stdDev: 2 };
        parameters.stochastic = { kPeriod: 14, dPeriod: 3 };
        break;
      case 'rsi_macd':
        parameters.rsi = { period: 14, overbought: 70, oversold: 30 };
        parameters.macd = { fast: 12, slow: 26, signal: 9 };
        break;
      case 'bb_rsi_volume':
        parameters.bollinger = { period: 20, stdDev: 2 };
        parameters.rsi = { period: 14, overbought: 75, oversold: 25 };
        parameters.volume = { period: 20, threshold: 1.5 };
        break;
      // Add more strategy-specific parameters as needed
      default:
        parameters.rsi = { period: 14, overbought: 70, oversold: 30 };
        parameters.ema = { period: 20 };
        break;
    }

    return parameters;
  }

  // Find best strategies for a coin
  public findBestStrategiesForCoin(coin: CoinCharacteristics, topN: number = 3): Array<{strategy: string, score: number}> {
    const scores: Array<{strategy: string, score: number}> = [];

    for (const [strategyName, strategyProfile] of Object.entries(STRATEGY_PROFILES)) {
      const score = this.calculateCompatibilityScore(coin, strategyProfile);
      scores.push({ strategy: strategyName, score });
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }

  // Main function to analyze all coins and create strategy mappings
  public async analyzeAllCoinsAndCreateMappings(progressCallback?: (progress: string) => void): Promise<{
    coinAnalysis: Map<string, CoinCharacteristics>,
    strategyMappings: Map<string, string[]>,
    configurations: StrategyConfiguration[]
  }> {
    try {
      progressCallback?.('Fetching trading pairs from Bybit...');
      
      // Get all available coins
      const coinsData = await coinsService.getCoins(false, progressCallback);
      const coins = Object.values(coinsData.details);
      
      progressCallback?.(`Analyzing ${coins.length} trading pairs...`);
      
      const coinAnalysis = new Map<string, CoinCharacteristics>();
      const strategyMappings = new Map<string, string[]>();
      const configurations: StrategyConfiguration[] = [];

      let processed = 0;
      
      for (const coinData of coins) {
        processed++;
        if (processed % 50 === 0) {
          progressCallback?.(`Analyzed ${processed}/${coins.length} coins...`);
        }

        // Analyze coin characteristics
        const characteristics = this.analyzeCoinCharacteristics(coinData);
        coinAnalysis.set(coinData.symbol, characteristics);

        // Find best strategies for this coin
        const bestStrategies = this.findBestStrategiesForCoin(characteristics, 1); // Top 1 strategy per coin
        
        if (bestStrategies.length > 0 && bestStrategies[0].score >= 30) { // Minimum 30% compatibility - lowered to include more coins
          const bestStrategy = bestStrategies[0];
          
          // Add to mappings
          if (!strategyMappings.has(bestStrategy.strategy)) {
            strategyMappings.set(bestStrategy.strategy, []);
          }
          strategyMappings.get(bestStrategy.strategy)!.push(coinData.symbol);

          // Generate configuration
          const parameters = this.generateStrategyParameters(bestStrategy.strategy, characteristics);
          const strategyProfile = STRATEGY_PROFILES[bestStrategy.strategy];
          
          const config: StrategyConfiguration = {
            id: `auto_${coinData.symbol}_${bestStrategy.strategy}_${Date.now()}`,
            name: `${strategyProfile.name} - ${coinData.baseCoin}`,
            symbol: coinData.symbol,
            strategy: bestStrategy.strategy,
            timeframe: parameters.timeframe,
            leverage: parameters.leverage,
            positionSize: parameters.positionSize,
            takeProfitPercentage: parameters.takeProfit,
            stopLossPercentage: parameters.stopLoss,
            trailingStop: parameters.trailingStop,
            riskScore: strategyProfile.riskLevel === 'conservative' ? 3 : strategyProfile.riskLevel === 'moderate' ? 5 : 8,
            expectedWinRate: this.calculateExpectedWinRate(bestStrategy.score, characteristics),
            optimizationScore: bestStrategy.score,
            indicators: this.getStrategyIndicators(bestStrategy.strategy),
            config: {
              strategy: bestStrategy.strategy,
              symbol: coinData.symbol,
              timeframe: parameters.timeframe,
              leverage: parameters.leverage,
              positionSize: parameters.positionSize,
              takeProfit: parameters.takeProfit,
              stopLoss: parameters.stopLoss,
              trailingStop: parameters.trailingStop,
              parameters
            },
            created: new Date().toISOString()
          };

          configurations.push(config);
        }
      }

      progressCallback?.(`Analysis complete! Generated ${configurations.length} strategy configurations`);

      // Store analysis results
      this.coinCharacteristics = coinAnalysis;
      this.strategyMappings = strategyMappings;

      return {
        coinAnalysis,
        strategyMappings,
        configurations
      };

    } catch (error) {
      console.error('Error in analyzeAllCoinsAndCreateMappings:', error);
      throw error;
    }
  }

  private calculateExpectedWinRate(compatibilityScore: number, coin: CoinCharacteristics): number {
    // Base win rate calculation based on compatibility score and coin characteristics
    let baseWinRate = 50 + (compatibilityScore * 0.3); // 50-80% based on compatibility

    // Adjust based on coin characteristics
    if (coin.marketCap === 'large') baseWinRate += 5;
    if (coin.volume === 'high') baseWinRate += 3;
    if (coin.volatility === 'medium') baseWinRate += 2; // Medium volatility often more predictable

    return Math.min(95, Math.max(55, Math.round(baseWinRate)));
  }

  private getStrategyIndicators(strategyName: string): string[] {
    // Extract indicators from strategy name
    const indicators: string[] = [];
    
    if (strategyName.includes('macd')) indicators.push('MACD');
    if (strategyName.includes('rsi')) indicators.push('RSI');
    if (strategyName.includes('ema')) indicators.push('EMA');
    if (strategyName.includes('sma')) indicators.push('SMA');
    if (strategyName.includes('bb')) indicators.push('Bollinger Bands');
    if (strategyName.includes('supertrend')) indicators.push('Supertrend');
    if (strategyName.includes('adx')) indicators.push('ADX');
    if (strategyName.includes('stoch')) indicators.push('Stochastic');
    if (strategyName.includes('psar')) indicators.push('PSAR');
    if (strategyName.includes('vwap')) indicators.push('VWAP');
    if (strategyName.includes('ichimoku')) indicators.push('Ichimoku');
    if (strategyName.includes('williams')) indicators.push('Williams %R');
    if (strategyName.includes('cci')) indicators.push('CCI');
    if (strategyName.includes('roc')) indicators.push('ROC');
    if (strategyName.includes('volume')) indicators.push('Volume');
    if (strategyName.includes('momentum')) indicators.push('Momentum');

    return indicators.length > 0 ? indicators : ['RSI', 'EMA']; // Default fallback
  }

  // Save all configurations to localStorage for Auto Trading Engine import
  public saveToLocalStorage(configurations: StrategyConfiguration[]): void {
    try {
      // Save in the format expected by the Auto Trading Engine
      const autoTradingStrategies = configurations.map(config => ({
        id: config.id,
        name: config.name,
        coinPair: config.symbol,
        strategy: config.strategy,
        timeframe: config.timeframe,
        leverage: config.leverage,
        fixedAmount: config.positionSize,
        takeProfitPercentage: config.takeProfitPercentage,
        stopLossPercentage: config.stopLossPercentage,
        trailingStop: config.trailingStop,
        riskScore: config.riskScore,
        expectedWinRate: config.expectedWinRate,
        optimizationScore: config.optimizationScore,
        indicators: config.indicators,
        status: 'ready',
        created: config.created,
        config: config.config
      }));

      // Save to localStorage for Auto Trading Engine import
      localStorage.setItem('auto_trading_strategies', JSON.stringify(autoTradingStrategies));
      localStorage.setItem('auto_trading_strategies_timestamp', Date.now().toString());
      
      // Also save in strategy builder format for compatibility
      const builderStrategies = configurations.map(config => ({
        id: config.id,
        name: config.name,
        symbol: config.symbol,
        status: 'READY',
        profit: 0,
        trades: 0,
        winRate: config.expectedWinRate,
        createdAt: config.created,
        description: `AI-matched ${config.strategy} for ${config.symbol.replace('USDT', '')}`,
        timeframe: config.timeframe,
        indicators: config.indicators,
        riskScore: config.riskScore,
        signalSource: 'AI-Automated',
        config: config.config
      }));

      const existingBuilderStrategies = JSON.parse(localStorage.getItem('saved_strategies') || '[]');
      const allBuilderStrategies = [...existingBuilderStrategies, ...builderStrategies];
      localStorage.setItem('saved_strategies', JSON.stringify(allBuilderStrategies));

      console.log(`Saved ${configurations.length} automated strategies to localStorage`);
      
    } catch (error) {
      console.error('Error saving strategies to localStorage:', error);
      throw error;
    }
  }

  // Get analysis summary
  public getAnalysisSummary(): {
    totalCoins: number,
    totalConfigurations: number,
    strategyDistribution: Record<string, number>,
    riskDistribution: Record<string, number>,
    volatilityDistribution: Record<string, number>
  } {
    const configurations = JSON.parse(localStorage.getItem('auto_trading_strategies') || '[]');
    
    const strategyDistribution: Record<string, number> = {};
    const riskDistribution: Record<string, number> = {};
    const volatilityDistribution: Record<string, number> = {};

    configurations.forEach((config: any) => {
      // Strategy distribution
      strategyDistribution[config.strategy] = (strategyDistribution[config.strategy] || 0) + 1;
      
      // Risk distribution
      const riskLevel = config.riskScore <= 3 ? 'Low' : config.riskScore <= 6 ? 'Medium' : 'High';
      riskDistribution[riskLevel] = (riskDistribution[riskLevel] || 0) + 1;
    });

    // Volatility distribution from coin characteristics
    this.coinCharacteristics.forEach(coin => {
      const vol = coin.volatility.charAt(0).toUpperCase() + coin.volatility.slice(1);
      volatilityDistribution[vol] = (volatilityDistribution[vol] || 0) + 1;
    });

    return {
      totalCoins: this.coinCharacteristics.size,
      totalConfigurations: configurations.length,
      strategyDistribution,
      riskDistribution,
      volatilityDistribution
    };
  }
}

// Export singleton instance
export const automatedStrategyMatcher = AutomatedStrategyMatcher.getInstance();