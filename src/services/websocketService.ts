/**
 * WebSocket Service for Real-time Communication
 * Handles real-time updates between frontend and backend
 */

import { io, Socket } from 'socket.io-client';
import { MarketData, Strategy, RiskSummary, MonitoringDashboard } from './api';

export interface WebSocketEvents {
  // Market data events
  'market_update': (data: { timestamp: string; data: Record<string, MarketData> }) => void;
  'price_change': (data: { symbol: string; price: number; change: number }) => void;
  'kline_update': (data: { symbol: string; kline: any }) => void;
  
  // Strategy events
  'strategy_signal': (data: { strategy_id: string; signal: any }) => void;
  'strategy_execution': (data: { strategy_id: string; execution: any }) => void;
  'strategy_status_change': (data: { strategy_id: string; status: string }) => void;
  'strategy_performance_update': (data: { strategy_id: string; performance: any }) => void;
  
  // Risk management events
  'risk_alert': (data: { alert: any }) => void;
  'emergency_stop': (data: { reason: string; timestamp: string }) => void;
  'position_risk_update': (data: { symbol: string; risk: any }) => void;
  'portfolio_update': (data: { metrics: any }) => void;
  
  // Monitoring events
  'system_health_update': (data: { health: any }) => void;
  'trading_performance_update': (data: { performance: any }) => void;
  'alert_created': (data: { alert: any }) => void;
  'alert_resolved': (data: { alert_id: string }) => void;
  
  // Connection events
  'connected': () => void;
  'disconnected': () => void;
  'error': (error: any) => void;
  'reconnect': () => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private isConnecting = false;
  private listeners: Map<string, Function[]> = new Map();
  
  private serverUrl = 'https://ctb-backend-api-5b94a2e25dad.herokuapp.com';
  
  constructor() {
    // Don't auto-connect - let the main WebSocketManager handle connections
  }
  
  /**
   * Connect to WebSocket server
   */
  connect(): void {
    console.log('🔌 WebSocket disabled - Backend does not support socket.io');
    // Disabled due to backend not supporting socket.io
    return;
    
    if (this.socket?.connected || this.isConnecting) {
      return;
    }
    
    this.isConnecting = true;
    console.log('🔌 Connecting to WebSocket server...');
    
    this.socket = io(this.serverUrl, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      timeout: 20000,
      forceNew: true,
    });
    
    this.setupEventHandlers();
  }
  
  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;
    
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.emit('connected');
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this.emit('disconnected');
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('🚨 WebSocket connection error:', error);
      this.isConnecting = false;
      this.emit('error', error);
    });
    
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 WebSocket reconnected after ${attemptNumber} attempts`);
      this.emit('reconnect');
    });
    
    this.socket.on('reconnect_error', (error) => {
      console.error('🚨 WebSocket reconnection error:', error);
      this.reconnectAttempts++;
    });
    
    // Market data events
    this.socket.on('market_update', (data) => {
      this.emit('market_update', data);
    });
    
    this.socket.on('price_change', (data) => {
      this.emit('price_change', data);
    });
    
    this.socket.on('kline_update', (data) => {
      this.emit('kline_update', data);
    });
    
    // Strategy events
    this.socket.on('strategy_signal', (data) => {
      console.log('📡 Strategy signal received:', data);
      this.emit('strategy_signal', data);
    });
    
    this.socket.on('strategy_execution', (data) => {
      console.log('⚡ Strategy execution:', data);
      this.emit('strategy_execution', data);
    });
    
    this.socket.on('strategy_status_change', (data) => {
      console.log('🔄 Strategy status change:', data);
      this.emit('strategy_status_change', data);
    });
    
    this.socket.on('strategy_performance_update', (data) => {
      this.emit('strategy_performance_update', data);
    });
    
    // Risk management events
    this.socket.on('risk_alert', (data) => {
      console.warn('🚨 Risk alert:', data);
      this.emit('risk_alert', data);
    });
    
    this.socket.on('emergency_stop', (data) => {
      console.error('🚨🚨🚨 EMERGENCY STOP:', data);
      this.emit('emergency_stop', data);
    });
    
    this.socket.on('position_risk_update', (data) => {
      this.emit('position_risk_update', data);
    });
    
    this.socket.on('portfolio_update', (data) => {
      this.emit('portfolio_update', data);
    });
    
    // Monitoring events
    this.socket.on('system_health_update', (data) => {
      this.emit('system_health_update', data);
    });
    
    this.socket.on('trading_performance_update', (data) => {
      this.emit('trading_performance_update', data);
    });
    
    this.socket.on('alert_created', (data) => {
      console.log('🔔 New alert:', data);
      this.emit('alert_created', data);
    });
    
    this.socket.on('alert_resolved', (data) => {
      console.log('✅ Alert resolved:', data);
      this.emit('alert_resolved', data);
    });
  }
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket...');
      this.socket.disconnect();
      this.socket = null;
    }
  }
  
  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
  
  /**
   * Add event listener
   */
  on<K extends keyof WebSocketEvents>(event: K, callback: WebSocketEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }
  
  /**
   * Remove event listener
   */
  off<K extends keyof WebSocketEvents>(event: K, callback: WebSocketEvents[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }
  
  /**
   * Emit event to listeners
   */
  private emit<K extends keyof WebSocketEvents>(event: K, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          (callback as any)(...args);
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }
  
  /**
   * Send message to server
   */
  send(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected, cannot send message:', event);
    }
  }
  
  /**
   * Subscribe to market data for symbols
   */
  subscribeToMarketData(symbols: string[]): void {
    this.send('subscribe_market_data', { symbols });
  }
  
  /**
   * Unsubscribe from market data
   */
  unsubscribeFromMarketData(symbols: string[]): void {
    this.send('unsubscribe_market_data', { symbols });
  }
  
  /**
   * Subscribe to strategy updates
   */
  subscribeToStrategy(strategyId: string): void {
    this.send('subscribe_strategy', { strategy_id: strategyId });
  }
  
  /**
   * Unsubscribe from strategy updates
   */
  unsubscribeFromStrategy(strategyId: string): void {
    this.send('unsubscribe_strategy', { strategy_id: strategyId });
  }
  
  /**
   * Subscribe to risk alerts
   */
  subscribeToRiskAlerts(): void {
    this.send('subscribe_risk_alerts');
  }
  
  /**
   * Subscribe to monitoring alerts
   */
  subscribeToMonitoringAlerts(): void {
    this.send('subscribe_monitoring_alerts');
  }
  
  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    isConnecting: boolean;
  } {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      isConnecting: this.isConnecting,
    };
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

// Helper hook for React components
export const useWebSocket = () => {
  return webSocketService;
};

export default webSocketService;