// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'dark' | 'light';
  currency: 'USD' | 'EUR' | 'BTC';
  notifications: boolean;
  autoRefresh: boolean;
}

// Trading Types
export interface Trade {
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
  leverage?: number;
  orderType?: string;
  stopLoss?: number;
  takeProfit?: number;
}

export interface Position extends Trade {
  unrealizedPnl: number;
  realizedPnl: number;
  margin: number;
  liquidationPrice?: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  quantity: number;
  price: number;
  status: 'NEW' | 'FILLED' | 'CANCELED' | 'PENDING';
  timestamp: string;
  exchange: string;
}

// Strategy Types
export interface Strategy {
  id: string;
  name: string;
  description: string;
  symbol: string;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
  profit: number;
  trades: number;
  winRate: number;
  createdAt: string;
  lastUpdate: string;
  parameters: StrategyParameters;
  performance: StrategyPerformance;
}

export interface StrategyParameters {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  maxLoss: number;
  takeProfit: number;
  timeframe: string;
  indicators: string[];
}

export interface StrategyPerformance {
  totalPnl: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
}

// System Types
export interface SystemStatus {
  backend: boolean;
  frontend: boolean;
  openai: boolean;
  bybit: boolean;
  mexc: boolean;
  binance: boolean;
  lastCheck: string;
  latency: number;
}

// API Types
export interface ApiCredentials {
  bybit: BybitCredentials;
  openai: OpenAICredentials;
  mexc?: ExchangeCredentials;
  binance?: ExchangeCredentials;
}

export interface BybitCredentials {
  apiKey: string;
  secretKey: string;
  testnet: boolean;
  name: string;
  markets: {
    spot: boolean;
    usdtPerpetual: boolean;
    inverseUsd: boolean;
  };
}

export interface OpenAICredentials {
  apiKey: string;
  organization: string;
  model: 'gpt-4' | 'gpt-3.5-turbo';
  maxTokens: number;
}

export interface ExchangeCredentials {
  apiKey: string;
  secretKey: string;
  testnet: boolean;
  name: string;
}

// Connection Types
export interface BybitConnection {
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
  balance: ConnectionBalance;
  createdAt: string;
  performance: ConnectionPerformance;
  lastSync: string;
  health: ConnectionHealth;
}

export interface ConnectionBalance {
  total: number;
  available: number;
  locked: number;
  balanceHistory: BalanceHistoryPoint[];
  breakdown: BalanceBreakdown[];
}

export interface BalanceHistoryPoint {
  time: string;
  value: number;
  pnl?: number;
}

export interface BalanceBreakdown {
  currency: string;
  total: number;
  available: number;
  locked: number;
  usdValue: number;
}

export interface ConnectionPerformance {
  dailyChange: number;
  weeklyChange: number;
  monthlyChange: number;
  yearlyChange: number;
  totalPnl: number;
  totalVolume: number;
}

export interface ConnectionHealth {
  uptime: number;
  lastError?: string;
  errorCount: number;
  responseTime: number;
}

// Market Data Types
export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: string;
  exchange: string;
}

export interface Ticker {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: string;
}

// Portfolio Types
export interface Portfolio {
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  allocations: PortfolioAllocation[];
  performance: PortfolioPerformance;
}

export interface PortfolioAllocation {
  exchange: string;
  value: number;
  percentage: number;
  pnl: number;
  pnlPercent: number;
}

export interface PortfolioPerformance {
  roi24h: number;
  roi7d: number;
  roi30d: number;
  roi1y: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

// OpenAI Types
export interface OpenAIUsage {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  remainingCredits: number;
  billingPeriod: {
    start: string;
    end: string;
  };
}

// Loading States
export interface LoadingStates {
  connections: boolean;
  trades: boolean;
  strategies: boolean;
  systemStatus: boolean;
  marketData: boolean;
  portfolio: boolean;
  openai: boolean;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'PRICE_UPDATE' | 'BALANCE_UPDATE' | 'TRADE_UPDATE' | 'STATUS_UPDATE';
  data: any;
  timestamp: string;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  action?: 'RETRY' | 'REFRESH' | 'RECONNECT';
}

// Component Props Types
export interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  icon: string;
  loading?: boolean;
  onClick?: () => void;
}

export interface TradeCardProps {
  trade: Trade;
  loading?: boolean;
  onEdit?: (trade: Trade) => void;
  onClose?: (trade: Trade) => void;
}

export interface StrategyCardProps {
  strategy: Strategy;
  loading?: boolean;
  onEdit?: (strategy: Strategy) => void;
  onToggle?: (strategy: Strategy) => void;
  onDelete?: (strategy: Strategy) => void;
}

// Navigation Types
export type TabType = 'dashboard' | 'trades' | 'strategies' | 'api' | 'settings';
export type TradeTabType = 'Open Positions' | 'Open Orders' | 'Closed Trades';