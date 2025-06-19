/**
 * Technical Indicators Service
 * Calculates real RSI, MACD, and other indicators using live market data
 */

import { bybitApi } from './api';

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    trend: 'Bullish' | 'Bearish' | 'Neutral';
  };
  ema20: number;
  ema50: number;
  support: number;
  resistance: number;
  trend: 'Uptrend' | 'Downtrend' | 'Sideways';
  momentum: 'Strong Bullish' | 'Bullish' | 'Neutral' | 'Bearish' | 'Strong Bearish';
}

export interface KlineData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) {
    return 50; // Default neutral RSI if insufficient data
  }

  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // Calculate average gains and losses
  const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
  const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;

  if (avgLoss === 0) return 100; // All gains
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return Math.round(rsi * 100) / 100;
}

/**
 * Calculate EMA (Exponential Moving Average)
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  
  const emas: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA is SMA
  const sma = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
  emas.push(sma);
  
  // Calculate subsequent EMAs
  for (let i = period; i < prices.length; i++) {
    const ema = (prices[i] * multiplier) + (emas[emas.length - 1] * (1 - multiplier));
    emas.push(ema);
  }
  
  return emas;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  
  if (fastEMA.length === 0 || slowEMA.length === 0) {
    return {
      macd: 0,
      signal: 0,
      histogram: 0,
      trend: 'Neutral' as const
    };
  }
  
  // Calculate MACD line
  const macdLine: number[] = [];
  const minLength = Math.min(fastEMA.length, slowEMA.length);
  
  for (let i = 0; i < minLength; i++) {
    macdLine.push(fastEMA[i] - slowEMA[i]);
  }
  
  // Calculate signal line (EMA of MACD)
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  if (macdLine.length === 0 || signalLine.length === 0) {
    return {
      macd: 0,
      signal: 0,
      histogram: 0,
      trend: 'Neutral' as const
    };
  }
  
  const currentMACD = macdLine[macdLine.length - 1] || 0;
  const currentSignal = signalLine[signalLine.length - 1] || 0;
  const histogram = currentMACD - currentSignal;
  
  // Determine trend
  let trend: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (currentMACD > currentSignal && histogram > 0) {
    trend = 'Bullish';
  } else if (currentMACD < currentSignal && histogram < 0) {
    trend = 'Bearish';
  }
  
  return {
    macd: Math.round(currentMACD * 10000) / 10000,
    signal: Math.round(currentSignal * 10000) / 10000,
    histogram: Math.round(histogram * 10000) / 10000,
    trend
  };
}

/**
 * Calculate Support and Resistance levels
 */
export function calculateSupportResistance(klineData: KlineData[]): { support: number; resistance: number } {
  if (klineData.length < 10) {
    const lastPrice = klineData[klineData.length - 1]?.close || 0;
    return {
      support: lastPrice * 0.95,
      resistance: lastPrice * 1.05
    };
  }

  const highs = klineData.map(k => k.high).sort((a, b) => b - a);
  const lows = klineData.map(k => k.low).sort((a, b) => a - b);
  
  // Take average of top/bottom 20% for more reliable levels
  const topHighs = highs.slice(0, Math.ceil(highs.length * 0.2));
  const bottomLows = lows.slice(0, Math.ceil(lows.length * 0.2));
  
  const resistance = topHighs.reduce((sum, high) => sum + high, 0) / topHighs.length;
  const support = bottomLows.reduce((sum, low) => sum + low, 0) / bottomLows.length;
  
  return {
    support: Math.round(support * 10000) / 10000,
    resistance: Math.round(resistance * 10000) / 10000
  };
}

/**
 * Get historical kline data from ByBit
 */
