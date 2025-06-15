// Dashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Position } from '../services/api';
import { coinsService } from '../services/coinsService';
import TradingChart from './TradingChart';
import { GlassCard, GlassMetric, GlassButton, GlassTable } from './GlassCard';

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

const PositionCard: React.FC<{ position: Position }> = ({ position }) => (
  <div className="glass-panel group">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className={`
          status-dot animate-pulse
          ${position.direction === 'LONG' ? 'status-online' : 'status-offline'}
        `}></div>
        <div>
          <div className="text-white font-orbitron font-bold text-lg tracking-wide">
            {position.symbol}
          </div>
          <div className="text-xs text-neon-cyan font-rajdhani font-bold uppercase tracking-[0.2em]">
            {position.exchange} • {position.direction}
          </div>
        </div>
      </div>
      <div className={`
        font-orbitron font-black text-xl group-hover:scale-110 transition-transform duration-300
        ${position.pnl >= 0 ? 'text-neon-green' : 'text-neon-red'}
      `}>
        {position.pnl >= 0 ? '+' : ''}${position.pnl?.toFixed(2) || '0.00'}
      </div>
    </div>
  </div>
);

const StrategyCard: React.FC<{ strategy: Strategy }> = ({ strategy }) => (
  <div className="glass-panel group">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className={`
          status-dot animate-pulse
          ${strategy.status === 'ACTIVE' ? 'status-online' : 'status-offline'}
        `}></div>
        <div>
          <div className="text-white font-orbitron font-bold text-lg tracking-wide">
            {strategy.name}
          </div>
          <div className="text-xs text-neon-purple font-rajdhani font-bold uppercase tracking-[0.2em]">
            {strategy.symbol} • {strategy.trades} Trades
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-neon-green font-orbitron font-black text-xl group-hover:scale-110 transition-transform duration-300">
          +${strategy.profit.toFixed(2)}
        </div>
        <div className="text-xs text-gray-400 font-rajdhani font-bold">{strategy.winRate}% win</div>
      </div>
    </div>
  </div>
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
        localStorage.removeItem('cached_perpetual_coins');
        localStorage.removeItem('bybit_copy_trading_contracts');
        
        const symbols = await coinsService.getSymbols(true, (progress) => {
          console.log(progress);
        });
        setAvailableCoins(symbols);
        console.log('✅ Dashboard loaded', symbols.length, 'copy trading contracts');
        
        if (coinsService.needsRefresh()) {
          console.log('⚠️ Coin data is older than 24h, consider refreshing');
        }
      } catch (error) {
        console.error('❌ Dashboard: Error loading coins:', error);
        const fallbackCoins = [
          'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'ARBUSDT', 
          'INJUSDT', 'SUIUSDT', 'DOGEUSDT', 'ADAUSDT', 'MATICUSDT'
        ];
        setAvailableCoins(fallbackCoins);
      }
    };

    loadCoins();
    
    const interval = setInterval(() => {
      if (coinsService.needsRefresh()) {
        console.log('⏰ Auto-refresh: Coin data is older than 24h');
        loadCoins();
      }
    }, 60 * 60 * 1000);

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

  const [liveStrategies, setLiveStrategies] = useState<Strategy[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);

  const fetchLiveStrategies = useCallback(async () => {
    setStrategiesLoading(true);
    try {
      setLiveStrategies([]);
      console.log('✅ Strategies data fetched (empty until backend implemented)');
    } catch (error) {
      console.error('❌ Failed to fetch strategies:', error);
      setLiveStrategies([]);
    } finally {
      setStrategiesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveStrategies();
    const interval = setInterval(fetchLiveStrategies, 60000);
    return () => clearInterval(interval);
  }, [fetchLiveStrategies]);

  const toggleWidget = (widget: keyof WidgetConfig) => {
    setWidgetConfig(prev => ({ ...prev, [widget]: !prev[widget] }));
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    setShowProgress(true);
    setRefreshProgress('🔄 Starting refresh...');
    
    try {
      console.log('🔄 Force refreshing coin data from Bybit...');
      
      const symbols = await coinsService.getSymbols(true, (progress) => {
        setRefreshProgress(progress);
        console.log(progress);
      });
      
      setAvailableCoins(symbols);
      setRefreshProgress(`✅ Successfully loaded ${symbols.length} coins!`);
      
      console.log('🎉 Dashboard refresh completed:', symbols.length, 'coins');
      
      setTimeout(() => {
        setShowProgress(false);
        setRefreshProgress('');
      }, 2000);
      
    } catch (error: any) {
      console.error('❌ Error refreshing dashboard:', error);
      setRefreshProgress(`❌ Error: ${error.message}`);
      
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
              NEURAL COMMAND
            </h1>
            <p className="text-2xl font-rajdhani text-neon-cyan uppercase tracking-[0.4em] font-bold">
              ⚡ QUANTUM TRADING MATRIX ⚡
            </p>
            
            {/* Holographic Effects */}
            <div className="absolute -inset-12 bg-gradient-to-r from-neon-cyan/5 via-neon-purple/5 to-neon-pink/5 blur-3xl opacity-50 animate-pulse-slow"></div>
          </div>
          
          <div className="flex items-center space-x-6">
            <GlassButton
              onClick={refreshData}
              disabled={isRefreshing}
              variant="cyan"
              className="flex items-center space-x-3 px-8 py-4 text-lg"
            >
              <span className={`text-2xl ${isRefreshing ? 'animate-spin' : ''}`}>⚡</span>
              <span className="font-rajdhani font-bold uppercase tracking-wider">
                {isRefreshing ? 'SYNCING' : 'QUANTUM SYNC'}
              </span>
            </GlassButton>
            <GlassButton
              onClick={() => setShowWidgetConfig(true)}
              variant="purple"
              className="flex items-center space-x-3 px-8 py-4 text-lg"
            >
              <span className="text-2xl">⚙️</span>
              <span className="font-rajdhani font-bold uppercase tracking-wider">MATRIX CONFIG</span>
            </GlassButton>
          </div>
        </div>

        {/* Metrics Grid - Ultra Thick Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {widgetConfig.totalPortfolio && (
            <div className="animate-fade-in metric-card group" style={{ animationDelay: '0.1s' }}>
              <GlassMetric
                label="TOTAL PORTFOLIO"
                value={`$${totalValue.toLocaleString()}`}
                change={`${portfolioChange >= 0 ? '+' : ''}${portfolioChange.toFixed(2)}%`}
                changeType={portfolioChange >= 0 ? 'positive' : 'negative'}
                icon="💎"
                color="cyan"
              />
            </div>
          )}
          
          {widgetConfig.todaysPnL && (
            <div className="animate-fade-in metric-card group" style={{ animationDelay: '0.2s' }}>
              <GlassMetric
                label="TODAY'S P&L"
                value={`$${totalPnL.toFixed(2)}`}
                change={`${totalPnL >= 0 ? '+' : ''}${((totalPnL / totalValue) * 100).toFixed(2)}%`}
                changeType={totalPnL >= 0 ? 'positive' : 'negative'}
                icon="🚀"
                color="purple"
              />
            </div>
          )}
          
          {widgetConfig.activeStrategies && (
            <div className="animate-fade-in metric-card group" style={{ animationDelay: '0.3s' }}>
              <GlassMetric
                label="ACTIVE STRATEGIES"
                value={liveStrategies.filter(s => s.status === 'ACTIVE').length.toString()}
                change={strategiesLoading ? "LOADING..." : "NEURAL NETWORKS"}
                changeType="positive"
                icon="🧠"
                color="pink"
              />
            </div>
          )}
          
          {widgetConfig.openPositions && (
            <div className="animate-fade-in metric-card group" style={{ animationDelay: '0.4s' }}>
              <GlassMetric
                label="OPEN POSITIONS"
                value={activePositions.toString()}
                change="LIVE TRADING"
                changeType="positive"
                icon="⚡"
                color="green"
              />
            </div>
          )}
          
          <div className="animate-fade-in metric-card group" style={{ animationDelay: '0.5s' }}>
            <GlassMetric
              label="TRADING PAIRS"
              value={availableCoins.length.toString()}
              change={`COPY TRADING ${isRefreshing ? '🔄' : '✅'}`}
              changeType="positive"
              icon="🌟"
              color="orange"
            />
          </div>
        </div>

        {/* Trading Chart - Extra Thick */}
        {widgetConfig.chart && (
          <div className="animate-fade-in mb-12" style={{ animationDelay: '0.6s' }}>
            <div className="glass-card">
              <h3 className="text-3xl font-orbitron font-black text-holographic mb-8 uppercase tracking-wider flex items-center">
                <span className="text-4xl mr-4">📊</span>
                PORTFOLIO QUANTUM MATRIX
              </h3>
              <div className="glass-panel p-8">
                <TradingChart variant="portfolio" height={500} />
              </div>
            </div>
          </div>
        )}

        {/* Content Grid - Extra Spacing and Depth */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Current Positions */}
          {widgetConfig.currentPositions && (
            <div className="animate-fade-in" style={{ animationDelay: '0.7s' }}>
              <div className="glass-card">
                <h3 className="text-3xl font-orbitron font-black text-neon-cyan mb-8 uppercase tracking-wider flex items-center">
                  <span className="text-4xl mr-4">💼</span>
                  LIVE POSITIONS
                  <div className="ml-6 status-dot status-online"></div>
                </h3>
                <div className="space-y-6 max-h-[400px] overflow-y-auto">
                  {livePositions.length > 0 ? (
                    livePositions.slice(0, 5).map((position, index) => (
                      <div key={index} className="animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                        <PositionCard position={position} />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-16 glass-panel">
                      <div className="text-8xl mb-6 animate-float">📈</div>
                      <div className="font-orbitron font-bold text-2xl text-gray-400">NO ACTIVE POSITIONS</div>
                      <div className="text-sm mt-2 text-gray-600 font-rajdhani">Waiting for quantum opportunities</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Active Strategies */}
          {widgetConfig.activeStrategiesList && (
            <div className="animate-fade-in" style={{ animationDelay: '0.8s' }}>
              <div className="glass-card">
                <h3 className="text-3xl font-orbitron font-black text-neon-purple mb-8 uppercase tracking-wider flex items-center">
                  <span className="text-4xl mr-4">🧠</span>
                  NEURAL STRATEGIES
                  {strategiesLoading ? (
                    <div className="ml-6 animate-spin text-2xl">🔄</div>
                  ) : (
                    <div className="ml-6 status-dot status-online"></div>
                  )}
                </h3>
                <div className="space-y-6 max-h-[400px] overflow-y-auto">
                  {strategiesLoading ? (
                    <div className="text-center py-16 glass-panel">
                      <div className="text-8xl mb-6 animate-spin">🔄</div>
                      <div className="font-orbitron font-bold text-2xl text-gray-400">LOADING NEURAL NETWORKS...</div>
                    </div>
                  ) : liveStrategies.filter(s => s.status === 'ACTIVE').length > 0 ? (
                    liveStrategies
                      .filter(s => s.status === 'ACTIVE')
                      .map((strategy, index) => (
                        <div key={strategy.id} className="animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                          <StrategyCard strategy={strategy} />
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-16 glass-panel">
                      <div className="text-8xl mb-6 animate-float">🤖</div>
                      <div className="font-orbitron font-bold text-2xl text-gray-400">NO ACTIVE STRATEGIES</div>
                      <div className="text-sm mt-2 text-gray-600 font-rajdhani">Deploy your first neural network</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity - Extra Thick */}
        {widgetConfig.recentActivity && (
          <div className="animate-fade-in mt-12" style={{ animationDelay: '0.9s' }}>
            <div className="glass-card">
              <h3 className="text-3xl font-orbitron font-black text-holographic mb-8 uppercase tracking-wider flex items-center">
                <span className="text-4xl mr-4">🕒</span>
                QUANTUM ACTIVITY FEED
              </h3>
              <div className="space-y-6">
                {livePositions.length > 0 ? (
                  livePositions.slice(0, 3).map((position, index) => (
                    <div key={index} className="animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                      <PositionCard position={position} />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 glass-panel">
                    <div className="text-8xl mb-6 animate-float">📊</div>
                    <div className="font-orbitron font-bold text-2xl text-gray-400">NO RECENT ACTIVITY</div>
                    <div className="text-sm mt-2 text-gray-600 font-rajdhani">Activity will appear here</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Widget Configuration Sidebar - Extra Thick */}
        {showWidgetConfig && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-end animate-fade-in">
            <div className="w-[480px] h-full overflow-hidden">
              <div className="glass-card h-full rounded-none rounded-l-3xl">
                <div className="relative h-full flex flex-col">
                  {/* Header */}
                  <div className="p-8 border-b border-white/10">
                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-orbitron font-black text-holographic uppercase tracking-wider">
                        ⚙️ WIDGET MATRIX
                      </h3>
                      <GlassButton
                        onClick={() => setShowWidgetConfig(false)}
                        variant="red"
                        size="sm"
                      >
                        ✕
                      </GlassButton>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 p-8 space-y-10 overflow-y-auto">
                    <div>
                      <h4 className="text-neon-cyan font-orbitron font-bold mb-6 uppercase tracking-wider text-lg">
                        📊 METRICS CONTROL
                      </h4>
                      <div className="space-y-4">
                        {[
                          { key: 'totalPortfolio', label: 'Portfolio Value', icon: '💎' },
                          { key: 'todaysPnL', label: "Today's P&L", icon: '🚀' },
                          { key: 'activeStrategies', label: 'Neural Strategies', icon: '🧠' },
                          { key: 'openPositions', label: 'Live Positions', icon: '⚡' }
                        ].map(({ key, label, icon }) => (
                          <div key={key} className="glass-panel flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <span className="text-3xl">{icon}</span>
                              <span className="text-white font-rajdhani font-bold text-lg">{label}</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={widgetConfig[key as keyof WidgetConfig]}
                              onChange={() => toggleWidget(key as keyof WidgetConfig)}
                              className="w-6 h-6 accent-neon-cyan rounded cursor-pointer"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-neon-purple font-orbitron font-bold mb-6 uppercase tracking-wider text-lg">
                        📈 DISPLAY MATRIX
                      </h4>
                      <div className="space-y-4">
                        {[
                          { key: 'chart', label: 'Performance Chart', icon: '📈' },
                          { key: 'currentPositions', label: 'Position Manager', icon: '💼' },
                          { key: 'activeStrategiesList', label: 'Strategy List', icon: '🧠' },
                          { key: 'recentActivity', label: 'Activity Feed', icon: '🕒' }
                        ].map(({ key, label, icon }) => (
                          <div key={key} className="glass-panel flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <span className="text-3xl">{icon}</span>
                              <span className="text-white font-rajdhani font-bold text-lg">{label}</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={widgetConfig[key as keyof WidgetConfig]}
                              onChange={() => toggleWidget(key as keyof WidgetConfig)}
                              className="w-6 h-6 accent-neon-purple rounded cursor-pointer"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="pt-8 border-t border-white/10">
                      <GlassButton
                        onClick={() => {
                          localStorage.setItem('dashboardWidgetConfig', JSON.stringify(widgetConfig));
                          setShowWidgetConfig(false);
                        }}
                        variant="cyan"
                        className="w-full py-4 text-lg"
                      >
                        💾 SAVE QUANTUM MATRIX
                      </GlassButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress Modal - Extra Thick */}
        {showProgress && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl z-50 flex items-center justify-center animate-fade-in">
            <div className="glass-card max-w-lg w-full mx-6">
              <div className="text-center">
                <div className="text-8xl mb-8 animate-float">
                  {isRefreshing ? (
                    <span className="animate-spin">⚡</span>
                  ) : refreshProgress.includes('✅') ? (
                    <span className="text-neon-green">✅</span>
                  ) : (
                    <span className="text-neon-red">❌</span>
                  )}
                </div>
                <h3 className="text-3xl font-orbitron font-black text-holographic mb-8 uppercase tracking-wider">
                  {isRefreshing ? 'NEURAL SYNC' : 'SYNC COMPLETE'}
                </h3>
                <div className="glass-panel mb-8">
                  <p className="text-white font-rajdhani font-bold text-lg">{refreshProgress}</p>
                </div>
                {isRefreshing && (
                  <div className="progress-bar mb-6" style={{ '--progress': '100%' } as React.CSSProperties}></div>
                )}
                <p className="text-sm text-gray-500 font-rajdhani font-bold uppercase tracking-wider">
                  Quantum entanglement with Bybit Matrix
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;