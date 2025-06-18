import React, { useState, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { ConnectionData } from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export interface BybitConnection {
  connectionId: string;
  name: string;
  status: string;
  data: ConnectionData;
  metadata: {
    name: string;
    created_at: string;
  };
}

interface PortfolioData {
  totalValue: number;
  change24h: number;
  changePercent: number;
  chartData: { time: string; value: number }[];
}

// Accounts Allocation Section (Left side - exact match to design)
export const AccountsAllocation: React.FC<{ connections: BybitConnection[] }> = ({ connections }) => {
  const [totalValue, setTotalValue] = useState(0);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const calculateTotalValue = useCallback(() => {
    // Calculate total value from all connections
    const total = connections.reduce((sum, conn) => {
      const balance = conn.data?.balance?.total || 0;
      console.log(`Account: ${conn.metadata?.name}, Balance: $${balance}`);
      return sum + balance;
    }, 0);
    console.log(`Total Portfolio Value: $${total}`);
    setTotalValue(total);
  }, [connections]);

  useEffect(() => {
    calculateTotalValue();
    
    // Set up auto-refresh every 10 seconds
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing portfolio values...');
      calculateTotalValue();
    }, 10000); // 10 seconds
    
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [calculateTotalValue]);

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-gray-400 text-sm font-medium mb-6">Accounts allocation</h3>
      
      {/* Circular Chart - match design exactly */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-48 h-48">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(75, 85, 99, 0.3)"
              strokeWidth="2"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeDasharray={`${(totalValue > 0 ? 85 : 0) * 2.827} 282.7`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          
          {/* Center content - exactly like design */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-white">
              ${totalValue.toFixed(2)}
            </div>
            <div className="text-gray-400 text-sm">Total</div>
          </div>
        </div>
      </div>

      {/* Enhanced Account List with Balance and 24h P&L */}
      <div className="space-y-4">
        {connections.map((conn) => {
          const accountBalance = conn.data?.balance?.total || 0;
          const percentage = totalValue > 0 ? (accountBalance / totalValue) * 100 : 0;
          const orderHistory = conn.data?.orderHistory || [];
          
          // Calculate 24h P&L from recent trades
          const now = new Date();
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const trades24h = orderHistory.filter(order => 
            order.status === 'CLOSED' && 
            new Date(order.timestamp) >= yesterday
          );
          const pnl24h = trades24h.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
          const pnlPercentage = accountBalance > 0 ? (pnl24h / accountBalance) * 100 : 0;
          
          return (
            <div key={conn.connectionId} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600"></div>
                  <div>
                    <div className="text-white text-sm font-medium">{conn.metadata?.name || conn.name}</div>
                    <div className="text-gray-400 text-xs">ByBit USDT • {percentage.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white text-sm font-medium">${accountBalance.toFixed(2)}</div>
                  <div className={`text-xs ${pnl24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pnl24h >= 0 ? '+' : ''}{pnl24h.toFixed(2)} ({pnlPercentage >= 0 ? '+' : ''}{pnlPercentage.toFixed(1)}%)
                  </div>
                </div>
              </div>
              <div className="bg-gray-700 rounded-full h-1.5">
                <div 
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, percentage)}%` }}
                />
              </div>
            </div>
          );
        })}
        
        {connections.length === 0 && (
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-gray-600"></div>
            <div className="flex-1">
              <div className="text-gray-500 text-sm">No accounts connected</div>
              <div className="text-gray-600 text-xs">Connect ByBit account to start trading</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Portfolio Change Section (Center - exact match to design)
export const PortfolioChange: React.FC<{ connections: BybitConnection[] }> = ({ connections }) => {
  const [portfolioData, setPortfolioData] = useState<PortfolioData>({
    totalValue: 0,
    change24h: 0,
    changePercent: 0,
    chartData: []
  });
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d');
  
  // Recalculate when timeframe changes
  useEffect(() => {
    calculatePortfolioData();
  }, [selectedTimeframe]);

  const calculatePortfolioData = useCallback(() => {
    if (connections.length === 0) {
      setPortfolioData({
        totalValue: 0,
        change24h: 0,
        changePercent: 0,
        chartData: []
      });
      return;
    }

    // Calculate real portfolio data
    const totalValue = connections.reduce((sum, conn) => {
      const balance = conn.data?.balance?.total || 0;
      console.log(`Portfolio calc - Account: ${conn.metadata?.name}, Balance: $${balance}`);
      return sum + balance;
    }, 0);

    const pnl24h = connections.reduce((sum, conn) => {
      // Calculate PnL from current positions
      const positions = conn.data?.positions || [];
      const positionPnL = positions.reduce((pSum, pos) => pSum + (Number(pos.pnl) || 0), 0);
      console.log(`PnL calc - Account: ${conn.metadata?.name}, Positions: ${positions.length}, PnL: $${positionPnL}`);
      return sum + positionPnL;
    }, 0);

    const changePercent = totalValue > 0 ? (pnl24h / (totalValue - pnl24h)) * 100 : 0;

    // Store portfolio value history for persistence
    const portfolioHistory = JSON.parse(localStorage.getItem('portfolioHistory') || '[]');
    const now = new Date();
    const currentEntry = {
      timestamp: now.toISOString(),
      value: totalValue,
      pnl: pnl24h,
      timeframe: selectedTimeframe
    };
    
    // Keep only last 100 entries to prevent localStorage overflow
    portfolioHistory.push(currentEntry);
    if (portfolioHistory.length > 100) {
      portfolioHistory.shift();
    }
    localStorage.setItem('portfolioHistory', JSON.stringify(portfolioHistory));

    // Generate realistic chart data based on actual portfolio
    const chartData = generatePortfolioChartData(totalValue, pnl24h);

    console.log(`Total Portfolio: $${totalValue}, 24h Change: $${pnl24h} (${changePercent.toFixed(2)}%)`);
    
    setPortfolioData({
      totalValue,
      change24h: pnl24h,
      changePercent,
      chartData
    });
  }, [connections, selectedTimeframe]);

  useEffect(() => {
    calculatePortfolioData();
  }, [calculatePortfolioData]);

  const generatePortfolioChartData = (currentValue: number, change24h: number) => {
    const data = [];
    const points = 24; // 24 hours of data
    const startValue = currentValue - change24h;
    
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      // Linear progression without random variation
      const value = startValue + (change24h * progress);
      
      const time = new Date(Date.now() - (points - 1 - i) * 60 * 60 * 1000);
      data.push({
        time: `${time.getHours()}:00`,
        value: Math.max(0, value)
      });
    }
    return data;
  };

  const chartData = {
    labels: portfolioData.chartData.map(d => d.time),
    datasets: [
      {
        data: portfolioData.chartData.map(d => d.value),
        borderColor: portfolioData.change24h >= 0 ? '#10B981' : '#EF4444',
        backgroundColor: `${portfolioData.change24h >= 0 ? '#10B981' : '#EF4444'}20`,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: portfolioData.change24h >= 0 ? '#10B981' : '#EF4444',
        borderWidth: 1,
        displayColors: false,
      }
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: { color: '#9CA3AF', fontSize: 10 }
      },
      y: {
        display: false,
        grid: { display: false }
      }
    }
  };

  const timeframes = [
    { key: '1d', label: '1d' },
    { key: '3d', label: '3d' },
    { key: '1w', label: '1w' },
    { key: '1m', label: '1m' },
    { key: '3m', label: '3m' },
    { key: '1y', label: '1y' }
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      {/* Header with timeframe buttons - exact match to design */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">Portfolio Change</h3>
          <div className="flex items-center space-x-3">
            <span className={`text-2xl font-bold ${portfolioData.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {portfolioData.change24h >= 0 ? '+' : ''}${portfolioData.change24h.toFixed(2)}
            </span>
            <span className={`text-sm ${portfolioData.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {portfolioData.changePercent >= 0 ? '+' : ''}{portfolioData.changePercent.toFixed(2)}%
              {portfolioData.change24h < 0 && ' ↓'}
            </span>
          </div>
        </div>
        
        <div className="flex bg-gray-900 rounded-lg p-1">
          {timeframes.map((tf) => (
            <button
              key={tf.key}
              onClick={() => setSelectedTimeframe(tf.key)}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                selectedTimeframe === tf.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart - exact styling as design */}
      <div className="h-48">
        {portfolioData.chartData.length > 0 ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-sm">No portfolio data</div>
              <div className="text-xs mt-1">Connect accounts to view performance</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Live Positions Section (Right side - replacing filters)
export const LivePositionsSection: React.FC<{ connections: BybitConnection[] }> = ({ connections }) => {
  const [allPositions, setAllPositions] = useState<any[]>([]);

  useEffect(() => {
    // Collect all live positions from connections
    const positions: any[] = [];
    connections.forEach(conn => {
      if (conn.data?.positions) {
        conn.data.positions.forEach((pos: any) => {
          if (pos.status === 'OPEN' || pos.amount > 0) {
            positions.push({
              ...pos,
              accountName: conn.metadata?.name || conn.name,
              connectionId: conn.connectionId
            });
          }
        });
      }
    });
    setAllPositions(positions);
  }, [connections]);

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-medium">Live Positions</h3>
        <span className="text-blue-400 text-sm">{allPositions.length} Active</span>
      </div>

      {allPositions.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4 opacity-50">📊</div>
          <div className="text-gray-400 text-lg">No open positions</div>
          <div className="text-gray-500 text-sm mt-2">Start trading to see live positions</div>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {allPositions.map((position, index) => (
            <div key={`${position.connectionId}-${position.symbol}-${index}`} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    position.direction === 'LONG' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  <span className="font-bold text-white">{position.symbol}</span>
                  <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300">
                    {position.direction}
                  </span>
                </div>
                <div className={`text-sm font-bold ${
                  position.pnl >= 0 ? 'text-green-300' : 'text-red-300'
                }`}>
                  {position.pnl >= 0 ? '+' : ''}${Number(position.pnl || 0).toFixed(2)}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div>
                  <div className="text-gray-400">Size</div>
                  <div className="text-white font-medium">{Number(position.amount || 0).toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Entry</div>
                  <div className="text-white font-medium">${Number(position.entryPrice || 0).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Current</div>
                  <div className="text-white font-medium">${Number(position.currentPrice || position.markPrice || 0).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Leverage</div>
                  <div className="text-orange-400 font-bold">{position.leverage || '1'}x</div>
                </div>
                <div>
                  <div className="text-gray-400">Liquidation</div>
                  <div className="text-red-400 font-medium">${Number(position.liquidationPrice || 0).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Account</div>
                  <div className="text-gray-300 font-medium truncate">{position.accountName}</div>
                </div>
              </div>

              {/* Opening time and duration */}
              <div className="mt-2 pt-2 border-t border-gray-700/30">
                <div className="flex items-center justify-between text-xs">
                  <div className="text-gray-400">
                    {position.timestamp ? (
                      <>
                        Opened: {new Date(position.timestamp).toLocaleDateString()} {new Date(position.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </>
                    ) : (
                      'Opening time unknown'
                    )}
                  </div>
                  <div className="text-gray-500">
                    {position.timestamp && (
                      <>
                        {(() => {
                          const openTime = new Date(position.timestamp);
                          const now = new Date();
                          const diffMs = now.getTime() - openTime.getTime();
                          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                          const diffDays = Math.floor(diffHours / 24);
                          
                          if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
                          if (diffHours > 0) return `${diffHours}h ${Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))}m`;
                          return `${Math.floor(diffMs / (1000 * 60))}m`;
                        })()}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Recent Closed Trades Section - Fancy new component
export const RecentClosedTrades: React.FC<{ connections: BybitConnection[] }> = ({ connections }) => {
  const [recentTrades, setRecentTrades] = useState<any[]>([]);

  useEffect(() => {
    // Collect all closed trades from all connections
    const allTrades: any[] = [];
    
    connections.forEach(conn => {
      if (conn.data?.orderHistory) {
        conn.data.orderHistory.forEach((trade: any) => {
          if (trade.status === 'CLOSED' || trade.status === 'FILLED') {
            allTrades.push({
              ...trade,
              accountName: conn.metadata?.name || conn.name,
              connectionId: conn.connectionId
            });
          }
        });
      }
    });

    // Sort by timestamp (newest first) and take last 25
    const sortedTrades = allTrades
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 25);
    
    setRecentTrades(sortedTrades);
  }, [connections]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'Just now';
  };

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50 shadow-2xl backdrop-blur-sm">
      {/* Header with glass effect */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
            <span className="text-white text-sm font-bold">📊</span>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Recent Closed Trades</h3>
            <p className="text-gray-400 text-sm">Last 25 completed trades across all accounts</p>
          </div>
        </div>
        <div className="bg-gray-700/50 backdrop-blur-sm rounded-lg px-3 py-1 border border-gray-600/30">
          <span className="text-gray-300 text-sm font-medium">{recentTrades.length} trades</span>
        </div>
      </div>

      {/* Trades List with fancy styling */}
      <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
        {recentTrades.length > 0 ? (
          recentTrades.map((trade, index) => {
            const pnl = Number(trade.pnl) || 0;
            const amount = Number(trade.amount) || 0;
            const price = Number(trade.entryPrice || trade.price) || 0;
            const value = amount * price;
            
            return (
              <div 
                key={`${trade.connectionId}-${trade.orderId || index}`}
                className="group relative bg-gradient-to-r from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/30 rounded-lg p-3 hover:from-gray-700/60 hover:to-gray-800/60 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10"
              >
                {/* Animated gradient background on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                
                <div className="relative flex items-center justify-between text-sm">
                  {/* Left side - Symbol and direction */}
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full ${trade.direction === 'LONG' || trade.side === 'Buy' ? 'bg-green-400' : 'bg-red-400'} shadow-lg`}></div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-medium">{trade.symbol || 'Unknown'}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          trade.direction === 'LONG' || trade.side === 'Buy' 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {trade.direction || trade.side || 'Unknown'}
                        </span>
                      </div>
                      <div className="text-gray-400 text-xs">{trade.accountName}</div>
                    </div>
                  </div>

                  {/* Center - Trade details */}
                  <div className="flex items-center space-x-6 text-xs">
                    <div className="text-center">
                      <div className="text-gray-400">Amount</div>
                      <div className="text-white font-medium">{amount.toFixed(4)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400">Price</div>
                      <div className="text-white font-medium">${price.toFixed(2)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400">Value</div>
                      <div className="text-white font-medium">${value.toFixed(2)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400">P&L</div>
                      <div className={`font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Right side - Time and status */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-gray-300 font-medium">{formatTime(trade.timestamp)}</div>
                    <div className="text-gray-500 text-xs">{new Date(trade.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </div>
                </div>

                {/* Subtle border gradient on hover */}
                <div className="absolute inset-0 rounded-lg border border-transparent bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-700 to-gray-600 flex items-center justify-center">
              <span className="text-2xl">📈</span>
            </div>
            <div className="text-gray-400 text-lg font-medium">No trades yet</div>
            <div className="text-gray-500 text-sm mt-1">Start trading to see your trade history here</div>
          </div>
        )}
      </div>

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(75, 85, 99, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b5cf6, #3b82f6);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #7c3aed, #2563eb);
        }
      `}</style>
    </div>
  );
};

// Filters Section (Right side - exact match to design) - DEPRECATED, keeping for reference
export const FiltersSection: React.FC = () => {
  const [exchanges, setExchanges] = useState([
    { name: 'ByBit USDT', checked: true, clients: 1 }
  ]);
  
  const [accounts, setAccounts] = useState([
    { name: 'Crypto Opulence - USDT', exchange: 'ByBit USDT', checked: true }
  ]);

  const [statusFilters, setStatusFilters] = useState([
    { name: 'Active', checked: true },
    { name: 'Inactive', checked: true },
    { name: 'Invalid', checked: true }
  ]);

  const toggleExchange = (index: number) => {
    setExchanges(prev => prev.map((ex, i) => 
      i === index ? { ...ex, checked: !ex.checked } : ex
    ));
  };

  const toggleAccount = (index: number) => {
    setAccounts(prev => prev.map((acc, i) => 
      i === index ? { ...acc, checked: !acc.checked } : acc
    ));
  };

  const toggleStatus = (index: number) => {
    setStatusFilters(prev => prev.map((status, i) => 
      i === index ? { ...status, checked: !status.checked } : status
    ));
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-medium">Filters</h3>
        <button className="text-blue-400 text-sm hover:text-blue-300">Reset</button>
      </div>

      {/* Exchanges section */}
      <div className="mb-6">
        <h4 className="text-gray-400 text-sm font-medium mb-3">Exchanges</h4>
        <div className="space-y-2">
          {exchanges.map((exchange, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={exchange.checked}
                  onChange={() => toggleExchange(index)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-600 bg-gray-700"
                />
                <span className="text-white text-sm">{exchange.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 text-xs">{exchange.clients} Client</span>
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Accounts section */}
      <div className="mb-6">
        <h4 className="text-gray-400 text-sm font-medium mb-3">Accounts</h4>
        <div className="space-y-2">
          {accounts.map((account, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={account.checked}
                  onChange={() => toggleAccount(index)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-600 bg-gray-700"
                />
                <div>
                  <div className="text-white text-sm">{account.name}</div>
                  <div className="text-gray-400 text-xs">{account.exchange}</div>
                </div>
              </div>
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Status section */}
      <div>
        <h4 className="text-gray-400 text-sm font-medium mb-3">Status</h4>
        <div className="space-y-2">
          {statusFilters.map((status, index) => (
            <div key={index} className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={status.checked}
                onChange={() => toggleStatus(index)}
                className="w-4 h-4 text-blue-600 rounded border-gray-600 bg-gray-700"
              />
              <span className="text-white text-sm">{status.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};