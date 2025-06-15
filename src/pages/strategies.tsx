import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bybitApi } from '../services/api';
import { GlassCard, GlassButton, GlassMetric } from '../components/GlassCard';

// Types
interface Strategy {
  id: string;
  name: string;
  symbol: string;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'BACKTESTING' | 'OPTIMIZING';
  profit: number;
  trades: number;
  winRate: number;
  createdAt: string;
  description: string;
  timeframe: string;
  indicators: string[];
  mlModel?: string;
  riskScore: number;
  config?: any;
  connectionId?: string;
  quantity?: number;
  lastSignal?: {
    signal: 'BUY' | 'SELL';
    timestamp: string;
    executed: boolean;
  };
}

interface StrategyTrade {
  id: string;
  strategyId: string;
  symbol: string;
  type: 'LONG' | 'SHORT';
  status: 'OPEN' | 'CLOSED';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl: number;
  timestamp: string;
  exitTimestamp?: string;
}

interface ByBitConnection {
  connectionId: string;
  name: string;
  balance?: {
    total: number;
    available: number;
  };
}

type ViewMode = 'grid' | 'list';
type LogbookTab = 'open' | 'closed' | 'positions';

// Strategy Card Component for Grid View
const StrategyCard: React.FC<{ 
  strategy: Strategy; 
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void; 
  onToggle: () => void; 
  onDelete: () => void;
}> = ({ strategy, isSelected, onSelect, onEdit, onToggle, onDelete }) => (
  <GlassCard variant="neon" color="cyan" className="p-6 group hover:scale-105 transition-all duration-300">
    {/* Header with Checkbox */}
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-start space-x-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
          className="mt-1 w-4 h-4 accent-neon-cyan rounded"
        />
        <div>
          <h3 className="font-orbitron font-bold text-white text-lg tracking-wide">{strategy.name}</h3>
          <p className="text-sm text-neon-cyan font-rajdhani">{strategy.symbol} • {strategy.timeframe}</p>
        </div>
      </div>
      <span className={`text-xs px-3 py-1.5 rounded-full font-rajdhani font-bold uppercase tracking-wider shadow-lg ${
        strategy.status === 'ACTIVE' 
          ? 'bg-neon-green/20 text-neon-green border border-neon-green/40'
          : strategy.status === 'PAUSED'
          ? 'bg-neon-orange/20 text-neon-orange border border-neon-orange/40'
          : strategy.status === 'BACKTESTING'
          ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40'
          : strategy.status === 'OPTIMIZING'
          ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/40'
          : 'bg-neon-red/20 text-neon-red border border-neon-red/40'
      }`}>
        {strategy.status}
      </span>
    </div>

    {/* Description */}
    <p className="text-sm text-gray-300 font-rajdhani mb-4 line-clamp-2">{strategy.description}</p>

    {/* ML Model Badge */}
    {strategy.mlModel && (
      <div className="mb-4">
        <span className="px-3 py-1 text-xs bg-neon-purple/20 text-neon-purple border border-neon-purple/40 rounded-full font-rajdhani font-bold">
          🤖 {strategy.mlModel}
        </span>
      </div>
    )}

    {/* Performance Metrics */}
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div className="glass-panel p-3 text-center">
        <div className="text-xs text-gray-400 uppercase tracking-wider font-rajdhani font-bold mb-1">Profit</div>
        <div className={`text-lg font-orbitron font-bold ${
          strategy.profit >= 0 ? 'text-neon-green' : 'text-neon-red'
        }`}>
          {strategy.profit >= 0 ? '+' : ''}${strategy.profit.toFixed(2)}
        </div>
      </div>
      <div className="glass-panel p-3 text-center">
        <div className="text-xs text-gray-400 uppercase tracking-wider font-rajdhani font-bold mb-1">Win Rate</div>
        <div className="text-lg font-orbitron font-bold text-neon-cyan">{strategy.winRate.toFixed(1)}%</div>
      </div>
    </div>

    {/* Action Buttons */}
    <div className="space-y-2">
      <div className="flex space-x-2">
        <GlassButton
          onClick={onEdit}
          variant="cyan"
          className="flex-1 text-sm"
        >
          📊 Details
        </GlassButton>
        <GlassButton
          onClick={onToggle}
          variant={strategy.status === 'ACTIVE' ? 'orange' : 'green'}
          className="flex-1 text-sm"
        >
          {strategy.status === 'ACTIVE' ? '⏸️ Pause' : '▶️ Start'}
        </GlassButton>
        <GlassButton
          onClick={onDelete}
          variant="red"
          size="sm"
          className="px-3"
        >
          🗑️
        </GlassButton>
      </div>
      <GlassButton
        onClick={() => {
          localStorage.setItem('strategyToEdit', JSON.stringify(strategy));
          window.location.href = '/strategies/builder';
        }}
        variant="purple"
        className="w-full text-sm"
      >
        ✏️ Edit in Wizard
      </GlassButton>
    </div>

    {/* Created Date */}
    <div className="text-xs text-gray-500 mt-3 text-center font-rajdhani">
      Created: {new Date(strategy.createdAt).toLocaleDateString()}
    </div>
  </GlassCard>
);

