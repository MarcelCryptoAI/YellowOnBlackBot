import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/api';

interface SymbolInfo {
  symbol: string;
  volume_24h: number;
  price_change_24h: number;
  priority_score: number;
  priority_level: string;
  status: string;
}

interface MassTradingStats {
  total_symbols: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  active_positions: number;
  pending_signals: number;
  total_trades: number;
  total_pnl: number;
  win_rate: number;
}

const MassTradingDashboard: React.FC = () => {
  const [stats, setStats] = useState<MassTradingStats | null>(null);
  const [topSymbols, setTopSymbols] = useState<SymbolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMassStats();
    const interval = setInterval(fetchMassStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchMassStats = async () => {
    try {
      const response = await apiClient.get('/mass-trading/status');
      if (response.data.success) {
        setStats(response.data.stats);
        setTopSymbols(response.data.top_symbols || []);
      }
      setError(null);
    } catch (err) {
      setError('Failed to fetch mass trading stats');
      console.error('Error fetching mass stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card">
        <div className="text-center py-16">
          <div className="text-8xl mb-6 animate-spin">🔄</div>
          <div className="font-orbitron font-bold text-2xl text-gray-400">LOADING MASS TRADING DATA...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card">
        <div className="text-center py-16">
          <div className="text-8xl mb-6">❌</div>
          <div className="font-orbitron font-bold text-2xl text-red-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Mass Trading Overview */}
      <div className="glass-card">
        <h2 className="text-3xl font-orbitron font-black text-holographic mb-8 uppercase tracking-wider flex items-center">
          <span className="text-4xl mr-4">🤖</span>
          MASS AI TRADING SYSTEM
          <div className="ml-6 status-dot status-online"></div>
        </h2>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="glass-panel">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <div className="text-3xl font-orbitron font-black text-neon-cyan">
                {stats?.total_symbols || 0}
              </div>
              <div className="text-sm text-gray-400 font-rajdhani font-bold uppercase">
                Total Symbols
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="text-center">
              <div className="text-4xl mb-2">💼</div>
              <div className="text-3xl font-orbitron font-black text-neon-green">
                {stats?.active_positions || 0}
              </div>
              <div className="text-sm text-gray-400 font-rajdhani font-bold uppercase">
                Active Positions
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="text-center">
              <div className="text-4xl mb-2">🎯</div>
              <div className="text-3xl font-orbitron font-black text-neon-purple">
                {stats?.pending_signals || 0}
              </div>
              <div className="text-sm text-gray-400 font-rajdhani font-bold uppercase">
                Pending Signals
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="text-center">
              <div className="text-4xl mb-2">💰</div>
              <div className={`text-3xl font-orbitron font-black ${
                (stats?.total_pnl || 0) >= 0 ? 'text-neon-green' : 'text-neon-red'
              }`}>
                ${(stats?.total_pnl || 0).toFixed(2)}
              </div>
              <div className="text-sm text-gray-400 font-rajdhani font-bold uppercase">
                Total PnL
              </div>
            </div>
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-panel border-red-500/20">
            <div className="text-center">
              <div className="text-3xl mb-2">🔥</div>
              <div className="text-2xl font-orbitron font-black text-red-400">
                {stats?.high_priority || 0}
              </div>
              <div className="text-sm text-gray-400 font-rajdhani font-bold uppercase">
                High Priority
              </div>
              <div className="text-xs text-gray-500 mt-1">3min analysis</div>
            </div>
          </div>

          <div className="glass-panel border-yellow-500/20">
            <div className="text-center">
              <div className="text-3xl mb-2">🟡</div>
              <div className="text-2xl font-orbitron font-black text-yellow-400">
                {stats?.medium_priority || 0}
              </div>
              <div className="text-sm text-gray-400 font-rajdhani font-bold uppercase">
                Medium Priority
              </div>
              <div className="text-xs text-gray-500 mt-1">10min analysis</div>
            </div>
          </div>

          <div className="glass-panel border-green-500/20">
            <div className="text-center">
              <div className="text-3xl mb-2">🟢</div>
              <div className="text-2xl font-orbitron font-black text-green-400">
                {stats?.low_priority || 0}
              </div>
              <div className="text-sm text-gray-400 font-rajdhani font-bold uppercase">
                Low Priority
              </div>
              <div className="text-xs text-gray-500 mt-1">30min analysis</div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel">
            <div className="text-center">
              <div className="text-3xl mb-2">📈</div>
              <div className="text-2xl font-orbitron font-black text-neon-cyan">
                {stats?.total_trades || 0}
              </div>
              <div className="text-sm text-gray-400 font-rajdhani font-bold uppercase">
                Total Trades
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="text-center">
              <div className="text-3xl mb-2">🎯</div>
              <div className="text-2xl font-orbitron font-black text-neon-green">
                {(stats?.win_rate || 0).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-400 font-rajdhani font-bold uppercase">
                Win Rate
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Symbols */}
      <div className="glass-card">
        <h3 className="text-2xl font-orbitron font-black text-neon-purple mb-6 uppercase tracking-wider flex items-center">
          <span className="text-3xl mr-4">🏆</span>
          TOP PRIORITY SYMBOLS
        </h3>

        <div className="space-y-4">
          {topSymbols.length > 0 ? (
            topSymbols.slice(0, 10).map((symbol, index) => (
              <div key={symbol.symbol} className="glass-panel flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-2xl font-orbitron font-bold text-gray-400">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="text-white font-orbitron font-bold text-lg">
                      {symbol.symbol}
                    </div>
                    <div className={`text-sm font-rajdhani font-bold uppercase ${
                      symbol.priority_level === 'HIGH' ? 'text-red-400' :
                      symbol.priority_level === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {symbol.priority_level} PRIORITY
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-neon-cyan font-orbitron font-bold text-lg">
                    ${(symbol.volume_24h / 1000000).toFixed(1)}M
                  </div>
                  <div className="text-xs text-gray-400 font-rajdhani">24h Volume</div>
                </div>

                <div className="text-right">
                  <div className={`font-orbitron font-bold text-lg ${
                    symbol.price_change_24h >= 0 ? 'text-neon-green' : 'text-neon-red'
                  }`}>
                    {symbol.price_change_24h >= 0 ? '+' : ''}
                    {symbol.price_change_24h.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-400 font-rajdhani">24h Change</div>
                </div>

                <div className="text-right">
                  <div className="text-neon-purple font-orbitron font-bold text-lg">
                    {symbol.priority_score.toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-400 font-rajdhani">AI Score</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📊</div>
              <div className="text-gray-400 font-rajdhani">Loading symbol data...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MassTradingDashboard;