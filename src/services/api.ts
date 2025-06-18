// Frontend API Service - PyBit Integration
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = 'https://ctb-backend-api-5b94a2e25dad.herokuapp.com/api';

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

// New types for automation features
export interface Strategy {
  id: string;
  name: string;
  connection_id: string;
  symbol: string;
  status: 'INACTIVE' | 'ACTIVE' | 'PAUSED' | 'ERROR' | 'STOPPED';
  config: {
    type: string;
    position_size: number;
    leverage: number;
    [key: string]: any;
  };
  performance?: {
    total_pnl: number;
    win_rate: number;
    total_trades: number;
    current_drawdown: number;
    max_drawdown: number;
  };
  risk_limits?: {
    max_position_size: number;
    max_daily_loss: number;
    max_drawdown: number;
    max_leverage: number;
  };
  last_execution?: string;
  last_signal?: any;
}

export interface RiskSummary {
  global_limits: Record<string, number>;
  portfolio_metrics: {
    total_equity: number;
    total_unrealized_pnl: number;
    total_exposure: number;
    daily_pnl: number;
    max_drawdown: number;
    current_drawdown: number;
    win_rate: number;
    sharpe_ratio: number;
    active_positions: number;
    total_trades_today: number;
    timestamp: string;
  } | null;
  emergency_stop_triggered: boolean;
  active_positions: number;
  position_risks: Record<string, any>;
  recent_alerts: any[];
  risk_stats: Record<string, any>;
  monitoring_active: boolean;
  last_update: string;
}

export interface MonitoringDashboard {
  system_health: {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    network_io: Record<string, number>;
    uptime: number;
    timestamp: string;
  } | null;
  trading_performance: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    total_pnl: number;
    win_rate: number;
    avg_win: number;
    avg_loss: number;
    max_drawdown: number;
    sharpe_ratio: number;
    profit_factor: number;
    timestamp: string;
  } | null;
  active_alerts: any[];
  metrics_summary: Record<string, any>;
  monitoring_stats: Record<string, any>;
  thresholds: Record<string, number>;
  is_monitoring: boolean;
  uptime: number;
  last_update: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
  high_24h: number;
  low_24h: number;
  change_24h: number;
  bid: number;
  ask: number;
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

    // Create WebSocket connection to live backend
    console.log('🔌 Connecting WebSocket to live backend...');
    this.socket = io('https://ctb-backend-api-5b94a2e25dad.herokuapp.com', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true
    });

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

// Health check function
export const getHealth = async (): Promise<{ success: boolean; version?: string; message?: string }> => {
  try {
    const response = await apiClient.get('/health');
    return response.data;
  } catch (error) {
    return { success: false, message: 'Backend unreachable' };
  }
};

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

  // Get open orders
  getOpenOrders: async (connectionId: string) => {
    const response = await apiClient.get(`/trading/open-orders/${connectionId}`);
    return response.data;
  },

  // Cancel order
  cancelOrder: async (data: {
    connectionId: string;
    orderId: string;
    symbol: string;
  }) => {
    const response = await apiClient.post('/trading/cancel-order', data);
    return response.data;
  },

  // Modify order
  modifyOrder: async (data: {
    connectionId: string;
    orderId: string;
    symbol: string;
    quantity?: number;
    price?: number;
    triggerPrice?: number;
    takeProfit?: number;
    stopLoss?: number;
  }) => {
    const response = await apiClient.post('/trading/modify-order', data);
    return response.data;
  },

  // Close position
  closePosition: async (data: {
    connectionId: string;
    symbol: string;
    side: string;
  }) => {
    const response = await apiClient.post('/trading/close-position', data);
    return response.data;
  },

  // Modify position (SL/TP)
  modifyPosition: async (data: {
    connectionId: string;
    symbol: string;
    side: string;
    takeProfit?: number;
    stopLoss?: number;
    tpTriggerBy?: string;
    slTriggerBy?: string;
  }) => {
    const response = await apiClient.post('/trading/modify-position', data);
    return response.data;
  },

  // Strategy execution
  executeStrategy: async (data: {
    strategyId: string;
    connectionId: string;
    signal: 'BUY' | 'SELL';
    symbol: string;
    quantity: number;
    price?: number;
    orderType?: 'market' | 'limit';
  }) => {
    const response = await apiClient.post('/strategies/execute', data);
    return response.data;
  },

  // Get strategy status
  getStrategyStatus: async (strategyId: string) => {
    const response = await apiClient.get(`/strategies/status/${strategyId}`);
    return response.data;
  },

  // Stop strategy
  stopStrategy: async (data: {
    strategyId: string;
    connectionId?: string;
    closePositions?: boolean;
  }) => {
    const response = await apiClient.post('/strategies/stop', data);
    return response.data;
  },
};