export async function getKlineData(symbol: string, interval: string = '1h', limit: number = 100): Promise<KlineData[]> {
  try {
    // Use ByBit's market data API to get kline data
    const response = await fetch(`/api/market/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch kline data: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error('Invalid kline data response');
    }
    
    // Convert ByBit kline format to our format
    return data.data.map((kline: any) => ({
      timestamp: parseInt(kline[0]) || Date.now(),
      open: parseFloat(kline[1]) || 0,
      high: parseFloat(kline[2]) || 0,
      low: parseFloat(kline[3]) || 0,
      close: parseFloat(kline[4]) || 0,
      volume: parseFloat(kline[5]) || 0
    }));
    
  } catch (error) {
    console.warn(`Failed to fetch kline data for ${symbol}:`, error);
    // Return empty array if API fails
    return [];
  }
}

/**
 * Calculate all technical indicators for a symbol
 */
export async function calculateTechnicalIndicators(symbol: string): Promise<TechnicalIndicators> {
  try {
    console.log(`📊 Calculating technical indicators for ${symbol}...`);
    
    // Get kline data (100 periods should be enough for accurate calculations)
    const klineData = await getKlineData(symbol, '1h', 100);
    
    if (klineData.length < 50) {
      console.warn(`⚠️ Insufficient kline data for ${symbol}, using defaults`);
      return getDefaultIndicators();
    }
    
    const closePrices = klineData.map(k => k.close);
    const currentPrice = closePrices[closePrices.length - 1] || 0;
    
    // Calculate RSI
    const rsi = calculateRSI(closePrices, 14);
    
    // Calculate MACD
    const macd = calculateMACD(closePrices, 12, 26, 9);
    
    // Calculate EMAs
    const ema20Array = calculateEMA(closePrices, 20);
    const ema50Array = calculateEMA(closePrices, 50);
    const ema20 = ema20Array[ema20Array.length - 1] || currentPrice;
    const ema50 = ema50Array[ema50Array.length - 1] || currentPrice;
    
    // Calculate support/resistance
    const { support, resistance } = calculateSupportResistance(klineData);
    
    // Determine overall trend
    let trend: 'Uptrend' | 'Downtrend' | 'Sideways' = 'Sideways';
    if (ema20 > ema50 && currentPrice > ema20) {
      trend = 'Uptrend';
    } else if (ema20 < ema50 && currentPrice < ema20) {
      trend = 'Downtrend';
    }
    
    // Determine momentum
    let momentum: 'Strong Bullish' | 'Bullish' | 'Neutral' | 'Bearish' | 'Strong Bearish' = 'Neutral';
    if (rsi > 70 && macd.trend === 'Bullish' && trend === 'Uptrend') {
      momentum = 'Strong Bullish';
    } else if (rsi > 60 && macd.trend === 'Bullish') {
      momentum = 'Bullish';
    } else if (rsi < 30 && macd.trend === 'Bearish' && trend === 'Downtrend') {
      momentum = 'Strong Bearish';
    } else if (rsi < 40 && macd.trend === 'Bearish') {
      momentum = 'Bearish';
    }
    
    console.log(`✅ Technical indicators calculated for ${symbol}: RSI=${rsi}, MACD=${macd.trend}, Trend=${trend}`);
    
    return {
      rsi,
      macd,
      ema20,
      ema50,
      support,
      resistance,
      trend,
      momentum
    };
    
  } catch (error) {
    console.error(`❌ Error calculating technical indicators for ${symbol}:`, error);
    return getDefaultIndicators();
  }
}

/**
 * Default indicators when calculation fails
 */
function getDefaultIndicators(): TechnicalIndicators {
  return {
    rsi: 50,
    macd: {
      macd: 0,
      signal: 0,
      histogram: 0,
      trend: 'Neutral'
    },
    ema20: 0,
    ema50: 0,
    support: 0,
    resistance: 0,
    trend: 'Sideways',
    momentum: 'Neutral'
  };
}

export default {
  calculateRSI,
  calculateEMA,
  calculateMACD,
  calculateSupportResistance,
  getKlineData,
  calculateTechnicalIndicators
};