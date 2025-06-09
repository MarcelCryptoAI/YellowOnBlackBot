// StrategiesPage.tsx
import React from 'react';

interface Strategy {
  id: string;
  name: string;
  symbol: string;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
  profit: number;
  trades: number;
  winRate: number;
}

interface StrategiesPageProps {
  mockStrategies: Strategy[];
}

const StrategyCard: React.FC<{ strategy: Strategy }> = ({ strategy }) => (
  <div className="relative group">
    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-white/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
    <div className="relative bg-gradient-to-br from-black to-gray-900 p-5 rounded-xl border border-gray-600/30 hover:border-yellow-400/40 transition-all duration-300 shadow-2xl shadow-black/50 hover:shadow-yellow-400/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-white text-lg tracking-wide drop-shadow-md">{strategy.name}</h3>
        <span className={`text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider shadow-lg ${
          strategy.status === 'ACTIVE' 
            ? 'bg-gradient-to-r from-green-500/20 to-green-400/20 text-green-300 border border-green-500/40 shadow-green-400/20'
            : strategy.status === 'PAUSED'
            ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-400/20 text-yellow-300 border border-yellow-500/40 shadow-yellow-400/20'
            : 'bg-gradient-to-r from-red-500/20 to-red-400/20 text-red-300 border border-red-500/40 shadow-red-400/20'
        }`}>
          {strategy.status}
        </span>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 uppercase tracking-wider font-medium">Profit</span>
          <span className="text-green-300 font-bold text-lg drop-shadow-sm">+${strategy.profit.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 uppercase tracking-wider font-medium">Trades</span>
          <span className="text-white font-bold drop-shadow-sm">{strategy.trades}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 uppercase tracking-wider font-medium">Win Rate</span>
          <span className="text-yellow-300 font-bold text-lg drop-shadow-sm">{strategy.winRate}%</span>
        </div>
      </div>
    </div>
  </div>
);

const StrategiesPage: React.FC<StrategiesPageProps> = ({ mockStrategies }) => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">🧠 Trading Strategies</h1>
        <button className="bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-yellow-400/30 flex items-center space-x-2">
          <span>➕</span>
          <span>Nieuwe Strategy Bouwen</span>
        </button>
      </div>

      {/* Strategies Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {mockStrategies.map((strategy) => (
          <StrategyCard key={strategy.id} strategy={strategy} />
        ))}
      </div>
    </div>
  );
};

// Export all components
export { Header, Dashboard, StrategiesPage };