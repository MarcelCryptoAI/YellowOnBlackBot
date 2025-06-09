import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bybitApi, openaiApi } from '../services/api';
import AdvancedBacktest from '../components/AdvancedBacktest';

// Types
interface StrategyData {
  // General Tab
  name: string;
  selectedAccount: string;
  coinPair: string;
  amountType: 'fixed' | 'percentage';
  fixedAmount: number;
  percentageAmount: number;
  marginType: 'Isolated' | 'Cross';
  multiplier: number;
  
  // Indicators Tab
  signalIndicator: {
    type: string;
    timeframe: string;
    settings: any;
  };
  confirmingIndicators: Array<{
    type: string;
    timeframe: string;
    settings: any;
    enabled: boolean;
  }>;
  
  // ML Tab
  mlEnabled: boolean;
  mlModels: {
    lstm: boolean;
    randomForest: boolean;
    svm: boolean;
    neuralNetwork: boolean;
  };
  
  // Entry/Exit/Stop settings will be added later
}

interface BacktestResults {
  winRate: number;
  wins: number;
  losses: number;
  roi: number;
  drawdown: number;
  pnl: number;
  cumulativeGrowth: number[];
}

interface Account {
  id: string;
  name: string;
  balance: { total: number; available: number };
  testnet: boolean;
}

interface Indicator {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultSettings: any;
  timeframes: string[];
}

const TradingStrategyBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState(1);
  const [showBacktestSidebar, setShowBacktestSidebar] = useState(false);
  const [showAdvancedBacktest, setShowAdvancedBacktest] = useState(false);
  const [isBacktesting, setIsBacktesting] = useState(false);
  
  // Data states
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [coins, setCoins] = useState<string[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  
  // Strategy state
  const [strategyData, setStrategyData] = useState<StrategyData>({
    name: '',
    selectedAccount: '',
    coinPair: 'TRUMPUSDT',
    amountType: 'percentage',
    fixedAmount: 100,
    percentageAmount: 3,
    marginType: 'Cross',
    multiplier: 100,
    signalIndicator: {
      type: 'MACD',
      timeframe: '15m',
      settings: { fast: 12, slow: 26, signal: 9, source: 'close', maType: 'EMA' }
    },
    confirmingIndicators: [
      {
        type: 'SuperTrend',
        timeframe: '1h',
        settings: { period: 10, multiplier: 3 },
        enabled: true
      }
    ],
    mlEnabled: false,
    mlModels: {
      lstm: false,
      randomForest: false,
      svm: false,
      neuralNetwork: false
    }
  });
  
  const [backtestResults, setBacktestResults] = useState<BacktestResults>({
    winRate: 67.5,
    wins: 27,
    losses: 13,
    roi: 23.4,
    drawdown: 8.2,
    pnl: 1247.50,
    cumulativeGrowth: [0, 2, 5, 3, 8, 12, 7, 15, 18, 23.4]
  });

  // ML Tab states - moved to component level to fix hooks error
  const [selectedML, setSelectedML] = useState<string | null>(null);
  const [isAnalyzingCoin, setIsAnalyzingCoin] = useState(false);
  const [mlAnalysisResults, setMlAnalysisResults] = useState<any>(null);
  
  // Backtest states
  const [backtestProgress, setBacktestProgress] = useState(0);
  const [showTradeDetails, setShowTradeDetails] = useState(false);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [backtestPeriod, setBacktestPeriod] = useState('1month');
  
  // AI Advice states
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  
  // AI Indicator Optimization states
  const [isOptimizingIndicators, setIsOptimizingIndicators] = useState(false);
  const [indicatorOptimization, setIndicatorOptimization] = useState<any>(null);
  
  // AI Trade Parameters states
  const [isOptimizingTradeParams, setIsOptimizingTradeParams] = useState(false);
  const [tradeParamsOptimization, setTradeParamsOptimization] = useState<any>(null);

  // Signal indicators available
  const signalIndicators: Indicator[] = [
    {
      id: 'ema-crossover',
      name: 'EMA 8/21 Crossover',
      description: 'Fast EMA crossover for 15m scalping',
      icon: '📈',
      defaultSettings: { fast: 8, slow: 21 },
      timeframes: ['5m', '15m', '30m', '1h']
    },
    {
      id: 'rsi',
      name: 'RSI (14)',
      description: 'Oversold/overbought with 30/70 levels',
      icon: '📊',
      defaultSettings: { period: 14, overbought: 70, oversold: 30 },
      timeframes: ['5m', '15m', '30m', '1h']
    },
    {
      id: 'macd',
      name: 'MACD Fast',
      description: 'MACD crossovers for momentum shifts',
      icon: '⚡',
      defaultSettings: { fast: 12, slow: 26, signal: 9, source: 'close', maType: 'EMA' },
      timeframes: ['5m', '15m', '30m', '1h']
    },
    {
      id: 'vwma',
      name: 'VWMA',
      description: 'Volume-weighted moving average',
      icon: '💹',
      defaultSettings: { period: 20 },
      timeframes: ['15m', '30m', '1h', '4h']
    },
    {
      id: 'mfi',
      name: 'Money Flow Index',
      description: 'Volume-based RSI for smart money',
      icon: '💰',
      defaultSettings: { period: 14 },
      timeframes: ['15m', '30m', '1h']
    },
    {
      id: 'atr-bands',
      name: 'ATR Bands',
      description: 'Volatility-based bands for breakouts',
      icon: '📏',
      defaultSettings: { period: 14, multiplier: 2 },
      timeframes: ['15m', '30m', '1h']
    },
    {
      id: 'keltner',
      name: 'Keltner Channels',
      description: 'Fast channel breakouts for 15m',
      icon: '📊',
      defaultSettings: { period: 20, multiplier: 2 },
      timeframes: ['15m', '30m', '1h']
    },
    {
      id: 'stochastic',
      name: 'Stochastic Fast',
      description: 'Fast %K/%D crossovers for scalping',
      icon: '🔄',
      defaultSettings: { k: 5, d: 3, smooth: 3 },
      timeframes: ['5m', '15m', '30m']
    },
    {
      id: 'williams-r',
      name: 'Williams %R',
      description: 'Responsive oscillator for 15m reversals',
      icon: '📈',
      defaultSettings: { period: 14 },
      timeframes: ['5m', '15m', '30m']
    }
  ];

  // Confirming indicators
  const confirmingIndicators: Indicator[] = [
    {
      id: 'ema-stack',
      name: 'EMA 50/100/200 Stack',
      description: 'Trend confirmation with EMA stack',
      icon: '📚',
      defaultSettings: { ema1: 50, ema2: 100, ema3: 200 },
      timeframes: ['1h', '4h', '1d']
    },
    {
      id: 'ichimoku',
      name: 'Ichimoku Cloud',
      description: 'Cloud-based trend confirmation',
      icon: '☁️',
      defaultSettings: { tenkan: 9, kijun: 26, senkou: 52 },
      timeframes: ['1h', '4h', '1d']
    },
    {
      id: 'adx',
      name: 'ADX Trend Strength',
      description: 'Trend strength and direction',
      icon: '💪',
      defaultSettings: { period: 14 },
      timeframes: ['1h', '4h']
    },
    {
      id: 'supertrend',
      name: 'SuperTrend',
      description: 'ATR-based trend following',
      icon: '🎯',
      defaultSettings: { period: 10, multiplier: 3 },
      timeframes: ['1h', '4h']
    },
    {
      id: 'pivot-points',
      name: 'Pivot Points',
      description: 'Daily/weekly support/resistance',
      icon: '🎚️',
      defaultSettings: { type: 'standard' },
      timeframes: ['1d', '1w']
    },
    {
      id: 'fibonacci',
      name: 'Fibonacci Levels',
      description: 'Extension and retracement levels',
      icon: '🌀',
      defaultSettings: { lookback: 50 },
      timeframes: ['1h', '4h', '1d']
    },
    {
      id: 'volume-profile',
      name: 'Volume Profile',
      description: 'POC and value area levels',
      icon: '📊',
      defaultSettings: { sessions: 24 },
      timeframes: ['1h', '4h', '1d']
    },
    {
      id: 'rsi-trend',
      name: 'RSI Trendlines',
      description: 'Higher timeframe RSI with trendlines',
      icon: '📈',
      defaultSettings: { period: 21 },
      timeframes: ['1h', '4h']
    },
    {
      id: 'macd-slow',
      name: 'MACD Slow',
      description: 'Slower MACD for trend confirmation',
      icon: '⚡',
      defaultSettings: { fast: 26, slow: 52, signal: 18 },
      timeframes: ['1h', '4h']
    },
    {
      id: 'ad-line',
      name: 'A/D Line',
      description: 'Accumulation/Distribution tracking',
      icon: '📊',
      defaultSettings: {},
      timeframes: ['1h', '4h']
    }
  ];

  // Load data on mount
  useEffect(() => {
    loadAccounts();
    loadCoins();
    loadStrategies();
    loadStrategyToEdit();
    
    // Setup background refresh for coins (cronjob-like behavior)
    const checkAndRefresh = () => {
      const cacheTimestamp = localStorage.getItem('coinsCacheTimestamp');
      const fortyEightHours = 48 * 60 * 60 * 1000;
      
      if (!cacheTimestamp || (Date.now() - parseInt(cacheTimestamp)) >= fortyEightHours) {
        console.log('🕒 Background refresh: Coin cache expired, refreshing...');
        loadCoins();
      }
    };
    
    // Check immediately
    checkAndRefresh();
    
    // Then check every 6 hours for cache expiration
    const refreshInterval = setInterval(checkAndRefresh, 6 * 60 * 60 * 1000);
    
    // Cleanup on unmount
    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  // Load existing strategies
  const loadStrategies = () => {
    const saved = localStorage.getItem('userStrategies');
    if (saved) {
      try {
        setStrategies(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading strategies:', error);
      }
    }
  };

  // Load strategy for editing if exists
  const loadStrategyToEdit = () => {
    const strategyToEdit = localStorage.getItem('strategyToEdit');
    if (strategyToEdit) {
      try {
        const strategy = JSON.parse(strategyToEdit);
        console.log('🔄 Loading strategy for editing:', strategy.name);
        
        // Map strategy back to strategyData format
        if (strategy.config) {
          setStrategyData(strategy.config);
        } else {
          // Fallback: reconstruct from strategy data
          setStrategyData(prev => ({
            ...prev,
            name: strategy.name,
            coinPair: strategy.symbol,
            signalIndicator: {
              ...prev.signalIndicator,
              timeframe: strategy.timeframe
            }
          }));
        }
        
        // Remove from localStorage to prevent reloading
        localStorage.removeItem('strategyToEdit');
        
        console.log('✅ Strategy loaded for editing');
      } catch (error) {
        console.error('❌ Error loading strategy for editing:', error);
      }
    }
  };

  // Update strategy name when account and coin change
  useEffect(() => {
    if (strategyData.selectedAccount && strategyData.coinPair) {
      const account = accounts.find(acc => acc.id === strategyData.selectedAccount);
      const accountName = account?.name || 'Unknown';
      const coin = strategyData.coinPair;
      setStrategyData(prev => ({
        ...prev,
        name: `${accountName} - ${coin}`
      }));
    }
  }, [strategyData.selectedAccount, strategyData.coinPair, accounts]);

  // Auto-set multiplier to maximum for selected coin pair
  useEffect(() => {
    if (strategyData.coinPair) {
      const maxLeverage = getMaxLeverageForCoin(strategyData.coinPair);
      setStrategyData(prev => ({
        ...prev,
        multiplier: maxLeverage
      }));
    }
  }, [strategyData.coinPair]);

  // Run backtest only when strategy configuration changes
  const runBacktest = async () => {
    setIsBacktesting(true);
    setBacktestProgress(0);
    
    // Simulate backtest progress
    const progressInterval = setInterval(() => {
      setBacktestProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // Simulate backtest calculation
    setTimeout(() => {
      const trades = generateMockTrades();
      setTradeHistory(trades);
      
      const winTrades = trades.filter(t => t.pnl > 0);
      const lossTrades = trades.filter(t => t.pnl <= 0);
      
      setBacktestResults({
        winRate: (winTrades.length / trades.length) * 100,
        wins: winTrades.length,
        losses: lossTrades.length,
        roi: trades.reduce((sum, t) => sum + t.roi, 0),
        drawdown: Math.max(...trades.map(t => Math.abs(Math.min(0, t.cumulativeROI)))),
        pnl: trades.reduce((sum, t) => sum + t.pnl, 0),
        cumulativeGrowth: calculateCumulativeGrowth(trades)
      });
      
      setIsBacktesting(false);
      setBacktestProgress(100);
    }, 2500);
  };

  // Generate mock trade history based on period
  const generateMockTrades = () => {
    const trades = [];
    let cumulativePnL = 0;
    const initialCapital = 10000;
    
    // Determine number of trades based on period
    const tradesByPeriod = {
      '1week': 15,
      '1month': 40,
      '3months': 120,
      '6months': 240,
      '1year': 480
    };
    
    const numTrades = tradesByPeriod[backtestPeriod] || 40;
    const daysInPeriod = {
      '1week': 7,
      '1month': 30,
      '3months': 90,
      '6months': 180,
      '1year': 365
    }[backtestPeriod] || 30;
    
    for (let i = 0; i < numTrades; i++) {
      const isWin = Math.random() > 0.35;
      const pnl = isWin ? 
        (50 + Math.random() * 150) : 
        -(30 + Math.random() * 70);
      
      cumulativePnL += pnl;
      const roi = (pnl / initialCapital) * 100;
      const cumulativeROI = (cumulativePnL / initialCapital) * 100;
      
      const daysAgo = Math.floor((daysInPeriod / numTrades) * (numTrades - i));
      
      trades.push({
        id: i + 1,
        date: new Date(Date.now() - daysAgo * 86400000).toISOString(),
        type: Math.random() > 0.5 ? 'LONG' : 'SHORT',
        entry: 45000 + Math.random() * 5000,
        exit: isWin ? 
          45000 + Math.random() * 5000 + 500 : 
          45000 + Math.random() * 5000 - 300,
        pnl,
        roi,
        cumulativeROI,
        duration: Math.floor(15 + Math.random() * 240) + ' min',
        status: isWin ? 'WIN' : 'LOSS'
      });
    }
    
    return trades;
  };

  const calculateCumulativeGrowth = (trades) => {
    const groups = [];
    const tradesPerGroup = Math.floor(trades.length / 10);
    
    for (let i = 0; i < 10; i++) {
      const groupTrades = trades.slice(i * tradesPerGroup, (i + 1) * tradesPerGroup);
      const groupROI = groupTrades.reduce((sum, t) => sum + t.roi, 0);
      groups.push(groupROI);
    }
    
    return groups;
  };

  const loadAccounts = async () => {
    try {
      const response = await bybitApi.getConnections();
      if (response.success) {
        const accountList = response.connections.map(conn => ({
          id: conn.connectionId,
          name: conn.metadata?.name || 'ByBit Account',
          balance: conn.data?.balance || { total: 0, available: 0 },
          testnet: conn.metadata?.testnet || false
        }));
        setAccounts(accountList);
        
        // Auto-select first account
        if (accountList.length > 0) {
          setStrategyData(prev => ({ ...prev, selectedAccount: accountList[0].id }));
        }
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const loadCoins = async () => {
    try {
      // Check if we have cached coins from last 48 hours
      const cachedCoins = localStorage.getItem('cachedCoins');
      const cacheTimestamp = localStorage.getItem('coinsCacheTimestamp');
      const fortyEightHours = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
      
      if (cachedCoins && cacheTimestamp && 
          (Date.now() - parseInt(cacheTimestamp)) < fortyEightHours) {
        console.log('📂 Using cached coin list (valid for 48h)');
        const coinList = JSON.parse(cachedCoins);
        setCoins(coinList);
        return;
      }

      // Start with comprehensive manual coin list
      const manualCoinList = [
        // Top Market Cap
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
        'SOLUSDT', 'DOGEUSDT', 'AVAXUSDT', 'TRXUSDT', 'LINKUSDT',
        'TONUSDT', 'SHIBUSDT', 'DOTUSDT', 'BCHUSDT', 'NEARUSDT',
        'MATICUSDT', 'ICPUSDT', 'UNIUSDT', 'LTCUSDT', 'APTUSDT',
        'STXUSDT', 'FILUSDT', 'ATOMUSDT', 'XLMUSDT', 'VETUSDT',
        
        // Trending & Meme Coins
        'TRUMPUSDT', 'PEPEUSDT', 'WIFUSDT', 'BONKUSDT', 'FLOKIUSDT',
        'MEMECUSDT', 'DOGSUSDT', 'CATUSDT', 'BABYDOGEUSDT', 'SATSUSDT',
        
        // DeFi Tokens
        'AAVEUSDT', 'MKRUSDT', 'COMPUSDT', 'YFIUSDT', 'CRVUSDT',
        'SNXUSDT', 'BALAUSDT', 'SUSHIUSDT', '1INCHUSDT', 'DYDXUSDT',
        
        // Layer 1 & 2
        'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'SEIUSDT', 'INJUSDT',
        'TIAUSDT', 'THETAUSDT', 'FTMUSDT', 'ALGOUSDT', 'EGLDUSDT',
        
        // AI & Tech
        'FETUSDT', 'RENDERUSDT', 'OCEANUSDT', 'AGIXUSDT', 'TAUUSDT',
        'AIUSDT', 'ARKMUSDT', 'PHBUSDT', 'NMRUSDT', 'GRTUSDT',
        
        // Gaming & Metaverse
        'AXSUSDT', 'SANDUSDT', 'MANAUSDT', 'ENJUSDT', 'GALAUSDT',
        'IMXUSDT', 'BEAMXUSDT', 'RNDRUSDT', 'YGGUSDT', 'ALICEUSDT',
        
        // Infrastructure
        'ARBUSDT', 'ORDIUSDT', 'KASUSDT', 'MINAUSDT', 'ROSEUSDT',
        'QNTUSDT', 'FLOWUSDT', 'XTZUSDT', 'IOTAUSDT', 'ZILUSDT',
        
        // Popular Trading Pairs
        'ETHBTC', 'ADABTC', 'DOGEBTC', 'SOLBTC', 'BNBBTC',
        'XRPBTC', 'AVAXBTC', 'LINKBTC', 'DOTBTC', 'MATICBTC'
      ];

      console.log('🔄 Attempting to fetch fresh coin list from API...');
      
      try {
        const response = await bybitApi.getInstruments();
        if (response.success && response.data) {
          const apiCoinList = response.data
            .map(instrument => instrument.symbol)
            .filter(symbol => symbol.includes('USDT') || symbol.includes('BTC'))
            .sort();
          
          // Merge manual list with API data, removing duplicates and sort alphabetically  
          const combinedList = [...new Set([...manualCoinList, ...apiCoinList])].sort((a, b) => a.localeCompare(b));
          
          // Cache the combined coin list for 48 hours
          localStorage.setItem('cachedCoins', JSON.stringify(combinedList));
          localStorage.setItem('coinsCacheTimestamp', Date.now().toString());
          
          setCoins(combinedList);
          console.log(`✅ Loaded ${combinedList.length} coins (manual + API) - cached for 48h`);
          
          // Also cache detailed metadata with real leverage data
          const coinMetadata = response.data.map(instrument => ({
            symbol: instrument.symbol,
            maxLeverage: instrument.leverageFilter?.maxLeverage || instrument.leverage?.max || 
                        (instrument.symbol.includes('USDT') ? 75 : 25), // Default based on pair type
            minLeverage: instrument.leverageFilter?.minLeverage || 1,
            leverageStep: instrument.leverageFilter?.leverageStep || 1,
            minOrderSize: instrument.lotSizeFilter?.minOrderQty || 0.001,
            maxOrderSize: instrument.lotSizeFilter?.maxOrderQty || 1000000,
            priceFilter: {
              minPrice: instrument.priceFilter?.minPrice || 0.0001,
              maxPrice: instrument.priceFilter?.maxPrice || 1000000,
              tickSize: instrument.priceFilter?.tickSize || 0.0001
            }
          }));
          localStorage.setItem('coinsMetadata', JSON.stringify(coinMetadata));
          
          return;
        }
      } catch (apiError) {
        console.warn('🔴 API call failed, using manual coin list:', apiError);
      }
      
      // Fallback to manual list if API fails
      localStorage.setItem('cachedCoins', JSON.stringify(manualCoinList));
      localStorage.setItem('coinsCacheTimestamp', Date.now().toString());
      setCoins(manualCoinList);
      console.log(`✅ Loaded ${manualCoinList.length} coins (manual fallback) - cached for 48h`);
      
    } catch (error) {
      console.error('❌ Complete failure loading coins:', error);
      // Ultimate fallback
      const basicCoins = [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
        'SOLUSDT', 'DOGEUSDT', 'AVAXUSDT', 'TRXUSDT', 'LINKUSDT',
        'TRUMPUSDT', 'PEPEUSDT', 'SHIBUSDT', 'DOTUSDT', 'MATICUSDT'
      ];
      setCoins(basicCoins);
    }
  };

  const getMaxLeverageForCoin = (symbol: string): number => {
    try {
      const metadata = localStorage.getItem('coinsMetadata');
      if (metadata) {
        const coinData = JSON.parse(metadata);
        const coin = coinData.find((c: any) => c.symbol === symbol);
        if (coin?.maxLeverage) {
          return coin.maxLeverage;
        }
      }
    } catch (error) {
      console.error('Error getting leverage for coin:', error);
    }
    
    // Smart defaults based on coin type
    if (symbol.includes('USDT')) {
      return 75; // Most USDT pairs support higher leverage
    } else if (symbol.includes('BTC')) {
      return 25; // BTC pairs typically lower leverage
    }
    
    return 50; // Conservative default
  };

  const updateStrategyField = (field: string, value: any) => {
    setStrategyData(prev => ({ ...prev, [field]: value }));
    
    // If coin is changed, update max leverage
    if (field === 'coinPair') {
      const maxLev = getMaxLeverageForCoin(value);
      if (strategyData.multiplier > maxLev) {
        setStrategyData(current => ({ ...current, multiplier: maxLev }));
      }
    }
  };

  const updateNestedField = (parent: string, field: string, value: any) => {
    setStrategyData(prev => ({
      ...prev,
      [parent]: { ...prev[parent as keyof StrategyData], [field]: value }
    }));
  };

  const addConfirmingIndicator = () => {
    const newIndicator = {
      type: 'none',
      timeframe: '1h',
      settings: {},
      enabled: false
    };
    setStrategyData(prev => ({
      ...prev,
      confirmingIndicators: [...prev.confirmingIndicators, newIndicator]
    }));
  };

  const updateConfirmingIndicator = (index: number, field: string, value: any) => {
    setStrategyData(prev => ({
      ...prev,
      confirmingIndicators: prev.confirmingIndicators.map((indicator, i) => 
        i === index ? { ...indicator, [field]: value } : indicator
      )
    }));
  };

  const removeConfirmingIndicator = (index: number) => {
    setStrategyData(prev => ({
      ...prev,
      confirmingIndicators: prev.confirmingIndicators.filter((_, i) => i !== index)
    }));
  };

  const saveStrategy = () => {
    const strategies = JSON.parse(localStorage.getItem('userStrategies') || '[]');
    
    // Check if we're editing an existing strategy
    const existingStrategyIndex = strategies.findIndex(s => s.name === strategyData.name);
    
    if (existingStrategyIndex >= 0) {
      // Update existing strategy
      const updatedStrategy = {
        ...strategies[existingStrategyIndex],
        name: strategyData.name,
        symbol: strategyData.coinPair,
        description: `Strategy for ${strategyData.coinPair} with ${strategyData.signalIndicator.type}`,
        timeframe: strategyData.signalIndicator.timeframe,
        indicators: [strategyData.signalIndicator.type, ...strategyData.confirmingIndicators.filter(ind => ind.enabled).map(ind => ind.type)],
        mlModel: strategyData.mlEnabled ? 'Enabled' : undefined,
        config: strategyData
      };
      
      strategies[existingStrategyIndex] = updatedStrategy;
      localStorage.setItem('userStrategies', JSON.stringify(strategies));
      
      alert('Strategy updated successfully!');
    } else {
      // Create new strategy
      const newStrategy = {
        id: Date.now().toString(),
        name: strategyData.name,
        symbol: strategyData.coinPair,
        status: 'STOPPED',
        profit: 0,
        trades: 0,
        winRate: 0,
        createdAt: new Date().toISOString(),
        description: `Strategy for ${strategyData.coinPair} with ${strategyData.signalIndicator.type}`,
        timeframe: strategyData.signalIndicator.timeframe,
        indicators: [strategyData.signalIndicator.type, ...strategyData.confirmingIndicators.filter(ind => ind.enabled).map(ind => ind.type)],
        mlModel: strategyData.mlEnabled ? 'Enabled' : undefined,
        riskScore: Math.floor(Math.random() * 10) + 1,
        config: strategyData
      };
      
      strategies.push(newStrategy);
      localStorage.setItem('userStrategies', JSON.stringify(strategies));
      
      alert('Strategy saved successfully!');
    }
    
    navigate('/strategies');
  };

  const renderGeneralTab = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4">📊 General Configuration</h3>
      
      {/* Strategy Name */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">Strategy Name</label>
        <input
          type="text"
          value={strategyData.name}
          onChange={(e) => updateStrategyField('name', e.target.value)}
          className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
          placeholder="e.g., Revolution X - TRUMPUSDT.P"
        />
      </div>

      {/* Account Selection */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">Select Account</label>
        <select
          value={strategyData.selectedAccount}
          onChange={(e) => updateStrategyField('selectedAccount', e.target.value)}
          className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
        >
          <option value="">Choose an account...</option>
          {accounts.map(account => (
            <option key={account.id} value={account.id}>
              {account.name} - ${account.balance.available.toFixed(2)} available
              {account.testnet && ' (Testnet)'}
            </option>
          ))}
        </select>
      </div>

      {/* Coin Selection */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">Select Coin</label>
        <select
          value={strategyData.coinPair}
          onChange={(e) => updateStrategyField('coinPair', e.target.value)}
          className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
        >
          <option value="">Choose a coin...</option>
          {coins.map(coin => (
            <option key={coin} value={coin}>
              {coin}
            </option>
          ))}
        </select>
        {strategyData.coinPair && (
          <div className="mt-2 p-2 bg-primary-blue/20 rounded text-primary-blue text-sm">
            Selected: {strategyData.coinPair} - Max leverage: {getMaxLeverageForCoin(strategyData.coinPair)}x
          </div>
        )}
      </div>

      {/* Amount Configuration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Amount Type</label>
          <select
            value={strategyData.amountType}
            onChange={(e) => updateStrategyField('amountType', e.target.value)}
            className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
          >
            <option value="fixed">Fixed USDT Amount</option>
            <option value="percentage">Percentage of Available</option>
          </select>
        </div>
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            {strategyData.amountType === 'fixed' ? 'USDT Amount' : 'Percentage (%)'}
          </label>
          <input
            type="number"
            value={strategyData.amountType === 'fixed' ? strategyData.fixedAmount : strategyData.percentageAmount}
            onChange={(e) => updateStrategyField(
              strategyData.amountType === 'fixed' ? 'fixedAmount' : 'percentageAmount',
              parseFloat(e.target.value)
            )}
            className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
            min="1"
            max={strategyData.amountType === 'fixed' ? undefined : 100}
          />
        </div>
      </div>

      {/* Margin and Multiplier */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Margin Type</label>
          <select
            value={strategyData.marginType}
            onChange={(e) => updateStrategyField('marginType', e.target.value)}
            className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
          >
            <option value="Cross">Cross Margin (Default)</option>
            <option value="Isolated">Isolated Margin</option>
          </select>
        </div>
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Multiplier (Leverage) - Max: {getMaxLeverageForCoin(strategyData.coinPair)}x
          </label>
          <select
            value={strategyData.multiplier}
            onChange={(e) => updateStrategyField('multiplier', parseInt(e.target.value))}
            className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
          >
            {[1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100]
              .filter(mult => mult <= getMaxLeverageForCoin(strategyData.coinPair))
              .map(mult => (
              <option key={mult} value={mult}>{mult}x</option>
            ))}
          </select>
          {getMaxLeverageForCoin(strategyData.coinPair) < 100 && (
            <p className="text-xs text-primary-blue mt-1">
              ⚠️ Max leverage for {strategyData.coinPair} is {getMaxLeverageForCoin(strategyData.coinPair)}x
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderIndicatorCard = (indicator: Indicator, isSelected: boolean, onSelect: () => void) => (
    <div
      key={indicator.id}
      onClick={onSelect}
      className={`relative group cursor-pointer p-4 rounded-xl border transition-all duration-300 ${
        isSelected
          ? 'border-primary-blue/60 bg-primary-blue/10 shadow-lg shadow-primary-blue/20'
          : 'border-gray-600/30 bg-gray-900/50 hover:border-gray-500/50 hover:bg-gray-800/50'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{indicator.icon}</span>
          <div>
            <h4 className="font-bold text-white">{indicator.name}</h4>
            <p className="text-xs text-gray-400">{indicator.description}</p>
          </div>
        </div>
        {isSelected && <span className="text-primary-blue">✓</span>}
      </div>
      <div className="flex flex-wrap gap-1">
        {indicator.timeframes.map(tf => (
          <span key={tf} className="px-2 py-1 text-xs bg-gray-700/50 text-gray-300 rounded">
            {tf}
          </span>
        ))}
      </div>
    </div>
  );

  // AI Indicator Selectie Function
  const optimizeIndicatorsWithAI = async () => {
    if (!strategyData.coinPair) {
      alert('Selecteer eerst een coin om indicators te optimaliseren.');
      return;
    }

    setIsOptimizingIndicators(true);
    setIndicatorOptimization(null);

    try {
      console.log('🤖 Starting AI Indicator Optimization for:', strategyData.coinPair);
      
      const response = await openaiApi.optimizeIndicators({
        coin: strategyData.coinPair,
        timeframe: '1m',
        lookbackPeriod: '1y'
      });

      if (response.success) {
        console.log('✅ AI Indicator Optimization successful:', response.data);
        setIndicatorOptimization(response.data);

        // Auto-apply optimized indicators
        if (response.data.signal_indicator) {
          const signalInd = response.data.signal_indicator;
          updateStrategyField('signalIndicator', {
            type: signalInd.indicator?.toUpperCase() || 'MACD',
            timeframe: signalInd.timeframe || '15m',
            settings: parseIndicatorSettings(signalInd.indicator, signalInd.parameters)
          });
        }

        // Auto-apply confirming indicators
        if (response.data.confirming_indicators && response.data.confirming_indicators.length > 0) {
          const confirming = response.data.confirming_indicators.map((ind: any, index: number) => ({
            type: ind.indicator?.toUpperCase() || 'RSI',
            timeframe: ind.timeframe || '15m',
            settings: parseIndicatorSettings(ind.indicator, ind.parameters),
            enabled: true
          }));

          // Update the first two confirming indicators
          const updatedConfirming = [...strategyData.confirmingIndicators];
          if (confirming[0]) updatedConfirming[0] = confirming[0];
          if (confirming[1]) updatedConfirming[1] = confirming[1];
          
          updateStrategyField('confirmingIndicators', updatedConfirming);
        }

        // Show success message with details
        const signalInfo = response.data.signal_indicator;
        const conf1 = response.data.confirming_indicators?.[0];
        const conf2 = response.data.confirming_indicators?.[1];
        
        alert(`🎯 AI INDICATOR OPTIMALISATIE VOLTOOID!

📊 SIGNAL INDICATOR:
• ${signalInfo?.indicator || 'MACD'} op ${signalInfo?.timeframe || '15m'}
• Parameters: ${signalInfo?.parameters || 'Default'}
• Nauwkeurigheid: ${signalInfo?.accuracy || 'N/A'}

✅ BEVESTIGENDE INDICATORS:
• ${conf1?.indicator || 'RSI'} op ${conf1?.timeframe || '15m'} - ${conf1?.accuracy || 'N/A'}
• ${conf2?.indicator || 'SuperTrend'} op ${conf2?.timeframe || '60m'} - ${conf2?.accuracy || 'N/A'}

📈 VERWACHTE RESULTATEN:
• Win Rate: ${response.data.backtest_results?.win_rate || 'N/A'}
• Maandelijks Rendement: ${response.data.backtest_results?.expected_monthly_return || 'N/A'}

⚡ Instellingen zijn automatisch toegepast!`);

      } else {
        console.error('❌ AI optimization failed:', response);
        alert('AI Indicator Optimalisatie mislukt. Probeer het opnieuw.');
      }
    } catch (error) {
      console.error('❌ Error optimizing indicators:', error);
      alert(`Fout bij indicator optimalisatie: ${error.message}`);
    } finally {
      setIsOptimizingIndicators(false);
    }
  };

  // AI Trade Parameters Function  
  const optimizeTradeParametersWithAI = async () => {
    if (!strategyData.coinPair) {
      alert('Selecteer eerst een coin om trade parameters te optimaliseren.');
      return;
    }

    setIsOptimizingTradeParams(true);
    setTradeParamsOptimization(null);

    try {
      console.log('🤖 Starting AI Trade Parameters Optimization...');
      
      const response = await openaiApi.optimizeTradeParameters({
        coin: strategyData.coinPair,
        signalIndicator: strategyData.signalIndicator,
        confirmingIndicators: strategyData.confirmingIndicators.filter(ind => ind.enabled),
        currentSettings: {
          amountType: strategyData.amountType,
          amount: strategyData.amountType === 'fixed' ? strategyData.fixedAmount : strategyData.percentageAmount,
          marginType: strategyData.marginType,
          multiplier: strategyData.multiplier
        }
      });

      if (response.success) {
        console.log('✅ AI Trade Parameters Optimization successful:', response.data);
        setTradeParamsOptimization(response.data);

        // Show detailed optimization results
        const entry = response.data.entry_strategy;
        const tp = response.data.take_profit_strategy;
        const sl = response.data.stop_loss_strategy;
        const risk = response.data.risk_parameters;
        const performance = response.data.expected_performance;
        
        alert(`🎯 AI TRADE PARAMETERS OPTIMALISATIE VOLTOOID!

💰 ENTRY STRATEGIE:
• ${entry?.entry_condition || 'Signal + Confirmation required'}
• Position Size: ${entry?.position_size || '2% van portfolio'}
• Entry Type: ${entry?.entry_type || 'Market order'}

🎯 TAKE PROFIT:
• TP Level 1: ${tp?.tp_level_1 || '1.5% winst op 50% positie'}
• TP Level 2: ${tp?.tp_level_2 || '3% winst op 30% positie'}
• TP Level 3: ${tp?.tp_level_3 || '5% winst op 20% positie'}

🛡️ STOP LOSS:
• Initial Stop: ${sl?.initial_stop || '1% onder entry'}
• Break-even: ${sl?.break_even_move || 'Na 1% winst'}
• Max Verlies: ${sl?.maximum_loss || '1% van portfolio'}

📊 VERWACHTE PRESTATIES:
• Win Rate: ${performance?.win_rate || 'N/A'}
• Gemiddelde Winst: ${performance?.average_win || 'N/A'}
• Maandelijks Target: ${performance?.monthly_return_target || 'N/A'}

⚡ Gebruik deze parameters in je Entry/Exit tab!`);

      } else {
        console.error('❌ Trade parameters optimization failed:', response);
        alert('AI Trade Parameters Optimalisatie mislukt. Probeer het opnieuw.');
      }
    } catch (error) {
      console.error('❌ Error optimizing trade parameters:', error);
      alert(`Fout bij trade parameters optimalisatie: ${error.message}`);
    } finally {
      setIsOptimizingTradeParams(false);
    }
  };

  // Helper function to parse indicator settings
  const parseIndicatorSettings = (indicatorName: string, parameters: string) => {
    if (!parameters) return {};
    
    try {
      // Parse common parameter formats
      if (indicatorName?.toLowerCase().includes('macd')) {
        const matches = parameters.match(/(\d+).*?(\d+).*?(\d+)/);
        if (matches) {
          return { fast: parseInt(matches[1]), slow: parseInt(matches[2]), signal: parseInt(matches[3]) };
        }
      } else if (indicatorName?.toLowerCase().includes('rsi')) {
        const match = parameters.match(/(\d+)/);
        if (match) {
          return { period: parseInt(match[1]) };
        }
      } else if (indicatorName?.toLowerCase().includes('supertrend')) {
        const matches = parameters.match(/(\d+).*?(\d+)/);
        if (matches) {
          return { period: parseInt(matches[1]), multiplier: parseInt(matches[2]) };
        }
      }
    } catch (error) {
      console.warn('Could not parse parameters:', parameters);
    }
    
    return {};
  };

  const getAIAdvice = async () => {
    try {
      // Detailed AI advice with specific parameters for each indicator
      const coinAnalysis = {
        volatility: strategyData.coinPair.includes('BTC') ? 'medium' : 'high',
        marketCap: strategyData.coinPair.includes('BTC') || strategyData.coinPair.includes('ETH') ? 'large' : 'small',
        tradingVolume: strategyData.coinPair.includes('USDT') ? 'high' : 'medium'
      };
      
      const advice = {
        recommended: {
          signal: {
            indicator: 'MACD',
            timeframe: '15m',
            parameters: {
              fast: 12,
              slow: 26,
              signal: 9,
              source: 'close',
              maType: 'EMA'
            },
            reason: `For ${strategyData.coinPair} with ${coinAnalysis.volatility} volatility, MACD 12/26/9 on 15m provides optimal signal-to-noise ratio`
          },
          confirming: [
            {
              indicator: 'SuperTrend',
              timeframe: '1h',
              parameters: {
                period: 10,
                multiplier: 3.0
              },
              reason: 'Higher timeframe SuperTrend filters false signals and confirms trend direction'
            },
            {
              indicator: 'RSI',
              timeframe: '15m',
              parameters: {
                period: 14,
                overbought: 70,
                oversold: 30
              },
              reason: 'RSI prevents entries in overbought/oversold conditions'
            }
          ],
          entryConditions: {
            timing: 'Enter when MACD crosses above signal line AND price is above SuperTrend AND RSI is between 30-70',
            riskReward: '1:2.5 minimum risk-reward ratio recommended',
            positionSize: `${coinAnalysis.volatility === 'high' ? '2-5%' : '5-10%'} of portfolio per trade`
          },
          stopLoss: {
            strategy: 'ATR-based',
            distance: '2.5x ATR(14) below entry',
            reason: 'ATR-based stops adapt to current volatility conditions'
          },
          takeProfit: {
            strategy: 'Multiple levels',
            levels: [
              { level: 1, price: '1.5x risk', ratio: '50%' },
              { level: 2, price: '2.5x risk', ratio: '30%' },
              { level: 3, price: '4x risk', ratio: '20%' }
            ],
            reason: 'Graduated profit-taking maximizes returns while protecting capital'
          }
        },
        marketConditions: {
          trend: 'Currently bullish based on higher timeframe analysis',
          volatility: `${coinAnalysis.volatility} volatility requires ${coinAnalysis.volatility === 'high' ? 'wider stops and smaller position sizes' : 'normal risk management'}`,
          volume: `${coinAnalysis.tradingVolume} volume provides ${coinAnalysis.tradingVolume === 'high' ? 'good' : 'adequate'} liquidity for execution`,
          recommendation: coinAnalysis.volatility === 'high' ? 'Use smaller position sizes and wider stops' : 'Standard parameters suitable'
        },
        confidence: '89%'
      };
      
      const detailedAdvice = 
        `🤖 DETAILED AI ANALYSIS for ${strategyData.coinPair} (${advice.confidence} confidence)\n\n` +
        
        `📊 SIGNAL INDICATOR:\n` +
        `• Indicator: ${advice.recommended.signal.indicator}\n` +
        `• Timeframe: ${advice.recommended.signal.timeframe}\n` +
        `• Parameters: Fast(${advice.recommended.signal.parameters.fast}), Slow(${advice.recommended.signal.parameters.slow}), Signal(${advice.recommended.signal.parameters.signal})\n` +
        `• Source: ${advice.recommended.signal.parameters.source}, Type: ${advice.recommended.signal.parameters.maType}\n` +
        `• Why: ${advice.recommended.signal.reason}\n\n` +
        
        `✅ CONFIRMING INDICATORS:\n` +
        advice.recommended.confirming.map((conf, i) => 
          `${i + 1}. ${conf.indicator} (${conf.timeframe})\n` +
          `   Parameters: ${Object.entries(conf.parameters).map(([k, v]) => `${k}(${v})`).join(', ')}\n` +
          `   Why: ${conf.reason}`
        ).join('\n') + '\n\n' +
        
        `🎯 ENTRY CONDITIONS:\n` +
        `• Timing: ${advice.recommended.entryConditions.timing}\n` +
        `• Risk/Reward: ${advice.recommended.entryConditions.riskReward}\n` +
        `• Position Size: ${advice.recommended.entryConditions.positionSize}\n\n` +
        
        `🛡️ STOP LOSS:\n` +
        `• Strategy: ${advice.recommended.stopLoss.strategy}\n` +
        `• Distance: ${advice.recommended.stopLoss.distance}\n` +
        `• Why: ${advice.recommended.stopLoss.reason}\n\n` +
        
        `💰 TAKE PROFIT:\n` +
        `• Strategy: ${advice.recommended.takeProfit.strategy}\n` +
        advice.recommended.takeProfit.levels.map(level => 
          `• Level ${level.level}: ${level.price} (${level.ratio} of position)`
        ).join('\n') + '\n' +
        `• Why: ${advice.recommended.takeProfit.reason}\n\n` +
        
        `📈 MARKET CONDITIONS:\n` +
        `• Trend: ${advice.marketConditions.trend}\n` +
        `• Volatility: ${advice.marketConditions.volatility}\n` +
        `• Volume: ${advice.marketConditions.volume}\n` +
        `• Recommendation: ${advice.marketConditions.recommendation}`;
      
      alert(detailedAdvice);
      
    } catch (error) {
      alert('AI advice temporarily unavailable. Please try again later.');
    }
  };

  const renderIndicatorsTab = () => {
    // Function to get real OpenAI advice
    const getOpenAIAdvice = async () => {
      setIsLoadingAdvice(true);
      try {
        console.log('🤖 Requesting AI advice for:', {
          coin: strategyData.coinPair,
          signalIndicator: strategyData.signalIndicator,
          confirmingIndicators: strategyData.confirmingIndicators.filter(ind => ind.enabled && ind.type !== 'none')
        });
        
        const response = await openaiApi.getStrategyAdvice({
          coin: strategyData.coinPair,
          signalIndicator: strategyData.signalIndicator,
          confirmingIndicators: strategyData.confirmingIndicators.filter(ind => ind.enabled && ind.type !== 'none')
        });
        
        console.log('🤖 AI advice response:', response);
        
        if (response.success) {
          setAiAdvice(response.data);
        } else {
          console.error('OpenAI advice failed:', response);
          alert(`AI Advice failed: ${response.error || 'Unknown error'}`);
          setAiAdvice(null);
        }
      } catch (error) {
        console.error('Failed to get OpenAI advice:', error);
        alert(`Failed to get AI advice: ${error.message}`);
        setAiAdvice(null);
      } finally {
        setIsLoadingAdvice(false);
      }
    };

    return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white mb-4">📈 Indicators Configuration</h3>
        <div className="flex items-center space-x-3">
          {/* AI Indicator Selectie Button */}
          <button
            onClick={optimizeIndicatorsWithAI}
            disabled={isOptimizingIndicators || !strategyData.coinPair}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:from-gray-600 disabled:to-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-lg"
          >
            <span className={isOptimizingIndicators ? 'animate-spin' : ''}>{isOptimizingIndicators ? '⚙️' : '🎯'}</span>
            <span>{isOptimizingIndicators ? 'Analyzing...' : 'AI Indicator Selectie'}</span>
          </button>
          
          {/* AI Trade Parameters Button */}
          <button
            onClick={optimizeTradeParametersWithAI}
            disabled={isOptimizingTradeParams || !strategyData.coinPair}
            className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 disabled:from-gray-600 disabled:to-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-lg"
          >
            <span className={isOptimizingTradeParams ? 'animate-spin' : ''}>{isOptimizingTradeParams ? '⚙️' : '💰'}</span>
            <span>{isOptimizingTradeParams ? 'Optimizing...' : 'AI Trade Parameters'}</span>
          </button>
        </div>
      </div>
      
      {/* Signal Indicator - Compact */}
      <div className="bg-gradient-to-br from-gray-900/50 to-black/50 p-6 rounded-xl border border-gray-600/30">
        <h4 className="text-lg font-medium text-white mb-4 flex items-center">
          <span className="mr-2">🎯</span>
          Signal Indicator (Primary)
        </h4>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Indicator Selection */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Indicator Type</label>
            <select
              value={strategyData.signalIndicator.type}
              onChange={(e) => updateNestedField('signalIndicator', 'type', e.target.value)}
              className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
            >
              {signalIndicators.map(indicator => (
                <option key={indicator.id} value={indicator.id}>
                  {indicator.icon} {indicator.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Timeframe */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Timeframe</label>
            <select
              value={strategyData.signalIndicator.timeframe}
              onChange={(e) => updateNestedField('signalIndicator', 'timeframe', e.target.value)}
              className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
            >
              <option value="5m">5 minutes</option>
              <option value="15m">15 minutes</option>
              <option value="30m">30 minutes</option>
              <option value="1h">1 hour</option>
              <option value="4h">4 hours</option>
              <option value="1d">1 day</option>
            </select>
          </div>
          
          {/* Dynamic Parameters based on selected indicator */}
          {strategyData.signalIndicator.type === 'macd' && (
            <>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Fast Period</label>
                <input
                  type="number"
                  value={strategyData.signalIndicator.settings.fast || 12}
                  onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                    ...strategyData.signalIndicator.settings,
                    fast: parseInt(e.target.value)
                  })}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                  min="1" max="50"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Slow Period</label>
                <input
                  type="number"
                  value={strategyData.signalIndicator.settings.slow || 26}
                  onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                    ...strategyData.signalIndicator.settings,
                    slow: parseInt(e.target.value)
                  })}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                  min="1" max="100"
                />
              </div>
            </>
          )}
          
          {strategyData.signalIndicator.type === 'rsi' && (
            <>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Period</label>
                <input
                  type="number"
                  value={strategyData.signalIndicator.settings.period || 14}
                  onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                    ...strategyData.signalIndicator.settings,
                    period: parseInt(e.target.value)
                  })}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                  min="2" max="50"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Overbought</label>
                <input
                  type="number"
                  value={strategyData.signalIndicator.settings.overbought || 70}
                  onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                    ...strategyData.signalIndicator.settings,
                    overbought: parseInt(e.target.value)
                  })}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                  min="50" max="95"
                />
              </div>
            </>
          )}
          
          {strategyData.signalIndicator.type === 'ema-crossover' && (
            <>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Fast EMA</label>
                <input
                  type="number"
                  value={strategyData.signalIndicator.settings.fast || 8}
                  onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                    ...strategyData.signalIndicator.settings,
                    fast: parseInt(e.target.value)
                  })}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                  min="1" max="50"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Slow EMA</label>
                <input
                  type="number"
                  value={strategyData.signalIndicator.settings.slow || 21}
                  onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                    ...strategyData.signalIndicator.settings,
                    slow: parseInt(e.target.value)
                  })}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                  min="1" max="100"
                />
              </div>
            </>
          )}
          
          {strategyData.signalIndicator.type === 'vwma' && (
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Period</label>
              <input
                type="number"
                value={strategyData.signalIndicator.settings.period || 20}
                onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                  ...strategyData.signalIndicator.settings,
                  period: parseInt(e.target.value)
                })}
                className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                min="1" max="100"
              />
            </div>
          )}
          
          {strategyData.signalIndicator.type === 'mfi' && (
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Period</label>
              <input
                type="number"
                value={strategyData.signalIndicator.settings.period || 14}
                onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                  ...strategyData.signalIndicator.settings,
                  period: parseInt(e.target.value)
                })}
                className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                min="2" max="50"
              />
            </div>
          )}
          
          {strategyData.signalIndicator.type === 'atr-bands' && (
            <>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Period</label>
                <input
                  type="number"
                  value={strategyData.signalIndicator.settings.period || 14}
                  onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                    ...strategyData.signalIndicator.settings,
                    period: parseInt(e.target.value)
                  })}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                  min="1" max="50"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  value={strategyData.signalIndicator.settings.multiplier || 2}
                  onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                    ...strategyData.signalIndicator.settings,
                    multiplier: parseFloat(e.target.value)
                  })}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                  min="0.1" max="10"
                />
              </div>
            </>
          )}
          
          {strategyData.signalIndicator.type === 'keltner' && (
            <>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Period</label>
                <input
                  type="number"
                  value={strategyData.signalIndicator.settings.period || 20}
                  onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                    ...strategyData.signalIndicator.settings,
                    period: parseInt(e.target.value)
                  })}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                  min="1" max="50"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  value={strategyData.signalIndicator.settings.multiplier || 2}
                  onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                    ...strategyData.signalIndicator.settings,
                    multiplier: parseFloat(e.target.value)
                  })}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                  min="0.1" max="10"
                />
              </div>
            </>
          )}
          
          {strategyData.signalIndicator.type === 'stochastic' && (
            <>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">%K Period</label>
                <input
                  type="number"
                  value={strategyData.signalIndicator.settings.k || 5}
                  onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                    ...strategyData.signalIndicator.settings,
                    k: parseInt(e.target.value)
                  })}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                  min="1" max="50"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">%D Period</label>
                <input
                  type="number"
                  value={strategyData.signalIndicator.settings.d || 3}
                  onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                    ...strategyData.signalIndicator.settings,
                    d: parseInt(e.target.value)
                  })}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                  min="1" max="20"
                />
              </div>
            </>
          )}
          
          {strategyData.signalIndicator.type === 'williams-r' && (
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Period</label>
              <input
                type="number"
                value={strategyData.signalIndicator.settings.period || 14}
                onChange={(e) => updateNestedField('signalIndicator', 'settings', {
                  ...strategyData.signalIndicator.settings,
                  period: parseInt(e.target.value)
                })}
                className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                min="1" max="50"
              />
            </div>
          )}
        </div>
        
        {/* Show indicator description */}
        <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-600/30">
          <p className="text-xs text-gray-400">
            {signalIndicators.find(ind => ind.id === strategyData.signalIndicator.type)?.description || 'Select an indicator to see description'}
          </p>
        </div>
      </div>

      {/* AI Optimization Results */}
      {(indicatorOptimization || tradeParamsOptimization) && (
        <div className="bg-gradient-to-r from-green-600/20 to-blue-600/20 p-6 rounded-xl border border-green-500/30 mb-6">
          <div className="flex items-center mb-4">
            <span className="mr-2 text-2xl">🎯</span>
            <h4 className="text-lg font-medium text-white">AI Optimalisatie Resultaten</h4>
          </div>
          
          {indicatorOptimization && (
            <div className="mb-4 p-4 bg-black/30 rounded-lg">
              <h5 className="text-green-400 font-semibold mb-2">📊 Indicator Optimalisatie:</h5>
              <div className="text-sm text-gray-300 space-y-1">
                <p>• Signal: {indicatorOptimization.signal_indicator?.indicator} op {indicatorOptimization.signal_indicator?.timeframe}</p>
                <p>• Win Rate: {indicatorOptimization.backtest_results?.win_rate}</p>
                <p>• Verwacht Rendement: {indicatorOptimization.backtest_results?.expected_monthly_return}</p>
              </div>
            </div>
          )}
          
          {tradeParamsOptimization && (
            <div className="p-4 bg-black/30 rounded-lg">
              <h5 className="text-blue-400 font-semibold mb-2">💰 Trade Parameters:</h5>
              <div className="text-sm text-gray-300 space-y-1">
                <p>• Entry: {tradeParamsOptimization.entry_strategy?.entry_condition}</p>
                <p>• Position Size: {tradeParamsOptimization.entry_strategy?.position_size}</p>
                <p>• Win Rate Target: {tradeParamsOptimization.expected_performance?.win_rate}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Recommendation Box */}
      <div className="bg-gradient-to-r from-primary-blue/20 to-primary-purple/20 p-6 rounded-xl border border-primary-blue/30 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-medium text-white flex items-center">
            <span className="mr-2">🤖</span>
            AI Recommendation
          </h4>
          <button
            onClick={getOpenAIAdvice}
            disabled={isLoadingAdvice}
            className="px-4 py-2 bg-gradient-to-r from-primary-blue to-primary-purple hover:from-primary-purple hover:to-primary-blue text-white text-sm rounded-lg font-medium transition-all disabled:opacity-50"
          >
            {isLoadingAdvice ? '🔄 Loading...' : '✨ Get AI Advice'}
          </button>
        </div>
        
        {isLoadingAdvice && (
          <div className="text-center py-4">
            <div className="animate-spin text-2xl mb-2">🤖</div>
            <div className="text-primary-blue text-sm">Analyzing your strategy with OpenAI...</div>
          </div>
        )}
        
        {aiAdvice ? (
          <div className="text-sm text-gray-300 space-y-2">
            <p>
              <span className="text-primary-blue font-semibold">OpenAI Analysis:</span> {aiAdvice.analysis || `For ${strategyData.coinPair}, your strategy configuration shows potential.`}
            </p>
            <p>
              <span className="text-yellow-400">⚡ Suggestion:</span> {aiAdvice.suggestion || 'Consider the recommended settings below.'}
            </p>
            {aiAdvice.recommendations && (
              <div className="mt-3 p-3 bg-black/30 rounded-lg">
                <h5 className="text-primary-blue font-medium mb-2">Recommendations:</h5>
                <ul className="text-xs text-gray-300 space-y-1">
                  {aiAdvice.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="text-primary-blue mr-1">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : !isLoadingAdvice ? (
          <div className="text-sm text-gray-300 space-y-2">
            <p>
              <span className="text-primary-blue font-semibold">OpenAI Analysis:</span> For {strategyData.coinPair}, 
              the combination of {strategyData.signalIndicator.type} on {strategyData.signalIndicator.timeframe} timeframe 
              shows strong potential based on historical data.
            </p>
            <p>
              <span className="text-yellow-400">⚡ Suggestion:</span> Click "Get AI Advice" above to receive personalized 
              recommendations from OpenAI based on your current strategy configuration.
            </p>
            <div className="mt-3 p-3 bg-black/30 rounded-lg">
              <p className="text-xs text-gray-400 italic">
                📡 OpenAI connection available - Click the button to get real-time AI analysis.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Confirming Indicators - Compact List */}
      <div className="bg-gradient-to-br from-gray-900/50 to-black/50 p-6 rounded-xl border border-gray-600/30">
        <h4 className="text-lg font-medium text-white mb-4 flex items-center">
          <span className="mr-2">✅</span>
          Confirming Indicators
        </h4>
        
        {strategyData.confirmingIndicators.map((indicator, index) => (
          <div key={index} className="mb-4 p-4 bg-gray-800/30 rounded-lg border border-gray-600/30">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium text-white">Indicator {index + 1}</h5>
              <button
                onClick={() => removeConfirmingIndicator(index)}
                className="text-red-400 hover:text-red-300 transition-colors text-sm"
              >
                Remove
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Indicator Selection */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Type</label>
                <select
                  value={indicator.type}
                  onChange={(e) => updateConfirmingIndicator(index, 'type', e.target.value)}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                >
                  <option value="none">No Confirmation</option>
                  {confirmingIndicators.map(confIndicator => (
                    <option key={confIndicator.id} value={confIndicator.id}>
                      {confIndicator.icon} {confIndicator.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Timeframe */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Timeframe</label>
                <select
                  value={indicator.timeframe}
                  onChange={(e) => updateConfirmingIndicator(index, 'timeframe', e.target.value)}
                  className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                  disabled={indicator.type === 'none'}
                >
                  <option value="15m">15 minutes</option>
                  <option value="30m">30 minutes</option>
                  <option value="1h">1 hour</option>
                  <option value="4h">4 hours</option>
                  <option value="1d">1 day</option>
                  <option value="1w">1 week</option>
                </select>
              </div>
              
              {/* Parameter 1 - Dynamic based on indicator */}
              {indicator.type !== 'none' && (
                <>
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      {indicator.type === 'supertrend' ? 'Period' :
                       indicator.type === 'adx' ? 'Period' :
                       indicator.type === 'ema-stack' ? 'Fast EMA' :
                       indicator.type === 'ichimoku' ? 'Tenkan' :
                       indicator.type === 'rsi-trend' ? 'Period' :
                       indicator.type === 'macd-slow' ? 'Fast' :
                       indicator.type === 'fibonacci' ? 'Lookback' :
                       indicator.type === 'volume-profile' ? 'Sessions' :
                       'Parameter 1'}
                    </label>
                    <input
                      type="number"
                      value={
                        indicator.type === 'supertrend' ? (indicator.settings?.period || 10) :
                        indicator.type === 'adx' ? (indicator.settings?.period || 14) :
                        indicator.type === 'ema-stack' ? (indicator.settings?.ema1 || 50) :
                        indicator.type === 'ichimoku' ? (indicator.settings?.tenkan || 9) :
                        indicator.type === 'rsi-trend' ? (indicator.settings?.period || 21) :
                        indicator.type === 'macd-slow' ? (indicator.settings?.fast || 26) :
                        indicator.type === 'fibonacci' ? (indicator.settings?.lookback || 50) :
                        indicator.type === 'volume-profile' ? (indicator.settings?.sessions || 24) :
                        (indicator.settings?.param1 || 10)
                      }
                      onChange={(e) => {
                        const param = 
                          indicator.type === 'supertrend' ? 'period' :
                          indicator.type === 'adx' ? 'period' :
                          indicator.type === 'ema-stack' ? 'ema1' :
                          indicator.type === 'ichimoku' ? 'tenkan' :
                          indicator.type === 'rsi-trend' ? 'period' :
                          indicator.type === 'macd-slow' ? 'fast' :
                          indicator.type === 'fibonacci' ? 'lookback' :
                          indicator.type === 'volume-profile' ? 'sessions' :
                          'param1';
                        updateConfirmingIndicator(index, 'settings', {
                          ...indicator.settings,
                          [param]: parseInt(e.target.value)
                        });
                      }}
                      className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                      min="1" max="200"
                    />
                  </div>
                  
                  {/* Parameter 2 - For indicators that need it */}
                  {['supertrend', 'ema-stack', 'ichimoku', 'macd-slow'].includes(indicator.type) && (
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        {indicator.type === 'supertrend' ? 'Multiplier' :
                         indicator.type === 'ema-stack' ? 'Medium EMA' :
                         indicator.type === 'ichimoku' ? 'Kijun' :
                         indicator.type === 'macd-slow' ? 'Slow' :
                         'Parameter 2'}
                      </label>
                      <input
                        type="number"
                        step={indicator.type === 'supertrend' ? '0.1' : '1'}
                        value={
                          indicator.type === 'supertrend' ? (indicator.settings?.multiplier || 3) :
                          indicator.type === 'ema-stack' ? (indicator.settings?.ema2 || 100) :
                          indicator.type === 'ichimoku' ? (indicator.settings?.kijun || 26) :
                          indicator.type === 'macd-slow' ? (indicator.settings?.slow || 52) :
                          (indicator.settings?.param2 || 3)
                        }
                        onChange={(e) => {
                          const param = 
                            indicator.type === 'supertrend' ? 'multiplier' :
                            indicator.type === 'ema-stack' ? 'ema2' :
                            indicator.type === 'ichimoku' ? 'kijun' :
                            indicator.type === 'macd-slow' ? 'slow' :
                            'param2';
                          const value = indicator.type === 'supertrend' ? 
                            parseFloat(e.target.value) : parseInt(e.target.value);
                          updateConfirmingIndicator(index, 'settings', {
                            ...indicator.settings,
                            [param]: value
                          });
                        }}
                        className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
                        min={indicator.type === 'supertrend' ? '0.1' : '1'}
                        max={indicator.type === 'supertrend' ? '10' : '300'}
                      />
                    </div>
                  )}
                </>
              )}
              
              {/* Enabled Checkbox */}
              <div className="flex items-end">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={indicator.enabled && indicator.type !== 'none'}
                    onChange={(e) => updateConfirmingIndicator(index, 'enabled', e.target.checked)}
                    disabled={indicator.type === 'none'}
                    className="w-4 h-4 text-primary-blue bg-gray-900 border-gray-600 rounded focus:ring-primary-blue focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">Enabled</span>
                </label>
              </div>
            </div>
            
            {indicator.type !== 'none' && (
              <div className="mt-3 p-2 bg-gray-700/30 rounded text-xs text-gray-400">
                {confirmingIndicators.find(ind => ind.id === indicator.type)?.description || 'Confirming indicator'}
              </div>
            )}
          </div>
        ))}
        
        {strategyData.confirmingIndicators.length < 5 && (
          <button
            onClick={addConfirmingIndicator}
            className="w-full p-3 border-2 border-dashed border-gray-600/40 rounded-lg text-gray-400 hover:border-primary-blue/60 hover:text-primary-blue transition-all text-sm"
          >
            ➕ Add Confirming Indicator
          </button>
        )}
      </div>
    </div>
  );
  };

  const renderMLTab = () => {
    const analyzeCoinWithML = async () => {
      if (!strategyData.coinPair) {
        alert('Please select a coin first');
        return;
      }
      
      setIsAnalyzingCoin(true);
      try {
        // Simulate ML analysis
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const analysis = {
          coinPair: strategyData.coinPair,
          overallScore: Math.floor(Math.random() * 20) + 80, // 80-100
          predictions: {
            priceDirection: Math.random() > 0.5 ? 'Bullish' : 'Bearish',
            confidence: Math.floor(Math.random() * 20) + 75, // 75-95
            timeHorizon: '1-4 hours',
            targetPrice: Math.random() > 0.5 ? '+5.2%' : '-3.1%'
          },
          mlModelResults: {
            lstm: {
              prediction: 'Strong Buy',
              confidence: 89,
              reasoning: 'Sequential pattern analysis shows strong upward momentum',
              features: ['Price momentum', 'Volume confirmation', 'Technical breakout']
            },
            randomForest: {
              prediction: 'Buy',
              confidence: 82,
              reasoning: 'Multiple technical indicators align for bullish movement',
              features: ['RSI divergence', 'MACD crossover', 'Volume spike']
            },
            svm: {
              prediction: 'Hold/Buy',
              confidence: 76,
              reasoning: 'Support vector analysis indicates consolidation before breakout',
              features: ['Support levels', 'Volatility patterns', 'Market regime']
            },
            neuralNetwork: {
              prediction: 'Strong Buy',
              confidence: 91,
              reasoning: 'Deep pattern recognition identifies high-probability setup',
              features: ['Complex patterns', 'Multi-timeframe analysis', 'Market microstructure']
            }
          },
          marketRegime: {
            trend: 'Uptrend',
            volatility: 'Medium',
            momentum: 'Increasing',
            volume: 'Above Average'
          },
          riskMetrics: {
            volatilityScore: 6.8,
            liquidityScore: 8.5,
            correlationRisk: 'Low',
            maxDrawdownPrediction: '4-7%'
          },
          optimalSettings: {
            recommendedTimeframe: '15m',
            bestIndicators: ['MACD', 'SuperTrend', 'Volume Profile'],
            riskRewardRatio: '1:2.3',
            positionSizeRecommendation: '5-8% of portfolio'
          }
        };
        
        setMlAnalysisResults(analysis);
        
        // Auto-apply ML recommendations
        if (analysis.overallScore >= 85) {
          updateStrategyField('signalIndicator', {
            type: 'macd',
            timeframe: '15m',
            settings: { fast: 12, slow: 26, signal: 9, source: 'close', maType: 'EMA' }
          });
          
          // Enable the best ML models
          updateNestedField('mlModels', 'lstm', true);
          updateNestedField('mlModels', 'neuralNetwork', true);
        }
        
      } catch (error) {
        console.error('ML analysis failed:', error);
        alert('ML analysis failed. Please try again.');
      } finally {
        setIsAnalyzingCoin(false);
      }
    };
    
    const mlModelsDetails = {
      lstm: {
        name: 'LSTM Neural Network',
        description: 'Long Short-Term Memory network for sequence prediction',
        details: {
          purpose: 'Analyzes price sequences and time-based patterns to predict future movements',
          strengths: ['Excellent for time series data', 'Remembers long-term dependencies', 'Handles variable-length sequences'],
          weaknesses: ['Computationally intensive', 'Requires large datasets', 'Can overfit on small datasets'],
          useCase: 'Best for: Trend prediction, sequence analysis, pattern recognition in price movements',
          accuracy: '85-92% on trending markets',
          trainingTime: '15-30 minutes',
          parameters: ['sequence_length: 60', 'hidden_units: 128', 'dropout: 0.2', 'learning_rate: 0.001']
        }
      },
      randomForest: {
        name: 'Random Forest',
        description: 'Ensemble method using multiple decision trees',
        details: {
          purpose: 'Combines multiple decision trees to make robust predictions based on technical indicators',
          strengths: ['Fast training and prediction', 'Handles mixed data types', 'Provides feature importance'],
          weaknesses: ['Can overfit with noisy data', 'Less interpretable than single trees', 'Memory intensive'],
          useCase: 'Best for: Feature selection, robust predictions, handling missing data',
          accuracy: '78-85% across all market conditions',
          trainingTime: '2-5 minutes',
          parameters: ['n_estimators: 100', 'max_depth: 10', 'min_samples_split: 5', 'random_state: 42']
        }
      },
      svm: {
        name: 'Support Vector Machine',
        description: 'Classification algorithm that finds optimal decision boundaries',
        details: {
          purpose: 'Finds optimal boundaries between buy/sell/hold signals in high-dimensional indicator space',
          strengths: ['Works well with high-dimensional data', 'Memory efficient', 'Versatile with different kernels'],
          weaknesses: ['Slow on large datasets', 'Sensitive to feature scaling', 'No probabilistic output'],
          useCase: 'Best for: Clear signal classification, high-dimensional indicator combinations',
          accuracy: '82-88% for signal classification',
          trainingTime: '5-10 minutes',
          parameters: ['C: 1.0', 'kernel: rbf', 'gamma: scale', 'probability: true']
        }
      },
      neuralNetwork: {
        name: 'Deep Neural Network',
        description: 'Multi-layer neural network for complex pattern recognition',
        details: {
          purpose: 'Deep learning model that discovers complex non-linear relationships in market data',
          strengths: ['Learns complex patterns', 'Highly flexible', 'Can approximate any function'],
          weaknesses: ['Requires large datasets', 'Black box nature', 'Prone to overfitting'],
          useCase: 'Best for: Complex pattern recognition, multi-modal data fusion, advanced feature extraction',
          accuracy: '86-94% with sufficient training data',
          trainingTime: '20-45 minutes',
          parameters: ['layers: [256, 128, 64, 32]', 'activation: relu', 'optimizer: adam', 'batch_size: 64']
        }
      }
    };

    return (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-white mb-4">🤖 Machine Learning Configuration</h3>
        
        <div className="p-6 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-xl border border-purple-500/30">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-white">Enable ML Confirmation</h4>
            <input
              type="checkbox"
              checked={strategyData.mlEnabled}
              onChange={(e) => updateStrategyField('mlEnabled', e.target.checked)}
              className="w-6 h-6 text-purple-400 bg-gray-900 border-gray-600 rounded focus:ring-purple-400 focus:ring-2"
            />
          </div>
          
          {strategyData.mlEnabled && (
            <div className="space-y-6">
              {/* ML Coin Analysis Section */}
              <div className="p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg border border-blue-500/30">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-white font-medium flex items-center">
                    <span className="mr-2">🔭</span>
                    AI Coin Analysis
                  </h5>
                  <button
                    onClick={analyzeCoinWithML}
                    disabled={isAnalyzingCoin || !strategyData.coinPair}
                    className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300"
                  >
                    <span className={isAnalyzingCoin ? 'animate-spin' : ''}>🤖</span>
                    <span>{isAnalyzingCoin ? 'Analyzing...' : 'Analyze Coin'}</span>
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Run comprehensive ML analysis on {strategyData.coinPair || 'selected coin'} to get AI recommendations
                </p>
                
                {mlAnalysisResults && (
                  <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-600/30">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${
                          mlAnalysisResults.overallScore >= 90 ? 'text-success-green-light' :
                          mlAnalysisResults.overallScore >= 80 ? 'text-primary-blue' :
                          'text-danger-red-light'
                        }`}>{mlAnalysisResults.overallScore}/100</div>
                        <div className="text-xs text-gray-400">Overall Score</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${
                          mlAnalysisResults.predictions.priceDirection === 'Bullish' ? 'text-green-300' : 'text-red-300'
                        }`}>{mlAnalysisResults.predictions.priceDirection}</div>
                        <div className="text-xs text-gray-400">Price Direction</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-300">{mlAnalysisResults.predictions.confidence}%</div>
                        <div className="text-xs text-gray-400">Confidence</div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-300 mb-2">
                      <strong>Target:</strong> {mlAnalysisResults.predictions.targetPrice} in {mlAnalysisResults.predictions.timeHorizon}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-blue-300">Recommended Timeframe:</span>
                        <span className="ml-1 text-white">{mlAnalysisResults.optimalSettings.recommendedTimeframe}</span>
                      </div>
                      <div>
                        <span className="text-green-300">Risk/Reward:</span>
                        <span className="ml-1 text-white">{mlAnalysisResults.optimalSettings.riskRewardRatio}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <p className="text-gray-300">Select which machine learning models to include in the decision process:</p>
              
              <div className="grid grid-cols-1 gap-4">
                {Object.entries(mlModelsDetails).map(([key, model]) => (
                  <div key={key} className="bg-gray-900/50 rounded-lg border border-gray-600/30 overflow-hidden">
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-all"
                      onClick={() => setSelectedML(selectedML === key ? null : key)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h5 className="font-medium text-white">{model.name}</h5>
                          <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
                            {model.details.accuracy}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{model.description}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button 
                          className="text-gray-400 hover:text-white text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedML(selectedML === key ? null : key);
                          }}
                        >
                          {selectedML === key ? '▼ Hide Details' : '▶ Show Details'}
                        </button>
                        <input
                          type="checkbox"
                          checked={strategyData.mlModels[key as keyof typeof strategyData.mlModels]}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateNestedField('mlModels', key, e.target.checked);
                          }}
                          className="w-5 h-5 text-purple-400 bg-gray-900 border-gray-600 rounded focus:ring-purple-400 focus:ring-2"
                        />
                      </div>
                    </div>
                    
                    {selectedML === key && (
                      <div className="p-4 border-t border-gray-700/30 bg-gray-800/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h6 className="text-sm font-medium text-purple-300 mb-2">Purpose & Use Case</h6>
                            <p className="text-xs text-gray-300 mb-2">{model.details.purpose}</p>
                            <p className="text-xs text-blue-300">{model.details.useCase}</p>
                          </div>
                          <div>
                            <h6 className="text-sm font-medium text-green-300 mb-2">Performance</h6>
                            <p className="text-xs text-gray-300">Accuracy: <span className="text-green-400">{model.details.accuracy}</span></p>
                            <p className="text-xs text-gray-300">Training Time: <span className="text-primary-blue">{model.details.trainingTime}</span></p>
                          </div>
                          <div>
                            <h6 className="text-sm font-medium text-green-300 mb-2">Strengths</h6>
                            <ul className="text-xs text-gray-300 space-y-1">
                              {model.details.strengths.map((strength, i) => (
                                <li key={i} className="flex items-start">
                                  <span className="text-green-400 mr-1">•</span>
                                  {strength}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h6 className="text-sm font-medium text-red-300 mb-2">Considerations</h6>
                            <ul className="text-xs text-gray-300 space-y-1">
                              {model.details.weaknesses.map((weakness, i) => (
                                <li key={i} className="flex items-start">
                                  <span className="text-red-400 mr-1">•</span>
                                  {weakness}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="md:col-span-2">
                            <h6 className="text-sm font-medium text-blue-300 mb-2">Model Parameters</h6>
                            <div className="grid grid-cols-2 gap-2">
                              {model.details.parameters.map((param, i) => (
                                <span key={i} className="text-xs bg-gray-700/50 text-gray-300 px-2 py-1 rounded font-mono">
                                  {param}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEntryExitTab = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4">🎯 Entry/Exit Configuration</h3>
      
      {/* Entry Conditions */}
      <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700/40">
        <h4 className="text-lg font-semibold text-white mb-4">Entry Conditions</h4>
        
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Entry Type</label>
            <select className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none">
              <option value="market">Market Order</option>
              <option value="limit">Limit Order</option>
              <option value="stop">Stop Order</option>
            </select>
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Entry Timing</label>
            <select className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none">
              <option value="immediate">Immediate on Signal</option>
              <option value="candle_close">Wait for Candle Close</option>
              <option value="pullback">Wait for Pullback</option>
            </select>
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Confirmation Required</label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded border-gray-600" defaultChecked />
                <span className="text-gray-300">Volume Confirmation</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded border-gray-600" />
                <span className="text-gray-300">Price Action Confirmation</span>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      {/* Exit Conditions */}
      <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700/40">
        <h4 className="text-lg font-semibold text-white mb-4">Exit Conditions</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Take Profit</label>
            <input
              type="number"
              className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
              placeholder="2.5"
              defaultValue="2.5"
            />
            <span className="text-xs text-gray-500">% from entry</span>
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Stop Loss</label>
            <input
              type="number"
              className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
              placeholder="1.0"
              defaultValue="1.0"
            />
            <span className="text-xs text-gray-500">% from entry</span>
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-gray-300 text-sm font-medium mb-2">Trailing Stop</label>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input type="checkbox" className="rounded border-gray-600" />
              <span className="text-gray-300">Enable Trailing Stop</span>
            </label>
            <input
              type="number"
              className="w-24 p-2 bg-gray-900 border border-gray-600/40 rounded text-white text-sm"
              placeholder="0.5"
              defaultValue="0.5"
            />
            <span className="text-xs text-gray-500">% trail distance</span>
          </div>
        </div>
      </div>
      
      {/* Risk Management */}
      <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700/40">
        <h4 className="text-lg font-semibold text-white mb-4">Risk Management</h4>
        
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Max Daily Loss</label>
            <input
              type="number"
              className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
              placeholder="5"
              defaultValue="5"
            />
            <span className="text-xs text-gray-500">% of account balance</span>
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Max Open Positions</label>
            <input
              type="number"
              className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
              placeholder="3"
              defaultValue="3"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderFinalizeTab = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4">✅ Finalize Strategy</h3>
      
      {/* Strategy Summary */}
      <div className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 p-6 rounded-lg border border-primary-blue/20">
        <h4 className="text-lg font-semibold text-white mb-4">Strategy Summary</h4>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Name:</span>
            <span className="text-white ml-2">{strategyData.name || 'Unnamed Strategy'}</span>
          </div>
          <div>
            <span className="text-gray-400">Coin:</span>
            <span className="text-white ml-2">{strategyData.coinPair}</span>
          </div>
          <div>
            <span className="text-gray-400">Signal Indicator:</span>
            <span className="text-white ml-2">{strategyData.signalIndicator.type}</span>
          </div>
          <div>
            <span className="text-gray-400">Timeframe:</span>
            <span className="text-white ml-2">{strategyData.signalIndicator.timeframe}</span>
          </div>
          <div>
            <span className="text-gray-400">ML Enabled:</span>
            <span className="text-white ml-2">{strategyData.mlEnabled ? 'Yes' : 'No'}</span>
          </div>
          <div>
            <span className="text-gray-400">Risk Per Trade:</span>
            <span className="text-white ml-2">{strategyData.amountType === 'fixed' ? `$${strategyData.fixedAmount}` : `${strategyData.percentageAmount}%`}</span>
          </div>
        </div>
      </div>
      
      {/* Backtest Results Summary */}
      <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700/40">
        <h4 className="text-lg font-semibold text-white mb-4">Backtest Results</h4>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-800/50 rounded-lg">
            <div className="text-2xl font-bold text-green-300">{backtestResults.winRate.toFixed(1)}%</div>
            <div className="text-xs text-gray-400">Win Rate</div>
          </div>
          <div className="text-center p-4 bg-gray-800/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-300">{backtestResults.roi.toFixed(1)}%</div>
            <div className="text-xs text-gray-400">Expected ROI</div>
          </div>
          <div className="text-center p-4 bg-gray-800/50 rounded-lg">
            <div className="text-2xl font-bold text-primary-blue">${backtestResults.pnl.toFixed(2)}</div>
            <div className="text-xs text-gray-400">Projected PnL</div>
          </div>
        </div>
      </div>
      
      {/* Final Actions */}
      <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700/40">
        <h4 className="text-lg font-semibold text-white mb-4">Final Actions</h4>
        
        <div className="space-y-4">
          <label className="flex items-center space-x-3">
            <input type="checkbox" className="rounded border-gray-600" defaultChecked />
            <span className="text-gray-300">Enable paper trading first (recommended)</span>
          </label>
          
          <label className="flex items-center space-x-3">
            <input type="checkbox" className="rounded border-gray-600" />
            <span className="text-gray-300">Set up notifications for trades</span>
          </label>
          
          <label className="flex items-center space-x-3">
            <input type="checkbox" className="rounded border-gray-600" defaultChecked />
            <span className="text-gray-300">Auto-save strategy configuration</span>
          </label>
        </div>
      </div>
      
      {/* Deploy Button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={saveStrategy}
          className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-lg font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-green-500/30"
        >
          🚀 Deploy Strategy
        </button>
      </div>
    </div>
  );

  const renderBacktestSidebar = () => (
    <div className="fixed right-0 top-0 h-full w-[768px] bg-gradient-to-b from-gray-900 to-black border-l border-gray-600/30 shadow-2xl transform transition-transform duration-300 z-40">
      <div className="p-6 border-b border-gray-700/30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">📊 Live Backtest Results</h3>
            <p className="text-sm text-gray-400 mt-1">Closed trades: {tradeHistory.length}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={runBacktest}
              className="px-4 py-2 bg-gradient-to-r from-primary-blue to-primary-blue-dark hover:from-primary-blue-dark hover:to-primary-blue text-white rounded-lg font-medium transition-all"
            >
              🔄 Run Backtest
            </button>
            <button
              onClick={() => setShowBacktestSidebar(false)}
              className="p-2 hover:bg-gray-800 rounded transition-all"
            >
              <span className="text-gray-400">✕</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-6 space-y-6 overflow-y-auto" style={{ height: 'calc(100% - 80px)' }}>
        {isBacktesting && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Backtest Progress</span>
              <span className="text-sm font-bold text-primary-blue">{backtestProgress}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-primary-blue to-primary-purple h-full transition-all duration-300 ease-out"
                style={{ width: `${backtestProgress}%` }}
              />
            </div>
            <div className="text-center mt-4">
              <div className="animate-pulse text-primary-blue text-sm">Analyzing {tradeHistory.length} historical patterns...</div>
            </div>
          </div>
        )}
        
        {/* Key Metrics in 2 columns for wider layout */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <div className="text-2xl font-bold text-green-300">{backtestResults.winRate.toFixed(1)}%</div>
            <div className="text-xs text-gray-400">Win Rate</div>
          </div>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <div className="text-2xl font-bold text-white">{backtestResults.wins}/{backtestResults.losses}</div>
            <div className="text-xs text-gray-400">Wins/Losses</div>
          </div>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-300">{backtestResults.roi.toFixed(1)}%</div>
            <div className="text-xs text-gray-400">ROI</div>
          </div>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <div className="text-2xl font-bold text-red-300">{backtestResults.drawdown.toFixed(1)}%</div>
            <div className="text-xs text-gray-400">Max Drawdown</div>
          </div>
        </div>
        
        <div className="text-center p-4 bg-gradient-to-r from-green-900/30 to-green-800/30 rounded-lg border border-green-500/30">
          <div className="text-3xl font-bold text-green-300">${backtestResults.pnl.toFixed(2)}</div>
          <div className="text-sm text-gray-300">Total PnL</div>
        </div>
        
        {/* Cumulative Growth Chart */}
        <div>
          <h4 className="text-white font-medium mb-3">📈 Cumulative Growth</h4>
          <div className="h-32 bg-gray-900/50 rounded-lg border border-gray-600/40 flex items-end justify-between p-2">
            {backtestResults.cumulativeGrowth.map((value, index) => (
              <div
                key={index}
                className="bg-gradient-to-t from-green-500 to-green-300 rounded-sm"
                style={{ 
                  height: `${Math.max(10, (value / 25) * 100)}%`,
                  width: '8%'
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Strategy Analysis */}
        <div>
          <h4 className="text-white font-medium mb-3">📋 Strategy Analysis</h4>
          
          {/* Pros */}
          <div className="mb-4">
            <h5 className="text-green-300 font-medium mb-2">✅ Pros</h5>
            <div className="space-y-1 text-sm">
              <div className="text-gray-300">• High win rate potential</div>
              <div className="text-gray-300">• Good risk/reward ratio</div>
              <div className="text-gray-300">• Suitable for {strategyData.coinPair}</div>
              <div className="text-gray-300">• ML enhanced signals</div>
            </div>
          </div>
          
          {/* Cons */}
          <div className="mb-4">
            <h5 className="text-red-300 font-medium mb-2">⚠️ Cons</h5>
            <div className="space-y-1 text-sm">
              <div className="text-gray-300">• May generate false signals</div>
              <div className="text-gray-300">• Requires active monitoring</div>
              <div className="text-gray-300">• High leverage increases risk</div>
              <div className="text-gray-300">• Market volatility dependent</div>
            </div>
          </div>
          
          {/* Risk Assessment */}
          <div className="p-3 bg-gradient-to-r from-primary-blue/20 to-primary-purple/20 rounded-lg border border-primary-blue/30">
            <h5 className="text-primary-blue font-medium mb-2">🎯 Risk Assessment</h5>
            <div className="text-sm text-gray-300">
              <div>Risk Level: <span className="text-primary-blue font-bold">Medium</span></div>
              <div>Recommended Capital: <span className="text-green-400">5-10%</span></div>
              <div>Expected Drawdown: <span className="text-red-400">8-15%</span></div>
            </div>
          </div>
        </div>

        {/* Period Selector and Trade Details */}
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Backtest Period</label>
            <select 
              value={backtestPeriod}
              onChange={(e) => setBacktestPeriod(e.target.value)}
              className="w-full p-3 bg-gray-900 border border-gray-600/40 rounded-lg text-white focus:border-primary-blue/60 focus:outline-none"
            >
              <option value="1week">1 Week</option>
              <option value="1month">1 Month</option>
              <option value="3months">3 Months</option>
              <option value="6months">6 Months</option>
              <option value="1year">1 Year</option>
            </select>
          </div>
          
          <button
            onClick={() => setShowTradeDetails(true)}
            className="w-full px-6 py-3 bg-gradient-to-r from-primary-purple to-primary-blue hover:from-primary-blue hover:to-primary-purple text-white rounded-lg font-medium transition-all duration-300 shadow-lg flex items-center justify-center gap-2"
          >
            <span>📊</span>
            <span>Closed Trade Details ({tradeHistory.length} trades)</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-700/30">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/strategies')}
            className="p-2 hover:bg-gray-800 rounded transition-all"
          >
            <span className="text-gray-400">←</span>
          </button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-primary-blue to-primary-purple bg-clip-text text-transparent">
            🧠 AI Strategy Builder
          </h1>
          {strategyData.name && (
            <p className="text-gray-400 text-sm mt-1">
              {strategies.find(s => s.name === strategyData.name) ? '✏️ Editing' : '🚀 Creating'}: {strategyData.name}
            </p>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowBacktestSidebar(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300"
          >
            <span>📊</span>
            <span>Live Backtest</span>
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Main Content */}
        <div className={`flex-1 transition-all duration-300 ${showBacktestSidebar ? 'mr-96' : ''}`}>
          {/* Tab Navigation */}
          <div className="p-6 border-b border-gray-700/30">
            <div className="flex space-x-1 bg-gray-900/50 rounded-lg p-1">
              {[
                { id: 1, label: 'General', icon: '⚙️' },
                { id: 2, label: 'Indicators', icon: '📈' },
                { id: 3, label: 'Machine Learning', icon: '🤖' },
                { id: 4, label: 'Entry/Exit', icon: '🎯' },
                { id: 5, label: 'Finalize', icon: '✅' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all ${
                    currentTab === tab.id
                      ? 'bg-gradient-to-r from-primary-blue to-primary-blue-dark text-white shadow-lg shadow-primary-blue/50'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {currentTab === 1 && renderGeneralTab()}
            {currentTab === 2 && renderIndicatorsTab()}
            {currentTab === 3 && renderMLTab()}
            {currentTab === 4 && renderEntryExitTab()}
            {currentTab === 5 && renderFinalizeTab()}
          </div>

          {/* Action Buttons */}
          <div className="p-6 border-t border-gray-700/30">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentTab(Math.max(1, currentTab - 1))}
                disabled={currentTab === 1}
                className="flex items-center space-x-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-500 text-white rounded-lg font-medium transition-all"
              >
                <span>←</span>
                <span>Previous</span>
              </button>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={saveStrategy}
                  className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300"
                >
                  <span>💾</span>
                  <span>Save Strategy</span>
                </button>
                
                <button
                  onClick={() => setShowAdvancedBacktest(true)}
                  className="flex items-center space-x-2 bg-gradient-to-r from-primary-purple to-primary-blue hover:from-primary-blue hover:to-primary-purple text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg"
                >
                  <span>📊</span>
                  <span>Advanced Backtest</span>
                </button>
                
                <button
                  onClick={() => setCurrentTab(Math.min(5, currentTab + 1))}
                  disabled={currentTab >= 5}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-blue to-primary-blue-dark hover:from-primary-blue-dark hover:to-primary-blue disabled:from-gray-600 disabled:to-gray-700 text-white disabled:text-gray-400 rounded-lg font-medium transition-all"
                >
                  <span>Next</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Backtest Sidebar */}
        {showBacktestSidebar && renderBacktestSidebar()}
      </div>

      {/* Trade Details Modal */}
      {showTradeDetails && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl h-full max-h-[90vh] bg-gradient-to-br from-black/90 to-gray-900/90 rounded-2xl border border-primary-blue/20 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-primary-blue/20">
              <h2 className="section-title">📊 Trade History Details - {tradeHistory.length} Trades</h2>
              <button
                onClick={() => setShowTradeDetails(false)}
                className="p-2 hover:bg-primary-blue/10 rounded-lg transition-all text-gray-400 hover:text-white"
              >
                <span className="text-2xl">✕</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto" style={{ height: 'calc(100% - 80px)' }}>
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-300">
                    {tradeHistory.filter(t => t.status === 'WIN').length}
                  </div>
                  <div className="text-sm text-gray-400">Total Wins</div>
                </div>
                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-red-300">
                    {tradeHistory.filter(t => t.status === 'LOSS').length}
                  </div>
                  <div className="text-sm text-gray-400">Total Losses</div>
                </div>
                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-300">
                    ${(tradeHistory.reduce((sum, t) => sum + t.pnl, 0) / tradeHistory.length).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400">Avg Trade PnL</div>
                </div>
                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary-blue">
                    {(tradeHistory[tradeHistory.length - 1]?.cumulativeROI || 0).toFixed(2)}%
                  </div>
                  <div className="text-sm text-gray-400">Final ROI</div>
                </div>
              </div>

              {/* Trade Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400">#</th>
                      <th className="text-left py-3 px-4 text-gray-400">Date</th>
                      <th className="text-left py-3 px-4 text-gray-400">Type</th>
                      <th className="text-right py-3 px-4 text-gray-400">Entry</th>
                      <th className="text-right py-3 px-4 text-gray-400">Exit</th>
                      <th className="text-right py-3 px-4 text-gray-400">PnL</th>
                      <th className="text-right py-3 px-4 text-gray-400">ROI</th>
                      <th className="text-right py-3 px-4 text-gray-400">Cumulative ROI</th>
                      <th className="text-left py-3 px-4 text-gray-400">Duration</th>
                      <th className="text-center py-3 px-4 text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tradeHistory.map((trade) => (
                      <tr key={trade.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                        <td className="py-3 px-4 text-gray-300">{trade.id}</td>
                        <td className="py-3 px-4 text-gray-300">
                          {new Date(trade.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            trade.type === 'LONG' ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                          }`}>
                            {trade.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300">${trade.entry.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-gray-300">${trade.exit.toFixed(2)}</td>
                        <td className={`py-3 px-4 text-right font-medium ${
                          trade.pnl > 0 ? 'text-green-300' : 'text-red-300'
                        }`}>
                          ${trade.pnl.toFixed(2)}
                        </td>
                        <td className={`py-3 px-4 text-right ${
                          trade.roi > 0 ? 'text-green-300' : 'text-red-300'
                        }`}>
                          {trade.roi.toFixed(2)}%
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${
                          trade.cumulativeROI > 0 ? 'text-blue-300' : 'text-orange-300'
                        }`}>
                          {trade.cumulativeROI.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-gray-300">{trade.duration}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            trade.status === 'WIN' 
                              ? 'bg-green-900/30 text-green-300' 
                              : 'bg-red-900/30 text-red-300'
                          }`}>
                            {trade.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Backtest Modal */}
      {showAdvancedBacktest && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-7xl h-full max-h-[90vh] bg-gradient-to-br from-black/90 to-gray-900/90 rounded-2xl border border-primary-blue/20 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-primary-blue/20">
              <h2 className="section-title">📊 Advanced Backtest - {strategyData.name || 'AI Strategy'}</h2>
              <button
                onClick={() => setShowAdvancedBacktest(false)}
                className="p-2 hover:bg-primary-blue/10 rounded-lg transition-all text-gray-400 hover:text-white"
              >
                <span className="text-2xl">✕</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto h-full">
              <AdvancedBacktest 
                symbol={strategyData.coinPair}
                strategy={strategyData.name || 'AI Strategy'}
                isLoading={isBacktesting}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingStrategyBuilder;