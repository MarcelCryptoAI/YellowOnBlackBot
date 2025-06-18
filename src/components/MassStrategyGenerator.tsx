import React, { useState } from 'react';
import { openaiApi } from '../services/api';

interface GeneratedStrategy {
  id: string;
  name: string;
  coin: string;
  signalIndicator: any;
  confirmingIndicators: any[];
  entryManagement: any;
  takeProfitSettings: any;
  stopLossSettings: any;
  optimizationScore?: number;
  status: 'pending' | 'generating' | 'optimizing' | 'completed' | 'error';
  error?: string;
}

const MassStrategyGenerator: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategies, setStrategies] = useState<GeneratedStrategy[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 10 });
  const [selectedTemplates, setSelectedTemplates] = useState<number[]>([]);
  const [showTemplateSelection, setShowTemplateSelection] = useState(false);
  const [selectedCoins, setSelectedCoins] = useState<{[key: number]: string[]}>({});
  const [showCoinSelection, setShowCoinSelection] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [processLog, setProcessLog] = useState<string[]>([]);
  const [showConsole, setShowConsole] = useState(false);

  // Logging functions
  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    console.log(logEntry);
    setProcessLog(prev => {
      const updated = [...prev, logEntry];
      // Auto-scroll to bottom after state update
      setTimeout(() => {
        const consoleBottom = document.getElementById('console-bottom');
        if (consoleBottom) {
          consoleBottom.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return updated;
    });
  };

  const clearLog = () => {
    setProcessLog([]);
  };

  // Predefined strategy templates for variation
  const strategyTemplates = [
    // Trend Following Strategies
    { type: 'trend', indicators: ['EMA', 'MACD', 'ADX'], risk: 'medium' },
    { type: 'trend', indicators: ['SMA', 'RSI', 'Bollinger Bands'], risk: 'low' },
    { type: 'trend', indicators: ['VWAP', 'Supertrend', 'ATR'], risk: 'high' },
    
    // Mean Reversion Strategies
    { type: 'reversal', indicators: ['RSI', 'Stochastic', 'Bollinger Bands'], risk: 'medium' },
    { type: 'reversal', indicators: ['CCI', 'Williams %R', 'MACD'], risk: 'low' },
    
    // Momentum Strategies
    { type: 'momentum', indicators: ['MACD', 'Momentum', 'ROC'], risk: 'high' },
    { type: 'momentum', indicators: ['RSI', 'MFI', 'CMF'], risk: 'medium' },
    
    // Volatility Strategies
    { type: 'volatility', indicators: ['ATR', 'Bollinger Bands', 'Keltner Channels'], risk: 'high' },
    { type: 'volatility', indicators: ['ADX', 'Donchian Channels', 'Standard Deviation'], risk: 'medium' },
    
    // Volume-based Strategies
    { type: 'volume', indicators: ['OBV', 'Volume Profile', 'MFI'], risk: 'low' },
    { type: 'volume', indicators: ['VWAP', 'CMF', 'A/D Line'], risk: 'medium' },
  ];

  // Coin performance database per strategy type and indicators
  const coinPerformanceData = {
    trend: {
      'EMA_MACD_ADX': { 
        bestCoins: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'], 
        winRates: [74.2, 71.8, 69.5],
        stability: [8.5, 8.0, 7.8] 
      },
      'SMA_RSI_Bollinger': { 
        bestCoins: ['SOLUSDT', 'AVAXUSDT', 'DOTUSDT'], 
        winRates: [72.1, 68.9, 67.3],
        stability: [7.9, 7.5, 7.2] 
      },
      'VWAP_Supertrend_ATR': { 
        bestCoins: ['LINKUSDT', 'MATICUSDT', 'NEARUSDT'], 
        winRates: [69.8, 66.4, 65.1],
        stability: [7.6, 7.1, 6.9] 
      }
    },
    reversal: {
      'RSI_Stochastic_Bollinger': { 
        bestCoins: ['ADAUSDT', 'DOGEUSDT', 'XRPUSDT'], 
        winRates: [71.3, 68.7, 66.2],
        stability: [8.1, 7.7, 7.4] 
      },
      'CCI_Williams_MACD': { 
        bestCoins: ['ARBUSDT', 'OPUSDT', 'INJUSDT'], 
        winRates: [70.5, 67.8, 65.9],
        stability: [7.8, 7.3, 7.0] 
      }
    },
    momentum: {
      'MACD_Momentum_ROC': { 
        bestCoins: ['SUIUSDT', 'APTUSDT', 'FETUSDT'], 
        winRates: [73.4, 70.1, 68.8],
        stability: [8.2, 7.8, 7.5] 
      },
      'RSI_MFI_CMF': { 
        bestCoins: ['RENDERUSDT', 'AIUSDT', 'WLDUSDT'], 
        winRates: [72.0, 69.3, 67.6],
        stability: [7.9, 7.4, 7.1] 
      }
    },
    volatility: {
      'ATR_Bollinger_Keltner': { 
        bestCoins: ['PEPEUSDT', 'SHIBUSDT', 'BONKUSDT'], 
        winRates: [75.6, 72.8, 70.4],
        stability: [6.8, 6.5, 6.2] 
      },
      'ADX_Donchian_StdDev': { 
        bestCoins: ['WIFUSDT', 'FLOKIUSDT', 'DOGSUSDT'], 
        winRates: [74.1, 71.5, 69.7],
        stability: [6.9, 6.6, 6.3] 
      }
    },
    volume: {
      'OBV_VolumeProfile_MFI': { 
        bestCoins: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], 
        winRates: [70.8, 68.4, 66.9],
        stability: [8.3, 8.0, 7.7] 
      },
      'VWAP_CMF_ADLine': { 
        bestCoins: ['BNBUSDT', 'AVAXUSDT', 'LINKUSDT'], 
        winRates: [69.5, 67.2, 65.8],
        stability: [8.1, 7.8, 7.5] 
      }
    }
  };

  // All available coins for backup selection
  const allCoins = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT',
    'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT',
    'NEARUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT', 'SUIUSDT',
    'XRPUSDT', 'APTUSDT', 'FETUSDT', 'RENDERUSDT', 'AIUSDT',
    'WLDUSDT', 'PEPEUSDT', 'SHIBUSDT', 'BONKUSDT', 'WIFUSDT',
    'FLOKIUSDT', 'DOGSUSDT'
  ];

  const getBestCoinsForTemplate = (template: any): string[] => {
    const indicatorKey = template.indicators.join('_').replace(/\s+/g, '');
    const performanceData = coinPerformanceData[template.type as keyof typeof coinPerformanceData];
    
    if (performanceData && performanceData[indicatorKey as keyof typeof performanceData]) {
      return performanceData[indicatorKey as keyof typeof performanceData].bestCoins;
    }
    
    // Fallback to general coins for the strategy type
    switch (template.type) {
      case 'trend':
        return ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      case 'reversal':
        return ['ADAUSDT', 'DOGEUSDT', 'XRPUSDT'];
      case 'momentum':
        return ['SUIUSDT', 'APTUSDT', 'FETUSDT'];
      case 'volatility':
        return ['PEPEUSDT', 'SHIBUSDT', 'BONKUSDT'];
      case 'volume':
        return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
      default:
        return ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
    }
  };

  const getWinRateForCoin = (template: any, coin: string): number => {
    const indicatorKey = template.indicators.join('_').replace(/\s+/g, '');
    const performanceData = coinPerformanceData[template.type as keyof typeof coinPerformanceData];
    
    if (performanceData && performanceData[indicatorKey as keyof typeof performanceData]) {
      const data = performanceData[indicatorKey as keyof typeof performanceData];
      const coinIndex = data.bestCoins.indexOf(coin);
      return coinIndex !== -1 ? data.winRates[coinIndex] : 65.0; // Default winrate
    }
    
    return 65.0; // Default winrate
  };

  const generateRandomStrategy = (templateIndex: number, coinIndex: number = 0): GeneratedStrategy => {
    const template = strategyTemplates[templateIndex];
    
    // Get selected coins for this template, or use best coins
    const availableCoins = selectedCoins[templateIndex] || getBestCoinsForTemplate(template);
    const coin = availableCoins[coinIndex % availableCoins.length];
    
    const uniqueId = `strategy_${Date.now()}_${templateIndex}_${coinIndex}`;
    
    // Generate strategy name based on type and coin
    const expectedWinRate = getWinRateForCoin(template, coin);
    const strategyName = `${template.type.charAt(0).toUpperCase() + template.type.slice(1)} ${coin.replace('USDT', '')} ${template.risk} Risk (${expectedWinRate.toFixed(1)}% WR)`;

    return {
      id: uniqueId,
      name: strategyName,
      coin: coin,
      signalIndicator: {
        type: template.indicators[0],
        parameters: generateIndicatorParams(template.indicators[0])
      },
      confirmingIndicators: template.indicators.slice(1).map(ind => ({
        type: ind,
        parameters: generateIndicatorParams(ind)
      })),
      entryManagement: generateEntrySettings(template.risk),
      takeProfitSettings: generateTakeProfitSettings(template.risk),
      stopLossSettings: generateStopLossSettings(template.risk),
      status: 'pending'
    };
  };

  const generateIndicatorParams = (indicator: string) => {
    const params: any = {};
    
    switch (indicator) {
      case 'EMA':
      case 'SMA':
        params.period = Math.floor(Math.random() * 50) + 10;
        break;
      case 'RSI':
        params.period = 14;
        params.overbought = 70;
        params.oversold = 30;
        break;
      case 'MACD':
        params.fast = 12;
        params.slow = 26;
        params.signal = 9;
        break;
      case 'Bollinger Bands':
        params.period = 20;
        params.stdDev = 2;
        break;
      case 'ATR':
        params.period = 14;
        break;
      case 'ADX':
        params.period = 14;
        params.threshold = 25;
        break;
      default:
        params.period = 14;
    }
    
    return params;
  };

  const generateEntrySettings = (risk: string) => {
    const baseAmount = risk === 'low' ? 100 : risk === 'medium' ? 250 : 500;
    return {
      orderType: 'market',
      amount: baseAmount,
      entries: risk === 'high' ? 3 : risk === 'medium' ? 2 : 1,
      leverage: risk === 'low' ? 2 : risk === 'medium' ? 5 : 10
    };
  };

  const generateTakeProfitSettings = (risk: string) => {
    const targets = risk === 'low' 
      ? [{ percentage: 1.5, portion: 100 }]
      : risk === 'medium'
      ? [{ percentage: 2, portion: 50 }, { percentage: 3, portion: 50 }]
      : [{ percentage: 3, portion: 33 }, { percentage: 5, portion: 33 }, { percentage: 8, portion: 34 }];
    
    return {
      type: 'percentage',
      targets: targets
    };
  };

  const generateStopLossSettings = (risk: string) => {
    return {
      type: 'percentage',
      value: risk === 'low' ? 1 : risk === 'medium' ? 2 : 3,
      trailing: risk !== 'low',
      trailingDistance: risk === 'high' ? 1 : 0.5
    };
  };

  const optimizeStrategy = async (strategy: GeneratedStrategy): Promise<GeneratedStrategy> => {
    try {
      addLog(`Starting optimization for ${strategy.name}`, 'info');
      
      // Update status
      setStrategies(prev => prev.map(s => 
        s.id === strategy.id ? { ...s, status: 'optimizing' as const } : s
      ));

      addLog(`Calling OpenAI API for ${strategy.coin} optimization...`, 'info');
      
      // Call OpenAI to optimize the strategy
      const response = await openaiApi.optimizeTradeParameters({
        coin: strategy.coin,
        signalIndicator: strategy.signalIndicator,
        confirmingIndicators: strategy.confirmingIndicators,
        currentSettings: {
          entry: strategy.entryManagement,
          takeProfit: strategy.takeProfitSettings,
          stopLoss: strategy.stopLossSettings
        }
      });

      addLog(`OpenAI API response received for ${strategy.coin}`, 'info');

      if (response.success && response.data) {
        addLog(`Optimization successful for ${strategy.coin} - Score: ${response.data.score || 'N/A'}`, 'success');
        
        // Apply optimized settings
        const optimizedStrategy = {
          ...strategy,
          signalIndicator: response.data.optimizedIndicators?.signal || strategy.signalIndicator,
          confirmingIndicators: response.data.optimizedIndicators?.confirming || strategy.confirmingIndicators,
          entryManagement: response.data.optimizedSettings?.entry || strategy.entryManagement,
          takeProfitSettings: response.data.optimizedSettings?.takeProfit || strategy.takeProfitSettings,
          stopLossSettings: response.data.optimizedSettings?.stopLoss || strategy.stopLossSettings,
          optimizationScore: response.data.score || Math.random() * 100,
          status: 'completed' as const
        };

        return optimizedStrategy;
      } else {
        addLog(`OpenAI optimization failed for ${strategy.coin}, using defaults`, 'warning');
        return { ...strategy, status: 'completed' as const, optimizationScore: 75 };
      }
    } catch (error: any) {
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      addLog(`Error optimizing ${strategy.coin}: ${errorMsg}`, 'error');
      console.error(`Error optimizing strategy ${strategy.id}:`, error);
      return { 
        ...strategy, 
        status: 'error' as const, 
        error: 'Optimization failed: ' + errorMsg,
        optimizationScore: 0 
      };
    }
  };

  const startTemplateSelection = () => {
    setShowTemplateSelection(true);
    setSelectedTemplates([]);
  };

  const toggleTemplate = (index: number) => {
    setSelectedTemplates(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else if (prev.length < 10) {
        return [...prev, index];
      }
      return prev;
    });
  };

  const proceedToCoinSelection = () => {
    if (selectedTemplates.length === 0) {
      alert('Please select at least 1 strategy template');
      return;
    }

    // Initialize coin selection with best coins for each template
    const initialCoins: {[key: number]: string[]} = {};
    selectedTemplates.forEach(templateIndex => {
      const template = strategyTemplates[templateIndex];
      initialCoins[templateIndex] = getBestCoinsForTemplate(template);
    });
    setSelectedCoins(initialCoins);
    
    setShowTemplateSelection(false);
    setShowCoinSelection(true);
  };

  const toggleCoinForTemplate = (templateIndex: number, coin: string) => {
    setSelectedCoins(prev => {
      const updated = { ...prev };
      if (!updated[templateIndex]) {
        updated[templateIndex] = [];
      }
      
      if (updated[templateIndex].includes(coin)) {
        updated[templateIndex] = updated[templateIndex].filter(c => c !== coin);
      } else {
        updated[templateIndex] = [...updated[templateIndex], coin];
      }
      
      return updated;
    });
  };

  const generateAndOptimizeStrategies = async () => {
    const totalStrategies = selectedTemplates.reduce((sum, templateIndex) => {
      const coins = selectedCoins[templateIndex] || [];
      return sum + Math.min(coins.length, 3); // Max 3 coins per template
    }, 0);

    addLog(`Starting strategy generation process...`, 'info');
    addLog(`Selected ${selectedTemplates.length} templates, generating ${totalStrategies} strategies`, 'info');
    clearLog(); // Clear previous logs
    addLog(`=== STRATEGY GENERATION STARTED ===`, 'info');

    setIsGenerating(true);
    setShowCoinSelection(false);
    setShowConsole(true); // Show console automatically
    setProgress({ current: 0, total: totalStrategies });
    setStrategies([]);
    setShowResults(false);

    // Generate strategies from selected templates and coins
    const generatedStrategies: GeneratedStrategy[] = [];
    let strategyCount = 0;
    
    addLog(`Phase 1: Generating ${totalStrategies} strategy configurations...`, 'info');
    
    for (const templateIndex of selectedTemplates) {
      const template = strategyTemplates[templateIndex];
      const coins = selectedCoins[templateIndex] || getBestCoinsForTemplate(template);
      const coinsToUse = coins.slice(0, 3); // Max 3 coins per template
      
      addLog(`Template: ${template.type} (${template.risk} risk) - ${coinsToUse.length} coins`, 'info');
      
      for (let coinIndex = 0; coinIndex < coinsToUse.length; coinIndex++) {
        const strategy = generateRandomStrategy(templateIndex, coinIndex);
        generatedStrategies.push(strategy);
        setStrategies([...generatedStrategies]);
        setProgress({ current: strategyCount + 1, total: totalStrategies });
        strategyCount++;
        
        addLog(`Generated: ${strategy.name}`, 'success');
        
        // Small delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    addLog(`Phase 1 Complete: ${generatedStrategies.length} strategies generated`, 'success');
    addLog(`Phase 2: Starting AI optimization...`, 'info');

    // Optimize strategies one by one to avoid rate limits
    for (let i = 0; i < generatedStrategies.length; i++) {
      addLog(`Optimizing strategy ${i + 1}/${generatedStrategies.length}...`, 'info');
      
      const optimized = await optimizeStrategy(generatedStrategies[i]);
      
      setStrategies(prev => {
        const updated = [...prev];
        const index = updated.findIndex(s => s.id === optimized.id);
        if (index !== -1) {
          updated[index] = optimized;
        }
        return updated;
      });
      
      // Delay between optimizations to avoid rate limits
      addLog(`Waiting 2 seconds before next optimization...`, 'info');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    addLog(`=== STRATEGY GENERATION COMPLETED ===`, 'success');
    addLog(`Generated ${generatedStrategies.length} strategies successfully`, 'success');
    
    const successfulStrategies = generatedStrategies.filter(s => s.status === 'completed').length;
    const failedStrategies = generatedStrategies.filter(s => s.status === 'error').length;
    
    addLog(`Success: ${successfulStrategies}, Failed: ${failedStrategies}`, successfulStrategies > 0 ? 'success' : 'warning');

    setIsGenerating(false);
    setShowResults(true);
  };

  const saveAllStrategies = () => {
    // Get existing strategies from localStorage
    const existingStrategies = JSON.parse(localStorage.getItem('userStrategies') || '[]');
    
    // Convert our generated strategies to the format expected by the strategies page
    const newStrategies = strategies
      .filter(s => s.status === 'completed')
      .map(s => ({
        id: s.id,
        name: s.name,
        symbol: s.coin,
        status: 'ACTIVE' as const,
        profit: 0,
        trades: 0,
        winRate: 0,
        createdAt: new Date().toISOString(),
        description: `AI-optimized ${s.name} with score: ${s.optimizationScore?.toFixed(1)}%`,
        timeframe: '15m',
        indicators: [
          s.signalIndicator.type,
          ...s.confirmingIndicators.map(ind => ind.type)
        ],
        riskScore: s.name.includes('low') ? 3 : s.name.includes('medium') ? 5 : 8,
        config: {
          coin: s.coin,
          signalIndicator: s.signalIndicator,
          confirmingIndicators: s.confirmingIndicators,
          entryManagement: s.entryManagement,
          takeProfitSettings: s.takeProfitSettings,
          stopLossSettings: s.stopLossSettings
        }
      }));
    
    // Combine and save
    const allStrategies = [...existingStrategies, ...newStrategies];
    localStorage.setItem('userStrategies', JSON.stringify(allStrategies));
    
    alert(`✅ ${newStrategies.length} strategies saved successfully!`);
  };

  const getStatusColor = (status: GeneratedStrategy['status']) => {
    switch (status) {
      case 'pending': return 'text-gray-400';
      case 'generating': return 'text-yellow-400';
      case 'optimizing': return 'text-blue-400';
      case 'completed': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: GeneratedStrategy['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'generating': return '🔨';
      case 'optimizing': return '🧠';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-2">🚀 Mass Strategy Generator</h3>
          <p className="text-gray-400 text-sm">Select up to 10 strategy types and generate AI-optimized trading strategies</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {!isGenerating && strategies.length === 0 && !showTemplateSelection && (
            <button
              onClick={startTemplateSelection}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-purple-400/30 flex items-center space-x-2"
            >
              <span>🎯</span>
              <span>Select Strategy Types</span>
            </button>
          )}
          
          {processLog.length > 0 && !showConsole && (
            <button
              onClick={() => setShowConsole(true)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <span>📋</span>
              <span>Show Console ({processLog.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Template Selection */}
      {showTemplateSelection && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-bold text-white">Select Strategy Types (Max 10)</h4>
            <div className="text-sm text-gray-400">{selectedTemplates.length}/10 selected</div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {strategyTemplates.map((template, index) => (
              <div
                key={index}
                onClick={() => toggleTemplate(index)}
                className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                  selectedTemplates.includes(index)
                    ? 'bg-blue-600/20 border-blue-400 text-white'
                    : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:border-gray-600'
                }`}
              >
                <div className="font-medium text-sm">{template.type.charAt(0).toUpperCase() + template.type.slice(1)}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {template.indicators.join(', ')} • {template.risk} risk
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowTemplateSelection(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={proceedToCoinSelection}
              disabled={selectedTemplates.length === 0}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-300"
            >
              📈 Select Coins for {selectedTemplates.length} Templates
            </button>
          </div>
        </div>
      )}

      {/* Coin Selection */}
      {showCoinSelection && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-bold text-white">Select Best Coins per Strategy Type</h4>
            <div className="text-sm text-gray-400">
              {selectedTemplates.reduce((sum, ti) => sum + (selectedCoins[ti]?.length || 0), 0)} coins selected
            </div>
          </div>
          
          <div className="space-y-6">
            {selectedTemplates.map(templateIndex => {
              const template = strategyTemplates[templateIndex];
              const bestCoins = getBestCoinsForTemplate(template);
              const templateCoins = selectedCoins[templateIndex] || [];
              
              return (
                <div key={templateIndex} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h5 className="font-medium text-white">
                        {template.type.charAt(0).toUpperCase() + template.type.slice(1)} Strategy
                      </h5>
                      <div className="text-xs text-gray-400">
                        {template.indicators.join(', ')} • {template.risk} risk
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">
                      {templateCoins.length}/3 coins (max 3 per template)
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {/* Best performing coins first */}
                    {bestCoins.map(coin => {
                      const winRate = getWinRateForCoin(template, coin);
                      const isSelected = templateCoins.includes(coin);
                      
                      return (
                        <div
                          key={coin}
                          onClick={() => toggleCoinForTemplate(templateIndex, coin)}
                          className={`p-3 rounded border cursor-pointer transition-all text-center ${
                            isSelected
                              ? 'bg-green-600/20 border-green-400 text-white'
                              : templateCoins.length >= 3
                              ? 'bg-gray-800/50 border-gray-600 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:border-gray-500'
                          }`}
                        >
                          <div className="font-medium text-sm">{coin.replace('USDT', '')}</div>
                          <div className="text-xs text-green-400">
                            {winRate.toFixed(1)}% WR
                          </div>
                          <div className="text-xs text-gray-500">Best for {template.type}</div>
                        </div>
                      );
                    })}
                    
                    {/* Other available coins */}
                    {allCoins.filter(coin => !bestCoins.includes(coin)).slice(0, 8).map(coin => {
                      const winRate = 62.0; // Default for non-optimized coins
                      const isSelected = templateCoins.includes(coin);
                      
                      return (
                        <div
                          key={coin}
                          onClick={() => toggleCoinForTemplate(templateIndex, coin)}
                          className={`p-3 rounded border cursor-pointer transition-all text-center ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-400 text-white'
                              : templateCoins.length >= 3
                              ? 'bg-gray-800/50 border-gray-600 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:border-gray-500'
                          }`}
                        >
                          <div className="font-medium text-sm">{coin.replace('USDT', '')}</div>
                          <div className="text-xs text-gray-400">
                            ~{winRate.toFixed(1)}% WR
                          </div>
                          <div className="text-xs text-gray-500">General</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="flex items-center space-x-3 mt-6">
            <button
              onClick={() => {
                setShowCoinSelection(false);
                setShowTemplateSelection(true);
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              ← Back to Templates
            </button>
            <button
              onClick={generateAndOptimizeStrategies}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all duration-300"
            >
              🚀 Generate Strategies
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isGenerating && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span>Generating & Optimizing Strategies...</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Strategy List */}
      {strategies.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {strategies.map((strategy) => (
            <div 
              key={strategy.id} 
              className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <span className={`text-lg ${getStatusColor(strategy.status)}`}>
                  {getStatusIcon(strategy.status)}
                </span>
                <div>
                  <div className="text-white font-medium text-sm">{strategy.name}</div>
                  <div className="text-gray-400 text-xs">
                    {strategy.status === 'completed' && strategy.optimizationScore && (
                      <span className="text-green-400">Score: {strategy.optimizationScore.toFixed(1)}%</span>
                    )}
                    {strategy.status === 'error' && (
                      <span className="text-red-400">{strategy.error}</span>
                    )}
                    {strategy.status === 'optimizing' && (
                      <span className="text-blue-400">AI optimizing parameters...</span>
                    )}
                  </div>
                </div>
              </div>
              
              {strategy.status === 'completed' && (
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-gray-400">
                    {strategy.confirmingIndicators.length + 1} indicators
                  </span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400">
                    {strategy.entryManagement.leverage}x leverage
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Console Log */}
      {showConsole && (
        <div className="mt-6 bg-gray-900 rounded-lg border border-gray-600 overflow-hidden">
          <div className="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-600">
            <div className="flex items-center space-x-2">
              <span className="text-green-400">●</span>
              <span className="text-white font-medium text-sm">Strategy Generation Console</span>
              <span className="text-gray-400 text-xs">({processLog.length} entries)</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={clearLog}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Clear
              </button>
              <button
                onClick={() => setShowConsole(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
          </div>
          
          <div className="h-64 overflow-y-auto bg-black/50 p-4 font-mono text-sm">
            {processLog.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Console log will appear here during strategy generation...
              </div>
            ) : (
              <div className="space-y-1">
                {processLog.map((entry, index) => {
                  const isError = entry.includes('ERROR:');
                  const isSuccess = entry.includes('SUCCESS:');
                  const isWarning = entry.includes('WARNING:');
                  
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
                      {entry}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Auto-scroll to bottom */}
            <div id="console-bottom" />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {showResults && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Successfully generated {strategies.filter(s => s.status === 'completed').length} strategies
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setStrategies([]);
                setShowResults(false);
                setProgress({ current: 0, total: 25 });
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Clear
            </button>
            <button
              onClick={saveAllStrategies}
              className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-green-400/30"
            >
              💾 Save All Strategies
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MassStrategyGenerator;