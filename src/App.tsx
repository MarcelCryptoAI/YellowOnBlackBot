import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { userStorage, apiStorage } from './utils/storage';
import { bybitApi, openaiApi, websocketManager, healthCheck, type BalanceData, type Position, type ConnectionData, type MarketData, type OpenAIConnection } from './services/api';

// Types

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

// All strategy data now comes from live API - no more mock data

// Components
const StatCard: React.FC<{
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  icon: string;
}> = ({ title, value, change, changeType, icon }) => (
  <div className="relative group">
    <div className="absolute inset-0 bg-gradient-to-br from-primary-blue/10 to-primary-blue-dark/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
    <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-primary-blue/40 transition-all duration-300 shadow-2xl shadow-black/50 hover:shadow-primary-blue/10">
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
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-primary-blue/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
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
            ? 'text-primary-blue bg-gradient-to-r from-primary-blue/20 to-primary-blue-dark/20 border border-primary-blue/40 shadow-primary-blue/20' 
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
    <div className="absolute inset-0 bg-gradient-to-br from-primary-blue/10 to-white/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
    <div className="relative bg-gradient-to-br from-black to-gray-900 p-5 rounded-xl border border-gray-600/30 hover:border-primary-blue/40 transition-all duration-300 shadow-2xl shadow-black/50 hover:shadow-primary-blue/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-white text-lg tracking-wide drop-shadow-md">{strategy.name}</h3>
        <span className={`text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider shadow-lg ${
          strategy.status === 'ACTIVE' 
            ? 'bg-gradient-to-r from-green-500/20 to-green-400/20 text-green-300 border border-green-500/40 shadow-green-400/20'
            : strategy.status === 'PAUSED'
            ? 'bg-gradient-to-r from-primary-blue/20 to-primary-blue-dark/20 text-primary-blue border border-primary-blue/40 shadow-primary-blue/20'
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
          <span className="text-primary-blue font-bold text-lg drop-shadow-sm">{strategy.winRate}%</span>
        </div>
      </div>
    </div>
  </div>
);

const SystemStatusCard: React.FC<{ status: SystemStatus }> = ({ status }) => (
  <div className="relative group">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-primary-blue/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
    <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-white/30 transition-all duration-300 shadow-2xl shadow-black/50">
      <h3 className="text-xl font-bold mb-6 flex items-center">
        <span className="mr-3 text-2xl">🛡️</span>
        <span className="text-white drop-shadow-lg">
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
  
  // Top 10 coin tickers state for CNN-style news ticker
  const [topCoins, setTopCoins] = useState<Array<{ symbol: string; price: number; change24h: number; color: string }>>([]);
  
  // CNN-style ticker animation state
  const [tickerIndex, setTickerIndex] = useState(0);

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

  // Update top coin prices with real ByBit data and CNN-style rotation
  useEffect(() => {
    const updateTopCoinPrices = async () => {
      try {
        // Get real market data from ByBit
        const marketResponse = await bybitApi.getMarketData();
        if (marketResponse.success && marketResponse.data) {
          const coinSymbols = ['BTCUSDT', 'SOLUSDT', 'FARTCOINUSDT', 'ETHUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'MATICUSDT', 'DOTUSDT', 'LINKUSDT'];
          
          const updatedCoins = coinSymbols.map(symbol => {
            const marketData = marketResponse.data.find(coin => coin.symbol === symbol);
            if (marketData) {
              return {
                symbol: symbol.replace('USDT', ''),
                price: parseFloat(marketData.price),
                change24h: parseFloat(marketData.change24h || '0'),
                color: getSymbolColor(symbol.replace('USDT', ''))
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
        console.error('❌ Failed to fetch real coin prices:', error);
        // Keep existing prices instead of simulating new ones
      }
    };

    // CNN-style ticker rotation every 5 seconds (optimized)
    const tickerInterval = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % topCoins.length);
    }, 5000);

    // Initial load and update prices every 30 seconds (optimized)
    updateTopCoinPrices();
    const priceInterval = setInterval(updateTopCoinPrices, 30000);
    
    return () => {
      clearInterval(priceInterval);
      clearInterval(tickerInterval);
    };
  }, []); // Empty dependency array to run only once

  // Helper function to get color for each symbol
  const getSymbolColor = (symbol: string) => {
    const colorMap: { [key: string]: string } = {
      'BTC': 'orange',
      'SOL': 'purple', 
      'FARTCOIN': 'red',
      'ETH': 'blue',
      'ADA': 'cyan',
      'DOGE': 'yellow',
      'AVAX': 'pink',
      'MATIC': 'purple',
      'DOT': 'pink',
      'LINK': 'blue'
    };
    return colorMap[symbol] || 'gray';
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
      case 'Testing': return 'text-primary-blue';
      case 'Error': return 'text-red-300';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black relative overflow-hidden">
      {/* Elegant Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-primary-blue/20 to-secondary-purple/20 rounded-full blur-3xl"></div>
        <div className="absolute top-3/4 right-1/4 w-80 h-80 bg-gradient-to-br from-white/10 to-gray-300/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-gradient-to-br from-primary-blue/15 to-primary-purple/15 rounded-full blur-3xl"></div>
      </div>

      {/* Unified Ultra-Thick Glass Navigation Bar */}
      <nav className="sticky top-0 z-50 glass-card rounded-none">
        {/* Main Navigation Container */}
        <div className="relative px-8 py-6">
          <div className="flex items-center justify-between gap-6">
            
            {/* Left Section: Logo and Navigation Tabs */}
            <div className="flex items-center gap-6">
              {/* ArIe Logo Icon Only */}
              <div className="relative group">
                <div className="absolute -inset-3 bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink rounded-full blur-xl opacity-30 group-hover:opacity-60 transition-opacity duration-500"></div>
                <img 
                  src="/arie-logo.png" 
                  alt="ArIe" 
                  className="relative h-12 w-12 rounded-full border-2 border-neon-cyan/50 shadow-[0_0_40px_rgba(0,255,255,0.6)] hover:shadow-[0_0_60px_rgba(0,255,255,0.8)] transition-all duration-300 cursor-pointer hover:scale-110"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = '<div class="h-12 w-12 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center text-white font-orbitron font-black text-xl shadow-[0_0_40px_rgba(0,255,255,0.6)]">A</div>';
                    }
                  }}
                />
              </div>
              
              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 p-2 glass-panel rounded-2xl">
                {[
                  { path: '/dashboard', label: 'Dashboard', icon: '📊', glow: 'cyan' },
                  { path: '/manual-order', label: 'Manual Order', icon: '⚡', glow: 'yellow' },
                  { path: '/positions-orders', label: 'Positions & Orders', icon: '📈', glow: 'green' },
                  { path: '/strategies', label: 'Strategies', icon: '🧠', glow: 'purple' },
                  { path: '/api', label: 'API Config', icon: '🔧', glow: 'pink' }
                ].map((tab) => (
                  <button
                    key={tab.path}
                    onClick={() => navigate(tab.path)}
                    className={`
                      relative px-6 py-3 rounded-xl font-rajdhani font-bold transition-all duration-300
                      ${location.pathname === tab.path
                        ? `bg-neon-${tab.glow}/20 text-neon-${tab.glow} 
                           shadow-[0_0_30px_rgba(0,255,255,0.4)] 
                           border border-neon-${tab.glow}/50`
                        : `text-gray-400 hover:text-white hover:bg-white/5 
                           hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] 
                           hover:border hover:border-white/20`
                      }
                    `}
                    style={{
                      letterSpacing: '0.05em',
                      textShadow: location.pathname === tab.path ? `0 0 20px var(--neon-${tab.glow})` : 'none'
                    }}
                  >
                    <span className="relative z-10 flex items-center gap-3">
                      <span className="text-xl filter drop-shadow-lg">{tab.icon}</span>
                      <span className="text-sm uppercase tracking-wider">{tab.label}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Middle Section: CNN-Style Rotating Coin Ticker */}
            <div className="flex-1 flex items-center justify-center">
              <div className="relative overflow-hidden w-full max-w-md">
                {/* CNN-style news ticker container */}
                <div className="relative glass-panel px-6 py-4 rounded-2xl border-2 border-neon-cyan/30">
                  <div className="flex items-center gap-4">
                    {/* Live indicator */}
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-neon-cyan rounded-full shadow-[0_0_10px_rgba(0,255,255,0.8)]"></div>
                      <span className="text-neon-cyan font-orbitron font-black text-xs uppercase tracking-wider">LIVE</span>
                    </div>
                    
                    {/* Rotating coin display */}
                    <div className="flex-1 relative h-8 overflow-hidden">
                      <div 
                        className="absolute inset-0 flex flex-col justify-start transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateY(${-tickerIndex * 32}px)` }}
                      >
                        {topCoins.map((coin, index) => (
                          <div key={coin.symbol} className="w-full h-8 flex items-center justify-center gap-3 flex-shrink-0 ticker-item">
                            <span 
                              className="font-orbitron font-black text-lg uppercase tracking-wider" 
                              style={{
                                color: `var(--neon-${coin.color})`,
                                textShadow: `0 0 15px var(--neon-${coin.color})`
                              }}
                            >
                              {coin.symbol}
                            </span>
                            <span className="text-white font-orbitron font-bold text-lg">
                              ${coin.price < 1 ? coin.price.toFixed(3) : coin.price.toLocaleString()}
                            </span>
                            <span 
                              className={`text-sm font-rajdhani font-black ${
                                coin.change24h >= 0 ? 'text-neon-green' : 'text-neon-red'
                              }`}
                              style={{
                                textShadow: `0 0 10px ${coin.change24h >= 0 ? 'var(--neon-green)' : 'var(--neon-red)'}`
                              }}
                            >
                              {coin.change24h >= 0 ? '▲' : '▼'} {Math.abs(coin.change24h).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Ticker indicator */}
                    <div className="flex items-center gap-1">
                      {topCoins.map((_, index) => (
                        <div 
                          key={index}
                          className={`w-1 h-1 rounded-full transition-all duration-300 ${
                            index === tickerIndex ? 'bg-neon-cyan shadow-[0_0_5px_var(--neon-cyan)]' : 'bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Animated border effect */}
                  <div className="absolute inset-0 rounded-2xl">
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-60"></div>
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-60"></div>
                  </div>
                </div>
                
                {/* Background glow effect */}
                <div className="absolute -inset-4 bg-gradient-to-r from-neon-cyan/10 via-neon-blue/10 to-neon-cyan/10 rounded-3xl blur-xl opacity-50"></div>
              </div>
            </div>
            
            {/* Right Section: Portfolio, Credits, and Status */}
            <div className="flex items-center gap-4">
              {/* ByBit Portfolio */}
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-neon-cyan to-neon-blue rounded-xl blur-md opacity-30 group-hover:opacity-60 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-3 px-5 py-3 glass-panel">
                  <span className="text-neon-cyan text-xl filter drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]">💎</span>
                  <span className="text-sm font-orbitron font-bold text-neon-cyan" 
                    style={{
                      textShadow: '0 0 15px rgba(0,255,255,0.6)'
                    }}
                  >
                    ${totalValue.toLocaleString()}
                  </span>
                </div>
              </div>
              
              {/* OpenAI Credits */}
              {openaiConnections.length > 0 && (
                <div className="relative group">
                  <div className="absolute -inset-2 bg-gradient-to-r from-neon-green to-emerald-600 rounded-xl blur-md opacity-30 group-hover:opacity-60 transition-opacity duration-300"></div>
                  <div className="relative flex items-center gap-3 px-5 py-3 glass-panel">
                    <span className="text-neon-green text-xl filter drop-shadow-[0_0_10px_rgba(0,255,136,0.8)]">🤖</span>
                    <span className="text-sm font-orbitron font-bold text-neon-green"
                      style={{
                        textShadow: '0 0 15px rgba(0,255,136,0.6)'
                      }}
                    >
                      ${openaiConnections[0]?.subscription?.remainingCredits?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Storage Status */}
              <div className="relative group">
                <div className={`absolute -inset-2 rounded-xl blur-md opacity-30 group-hover:opacity-60 transition-opacity duration-300
                  ${hasStoredCredentials ? 'bg-gradient-to-r from-neon-blue to-neon-purple' : 'bg-gray-600'}`}
                ></div>
                <div className="relative flex items-center gap-3 px-5 py-3 glass-panel">
                  <div className={`w-3 h-3 rounded-full ${
                    hasStoredCredentials ? 'bg-neon-blue shadow-[0_0_15px_rgba(0,128,255,0.8)]' : 'bg-gray-400'
                  }`}></div>
                  <span className={`text-xs font-orbitron font-black uppercase tracking-wider ${
                    hasStoredCredentials ? 'text-neon-blue' : 'text-gray-400'
                  }`}
                    style={{
                      textShadow: hasStoredCredentials ? '0 0 10px rgba(0,128,255,0.6)' : 'none'
                    }}
                  >
                    {hasStoredCredentials ? currentUser.name : 'NO DATA'}
                  </span>
                </div>
              </div>
              
              {/* Backend Status */}
              <div className="relative group">
                <div className={`absolute -inset-2 rounded-xl blur-md opacity-30 group-hover:opacity-60 transition-opacity duration-300
                  ${backendStatus === 'connected' ? 'bg-gradient-to-r from-neon-green to-emerald-600' : 
                    backendStatus === 'connecting' ? 'bg-gradient-to-r from-neon-yellow to-neon-orange' : 
                    'bg-gradient-to-r from-neon-red to-neon-pink'}`}
                ></div>
                <div className="relative flex items-center gap-3 px-5 py-3 glass-panel">
                  <div className={`w-3 h-3 rounded-full ${
                    backendStatus === 'connected' ? 'bg-neon-green shadow-[0_0_15px_var(--neon-green)]' : 
                    backendStatus === 'connecting' ? 'bg-neon-yellow shadow-[0_0_15px_var(--neon-yellow)]' : 
                    'bg-neon-red shadow-[0_0_15px_var(--neon-red)]'
                  }`}></div>
                  <span className={`text-xs font-orbitron font-black uppercase tracking-wider ${
                    backendStatus === 'connected' ? 'text-neon-green' : 
                    backendStatus === 'connecting' ? 'text-neon-yellow' : 
                    'text-neon-red'
                  }`}
                    style={{
                      textShadow: `0 0 10px ${
                        backendStatus === 'connected' ? 'var(--neon-green)' : 
                        backendStatus === 'connecting' ? 'var(--neon-yellow)' : 
                        'var(--neon-red)'
                      }`
                    }}
                  >
                    {backendStatus === 'connected' ? 'LIVE' : backendStatus === 'connecting' ? 'CONN' : 'OFF'}
                  </span>
                </div>
              </div>
              
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                className={`relative group p-3 ${isRefreshing ? 'animate-spin' : ''}`}
              >
                <div className="absolute -inset-2 bg-gradient-to-r from-neon-cyan to-neon-purple rounded-xl blur-md opacity-30 group-hover:opacity-60 transition-opacity duration-300"></div>
                <div className="relative glass-panel px-4 py-3">
                  <span className="text-neon-cyan text-xl filter drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]">⚡</span>
                </div>
              </button>
            </div>
          </div>
        </div>
        
        {/* Bottom Glow Effect */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent"></div>
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
                    <span className="text-primary-blue">🔵</span>
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
