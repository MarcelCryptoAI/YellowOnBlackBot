import React, { useState } from 'react';

// Types
interface Trade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
  exchange: string;
  timestamp: string;
}

interface Strategy {
  id: string;
  name: string;
  symbol: string;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
  profit: number;
  trades: number;
  winRate: number;
}

interface SystemStatus {
  backend: boolean;
  frontend: boolean;
  openai: boolean;
  bybit: boolean;
  mexc: boolean;
  binance: boolean;
}

interface ApiCredentials {
  bybit: {
    apiKey: string;
    secretKey: string;
    testnet: boolean;
  };
  openai: {
    apiKey: string;
    organization: string;
  };
}

// Mock Data
const mockTrades: Trade[] = [
  {
    id: '1',
    symbol: 'BTCUSDT',
    direction: 'LONG',
    amount: 0.1,
    entryPrice: 43250,
    currentPrice: 43890,
    pnl: 64,
    pnlPercent: 1.48,
    status: 'OPEN',
    exchange: 'Bybit',
    timestamp: '2025-06-05T09:30:00Z'
  },
  {
    id: '2',
    symbol: 'ETHUSDT',
    direction: 'SHORT',
    amount: 2.5,
    entryPrice: 2680,
    currentPrice: 2645,
    pnl: 87.5,
    pnlPercent: 1.31,
    status: 'OPEN',
    exchange: 'MEXC',
    timestamp: '2025-06-05T08:45:00Z'
  },
  {
    id: '3',
    symbol: 'SOLUSDT',
    direction: 'LONG',
    amount: 50,
    entryPrice: 145.20,
    currentPrice: 148.75,
    pnl: 177.5,
    pnlPercent: 2.44,
    status: 'CLOSED',
    exchange: 'Binance',
    timestamp: '2025-06-05T07:15:00Z'
  }
];

const mockStrategies: Strategy[] = [
  {
    id: '1',
    name: 'BTC Scalping AI',
    symbol: 'BTCUSDT',
    status: 'ACTIVE',
    profit: 1247.85,
    trades: 156,
    winRate: 73.8
  },
  {
    id: '2',
    name: 'ETH Trend Following',
    symbol: 'ETHUSDT',
    status: 'ACTIVE',
    profit: 892.40,
    trades: 89,
    winRate: 68.5
  },
  {
    id: '3',
    name: 'Multi-Coin Mean Reversion',
    symbol: 'MIXED',
    status: 'PAUSED',
    profit: 2156.90,
    trades: 234,
    winRate: 81.2
  }
];

// Trade data per tab
const openPositions = [
  {
    id: '1',
    symbol: 'BTCUSDT',
    direction: 'LONG' as const,
    amount: 0.1,
    entryPrice: 43250,
    currentPrice: 43890,
    pnl: 64,
    pnlPercent: 1.48,
    status: 'OPEN' as const,
    exchange: 'Bybit',
    timestamp: '2025-06-05T09:30:00Z'
  },
  {
    id: '2',
    symbol: 'ETHUSDT',
    direction: 'SHORT' as const,
    amount: 2.5,
    entryPrice: 2680,
    currentPrice: 2645,
    pnl: 87.5,
    pnlPercent: 1.31,
    status: 'OPEN' as const,
    exchange: 'MEXC',
    timestamp: '2025-06-05T08:45:00Z'
  }
];

const openOrders = [
  {
    id: '4',
    symbol: 'ADAUSDT',
    direction: 'LONG' as const,
    amount: 1000,
    entryPrice: 0.485,
    currentPrice: 0.490,
    pnl: 5,
    pnlPercent: 1.03,
    status: 'PENDING' as const,
    exchange: 'Binance',
    timestamp: '2025-06-05T11:20:00Z'
  }
];

const closedTrades = [
  {
    id: '3',
    symbol: 'SOLUSDT',
    direction: 'LONG' as const,
    amount: 50,
    entryPrice: 145.20,
    currentPrice: 148.75,
    pnl: 177.5,
    pnlPercent: 2.44,
    status: 'CLOSED' as const,
    exchange: 'Binance',
    timestamp: '2025-06-05T07:15:00Z'
  },
  {
    id: '5',
    symbol: 'DOGEUSDT',
    direction: 'SHORT' as const,
    amount: 10000,
    entryPrice: 0.165,
    currentPrice: 0.155,
    pnl: -23.12,
    pnlPercent: -1.4,
    status: 'CLOSED' as const,
    exchange: 'Bybit',
    timestamp: '2025-06-04T18:44:00Z'
  }
];

// Components
const StatCard: React.FC<{
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  icon: string;
}> = ({ title, value, change, changeType, icon }) => (
  <div className="relative group">
    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-yellow-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
    <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-yellow-400/40 transition-all duration-300 shadow-2xl shadow-black/50 hover:shadow-yellow-400/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">{title}</p>
          <p className="text-3xl font-bold text-white mt-2 drop-shadow-lg">{value}</p>
          {change && (
            <p className={`text-sm mt-2 flex items-center font-medium ${
              changeType === 'positive' 
                ? 'text-green-300' 
                : 'text-red-300'
            }`}>
              <span className="mr-1">{changeType === 'positive' ? '↗️' : '↘️'}</span>
              {change}
            </p>
          )}
        </div>
        <div className="text-4xl opacity-80 group-hover:opacity-100 transition-opacity duration-300">
          {icon}
        </div>
      </div>
    </div>
  </div>
);

const TradeCard: React.FC<{ trade: Trade }> = ({ trade }) => (
  <div className="relative group">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-yellow-400/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
    <div className="relative bg-gradient-to-br from-black to-gray-900 p-5 rounded-xl border border-gray-600/30 hover:border-white/30 transition-all duration-300 shadow-2xl shadow-black/50 hover:shadow-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full shadow-lg ${
            trade.direction === 'LONG' 
              ? 'bg-green-400 shadow-green-400/50' 
              : 'bg-red-400 shadow-red-400/50'
          }`} />
          <span className="font-bold text-white text-lg tracking-wide drop-shadow-md">{trade.symbol}</span>
          <span className="text-xs bg-gradient-to-r from-gray-800 to-black border border-gray-600/40 px-3 py-1 rounded-full text-gray-300 font-medium shadow-inner">
            {trade.exchange}
          </span>
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-full shadow-lg ${
          trade.status === 'OPEN' 
            ? 'text-yellow-300 bg-gradient-to-r from-yellow-500/20 to-yellow-400/20 border border-yellow-500/40 shadow-yellow-400/20' 
            : 'text-gray-300 bg-gradient-to-r from-gray-600/20 to-gray-500/20 border border-gray-500/40 shadow-gray-400/20'
        }`}>
          {trade.status}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <p className="text-gray-400 uppercase tracking-wider text-xs font-medium">Entry</p>
          <p className="text-white font-bold text-base drop-shadow-sm">${trade.entryPrice.toLocaleString()}</p>
        </div>
        <div className="space-y-1">
          <p className="text-gray-400 uppercase tracking-wider text-xs font-medium">Current</p>
          <p className="text-white font-bold text-base drop-shadow-sm">${trade.currentPrice.toLocaleString()}</p>
        </div>
        <div className="space-y-1">
          <p className="text-gray-400 uppercase tracking-wider text-xs font-medium">PnL</p>
          <p className={`font-bold text-base drop-shadow-sm ${
            trade.pnl >= 0 
              ? 'text-green-300' 
              : 'text-red-300'
          }`}>
            ${trade.pnl.toFixed(2)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-gray-400 uppercase tracking-wider text-xs font-medium">PnL %</p>
          <p className={`font-bold text-base drop-shadow-sm ${
            trade.pnlPercent >= 0 
              ? 'text-green-300' 
              : 'text-red-300'
          }`}>
            {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  </div>
);

const StrategyCard: React.FC<{ strategy: Strategy }> = ({ strategy }) => (
  <div className="relative group">
    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-white/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
    <div className="relative bg-gradient-to-br from-black to-gray-900 p-5 rounded-xl border border-gray-600/30 hover:border-yellow-400/40 transition-all duration-300 shadow-2xl shadow-black/50 hover:shadow-yellow-400/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-white text-lg tracking-wide drop-shadow-md">{strategy.name}</h3>
        <span className={`text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider shadow-lg ${
          strategy.status === 'ACTIVE' 
            ? 'bg-gradient-to-r from-green-500/20 to-green-400/20 text-green-300 border border-green-500/40 shadow-green-400/20'
            : strategy.status === 'PAUSED'
            ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-400/20 text-yellow-300 border border-yellow-500/40 shadow-yellow-400/20'
            : 'bg-gradient-to-r from-red-500/20 to-red-400/20 text-red-300 border border-red-500/40 shadow-red-400/20'
        }`}>
          {strategy.status}
        </span>
      </div>
      
      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 uppercase tracking-wider font-medium">Profit</span>
          <span className="text-green-300 font-bold text-lg drop-shadow-sm">+${strategy.profit.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 uppercase tracking-wider font-medium">Trades</span>
          <span className="text-white font-bold drop-shadow-sm">{strategy.trades}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 uppercase tracking-wider font-medium">Win Rate</span>
          <span className="text-yellow-300 font-bold text-lg drop-shadow-sm">{strategy.winRate}%</span>
        </div>
      </div>
    </div>
  </div>
);

const SystemStatusCard: React.FC<{ status: SystemStatus }> = ({ status }) => (
  <div className="relative group">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-yellow-400/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
    <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-white/30 transition-all duration-300 shadow-2xl shadow-black/50">
      <h3 className="text-xl font-bold mb-6 flex items-center">
        <span className="mr-3 text-2xl">🛡️</span>
        <span className="bg-gradient-to-r from-white via-gray-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
          SYSTEM STATUS
        </span>
      </h3>
      
      <div className="space-y-4">
        {Object.entries(status).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gray-900 to-black border border-gray-700/40 shadow-inner">
            <span className="text-gray-200 capitalize font-medium tracking-wide">{key}</span>
            <div className="flex items-center space-x-3">
              <span className="text-lg">{value ? '✅' : '❌'}</span>
              <span className={`text-sm font-bold uppercase tracking-wider ${
                value ? 'text-green-300' : 'text-red-300'
              }`}>
                {value ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Main App Component
const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [tradeTab, setTradeTab] = useState('Open Positions');
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    backend: true,
    frontend: true,
    openai: false,
    bybit: false,
    mexc: false,
    binance: true,
  });

  const [apiCredentials, setApiCredentials] = useState<ApiCredentials>({
    bybit: {
      apiKey: '',
      secretKey: '',
      testnet: true,
    },
    openai: {
      apiKey: '',
      organization: '',
    },
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTesting, setIsTesting] = useState({ bybit: false, openai: false });
  const [lastSaved, setLastSaved] = useState<string>('');

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const testBybitConnection = async () => {
    if (!apiCredentials.bybit.apiKey || !apiCredentials.bybit.secretKey) {
      alert('Please enter both API Key and Secret Key for Bybit');
      return;
    }

    setIsTesting(prev => ({ ...prev, bybit: true }));
    
    // Simulate API test
    setTimeout(() => {
      setSystemStatus(prev => ({ ...prev, bybit: true }));
      setIsTesting(prev => ({ ...prev, bybit: false }));
      alert('Bybit connection successful!');
    }, 2000);
  };

  const testOpenAIConnection = async () => {
    if (!apiCredentials.openai.apiKey) {
      alert('Please enter API Key for OpenAI');
      return;
    }

    setIsTesting(prev => ({ ...prev, openai: true }));
    
    // Simulate API test
    setTimeout(() => {
      setSystemStatus(prev => ({ ...prev, openai: true }));
      setIsTesting(prev => ({ ...prev, openai: false }));
      alert('OpenAI connection successful!');
    }, 1500);
  };

  const saveApiSettings = () => {
    // In real app: save to backend/localStorage
    setLastSaved(new Date().toLocaleTimeString());
    alert('API settings saved successfully!');
  };

  const updateBybitCredentials = (field: string, value: string | boolean) => {
    setApiCredentials(prev => ({
      ...prev,
      bybit: { ...prev.bybit, [field]: value }
    }));
  };

  const updateOpenAICredentials = (field: string, value: string) => {
    setApiCredentials(prev => ({
      ...prev,
      openai: { ...prev.openai, [field]: value }
    }));
  };

  const totalPnL = mockTrades
    .filter(trade => trade.status === 'OPEN')
    .reduce((sum, trade) => sum + trade.pnl, 0);

  const totalValue = 50000 + totalPnL; // Base portfolio value + current PnL

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black relative overflow-hidden">
      {/* Elegant Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-yellow-500/20 to-amber-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-80 h-80 bg-gradient-to-br from-white/10 to-gray-300/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-gradient-to-br from-yellow-600/15 to-yellow-500/15 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-gray-700/30 backdrop-blur-xl bg-black/60 p-6 shadow-2xl shadow-black/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <img 
                  src="/header_logo.png" 
                  alt="AI Crypto Platform Logo" 
                  className="w-20 h-12 object-contain drop-shadow-xl"
                  onError={(e) => {
                    // Fallback to emoji if image fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling.style.display = 'block';
                  }}
                />
                <span className="text-4xl hidden">🤖</span>
                <div className="absolute inset-0 bg-yellow-400/20 blur-lg rounded-lg"></div>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-1 bg-black/50 backdrop-blur-xl rounded-xl p-1 border border-gray-600/30 shadow-2xl shadow-black/30">
              {['dashboard', 'trades', 'strategies', 'api'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCurrentTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    currentTab === tab
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black shadow-xl shadow-yellow-400/25 font-bold'
                      : 'text-gray-300 hover:text-white hover:bg-white/5 hover:shadow-lg hover:shadow-white/10'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={handl
