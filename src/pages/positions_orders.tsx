import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { bybitApi, Position, OrderHistory, ConnectionData } from '../services/api';
import { GlassCard, GlassButton, GlassMetric } from '../components/GlassCard';

interface OpenOrder {
  orderId: string;
  orderLinkId?: string;
  symbol: string;
  side: 'Buy' | 'Sell';
  orderType: string;
  price: string | number;
  qty: string | number;
  quantity?: number;
  filledQty?: number;
  orderStatus: string;
  createdTime: string;
  updatedTime: string;
  timeInForce?: string;
  takeProfit?: number;
  stopLoss?: number;
  triggerPrice?: number | string;
  takeProfitPrice?: string;
  stopLossPrice?: string;
  reduceOnly?: boolean;
  closeOnTrigger?: boolean;
  connectionId?: string;
}

interface OutletContext {
  livePositions: Position[];
  totalValue: number;
  totalPnL: number;
  activePositions: number;
  systemStatus: any;
  bybitConnections: any[];
  openaiConnections: any[];
  marketData: any[];
  portfolioSummary: any;
  backendStatus: string;
}

interface BybitConnection {
  connectionId: string;
  name: string;
  status: string;
  data: ConnectionData;
  metadata: {
    name: string;
    created_at: string;
  };
}

// Utility function for currency formatting
function toCurrency(v: number) {
  return "$" + (+v).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

const PositionsOrdersPage: React.FC = () => {
  const context = useOutletContext<OutletContext>();
  const { livePositions: contextPositions, totalValue: contextTotalValue, totalPnL: contextTotalPnL, activePositions: contextActivePositions } = context || {};
  
  const [activeTab, setActiveTab] = useState('Open Positions');
  const [connections, setConnections] = useState<BybitConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [allOrderHistory, setAllOrderHistory] = useState<OrderHistory[]>([]);
  const [realOpenOrders, setRealOpenOrders] = useState<OpenOrder[]>([]);
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const [modifyingOrder, setModifyingOrder] = useState<string | null>(null);
  const [modifyingPosition, setModifyingPosition] = useState<string | null>(null);

  // Process and fix PnL calculations
  const processedPositions = useMemo(() => {
    return allPositions.map(position => {
      const entryPrice = Number(position.entryPrice) || 0;
      const currentPrice = Number(position.currentPrice) || 0;
      const amount = Number(position.amount) || 0;
      
      let pnl = Number(position.pnl) || 0;
      let pnlPercent = Number(position.pnlPercent) || 0;
      
      if (pnl === 0 && entryPrice > 0 && currentPrice > 0 && amount > 0) {
        if (position.direction === 'LONG') {
          pnl = (currentPrice - entryPrice) * amount;
        } else {
          pnl = (entryPrice - currentPrice) * amount;
        }
        pnlPercent = (pnl / (entryPrice * amount)) * 100;
      }
      
      return {
        ...position,
        pnl,
        pnlPercent,
        entryPrice,
        currentPrice,
        amount
      };
    });
  }, [allPositions]);

  // Get open positions and closed trades from all connections
  const openPositions = processedPositions.filter(pos => pos.status === 'OPEN');
  const closedTrades = allOrderHistory.filter(order => order.status === 'CLOSED');

  // Calculate totals using real balance data
  const totalBalance = connections.reduce((sum, conn) => {
    return sum + (conn.data?.balance?.total || 0);
  }, 0);
  const totalPnL = openPositions.reduce((sum, trade) => sum + trade.pnl, 0);
  const totalValue = totalBalance + totalPnL;
  const activeConnections = connections.filter(conn => conn.status === "active");

  // Fetch live ByBit data
  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('🔄 Fetching live ByBit connections...');
      const response = await bybitApi.getConnections();
      
      if (response.success) {
        const mappedConnections: BybitConnection[] = response.connections.map(conn => ({
          connectionId: conn.connectionId || conn.connection_id,
          name: conn.metadata?.name || conn.name || 'Unknown Connection',
          status: conn.status || 'active',
          data: conn.data,
          metadata: conn.metadata || { name: conn.name || 'Unknown', created_at: new Date().toISOString() }
        }));
        setConnections(mappedConnections);
        
        const allPos: Position[] = [];
        const allOrders: OrderHistory[] = [];
        const allOpenOrders: OpenOrder[] = [];
        
        for (const conn of mappedConnections) {
          if (conn.status === 'active') {
            try {
              const ordersResponse = await bybitApi.getOpenOrders(conn.connectionId);
              if (ordersResponse.success && ordersResponse.data) {
                const ordersWithConnection = ordersResponse.data.map((order: OpenOrder) => ({
                  ...order,
                  connectionId: conn.connectionId
                }));
                allOpenOrders.push(...ordersWithConnection);
              }
            } catch (error) {
              console.error(`Failed to fetch open orders for ${conn.connectionId}:`, error);
            }
          }
          
          if (conn.data?.positions) {
            allPos.push(...conn.data.positions);
          }
          if (conn.data?.orderHistory) {
            allOrders.push(...conn.data.orderHistory);
          }
        }
        
        setAllPositions(allPos);
        setAllOrderHistory(allOrders);
        setRealOpenOrders(allOpenOrders);
        
        console.log('✅ Loaded', mappedConnections.length, 'connections with', allPos.length, 'positions');
      } else {
        console.error('❌ Failed to fetch connections');
        setConnections([]);
        setAllPositions([]);
        setAllOrderHistory([]);
        setRealOpenOrders([]);
      }
    } catch (error) {
      console.error('❌ Error fetching data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleCancelOrder = async (order: OpenOrder) => {
    if (!order.connectionId || !order.orderId) return;
    
    setCancellingOrder(order.orderId);
    try {
      console.log('🗑️ Cancelling order:', order.orderId, order.symbol);
      const response = await bybitApi.cancelOrder({
        connectionId: order.connectionId,
        orderId: order.orderId,
        symbol: order.symbol
      });
      
      if (response.success) {
        console.log('✅ Order cancelled successfully');
        await fetchData();
      } else {
        console.error('❌ Failed to cancel order:', response.message);
        alert('Failed to cancel order: ' + (response.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('❌ Error cancelling order:', error);
      alert('Error cancelling order: ' + error.message);
    }
    setCancellingOrder(null);
  };

  const handleClosePosition = async (position: Position) => {
    if (!position.id) return;
    
    const connection = connections.find(conn => 
      conn.data?.positions?.some(pos => pos.id === position.id)
    );
    
    if (!connection) {
      alert('Connection not found for this position');
      return;
    }
    
    setClosingPosition(position.id);
    try {
      console.log('🔒 Closing position:', position.symbol, position.direction);
      const response = await bybitApi.closePosition({
        connectionId: connection.connectionId,
        symbol: position.symbol,
        side: position.direction === 'LONG' ? 'Sell' : 'Buy'
      });
      
      if (response.success) {
        console.log('✅ Position closed successfully');
        await fetchData();
      } else {
        console.error('❌ Failed to close position:', response.message);
        alert('Failed to close position: ' + (response.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('❌ Error closing position:', error);
      alert('Error closing position: ' + error.message);
    }
    setClosingPosition(null);
  };

  const tabs = [
    { name: 'Open Positions', data: openPositions, count: openPositions.length },
    { name: 'Open Orders', data: realOpenOrders, count: realOpenOrders.length },
    { name: 'Closed Trades', data: closedTrades, count: closedTrades.length }
  ];

  const currentData = activeTab === 'Open Orders' 
    ? realOpenOrders 
    : tabs.find(tab => tab.name === activeTab)?.data || [] as any[];

  if (loading) {
    return (
      <div className="relative min-h-screen p-12 space-y-12">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-neon-cyan/3 rounded-full blur-[100px] animate-float"></div>
          <div className="absolute top-3/4 right-1/4 w-[500px] h-[500px] bg-neon-purple/3 rounded-full blur-[100px] animate-float-delayed"></div>
        </div>
        <div className="relative z-10 text-center py-24">
          <div className="text-8xl mb-8 animate-spin">⚡</div>
          <div className="text-4xl font-orbitron font-black text-holographic mb-4">NEURAL SYNC</div>
          <div className="text-xl text-neon-cyan font-rajdhani">Analyzing quantum trading matrices</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen p-12 space-y-12">
      {/* Futuristic Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-neon-cyan/3 rounded-full blur-[100px] animate-float"></div>
        <div className="absolute top-3/4 right-1/4 w-[500px] h-[500px] bg-neon-purple/3 rounded-full blur-[100px] animate-float-delayed"></div>
        <div className="absolute bottom-1/4 left-1/2 w-[400px] h-[400px] bg-neon-pink/3 rounded-full blur-[80px] animate-float"></div>
      </div>
      
      {/* Premium Header */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-12 animate-fade-in">
          <div className="relative">
            <h1 className="text-7xl font-orbitron font-black text-holographic mb-4">
              TRADING MATRIX
            </h1>
            <p className="text-2xl font-rajdhani text-neon-cyan uppercase tracking-[0.4em] font-bold">
              📈 POSITIONS & ORDERS COMMAND CENTER 📊
            </p>
            <div className="flex items-center space-x-4 mt-4">
              <div className="flex items-center space-x-2 text-sm text-neon-green font-rajdhani font-bold">
                <div className="status-dot status-online"></div>
                <span>{activeConnections.length} NEURAL LINKS ACTIVE</span>
              </div>
              <div className="text-neon-cyan font-rajdhani font-bold text-sm">• LIVE QUANTUM DATA</div>
            </div>
            
            {/* Holographic Effects */}
            <div className="absolute -inset-12 bg-gradient-to-r from-neon-cyan/5 via-neon-purple/5 to-neon-pink/5 blur-3xl opacity-50 animate-pulse-slow"></div>
          </div>
          
          <div className="flex items-center space-x-6">
            <GlassButton
              onClick={() => setShowBalances(!showBalances)}
              variant={showBalances ? 'orange' : 'cyan'}
              className="flex items-center space-x-3 px-8 py-4 text-lg"
            >
              <span className="text-2xl">{showBalances ? '🙈' : '👁️'}</span>
              <span className="font-rajdhani font-bold uppercase tracking-wider">
                {showBalances ? 'HIDE MATRIX' : 'SHOW MATRIX'}
              </span>
            </GlassButton>
            <GlassButton
              onClick={handleRefresh}
              disabled={refreshing}
              variant="cyan"
              className="flex items-center space-x-3 px-8 py-4 text-lg"
            >
              <span className={`text-2xl ${refreshing ? 'animate-spin' : ''}`}>⚡</span>
              <span className="font-rajdhani font-bold uppercase tracking-wider">
                {refreshing ? 'SYNCING' : 'QUANTUM SYNC'}
              </span>
            </GlassButton>
          </div>
        </div>

        {/* Neural Link Status Cards */}
        {connections.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {connections.map((connection, index) => (
              <div key={connection.connectionId} className="animate-fade-in" style={{ animationDelay: `${0.2 + index * 0.1}s` }}>
                <GlassCard variant="neon" color="cyan" className="p-6 hover:scale-105 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-orbitron font-bold text-white text-lg tracking-wide truncate">
                      {connection.metadata?.name || 'ByBit Neural Link'}
                    </h3>
                    <div className={`
                      status-dot animate-pulse
                      ${connection.status === 'active' ? 'status-online' : 'status-offline'}
                    `}></div>
                  </div>
                  
                  <div className="text-xs text-neon-cyan font-rajdhani font-bold uppercase tracking-wider mb-4">
                    BYBIT QUANTUM INTERFACE • {connection.status.toUpperCase()}
                  </div>
                  
                  <div className="glass-panel p-4 mb-4">
                    <div className="text-3xl font-orbitron font-black text-holographic">
                      {showBalances ? toCurrency(connection.data?.balance?.total || 0) : '●●●●●●●●'}
                    </div>
                    {showBalances && totalBalance > 0 && (
                      <div className="text-sm text-neon-green font-rajdhani font-bold mt-2">
                        {((connection.data?.balance?.total || 0) / totalBalance * 100).toFixed(1)}% OF TOTAL MATRIX
                      </div>
                    )}
                  </div>
                  
                  {connection.data?.balance && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-rajdhani">QUANTUM ASSETS:</span>
                      <span className="text-neon-purple font-rajdhani font-bold">
                        {connection.data.balance.coins?.length || 0} TYPES
                      </span>
                    </div>
                  )}
                </GlassCard>
              </div>
            ))}
          </div>
        )}

        {/* Quantum Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          <div className="animate-fade-in metric-card group" style={{ animationDelay: '0.3s' }}>
            <GlassMetric
              label="TOTAL PORTFOLIO"
              value={showBalances ? toCurrency(totalValue) : '●●●●●●●●'}
              change={`${totalBalance > 0 ? '+' : ''}${totalBalance > 0 ? ((totalPnL / totalBalance) * 100).toFixed(2) : '0.00'}%`}
              changeType={totalPnL >= 0 ? 'positive' : 'negative'}
              icon="💎"
              color="cyan"
            />
          </div>
          
          <div className="animate-fade-in metric-card group" style={{ animationDelay: '0.4s' }}>
            <GlassMetric
              label="TOTAL P&L"
              value={showBalances ? `${totalPnL >= 0 ? '+' : ''}${toCurrency(Math.abs(totalPnL))}` : '●●●●●●●●'}
              change="LIVE TRADING"
              changeType={totalPnL >= 0 ? 'positive' : 'negative'}
              icon="📈"
              color={totalPnL >= 0 ? 'green' : 'red'}
            />
          </div>
          
          <div className="animate-fade-in metric-card group" style={{ animationDelay: '0.5s' }}>
            <GlassMetric
              label="OPEN POSITIONS"
              value={openPositions.length.toString()}
              change="NEURAL TRADING"
              changeType="positive"
              icon="🎯"
              color="purple"
            />
          </div>
          
          <div className="animate-fade-in metric-card group" style={{ animationDelay: '0.6s' }}>
            <GlassMetric
              label="OPEN ORDERS"
              value={realOpenOrders.length.toString()}
              change="PENDING"
              changeType="positive"
              icon="⏳"
              color="orange"
            />
          </div>
          
          <div className="animate-fade-in metric-card group" style={{ animationDelay: '0.7s' }}>
            <GlassMetric
              label="CLOSED TRADES"
              value={closedTrades.length.toString()}
              change="COMPLETED"
              changeType="positive"
              icon="✅"
              color="pink"
            />
          </div>
        </div>

        {/* Neural Tab Navigation */}
        <div className="animate-fade-in mb-12" style={{ animationDelay: '0.8s' }}>
          <div className="glass-card">
            <div className="flex space-x-2 p-2 glass-panel rounded-2xl">
              {tabs.map((tab, index) => (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`
                    relative flex-1 px-8 py-4 rounded-xl font-rajdhani font-bold text-lg transition-all duration-300
                    ${activeTab === tab.name
                      ? `bg-neon-${index === 0 ? 'cyan' : index === 1 ? 'purple' : 'pink'}/20 text-neon-${index === 0 ? 'cyan' : index === 1 ? 'purple' : 'pink'} 
                         shadow-[0_0_30px_rgba(${index === 0 ? '0,255,255' : index === 1 ? '191,0,255' : '255,0,128'},0.4)] 
                         border border-neon-${index === 0 ? 'cyan' : index === 1 ? 'purple' : 'pink'}/50`
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    <span className="text-2xl">
                      {index === 0 ? '🎯' : index === 1 ? '📋' : '📜'}
                    </span>
                    <span className="uppercase tracking-wider">{tab.name}</span>
                    <span className={`
                      px-3 py-1 rounded-full text-sm font-black
                      ${activeTab === tab.name 
                        ? 'bg-black/30 text-white' 
                        : 'bg-gray-700/50 text-gray-300'
                      }
                    `}>
                      {tab.count}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quantum Trading Matrix */}
        <div className="animate-fade-in" style={{ animationDelay: '0.9s' }}>
          <div className="glass-card overflow-hidden">
            <h3 className="text-3xl font-orbitron font-black text-holographic mb-8 uppercase tracking-wider flex items-center p-6 border-b border-white/10">
              <span className="text-4xl mr-4">⚡</span>
              NEURAL TRADING MATRIX
              <div className="ml-6 status-dot status-online"></div>
            </h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="glass-panel border-b border-white/10">
                    <th className="px-8 py-6 text-left font-orbitron font-black text-neon-cyan uppercase tracking-[0.2em] text-lg">
                      SYMBOL
                    </th>
                    <th className="px-8 py-6 text-left font-orbitron font-black text-neon-cyan uppercase tracking-[0.2em] text-lg">
                      {activeTab === 'Open Orders' ? 'SIDE' : 'DIRECTION'}
                    </th>
                    <th className="px-8 py-6 text-left font-orbitron font-black text-neon-cyan uppercase tracking-[0.2em] text-lg">
                      {activeTab === 'Open Orders' ? 'QUANTITY' : 'AMOUNT'}
                    </th>
                    <th className="px-8 py-6 text-left font-orbitron font-black text-neon-cyan uppercase tracking-[0.2em] text-lg">
                      {activeTab === 'Open Orders' ? 'ORDER PRICE' : 'ENTRY'}
                    </th>
                    {activeTab !== 'Open Orders' && (
                      <th className="px-8 py-6 text-left font-orbitron font-black text-neon-cyan uppercase tracking-[0.2em] text-lg">
                        CURRENT
                      </th>
                    )}
                    {activeTab === 'Open Orders' && (
                      <th className="px-8 py-6 text-left font-orbitron font-black text-neon-cyan uppercase tracking-[0.2em] text-lg">
                        TYPE
                      </th>
                    )}
                    {activeTab !== 'Open Orders' && (
                      <th className="px-8 py-6 text-left font-orbitron font-black text-neon-cyan uppercase tracking-[0.2em] text-lg">
                        P&L
                      </th>
                    )}
                    <th className="px-8 py-6 text-left font-orbitron font-black text-neon-cyan uppercase tracking-[0.2em] text-lg">
                      STATUS
                    </th>
                    <th className="px-8 py-6 text-left font-orbitron font-black text-neon-cyan uppercase tracking-[0.2em] text-lg">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab === 'Open Orders' ? (
                    realOpenOrders.map((order, idx) => (
                      <tr key={`${order.orderId}-${idx}`} className="glass-panel hover:scale-[1.01] transition-all duration-300 border-b border-white/5">
                        <td className="px-8 py-6">
                          <div className="flex items-center space-x-4">
                            <div className={`
                              status-dot animate-pulse
                              ${order.side === 'Buy' ? 'status-online' : 'status-offline'}
                            `} />
                            <span className="font-orbitron font-bold text-white text-xl tracking-wide">{order.symbol}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`
                            px-4 py-2 rounded-full text-sm font-rajdhani font-bold uppercase tracking-wider
                            ${order.side === 'Buy'
                              ? 'bg-neon-green/20 text-neon-green border border-neon-green/40'
                              : 'bg-neon-red/20 text-neon-red border border-neon-red/40'
                            }
                          `}>
                            {order.side}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-white font-orbitron font-bold text-lg">
                          {parseFloat(order.qty.toString()).toLocaleString()}
                        </td>
                        <td className="px-8 py-6 text-white font-orbitron font-bold text-lg">
                          ${parseFloat(order.price.toString()).toLocaleString()}
                        </td>
                        <td className="px-8 py-6 text-neon-purple font-rajdhani font-bold">
                          {order.orderType}
                        </td>
                        <td className="px-8 py-6">
                          <span className={`
                            px-4 py-2 rounded-full text-sm font-rajdhani font-bold uppercase tracking-wider
                            ${order.orderStatus === 'New'
                              ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40'
                              : order.orderStatus === 'PartiallyFilled'
                              ? 'bg-neon-yellow/20 text-neon-yellow border border-neon-yellow/40'
                              : 'bg-gray-500/20 text-gray-300 border border-gray-500/40'
                            }
                          `}>
                            {order.orderStatus}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center space-x-3">
                            <GlassButton
                              onClick={() => handleCancelOrder(order)}
                              disabled={cancellingOrder === order.orderId}
                              variant="red"
                              size="sm"
                            >
                              {cancellingOrder === order.orderId ? (
                                <span className="animate-spin">🔄</span>
                              ) : (
                                <span>🗑️</span>
                              )}
                            </GlassButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    currentData.map((trade, idx) => (
                      <tr key={`${trade.id}-${idx}`} className="glass-panel hover:scale-[1.01] transition-all duration-300 border-b border-white/5">
                        <td className="px-8 py-6">
                          <div className="flex items-center space-x-4">
                            <div className={`
                              status-dot animate-pulse
                              ${(trade.direction === 'LONG' || trade.side === 'Buy') ? 'status-online' : 'status-offline'}
                            `} />
                            <span className="font-orbitron font-bold text-white text-xl tracking-wide">{trade.symbol}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`
                            px-4 py-2 rounded-full text-sm font-rajdhani font-bold uppercase tracking-wider
                            ${(trade.direction === 'LONG' || trade.side === 'Buy')
                              ? 'bg-neon-green/20 text-neon-green border border-neon-green/40'
                              : 'bg-neon-red/20 text-neon-red border border-neon-red/40'
                            }
                          `}>
                            {trade.direction || trade.side}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-white font-orbitron font-bold text-lg">
                          {trade.amount || trade.qty}
                        </td>
                        <td className="px-8 py-6 text-white font-orbitron font-bold text-lg">
                          ${(trade.entryPrice || trade.price)?.toLocaleString()}
                        </td>
                        <td className="px-8 py-6 text-white font-orbitron font-bold text-lg">
                          ${trade.currentPrice?.toLocaleString()}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className={`
                              font-orbitron font-black text-2xl
                              ${trade.pnl >= 0 ? 'text-neon-green' : 'text-neon-red'}
                            `}
                              style={{
                                textShadow: trade.pnl >= 0 
                                  ? '0 0 20px var(--neon-green)' 
                                  : '0 0 20px var(--neon-red)'
                              }}
                            >
                              {trade.pnl >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)}
                            </span>
                            <span className={`
                              text-sm font-rajdhani font-bold
                              ${trade.pnlPercent >= 0 ? 'text-neon-green' : 'text-neon-red'}
                            `}>
                              {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent?.toFixed(2)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`
                            px-4 py-2 rounded-full text-sm font-rajdhani font-bold uppercase tracking-wider
                            ${trade.status === 'OPEN'
                              ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40'
                              : trade.status === 'PENDING'
                              ? 'bg-neon-yellow/20 text-neon-yellow border border-neon-yellow/40'
                              : trade.status === 'CANCELLED'
                              ? 'bg-neon-red/20 text-neon-red border border-neon-red/40'
                              : 'bg-gray-500/20 text-gray-300 border border-gray-500/40'
                            }
                          `}>
                            {trade.status}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          {activeTab === 'Open Positions' && (
                            <div className="flex items-center space-x-3">
                              <GlassButton
                                onClick={() => handleClosePosition(trade)}
                                disabled={closingPosition === trade.id}
                                variant="red"
                                size="sm"
                                title="Close Position"
                              >
                                {closingPosition === trade.id ? (
                                  <span className="animate-spin">🔄</span>
                                ) : (
                                  <span>🔒</span>
                                )}
                              </GlassButton>
                            </div>
                          )}
                          {activeTab === 'Closed Trades' && (
                            <div className="text-gray-400 text-sm font-rajdhani font-bold uppercase tracking-wider">
                              ARCHIVED
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {currentData.length === 0 && (
              <div className="py-24 text-center">
                <div className="text-8xl mb-8 animate-float">
                  {activeTab === 'Open Orders' ? '📋' : activeTab === 'Open Positions' ? '🎯' : '📜'}
                </div>
                <h3 className="text-4xl font-orbitron font-black text-holographic mb-6 uppercase tracking-wider">
                  NO {activeTab.toUpperCase()} DETECTED
                </h3>
                <p className="text-xl text-gray-400 font-rajdhani mb-8">
                  {activeTab === 'Open Orders' 
                    ? 'Neural trading matrix awaiting order deployment' 
                    : activeTab === 'Open Positions'
                    ? 'Quantum trading system ready for position activation'
                    : 'Trading history matrix will populate with completed trades'
                  }
                </p>
                {connections.length === 0 && (
                  <div className="glass-panel p-6 inline-block">
                    <p className="text-neon-cyan font-rajdhani font-bold text-lg">
                      🔗 NEURAL LINK REQUIRED: Configure ByBit connection in API Matrix
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quantum Action Center */}
        <div className="animate-fade-in pt-8 border-t border-white/10" style={{ animationDelay: '1.0s' }}>
          <div className="glass-card">
            <h3 className="text-2xl font-orbitron font-black text-holographic mb-6 uppercase tracking-wider flex items-center">
              <span className="text-3xl mr-4">⚡</span>
              QUANTUM ACTION CENTER
            </h3>
            <div className="flex flex-wrap gap-6">
              <GlassButton
                onClick={() => console.log('New Position')}
                variant="cyan"
                className="flex items-center space-x-3 px-8 py-4 text-lg"
              >
                <span className="text-2xl">📈</span>
                <span className="font-rajdhani font-bold uppercase tracking-wider">NEW POSITION</span>
              </GlassButton>
              
              <GlassButton
                onClick={() => console.log('Set Order')}
                variant="purple"
                className="flex items-center space-x-3 px-8 py-4 text-lg"
              >
                <span className="text-2xl">📋</span>
                <span className="font-rajdhani font-bold uppercase tracking-wider">SET ORDER</span>
              </GlassButton>
              
              <GlassButton
                onClick={handleRefresh}
                disabled={refreshing || loading}
                variant="green"
                className="flex items-center space-x-3 px-8 py-4 text-lg"
              >
                <span className={`text-2xl ${refreshing ? 'animate-spin' : ''}`}>⚡</span>
                <span className="font-rajdhani font-bold uppercase tracking-wider">
                  {refreshing ? 'SYNCING' : 'REFRESH MATRIX'}
                </span>
              </GlassButton>
              
              <GlassButton
                onClick={() => console.log('Export Report')}
                variant="orange"
                className="flex items-center space-x-3 px-8 py-4 text-lg"
              >
                <span className="text-2xl">📊</span>
                <span className="font-rajdhani font-bold uppercase tracking-wider">EXPORT NEURAL DATA</span>
              </GlassButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PositionsOrdersPage;