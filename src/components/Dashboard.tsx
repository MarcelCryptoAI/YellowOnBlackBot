// Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Position } from '../services/api';
import { coinsService } from '../services/coinsService';
import TradingChart from './TradingChart';
import { GlassCard, GlassButton } from './GlassCard';

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
  variant?: 'default' | 'accent' | 'success';
}> = ({ title, value, change, changeType, icon, variant = 'default' }) => (
  <GlassCard variant={variant} className="animate-fadeInUp">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="text-[#a86fff] font-medium text-sm uppercase tracking-wider">{title}</div>
        <div className="text-3xl mt-3 font-bold bg-gradient-to-r from-[#f9f9f9] to-[#4efcff] bg-clip-text text-transparent">
          {value}
        </div>
        {change && (
          <div className={`text-sm mt-4 flex items-center font-semibold ${
            changeType === 'positive' 
              ? 'text-success-green-light' 
              : 'text-danger-red-light'
          }`}>
            <span className="mr-2 text-lg">{changeType === 'positive' ? '📈' : '📉'}</span>
            {change}
          </div>
        )}
      </div>
      <div className="text-5xl opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 ml-4">
        {icon}
      </div>
    </div>
    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-transparent via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
  </div>
);

const PositionCard: React.FC<{ position: Position }> = ({ position }) => (
  <GlassCard variant="default" size="sm" className="group hover:scale-102 transition-all duration-300">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className={`w-4 h-4 rounded-full shadow-lg ${
          position.direction === 'LONG' 
            ? 'bg-gradient-to-r from-green-400 to-green-300 shadow-green-400/50' 
            : 'bg-gradient-to-r from-red-400 to-red-300 shadow-red-400/50'
        } animate-pulse`}></div>
        <div>
          <div className="text-white font-semibold text-lg">{position.symbol}</div>
          <div className="text-xs text-cyan-300 font-medium">{position.exchange}</div>
        </div>
      </div>
      <div className={`font-bold text-lg ${
        position.pnl >= 0 
          ? 'text-success-green-light' 
          : 'text-danger-red-light'
      } group-hover:scale-110 transition-transform duration-300`}>
        {position.pnl >= 0 ? '+' : ''}${position.pnl?.toFixed(2) || '0.00'}
      </div>
    </div>
  </GlassCard>
);

const StrategyCard: React.FC<{ strategy: Strategy }> = ({ strategy }) => (
  <GlassCard variant="default" size="sm" className="group hover:scale-102 transition-all duration-300">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className={`w-4 h-4 rounded-full shadow-lg ${
          strategy.status === 'ACTIVE' 
            ? 'bg-gradient-to-r from-success-green to-success-green-light shadow-success-green/50 animate-pulse' 
            : strategy.status === 'PAUSED' 
            ? 'bg-gradient-to-r from-accent-orange to-accent-gold shadow-accent-orange/50' 
            : 'bg-gradient-to-r from-danger-red to-danger-red-light shadow-danger-red/50'
        }`}></div>
        <div>
          <div className="text-white font-semibold text-lg">{strategy.name}</div>
          <div className="text-xs text-cyan-300 font-medium">{strategy.symbol}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-success-green-light font-bold text-lg group-hover:scale-110 transition-transform duration-300">
          +${strategy.profit.toFixed(2)}
        </div>
        <div className="text-xs text-gray-400 font-medium">{strategy.winRate}% win</div>
      </div>
    </div>
  </GlassCard>
);

