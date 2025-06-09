import React, { useState, useMemo } from 'react';
import TradingChart from './TradingChart';
import { GlassCard, GlassButton } from './GlassCard';

interface Trade {
  id: string;
  date: string;
  time: string;
  symbol: string;
  side: 'Buy' | 'Sell';
  quantity: number;
  price: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  fees: number;
  netPnl: number;
  cumulativePnl: number;
  drawdown: number;
  runUp: number;
  mfe: number; // Maximum Favorable Excursion
  mae: number; // Maximum Adverse Excursion
  duration: string;
  entryReason: string;
  exitReason: string;
  tags: string[];
}

interface BacktestResults {
  summary: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnl: number;
    totalPnlPercent: number;
    grossProfit: number;
    grossLoss: number;
    profitFactor: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    maxRunUp: number;
    avgWin: number;
    avgLoss: number;
    avgWinPercent: number;
    avgLossPercent: number;
    largestWin: number;
    largestLoss: number;
    avgTradeDuration: string;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    totalFees: number;
    buyHoldReturn: number;
    alpha: number;
    beta: number;
    correlation: number;
  };
  trades: Trade[];
  equityCurve: Array<{
    date: string;
    equity: number;
    drawdown: number;
    runup: number;
  }>;
  monthlyReturns: Array<{
    month: string;
    return: number;
    trades: number;
  }>;
}

interface AdvancedBacktestProps {
  results?: BacktestResults;
  isLoading?: boolean;
  symbol?: string;
  strategy?: string;
}

