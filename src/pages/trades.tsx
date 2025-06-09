import React, { useState, useEffect, useMemo } from 'react';
import { bybitApi, Position, OrderHistory, ConnectionData } from '../services/api';

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

// Simple Line Chart Component
const SimpleLineChart: React.FC<{ data: Array<{ date: string; value: number; label: string }> }> = ({ data }) => {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  
  const width = 800;
  const height = 200;
  const padding = 40;
  
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - 2 * padding);
    const y = height - padding - ((d.value - minValue) / range) * (height - 2 * padding);
    return { x, y, ...d };
  });

  return (
    <div className="relative">
      <svg width={width} height={height} className="w-full h-auto">
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Main line */}
        <polyline
          fill="none"
          stroke={points[points.length - 1]?.value >= points[0]?.value ? "#10B981" : "#EF4444"}
          strokeWidth="3"
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
        />
        
        {/* Data points */}
        {points.map((point, i) => (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill={point.value >= (points[0]?.value || 0) ? "#10B981" : "#EF4444"}
              stroke="#1F2937"
              strokeWidth="2"
            />
            {/* Tooltip on hover */}
            <circle
              cx={point.x}
              cy={point.y}
              r="15"
              fill="transparent"
              className="cursor-pointer"
            >
              <title>{`${point.label}: ${toCurrency(point.value)}`}</title>
            </circle>
          </g>
        ))}
        
        {/* Y-axis labels */}
        <text x="10" y={padding} fill="#9CA3AF" fontSize="12" textAnchor="start">
          {toCurrency(maxValue)}
        </text>
        <text x="10" y={height - padding + 5} fill="#9CA3AF" fontSize="12" textAnchor="start">
          {toCurrency(minValue)}
        </text>
      </svg>
      
      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-gray-400 mt-2 px-10">
        {data.map((d, i) => (
          <span key={i} className={i % 2 === 0 ? '' : 'hidden sm:block'}>
            {d.date}
          </span>
        ))}
      </div>
    </div>
  );
};

const TradesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Open Positions');
  const [connections, setConnections] = useState<BybitConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [allOrderHistory, setAllOrderHistory] = useState<OrderHistory[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('7D');

  // Process and fix PnL calculations
  const processedPositions = useMemo(() => {
    return allPositions.map(position => {
      // Ensure PnL is properly calculated
      const entryPrice = Number(position.entryPrice) || 0;
      const currentPrice = Number(position.currentPrice) || 0;
      const amount = Number(position.amount) || 0;
      
      let pnl = Number(position.pnl) || 0;
      let pnlPercent = Number(position.pnlPercent) || 0;
      
      // If PnL is 0, calculate it manually
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

  // Process order history with PnL calculations
  const processedOrderHistory = useMemo(() => {
    return allOrderHistory.map(order => {
      // Ensure PnL is properly calculated for closed orders
      const entryPrice = Number(order.entryPrice) || 0;
      const currentPrice = Number(order.currentPrice) || Number(order.entryPrice) || 0;
      const amount = Number(order.amount) || 0;
      
      let pnl = Number(order.pnl) || 0;
      let pnlPercent = Number(order.pnlPercent) || 0;
      
      // For closed trades, calculate PnL if it's 0
      if (order.status === 'CLOSED' && pnl === 0 && entryPrice > 0 && currentPrice > 0 && amount > 0) {
        if (order.direction === 'LONG') {
          pnl = (currentPrice - entryPrice) * amount;
        } else {
          pnl = (entryPrice - currentPrice) * amount;
        }
        
        pnlPercent = (pnl / (entryPrice * amount)) * 100;
      }
      
      return {
        ...order,
        pnl,
        pnlPercent,
        entryPrice,
        currentPrice,
        amount
      };
    });
  }, [allOrderHistory]);

  // Debug processed order history
  useEffect(() => {
    if (processedOrderHistory.length > 0) {
      console.log('🔄 Processed order history:', processedOrderHistory.slice(0, 2));
      console.log('📈 Closed trades with PnL:', processedOrderHistory.filter(o => o.status === 'CLOSED' && o.pnl !== 0));
    }
  }, [processedOrderHistory]);

  // Get open positions, orders, and closed trades from all connections
  const openPositions = processedPositions.filter(pos => pos.status === 'OPEN');
  const openOrders = processedPositions.filter(pos => pos.status === 'PENDING');
  const closedTrades = processedOrderHistory.filter(order => order.status === 'CLOSED');

  // Calculate totals using real balance data
  const totalBalance = connections.reduce((sum, conn) => {
    return sum + (conn.data?.balance?.total || 0);
  }, 0);
  const totalPnL = openPositions.reduce((sum, trade) => sum + trade.pnl, 0);
  const totalValue = totalBalance + totalPnL;
  const activeConnections = connections.filter(conn => conn.status === "active");

  // Time period configurations
  const periodConfigs = {
    '24h': { hours: 24, intervals: 24, label: '24 Hours' },
    '3D': { days: 3, intervals: 3, label: '3 Days' },
    '7D': { days: 7, intervals: 7, label: '7 Days' },
    '2W': { days: 14, intervals: 14, label: '2 Weeks' },
    '1M': { days: 30, intervals: 30, label: '1 Month' },
    '3M': { days: 90, intervals: 30, label: '3 Months' },
    'ALL': { days: 365, intervals: 52, label: 'All Time' }
  };

  // Generate dynamic PnL data based on selected period
  const dailyPnLData = useMemo(() => {
    const config = periodConfigs[selectedPeriod];
    const data = [];
    const now = new Date();
    const startBalance = totalBalance || 1000;
    let cumulativeBalance = startBalance;
    
    // Calculate step size based on period
    const totalDays = config.days || (config.hours / 24) || 1;
    const intervals = config.intervals;
    const stepSize = totalDays / intervals;
    
    for (let i = intervals - 1; i >= 0; i--) {
      const date = new Date(now);
      
      if (config.hours) {
        // For 24h, go back by hours
        date.setHours(date.getHours() - (i * (config.hours / intervals)));
      } else {
        // For other periods, go back by days
        date.setDate(date.getDate() - (i * stepSize));
      }
      
      // Mock PnL change based on period (would be real data in production)
      let dailyChange;
      if (i === 0) {
        dailyChange = totalPnL; // Current total PnL
      } else {
        // Generate realistic mock changes based on period
        const volatility = selectedPeriod === '24h' ? 20 : selectedPeriod === '3D' ? 50 : 100;
        dailyChange = (Math.random() - 0.5) * volatility;
      }
      
      cumulativeBalance += dailyChange;
      
      // Format date based on period
      let dateLabel;
      if (config.hours) {
        dateLabel = date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
      } else if (totalDays <= 14) {
        dateLabel = date.toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });
      } else {
        dateLabel = date.toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });
      }
      
      data.push({
        date: dateLabel,
        value: cumulativeBalance,
        label: date.toLocaleDateString('nl-NL', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          ...(config.hours && { hour: '2-digit', minute: '2-digit' })
        })
      });
    }
    
    return data;
  }, [totalBalance, totalPnL, selectedPeriod]);

  // Calculate period change (dynamic based on selected period)
  const periodChange = useMemo(() => {
    if (dailyPnLData.length < 2) return { amount: 0, percent: 0 };
    
    const startValue = dailyPnLData[0].value;
    const endValue = dailyPnLData[dailyPnLData.length - 1].value;
    const amount = endValue - startValue;
    const percent = startValue > 0 ? (amount / startValue) * 100 : 0;
    
    return { amount, percent };
  }, [dailyPnLData]);

  // Fetch live ByBit data
  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('🔄 Fetching live ByBit connections...');
      const response = await bybitApi.getConnections();
      
      if (response.success) {
        // Map the response to match our interface
        const mappedConnections: BybitConnection[] = response.connections.map(conn => ({
          connectionId: conn.connectionId || conn.connection_id,
          name: conn.metadata?.name || conn.name || 'Unknown Connection',
          status: conn.status || 'active',
          data: conn.data,
          metadata: conn.metadata || { name: conn.name || 'Unknown', created_at: new Date().toISOString() }
        }));
        setConnections(mappedConnections);
        
        // Combine all positions and order history from all connections
        const allPos: Position[] = [];
        const allOrders: OrderHistory[] = [];
        
        mappedConnections.forEach(conn => {
          if (conn.data?.positions) {
            allPos.push(...conn.data.positions);
          }
          if (conn.data?.orderHistory) {
            allOrders.push(...conn.data.orderHistory);
          }
        });
        
        setAllPositions(allPos);
        setAllOrderHistory(allOrders);
        
        console.log('✅ Loaded', mappedConnections.length, 'connections with', allPos.length, 'positions');
        console.log('📊 Sample position:', allPos[0]); // Debug PnL data
        console.log('📋 Sample order history:', allOrders[0]); // Debug order history data
        console.log('🔒 Total closed trades:', allOrders.filter(o => o.status === 'CLOSED').length);
      } else {
        console.error('❌ Failed to fetch connections');
        // Set empty arrays to prevent errors
        setConnections([]);
        setAllPositions([]);
        setAllOrderHistory([]);
      }
    } catch (error) {
      console.error('❌ Error fetching data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Refresh data function
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const tabs = [
    { name: 'Open Positions', data: openPositions, count: openPositions.length },
    { name: 'Open Orders', data: openOrders, count: openOrders.length },
    { name: 'Closed Trades', data: closedTrades, count: closedTrades.length }
  ];

  const currentData = tabs.find(tab => tab.name === activeTab)?.data || [] as any[];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center py-16">
          <div className="animate-spin text-6xl mb-4">🔄</div>
          <div className="text-white text-xl font-bold">Loading Live ByBit Data...</div>
          <div className="text-gray-400 mt-2">Fetching your positions and trades</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Balance Controls */}
      <div className="flex justify-between items-center mb-6 animate-fadeInUp">
        <div className="flex items-center space-x-4">
          <h1 className="section-title">Live Trading Dashboard</h1>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span>{activeConnections.length} connections active</span>
            <span className="text-green-400">• LIVE DATA</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowBalances(!showBalances)}
            className="btn-secondary"
          >
            <span>{showBalances ? '🙈' : '👁️'}</span>
            <span>{showBalances ? 'Hide' : 'Show'} Balances</span>
          </button>
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-primary disabled:opacity-50"
          >
            <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Connection Balances Section */}
      {connections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 animate-fadeInUp animate-delay-1">
          {connections.map((connection) => (
            <div key={connection.connectionId} className="glass-card-small">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-white text-sm truncate">{connection.metadata?.name || 'ByBit Connection'}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    connection.status === 'active' 
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                  }`}>
                    {connection.status}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mb-3">ByBit • Live</div>
                <div className="text-lg font-bold text-white">
                  {showBalances ? toCurrency(connection.data?.balance?.total || 0) : '●●●●●'}
                </div>
                {showBalances && totalBalance > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    {((connection.data?.balance?.total || 0) / totalBalance * 100).toFixed(1)}% of total
                  </div>
                )}
                {connection.data?.balance && (
                  <div className="text-xs text-gray-500 mt-1">
                    {connection.data.balance.coins?.length || 0} assets
                  </div>
                )}
            </div>
          ))}
        </div>
      )}

      {/* Daily PnL Chart */}
      <div className="glass-card animate-fadeInUp animate-delay-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title text-xl">
              📈 Portfolio Performance
            </h3>
            
            {/* Time Period Selector */}
            <div className="flex items-center space-x-1 bg-gray-900 rounded-lg p-1">
              {Object.entries(periodConfigs).map(([period, config]) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                    selectedPeriod === period
                      ? 'bg-purple-500 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          
          {dailyPnLData.length > 0 ? (
            <SimpleLineChart data={dailyPnLData} />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <div>No historical data available</div>
              </div>
            </div>
          )}
          
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-gray-400">Period Start</div>
              <div className="text-white font-bold">
                {dailyPnLData.length > 0 ? toCurrency(dailyPnLData[0].value) : '-'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {periodConfigs[selectedPeriod].label}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400">Current</div>
              <div className="text-white font-bold">
                {dailyPnLData.length > 0 ? toCurrency(dailyPnLData[dailyPnLData.length - 1].value) : toCurrency(totalValue)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Live Balance
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400">Period Change</div>
              <div className={`font-bold ${periodChange.amount >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {periodChange.amount >= 0 ? '+' : ''}{toCurrency(Math.abs(periodChange.amount))}
              </div>
              <div className={`text-xs mt-1 ${periodChange.percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {periodChange.percent >= 0 ? '+' : ''}{periodChange.percent.toFixed(2)}%
              </div>
            </div>
      </div>

      {/* Header with Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeInUp animate-delay-3">
        <div className="glass-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">Total Portfolio</p>
                <p className="text-3xl font-bold text-white mt-2 drop-shadow-lg">{showBalances ? toCurrency(totalValue) : '●●●●●'}</p>
                <p className="text-sm mt-2 flex items-center font-medium text-green-300">
                  <span className="mr-1">↗️</span> +{totalBalance > 0 ? ((totalPnL / totalBalance) * 100).toFixed(2) : '0.00'}%
                </p>
              </div>
              <div className="text-4xl opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                💰
              </div>
            </div>
        </div>

        <div className="glass-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">Total PnL</p>
                <p className={`text-3xl font-bold mt-2 drop-shadow-lg ${totalPnL >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {showBalances ? (totalPnL >= 0 ? '+' : '') + toCurrency(Math.abs(totalPnL)) : '●●●●●'}
                </p>
                <p className="text-sm mt-2 flex items-center font-medium text-green-300">
                  <span className="mr-1">📈</span> Live
                </p>
              </div>
              <div className="text-4xl opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                📊
              </div>
            </div>
        </div>

        <div className="glass-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">Active Positions</p>
                <p className="text-3xl font-bold text-white mt-2 drop-shadow-lg">{openPositions.length}</p>
                <p className="text-sm mt-2 flex items-center font-medium text-blue-300">
                  <span className="mr-1">🔄</span> Live
                </p>
              </div>
              <div className="text-4xl opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                🎯
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="glass-card-small animate-fadeInUp animate-delay-4">
        <div className="flex space-x-1">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
              activeTab === tab.name
                ? 'btn-primary'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="flex items-center justify-center space-x-2">
              <span>{tab.name}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                activeTab === tab.name 
                  ? 'bg-black/20 text-black' 
                  : 'bg-gray-700 text-gray-300'
              }`}>
                {tab.count}
              </span>
            </span>
          </button>
        ))}
        </div>
      </div>

      {/* Trading Table */}
      <div className="glass-card overflow-hidden animate-fadeInUp animate-delay-5">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-black/20 border-b border-white/10">
                  <th className="px-6 py-4 text-left font-bold text-primary uppercase tracking-wider">Symbol</th>
                  <th className="px-6 py-4 text-left font-bold text-primary uppercase tracking-wider">Direction</th>
                  <th className="px-6 py-4 text-left font-bold text-primary uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-left font-bold text-primary uppercase tracking-wider">Entry</th>
                  <th className="px-6 py-4 text-left font-bold text-primary uppercase tracking-wider">Current</th>
                  <th className="px-6 py-4 text-left font-bold text-primary uppercase tracking-wider">PnL</th>
                  <th className="px-6 py-4 text-left font-bold text-primary uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left font-bold text-primary uppercase tracking-wider">Exchange</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((trade, idx) => (
                  <tr key={`${trade.id}-${idx}`} className="hover:bg-white/5 transition-all duration-300 border-b border-white/5">
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
                          ? 'bg-primary-blue/20 text-primary-blue border border-primary-blue/40'
                          : trade.status === 'PENDING'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : trade.status === 'CANCELLED'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
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
                ))}
              </tbody>
            </table>
          </div>

          {currentData.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-6xl mb-4 opacity-50">📭</div>
              <h3 className="text-xl font-bold text-gray-300 mb-2">No {activeTab}</h3>
              <p className="text-gray-500">Start trading to see your positions here.</p>
              {connections.length === 0 && (
                <p className="text-info-cyan/70 text-sm mt-2">Connect your ByBit account in the API tab first</p>
              )}
            </div>
          )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 pt-6 border-t border-white/10 animate-fadeInUp animate-delay-6">
        <button className="btn-primary">
          <span>📈</span>
          <span>New Position</span>
        </button>
        <button className="btn-primary">
          <span>📋</span>
          <span>Set Order</span>
        </button>
        <button 
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="btn-primary disabled:opacity-50"
        >
          <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
          <span>Refresh Data</span>
        </button>
        <button className="btn-secondary">
          <span>📊</span>
          <span>Export Report</span>
        </button>
      </div>
    </div>
  );
};

export default TradesPage;