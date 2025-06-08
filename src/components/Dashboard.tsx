// Dashboard.tsx
import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Position } from '../services/api';

interface Strategy {
  id: string;
  name: string;
  symbol: string;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
  profit: number;
  trades: number;
  winRate: number;
}

interface WidgetConfig {
  totalPortfolio: boolean;
  todaysPnL: boolean;
  activeStrategies: boolean;
  openPositions: boolean;
  chart: boolean;
  recentActivity: boolean;
  currentPositions: boolean;
  activeStrategiesList: boolean;
}

interface OutletContext {
  livePositions: Position[];
  totalValue: number;
  totalPnL: number;
  activePositions: number;
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

const PositionCard: React.FC<{ position: Position }> = ({ position }) => (
  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-900 to-black rounded-lg border border-gray-700/30">
    <div className="flex items-center space-x-3">
      <div className={`w-2 h-2 rounded-full ${
        position.direction === 'LONG' ? 'bg-green-400' : 'bg-red-400'
      }`}></div>
      <span className="text-white font-medium">{position.symbol}</span>
      <span className="text-xs text-gray-400">{position.exchange}</span>
    </div>
    <span className={`font-bold ${
      position.pnl >= 0 ? 'text-green-300' : 'text-red-300'
    }`}>
      {position.pnl >= 0 ? '+' : ''}${position.pnl?.toFixed(2) || '0.00'}
    </span>
  </div>
);

const StrategyCard: React.FC<{ strategy: Strategy }> = ({ strategy }) => (
  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-900 to-black rounded-lg border border-gray-700/30">
    <div className="flex items-center space-x-3">
      <div className={`w-2 h-2 rounded-full ${
        strategy.status === 'ACTIVE' ? 'bg-green-400' : 
        strategy.status === 'PAUSED' ? 'bg-yellow-400' : 'bg-red-400'
      }`}></div>
      <div>
        <span className="text-white font-medium">{strategy.name}</span>
        <div className="text-xs text-gray-400">{strategy.symbol}</div>
      </div>
    </div>
    <div className="text-right">
      <div className="text-green-300 font-bold">+${strategy.profit.toFixed(2)}</div>
      <div className="text-xs text-gray-400">{strategy.winRate}% win</div>
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  const context = useOutletContext<OutletContext>();
  const { livePositions, totalValue, totalPnL, activePositions } = context;
  const [showWidgetConfig, setShowWidgetConfig] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>({
    totalPortfolio: true,
    todaysPnL: true,
    activeStrategies: true,
    openPositions: true,
    chart: true,
    recentActivity: true,
    currentPositions: true,
    activeStrategiesList: true
  });

  // Mock active strategies for now
  const mockActiveStrategies: Strategy[] = [
    {
      id: '1',
      name: 'BTC Momentum',
      symbol: 'BTCUSDT',
      status: 'ACTIVE',
      profit: 245.30,
      trades: 12,
      winRate: 75.0
    },
    {
      id: '2', 
      name: 'ETH Scalping',
      symbol: 'ETHUSDT',
      status: 'ACTIVE',
      profit: 189.75,
      trades: 8,
      winRate: 62.5
    }
  ];

  const toggleWidget = (widget: keyof WidgetConfig) => {
    setWidgetConfig(prev => ({ ...prev, [widget]: !prev[widget] }));
  };

  const portfolioChange = totalValue > 0 ? ((totalPnL / totalValue) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header with Widget Config Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
          📊 DASHBOARD
        </h2>
        <button
          onClick={() => setShowWidgetConfig(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-lg"
        >
          <span>⚙️</span>
          <span>Configure Widgets</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {widgetConfig.totalPortfolio && (
          <StatCard
            title="Total Portfolio"
            value={`$${totalValue.toLocaleString()}`}
            change={`${portfolioChange >= 0 ? '+' : ''}${portfolioChange.toFixed(2)}%`}
            changeType={portfolioChange >= 0 ? 'positive' : 'negative'}
            icon="💰"
          />
        )}
        {widgetConfig.todaysPnL && (
          <StatCard
            title="Today's PnL"
            value={`$${totalPnL.toFixed(2)}`}
            change={`${totalPnL >= 0 ? '+' : ''}${((totalPnL / totalValue) * 100).toFixed(2)}%`}
            changeType={totalPnL >= 0 ? 'positive' : 'negative'}
            icon="📈"
          />
        )}
        {widgetConfig.activeStrategies && (
          <StatCard
            title="Active Strategies"
            value={mockActiveStrategies.filter(s => s.status === 'ACTIVE').length.toString()}
            change="Running"
            changeType="positive"
            icon="🧠"
          />
        )}
        {widgetConfig.openPositions && (
          <StatCard
            title="Open Positions"
            value={activePositions.toString()}
            change="Live"
            changeType="positive"
            icon="📊"
          />
        )}
      </div>

      {/* Chart Widget */}
      {widgetConfig.chart && (
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-purple-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-purple-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
            <h3 className="text-xl font-bold text-white mb-4">📈 Portfolio Performance</h3>
            <div className="h-64 flex items-center justify-center bg-gray-900/50 rounded-lg border border-gray-700/40">
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <div className="text-gray-400">Chart integration coming soon</div>
                <div className="text-sm text-gray-500 mt-1">TradingView or custom charts</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Positions */}
        {widgetConfig.currentPositions && (
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 to-green-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
            <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-green-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
              <h3 className="text-xl font-bold text-white mb-4">💼 Current Positions</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {livePositions.length > 0 ? (
                  livePositions.slice(0, 5).map((position, index) => (
                    <PositionCard key={index} position={position} />
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-3xl mb-2">📈</div>
                    <div>No open positions</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Active Strategies */}
        {widgetConfig.activeStrategiesList && (
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-blue-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
            <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-blue-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
              <h3 className="text-xl font-bold text-white mb-4">🧠 Active Strategies</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {mockActiveStrategies.filter(s => s.status === 'ACTIVE').length > 0 ? (
                  mockActiveStrategies
                    .filter(s => s.status === 'ACTIVE')
                    .map((strategy) => (
                      <StrategyCard key={strategy.id} strategy={strategy} />
                    ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-3xl mb-2">🤖</div>
                    <div>No active strategies</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {widgetConfig.recentActivity && (
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-yellow-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-yellow-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
            <h3 className="text-xl font-bold text-white mb-4">🕒 Recent Activity</h3>
            <div className="space-y-3">
              {livePositions.length > 0 ? (
                livePositions.slice(0, 3).map((position, index) => (
                  <PositionCard key={index} position={position} />
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-3xl mb-2">📊</div>
                  <div>No recent activity</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Widget Configuration Sidebar */}
      {showWidgetConfig && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-end">
          <div className="w-96 h-full bg-gradient-to-b from-gray-900 to-black border-l border-gray-600/30 shadow-2xl transform transition-transform duration-300">
            <div className="p-6 border-b border-gray-700/30">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">⚙️ Widget Configuration</h3>
                <button
                  onClick={() => setShowWidgetConfig(false)}
                  className="p-2 hover:bg-gray-800 rounded transition-all"
                >
                  <span className="text-gray-400">✕</span>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              <div>
                <h4 className="text-white font-medium mb-4">📊 Stat Cards</h4>
                <div className="space-y-3">
                  {[
                    { key: 'totalPortfolio', label: 'Total Portfolio', icon: '💰' },
                    { key: 'todaysPnL', label: "Today's PnL", icon: '📈' },
                    { key: 'activeStrategies', label: 'Active Strategies', icon: '🧠' },
                    { key: 'openPositions', label: 'Open Positions', icon: '📊' }
                  ].map(({ key, label, icon }) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{icon}</span>
                        <span className="text-gray-300">{label}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={widgetConfig[key as keyof WidgetConfig]}
                        onChange={() => toggleWidget(key as keyof WidgetConfig)}
                        className="w-4 h-4 text-blue-400 bg-gray-900 border-gray-600 rounded focus:ring-blue-400 focus:ring-2"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-white font-medium mb-4">📈 Content Widgets</h4>
                <div className="space-y-3">
                  {[
                    { key: 'chart', label: 'Portfolio Chart', icon: '📈' },
                    { key: 'currentPositions', label: 'Current Positions', icon: '💼' },
                    { key: 'activeStrategiesList', label: 'Active Strategies List', icon: '🧠' },
                    { key: 'recentActivity', label: 'Recent Activity', icon: '🕒' }
                  ].map(({ key, label, icon }) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{icon}</span>
                        <span className="text-gray-300">{label}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={widgetConfig[key as keyof WidgetConfig]}
                        onChange={() => toggleWidget(key as keyof WidgetConfig)}
                        className="w-4 h-4 text-blue-400 bg-gray-900 border-gray-600 rounded focus:ring-blue-400 focus:ring-2"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-700/30 pt-4">
                <button
                  onClick={() => {
                    // Save widget configuration to localStorage
                    localStorage.setItem('dashboardWidgetConfig', JSON.stringify(widgetConfig));
                    setShowWidgetConfig(false);
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3 px-4 rounded-lg font-medium transition-all duration-300 shadow-lg"
                >
                  💾 Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
