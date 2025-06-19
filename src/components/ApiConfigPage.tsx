import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { bybitApi, openaiApi, type BalanceData, type Position, type OpenAIConnection } from '../services/api';
import { userStorage, apiStorage } from '../utils/storage';

// Types
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

interface OutletContext {
  systemStatus: any;
  bybitConnections: BybitConnection[];
  openaiConnections: OpenAIConnection[];
  backendStatus: string;
  totalValue: number;
}

const ApiConfigPage: React.FC = () => {
  const context = useOutletContext<OutletContext>();
  
  // Provide fallback values if context is undefined
  const { 
    systemStatus = { openai: false, bybit: false, backend: false, frontend: true, mexc: false, binance: false }, 
    backendStatus = 'disconnected', 
    totalValue = 0 
  } = context || {};
  
  const [currentUser] = useState(() => {
    try {
      return userStorage.getCurrentUser() || { name: 'Default User', id: 'default' };
    } catch (error) {
      console.error('Failed to get current user:', error);
      return { name: 'Default User', id: 'default' };
    }
  });
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [bybitConnections, setBybitConnections] = useState<BybitConnection[]>([]);
  const [openaiConnections, setOpenaiConnections] = useState<OpenAIConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<BybitConnection | null>(null);
  const [showConnectionDetails, setShowConnectionDetails] = useState(false);
  const [isTesting, setIsTesting] = useState({ bybit: false, openai: false });
  const [lastSaved, setLastSaved] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // Load data on mount
  useEffect(() => {
    const initializePage = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        
        // Load stored data (synchronous)
        loadStoredData();
        
        // Try to load connections from API, but don't fail if it doesn't work
        try {
          await loadConnections();
        } catch (apiError) {
          console.warn('API connections failed to load, but page will still render:', apiError);
          // Don't set loadError here - just let the page render without API data
        }
      } catch (error) {
        console.error('Critical error initializing API config page:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load page data');
      } finally {
        setIsLoading(false);
      }
    };
    
    initializePage();
  }, []);

  const loadStoredData = () => {
    const storedCredentials = apiStorage.loadCredentials();
    if (storedCredentials) {
      setHasStoredCredentials(true);
      setStorageInfo(apiStorage.getStorageInfo());
    }
  };

  const loadConnections = async () => {
    try {
      console.log('🔄 Loading API connections...');
      
      // Load ByBit connections with error handling
      try {
        const bybitResponse = await bybitApi.getConnections();
        console.log('ByBit response:', bybitResponse);
        
        if (bybitResponse.success && bybitResponse.connections) {
          const connections = bybitResponse.connections.map(conn => ({
            id: conn.connectionId || conn.connection_id || `bybit_${Date.now()}`,
            name: conn.name || 'ByBit Connection',
            apiKey: '****LIVE',
            secretKey: '****hidden',
            testnet: conn.testnet || false,
            markets: conn.markets || { spot: true, usdtPerpetual: false, inverseUsd: false },
            status: conn.data ? 'Active' as const : 'Error' as const,
            balance: conn.data?.balance || null,
            positions: conn.data?.positions || [],
            createdAt: conn.last_updated || new Date().toISOString(),
          }));
          setBybitConnections(connections);
          console.log('✅ Loaded', connections.length, 'ByBit connections');
        } else {
          console.log('No ByBit connections found or failed to load');
          setBybitConnections([]);
        }
      } catch (bybitError) {
        console.error('Failed to load ByBit connections:', bybitError);
        setBybitConnections([]);
      }

      // Load OpenAI connections with error handling
      try {
        const openaiResponse = await openaiApi.getConnections();
        console.log('OpenAI response:', openaiResponse);
        
        if (openaiResponse.success && openaiResponse.connections) {
          setOpenaiConnections(openaiResponse.connections);
          console.log('✅ Loaded', openaiResponse.connections.length, 'OpenAI connections');
        } else {
          console.log('No OpenAI connections found or failed to load');
          setOpenaiConnections([]);
        }
      } catch (openaiError) {
        console.error('Failed to load OpenAI connections:', openaiError);
        setOpenaiConnections([]);
      }
      
      console.log('✅ API connections loading complete');
    } catch (error) {
      console.error('Failed to load connections:', error);
      throw error; // Re-throw to be caught by the parent try-catch
    }
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
      // Test connection
      const testResult = await bybitApi.testConnection(
        apiCredentials.bybit.apiKey,
        apiCredentials.bybit.secretKey,
        apiCredentials.bybit.testnet
      );

      if (!testResult.success) {
        alert(`Connection test failed: ${testResult.error || testResult.message}`);
        return;
      }

      // Add connection
      const connectionId = `${currentUser.name}_${Date.now()}`;
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
        return;
      }

      // Save credentials locally
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
      
      alert(`✅ ByBit connection '${apiCredentials.bybit.name}' successfully created!`);
      loadConnections(); // Reload connections
      
    } catch (error) {
      console.error('Error creating ByBit connection:', error);
      alert(`Failed to create connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
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
      const testResult = await openaiApi.testConnection(
        apiCredentials.openai.apiKey,
        apiCredentials.openai.organization
      );

      if (!testResult.success) {
        alert(`OpenAI connection test failed: ${testResult.error || testResult.message}`);
        return;
      }

      const connectionId = `openai_${Date.now()}`;
      const addResult = await openaiApi.addConnection({
        connectionId,
        apiKey: apiCredentials.openai.apiKey,
        organization: apiCredentials.openai.organization
      });

      if (!addResult.success) {
        alert(`Failed to add OpenAI connection: ${addResult.message}`);
        return;
      }

      // Reset form
      setApiCredentials(prev => ({
        ...prev,
        openai: {
          apiKey: '',
          organization: ''
        }
      }));
      
      alert('✅ OpenAI connection successfully created!');
      loadConnections(); // Reload connections
      
    } catch (error) {
      console.error('Error creating OpenAI connection:', error);
      alert(`Failed to create OpenAI connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTesting(prev => ({ ...prev, openai: false }));
    }
  };

  const deleteBybitConnection = async (id: string) => {
    if (confirm('Are you sure you want to delete this connection?')) {
      try {
        await bybitApi.removeConnection(id);
        setBybitConnections(prev => prev.filter(conn => conn.id !== id));
        if (selectedConnection?.id === id) {
          setSelectedConnection(null);
          setShowConnectionDetails(false);
        }
      } catch (error) {
        console.error('Failed to delete connection:', error);
        alert('Failed to delete connection');
      }
    }
  };

  const refreshBalance = async (connectionId: string) => {
    try {
      console.log('Refreshing balance for:', connectionId);
      
      // Get updated data for this specific connection
      const response = await bybitApi.getConnection(connectionId);
      
      if (response.success && response.data) {
        console.log('Updated balance data:', response.data);
        
        // Force reload all connections to reflect the update
        await loadConnections();
      }
    } catch (error) {
      console.error('Failed to refresh balance:', error);
      alert('Failed to refresh balance. Please check the console for details.');
    }
  };

  const toggleConnectionStatus = (id: string) => {
    setBybitConnections(prev => prev.map(conn => 
      conn.id === id 
        ? { ...conn, status: conn.status === 'Active' ? 'Inactive' : 'Active' as const }
        : conn
    ));
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

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-blue mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading API Configuration...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <p className="text-white text-lg mb-4">Failed to load API Configuration</p>
          <p className="text-gray-400 text-sm mb-6">{loadError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-primary-blue hover:bg-primary-blue-dark text-white px-6 py-2 rounded-lg transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white drop-shadow-lg">
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
        <div className="absolute inset-0 bg-gradient-to-br from-primary-blue/10 to-white/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
        <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-primary-blue/40 transition-all duration-300 shadow-2xl shadow-black/50">
          <h3 className="text-xl font-bold mb-6 text-primary-blue drop-shadow-lg">
            🟡 BYBIT CONNECTIONS ({bybitConnections.length})
          </h3>
          
          <div className="space-y-4">
            {bybitConnections.map((connection) => (
              <div key={connection.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-900 to-black rounded-lg border border-gray-700/40 hover:border-primary-blue/30 transition-all group/item">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{getStatusIcon(connection.status)}</span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-bold text-xl tracking-wide drop-shadow-lg">{connection.name}</span>
                        {connection.testnet && (
                          <span className="px-2 py-1 text-xs bg-accent-orange/20 text-accent-orange border border-accent-orange/40 rounded font-medium">Testnet</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <span>{connection.apiKey}</span>
                        <span>•</span>
                        <span>{new Date(connection.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className={getStatusColor(connection.status)}>{connection.status}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    {(connection.name === 'Crypto Oppulence' || connection.name === 'Revolution X') ? (
                      <>
                        <span className="px-2 py-1 text-xs bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 border border-purple-500/40 rounded font-medium">Derivatives</span>
                        <span className="px-2 py-1 text-xs bg-gradient-to-r from-green-500/20 to-teal-500/20 text-green-300 border border-green-500/40 rounded font-medium">UTA 2.0</span>
                      </>
                    ) : (
                      <>
                        {connection.markets.spot && (
                          <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded">Spot</span>
                        )}
                        {connection.markets.usdtPerpetual && (
                          <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded">USDT⊥</span>
                        )}
                        {connection.markets.inverseUsd && (
                          <span className="px-2 py-1 text-xs bg-orange-500/20 text-orange-300 border border-orange-500/40 rounded">USD⊥</span>
                        )}
                      </>
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
                      <button
                        onClick={() => refreshBalance(connection.id)}
                        className="text-primary-blue hover:text-primary-blue-light ml-2"
                        title="Refresh balance"
                      >
                        🔄
                      </button>
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
                      className="p-2 hover:bg-primary-blue/10 rounded transition-all"
                      title="View Details"
                    >
                      <span className="text-primary-blue">ℹ️</span>
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
          <h3 className="text-xl font-bold mb-6 text-green-400 drop-shadow-lg">
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
                          <span className="px-2 py-1 text-xs bg-green-500/20 text-green-300 border border-green-500/40 rounded">{connection.subscription?.plan || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                          <span>Credits: ${connection.subscription?.remainingCredits?.toFixed(2) || '0.00'} / ${connection.subscription?.creditLimit || '0'}</span>
                          <span>•</span>
                          <span>{connection.subscription?.status || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="text-white font-bold">${connection.usage?.month?.cost?.toFixed(2) || '0.00'}</div>
                      <div className="text-xs text-gray-400">This month</div>
                      <div className="flex items-center space-x-1 text-xs">
                        <span className={(connection.usage?.trends?.daily || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {(connection.usage?.trends?.daily || 0) >= 0 ? '+' : ''}{(connection.usage?.trends?.daily || 0).toFixed(1)}%
                        </span>
                        <span className="text-gray-500">daily</span>
                      </div>
                    </div>
                    
                    {/* Usage percentage bar */}
                    <div className="w-16 h-8 relative">
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            (connection.subscription?.usagePercentage || 0) > 80 ? 'bg-red-400' : 
                            (connection.subscription?.usagePercentage || 0) > 60 ? 'bg-accent-orange' : 'bg-green-400'
                          }`}
                          style={{ width: `${Math.min(connection.subscription?.usagePercentage || 0, 100)}%` }}
                        />
                      </div>
                      <div className="text-center text-xs text-gray-400 mt-1">
                        {(connection.subscription?.usagePercentage || 0).toFixed(0)}%
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
          <div className="absolute inset-0 bg-gradient-to-br from-primary-blue/10 to-white/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-primary-blue/40 transition-all duration-300 shadow-2xl shadow-black/50">
            <h3 className="text-xl font-bold mb-6 text-primary-blue drop-shadow-lg">
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
                  className="w-full p-3 bg-gradient-to-r from-gray-900 to-black border border-gray-600/40 rounded-lg text-white placeholder-gray-500 focus:border-primary-blue/60 focus:outline-none transition-all"
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
                  className="w-full p-3 bg-gradient-to-r from-gray-900 to-black border border-gray-600/40 rounded-lg text-white placeholder-gray-500 focus:border-primary-blue/60 focus:outline-none transition-all"
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
                  className="w-full p-3 bg-gradient-to-r from-gray-900 to-black border border-gray-600/40 rounded-lg text-white placeholder-gray-500 focus:border-primary-blue/60 focus:outline-none transition-all"
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
                  className="w-4 h-4 text-primary-blue bg-gray-900 border-gray-600 rounded focus:ring-primary-blue focus:ring-2"
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
                className="w-full bg-gradient-to-r from-primary-blue to-primary-blue-dark hover:from-primary-blue/80 hover:to-primary-blue text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg mt-6"
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
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-primary-blue/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-white/30 transition-all duration-300 shadow-2xl shadow-black/50">
            <h3 className="text-xl font-bold mb-6 text-white drop-shadow-lg">
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
                  className="w-full p-3 bg-gradient-to-r from-gray-900 to-black border border-gray-600/40 rounded-lg text-white placeholder-gray-500 focus:border-primary-blue/60 focus:outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Organization (Optional)</label>
                <input
                  type="text"
                  value={apiCredentials.openai.organization}
                  onChange={(e) => updateOpenAICredentials('organization', e.target.value)}
                  placeholder="org-..."
                  className="w-full p-3 bg-gradient-to-r from-gray-900 to-black border border-gray-600/40 rounded-lg text-white placeholder-gray-500 focus:border-primary-blue/60 focus:outline-none transition-all"
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

      {/* Save Settings */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {lastSaved && `Last saved: ${lastSaved}`}
        </div>
      </div>

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
                <div className="text-white">{new Date(selectedConnection.createdAt).toLocaleDateString()}</div>
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
    </div>
  );
};

export default ApiConfigPage;