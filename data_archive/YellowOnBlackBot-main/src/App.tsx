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
    name: string;
    markets: {
      spot: boolean;
      usdtPerpetual: boolean;
      inverseUsd: boolean;
    };
  };
  openai: {
    apiKey: string;
    organization: string;
  };
}

interface BybitConnection {
  id: string;
  name: string;
  apiKey: string;
  secretKey: string;
  testnet: boolean;
  markets: {
    spot: boolean;
    usdtPerpetual: boolean;
    inverseUsd: boolean;
  };
  status: 'Active' | 'Inactive' | 'Testing' | 'Error';
  balance: {
    total: number;
    available: number;
    balanceHistory: { time: string; value: number }[];
  };
  createdAt: string;
  performance: {
    dailyChange: number;
    weeklyChange: number;
    monthlyChange: number;
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
    openai: true,
    bybit: true,
    mexc: false,
    binance: true,
  });

  const [apiCredentials, setApiCredentials] = useState<ApiCredentials>({
    bybit: {
      apiKey: '',
      secretKey: '',
      testnet: true,
      name: '',
      markets: {
        spot: false,
        usdtPerpetual: false,
        inverseUsd: false,
      },
    },
    openai: {
      apiKey: '',
      organization: '',
    },
  });

  // Multiple Bybit Connections with Different Levels/Gradations
  const [bybitConnections, setBybitConnections] = useState<BybitConnection[]>([
    {
      id: '1',
      name: 'Crypto Opulence - Premium Spot',
      apiKey: '****67AK',
      secretKey: '****hidden',
      testnet: false,
      markets: { spot: true, usdtPerpetual: false, inverseUsd: false },
      status: 'Active',
      balance: {
        total: 15303.54,
        available: 14850.32,
        balanceHistory: [
          { time: '00:00', value: 15100 },
          { time: '04:00', value: 14950 },
          { time: '08:00', value: 15200 },
          { time: '12:00', value: 15350 },
          { time: '16:00', value: 15303.54 }
        ]
      },
      createdAt: 'Jun 4th, 25 04:03',
      performance: { dailyChange: 2.4, weeklyChange: 15.8, monthlyChange: 34.2 }
    },
    {
      id: '2',
      name: 'High Frequency USDT Perpetual',
      apiKey: '****82BC',
      secretKey: '****hidden',
      testnet: false,
      markets: { spot: false, usdtPerpetual: true, inverseUsd: false },
      status: 'Active',
      balance: {
        total: 8750.89,
        available: 7200.45,
        balanceHistory: [
          { time: '00:00', value: 8500 },
          { time: '04:00', value: 8600 },
          { time: '08:00', value: 8450 },
          { time: '12:00', value: 8700 },
          { time: '16:00', value: 8750.89 }
        ]
      },
      createdAt: 'Jun 3rd, 25 12:15',
      performance: { dailyChange: 3.1, weeklyChange: 12.4, monthlyChange: 28.7 }
    },
    {
      id: '3',
      name: 'Multi-Market Pro Trading',
      apiKey: '****91XY',
      secretKey: '****hidden',
      testnet: false,
      markets: { spot: true, usdtPerpetual: true, inverseUsd: true },
      status: 'Active',
      balance: {
        total: 25640.12,
        available: 23100.78,
        balanceHistory: [
          { time: '00:00', value: 25200 },
          { time: '04:00', value: 25400 },
          { time: '08:00', value: 25300 },
          { time: '12:00', value: 25600 },
          { time: '16:00', value: 25640.12 }
        ]
      },
      createdAt: 'Jun 2nd, 25 09:30',
      performance: { dailyChange: 1.8, weeklyChange: 8.9, monthlyChange: 22.1 }
    },
    {
      id: '4',
      name: 'Lt. Aldo Raine - USDT Testnet',
      apiKey: '****45ZZ',
      secretKey: '****hidden',
      testnet: true,
      markets: { spot: false, usdtPerpetual: true, inverseUsd: false },
      status: 'Active',
      balance: {
        total: 10000.00,
        available: 9850.00,
        balanceHistory: [
          { time: '00:00', value: 10000 },
          { time: '04:00', value: 9950 },
          { time: '08:00', value: 10050 },
          { time: '12:00', value: 9980 },
          { time: '16:00', value: 10000 }
        ]
      },
      createdAt: 'May 30th, 25 16:45',
      performance: { dailyChange: 0.0, weeklyChange: 2.1, monthlyChange: 5.4 }
    },
    {
      id: '5',
      name: 'Scalping Bot - Inverse USD',
      apiKey: '****33DD',
      secretKey: '****hidden',
      testnet: false,
      markets: { spot: false, usdtPerpetual: false, inverseUsd: true },
      status: 'Inactive',
      balance: {
        total: 1250.45,
        available: 1180.30,
        balanceHistory: [
          { time: '00:00', value: 1300 },
          { time: '04:00', value: 1280 },
          { time: '08:00', value: 1260 },
          { time: '12:00', value: 1240 },
          { time: '16:00', value: 1250.45 }
        ]
      },
      createdAt: 'May 28th, 25 11:20',
      performance: { dailyChange: -1.2, weeklyChange: -3.8, monthlyChange: 8.9 }
    },
    {
      id: '6',
      name: 'Demo Account - All Markets',
      apiKey: '****99TT',
      secretKey: '****hidden',
      testnet: true,
      markets: { spot: true, usdtPerpetual: true, inverseUsd: true },
      status: 'Testing',
      balance: {
        total: 50000.00,
        available: 48500.00,
        balanceHistory: [
          { time: '00:00', value: 50000 },
          { time: '04:00', value: 49800 },
          { time: '08:00', value: 50200 },
          { time: '12:00', value: 50100 },
          { time: '16:00', value: 50000 }
        ]
      },
      createdAt: 'May 25th, 25 14:30',
      performance: { dailyChange: 0.4, weeklyChange: 1.2, monthlyChange: 3.1 }
    },
    {
      id: '7',
      name: 'Emergency Backup Account',
      apiKey: '****77BB',
      secretKey: '****hidden',
      testnet: false,
      markets: { spot: true, usdtPerpetual: false, inverseUsd: false },
      status: 'Error',
      balance: {
        total: 0,
        available: 0,
        balanceHistory: [
          { time: '00:00', value: 0 },
          { time: '04:00', value: 0 },
          { time: '08:00', value: 0 },
          { time: '12:00', value: 0 },
          { time: '16:00', value: 0 }
        ]
      },
      createdAt: 'May 20th, 25 08:15',
      performance: { dailyChange: 0, weeklyChange: 0, monthlyChange: 0 }
    }
  ]);

  const [selectedConnection, setSelectedConnection] = useState<BybitConnection | null>(null);
  const [showConnectionDetails, setShowConnectionDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTesting, setIsTesting] = useState({ bybit: false, openai: false });
  const [lastSaved, setLastSaved] = useState<string>('');

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const testBybitConnection = async () => {
    if (!apiCredentials.bybit.apiKey || !apiCredentials.bybit.secretKey || !apiCredentials.bybit.name) {
      alert('Please enter API Key, Secret Key and Connection Name for Bybit');
      return;
    }

    if (!Object.values(apiCredentials.bybit.markets).some(Boolean)) {
      alert('Please select at least one market to connect to');
      return;
    }

    setIsTesting(prev => ({ ...prev, bybit: true }));
    
    // Simulate API test
    setTimeout(() => {
      const newConnection: BybitConnection = {
        id: Date.now().toString(),
        name: apiCredentials.bybit.name,
        apiKey: '****' + apiCredentials.bybit.apiKey.slice(-4),
        secretKey: '****hidden',
        testnet: apiCredentials.bybit.testnet,
        markets: { ...apiCredentials.bybit.markets },
        status: 'Active',
        balance: {
          total: Math.random() * 10000 + 1000,
          available: Math.random() * 8000 + 800,
          balanceHistory: [
            { time: '00:00', value: Math.random() * 1000 + 2000 },
            { time: '04:00', value: Math.random() * 1000 + 2000 },
            { time: '08:00', value: Math.random() * 1000 + 2000 },
            { time: '12:00', value: Math.random() * 1000 + 2000 },
            { time: '16:00', value: Math.random() * 1000 + 2000 }
          ]
        },
        createdAt: new Date().toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        performance: {
          dailyChange: (Math.random() - 0.5) * 10,
          weeklyChange: (Math.random() - 0.3) * 25,
          monthlyChange: (Math.random() - 0.2) * 50
        }
      };

      setBybitConnections(prev => [newConnection, ...prev]);
      setSystemStatus(prev => ({ ...prev, bybit: true }));
      setIsTesting(prev => ({ ...prev, bybit: false }));
      
      // Reset form
      setApiCredentials(prev => ({
        ...prev,
        bybit: {
          apiKey: '',
          secretKey: '',
          testnet: true,
          name: '',
          markets: {
            spot: false,
            usdtPerpetual: false,
            inverseUsd: false,
          },
        }
      }));
      
      alert('Bybit connection created successfully!');
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

  const deleteBybitConnection = (id: string) => {
    if (confirm('Are you sure you want to delete this connection?')) {
      setBybitConnections(prev => prev.filter(conn => conn.id !== id));
      if (selectedConnection?.id === id) {
        setSelectedConnection(null);
        setShowConnectionDetails(false);
      }
    }
  };

  const toggleConnectionStatus = (id: string) => {
    setBybitConnections(prev => prev.map(conn => 
      conn.id === id 
        ? { ...conn, status: conn.status === 'Active' ? 'Inactive' : 'Active' as const }
        : conn
    ));
  };

  const saveApiSettings = () => {
    // In real app: save to backend/localStorage
    setLastSaved(new Date().toLocaleTimeString());
    alert('API settings saved successfully!');
  };

  const updateBybitCredentials = (field: string, value: string | boolean) => {
    if (field.startsWith('markets.')) {
      const marketField = field.split('.')[1];
      setApiCredentials(prev => ({
        ...prev,
        bybit: { 
          ...prev.bybit, 
          markets: { 
            ...prev.bybit.markets, 
            [marketField]: value 
          }
        }
      }));
    } else {
      setApiCredentials(prev => ({
        ...prev,
        bybit: { ...prev.bybit, [field]: value }
      }));
    }
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

  const totalValue = bybitConnections.reduce((sum, conn) => sum + conn.balance.total, 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active': return '🟢';
      case 'Inactive': return '🔴';
      case 'Testing': return '🟡';
      case 'Error': return '🔴';
      default: return '⚫';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'text-green-300';
      case 'Inactive': return 'text-gray-400';
      case 'Testing': return 'text-yellow-300';
      case 'Error': return 'text-red-300';
      default: return 'text-gray-500';
    }
  };

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
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                    }
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
              onClick={handleRefresh}
              className={`p-2 rounded-lg bg-black/50 backdrop-blur-xl border border-gray-600/30 hover:border-yellow-400/40 hover:bg-yellow-400/10 transition-all duration-300 shadow-lg shadow-black/30 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            >
              <span className="text-yellow-400 text-lg">🔄</span>
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
                icon="💰"
              />
              <StatCard
                title="Active Connections"
                value={bybitConnections.filter(c => c.status === 'Active').length.toString()}
                change={`${bybitConnections.length} total`}
                changeType="positive"
                icon="🔗"
              />
              <StatCard
                title="Total PnL"
                value={`$${totalPnL.toFixed(2)}`}
                change="+15.8% this week"
                changeType="positive"
                icon="📈"
              />
              <StatCard
                title="AI Strategies"
                value={mockStrategies.filter(s => s.status === 'ACTIVE').length.toString()}
                change="2 running"
                changeType="positive"
                icon="🤖"
              />
            </div>

            {/* Charts and Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-white/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                  <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-yellow-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
                    <h3 className="text-xl font-bold mb-6 flex items-center">
                      <span className="mr-3 text-2xl">📊</span>
                      <span className="bg-gradient-to-r from-white via-gray-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                        PORTFOLIO PERFORMANCE
                      </span>
                    </h3>
                    <div className="h-64 bg-gradient-to-br from-gray-900 to-black rounded-lg flex items-center justify-center border border-gray-700/30 shadow-inner">
                      <div className="text-center">
                        <span className="text-6xl mb-4 block">📊</span>
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
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                API CONFIGURATION
              </h2>
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                <span>Total Balance: <span className="text-white font-bold">${totalValue.toLocaleString()}</span></span>
                <span>•</span>
                <span>Active: <span className="text-green-300 font-bold">{bybitConnections.filter(c => c.status === 'Active').length}</span></span>
              </div>
            </div>
            
            {/* Existing Bybit Connections */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-white/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-yellow-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
                <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-yellow-400 to-white bg-clip-text text-transparent drop-shadow-lg">
                  🟡 BYBIT CONNECTIONS ({bybitConnections.length})
                </h3>
                
                <div className="space-y-4">
                  {bybitConnections.map((connection) => (
                    <div key={connection.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-900 to-black rounded-lg border border-gray-700/40 hover:border-yellow-400/30 transition-all group/item">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-xl">{getStatusIcon(connection.status)}</span>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-white font-bold text-base">{connection.name}</span>
                              {connection.testnet && (
                                <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded">Testnet</span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-gray-400">
                              <span>{connection.apiKey}</span>
                              <span>•</span>
                              <span>{connection.createdAt}</span>
                              <span>•</span>
                              <span className={getStatusColor(connection.status)}>{connection.status}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          {connection.markets.spot && (
                            <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded">Spot</span>
                          )}
                          {connection.markets.usdtPerpetual && (
                            <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded">USDT⊥</span>
                          )}
                          {connection.markets.inverseUsd && (
                            <span className="px-2 py-1 text-xs bg-orange-500/20 text-orange-300 border border-orange-500/40 rounded">USD⊥</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <div className="text-white font-bold">${connection.balance.total.toLocaleString()}</div>
                          <div className="text-xs text-gray-400">Available: ${connection.balance.available.toLocaleString()}</div>
                          <div className="flex items-center space-x-1 text-xs">
                            <span className={connection.performance.dailyChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {connection.performance.dailyChange >= 0 ? '+' : ''}{connection.performance.dailyChange.toFixed(1)}%
                            </span>
                            <span className="text-gray-500">24h</span>
                          </div>
                        </div>
                        
                        {connection.status === 'Active' && (
                          <div className="w-16 h-8 relative cursor-pointer" onClick={() => {
                            setSelectedConnection(connection);
                            setShowConnectionDetails(true);
                          }}>
                            <svg width="64" height="32" viewBox="0 0 64 32" className="text-green-400 hover:text-green-300 transition-colors">
                              <polyline
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                points={connection.balance.balanceHistory.map((point, i) => 
                                  `${(i / (connection.balance.balanceHistory.length - 1)) * 60 + 2},${30 - (point.value / Math.max(...connection.balance.balanceHistory.map(p => p.value))) * 26}`
                                ).join(' ')}
                              />
                            </svg>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedConnection(connection);
                              setShowConnectionDetails(true);
                            }}
                            className="p-2 hover:bg-yellow-400/10 rounded transition-all"
                            title="View Details"
                          >
                            <span className="text-yellow-400">ℹ️</span>
                          </button>
                          
                          <div className="relative group/menu">
                            <button className="p-2 hover:bg-gray-700/50 rounded transition-all">
                              <span className="text-gray-400">⋯</span>
                            </button>
                            <div className="absolute right-0 top-10 bg-gray-900 border border-gray-600 rounded-lg shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 min-w-32">
                              <button
                                onClick={() => toggleConnectionStatus(connection.id)}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-all"
                              >
                                {connection.status === 'Active' ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedConnection(connection);
                                  setShowConnectionDetails(true);
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-all"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteBybitConnection(connection.id)}
                                className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-all"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* New Connection Forms */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* New Bybit Connection Form */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-white/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-yellow-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
                  <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-yellow-400 to-white bg-clip-text text-transparent drop-shadow-lg">
                    🟡 NEW BYBIT CONNECTION
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Connection Name Field */}
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">Connection Name *</label>
                      <input
                        type="text"
                        value={apiCredentials.bybit.name}
                        onChange={(e) => updateBybitCredentials('name', e.target.value)}
                        placeholder="e.g., Main Trading Account, Scalping Bot, Test Account..."
                        className="w-full p-3 bg-gradient-to-r from-gray-900 to-black border border-gray-600/40 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400/60 focus:outline-none transition-all"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Give this connection a unique name to identify it</p>
                    </div>

                    {/* API Key Field */}
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">API Key *</label>
                      <input
                        type="text"
                        value={apiCredentials.bybit.apiKey}
                        onChange={(e) => updateBybitCredentials('apiKey', e.target.value)}
                        placeholder="Enter your Bybit API key..."
                        className="w-full p-3 bg-gradient-to-r from-gray-900 to-black border border-gray-600/40 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400/60 focus:outline-none transition-all"
                        required
                      />
                    </div>
                    
                    {/* Secret Key Field */}
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">Secret Key *</label>
                      <input
                        type="password"
                        value={apiCredentials.bybit.secretKey}
                        onChange={(e) => updateBybitCredentials('secretKey', e.target.value)}
                        placeholder="Enter your Bybit secret key..."
                        className="w-full p-3 bg-gradient-to-r from-gray-900 to-black border border-gray-600/40 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400/60 focus:outline-none transition-all"
                        required
                      />
                    </div>
                    
                    {/* Markets Selection */}
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-3">Select Markets to Connect *</label>
                      <div className="space-y-3 p-4 bg-gradient-to-r from-gray-900/50 to-black/50 rounded-lg border border-gray-700/30">
                        
                        {/* Spot Market */}
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="market-spot"
                            checked={apiCredentials.bybit.markets.spot}
                            onChange={(e) => updateBybitCredentials('markets.spot', e.target.checked)}
                            className="w-4 h-4 text-blue-400 bg-gray-900 border-gray-600 rounded focus:ring-blue-400 focus:ring-2"
                          />
                          <label htmlFor="market-spot" className="text-gray-300 text-sm flex items-center space-x-3 cursor-pointer">
                            <span className="px-3 py-1 text-xs bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded font-medium">Spot</span>
                            <span>Bybit Spot Trading</span>
                          </label>
                        </div>
                        
                        {/* USDT Perpetual Market */}
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="market-usdt"
                            checked={apiCredentials.bybit.markets.usdtPerpetual}
                            onChange={(e) => updateBybitCredentials('markets.usdtPerpetual', e.target.checked)}
                            className="w-4 h-4 text-purple-400 bg-gray-900 border-gray-600 rounded focus:ring-purple-400 focus:ring-2"
                          />
                          <label htmlFor="market-usdt" className="text-gray-300 text-sm flex items-center space-x-3 cursor-pointer">
                            <span className="px-3 py-1 text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded font-medium">USDT⊥</span>
                            <span>Bybit USDT Derivatives (Perpetual)</span>
                          </label>
                        </div>
                        
                        {/* Inverse USD Market */}
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="market-inverse"
                            checked={apiCredentials.bybit.markets.inverseUsd}
                            onChange={(e) => updateBybitCredentials('markets.inverseUsd', e.target.checked)}
                            className="w-4 h-4 text-orange-400 bg-gray-900 border-gray-600 rounded focus:ring-orange-400 focus:ring-2"
                          />
                          <label htmlFor="market-inverse" className="text-gray-300 text-sm flex items-center space-x-3 cursor-pointer">
                            <span className="px-3 py-1 text-xs bg-orange-500/20 text-orange-300 border border-orange-500/40 rounded font-medium">USD⊥</span>
                            <span>Bybit Inverse (USD)</span>
                          </label>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Select at least one market to connect to</p>
                    </div>
                    
                    {/* Testnet Toggle */}
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="testnet-toggle"
                        checked={apiCredentials.bybit.testnet}
                        onChange={(e) => updateBybitCredentials('testnet', e.target.checked)}
                        className="w-4 h-4 text-yellow-400 bg-gray-900 border-gray-600 rounded focus:ring-yellow-400 focus:ring-2"
                      />
                      <label htmlFor="testnet-toggle" className="text-gray-300 text-sm flex items-center space-x-2 cursor-pointer">
                        <span>Use Testnet</span>
                        <span className="text-xs text-gray-500">(Recommended for testing)</span>
                      </label>
                    </div>
                    
                    {/* Submit Button */}
                    <button
                      onClick={testBybitConnection}
                      disabled={isTesting.bybit}
                      className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 disabled:from-gray-600 disabled:to-gray-700 text-black font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg mt-6"
                    >
                      {isTesting.bybit ? '🔄 Creating Connection...' : '🚀 Create Connection'}
                    </button>
                    
                    {/* Form Validation Info */}
                    <div className="text-xs text-gray-500">
                      * Required fields
                    </div>
                  </div>
                </div>
              </div>

              {/* OpenAI Configuration */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-yellow-400/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-white/30 transition-all duration-300 shadow-2xl shadow-black/50">
                  <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-white to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                    🤖 OPENAI API
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">API Key</label>
                      <input
                        type="password"
                        value={apiCredentials.openai.apiKey}
                        onChange={(e) => updateOpenAICredentials('apiKey', e.target.value)}
                        placeholder="sk-..."
                        className="w-full p-3 bg-gradient-to-r from-gray-900 to-black border border-gray-600/40 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400/60 focus:outline-none transition-all"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">Organization (Optional)</label>
                      <input
                        type="text"
                        value={apiCredentials.openai.organization}
                        onChange={(e) => updateOpenAICredentials('organization', e.target.value)}
                        placeholder="org-..."
                        className="w-full p-3 bg-gradient-to-r from-gray-900 to-black border border-gray-600/40 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400/60 focus:outline-none transition-all"
                      />
                    </div>
                    
                    <button
                      onClick={testOpenAIConnection}
                      disabled={isTesting.openai}
                      className="w-full bg-gradient-to-r from-white to-gray-200 hover:from-gray-100 hover:to-white disabled:from-gray-600 disabled:to-gray-700 text-black font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg"
                    >
                      {isTesting.openai ? 'Testing Connection...' : 'Test Connection'}
                    </button>
                    
                    <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-900 to-black rounded-lg border border-gray-700/40">
                      <div className={`w-3 h-3 rounded-full shadow-lg ${
                        systemStatus.openai ? 'bg-green-400 shadow-green-400/50' : 'bg-red-400 shadow-red-400/50'
                      }`} />
                      <span className={`text-sm font-bold uppercase tracking-wider ${
                        systemStatus.openai ? 'text-green-300' : 'text-red-300'
                      }`}>
                        {systemStatus.openai ? 'CONNECTED' : 'DISCONNECTED'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coming Soon Services */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-500/10 to-gray-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-gray-500/40 transition-all duration-300 shadow-2xl shadow-black/50">
                <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-gray-400 to-gray-300 bg-clip-text text-transparent drop-shadow-lg">
                  🚧 COMING SOON
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['MEXC', 'Binance'].map((exchange) => (
                    <div key={exchange} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-900 to-black rounded-lg border border-gray-700/40 opacity-60">
                      <span className="text-gray-400 font-bold text-lg">{exchange} API</span>
                      <span className="px-3 py-1 rounded-full text-xs bg-gradient-to-r from-gray-600/20 to-gray-500/20 text-gray-400 border border-gray-500/40 font-bold uppercase tracking-wider">
                        Coming Soon
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Save Settings */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                {lastSaved && `Last saved: ${lastSaved}`}
              </div>
              <button
                onClick={saveApiSettings}
                className="bg-gradient-to-r from-green-400 to-green-500 hover:from-green-300 hover:to-green-400 text-black font-bold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg shadow-green-400/25"
              >
                💾 Save Settings
              </button>
            </div>
          </div>
        )}

        {/* Connection Details Slide-in Panel */}
        {showConnectionDetails && selectedConnection && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-end">
            <div className="w-96 h-full bg-gradient-to-b from-gray-900 to-black border-l border-gray-600/30 shadow-2xl transform transition-transform duration-300">
              <div className="p-6 border-b border-gray-700/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Account Information</h3>
                  <button
                    onClick={() => setShowConnectionDetails(false)}
                    className="p-2 hover:bg-gray-800 rounded transition-all"
                  >
                    <span className="text-gray-400">✕</span>
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto">
                <div>
                  <label className="text-sm text-gray-400">Name</label>
                  <div className="text-white font-medium">{selectedConnection.name}</div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400">Exchange</label>
                  <div className="flex items-center space-x-2">
                    <span className="text-yellow-400">🟡</span>
                    <span className="text-white font-medium">Bybit {selectedConnection.testnet ? 'Testnet' : 'Mainnet'}</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400">API Key</label>
                  <div className="text-white font-mono">{selectedConnection.apiKey}</div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400">Creation Date</label>
                  <div className="text-white">{selectedConnection.createdAt}</div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400">Status</label>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{getStatusIcon(selectedConnection.status)}</span>
                    <span className={getStatusColor(selectedConnection.status)}>
                      {selectedConnection.status}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Markets</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedConnection.markets.spot && (
                      <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded">Spot</span>
                    )}
                    {selectedConnection.markets.usdtPerpetual && (
                      <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded">USDT⊥</span>
                    )}
                    {selectedConnection.markets.inverseUsd && (
                      <span className="px-2 py-1 text-xs bg-orange-500/20 text-orange-300 border border-orange-500/40 rounded">USD⊥</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Performance</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="text-center p-2 bg-gray-900/50 rounded">
                      <div className="text-xs text-gray-500">24h</div>
                      <div className={selectedConnection.performance.dailyChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {selectedConnection.performance.dailyChange >= 0 ? '+' : ''}{selectedConnection.performance.dailyChange.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-center p-2 bg-gray-900/50 rounded">
                      <div className="text-xs text-gray-500">7d</div>
                      <div className={selectedConnection.performance.weeklyChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {selectedConnection.performance.weeklyChange >= 0 ? '+' : ''}{selectedConnection.performance.weeklyChange.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-center p-2 bg-gray-900/50 rounded">
                      <div className="text-xs text-gray-500">30d</div>
                      <div className={selectedConnection.performance.monthlyChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {selectedConnection.performance.monthlyChange >= 0 ? '+' : ''}{selectedConnection.performance.monthlyChange.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400 mb-3 block">Balance (24h)</label>
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700/40">
                    <div className="text-2xl font-bold text-white mb-2">
                      ${selectedConnection.balance.total.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-400 mb-4">
                      Available: ${selectedConnection.balance.available.toLocaleString()}
                    </div>
                    
                    <div className="h-20 relative">
                      <svg width="100%" height="80" viewBox="0 0 300 80" className="text-green-400">
                        <defs>
                          <linearGradient id="balanceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3"/>
                            <stop offset="100%" stopColor="currentColor" stopOpacity="0.1"/>
                          </linearGradient>
                        </defs>
                        <polyline
                          fill="url(#balanceGradient)"
                          stroke="currentColor"
                          strokeWidth="2"
                          points={`0,80 ${selectedConnection.balance.balanceHistory.map((point, i) => 
                            `${(i / (selectedConnection.balance.balanceHistory.length - 1)) * 300},${80 - (point.value / Math.max(...selectedConnection.balance.balanceHistory.map(p => p.value))) * 60}`
                          ).join(' ')} 300,80`}
                        />
                      </svg>
                      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500">
                        {selectedConnection.balance.balanceHistory.map((point, i) => (
                          <span key={i}>{point.time}</span>
                        ))}
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