// Strategy List Row Component
const StrategyListRow: React.FC<{ 
  strategy: Strategy;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}> = ({ strategy, isSelected, onSelect, onEdit, onToggle, onDelete }) => (
  <div className="glass-panel p-4 mb-3 hover:scale-[1.02] transition-all duration-300">
    <div className="flex items-center space-x-4">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onSelect(e.target.checked)}
        className="w-4 h-4 accent-neon-cyan rounded"
      />
      
      <div className="flex-1 grid grid-cols-6 gap-4 items-center">
        <div>
          <h3 className="font-orbitron font-bold text-white text-sm">{strategy.name}</h3>
          <p className="text-xs text-neon-cyan font-rajdhani">{strategy.symbol}</p>
        </div>
        
        <div className="text-center">
          <span className={`text-xs px-2 py-1 rounded-full font-rajdhani font-bold ${
            strategy.status === 'ACTIVE' 
              ? 'bg-neon-green/20 text-neon-green'
              : strategy.status === 'PAUSED'
              ? 'bg-neon-orange/20 text-neon-orange'
              : 'bg-neon-red/20 text-neon-red'
          }`}>
            {strategy.status}
          </span>
        </div>
        
        <div className="text-center">
          <div className={`font-orbitron font-bold ${
            strategy.profit >= 0 ? 'text-neon-green' : 'text-neon-red'
          }`}>
            {strategy.profit >= 0 ? '+' : ''}${strategy.profit.toFixed(2)}
          </div>
        </div>
        
        <div className="text-center">
          <div className="font-orbitron font-bold text-neon-cyan">{strategy.winRate.toFixed(1)}%</div>
        </div>
        
        <div className="text-center">
          <div className="text-white font-rajdhani">{strategy.trades}</div>
        </div>
        
        <div className="flex items-center justify-end space-x-2">
          <GlassButton onClick={onEdit} variant="cyan" size="sm">📊</GlassButton>
          <GlassButton 
            onClick={onToggle} 
            variant={strategy.status === 'ACTIVE' ? 'orange' : 'green'} 
            size="sm"
          >
            {strategy.status === 'ACTIVE' ? '⏸️' : '▶️'}
          </GlassButton>
          <GlassButton onClick={onDelete} variant="red" size="sm">🗑️</GlassButton>
        </div>
      </div>
    </div>
  </div>
);

