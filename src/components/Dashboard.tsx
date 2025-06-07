// Dashboard.tsx
import React from 'react';

interface Trade {
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

interface Strategy {
  id: string;
  name: string;
  symbol: string;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
  profit: number;
  trades: number;
  winRate: number;
}

interface DashboardProps {
  mockTrades: Trade[];
  mockStrategies: Strategy[];
}

const StatCard: React.FC<{
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  icon: string;
}> = ({ title, value, change, changeType, icon }) => (
  <div className="relative group">
    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-yellow-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
    <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-yellow-400/40 transition-all duration-300 shadow-2xl shadow-black/50 hover:shadow-yellow-400/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">{title}</p>
          <p className="text-3xl font-bold text-white mt-2 drop-shadow-lg">{value}</p>
          {change && (
            <p className={`text-sm mt-2 flex items-center font-medium ${
              changeType === 'positive' ? 'text-green-300' : 'text-red-300'
            }`}>
              <span className="mr-1">{changeType === 'positive' ? '↗️' : '↘️'}</span>
              {change}
            </p>
          )}
        </div>
        <div className="text-4xl opacity-80 group-hover:opacity-100 transition-opacity duration-300">
          {icon}
        </div>
      </div>
    </div>
  </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ mockTrades, mockStrategies }) => {
  const totalPnL = mockTrades
    .filter(trade => trade.status === 'OPEN')
    .reduce((sum, trade) => sum + trade.pnl, 0);
  
  const totalValue = 50000 + totalPnL;
  const activeStrategies = mockStrategies.filter(s => s.status === 'ACTIVE').length;
  const openPositions = mockTrades.filter(t => t.status === 'OPEN').length;

  return (
    <div className="p-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Portfolio"
          value={`$${totalValue.toLocaleString()}`}
          change={`+${((totalPnL / 50000) * 100).toFixed(2)}%`}
          changeType="positive"
          icon="💰"
        />
        <StatCard
          title="Today's PnL"
          value={`$${totalPnL.toFixed(2)}`}
          change="+2.34%"
          changeType="positive"
          icon="📈"
        />
        <StatCard
          title="Active Strategies"
          value={activeStrategies.toString()}
          change="Running"
          changeType="positive"
          icon="🧠"
        />
        <StatCard
          title="Open Positions"
          value={openPositions.toString()}
          change="Live"
          changeType="positive"
          icon="📊"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 to-green-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-green-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
            <h3 className="text-xl font-bold text-white mb-4">🚀 Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <button className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white p-4 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-green-400/30">
                New Strategy
              </button>
              <button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white p-4 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-blue-400/30">
                Manual Trade
              </button>
              <button className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white p-4 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-purple-400/30">
                Backtest
              </button>
              <button className="bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black p-4 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-yellow-400/30">
                Analytics
              </button>
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-blue-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-blue-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
            <h3 className="text-xl font-bold text-white mb-4">📊 Recent Activity</h3>
            <div className="space-y-3">
              {mockTrades.slice(0, 3).map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-900 to-black rounded-lg border border-gray-700/30">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      trade.direction === 'LONG' ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                    <span className="text-white font-medium">{trade.symbol}</span>
                  </div>
                  <span className={`font-bold ${
                    trade.pnl >= 0 ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
