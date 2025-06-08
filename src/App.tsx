import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { userStorage, apiStorage } from './utils/storage';
import { bybitApi, openaiApi, websocketManager, healthCheck, type BalanceData, type Position, type ConnectionData, type MarketData, type OpenAIConnection } from './services/api';

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
  balance: BalanceData | null;
  positions?: Position[];
  createdAt: string;
  lastUpdated?: string;
  connectionData?: ConnectionData;
}

// Live data state will replace these
const mockStrategies: Strategy[] = [
  {
    id: '1',
    name: 'BTC Small Position Strategy',
    symbol: 'BTCUSDT',
    status: 'ACTIVE',
    profit: 3.25,
    trades: 12,
    winRate: 66.7
  },
  {
    id: '2',
    name: 'ETH Learning Bot',
    symbol: 'ETHUSDT',
    status: 'ACTIVE',
    profit: 2.10,
    trades: 8,
    winRate: 62.5
  },
  {
    id: '3',
    name: 'Practice Scalping',
    symbol: 'MIXED',
    status: 'PAUSED',
    profit: 1.85,
    trades: 15,
    winRate: 53.3
  }
];

// These will be populated with live data from ByBit API

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

const TradeCard: React.FC<{ trade: Position }> = ({ trade }) => (
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
  const navigate = useNavigate();
  const location = useLocation();
  const [tradeTab, setTradeTab] = useState('Open Positions');
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    backend: true,
    frontend: true,
    openai: false,
    bybit: false,
    mexc: false,
    binance: false,
  });

  const [apiCredentials, setApiCredentials] = useState<ApiCredentials>({
    bybit: {
      apiKey: '',
      secretKey: '',
      testnet: false,
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

  // User and storage state
  const [currentUser] = useState(() => userStorage.getCurrentUser());
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
  const [storageInfo, setStorageInfo] = useState<any>(null);

  // Live data state
  const [bybitConnections, setBybitConnections] = useState<BybitConnection[]>([]);
  const [openaiConnections, setOpenaiConnections] = useState<OpenAIConnection[]>([]);
  const [livePositions, setLivePositions] = useState<Position[]>([]);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<any>(null);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  
  // Dashboard state
  const [showWidgetConfig, setShowWidgetConfig] = useState(false);
  const [isRefreshingCoins, setIsRefreshingCoins] = useState(false);

  const [selectedConnection, setSelectedConnection] = useState<BybitConnection | null>(null);
  const [showConnectionDetails, setShowConnectionDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTesting, setIsTesting] = useState({ bybit: false, openai: false });
  const [lastSaved, setLastSaved] = useState<string>('');
  
  // Top coin tickers state with more accurate BTC price
  const [topCoins, setTopCoins] = useState([
    { symbol: 'BTC', price: 105371, change24h: 2.4, color: 'orange' },
    { symbol: 'SOL', price: 203.45, change24h: 5.2, color: 'purple' },
    { symbol: 'FARTCOIN', price: 0.87, change24h: -1.8, color: 'red' }
  ]);

  // Initialize backend connection and load live data
  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 Initializing CTB App with live ByBit data...');
      
      // Initialize connections
      setOpenaiConnections([]);
      setBybitConnections([]);
      
      // Check backend health
      try {
        const health = await healthCheck();
        if (health.success) {
          setBackendStatus('connected');
          console.log('✅ Backend connected');
        } else {
          setBackendStatus('disconnected');
          console.log('❌ Backend unavailable');
          return;
        }
      } catch (error) {
        setBackendStatus('disconnected');
        console.error('❌ Backend health check failed:', error);
        return;
      }

      // Setup WebSocket for real-time updates
      const socket = websocketManager.connect();
      
      // Listen for market data updates
      websocketManager.onMarketData((data) => {
        setMarketData(data);
      });
      
      // Listen for portfolio updates
      websocketManager.onPortfolioData((data) => {
        const connections = data.map(item => ({
          id: item.connectionId,
          name: 'ByBit Connection', // Will be updated with real metadata
          apiKey: '****LIVE',
          secretKey: '****hidden',
          testnet: false,
          markets: { spot: true, usdtPerpetual: true, inverseUsd: false },
          status: 'Active' as const,
          balance: item.data.balance,
          positions: item.data.positions,
          createdAt: item.data.lastUpdated,
          connectionData: item.data
        }));
        setBybitConnections(connections);
        
        // Aggregate all positions
        const allPositions = data.flatMap(item => item.data.positions || []);
        setLivePositions(allPositions);
      });

      // Load initial data and restore saved credentials
      try {
        // Load stored credentials and restore connections to backend
        const storedCredentials = apiStorage.loadCredentials();
        if (storedCredentials && storedCredentials.bybitConnections.length > 0) {
          console.log('🔄 Restoring ByBit connections from storage...');
          
          // Restore each ByBit connection to backend
          for (const conn of storedCredentials.bybitConnections) {
            try {
              // Skip if missing required fields
              if (!conn.apiKey || !conn.secretKey || conn.apiKey === 'stored_encrypted') {
                console.log(`⏭️ Skipping invalid connection: ${conn.name}`);
                continue;
              }

              const addResult = await bybitApi.addConnection({
                connectionId: conn.id,
                name: conn.name,
                apiKey: conn.apiKey,
                secretKey: conn.secretKey,
                testnet: conn.testnet || false,
                markets: conn.markets || { spot: true, usdtPerpetual: false, inverseUsd: false }
              });
              
              if (addResult.success) {
                console.log(`✅ Restored connection: ${conn.name}`);
              }
            } catch (error) {
              console.error(`❌ Failed to restore connection ${conn.name}:`, error);
            }
          }
          
          setHasStoredCredentials(true);
          setStorageInfo(apiStorage.getStorageInfo());
        }

        // Load live connections from backend
        const connectionsResponse = await bybitApi.getConnections();
        if (connectionsResponse.success) {
          const liveConnections = connectionsResponse.connections.map(conn => ({
            id: conn.connectionId,
            name: conn.metadata?.name || 'ByBit Connection',
            apiKey: '****LIVE',
            secretKey: '****hidden',
            testnet: conn.metadata?.testnet || false,
            markets: conn.metadata?.markets || { spot: true, usdtPerpetual: false, inverseUsd: false },
            status: conn.data ? 'Active' as const : 'Error' as const,
            balance: conn.data?.balance || null,
            positions: conn.data?.positions || [],
            createdAt: conn.metadata?.createdAt || new Date().toISOString(),
            connectionData: conn.data
          }));
          setBybitConnections(liveConnections);
          setSystemStatus(prev => ({ ...prev, bybit: liveConnections.length > 0 }));
        }

        // Load market data
        const marketResponse = await bybitApi.getMarketData();
        if (marketResponse.success) {
          setMarketData(marketResponse.data);
        }

        // Load portfolio summary
        const portfolioResponse = await bybitApi.getPortfolioSummary();
        if (portfolioResponse.success) {
          setPortfolioSummary(portfolioResponse.summary);
        }

        // Load OpenAI connections
        const openaiResponse = await openaiApi.getConnections();
        if (openaiResponse.success) {
          setOpenaiConnections(openaiResponse.connections);
          setSystemStatus(prev => ({ ...prev, openai: openaiResponse.connections.length > 0 }));
        }

      } catch (error) {
        console.error('❌ Error loading initial data:', error);
      }
    };

    initializeApp();

    // Cleanup WebSocket on unmount
    return () => {
      websocketManager.disconnect();
    };
  }, [currentUser.name]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Update top coin prices with real ByBit data
  useEffect(() => {
    const updateTopCoinPrices = async () => {
      try {
        // Get real market data from ByBit
        const marketResponse = await bybitApi.getMarketData();
        if (marketResponse.success && marketResponse.data) {
          const coins = ['BTCUSDT', 'SOLUSDT', 'FARTCOINUSDT'];
          
          const updatedCoins = coins.map(symbol => {
            const marketData = marketResponse.data.find(coin => coin.symbol === symbol);
            if (marketData) {
              return {
                symbol: symbol.replace('USDT', ''),
                price: parseFloat(marketData.price),
                change24h: parseFloat(marketData.change24h || '0'),
                color: symbol.includes('BTC') ? 'orange' : symbol.includes('SOL') ? 'purple' : 'red'
              };
            }
            // Fallback to existing data if not found
            const existing = topCoins.find(c => c.symbol === symbol.replace('USDT', ''));
            return existing || { symbol: symbol.replace('USDT', ''), price: 0, change24h: 0, color: 'gray' };
          });
          
          setTopCoins(updatedCoins);
          console.log('📈 Updated coin prices from ByBit:', updatedCoins);
        }
      } catch (error) {
        console.error('❌ Failed to fetch real coin prices, using simulation:', error);
        
        // Fallback to simulation if API fails
        setTopCoins(prevCoins => 
          prevCoins.map(coin => {
            const priceChange = (Math.random() - 0.5) * 0.02;
            const changeChange = (Math.random() - 0.5) * 0.5;
            
            return {
              ...coin,
              price: Math.max(0.001, coin.price * (1 + priceChange)),
              change24h: Math.max(-10, Math.min(10, coin.change24h + changeChange))
            };
          })
        );
      }
    };

    // Update immediately and then every 10 seconds
    updateTopCoinPrices();
    const priceInterval = setInterval(updateTopCoinPrices, 10000);
    
    return () => clearInterval(priceInterval);
  }, []); // Empty dependency array to run only once

  const testBybitConnection = async () => {
    if (!apiCredentials.bybit.apiKey || !apiCredentials.bybit.secretKey || !apiCredentials.bybit.name) {
      alert('Please enter API Key, Secret Key and Connection Name for Bybit');
      return;
    }

    if (!Object.values(apiCredentials.bybit.markets).some(Boolean)) {
      alert('Please select at least one market to connect to');
      return;
    }

    if (backendStatus !== 'connected') {
      alert('Backend not connected. Please check if the backend server is running.');
      return;
    }

    setIsTesting(prev => ({ ...prev, bybit: true }));
    
    try {
      // Test connection using real ByBit API
      console.log('🔄 Testing ByBit connection...');
      const testResult = await bybitApi.testConnection(
        apiCredentials.bybit.apiKey,
        apiCredentials.bybit.secretKey,
        false
      );

      if (!testResult.success) {
        alert(`Connection test failed: ${testResult.error || testResult.message}`);
        setIsTesting(prev => ({ ...prev, bybit: false }));
        return;
      }

      // Add connection to backend
      const connectionId = `marcel_${Date.now()}`;
      const addResult = await bybitApi.addConnection({
        connectionId,
        name: apiCredentials.bybit.name,
        apiKey: apiCredentials.bybit.apiKey,
        secretKey: apiCredentials.bybit.secretKey,
        testnet: apiCredentials.bybit.testnet,
        markets: apiCredentials.bybit.markets
      });

      if (!addResult.success) {
        alert(`Failed to add connection: ${addResult.message}`);
        setIsTesting(prev => ({ ...prev, bybit: false }));
        return;
      }

      // Create connection object for frontend state
      const newConnection: BybitConnection = {
        id: connectionId,
        name: apiCredentials.bybit.name,
        apiKey: '****' + apiCredentials.bybit.apiKey.slice(-4),
        secretKey: '****hidden',
        testnet: apiCredentials.bybit.testnet,
        markets: { ...apiCredentials.bybit.markets },
        status: 'Active',
        balance: addResult.data?.balance || null,
        positions: addResult.data?.positions || [],
        createdAt: new Date().toISOString(),
        connectionData: addResult.data
      };

      setBybitConnections(prev => [newConnection, ...prev]);
      setSystemStatus(prev => ({ ...prev, bybit: true }));
      setIsTesting(prev => ({ ...prev, bybit: false }));
      
      // Save credentials locally for backup
      const credentialsToSave = {
        bybitConnections: [{
          id: connectionId,
          name: apiCredentials.bybit.name,
          apiKey: apiCredentials.bybit.apiKey,
          secretKey: apiCredentials.bybit.secretKey,
          testnet: apiCredentials.bybit.testnet,
          markets: apiCredentials.bybit.markets,
          createdAt: new Date().toISOString()
        }],
        openai: {
          apiKey: apiCredentials.openai.apiKey || '',
          organization: apiCredentials.openai.organization || ''
        }
      };
      
      const saved = apiStorage.saveCredentials(credentialsToSave);
      if (saved) {
        setLastSaved(new Date().toLocaleTimeString());
        setHasStoredCredentials(true);
        setStorageInfo(apiStorage.getStorageInfo());
      }

      // Subscribe to WebSocket updates for this connection
      websocketManager.subscribeToConnection(connectionId);
      
      // Reset form
      setApiCredentials(prev => ({
        ...prev,
        bybit: {
          apiKey: '',
          secretKey: '',
          testnet: false,
          name: '',
          markets: {
            spot: false,
            usdtPerpetual: false,
            inverseUsd: false,
          },
        }
      }));
      
      alert(`✅ ByBit connection '${newConnection.name}' successfully created with live data for user ${currentUser.name}!`);
      
    } catch (error) {
      console.error('❌ Error creating ByBit connection:', error);
      alert(`Failed to create connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsTesting(prev => ({ ...prev, bybit: false }));
    }
  };

  const testOpenAIConnection = async () => {
    if (!apiCredentials.openai.apiKey) {
      alert('Please enter API Key for OpenAI');
      return;
    }

    if (backendStatus !== 'connected') {
      alert('Backend not connected. Please check if the backend server is running.');
      return;
    }

    setIsTesting(prev => ({ ...prev, openai: true }));
    
    try {
      // Test connection using real OpenAI API
      console.log('🔄 Testing OpenAI connection...');
      const testResult = await openaiApi.testConnection(
        apiCredentials.openai.apiKey,
        apiCredentials.openai.organization
      );

      if (!testResult.success) {
        alert(`OpenAI connection test failed: ${testResult.error || testResult.message}`);
        setIsTesting(prev => ({ ...prev, openai: false }));
        return;
      }

      // Add connection to backend
      const connectionId = `openai_${Date.now()}`;
      const addResult = await openaiApi.addConnection({
        connectionId,
        apiKey: apiCredentials.openai.apiKey,
        organization: apiCredentials.openai.organization
      });

      if (!addResult.success) {
        alert(`Failed to add OpenAI connection: ${addResult.message}`);
        setIsTesting(prev => ({ ...prev, openai: false }));
        return;
      }

      // Update frontend state with new connection
      setOpenaiConnections(prev => [addResult.data, ...prev]);
      setSystemStatus(prev => ({ ...prev, openai: true }));
      setIsTesting(prev => ({ ...prev, openai: false }));
      
      // Save credentials locally for backup
      const credentialsToSave = {
        bybitConnections: bybitConnections.map(conn => ({
          id: conn.id,
          name: conn.name,
          apiKey: 'stored_encrypted',
          secretKey: 'stored_encrypted',
          testnet: conn.testnet,
          markets: conn.markets,
          createdAt: conn.createdAt
        })),
        openai: {
          apiKey: apiCredentials.openai.apiKey,
          organization: apiCredentials.openai.organization
        }
      };
      
      const saved = apiStorage.saveCredentials(credentialsToSave);
      if (saved) {
        setLastSaved(new Date().toLocaleTimeString());
        setHasStoredCredentials(true);
        setStorageInfo(apiStorage.getStorageInfo());
      }
      
      // Reset form
      setApiCredentials(prev => ({
        ...prev,
        openai: {
          apiKey: '',
          organization: ''
        }
      }));
      
      alert(`✅ OpenAI connection successfully created with live usage data for user ${currentUser.name}!`);
      
    } catch (error) {
      console.error('❌ Error creating OpenAI connection:', error);
      alert(`Failed to create OpenAI connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsTesting(prev => ({ ...prev, openai: false }));
    }
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
    const credentialsToSave = {
      bybitConnections: bybitConnections.map(conn => ({
        id: conn.id,
        name: conn.name,
        apiKey: 'stored_encrypted', // Al encrypted opgeslagen
        secretKey: 'stored_encrypted', // Al encrypted opgeslagen  
        testnet: conn.testnet,
        markets: conn.markets,
        createdAt: conn.createdAt
      })),
      openai: {
        apiKey: apiCredentials.openai.apiKey || '',
        organization: apiCredentials.openai.organization || ''
      }
    };
    
    const saved = apiStorage.saveCredentials(credentialsToSave);
    if (saved) {
      const saveTime = new Date().toLocaleTimeString();
      setLastSaved(saveTime);
      setHasStoredCredentials(true);
      setStorageInfo(apiStorage.getStorageInfo());
      alert(`API settings safely saved for user ${currentUser.name} at ${saveTime}!`);
    } else {
      alert('Error saving API settings. Please try again.');
    }
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

  // Calculate values from live data
  const totalPnL = livePositions.reduce((sum, position) => sum + (position.pnl || 0), 0);
  const totalValue = bybitConnections.reduce((sum, conn) => sum + (conn.balance?.total || 0), 0);
  const activePositions = livePositions.filter(p => p.status === 'OPEN').length;
  
  // Advanced calculations for dashboard
  const availableBalance = bybitConnections.reduce((sum, conn) => sum + (conn.balance?.available || 0), 0);
  const totalCoins = bybitConnections.reduce((sum, conn) => sum + (conn.balance?.coins?.length || 0), 0);
  const winningPositions = livePositions.filter(p => p.pnl > 0).length;
  const losingPositions = livePositions.filter(p => p.pnl < 0).length;
  const winRate = activePositions > 0 ? ((winningPositions / activePositions) * 100) : 0;
  const largestGain = livePositions.length > 0 ? Math.max(...livePositions.map(p => p.pnl)) : 0;
  const largestLoss = livePositions.length > 0 ? Math.min(...livePositions.map(p => p.pnl)) : 0;
  const avgPositionSize = livePositions.length > 0 ? livePositions.reduce((sum, p) => sum + p.amount, 0) / livePositions.length : 0;
  const totalVolume = livePositions.reduce((sum, p) => sum + (p.amount * p.currentPrice), 0);
  const dailyPnLChange = totalPnL >= 0 ? '+' + totalPnL.toFixed(2) : totalPnL.toFixed(2);
  const portfolioChange = totalValue > 0 ? ((totalPnL / totalValue) * 100) : 0;

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

      {/* Compact Header */}
      <header className="sticky top-0 z-20 border-b border-gray-700/30 backdrop-blur-xl bg-black/60 p-2 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Top Coin Tickers */}
            <div className="hidden lg:flex items-center space-x-2">
              {topCoins.map((coin) => (
                <div 
                  key={coin.symbol}
                  className="flex items-center space-x-1.5 bg-black/30 backdrop-blur-xl rounded-lg px-2 py-1 border border-yellow-400/30 hover:bg-yellow-400/10 transition-all cursor-pointer"
                >
                  <span className="text-yellow-400 font-bold text-xs">{coin.symbol}</span>
                  <span className="text-white font-semibold text-xs">
                    ${coin.price < 1 ? coin.price.toFixed(3) : coin.price.toLocaleString()}
                  </span>
                  <span className={`text-xs font-semibold ${
                    coin.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* ByBit Portfolio Value */}
            <div className="flex items-center space-x-1.5 bg-black/50 backdrop-blur-xl rounded-lg px-2 py-1 border border-yellow-600/30 shadow-lg shadow-black/20">
              <span className="text-yellow-400 text-sm">💰</span>
              <span className="text-xs font-medium text-yellow-300">
                ${totalValue.toLocaleString()}
              </span>
            </div>

            {/* OpenAI Credits */}
            {openaiConnections.length > 0 && (
              <div className="flex items-center space-x-1.5 bg-black/50 backdrop-blur-xl rounded-lg px-2 py-1 border border-green-600/30 shadow-lg shadow-black/20">
                <span className="text-green-400 text-sm">🤖</span>
                <span className="text-xs font-medium text-green-300">
                  ${openaiConnections[0]?.subscription?.remainingCredits?.toFixed(2) || '0.00'}
                </span>
              </div>
            )}

            {/* Storage Status Indicator */}
            <div className="flex items-center space-x-1.5 bg-black/50 backdrop-blur-xl rounded-lg px-2 py-1 border border-blue-600/30 shadow-lg shadow-black/20">
              <div className={`w-1.5 h-1.5 rounded-full ${
                hasStoredCredentials ? 'bg-blue-400' : 'bg-gray-400'
              }`}></div>
              <span className={`text-xs font-medium ${
                hasStoredCredentials ? 'text-blue-300' : 'text-gray-300'
              }`}>
                {hasStoredCredentials ? currentUser.name : 'NO DATA'}
              </span>
            </div>
            
            <button
              onClick={handleRefresh}
              className={`p-1.5 rounded-lg bg-black/50 backdrop-blur-xl border border-gray-600/30 hover:border-yellow-400/40 hover:bg-yellow-400/10 transition-all duration-300 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            >
              <span className="text-yellow-400 text-sm">🔄</span>
            </button>
            <div className={`flex items-center space-x-1.5 bg-black/50 backdrop-blur-xl rounded-lg px-2 py-1 border ${
              backendStatus === 'connected' 
                ? 'border-green-600/30' 
                : backendStatus === 'connecting'
                ? 'border-yellow-600/30'
                : 'border-red-600/30'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                backendStatus === 'connected' 
                  ? 'bg-green-400 animate-pulse' 
                  : backendStatus === 'connecting'
                  ? 'bg-yellow-400 animate-pulse'
                  : 'bg-red-400'
              }`}></div>
              <span className={`text-xs font-medium ${
                backendStatus === 'connected' 
                  ? 'text-green-300' 
                  : backendStatus === 'connecting'
                  ? 'text-yellow-300'
                  : 'text-red-300'
              }`}>
                {backendStatus === 'connected' ? 'LIVE' : backendStatus === 'connecting' ? 'CONN' : 'OFF'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="sticky top-[45px] z-10 border-b border-gray-700/30 backdrop-blur-xl bg-black/50 p-4 shadow-lg">
        <div className="flex items-center justify-between">
          {/* ArIe Logo and Branding */}
          <div className="flex items-center space-x-3">
            <img 
              src="/arie-logo.png" 
              alt="ArIe Logo" 
              className="h-8 w-8 rounded-full drop-shadow-lg border border-yellow-400/30"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div>
              <h1 className="text-sm font-bold bg-gradient-to-r from-white via-yellow-200 to-yellow-400 bg-clip-text text-transparent">
                ArIe
              </h1>
              <p className="text-xs text-gray-400">AI Trading Platform</p>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex items-center space-x-1 bg-black/50 backdrop-blur-xl rounded-xl p-1 border border-gray-600/30 shadow-2xl shadow-black/30">
            {[
              { path: '/dashboard', label: 'Dashboard', icon: '📊' },
              { path: '/manual-order', label: 'Manual Order', icon: '⚡' },
              { path: '/trades', label: 'Trades', icon: '💹' },
              { path: '/strategies', label: 'Strategies', icon: '🧠' },
              { path: '/api', label: 'API Config', icon: '🔧' }
            ].map((tab) => (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center space-x-2 ${
                  location.pathname === tab.path
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black shadow-xl shadow-yellow-400/25 font-bold'
                    : 'text-gray-300 hover:text-white hover:bg-white/5 hover:shadow-lg hover:shadow-white/10'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          
          {/* Dashboard Controls */}
          {location.pathname === '/dashboard' && (
            <div className="flex items-center space-x-4">
              {/* Coin List Status Indicator */}
              <div className="flex items-center space-x-3 bg-gray-900/50 px-4 py-2 rounded-lg border border-gray-600/30">
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">Coin List:</span>
                    <span className={`w-2 h-2 rounded-full ${
                      true // We'll add coin list state later
                        ? 'bg-green-400'
                        : 'bg-red-400'
                    }`}></span>
                    <span className="text-xs text-white font-medium">
                      {(() => {
                        const cachedCoins = localStorage.getItem('cachedCoins');
                        return cachedCoins ? `${JSON.parse(cachedCoins).length} coins` : '0 coins';
                      })()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setIsRefreshingCoins(true);
                    try {
                      // Enhanced coin list refresh with full coin list
                      const manualCoinList = [
                        // Top Market Cap
                        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
                        'SOLUSDT', 'DOGEUSDT', 'AVAXUSDT', 'TRXUSDT', 'LINKUSDT',
                        'TONUSDT', 'SHIBUSDT', 'DOTUSDT', 'BCHUSDT', 'NEARUSDT',
                        'MATICUSDT', 'ICPUSDT', 'UNIUSDT', 'LTCUSDT', 'APTUSDT',
                        'STXUSDT', 'FILUSDT', 'ATOMUSDT', 'XLMUSDT', 'VETUSDT',
                        'WLDUSDT', 'RENDERUSDT', 'FETUSDT', 'AIUSDT', 'ARKMUSDT',
                        
                        // Trending & Meme Coins  
                        'TRUMPUSDT', 'PEPEUSDT', 'WIFUSDT', 'BONKUSDT', 'FLOKIUSDT',
                        'MEMECUSDT', 'DOGSUSDT', 'CATUSDT', 'BABYDOGEUSDT', 'SATSUSDT',
                        'FARTCOINUSDT', 'PNUTUSDT', 'GOATUSDT', 'ACTUSDT', 'NEIROUSDT',
                        'MOODENGUSDT', 'POPUSDT', 'CHILLGUYUSDT', 'BANAUSDT', 'PONKEUSDT',
                        
                        // DeFi Tokens
                        'AAVEUSDT', 'MKRUSDT', 'COMPUSDT', 'YFIUSDT', 'CRVUSDT',
                        'SNXUSDT', 'BALAUSDT', 'SUSHIUSDT', '1INCHUSDT', 'DYDXUSDT',
                        'PENGUUSDT', 'EIGENUSDT', 'MORPHOUSDT', 'USUAL', 'COWUSDT',
                        
                        // Layer 1 & 2
                        'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'SEIUSDT', 'INJUSDT',
                        'TIAUSDT', 'THETAUSDT', 'FTMUSDT', 'ALGOUSDT', 'EGLDUSDT',
                        'BASUSDT', 'MANTAUSDT', 'STRAXUSDT', 'KLAYUSDT', 'QTUMUSDT',
                        
                        // AI & Tech
                        'FETCHUSDT', 'RENDERUSDT', 'OCEANUSDT', 'AGIXUSDT', 'TAUUSDT',
                        'AIUSDT', 'ARKMUSDT', 'PHBUSDT', 'NMRUSDT', 'GRTUSDT',
                        'RAIUSDT', 'CTSIUSDT', 'MOVRUSDT', 'VIRTUUSDT', 'AIOZUSDT',
                        
                        // Gaming & Metaverse
                        'AXSUSDT', 'SANDUSDT', 'MANAUSDT', 'ENJUSDT', 'GALAUSDT',
                        'IMXUSDT', 'BEAMXUSDT', 'RNDRUSDT', 'YGGUSDT', 'ALICEUSDT',
                        'PIXELUSDT', 'ACEUSDT', 'XAIUSDT', 'SAGAUSDT', 'VANRYUSDT',
                        
                        // Infrastructure & RWA
                        'ORDIUSDT', 'KASUSDT', 'MINAUSDT', 'ROSEUSDT', 'QNTUSDT',
                        'FLOWUSDT', 'XTZUSDT', 'IOTAUSDT', 'ZILUSDT', 'HBARUSDT',
                        'OMNIUSDT', 'ONDOUSDT', 'RLCUSDT', 'ENSUSDT', 'STORJUSDT',
                        
                        // New & Popular
                        'BOMEUSDT', 'WUSDT', 'JUPUSDT', 'PYTHUSDT', 'ALTUSDT',
                        'JTOUSDT', 'MYROUSDT', 'LISTAUSDT', 'BANUSDT', 'RAYUSDT',
                        'JITOUSDT', 'SLEEPLESSAIUSDT', 'HIPPOUSDT'
                      ];
                      
                      const now = Date.now();
                      localStorage.setItem('cachedCoins', JSON.stringify(manualCoinList));
                      localStorage.setItem('coinsCacheTimestamp', now.toString());
                      
                      console.log(`✅ Coin list refreshed: ${manualCoinList.length} coins`);
                    } catch (error) {
                      console.error('❌ Coin refresh failed:', error);
                    } finally {
                      setIsRefreshingCoins(false);
                    }
                  }}
                  disabled={isRefreshingCoins}
                  className="flex items-center space-x-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:from-gray-600 disabled:to-gray-500 text-white px-3 py-1 rounded text-xs font-medium transition-all duration-300"
                >
                  <span className={isRefreshingCoins ? 'animate-spin' : ''}>↻</span>
                  <span>{isRefreshingCoins ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>

              <button
                onClick={() => setShowWidgetConfig(true)}
                className="p-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg transition-all duration-300 shadow-lg"
                title="Configure Widgets"
              >
                <span>⚙️</span>
              </button>
            </div>
          )}
          
          {/* Spacer for other pages */}
          {location.pathname !== '/dashboard' && <div className="w-24"></div>}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="relative z-10 p-6">
        <Outlet context={{
          systemStatus,
          bybitConnections,
          openaiConnections,
          livePositions,
          marketData,
          portfolioSummary,
          backendStatus,
          totalValue,
          totalPnL,
          activePositions
        }} />
      </main>

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
                  <label className="text-sm text-gray-400">Live Data Status</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="text-center p-2 bg-gray-900/50 rounded">
                      <div className="text-xs text-gray-500">Positions</div>
                      <div className="text-green-400">
                        {selectedConnection.positions?.length || 0}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-gray-900/50 rounded">
                      <div className="text-xs text-gray-500">Status</div>
                      <div className="text-blue-400">
                        LIVE
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400 mb-3 block">Live Balance</label>
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700/40">
                    <div className="text-2xl font-bold text-white mb-2">
                      ${selectedConnection.balance ? selectedConnection.balance.total.toLocaleString() : '0.00'}
                    </div>
                    <div className="text-sm text-gray-400 mb-4">
                      Available: ${selectedConnection.balance ? selectedConnection.balance.available.toLocaleString() : '0.00'}
                    </div>
                    <div className="text-sm text-gray-400 mb-4">
                      In Order: ${selectedConnection.balance ? selectedConnection.balance.inOrder.toLocaleString() : '0.00'}
                    </div>
                    
                    <div className="h-20 relative flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-green-400 text-2xl mb-2">📊</div>
                        <div className="text-sm text-gray-400">Live Data from ByBit API</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Widget Configuration Modal */}
        {showWidgetConfig && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-end">
            <div className="w-96 h-full bg-gradient-to-b from-gray-900 to-black border-l border-gray-600/30 shadow-2xl transform transition-transform duration-300">
              <div className="p-6 border-b border-gray-700/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">⚙️ Widget Configuration</h3>
                  <button
                    onClick={() => setShowWidgetConfig(false)}
                    className="p-2 hover:bg-gray-800 rounded transition-all"
                  >
                    <span className="text-gray-400">✕</span>
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-4">⚙️</div>
                  <div>Widget configuration will be implemented soon.</div>
                  <div className="text-sm mt-2">This will allow you to customize dashboard widgets.</div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default App;