export const Dashboard: React.FC = () => {
  const context = useOutletContext<OutletContext>();
  const { livePositions, totalValue, totalPnL, activePositions } = context;
  const [showWidgetConfig, setShowWidgetConfig] = useState(false);
  const [availableCoins, setAvailableCoins] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState('');
  const [showProgress, setShowProgress] = useState(false);

  // Load available coins on component mount
  useEffect(() => {
    const loadCoins = async () => {
      try {
        console.log('🔄 Loading coins for dashboard...');
        // Clear old cache first
        localStorage.removeItem('cached_perpetual_coins');
        localStorage.removeItem('bybit_copy_trading_contracts');
        
        // Force refresh to get new copy trading list
        const symbols = await coinsService.getSymbols(true, (progress) => {
          console.log(progress);
        });
        setAvailableCoins(symbols);
        console.log('✅ Dashboard loaded', symbols.length, 'copy trading contracts');
        
        // Check if data needs refresh (24h+)
        if (coinsService.needsRefresh()) {
          console.log('⚠️ Coin data is older than 24h, consider refreshing');
        }
      } catch (error) {
        console.error('❌ Dashboard: Error loading coins:', error);
        // Fallback to basic coins
        const fallbackCoins = [
          'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'ARBUSDT', 
          'INJUSDT', 'SUIUSDT', 'DOGEUSDT', 'ADAUSDT', 'MATICUSDT'
        ];
        setAvailableCoins(fallbackCoins);
      }
    };

    loadCoins();
    
    // Auto-refresh check every hour
    const interval = setInterval(() => {
      if (coinsService.needsRefresh()) {
        console.log('⏰ Auto-refresh: Coin data is older than 24h');
        // Auto refresh silently
        loadCoins();
      }
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(interval);
  }, []);

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

  const refreshData = async () => {
    setIsRefreshing(true);
    setShowProgress(true);
    setRefreshProgress('🔄 Starting refresh...');
    
    try {
      console.log('🔄 Force refreshing coin data from Bybit...');
      
      // Force fetch fresh data with progress updates
      const symbols = await coinsService.getSymbols(true, (progress) => {
        setRefreshProgress(progress);
        console.log(progress);
      });
      
      setAvailableCoins(symbols);
      setRefreshProgress(`✅ Successfully loaded ${symbols.length} coins!`);
      
      console.log('🎉 Dashboard refresh completed:', symbols.length, 'coins');
      
      // Hide progress after 2 seconds
      setTimeout(() => {
        setShowProgress(false);
        setRefreshProgress('');
      }, 2000);
      
    } catch (error: any) {
      console.error('❌ Error refreshing dashboard:', error);
      setRefreshProgress(`❌ Error: ${error.message}`);
      
      // Hide progress after 3 seconds
      setTimeout(() => {
        setShowProgress(false);
        setRefreshProgress('');
      }, 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const portfolioChange = totalValue > 0 ? ((totalPnL / totalValue) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Premium Header */}
      <div className="flex items-center justify-between mb-8 animate-fadeInUp">
        <div className="relative">
          <h1 className="text-5xl font-black bg-gradient-to-r from-primary-blue via-white to-primary-purple bg-clip-text text-transparent drop-shadow-2xl">
            💫 TRADING DASHBOARD
          </h1>
          <p className="text-info-cyan-light text-lg font-medium mt-2 opacity-90">
            AI-Powered Crypto Trading Platform
          </p>
          <div className="absolute -inset-4 bg-gradient-to-r from-primary-blue/10 via-transparent to-primary-purple/10 blur-xl opacity-50 -z-10"></div>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="btn-primary disabled:opacity-50 flex items-center space-x-3"
          >
            <span className={isRefreshing ? 'animate-spin text-xl' : 'text-xl'}>🔄</span>
            <span className="font-semibold">{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
          <button
            onClick={() => setShowWidgetConfig(true)}
            className="btn-secondary flex items-center space-x-3"
          >
            <span className="text-xl">⚙️</span>
            <span className="font-semibold">Configure</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {widgetConfig.totalPortfolio && (
          <div className="animate-delay-1">
            <StatCard
              title="Total Portfolio"
              value={`$${totalValue.toLocaleString()}`}
              change={`${portfolioChange >= 0 ? '+' : ''}${portfolioChange.toFixed(2)}%`}
              changeType={portfolioChange >= 0 ? 'positive' : 'negative'}
              icon="💎"
              variant="accent"
            />
          </div>
        )}
        {widgetConfig.todaysPnL && (
          <div className="animate-delay-2">
            <StatCard
              title="Today's PnL"
              value={`$${totalPnL.toFixed(2)}`}
              change={`${totalPnL >= 0 ? '+' : ''}${((totalPnL / totalValue) * 100).toFixed(2)}%`}
              changeType={totalPnL >= 0 ? 'positive' : 'negative'}
              icon="🚀"
              variant={totalPnL >= 0 ? 'success' : 'default'}
            />
          </div>
        )}
        {widgetConfig.activeStrategies && (
          <div className="animate-delay-3">
            <StatCard
              title="Active Strategies"
              value={mockActiveStrategies.filter(s => s.status === 'ACTIVE').length.toString()}
              change="AI Powered"
              changeType="positive"
              icon="🤖"
              variant="accent"
            />
          </div>
        )}
        {widgetConfig.openPositions && (
          <div className="animate-delay-4">
            <StatCard
              title="Open Positions"
              value={activePositions.toString()}
              change="Live Trading"
              changeType="positive"
              icon="⚡"
              variant="success"
            />
          </div>
        )}
        <div className="animate-delay-5">
          <StatCard
            title="Trading Pairs"
            value={availableCoins.length.toString()}
            change={`Copy Trading ${isRefreshing ? '🔄' : '✅'}`}
            changeType="positive"
            icon="🌟"
          />
        </div>
      </div>

      {/* Premium Trading Chart */}
      {widgetConfig.chart && (
        <div className="animate-fadeInUp animate-delay-6">
          <TradingChart 
            variant="portfolio" 
            height={400}
          />
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Positions */}
        {widgetConfig.currentPositions && (
          <GlassCard className="animate-fadeInUp animate-delay-1" variant="accent">
            <h3 className="section-title mb-4">💼 Current Positions</h3>
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
          </GlassCard>
        )}

        {/* Active Strategies */}
        {widgetConfig.activeStrategiesList && (
          <GlassCard className="animate-fadeInUp animate-delay-2" variant="success">
            <h3 className="section-title mb-4">🧠 Active Strategies</h3>
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
          </GlassCard>
        )}
      </div>

      {/* Recent Activity */}
      {widgetConfig.recentActivity && (
        <GlassCard className="animate-fadeInUp animate-delay-3">
          <h3 className="section-title mb-4">🕒 Recent Activity</h3>
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
        </GlassCard>
      )}

      {/* Widget Configuration Sidebar */}
      {showWidgetConfig && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-end">
          <GlassCard variant="accent" className="w-96 h-full rounded-none rounded-l-3xl overflow-hidden transform transition-transform duration-300">
            <div className="p-6 border-b border-gray-700/30">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">⚙️ Widget Configuration</h3>
                <GlassButton
                  onClick={() => setShowWidgetConfig(false)}
                  variant="secondary"
                  size="sm"
                >
                  <span className="text-gray-400">✕</span>
                </GlassButton>
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
                  className="w-full btn-primary"
                >
                  💾 Save Configuration
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Progress Modal */}
      {showProgress && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <GlassCard variant="accent" size="lg" className="max-w-md w-full mx-4">
            <div className="text-center">
              <div className="text-4xl mb-4">
                {isRefreshing ? (
                  <span className="animate-spin">🔄</span>
                ) : refreshProgress.includes('✅') ? (
                  <span>✅</span>
                ) : (
                  <span>❌</span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white mb-4">
                {isRefreshing ? 'Refreshing Coin Data' : 'Refresh Complete'}
              </h3>
              <div className="bg-gray-900/50 p-4 rounded-lg mb-4">
                <p className="text-gray-300 text-sm">{refreshProgress}</p>
              </div>
              {isRefreshing && (
                <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                  <div className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full animate-pulse" style={{width: '100%'}}></div>
                </div>
              )}
              <p className="text-xs text-gray-400">
                Fetching all USDT perpetual coins from Bybit API
              </p>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