export const AdvancedBacktest: React.FC<AdvancedBacktestProps> = ({ 
  results, 
  isLoading = false,
  symbol = 'BTCUSDT',
  strategy = 'AI Strategy'
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'analysis' | 'monthly'>('overview');
  const [tradeFilter, setTradeFilter] = useState<'all' | 'winning' | 'losing'>('all');
  const [sortBy, setSortBy] = useState<keyof Trade>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Generate mock data if no results provided
  const mockResults: BacktestResults = useMemo(() => {
    const trades: Trade[] = [];
    let cumulativePnl = 0;
    let equity = 10000;
    let maxEquity = 10000;
    let maxDrawdown = 0;

    // Generate 150 realistic trades over 6 months
    for (let i = 0; i < 150; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (150 - i) * 1.2); // Spread trades over ~6 months
      
      const isWin = Math.random() > 0.35; // 65% win rate
      const quantity = Math.random() * 0.5 + 0.1; // 0.1 to 0.6 BTC
      const price = 45000 + Math.random() * 20000; // $45k - $65k range
      const value = quantity * price;
      
      let pnl: number;
      if (isWin) {
        pnl = value * (Math.random() * 0.08 + 0.01); // 1-9% profit
      } else {
        pnl = -value * (Math.random() * 0.06 + 0.01); // 1-7% loss
      }
      
      const pnlPercent = (pnl / value) * 100;
      const fees = value * 0.001; // 0.1% fees
      const netPnl = pnl - fees;
      cumulativePnl += netPnl;
      equity += netPnl;
      
      maxEquity = Math.max(maxEquity, equity);
      const currentDrawdown = (maxEquity - equity) / maxEquity * 100;
      maxDrawdown = Math.max(maxDrawdown, currentDrawdown);

      const entryReasons = ['MACD Bullish Cross', 'RSI Oversold', 'Support Bounce', 'Breakout Pattern', 'AI Signal'];
      const exitReasons = ['Take Profit', 'Stop Loss', 'Time Exit', 'Reversal Signal', 'AI Exit'];

      trades.push({
        id: `trade-${i + 1}`,
        date: date.toISOString().split('T')[0],
        time: date.toTimeString().split(' ')[0],
        symbol: symbol,
        side: Math.random() > 0.5 ? 'Buy' : 'Sell',
        quantity: parseFloat(quantity.toFixed(6)),
        price: parseFloat(price.toFixed(2)),
        value: parseFloat(value.toFixed(2)),
        pnl: parseFloat(pnl.toFixed(2)),
        pnlPercent: parseFloat(pnlPercent.toFixed(3)),
        fees: parseFloat(fees.toFixed(2)),
        netPnl: parseFloat(netPnl.toFixed(2)),
        cumulativePnl: parseFloat(cumulativePnl.toFixed(2)),
        drawdown: parseFloat(currentDrawdown.toFixed(2)),
        runUp: parseFloat((Math.random() * 5).toFixed(2)),
        mfe: parseFloat((Math.abs(pnl) * (1 + Math.random() * 0.5)).toFixed(2)),
        mae: parseFloat((Math.abs(pnl) * Math.random() * 0.8).toFixed(2)),
        duration: `${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`,
        entryReason: entryReasons[Math.floor(Math.random() * entryReasons.length)],
        exitReason: exitReasons[Math.floor(Math.random() * exitReasons.length)],
        tags: ['Backtest', 'AI', Math.random() > 0.5 ? 'High-Conf' : 'Low-Conf']
      });
    }

    const winningTrades = trades.filter(t => t.netPnl > 0);
    const losingTrades = trades.filter(t => t.netPnl <= 0);
    const totalPnl = cumulativePnl;
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.netPnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnl, 0));

    return {
      summary: {
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: (winningTrades.length / trades.length) * 100,
        totalPnl: totalPnl,
        totalPnlPercent: (totalPnl / 10000) * 100,
        grossProfit: grossProfit,
        grossLoss: grossLoss,
        profitFactor: grossProfit / grossLoss,
        maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
        maxDrawdownPercent: parseFloat(maxDrawdown.toFixed(2)),
        maxRunUp: parseFloat((Math.random() * 15 + 5).toFixed(2)),
        avgWin: grossProfit / winningTrades.length,
        avgLoss: grossLoss / losingTrades.length,
        avgWinPercent: winningTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / winningTrades.length,
        avgLossPercent: Math.abs(losingTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / losingTrades.length),
        largestWin: Math.max(...winningTrades.map(t => t.netPnl)),
        largestLoss: Math.min(...losingTrades.map(t => t.netPnl)),
        avgTradeDuration: '8h 24m',
        sharpeRatio: parseFloat((Math.random() * 2 + 1).toFixed(2)),
        sortinoRatio: parseFloat((Math.random() * 3 + 1.5).toFixed(2)),
        calmarRatio: parseFloat((Math.random() * 1.5 + 0.8).toFixed(2)),
        totalFees: trades.reduce((sum, t) => sum + t.fees, 0),
        buyHoldReturn: parseFloat((Math.random() * 20 + 10).toFixed(2)),
        alpha: parseFloat((Math.random() * 10 + 2).toFixed(2)),
        beta: parseFloat((Math.random() * 0.4 + 0.8).toFixed(2)),
        correlation: parseFloat((Math.random() * 0.2 + 0.7).toFixed(2))
      },
      trades: trades,
      equityCurve: trades.map(t => ({
        date: t.date,
        equity: 10000 + t.cumulativePnl,
        drawdown: t.drawdown,
        runup: t.runUp
      })),
      monthlyReturns: [
        { month: 'Jan 2024', return: 8.5, trades: 25 },
        { month: 'Feb 2024', return: -2.1, trades: 23 },
        { month: 'Mar 2024', return: 12.3, trades: 28 },
        { month: 'Apr 2024', return: 6.7, trades: 24 },
        { month: 'May 2024', return: -4.2, trades: 22 },
        { month: 'Jun 2024', return: 15.1, trades: 28 }
      ]
    };
  }, [symbol]);

  const backtestData = results || mockResults;

  const filteredTrades = useMemo(() => {
    let filtered = backtestData.trades;
    
    if (tradeFilter === 'winning') {
      filtered = filtered.filter(t => t.netPnl > 0);
    } else if (tradeFilter === 'losing') {
      filtered = filtered.filter(t => t.netPnl <= 0);
    }

    return filtered.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const multiplier = sortOrder === 'asc' ? 1 : -1;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * multiplier;
      }
      return String(aVal).localeCompare(String(bVal)) * multiplier;
    });
  }, [backtestData.trades, tradeFilter, sortBy, sortOrder]);

  const handleSort = (column: keyof Trade) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  if (isLoading) {
    return (
      <GlassCard className="animate-fadeInUp" variant="accent" size="lg">
        <div className="text-center py-16">
          <div className="animate-spin text-6xl mb-4">⚡</div>
          <h3 className="text-xl font-bold text-white mb-2">Running Advanced Backtest</h3>
          <p className="text-info-cyan">Analyzing {strategy} on {symbol}...</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Header */}
      <GlassCard variant="accent">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title mb-2">📈 Advanced Backtest Results</h2>
            <p className="text-info-cyan-light">
              Strategy: <span className="text-white font-semibold">{strategy}</span> • 
              Symbol: <span className="text-white font-semibold">{symbol}</span> • 
              Period: <span className="text-white font-semibold">6 Months</span>
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary-blue">
              {backtestData.summary.totalPnlPercent >= 0 ? '+' : ''}
              {backtestData.summary.totalPnlPercent.toFixed(2)}%
            </div>
            <div className="text-info-cyan text-sm">Total Return</div>
          </div>
        </div>
      </GlassCard>

      {/* Tab Navigation */}
      <GlassCard variant="default" size="sm">
        <div className="flex space-x-2">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'trades', label: 'Trade List', icon: '📋' },
            { id: 'analysis', label: 'Analysis', icon: '🔬' },
            { id: 'monthly', label: 'Monthly', icon: '📅' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center space-x-2 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-primary-blue to-primary-blue-dark text-white shadow-lg'
                  : 'text-info-cyan-light hover:text-white hover:bg-primary-blue/10'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Key Metrics */}
          <GlassCard variant="default">
            <h3 className="section-title mb-6">📈 Performance Metrics</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-info-cyan">Total Trades:</span>
                  <span className="text-white font-semibold">{backtestData.summary.totalTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-info-cyan">Win Rate:</span>
                  <span className="text-success-green-light font-semibold">
                    {backtestData.summary.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-info-cyan">Profit Factor:</span>
                  <span className="text-white font-semibold">
                    {backtestData.summary.profitFactor.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-info-cyan">Max Drawdown:</span>
                  <span className="text-danger-red-light font-semibold">
                    -{backtestData.summary.maxDrawdown.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-info-cyan">Sharpe Ratio:</span>
                  <span className="text-white font-semibold">
                    {backtestData.summary.sharpeRatio.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-info-cyan">Gross Profit:</span>
                  <span className="text-success-green-light font-semibold">
                    ${backtestData.summary.grossProfit.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-info-cyan">Gross Loss:</span>
                  <span className="text-danger-red-light font-semibold">
                    -${backtestData.summary.grossLoss.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-info-cyan">Avg Win:</span>
                  <span className="text-success-green-light font-semibold">
                    ${backtestData.summary.avgWin.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-info-cyan">Avg Loss:</span>
                  <span className="text-danger-red-light font-semibold">
                    -${backtestData.summary.avgLoss.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-info-cyan">Total Fees:</span>
                  <span className="text-accent-orange font-semibold">
                    ${backtestData.summary.totalFees.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Equity Curve Chart */}
          <GlassCard variant="success">
            <h3 className="section-title mb-4">💰 Equity Curve</h3>
            <TradingChart 
              variant="portfolio"
              height={300}
              data={backtestData.equityCurve.map(point => ({
                time: point.date,
                value: point.equity
              }))}
            />
          </GlassCard>
        </div>
      )}

      {activeTab === 'trades' && (
        <GlassCard variant="default" size="lg">
          {/* Trade Filters */}
          <div className="p-6 border-b border-primary-blue/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h3 className="section-title">📋 Trade List ({filteredTrades.length})</h3>
                <div className="flex space-x-2">
                  {[
                    { id: 'all', label: 'All Trades' },
                    { id: 'winning', label: 'Winners' },
                    { id: 'losing', label: 'Losers' }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setTradeFilter(filter.id as any)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        tradeFilter === filter.id
                          ? 'bg-primary-blue text-white'
                          : 'text-info-cyan-light hover:bg-primary-blue/10'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-sm text-info-cyan">
                Click column headers to sort
              </div>
            </div>
          </div>

          {/* Trade Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/20 border-b border-primary-blue/20">
                <tr>
                  {[
                    { key: 'date', label: 'Date' },
                    { key: 'time', label: 'Time' },
                    { key: 'side', label: 'Side' },
                    { key: 'quantity', label: 'Quantity' },
                    { key: 'price', label: 'Price' },
                    { key: 'value', label: 'Value' },
                    { key: 'netPnl', label: 'Net P&L' },
                    { key: 'pnlPercent', label: 'P&L %' },
                    { key: 'cumulativePnl', label: 'Cumulative' },
                    { key: 'duration', label: 'Duration' },
                    { key: 'entryReason', label: 'Entry Reason' }
                  ].map((column) => (
                    <th
                      key={column.key}
                      onClick={() => handleSort(column.key as keyof Trade)}
                      className="px-4 py-3 text-left font-semibold text-primary-blue uppercase tracking-wider cursor-pointer hover:bg-primary-blue/10 transition-all"
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column.label}</span>
                        {sortBy === column.key && (
                          <span className="text-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade, index) => (
                  <tr
                    key={trade.id}
                    className={`border-b border-gray-800/30 hover:bg-primary-blue/5 transition-all ${
                      index % 2 === 0 ? 'bg-black/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-white font-medium">{trade.date}</td>
                    <td className="px-4 py-3 text-info-cyan">{trade.time}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        trade.side === 'Buy' 
                          ? 'bg-success-green/20 text-success-green-light'
                          : 'bg-danger-red/20 text-danger-red-light'
                      }`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white">{trade.quantity}</td>
                    <td className="px-4 py-3 text-white">${trade.price.toLocaleString()}</td>
                    <td className="px-4 py-3 text-white">${trade.value.toLocaleString()}</td>
                    <td className={`px-4 py-3 font-semibold ${
                      trade.netPnl >= 0 ? 'text-success-green-light' : 'text-danger-red-light'
                    }`}>
                      {trade.netPnl >= 0 ? '+' : ''}${trade.netPnl.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 font-semibold ${
                      trade.pnlPercent >= 0 ? 'text-success-green-light' : 'text-danger-red-light'
                    }`}>
                      {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                    </td>
                    <td className={`px-4 py-3 font-semibold ${
                      trade.cumulativePnl >= 0 ? 'text-success-green-light' : 'text-danger-red-light'
                    }`}>
                      {trade.cumulativePnl >= 0 ? '+' : ''}${trade.cumulativePnl.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-info-cyan">{trade.duration}</td>
                    <td className="px-4 py-3 text-white text-xs">{trade.entryReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {activeTab === 'analysis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard variant="accent">
            <h3 className="section-title mb-4">🔬 Risk Analysis</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-info-cyan">Sortino Ratio:</span>
                <span className="text-white font-semibold">{backtestData.summary.sortinoRatio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-info-cyan">Calmar Ratio:</span>
                <span className="text-white font-semibold">{backtestData.summary.calmarRatio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-info-cyan">Alpha:</span>
                <span className="text-white font-semibold">{backtestData.summary.alpha}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-info-cyan">Beta:</span>
                <span className="text-white font-semibold">{backtestData.summary.beta}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-info-cyan">Correlation:</span>
                <span className="text-white font-semibold">{backtestData.summary.correlation}</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard variant="success">
            <h3 className="section-title mb-4">📊 Trade Distribution</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-success-green-light">Winning Trades</span>
                  <span className="text-white">{backtestData.summary.winningTrades}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div 
                    className="bg-success-green h-2 rounded-full" 
                    style={{ width: `${backtestData.summary.winRate}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-danger-red-light">Losing Trades</span>
                  <span className="text-white">{backtestData.summary.losingTrades}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div 
                    className="bg-danger-red h-2 rounded-full" 
                    style={{ width: `${100 - backtestData.summary.winRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === 'monthly' && (
        <GlassCard variant="default">
          <h3 className="section-title mb-6">📅 Monthly Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {backtestData.monthlyReturns.map((month) => (
              <GlassCard key={month.month} variant="default" size="sm">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-white">{month.month}</h4>
                  <span className="text-xs text-info-cyan">{month.trades} trades</span>
                </div>
                <div className={`text-2xl font-bold ${
                  month.return >= 0 ? 'text-success-green-light' : 'text-danger-red-light'
                }`}>
                  {month.return >= 0 ? '+' : ''}{month.return.toFixed(1)}%
                </div>
              </GlassCard>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default AdvancedBacktest;