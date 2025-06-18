import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { bybitApi } from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface BacktestData {
  totalPnL: number;
  totalPnLPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  totalTrades: number;
  profitableTrades: number;
  profitableTradesPercent: number;
  unprofitableTrades: number;
  profitFactor: number;
  equityCurve: { x: number; y: number }[];
  drawdownBars: { x: number; y: number }[];
  trades: {
    id: number;
    entryTime: string;
    exitTime: string;
    direction: 'Long' | 'Short';
    quantity: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    commission: number;
  }[];
  // Additional calculated metrics
  avgWinPercent?: number;
  avgLossPercent?: number;
  sharpeRatio?: number;
}

interface TradingViewBacktestProps {
  data?: BacktestData;
  onClose?: () => void;
  strategyName?: string;
  isLoading?: boolean;
  compact?: boolean;
}

const TradingViewBacktest: React.FC<TradingViewBacktestProps> = ({ 
  data, 
  onClose, 
  strategyName = "5-Minute Scalping Strategy with Step TP",
  isLoading = false,
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState<'performance' | 'trades' | 'risk'>('performance');
  const [isDeepBacktesting, setIsDeepBacktesting] = useState(false);
  const [backtestData, setBacktestData] = useState<BacktestData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Generate real backtest data from actual trading history
  const generateBacktestData = async (): Promise<BacktestData> => {
    try {
      // Get real trading data from ByBit connections
      const response = await bybitApi.getConnections();
      
      if (response.success && response.connections.length > 0) {
        console.log('📊 Using real trading data for backtest');
        
        // Combine all order history from all accounts
        const allTrades: any[] = [];
        let totalBalance = 0;
        
        response.connections.forEach(conn => {
          if (conn.data?.orderHistory) {
            const accountTrades = conn.data.orderHistory
              .filter(order => order.status === 'CLOSED')
              .map(order => ({
                ...order,
                accountName: conn.metadata?.name || conn.connectionId || 'Unknown'
              }));
            allTrades.push(...accountTrades);
          }
          totalBalance += conn.data?.balance?.total || 0;
        });
        
        console.log(`📈 Found ${allTrades.length} real trades from ${response.connections.length} accounts`);
        
        if (allTrades.length > 0) {
          // Sort by timestamp
          allTrades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          
          // Calculate real metrics
          const profitableTrades = allTrades.filter(trade => (Number(trade.pnl) || 0) > 0);
          const unprofitableTrades = allTrades.filter(trade => (Number(trade.pnl) || 0) <= 0);
          const totalPnL = allTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
          const totalPnLPercent = totalBalance > 0 ? (totalPnL / totalBalance) * 100 : 0;
          
          const grossProfit = Math.max(0, profitableTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0));
          const grossLoss = Math.max(0, Math.abs(unprofitableTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0)));
          const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 10 : 1);
          
          // Generate equity curve from real trades
          const equityCurve: { x: number; y: number }[] = [];
          let runningEquity = 1000; // Starting equity for visualization
          
          allTrades.forEach((trade, index) => {
            const pnl = Number(trade.pnl) || 0;
            runningEquity += pnl;
            equityCurve.push({ x: index, y: runningEquity });
          });
          
          // Calculate max drawdown
          let maxEquity = 1000;
          let maxDrawdown = 0;
          equityCurve.forEach(point => {
            maxEquity = Math.max(maxEquity, point.y);
            const drawdown = maxEquity - point.y;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
          });
          
          // Calculate additional metrics from real trades
          const avgWin = profitableTrades.length > 0 ? 
            profitableTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0) / profitableTrades.length : 0;
          const avgLoss = unprofitableTrades.length > 0 ?
            Math.abs(unprofitableTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0) / unprofitableTrades.length) : 0;
          
          const avgWinPercent = avgWin > 0 && totalBalance > 0 ? (avgWin / totalBalance) * 100 : 0;
          const avgLossPercent = avgLoss > 0 && totalBalance > 0 ? (avgLoss / totalBalance) * 100 : 0;
          
          // Calculate Sharpe ratio safely
          const returns = allTrades.map(trade => Number(trade.pnl) || 0);
          let sharpeRatio = 0;
          
          if (returns.length > 1) {
            const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
            const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / (returns.length - 1);
            const stdDev = Math.sqrt(variance);
            
            if (stdDev > 0 && totalBalance > 0) {
              const avgReturnPercent = (avgReturn / totalBalance) * 100;
              sharpeRatio = Math.max(-5, Math.min(5, avgReturnPercent / stdDev)); // Clamp between -5 and 5
            }
          }
          
          return {
            totalPnL,
            totalPnLPercent,
            maxDrawdown: -maxDrawdown,
            maxDrawdownPercent: maxEquity > 0 ? -(maxDrawdown / maxEquity) * 100 : 0,
            totalTrades: allTrades.length,
            profitableTrades: profitableTrades.length,
            profitableTradesPercent: (profitableTrades.length / allTrades.length) * 100,
            unprofitableTrades: unprofitableTrades.length,
            profitFactor,
            equityCurve,
            drawdownBars: equityCurve.map((point, i) => ({
              x: i,
              y: point.y < (equityCurve[Math.max(0, i-1)]?.y || point.y) ? 
                  -(point.y - (equityCurve[Math.max(0, i-1)]?.y || point.y)) : 0
            })),
            trades: allTrades.slice(0, 20).map((trade, i) => ({
              id: i + 1,
              entryTime: new Date(trade.timestamp).toISOString(),
              exitTime: new Date(Number(trade.timestamp) + 300000).toISOString(),
              direction: trade.direction === 'LONG' ? 'Long' : 'Short',
              quantity: Number(trade.amount) || 0,
              entryPrice: Number(trade.entryPrice) || 0,
              exitPrice: Number(trade.currentPrice) || Number(trade.entryPrice) || 0,
              pnl: Number(trade.pnl) || 0,
              pnlPercent: Number(trade.pnlPercent) || 0,
              commission: Math.abs(Number(trade.pnl) || 0) * 0.001 // Estimate 0.1% commission
            })),
            // Additional calculated metrics for risk analysis
            avgWinPercent,
            avgLossPercent,
            sharpeRatio: Number(sharpeRatio.toFixed(2))
          };
        }
      }
      
      console.log('⚠️ No real trading data found, using fallback');
      // Fallback to basic structure if no real data
      return {
        totalPnL: 0,
        totalPnLPercent: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        totalTrades: 0,
        profitableTrades: 0,
        profitableTradesPercent: 0,
        unprofitableTrades: 0,
        profitFactor: 1,
        equityCurve: [{ x: 0, y: 1000 }],
        drawdownBars: [],
        trades: [],
        avgWinPercent: 0,
        avgLossPercent: 0,
        sharpeRatio: 0
      };
    } catch (error) {
      console.error('❌ Error fetching real trading data:', error);
      // Return empty data structure on error
      return {
        totalPnL: 0,
        totalPnLPercent: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        totalTrades: 0,
        profitableTrades: 0,
        profitableTradesPercent: 0,
        unprofitableTrades: 0,
        profitFactor: 1,
        equityCurve: [{ x: 0, y: 1000 }],
        drawdownBars: [],
        trades: [],
        avgWinPercent: 0,
        avgLossPercent: 0,
        sharpeRatio: 0
      };
    }
  };

  // Load real data on component mount
  useEffect(() => {
    const loadData = async () => {
      if (data) {
        setBacktestData(data);
        setDataLoading(false);
      } else {
        try {
          const realData = await generateBacktestData();
          setBacktestData(realData);
        } catch (error) {
          console.error('❌ Failed to load backtest data:', error);
          // Set fallback empty data
          setBacktestData({
            totalPnL: 0,
            totalPnLPercent: 0,
            maxDrawdown: 0,
            maxDrawdownPercent: 0,
            totalTrades: 0,
            profitableTrades: 0,
            profitableTradesPercent: 0,
            unprofitableTrades: 0,
            profitFactor: 1,
            equityCurve: [{ x: 0, y: 1000 }],
            drawdownBars: [],
            trades: [],
            avgWinPercent: 0,
            avgLossPercent: 0,
            sharpeRatio: 0
          });
        }
        setDataLoading(false);
      }
    };

    loadData();
  }, [data]);

  // Show loading state
  if (dataLoading || !backtestData) {
    return (
      <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading real trading data...</p>
        </div>
      </div>
    );
  }

  const equityChartData = {
    labels: backtestData.equityCurve.map(p => p.x),
    datasets: [
      {
        label: 'Equity',
        data: backtestData.equityCurve.map(p => p.y),
        borderColor: '#00d4aa',
        backgroundColor: 'rgba(0, 212, 170, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
      }
    ]
  };

  const drawdownChartData = {
    labels: backtestData.drawdownBars.map(p => p.x),
    datasets: [
      {
        label: 'Drawdown',
        data: backtestData.drawdownBars.map(p => p.y),
        backgroundColor: backtestData.drawdownBars.map(p => p.y < 0 ? '#ef4444' : 'transparent'),
        borderColor: '#ef4444',
        borderWidth: 1,
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
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#00d4aa',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
      }
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        position: 'right' as const,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: '#888',
          callback: function(value: any) {
            return value.toFixed(2);
          }
        }
      }
    }
  };

  if (compact) {
    if (dataLoading || !backtestData) {
      return (
        <div className="h-full bg-gray-950 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-sm">Loading...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full bg-gray-950 flex flex-col">
        {/* Compact Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium text-sm">{strategyName}</h3>
            {onClose && (
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Compact Metrics */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-900 p-3 rounded">
              <div className="text-gray-400">Total P&L</div>
              <div className={`font-bold ${backtestData.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {backtestData.totalPnL >= 0 ? '+' : ''}{backtestData.totalPnL.toFixed(2)} USDT
              </div>
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <div className="text-gray-400">Win Rate</div>
              <div className="text-white font-bold">{backtestData.profitableTradesPercent.toFixed(1)}%</div>
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <div className="text-gray-400">Trades</div>
              <div className="text-white font-bold">{backtestData.totalTrades}</div>
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <div className="text-gray-400">Profit Factor</div>
              <div className="text-white font-bold">{backtestData.profitFactor.toFixed(2)}</div>
            </div>
          </div>

          {/* Compact Chart */}
          <div className="bg-gray-900 rounded p-3" style={{ height: '200px' }}>
            <Line data={equityChartData} options={{
              ...chartOptions,
              plugins: { ...chartOptions.plugins, legend: { display: false } }
            }} />
          </div>

          {/* Recent Trades */}
          <div className="bg-gray-900 rounded p-3">
            <h4 className="text-white text-sm font-medium mb-2">Recent Trades</h4>
            <div className="space-y-1 text-xs">
              {backtestData.trades.slice(0, 5).map((trade) => (
                <div key={trade.id} className="flex justify-between items-center py-1">
                  <span className="text-gray-400">{trade.direction}</span>
                  <span className={trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h2 className="text-white font-medium">{strategyName}</h2>
            <button
              onClick={() => setIsDeepBacktesting(!isDeepBacktesting)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
                isDeepBacktesting 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Deep Backtesting {isDeepBacktesting ? '✓' : ''}
            </button>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex space-x-6 mt-4">
          <button
            onClick={() => setActiveTab('performance')}
            className={`pb-2 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'performance'
                ? 'text-white border-blue-500'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Performance
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`pb-2 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'trades'
                ? 'text-white border-blue-500'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Trades analysis
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={`pb-2 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'risk'
                ? 'text-white border-blue-500'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Risk/performance ratios
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-950 p-6">
        {activeTab === 'performance' && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-5 gap-6 mb-6">
              <div>
                <div className="text-gray-500 text-sm mb-1">Total P&L</div>
                <div className={`text-2xl font-bold ${backtestData.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {backtestData.totalPnL >= 0 ? '+' : ''}{backtestData.totalPnL.toFixed(2)} USDT
                </div>
                <div className={`text-sm ${backtestData.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {backtestData.totalPnLPercent >= 0 ? '+' : ''}{backtestData.totalPnLPercent.toFixed(2)}%
                </div>
              </div>
              
              <div>
                <div className="text-gray-500 text-sm mb-1">Max equity drawdown</div>
                <div className="text-2xl font-bold text-red-400">
                  {backtestData.maxDrawdown.toFixed(2)} USDT
                </div>
                <div className="text-sm text-red-400">
                  {backtestData.maxDrawdownPercent.toFixed(2)}%
                </div>
              </div>
              
              <div>
                <div className="text-gray-500 text-sm mb-1">Total trades</div>
                <div className="text-2xl font-bold text-white">
                  {backtestData.totalTrades}
                </div>
              </div>
              
              <div>
                <div className="text-gray-500 text-sm mb-1">Profitable trades</div>
                <div className="text-2xl font-bold text-white">
                  {backtestData.profitableTradesPercent.toFixed(2)}%
                </div>
                <div className="text-sm text-gray-400">
                  {backtestData.profitableTrades}/{backtestData.unprofitableTrades}
                </div>
              </div>
              
              <div>
                <div className="text-gray-500 text-sm mb-1">Profit factor</div>
                <div className="text-2xl font-bold text-white">
                  {backtestData.profitFactor.toFixed(3)}
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="space-y-4">
              {/* Equity Curve */}
              <div className="bg-gray-900 rounded-lg p-4" style={{ height: '300px' }}>
                <Line data={equityChartData} options={chartOptions} />
              </div>
              
              {/* Drawdown */}
              <div className="bg-gray-900 rounded-lg p-4" style={{ height: '150px' }}>
                <Bar data={drawdownChartData} options={{
                  ...chartOptions,
                  scales: {
                    ...chartOptions.scales,
                    y: {
                      ...chartOptions.scales.y,
                      max: 0,
                    }
                  }
                }} />
              </div>
            </div>
          </>
        )}

        {activeTab === 'trades' && (
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Entry Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Exit Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Direction</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Entry Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Exit Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">P&L</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">P&L %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {backtestData.trades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-300">{trade.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {new Date(trade.entryTime).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {new Date(trade.exitTime).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.direction === 'Long' 
                          ? 'bg-green-900/30 text-green-400' 
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {trade.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{trade.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">${trade.entryPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">${trade.exitPrice.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-sm font-medium ${
                      trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium ${
                      trade.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'risk' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-900 rounded-lg p-6">
              <h3 className="text-white font-medium mb-4">Performance Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Sharpe Ratio</span>
                  <span className="text-white font-medium">{backtestData.sharpeRatio || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Profit Factor</span>
                  <span className="text-white font-medium">{backtestData.profitFactor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Return</span>
                  <span className={`font-medium ${backtestData.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {backtestData.totalPnLPercent >= 0 ? '+' : ''}{backtestData.totalPnLPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Win Rate</span>
                  <span className="text-white font-medium">{backtestData.profitableTradesPercent.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Average Win</span>
                  <span className="text-green-400 font-medium">
                    +{backtestData.avgWinPercent ? backtestData.avgWinPercent.toFixed(2) : '0.00'}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Average Loss</span>
                  <span className="text-red-400 font-medium">
                    -{backtestData.avgLossPercent ? backtestData.avgLossPercent.toFixed(2) : '0.00'}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-6">
              <h3 className="text-white font-medium mb-4">Risk Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Drawdown</span>
                  <span className="text-red-400 font-medium">{backtestData.maxDrawdownPercent.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Trades</span>
                  <span className="text-white font-medium">{backtestData.totalTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Winning Trades</span>
                  <span className="text-green-400 font-medium">{backtestData.profitableTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Losing Trades</span>
                  <span className="text-red-400 font-medium">{backtestData.unprofitableTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Drawdown ($)</span>
                  <span className="text-red-400 font-medium">${Math.abs(backtestData.maxDrawdown).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Data Source</span>
                  <span className="text-blue-400 font-medium">Live ByBit</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingViewBacktest;