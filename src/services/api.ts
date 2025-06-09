// Frontend API Service - PyBit Integration
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = 'http://localhost:8000/api';

// API Client setup
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased to 30 seconds for heavy market data calls
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    console.log('=� API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('L API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log(' API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('L API Response Error:', error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Types
export interface ByBitConnection {
  connectionId: string;
  name: string;
  testnet: boolean;
  markets: {
    spot: boolean;
    usdtPerpetual: boolean;
    inverseUsd: boolean;
  };
}

export interface BalanceData {
  total: number;
  available: number;
  inOrder: number;
  coins: Array<{
    coin: string;
    walletBalance: number;
    availableBalance: number;
    locked: number;
  }>;
  lastUpdated: string;
}

export interface Position {
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

export interface OrderHistory {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING' | 'CANCELLED';
  exchange: string;
  timestamp: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export interface ConnectionData {
  connectionId: string;
  balance: BalanceData | null;
  positions: Position[];
  orderHistory: OrderHistory[];
  lastUpdated: string;
  errors: {
    balance: string | null;
    positions: string | null;
    orderHistory: string | null;
  };
}

export interface PortfolioSummary {
  totalPortfolioValue: number;
  totalPnL: number;
  activePositions: number;
  totalConnections: number;
  portfolioData: Array<{
    connectionId: string;
    balance: BalanceData;
    positionsCount: number;
  }>;
}

export interface OpenAIConnection {
  connectionId: string;
  subscription: {
    plan: string;
    status: string;
    hasPaymentMethod: boolean;
    creditLimit: number;
    remainingCredits: number;
    usagePercentage: number;
  };
  usage: {
    today: {
      cost: number;
      requests: number;
      tokens: number;
    };
    week: {
      cost: number;
      requests: number;
      tokens: number;
    };
    month: {
      cost: number;
      requests: number;
      tokens: number;
    };
    trends: {
      daily: number;
      weekly: number;
    };
  };
  lastUpdated: string;
}

export interface OpenAIPricing {
  models: Record<string, any>;
  currency: string;
  lastUpdated: string;
}

// WebSocket manager
class WebSocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    // Temporary disable WebSocket for simple backend
    console.log('⚠️ WebSocket disabled for simple backend');
    this.socket = null;
    return this.socket as any;

    this.socket.on('connect', () => {
      console.log('= WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('L WebSocket disconnected:', reason);
      this.handleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('L WebSocket connection error:', error);
      this.handleReconnect();
    });

    return this.socket;
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`= Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.socket?.connect();
      }, Math.pow(2, this.reconnectAttempts) * 1000); // Exponential backoff
    }
  }

  subscribeToConnection(connectionId: string) {
    this.socket?.emit('subscribe_connection', connectionId);
  }

  unsubscribeFromConnection(connectionId: string) {
    this.socket?.emit('unsubscribe_connection', connectionId);
  }

  onMarketUpdate(callback: (data: MarketData) => void) {
    this.socket?.on('market_update', callback);
  }

  onMarketData(callback: (data: MarketData[]) => void) {
    this.socket?.on('market_data', callback);
  }

  onPortfolioUpdate(callback: (data: { connectionId: string; data: ConnectionData }) => void) {
    this.socket?.on('portfolio_update', callback);
  }

  onPortfolioData(callback: (data: Array<{ connectionId: string; data: ConnectionData }>) => void) {
    this.socket?.on('portfolio_data', callback);
  }

  onPriceUpdate(callback: (data: { connectionId: string; data: MarketData }) => void) {
    this.socket?.on('price_update', callback);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

// API functions
export const bybitApi = {
  // Test ByBit connection
  testConnection: async (apiKey: string, secretKey: string, testnet = false) => {
    const response = await apiClient.post('/bybit/test-connection', {
      apiKey,
      secretKey,
      testnet,
    });
    return response.data;
  },

  // Add new ByBit connection
  addConnection: async (connection: {
    connectionId: string;
    name: string;
    apiKey: string;
    secretKey: string;
    testnet: boolean;
    markets: {
      spot: boolean;
      usdtPerpetual: boolean;
      inverseUsd: boolean;
    };
  }) => {
    const response = await apiClient.post('/bybit/add-connection', connection);
    return response.data;
  },

  // Get connection data
  getConnection: async (connectionId: string): Promise<{ success: boolean; data: ConnectionData & { metadata: any } }> => {
    const response = await apiClient.get(`/bybit/connection/${connectionId}`);
    return response.data;
  },

  // Get all connections
  getConnections: async (): Promise<{ success: boolean; connections: Array<{ connectionId: string; metadata: any; data: ConnectionData }> }> => {
    const response = await apiClient.get('/bybit/connections');
    return response.data;
  },

  // Remove connection
  removeConnection: async (connectionId: string) => {
    const response = await apiClient.delete(`/bybit/connection/${connectionId}`);
    return response.data;
  },

  // Get all available trading instruments/symbols
  getInstruments: async (): Promise<{ success: boolean; data: Array<{ symbol: string; baseCoin: string; quoteCoin: string; status: string; contractType: string }> }> => {
    const response = await apiClient.get('/market/instruments');
    return response.data;
  },

  // Get market data
  getMarketData: async (symbols?: string[]): Promise<{ success: boolean; data: MarketData[] }> => {
    const params = symbols ? { symbols: symbols.join(',') } : {};
    const response = await apiClient.get('/market/tickers', { params });
    return response.data;
  },

  // Get portfolio summary
  getPortfolioSummary: async (): Promise<{ success: boolean; summary: PortfolioSummary }> => {
    const response = await apiClient.get('/portfolio/summary');
    return response.data;
  },

  // Create new trade
  createTrade: async (tradeData: {
    connectionId: string;
    symbol: string;
    side: 'buy' | 'sell';
    orderType: 'market' | 'limit';
    quantity: number;
    price?: number;
    leverage?: number;
    marginMode?: 'isolated' | 'cross';
    reduceOnly?: boolean;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
    takeProfitPrice?: number;
    stopLossPrice?: number;
  }) => {
    const response = await apiClient.post('/trading/create-order', tradeData);
    return response.data;
  },
};

// OpenAI API functions
export const openaiApi = {
  // Test OpenAI connection
  testConnection: async (apiKey: string, organization?: string) => {
    const response = await apiClient.post('/openai/test-connection', {
      apiKey,
      organization: organization || '',
    });
    return response.data;
  },

  // Add OpenAI connection
  addConnection: async (connection: {
    connectionId: string;
    apiKey: string;
    organization?: string;
  }) => {
    const response = await apiClient.post('/openai/add-connection', connection);
    return response.data;
  },

  // Get OpenAI connection data
  getConnection: async (connectionId: string): Promise<{ success: boolean; data: OpenAIConnection }> => {
    const response = await apiClient.get(`/openai/connection/${connectionId}`);
    return response.data;
  },

  // Get all OpenAI connections
  getConnections: async (): Promise<{ success: boolean; connections: OpenAIConnection[] }> => {
    const response = await apiClient.get('/openai/connections');
    return response.data;
  },

  // Remove OpenAI connection
  removeConnection: async (connectionId: string) => {
    const response = await apiClient.delete(`/openai/connection/${connectionId}`);
    return response.data;
  },

  // Make test completion
  testCompletion: async (connectionId: string, message?: string) => {
    const response = await apiClient.post('/openai/test-completion', {
      connectionId,
      message: message || 'Hello, this is a test message from CTB Trading Bot.'
    });
    return response.data;
  },

  // Get pricing information
  getPricing: async (): Promise<{ success: boolean; data: OpenAIPricing }> => {
    const response = await apiClient.get('/openai/pricing');
    return response.data;
  },

  // Get strategy advice from OpenAI
  getStrategyAdvice: async (strategyData: {
    coin: string;
    signalIndicator: any;
    confirmingIndicators: any[];
  }): Promise<{ success: boolean; data: any }> => {
    const response = await apiClient.post('/openai/strategy-advice', {
      coin: strategyData.coin,
      signalIndicator: strategyData.signalIndicator,
      confirmingIndicators: strategyData.confirmingIndicators
    });
    return response.data;
  },

  // AI Indicator Selectie - Optimize indicators and parameters
  optimizeIndicators: async (requestData: {
    coin: string;
    timeframe?: string;
    lookbackPeriod?: string;
  }): Promise<{ success: boolean; data: any }> => {
    const response = await apiClient.post('/openai/optimize-indicators', {
      coin: requestData.coin,
      timeframe: requestData.timeframe || '1m',
      lookbackPeriod: requestData.lookbackPeriod || '1y'
    });
    return response.data;
  },

  // AI Trade Parameters - Optimize entry/exit and risk management
  optimizeTradeParameters: async (requestData: {
    coin: string;
    signalIndicator: any;
    confirmingIndicators: any[];
    currentSettings: any;
  }): Promise<{ success: boolean; data: any }> => {
    const response = await apiClient.post('/openai/optimize-trade-parameters', {
      coin: requestData.coin,
      signalIndicator: requestData.signalIndicator,
      confirmingIndicators: requestData.confirmingIndicators,
      currentSettings: requestData.currentSettings
    });
    return response.data;
  },
};

// Coins API
export const coinsApi = {
  // Get all USDT perpetual coins
  getPerpetualCoins: async (forceRefresh = false) => {
    try {
      console.log('🔄 Fetching perpetual coins from backend...');
      const url = forceRefresh ? '/coins/perpetuals?refresh=true' : '/coins/perpetuals';
      const response = await apiClient.get(url);
      console.log('✅ Perpetual coins fetched:', response.data.data?.total || 0, 'coins');
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to fetch perpetual coins:', error.message);
      throw error;
    }
  },

  // Get leverage limits for a specific symbol
  getLeverageLimits: async (symbol: string) => {
    try {
      const response = await apiClient.get(`/coins/${symbol}/leverage`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Failed to get leverage limits for ${symbol}:`, error.message);
      // Return default limits if API fails
      return {
        success: true,
        symbol: symbol,
        leverage: { min: 1, max: 25 }
      };
    }
  },

  // Cache management for coins
  getCachedCoins: () => {
    try {
      const cached = localStorage.getItem('cached_perpetual_coins');
      if (cached) {
        const data = JSON.parse(cached);
        const cacheAge = Date.now() - data.timestamp;
        // Cache valid for 1 hour
        if (cacheAge < 3600000) {
          console.log('📦 Using cached coins data');
          return data.coins;
        }
      }
      return null;
    } catch (error) {
      console.error('Error reading cached coins:', error);
      return null;
    }
  },

  setCachedCoins: (coins: string[]) => {
    try {
      const data = {
        coins: coins,
        timestamp: Date.now()
      };
      localStorage.setItem('cached_perpetual_coins', JSON.stringify(data));
      console.log('💾 Cached', coins.length, 'coins');
    } catch (error) {
      console.error('Error caching coins:', error);
    }
  }
};

// Health check
export const healthCheck = async () => {
  try {
    console.log('🔄 Attempting health check to:', API_BASE_URL + '/health');
    const response = await apiClient.get('/health');
    console.log('✅ Health check response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Backend health check failed:', error);
    console.error('❌ Error details:', error.response?.data || error.message);
    return { success: false, message: 'Backend unavailable' };
  }
};

// Export WebSocket manager instance
export const websocketManager = new WebSocketManager();

// Default export
export default {
  bybitApi,
  openaiApi,
  coinsApi,
  healthCheck,
  websocketManager,
};