// Main Strategies Page Component  
const StrategiesPage: React.FC = () => {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'STOPPED'>('ALL');
  const [sortBy, setSortBy] = useState<'profit' | 'winRate' | 'created'>('profit');
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [connections, setConnections] = useState<ByBitConnection[]>([]);
  const [executingStrategy, setExecutingStrategy] = useState<string | null>(null);
  
  // New states for enhanced functionality
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedStrategies, setSelectedStrategies] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showLogbook, setShowLogbook] = useState(false);
  const [logbookTab, setLogbookTab] = useState<LogbookTab>('open');
  const [strategyTrades, setStrategyTrades] = useState<StrategyTrade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [liveMonitoring, setLiveMonitoring] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Load strategy trades from API
  const loadStrategyTrades = async () => {
    setLoadingTrades(true);
    try {
      const connectionsResult = await bybitApi.getConnections();
      if (connectionsResult.success) {
        const allTrades: StrategyTrade[] = [];
        
        // Load order history from all connections
        for (const conn of connectionsResult.connections) {
          if (conn.data?.orderHistory) {
            const trades = conn.data.orderHistory.map((order: any) => ({
              id: order.id || `${conn.connectionId}_${Date.now()}_${Math.random()}`,
              strategyId: 'manual', // These are manual trades, not strategy trades yet
              symbol: order.symbol,
              type: order.direction, // 'LONG' or 'SHORT'
              status: order.status === 'FILLED' ? 'CLOSED' : 'OPEN', 
              entryPrice: order.entryPrice,
              exitPrice: order.status === 'FILLED' ? order.entryPrice : undefined,
              quantity: order.amount,
              pnl: order.pnl || 0,
              timestamp: order.timestamp,
              exitTimestamp: order.status === 'FILLED' ? order.timestamp : undefined
            }));
            allTrades.push(...trades);
          }
        }
        
        setStrategyTrades(allTrades);
        setLastUpdate(new Date().toLocaleTimeString());
        console.log('✅ Loaded', allTrades.length, 'strategy trades from API');
      }
    } catch (error) {
      console.error('❌ Failed to load strategy trades:', error);
      // Keep existing trades on error
    }
    setLoadingTrades(false);
  };

  // Start/stop live monitoring
  const toggleLiveMonitoring = () => {
    setLiveMonitoring(!liveMonitoring);
    if (!liveMonitoring) {
      console.log('🔴 Starting live strategy monitoring...');
    } else {
      console.log('⏸️ Stopping live strategy monitoring...');
    }
  };

  // Live monitoring effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (liveMonitoring) {
      // Refresh strategy data every 30 seconds when monitoring is active
      interval = setInterval(() => {
        console.log('🔄 Live monitoring: Refreshing strategy data...');
        loadStrategyTrades();
      }, 30000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [liveMonitoring]);

  // Load strategies from localStorage and connections from API
  useEffect(() => {
    const loadData = async () => {
      // Load strategies from localStorage
      const saved = localStorage.getItem('userStrategies');
      if (saved) {
        try {
          const parsedStrategies = JSON.parse(saved);
          setStrategies(parsedStrategies);
        } catch (error) {
          console.error('Error parsing saved strategies:', error);
          setStrategies([]);
        }
      }
      
      // Load ByBit connections
      try {
        const connectionsResult = await bybitApi.getConnections();
        if (connectionsResult.success) {
          setConnections(connectionsResult.connections.map((conn: any) => ({
            connectionId: conn.connection_id,
            name: conn.name || conn.metadata?.name || 'Unknown',
            balance: conn.data?.balance
          })));
        }
      } catch (error) {
        console.error('Failed to load connections:', error);
      }
      
      // Load strategy trades
      await loadStrategyTrades();
      
      setLoading(false);
    };

    loadData();
  }, []);

  // Filter and sort strategies
  const filteredStrategies = strategies
    .filter(strategy => filter === 'ALL' || strategy.status === filter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'profit':
          return b.profit - a.profit;
        case 'winRate':
          return b.winRate - a.winRate;
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

  // Bulk action handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStrategies(new Set(filteredStrategies.map(s => s.id)));
    } else {
      setSelectedStrategies(new Set());
    }
  };

  const handleSelectStrategy = (strategyId: string, checked: boolean) => {
    const newSelected = new Set(selectedStrategies);
    if (checked) {
      newSelected.add(strategyId);
    } else {
      newSelected.delete(strategyId);
    }
    setSelectedStrategies(newSelected);
  };

  const handleBulkAction = (action: 'start' | 'pause' | 'stop' | 'delete') => {
    const selectedIds = Array.from(selectedStrategies);
    if (selectedIds.length === 0) return;

    if (action === 'delete') {
      if (confirm(`Are you sure you want to delete ${selectedIds.length} strategies?`)) {
        const updatedStrategies = strategies.filter(s => !selectedIds.includes(s.id));
        setStrategies(updatedStrategies);
        localStorage.setItem('userStrategies', JSON.stringify(updatedStrategies));
        setSelectedStrategies(new Set());
      }
    } else {
      const newStatus = action === 'start' ? 'ACTIVE' : action === 'pause' ? 'PAUSED' : 'STOPPED';
      const updatedStrategies = strategies.map(s => 
        selectedIds.includes(s.id) ? { ...s, status: newStatus as any } : s
      );
      setStrategies(updatedStrategies);
      localStorage.setItem('userStrategies', JSON.stringify(updatedStrategies));
      setSelectedStrategies(new Set());
    }
  };

  const handleEditStrategy = (strategyId: string) => {
    const strategy = strategies.find(s => s.id === strategyId);
    if (strategy) {
      setSelectedStrategy(strategy);
      setShowDetails(true);
      setIsEditing(false);
    }
  };

  const handleToggleStrategy = async (strategyId: string) => {
    const strategy = strategies.find(s => s.id === strategyId);
    if (!strategy) return;
    
    const newStatus = strategy.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    
    // If activating a strategy, check if it has live trading setup
    if (newStatus === 'ACTIVE' && !strategy.connectionId) {
      alert('Please configure a ByBit connection for this strategy before activating live trading.');
      return;
    }
    
    const updatedStrategies = strategies.map(s => {
      if (s.id === strategyId) {
        return {
          ...s,
          status: newStatus
        };
      }
      return s;
    });
    
    setStrategies(updatedStrategies);
    localStorage.setItem('userStrategies', JSON.stringify(updatedStrategies));
    
    // If activating, start monitoring this strategy
    if (newStatus === 'ACTIVE') {
      console.log(`🤖 Strategy ${strategy.name} activated for live trading`);
    } else {
      console.log(`⏸️ Strategy ${strategy.name} paused`);
    }
  };

  const handleDeleteStrategy = (strategyId: string) => {
    if (confirm('Are you sure you want to delete this strategy?')) {
      const updatedStrategies = strategies.filter(strategy => strategy.id !== strategyId);
      setStrategies(updatedStrategies);
      localStorage.setItem('userStrategies', JSON.stringify(updatedStrategies));
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-8">
        <div className="text-center py-16">
          <div className="animate-spin text-6xl mb-4">🧠</div>
          <div className="text-holographic text-4xl font-orbitron font-bold mb-4">NEURAL SYNC</div>
          <div className="text-neon-cyan font-rajdhani text-xl">Analyzing AI Trading Algorithms</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen p-8 space-y-8">
      {/* Futuristic Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl animate-float"></div>
        <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl animate-float-delayed"></div>
      </div>

      {/* Header */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div className="relative">
            <h1 className="text-6xl font-orbitron font-black text-holographic mb-4">
              NEURAL STRATEGIES
            </h1>
            <p className="text-xl font-rajdhani text-neon-cyan uppercase tracking-[0.3em]">
              🧠 AI TRADING ALGORITHMS
            </p>
            <div className="absolute -inset-8 bg-gradient-to-r from-neon-cyan/10 via-neon-purple/10 to-neon-pink/10 blur-2xl opacity-50 animate-pulse-slow"></div>
          </div>
          
          <div className="flex items-center space-x-4">
            <GlassButton
              onClick={toggleLiveMonitoring}
              variant={liveMonitoring ? "red" : "green"}
              className="flex items-center space-x-3"
            >
              <span className={liveMonitoring ? 'animate-pulse' : ''}>
                {liveMonitoring ? '🔴' : '⭕'}
              </span>
              <span>{liveMonitoring ? 'Stop Monitor' : 'Start Monitor'}</span>
            </GlassButton>
            <GlassButton
              onClick={loadStrategyTrades}
              disabled={loadingTrades}
              variant="blue"
              className="flex items-center space-x-3"
            >
              <span className={loadingTrades ? 'animate-spin' : ''}>⚡</span>
              <span>{loadingTrades ? 'Syncing' : 'Refresh Trades'}</span>
            </GlassButton>
            <GlassButton
              onClick={() => setShowLogbook(true)}
              variant="purple"
              className="flex items-center space-x-3"
            >
              <span>📊</span>
              <span>Strategy Logbook</span>
            </GlassButton>
            <GlassButton
              onClick={() => navigate('/strategies/builder')}
              variant="cyan"
              className="flex items-center space-x-3"
            >
              <span>🚀</span>
              <span>Create AI Strategy</span>
            </GlassButton>
          </div>
        </div>

        {/* Live Trading Status */}
        <GlassCard 
          variant="neon" 
          color={connections.length > 0 ? 'green' : 'orange'} 
          className="p-6 mb-8 animate-fade-in"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`status-dot ${connections.length > 0 ? 'status-online' : 'status-offline'}`}></div>
              <div>
                <h3 className={`font-orbitron font-bold text-xl ${
                  connections.length > 0 ? 'text-neon-green' : 'text-neon-orange'
                }`}>
                  {connections.length > 0 ? 'NEURAL LINK ACTIVE' : 'AWAITING NEURAL LINK'}
                </h3>
                <p className="font-rajdhani text-gray-300">
                  {connections.length > 0 
                    ? `${connections.length} ByBit connection${connections.length > 1 ? 's' : ''} ready for live trading`
                    : 'Connect ByBit account to enable live strategy execution'
                  }
                  {liveMonitoring && (
                    <span className="ml-4 text-neon-cyan">
                      • Live monitoring active {lastUpdate && `• Last update: ${lastUpdate}`}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {connections.length === 0 && (
              <GlassButton
                onClick={() => navigate('/api')}
                variant="cyan"
              >
                Setup Neural Link
              </GlassButton>
            )}
          </div>
        </GlassCard>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <GlassMetric
              label="Total Strategies"
              value={strategies.length.toString()}
              change="Neural Networks"
              changeType="positive"
              icon="🧠"
              color="cyan"
            />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <GlassMetric
              label="Active Strategies"
              value={strategies.filter(s => s.status === 'ACTIVE').length.toString()}
              change="Live Trading"
              changeType="positive"
              icon="⚡"
              color="green"
            />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <GlassMetric
              label="Total P&L"
              value={`$${strategyTrades.reduce((sum, t) => sum + t.pnl, 0).toFixed(2)}`}
              change={`${strategyTrades.length} Trades`}
              changeType={strategyTrades.reduce((sum, t) => sum + t.pnl, 0) >= 0 ? 'positive' : 'negative'}
              icon="💎"
              color="purple"
            />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <GlassMetric
              label="Open Trades"
              value={strategyTrades.filter(t => t.status === 'OPEN').length.toString()}
              change={loadingTrades ? 'Syncing...' : 'Live Data'}
              changeType="positive"
              icon="🎯"
              color="orange"
            />
          </div>
        </div>

        {/* Controls and Filters */}
        <GlassCard variant="holographic" className="p-6 mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-6">
              {/* View Mode Toggle */}
              <div className="flex items-center space-x-3">
                <span className="text-neon-cyan font-rajdhani font-bold text-sm uppercase tracking-wider">View:</span>
                <div className="flex space-x-1 glass-panel p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1 rounded text-sm font-rajdhani font-bold transition-all duration-300 ${
                      viewMode === 'grid' ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    🔷 Grid
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1 rounded text-sm font-rajdhani font-bold transition-all duration-300 ${
                      viewMode === 'list' ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    📋 List
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-neon-purple font-rajdhani font-bold text-sm uppercase tracking-wider">Filter:</span>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="glass-input px-3 py-1 text-sm"
                  >
                    <option value="ALL">All Strategies</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PAUSED">Paused</option>
                    <option value="STOPPED">Stopped</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-neon-pink font-rajdhani font-bold text-sm uppercase tracking-wider">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="glass-input px-3 py-1 text-sm"
                  >
                    <option value="profit">Profit</option>
                    <option value="winRate">Win Rate</option>
                    <option value="created">Created Date</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Results Count */}
            <div className="text-sm text-gray-400 font-rajdhani">
              Showing {filteredStrategies.length} of {strategies.length} strategies
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedStrategies.size > 0 && (
            <div className="flex items-center justify-between p-4 glass-panel rounded-lg border border-neon-cyan/30 animate-fade-in">
              <div className="flex items-center space-x-3">
                <span className="text-neon-cyan font-rajdhani font-bold">
                  {selectedStrategies.size} strategies selected
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <GlassButton onClick={() => handleBulkAction('start')} variant="green" size="sm">
                  ▶️ Start All
                </GlassButton>
                <GlassButton onClick={() => handleBulkAction('pause')} variant="orange" size="sm">
                  ⏸️ Pause All
                </GlassButton>
                <GlassButton onClick={() => handleBulkAction('stop')} variant="purple" size="sm">
                  ⏹️ Stop All
                </GlassButton>
                <GlassButton onClick={() => handleBulkAction('delete')} variant="red" size="sm">
                  🗑️ Delete All
                </GlassButton>
                <GlassButton onClick={() => setSelectedStrategies(new Set())} variant="cyan" size="sm">
                  ✕ Clear
                </GlassButton>
              </div>
            </div>
          )}
        </GlassCard>

        {/* List View Header */}
        {viewMode === 'list' && filteredStrategies.length > 0 && (
          <div className="glass-panel p-4 mb-4">
            <div className="flex items-center space-x-4">
              <input
                type="checkbox"
                checked={selectedStrategies.size === filteredStrategies.length && filteredStrategies.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 accent-neon-cyan rounded"
              />
              <div className="flex-1 grid grid-cols-6 gap-4 items-center text-sm font-rajdhani font-bold text-neon-cyan uppercase tracking-wider">
                <div>Strategy</div>
                <div className="text-center">Status</div>
                <div className="text-center">Profit</div>
                <div className="text-center">Win Rate</div>
                <div className="text-center">Trades</div>
                <div className="text-center">Actions</div>
              </div>
            </div>
          </div>
        )}

        {/* Strategies Content */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStrategies.map((strategy, index) => (
              <div key={strategy.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <StrategyCard
                  strategy={strategy}
                  isSelected={selectedStrategies.has(strategy.id)}
                  onSelect={(checked) => handleSelectStrategy(strategy.id, checked)}
                  onEdit={() => handleEditStrategy(strategy.id)}
                  onToggle={() => handleToggleStrategy(strategy.id)}
                  onDelete={() => handleDeleteStrategy(strategy.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStrategies.map((strategy, index) => (
              <div key={strategy.id} className="animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
                <StrategyListRow
                  strategy={strategy}
                  isSelected={selectedStrategies.has(strategy.id)}
                  onSelect={(checked) => handleSelectStrategy(strategy.id, checked)}
                  onEdit={() => handleEditStrategy(strategy.id)}
                  onToggle={() => handleToggleStrategy(strategy.id)}
                  onDelete={() => handleDeleteStrategy(strategy.id)}
                />
              </div>
            ))}
          </div>
        )}

        {filteredStrategies.length === 0 && (
          <GlassCard variant="holographic" className="p-16 text-center animate-fade-in">
            <div className="text-8xl mb-6 animate-float">🤖</div>
            <h3 className="text-3xl font-orbitron font-bold text-holographic mb-4">
              NO NEURAL STRATEGIES DETECTED
            </h3>
            <p className="text-gray-400 font-rajdhani text-xl mb-8">
              Initialize your first AI-powered trading algorithm
            </p>
            <GlassButton 
              onClick={() => navigate('/strategies/builder')}
              variant="cyan"
              className="text-lg px-8 py-4"
            >
              🚀 Deploy First Neural Strategy
            </GlassButton>
          </GlassCard>
        )}

        {/* Strategy Trades Logbook Modal */}
        {showLogbook && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-lg z-50 flex items-center justify-center p-4 animate-fade-in">
            <GlassCard variant="holographic" className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-orbitron font-bold text-holographic">
                    📊 STRATEGY LOGBOOK
                  </h2>
                  <p className="text-neon-cyan font-rajdhani mt-2">
                    Neural Trading Activity Matrix
                  </p>
                </div>
                <GlassButton
                  onClick={() => setShowLogbook(false)}
                  variant="red"
                  size="sm"
                >
                  ✕
                </GlassButton>
              </div>

              {/* Tabs */}
              <div className="p-6 border-b border-white/10">
                <div className="flex space-x-1 glass-panel p-1 rounded-lg inline-flex">
                  <button
                    onClick={() => setLogbookTab('open')}
                    className={`px-6 py-3 rounded font-rajdhani font-bold transition-all duration-300 ${
                      logbookTab === 'open' ? 'bg-neon-green/20 text-neon-green' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    🟢 Open Trades ({strategyTrades.filter(t => t.status === 'OPEN').length})
                  </button>
                  <button
                    onClick={() => setLogbookTab('closed')}
                    className={`px-6 py-3 rounded font-rajdhani font-bold transition-all duration-300 ${
                      logbookTab === 'closed' ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    📈 Closed Trades ({strategyTrades.filter(t => t.status === 'CLOSED').length})
                  </button>
                  <button
                    onClick={() => setLogbookTab('positions')}
                    className={`px-6 py-3 rounded font-rajdhani font-bold transition-all duration-300 ${
                      logbookTab === 'positions' ? 'bg-neon-purple/20 text-neon-purple' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    🎯 Current Positions (0)
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {logbookTab === 'open' && (
                  <div className="space-y-4">
                    {strategyTrades.filter(t => t.status === 'OPEN').map((trade) => (
                      <div key={trade.id} className="glass-panel p-6 animate-slide-up">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`status-dot ${trade.type === 'LONG' ? 'status-online' : 'status-offline'}`}></div>
                            <div>
                              <h3 className="font-orbitron font-bold text-white text-lg">{trade.symbol}</h3>
                              <p className="text-neon-cyan font-rajdhani">
                                {trade.type} • Entry: ${trade.entryPrice.toFixed(2)} • Qty: {trade.quantity}
                              </p>
                              <p className="text-gray-400 text-sm font-rajdhani">
                                {new Date(trade.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-2xl font-orbitron font-bold ${
                              trade.pnl >= 0 ? 'text-neon-green' : 'text-neon-red'
                            }`}>
                              {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-400 font-rajdhani">Unrealized P&L</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {strategyTrades.filter(t => t.status === 'OPEN').length === 0 && (
                      <div className="text-center py-16">
                        <div className="text-6xl mb-4 animate-float">📊</div>
                        <div className="text-gray-400 font-rajdhani text-xl">No open trades</div>
                        <div className="text-gray-600 text-sm mt-2">Strategies haven't generated signals yet</div>
                      </div>
                    )}
                  </div>
                )}

                {logbookTab === 'closed' && (
                  <div className="space-y-4">
                    {strategyTrades.filter(t => t.status === 'CLOSED').map((trade) => (
                      <div key={trade.id} className="glass-panel p-6 animate-slide-up">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`w-3 h-3 rounded-full ${
                              trade.pnl >= 0 ? 'bg-neon-green' : 'bg-neon-red'
                            }`}></div>
                            <div>
                              <h3 className="font-orbitron font-bold text-white text-lg">{trade.symbol}</h3>
                              <p className="text-neon-cyan font-rajdhani">
                                {trade.type} • Entry: ${trade.entryPrice.toFixed(2)} • Exit: ${trade.exitPrice?.toFixed(2)}
                              </p>
                              <p className="text-gray-400 text-sm font-rajdhani">
                                {new Date(trade.timestamp).toLocaleDateString()} - {trade.exitTimestamp && new Date(trade.exitTimestamp).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-2xl font-orbitron font-bold ${
                              trade.pnl >= 0 ? 'text-neon-green' : 'text-neon-red'
                            }`}>
                              {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-400 font-rajdhani">Realized P&L</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {logbookTab === 'positions' && (
                  <div className="text-center py-16">
                    <div className="text-6xl mb-4 animate-float">🎯</div>
                    <div className="text-gray-400 font-rajdhani text-xl">No current positions</div>
                    <div className="text-gray-600 text-sm mt-2">Live positions will appear here</div>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategiesPage;