import React, { useState, useEffect } from 'react';
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

  const [selectedConnection, setSelectedConnection] = useState<BybitConnection | null>(null);
  const [showConnectionDetails, setShowConnectionDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTesting, setIsTesting] = useState({ bybit: false, openai: false });
  const [lastSaved, setLastSaved] = useState<string>('');

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
              const addResult = await bybitApi.addConnection({
                connectionId: conn.id,
                name: conn.name,
                apiKey: conn.apiKey,
                secretKey: conn.secretKey,
                testnet: conn.testnet,
                markets: conn.markets
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
                  {tab === 'api' ? 'API' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* ByBit Portfolio Value */}
            <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-xl rounded-lg px-3 py-2 border border-yellow-600/30 shadow-lg shadow-black/20">
              <span className="text-yellow-400">💰</span>
              <span className="text-sm font-medium tracking-wider text-yellow-300">
                ${totalValue.toLocaleString()}
              </span>
            </div>

            {/* OpenAI Credits */}
            {openaiConnections.length > 0 && (
              <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-xl rounded-lg px-3 py-2 border border-green-600/30 shadow-lg shadow-black/20">
                <span className="text-green-400">🤖</span>
                <span className="text-sm font-medium tracking-wider text-green-300">
                  ${openaiConnections[0]?.subscription?.remainingCredits?.toFixed(2) || '0.00'} credits
                </span>
              </div>
            )}

            {/* Storage Status Indicator */}
            <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-xl rounded-lg px-3 py-2 border border-blue-600/30 shadow-lg shadow-black/20">
              <div className={`w-2 h-2 rounded-full shadow-lg ${
                hasStoredCredentials ? 'bg-blue-400 shadow-blue-400/50' : 'bg-gray-400 shadow-gray-400/50'
              }`}></div>
              <span className={`text-sm font-medium tracking-wider ${
                hasStoredCredentials ? 'text-blue-300' : 'text-gray-300'
              }`}>
                {hasStoredCredentials ? `💾 ${currentUser.name}` : '💾 NO DATA'}
              </span>
            </div>
            
            <button
              onClick={handleRefresh}
              className={`p-2 rounded-lg bg-black/50 backdrop-blur-xl border border-gray-600/30 hover:border-yellow-400/40 hover:bg-yellow-400/10 transition-all duration-300 shadow-lg shadow-black/30 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            >
              <span className="text-yellow-400 text-lg">🔄</span>
            </button>
            <div className={`flex items-center space-x-2 bg-black/50 backdrop-blur-xl rounded-lg px-3 py-2 border shadow-lg shadow-black/20 ${
              backendStatus === 'connected' 
                ? 'border-green-600/30' 
                : backendStatus === 'connecting'
                ? 'border-yellow-600/30'
                : 'border-red-600/30'
            }`}>
              <div className={`w-2 h-2 rounded-full shadow-lg ${
                backendStatus === 'connected' 
                  ? 'bg-green-400 shadow-green-400/50 animate-pulse' 
                  : backendStatus === 'connecting'
                  ? 'bg-yellow-400 shadow-yellow-400/50 animate-pulse'
                  : 'bg-red-400 shadow-red-400/50'
              }`}></div>
              <span className={`text-sm font-medium tracking-wider ${
                backendStatus === 'connected' 
                  ? 'text-green-300' 
                  : backendStatus === 'connecting'
                  ? 'text-yellow-300'
                  : 'text-red-300'
              }`}>
                {backendStatus === 'connected' ? 'LIVE DATA' : backendStatus === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto p-6">
        {currentTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Grid - Expanded to 5 columns with live data */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <StatCard
                title="Portfolio Value"
                value={`$${totalValue.toLocaleString()}`}
                change={`${portfolioChange >= 0 ? '+' : ''}${portfolioChange.toFixed(2)}% today`}
                changeType={portfolioChange >= 0 ? "positive" : "negative"}
                icon="💰"
              />
              <StatCard
                title="Available Balance"
                value={`$${availableBalance.toLocaleString()}`}
                change={`${totalCoins} assets`}
                changeType="positive"
                icon="💳"
              />
              <StatCard
                title="Total PnL"
                value={`$${totalPnL.toFixed(2)}`}
                change={`${dailyPnLChange} today`}
                changeType={totalPnL >= 0 ? "positive" : "negative"}
                icon="📈"
              />
              <StatCard
                title="Active Positions"
                value={activePositions.toString()}
                change={`${winRate.toFixed(1)}% win rate`}
                changeType={winRate >= 50 ? "positive" : "negative"}
                icon="🎯"
              />
              <StatCard
                title="Total Volume"
                value={`$${totalVolume.toLocaleString()}`}
                change={`${livePositions.length} positions`}
                changeType="positive"
                icon="📊"
              />
            </div>

            {/* Additional Advanced Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Largest Gain"
                value={`$${largestGain.toFixed(2)}`}
                change={`Best performer`}
                changeType={largestGain >= 0 ? "positive" : "negative"}
                icon="🚀"
              />
              <StatCard
                title="Largest Loss"
                value={`$${largestLoss.toFixed(2)}`}
                change={`Worst performer`}
                changeType={largestLoss >= 0 ? "positive" : "negative"}
                icon="📉"
              />
              <StatCard
                title="Avg Position Size"
                value={`${avgPositionSize.toFixed(2)}`}
                change={`Per position`}
                changeType="positive"
                icon="⚖️"
              />
              <StatCard
                title="Active Connections"
                value={bybitConnections.filter(c => c.status === 'Active').length.toString()}
                change={`${bybitConnections.length} total`}
                changeType="positive"
                icon="🔗"
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
                  {livePositions.slice(0, 3).map((position) => (
                    <TradeCard key={position.id} trade={position} />
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
                        let currentData: Position[] = [];
                        if (tradeTab === 'Open Positions') currentData = livePositions.filter(p => p.status === 'OPEN');
                        else if (tradeTab === 'Open Orders') currentData = livePositions.filter(p => p.status === 'PENDING');
                        else if (tradeTab === 'Closed Trades') currentData = livePositions.filter(p => p.status === 'CLOSED');

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
                  let currentData: Position[] = [];
                  if (tradeTab === 'Open Positions') currentData = livePositions.filter(p => p.status === 'OPEN');
                  else if (tradeTab === 'Open Orders') currentData = livePositions.filter(p => p.status === 'PENDING');
                  else if (tradeTab === 'Closed Trades') currentData = livePositions.filter(p => p.status === 'CLOSED');

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
                <span>•</span>
                <span>User: <span className="text-blue-300 font-bold">{currentUser.name}</span></span>
              </div>
            </div>
            
            {/* Storage Status Info */}
            {storageInfo && (
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-blue-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                <div className="relative bg-gradient-to-br from-gray-900 to-black p-4 rounded-xl border border-blue-500/30 shadow-2xl shadow-black/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">💾</span>
                      <div>
                        <h4 className="font-bold text-blue-300">Veilige Opslag Status</h4>
                        <p className="text-sm text-gray-400">
                          {storageInfo.bybitConnectionsCount} Bybit connecties • {storageInfo.hasOpenAI ? 'OpenAI geconfigureerd' : 'Geen OpenAI'} • 
                          Laatste opslag: {new Date(storageInfo.lastSaved).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full shadow-lg shadow-green-400/50"></div>
                      <span className="text-green-300 text-sm font-bold uppercase tracking-wider">ENCRYPTED</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
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
                              <span className="text-white font-bold text-xl tracking-wide drop-shadow-lg">{connection.name}</span>
                              {connection.testnet && (
                                <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded font-medium">Testnet</span>
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
                          <div className="text-white font-bold">
                            ${connection.balance ? connection.balance.total.toLocaleString() : '0.00'}
                          </div>
                          <div className="text-xs text-gray-400">
                            Available: ${connection.balance ? connection.balance.available.toLocaleString() : '0.00'}
                          </div>
                          <div className="flex items-center space-x-1 text-xs">
                            <span className="text-blue-400">LIVE</span>
                            <span className="text-gray-500">Data</span>
                          </div>
                        </div>
                        
                        {connection.status === 'Active' && connection.balance && (
                          <div className="w-16 h-8 relative cursor-pointer" onClick={() => {
                            setSelectedConnection(connection);
                            setShowConnectionDetails(true);
                          }}>
                            <div className="text-center text-xs text-green-400 font-bold">
                              📊 LIVE
                            </div>
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
            
            {/* OpenAI Connections Overview */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 to-green-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-green-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
                <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-green-400 to-white bg-clip-text text-transparent drop-shadow-lg">
                  🤖 OPENAI CONNECTIONS ({openaiConnections.length})
                </h3>
                
                <div className="space-y-4">
                  {openaiConnections.length > 0 ? (
                    openaiConnections.map((connection) => (
                      <div key={connection.connectionId} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-900 to-black rounded-lg border border-gray-700/40 hover:border-green-400/30 transition-all group/item">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-3">
                            <span className="text-xl">🤖</span>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-white font-bold text-base">OpenAI API</span>
                                <span className="px-2 py-1 text-xs bg-green-500/20 text-green-300 border border-green-500/40 rounded">{connection.subscription.plan}</span>
                              </div>
                              <div className="flex items-center space-x-2 text-xs text-gray-400">
                                <span>Credits: ${connection.subscription.remainingCredits.toFixed(2)} / ${connection.subscription.creditLimit}</span>
                                <span>•</span>
                                <span>{connection.subscription.status}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-6">
                          <div className="text-right">
                            <div className="text-white font-bold">${connection.usage.month.cost.toFixed(2)}</div>
                            <div className="text-xs text-gray-400">This month</div>
                            <div className="flex items-center space-x-1 text-xs">
                              <span className={connection.usage.trends.daily >= 0 ? 'text-green-400' : 'text-red-400'}>
                                {connection.usage.trends.daily >= 0 ? '+' : ''}{connection.usage.trends.daily.toFixed(1)}%
                              </span>
                              <span className="text-gray-500">daily</span>
                            </div>
                          </div>
                          
                          {/* Usage percentage bar */}
                          <div className="w-16 h-8 relative">
                            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${
                                  connection.subscription.usagePercentage > 80 ? 'bg-red-400' : 
                                  connection.subscription.usagePercentage > 60 ? 'bg-yellow-400' : 'bg-green-400'
                                }`}
                                style={{ width: `${Math.min(connection.subscription.usagePercentage, 100)}%` }}
                              />
                            </div>
                            <div className="text-center text-xs text-gray-400 mt-1">
                              {connection.subscription.usagePercentage.toFixed(0)}%
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <a
                              href="https://platform.openai.com/account/billing/overview"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-green-400/10 rounded transition-all"
                              title="View OpenAI Billing"
                            >
                              <span className="text-green-400">💳</span>
                            </a>
                            
                            <button
                              onClick={() => openaiApi.removeConnection(connection.connectionId).then(() => {
                                setOpenaiConnections(prev => prev.filter(c => c.connectionId !== connection.connectionId));
                                alert('OpenAI connection removed');
                              })}
                              className="p-2 hover:bg-red-400/10 rounded transition-all"
                              title="Remove Connection"
                            >
                              <span className="text-red-400">🗑️</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-400 text-lg">No OpenAI connections found</div>
                      <div className="text-green-400/70 text-sm mt-2">Add your OpenAI API key below to get started</div>
                    </div>
                  )}
                </div>
                
                {/* Quick Actions */}
                <div className="mt-6 flex gap-4">
                  <a
                    href="https://platform.openai.com/account/billing/payment-methods"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-green-400/30"
                  >
                    <span>💳</span>
                    <span>Buy Credits</span>
                  </a>
                  
                  <a
                    href="https://platform.openai.com/account/usage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-blue-400/30"
                  >
                    <span>📊</span>
                    <span>View Usage</span>
                  </a>
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
      </main>
    </div>
  );
};

export default App;
