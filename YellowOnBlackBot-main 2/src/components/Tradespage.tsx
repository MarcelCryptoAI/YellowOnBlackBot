import React, { useState } from 'react';

// Types
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

// Mock Data per tab
const openPositions: Trade[] = [
  {
    id: '1',
    symbol: 'BTCUSDT',
    direction: 'LONG',
    amount: 0.1,
    entryPrice: 43250,
    currentPrice: 43890,
    pnl: 64,
    pnlPercent: 1.48,
    status: 'OPEN',
    exchange: 'Bybit',
    timestamp: '2025-06-05T09:30:00Z'
  },
  {
    id: '2',
    symbol: 'ETHUSDT',
    direction: 'SHORT',
    amount: 2.5,
    entryPrice: 2680,
    currentPrice: 2645,
    pnl: 87.5,
    pnlPercent: 1.31,
    status: 'OPEN',
    exchange: 'MEXC',
    timestamp: '2025-06-05T08:45:00Z'
  }
];

const openOrders: Trade[] = [
  {
    id: '4',
    symbol: 'ADAUSDT',
    direction: 'LONG',
    amount: 1000,
    entryPrice: 0.485,
    currentPrice: 0.490,
    pnl: 5,
    pnlPercent: 1.03,
    status: 'PENDING',
    exchange: 'Binance',
    timestamp: '2025-06-05T11:20:00Z'
  }
];

const closedTrades: Trade[] = [
  {
    id: '3',
    symbol: 'SOLUSDT',
    direction: 'LONG',
    amount: 50,
    entryPrice: 145.20,
    currentPrice: 148.75,
    pnl: 177.5,
    pnlPercent: 2.44,
    status: 'CLOSED',
    exchange: 'Binance',
    timestamp: '2025-06-05T07:15:00Z'
  },
  {
    id: '5',
    symbol: 'DOGEUSDT',
    direction: 'SHORT',
    amount: 10000,
    entryPrice: 0.165,
    currentPrice: 0.155,
    pnl: -23.12,
    pnlPercent: -1.4,
    status: 'CLOSED',
    exchange: 'Bybit',
    timestamp: '2025-06-04T18:44:00Z'
  }
];

// Trade Card Component
const TradeCard: React.FC<{ trade: Trade }> = ({ trade }) => (
  <div className="relative group">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-yellow-400/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
    <div className="relative bg-gradient-to-br from-black to-gray-900 p-5 rounded-xl border border-gray-600/30 hover:border-white/30 transition-all duration-300 shadow-2xl shadow-black/50 hover:shadow-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full shadow-lg ${
            trade.direction === 'LONG' 
              ? 'bg-green-400 shadow-green-400/50' 
              : 'bg-red-400 shadow-red-400/50'
          }`} />
          <span className="font-bold text-white text-lg tracking-wide drop-shadow-md">{trade.symbol}</span>
          <span className="text-xs bg-gradient-to-r from-gray-800 to-black border border-gray-600/40 px-3 py-1 rounded-full text-gray-300 font-medium shadow-inner">
            {trade.exchange}
          </span>
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-full shadow-lg ${
          trade.status === 'OPEN' 
            ? 'text-yellow-300 bg-gradient-to-r from-yellow-500/20 to-yellow-400/20 border border-yellow-500/40 shadow-yellow-400/20'
            : trade.status === 'PENDING'
            ? 'text-blue-300 bg-gradient-to-r from-blue-500/20 to-blue-400/20 border border-blue-500/40 shadow-blue-400/20'
            : 'text-gray-300 bg-gradient-to-r from-gray-600/20 to-gray-500/20 border border-gray-500/40 shadow-gray-400/20'
        }`}>
          {trade.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <p className="text-gray-400 uppercase tracking-wider text-xs font-medium">Entry</p>
          <p className="text-white font-bold text-base drop-shadow-sm">${trade.entryPrice.toLocaleString()}</p>
        </div>
        <div className="space-y-1">
          <p className="text-gray-400 uppercase tracking-wider text-xs font-medium">Current</p>
          <p className="text-white font-bold text-base drop-shadow-sm">${trade.currentPrice.toLocaleString()}</p>
        </div>
        <div className="space-y-1">
          <p className="text-gray-400 uppercase tracking-wider text-xs font-medium">PnL</p>
          <p className={`font-bold text-base drop-shadow-sm ${
            trade.pnl >= 0 ? 'text-green-300' : 'text-red-300'
          }`}>
            ${trade.pnl.toFixed(2)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-gray-400 uppercase tracking-wider text-xs font-medium">PnL %</p>
          <p className={`font-bold text-base drop-shadow-sm ${
            trade.pnlPercent >= 0 ? 'text-green-300' : 'text-red-300'
          }`}>
            {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Action buttons for active trades */}
      {trade.status === 'OPEN' && (
        <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-700/50">
          <button className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-red-400/30">
            Close
          </button>
          <button className="flex-1 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-yellow-400/30">
            Modify
          </button>
        </div>
      )}
    </div>
  </div>
);

// Main TradesPage Component
const TradesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Open Positions');

  const tabs = [
    { name: 'Open Positions', data: openPositions, count: openPositions.length },
    { name: 'Open Orders', data: openOrders, count: openOrders.length },
    { name: 'Closed Trades', data: closedTrades, count: closedTrades.length }
  ];

  const currentData = tabs.find(tab => tab.name === activeTab)?.data || [];

  // Calculate totals for open positions
  const totalPnL = openPositions.reduce((sum, trade) => sum + trade.pnl, 0);
  const totalValue = 50000 + totalPnL; // Base portfolio value + current PnL

  return (
    <div className="p-6 space-y-6">
      {/* Header with Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-yellow-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-yellow-400/40 transition-all duration-300 shadow-2xl shadow-black/50 hover:shadow-yellow-400/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">Total Portfolio</p>
                <p className="text-3xl font-bold text-white mt-2 drop-shadow-lg">${totalValue.toLocaleString()}</p>
                <p className="text-sm mt-2 flex items-center font-medium text-green-300">
                  <span className="mr-1">↗️</span> +{((totalPnL / 50000) * 100).toFixed(2)}%
                </p>
              </div>
              <div className="text-4xl opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                💰
              </div>
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 to-green-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-green-400/40 transition-all duration-300 shadow-2xl shadow-black/50 hover:shadow-green-400/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">Total PnL</p>
                <p className={`text-3xl font-bold mt-2 drop-shadow-lg ${totalPnL >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                </p>
                <p className="text-sm mt-2 flex items-center font-medium text-green-300">
                  <span className="mr-1">📈</span> Today
                </p>
              </div>
              <div className="text-4xl opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                📊
              </div>
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-blue-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-blue-400/40 transition-all duration-300 shadow-2xl shadow-black/50 hover:shadow-blue-400/10">
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
      <div className="flex space-x-1 bg-gradient-to-r from-gray-900 to-black p-2 rounded-xl border border-gray-700/50 shadow-inner">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
              activeTab === tab.name
                ? 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-black shadow-lg shadow-yellow-400/30'
                : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
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

      {/* Trades Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {currentData.length > 0 ? (
          currentData.map((trade) => (
            <TradeCard key={trade.id} trade={trade} />
          ))
        ) : (
          <div className="col-span-full">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-400/10 to-gray-600/10 rounded-xl blur-lg opacity-50"></div>
              <div className="relative bg-gradient-to-br from-gray-900 to-black p-12 rounded-xl border border-gray-700/30 text-center">
                <div className="text-6xl mb-4 opacity-50">📭</div>
                <h3 className="text-xl font-bold text-gray-300 mb-2">No {activeTab}</h3>
                <p className="text-gray-500">Start trading to see your positions here.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 pt-6 border-t border-gray-700/50">
        <button className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-green-400/30 flex items-center space-x-2">
          <span>📈</span>
          <span>New Position</span>
        </button>
        <button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-blue-400/30 flex items-center space-x-2">
          <span>📋</span>
          <span>Set Order</span>
        </button>
        <button className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-purple-400/30 flex items-center space-x-2">
          <span>🔄</span>
          <span>Refresh Data</span>
        </button>
        <button className="bg-gradient-to-r from-gray-600 to-gray-500 hover:from-gray-500 hover:to-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-gray-400/30 flex items-center space-x-2">
          <span>📊</span>
          <span>Export Report</span>
        </button>
      </div>
    </div>
  );
};

export default TradesPage;