// ================================
// NEW AUTOMATION API FUNCTIONS
// ================================

// Strategy Engine API
export const strategyEngineApi = {
  // Create enhanced strategy
  createStrategy: async (data: {
    name: string;
    connection_id: string;
    symbol: string;
    config: Record<string, any>;
    risk_limits?: Record<string, number>;
  }) => {
    const response = await apiClient.post('/strategy/create/enhanced', data);
    return response.data;
  },

  // Control strategy (start/pause/stop)
  controlStrategy: async (data: {
    strategy_id: string;
    action: 'start' | 'pause' | 'stop';
  }) => {
    const response = await apiClient.post('/strategy/control', data);
    return response.data;
  },

  // Get strategy status
  getStrategyStatus: async (strategyId: string): Promise<{ success: boolean; data: Strategy }> => {
    const response = await apiClient.get(`/strategy/status/${strategyId}`);
    return response.data;
  },

  // Get engine status
  getEngineStatus: async () => {
    const response = await apiClient.get('/strategy/engine/status');
    return response.data;
  },

  // Start strategy engine
  startEngine: async () => {
    const response = await apiClient.post('/strategy/engine/start');
    return response.data;
  },

  // Stop strategy engine
  stopEngine: async () => {
    const response = await apiClient.post('/strategy/engine/stop');
    return response.data;
  },
};

// Real-time Data API
export const realTimeDataApi = {
  // Start data feeds
  startDataFeeds: async (symbols: string[]) => {
    const response = await apiClient.post('/data/start', symbols);
    return response.data;
  },

  // Stop data feeds
  stopDataFeeds: async () => {
    const response = await apiClient.post('/data/stop');
    return response.data;
  },

  // Get data statistics
  getDataStats: async () => {
    const response = await apiClient.get('/data/stats');
    return response.data;
  },

  // Get market data for symbol
  getMarketData: async (symbol: string): Promise<{ success: boolean; data: MarketData }> => {
    const response = await apiClient.get(`/data/market/${symbol}`);
    return response.data;
  },

  // Get kline data
  getKlineData: async (symbol: string, limit: number = 100) => {
    const response = await apiClient.get(`/data/klines/${symbol}?limit=${limit}`);
    return response.data;
  },
};

// Risk Management API
export const riskManagementApi = {
  // Get risk summary
  getRiskSummary: async (): Promise<{ success: boolean; data: RiskSummary }> => {
    const response = await apiClient.get('/risk/summary');
    return response.data;
  },

  // Set risk limit
  setRiskLimit: async (data: {
    limit_name: string;
    value: number;
  }) => {
    const response = await apiClient.post('/risk/limits', data);
    return response.data;
  },

  // Start risk monitoring
  startRiskMonitoring: async () => {
    const response = await apiClient.post('/risk/monitoring/start');
    return response.data;
  },

  // Stop risk monitoring
  stopRiskMonitoring: async () => {
    const response = await apiClient.post('/risk/monitoring/stop');
    return response.data;
  },

  // Reset emergency stop
  resetEmergencyStop: async () => {
    const response = await apiClient.post('/risk/emergency/reset');
    return response.data;
  },

  // Get position risk
  getPositionRisk: async (symbol: string) => {
    const response = await apiClient.get(`/risk/position/${symbol}`);
    return response.data;
  },
};

// Monitoring API
export const monitoringApi = {
  // Get monitoring dashboard
  getDashboard: async (): Promise<{ success: boolean; data: MonitoringDashboard }> => {
    const response = await apiClient.get('/monitoring/dashboard');
    return response.data;
  },

  // Start monitoring
  startMonitoring: async () => {
    const response = await apiClient.post('/monitoring/start');
    return response.data;
  },

  // Stop monitoring
  stopMonitoring: async () => {
    const response = await apiClient.post('/monitoring/stop');
    return response.data;
  },

  // Configure alerts
  configureAlerts: async (config: Record<string, any>) => {
    const response = await apiClient.post('/monitoring/alerts/config', { config });
    return response.data;
  },

  // Get metric history
  getMetricHistory: async (metricName: string, hours: number = 24) => {
    const response = await apiClient.get(`/monitoring/metrics/${metricName}?hours=${hours}`);
    return response.data;
  },

  // Resolve alert
  resolveAlert: async (alertId: string) => {
    const response = await apiClient.post(`/monitoring/alerts/${alertId}/resolve`);
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