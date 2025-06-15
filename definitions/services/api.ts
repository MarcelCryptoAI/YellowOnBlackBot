import {
  Trade,
  Strategy,
  SystemStatus,
  BybitConnection,
  MarketData,
  Portfolio,
  OpenAIUsage,
  ApiResponse,
  BybitCredentials
} from '../types';

class ApiService {
  private static baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
  private static timeout = 200000; // 200 seconden timeout

  // Generic API call method with error handling and custom timeout
  private static async apiCall<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': '1.0',
        'X-Client': 'crypto-trading-bot',
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    };

    try {
      const response = await fetch(url, defaultOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error(`API call failed for ${endpoint}:`, error);

      return {
        success: false,
        data: null as any,
        error: error.name === 'AbortError'
          ? `Request timed out after ${this.timeout}ms`
          : error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Voorbeeldmethode
  static async getTrades(): Promise<ApiResponse<Trade[]>> {
    return this.apiCall<Trade[]>('/trades', { method: 'GET' });
  }

  // … overige endpoint-methodes …
}

export default ApiService;


  // Bybit API Integration
  static async testBybitConnection(credentials: BybitCredentials): Promise<boolean> {
    try {
      const response = await this.apiCall<{ valid: boolean }>('/bybit/test', {
        method: 'POST',
        body: JSON.stringify({
          apiKey: credentials.apiKey,
          secretKey: credentials.secretKey,
          testnet: credentials.testnet,
          markets: credentials.markets
        }),
      });

      return response.success && response.data.valid;
    } catch (error) {
      console.error('Bybit connection test failed:', error);
      return false;
    }
  }

  static async getBybitBalance(connectionId: string): Promise<any> {
    const response = await this.apiCall(`/bybit/balance/${connectionId}`);
    return response.success ? response.data : null;
  }

  static async getBybitPositions(connectionId: string): Promise<Trade[]> {
    const response = await this.apiCall<any[]>(`/bybit/positions/${connectionId}`);

    if (!response.success) return [];

    return response.data.map((position: any) => ({
      id: position.positionIdx || position.orderId,
      symbol: position.symbol,
      direction: position.side === 'Buy' ? 'LONG' : 'SHORT',
      amount: parseFloat(position.size || position.qty),
      entryPrice: parseFloat(position.avgPrice || position.price),
      currentPrice: parseFloat(position.markPrice || position.price),
      pnl: parseFloat(position.unrealisedPnl || position.pnl || 0),
      pnlPercent: parseFloat(position.unrealisedPnlPcnt || 0) * 100,
      status: position.orderStatus === 'Filled' ? 'OPEN' :
               position.orderStatus === 'New' ? 'PENDING' : 'CLOSED',
      exchange: 'Bybit',
      timestamp: position.createdTime || position.updatedTime || new Date().toISOString(),
      leverage: parseInt(position.leverage || 1),
      orderType: position.orderType
    }));
  }

  static async getBybitOrders(connectionId: string): Promise<Trade[]> {
    const response = await this.apiCall<any[]>(`/bybit/orders/${connectionId}`);

    if (!response.success) return [];

    return response.data.map((order: any) => ({
      id: order.orderId,
      symbol: order.symbol,
      direction: order.side === 'Buy' ? 'LONG' : 'SHORT',
      amount: parseFloat(order.qty),
      entryPrice: parseFloat(order.price),
      currentPrice: parseFloat(order.price),
      pnl: 0,
      pnlPercent: 0,
      status: order.orderStatus === 'New' ? 'PENDING' :
               order.orderStatus === 'Filled' ? 'CLOSED' : 'PENDING',
      exchange: 'Bybit',
      timestamp: order.createdTime || new Date().toISOString(),
      leverage: parseInt(order.leverage || 1),
      orderType: order.orderType
    }));
  }

  // OpenAI API Integration
  static async testOpenAIConnection(apiKey: string, organization?: string): Promise<boolean> {
    const response = await this.apiCall<{ valid: boolean }>('/openai/test', {
      method: 'POST',
      body: JSON.stringify({ apiKey, organization }),
    });

    return response.success && response.data.valid;
  }

  static async getOpenAIUsage(): Promise<OpenAIUsage> {
    const response = await this.apiCall<OpenAIUsage>('/openai/usage');

    if (!response.success) {
      return {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalCost: 0,
        remainingCredits: 0,
        billingPeriod: {
          start: new Date().toISOString(),
          end: new Date().toISOString()
        }
      };
    }

    return response.data;
  }

  // Market Data
  static async getMarketData(): Promise<MarketData[]> {
    const response = await this.apiCall<MarketData[]>('/market/data');
    return response.success ? response.data : [];
  }

  static async getTickerPrice(symbol: string): Promise<number> {
    const response = await this.apiCall<{ price: number }>(`/market/ticker/${symbol}`);
    return response.success ? response.data.price : 0;
  }

  // Portfolio Data
  static async getPortfolioData(): Promise<Portfolio> {
    const response = await this.apiCall<Portfolio>('/portfolio');

    if (!response.success) {
      return {
        totalValue: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
        dailyPnl: 0,
        dailyPnlPercent: 0,
        allocations: [],
        performance: {
          roi24h: 0,
          roi7d: 0,
          roi30d: 0,
          roi1y: 0,
          sharpeRatio: 0,
          maxDrawdown: 0
        }
      };
    }

    return response.data;
  }

  // Trading Strategies
  static async getStrategies(): Promise<Strategy[]> {
    const response = await this.apiCall<Strategy[]>('/strategies');
    return response.success ? response.data : [];
  }

  static async createStrategy(strategy: Partial<Strategy>): Promise<Strategy | null> {
    const response = await this.apiCall<Strategy>('/strategies', {
      method: 'POST',
      body: JSON.stringify(strategy),
    });

    return response.success ? response.data : null;
  }

  static async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy | null> {
    const response = await this.apiCall<Strategy>(`/strategies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    return response.success ? response.data : null;
  }

  static async deleteStrategy(id: string): Promise<boolean> {
    const response = await this.apiCall(`/strategies/${id}`, {
      method: 'DELETE',
    });

    return response.success;
  }

  // System Status
  static async getSystemStatus(): Promise<SystemStatus> {
    const response = await this.apiCall<SystemStatus>('/system/status');

    if (!response.success) {
      return {
        backend: false,
        frontend: true,
        openai: false,
        bybit: false,
        mexc: false,
        binance: false,
        lastCheck: new Date().toISOString(),
        latency: 0
      };
    }

    return response.data;
  }

  static async healthCheck(): Promise<{ status: string; latency: number }> {
    const startTime = Date.now();
    const response = await this.apiCall<{ status: string }>('/health');
    const latency = Date.now() - startTime;

    return {
      status: response.success ? 'healthy' : 'unhealthy',
      latency
    };
  }

  // Connection Management
  static async saveConnection(connection: BybitConnection): Promise<boolean> {
    const response = await this.apiCall('/connections', {
      method: 'POST',
      body: JSON.stringify(connection),
    });

    return response.success;
  }

  static async getConnections(): Promise<BybitConnection[]> {
    const response = await this.apiCall<BybitConnection[]>('/connections');
    return response.success ? response.data : [];
  }

  static async updateConnection(id: string, updates: Partial<BybitConnection>): Promise<boolean> {
    const response = await this.apiCall(`/connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    return response.success;
  }

  static async deleteConnection(connectionId: string): Promise<boolean> {
    const response = await this.apiCall(`/connections/${connectionId}`, {
      method: 'DELETE',
    });

    return response.success;
  }

  static async syncConnection(connectionId: string): Promise<boolean> {
    const response = await this.apiCall(`/connections/${connectionId}/sync`, {
      method: 'POST',
    });

    return response.success;
  }

  // Trading Operations
  static async placeOrder(connectionId: string, order: any): Promise<any> {
    const response = await this.apiCall(`/trading/${connectionId}/order`, {
      method: 'POST',
      body: JSON.stringify(order),
    });

    return response.success ? response.data : null;
  }

  static async cancelOrder(connectionId: string, orderId: string): Promise<boolean> {
    const response = await this.apiCall(`/trading/${connectionId}/order/${orderId}`, {
      method: 'DELETE',
    });

    return response.success;
  }

  static async closePosition(connectionId: string, positionId: string): Promise<boolean> {
    const response = await this.apiCall(`/trading/${connectionId}/position/${positionId}/close`, {
      method: 'POST',
    });

    return response.success;
  }

  // Notifications
  static async getNotifications(): Promise<any[]> {
    const response = await this.apiCall<any[]>('/notifications');
    return response.success ? response.data : [];
  }

  static async markNotificationRead(id: string): Promise<boolean> {
    const response = await this.apiCall(`/notifications/${id}/read`, {
      method: 'PUT',
    });

    return response.success;
  }

  // Settings
  static async getUserSettings(): Promise<any> {
    const response = await this.apiCall('/settings');
    return response.success ? response.data : {};
  }

  static async updateUserSettings(settings: any): Promise<boolean> {
    const response = await this.apiCall('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });

    return response.success;
  }

  // WebSocket Connection
  static createWebSocketConnection(): WebSocket | null {
    try {
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
      };

      return ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      return null;
    }
  }
}

export default ApiService;