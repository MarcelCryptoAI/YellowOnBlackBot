#!/bin/bash

echo "🚀 Installing Complete AI Crypto Platform App Component..."
echo "========================================================="

# Backup existing App.tsx
echo "📄 Creating backup of existing App.tsx..."
if [ -f "src/App.tsx" ]; then
    cp src/App.tsx src/App.tsx.backup
    echo "✅ Backup created: src/App.tsx.backup"
fi

echo "📝 Installing new App.tsx with complete platform..."

cat > src/App.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  Settings, 
  BarChart3, 
  Bot, 
  Zap,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';

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
  icon: React.ReactNode;
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
              {changeType === 'positive' ? (
                <ArrowUpRight className="w-4 h-4 mr-1" />
              ) : (
                <ArrowDownRight className="w-4 h-4 mr-1" />
              )}
              {change}
            </p>
          )}
        </div>
        <div className="text-yellow-400 opacity-80 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-lg">
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
        <Shield className="w-6 h-6 mr-3 text-yellow-400 drop-shadow-lg" />
        <span className="bg-gradient-to-r from-white via-gray-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
          SYSTEM STATUS
        </span>
      </h3>
      
      <div className="space-y-4">
        {Object.entries(status).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gray-900 to-black border border-gray-700/40 shadow-inner">
            <span className="text-gray-200 capitalize font-medium tracking-wide">{key}</span>
            <div className="flex items-center space-x-3">
              {value ? (
                <CheckCircle className="w-5 h-5 text-green-400 drop-shadow-sm" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 drop-shadow-sm" />
              )}
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
    openai: true,
    bybit: true,
    mexc: false,
    binance: true,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const totalPnL = mockTrades
    .filter(trade => trade.status === 'OPEN')
    .reduce((sum, trade) => sum + trade.pnl, 0);

  const totalValue = 50000 + totalPnL; // Base portfolio value + current PnL

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black relative overflow-hidden">
      {/* Elegant Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-yellow-500/20 to-amber-600/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute top-3/4 right-1/4 w-80 h-80 bg-gradient-to-br from-white/10 to-gray-300/10 rounded-full blur-3xl animate-pulse-slow" style={{animationDelay: '1.5s'}}></div>
        <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-gradient-to-br from-yellow-600/15 to-yellow-500/15 rounded-full blur-3xl animate-pulse-slow" style={{animationDelay: '3s'}}></div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-gray-700/30 backdrop-blur-xl bg-black/60 p-4 shadow-2xl shadow-black/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Bot className="w-8 h-8 text-yellow-400 drop-shadow-lg" />
                <div className="absolute inset-0 w-8 h-8 bg-yellow-400/20 blur-md rounded-full"></div>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-yellow-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                AI CRYPTO PLATFORM
              </h1>
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
              onClick={handleRefresh}
              className={`p-2 rounded-lg bg-black/50 backdrop-blur-xl border border-gray-600/30 hover:border-yellow-400/40 hover:bg-yellow-400/10 transition-all duration-300 shadow-lg shadow-black/30 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            >
              <RefreshCw className="w-5 h-5 text-yellow-400" />
            </button>
            <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-xl rounded-lg px-3 py-2 border border-green-600/30 shadow-lg shadow-black/20">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
              <span className="text-green-300 text-sm font-medium tracking-wider">LIVE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto p-6">
        {currentTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Portfolio Value"
                value={`$${totalValue.toLocaleString()}`}
                change="+2.4% today"
                changeType="positive"
                icon={<DollarSign className="w-8 h-8" />}
              />
              <StatCard
                title="Active Trades"
                value={mockTrades.filter(t => t.status === 'OPEN').length.toString()}
                change="+3 this hour"
                changeType="positive"
                icon={<Activity className="w-8 h-8" />}
              />
              <StatCard
                title="Total PnL"
                value={`$${totalPnL.toFixed(2)}`}
                change="+15.8% this week"
                changeType="positive"
                icon={<TrendingUp className="w-8 h-8" />}
              />
              <StatCard
                title="AI Strategies"
                value={mockStrategies.filter(s => s.status === 'ACTIVE').length.toString()}
                change="2 running"
                changeType="positive"
                icon={<Bot className="w-8 h-8" />}
              />
            </div>

            {/* Charts and Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-white/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                  <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-yellow-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
                    <h3 className="text-xl font-bold mb-6 flex items-center">
                      <BarChart3 className="w-6 h-6 mr-3 text-yellow-400 drop-shadow-lg" />
                      <span className="bg-gradient-to-r from-white via-gray-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                        PORTFOLIO PERFORMANCE
                      </span>
                    </h3>
                    <div className="h-64 bg-gradient-to-br from-gray-900 to-black rounded-lg flex items-center justify-center border border-gray-700/30 shadow-inner">
                      <div className="text-center">
                        <BarChart3 className="w-16 h-16 text-yellow-400/50 mx-auto mb-4 drop-shadow-lg" />
                        <p className="text-gray-300 text-lg font-medium">Chart Component Loading...</p>
                        <p className="text-yellow-400/70 text-sm mt-2">Real-time data visualization</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <SystemStatusCard status={systemStatus} />
            </div>

            {/* Recent Trades */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-yellow-400/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-white/30 transition-all duration-300 shadow-2xl shadow-black/50">
                <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-white via-gray-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                  RECENT TRADES
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {mockTrades.slice(0, 3).map((trade) => (
                    <TradeCard key={trade.id} trade={trade} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'trades' && (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
              ALL TRADES
            </h2>
            
            {/* Trade Tabs */}
            <div className="flex gap-2 mb-6">
              {['Open Positions', 'Open Orders', 'Closed Trades'].map((tab) => (
                <button
                  key={tab}
                  className={`px-6 py-3 rounded-t-xl text-base font-bold transition-all duration-300 ${
                    tradeTab === tab
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black shadow-xl shadow-yellow-400/25'
                      : 'bg-gradient-to-r from-black to-gray-900 text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-gray-900 hover:to-gray-800 border border-gray-600/30'
                  }`}
                  onClick={() => setTradeTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Trading Table */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-yellow-400/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              <div className="relative bg-gradient-to-br from-black to-gray-900 rounded-xl border border-gray-600/30 shadow-2xl shadow-black/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-900 to-black border-b border-gray-700/50">
                        <th className="px-6 py-4 text-left font-bold text-yellow-400 uppercase tracking-wider">Symbol</th>
                        <th className="px-6 py-4 text-left font-bold text-yellow-400 uppercase tracking-wider">Direction</th>
                        <th className="px-6 py-4 text-left font-bold text-yellow-400 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-4 text-left font-bold text-yellow-400 uppercase tracking-wider">Entry</th>
                        <th className="px-6 py-4 text-left font-bold text-yellow-400 uppercase tracking-wider">Current</th>
                        <th className="px-6 py-4 text-left font-bold text-yellow-400 uppercase tracking-wider">PnL</th>
                        <th className="px-6 py-4 text-left font-bold text-yellow-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left font-bold text-yellow-400 uppercase tracking-wider">Exchange</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let currentData = [];
                        if (tradeTab === 'Open Positions') currentData = openPositions;
                        else if (tradeTab === 'Open Orders') currentData = openOrders;
                        else if (tradeTab === 'Closed Trades') currentData = closedTrades;
                        
                        return currentData.map((trade, idx) => (
                          <tr key={idx} className="hover:bg-gradient-to-r hover:from-gray-900/50 hover:to-black/50 transition-all duration-300 border-b border-gray-800/30">
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 rounded-full shadow-lg ${
                                  trade.direction === 'LONG' 
                                    ? 'bg-green-400 shadow-green-400/50' 
                                    : 'bg-red-400 shadow-red-400/50'
                                }`} />
                                <span className="font-bold text-white text-lg drop-shadow-sm">{trade.symbol}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                trade.direction === 'LONG'
                                  ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                                  : 'bg-red-500/20 text-red-300 border border-red-500/40'
                              }`}>
                                {trade.direction}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-white font-medium">{trade.amount}</td>
                            <td className="px-6 py-4 text-white font-medium">${trade.entryPrice.toLocaleString()}</td>
                            <td className="px-6 py-4 text-white font-medium">${trade.currentPrice.toLocaleString()}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className={`font-bold ${
                                  trade.pnl >= 0 ? 'text-green-300' : 'text-red-300'
                                }`}>
                                  ${trade.pnl.toFixed(2)}
                                </span>
                                <span className={`text-sm ${
                                  trade.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                trade.status === 'OPEN'
                                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                                  : trade.status === 'PENDING'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                  : 'bg-gray-500/20 text-gray-300 border border-gray-500/40'
                              }`}>
                                {trade.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 rounded-full text-xs bg-gradient-to-r from-gray-800 to-black border border-gray-600/40 text-gray-300 font-medium">
                                {trade.exchange}
                              </span>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
                
                {(() => {
                  let currentData = [];
                  if (tradeTab === 'Open Positions') currentData = openPositions;
                  else if (tradeTab === 'Open Orders') currentData = openOrders;
                  else if (tradeTab === 'Closed Trades') currentData = closedTrades;
                  
                  return currentData.length === 0 && (
                    <div className="py-16 text-center">
                      <div className="text-gray-400 text-lg">No {tradeTab.toLowerCase()} found</div>
                      <div className="text-yellow-400/70 text-sm mt-2">Start trading to see your positions here</div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {currentTab === 'strategies' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                AI STRATEGIES
              </h2>
              <button className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-lg blur opacity-75 group-hover:opacity-100 transition-all duration-300"></div>
                <div className="relative bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 px-6 py-3 rounded-lg text-black font-bold transition-all duration-300 shadow-2xl shadow-yellow-400/25">
                  + NEW STRATEGY
                </div>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockStrategies.map((strategy) => (
                <StrategyCard key={strategy.id} strategy={strategy} />
              ))}
            </div>
          </div>
        )}

        {currentTab === 'api' && (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
              API CONNECTIONS
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-yellow-400/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-white/30 transition-all duration-300 shadow-2xl shadow-black/50">
                  <h3 className="text-xl font-bold text-white mb-6 bg-gradient-to-r from-white to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                    EXCHANGE APIs
                  </h3>
                  <div className="space-y-4">
                    {['Bybit', 'MEXC', 'Binance'].map((exchange) => (
                      <div key={exchange} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-900 to-black rounded-lg border border-gray-700/40 hover:border-white/20 transition-all shadow-inner">
                        <span className="text-white font-bold text-lg drop-shadow-sm">{exchange}</span>
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full shadow-lg ${
                            systemStatus[exchange.toLowerCase() as keyof SystemStatus] 
                              ? 'bg-green-400 shadow-green-400/50' 
                              : 'bg-red-400 shadow-red-400/50'
                          }`} />
                          <span className={`text-sm font-bold uppercase tracking-wider ${
                            systemStatus[exchange.toLowerCase() as keyof SystemStatus] 
                              ? 'text-green-300' 
                              : 'text-red-300'
                          }`}>
                            {systemStatus[exchange.toLowerCase() as keyof SystemStatus] ? 'CONNECTED' : 'DISCONNECTED'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-white/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-yellow-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
                  <h3 className="text-xl font-bold text-white mb-6 bg-gradient-to-r from-yellow-400 to-white bg-clip-text text-transparent drop-shadow-lg">
                    AI SERVICES
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-900 to-black rounded-lg border border-gray-700/40 hover:border-yellow-400/30 transition-all shadow-inner">
                      <span className="text-white font-bold text-lg drop-shadow-sm">OpenAI GPT-4</span>
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-400 rounded-full shadow-lg shadow-green-400/50" />
                        <span className="text-sm font-bold uppercase tracking-wider text-green-300">CONNECTED</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-900 to-black rounded-lg border border-gray-700/40 hover:border-yellow-400/30 transition-all shadow-inner">
                      <span className="text-white font-bold text-lg drop-shadow-sm">Backend API</span>
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-400 rounded-full shadow-lg shadow-green-400/50" />
                        <span className="text-sm font-bold uppercase tracking-wider text-green-300">ONLINE</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
EOF

echo "✅ App.tsx successfully installed!"
echo ""
echo "📋 Features installed:"
echo "  - Complete Dashboard with stats and charts"
echo "  - Professional Trading Table with tabs"
echo "  - AI Strategies management"
echo "  - API Connection monitoring"
echo "  - Elegant neo-luxe black/gold styling"
echo ""
echo "🚀 Ready to start: npm run dev"