import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
  config?: any; // Strategy configuration data for cloning
}

// Utility function for currency formatting
function toCurrency(v: number) {
  return "$" + (+v).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

// Strategy Card Component
const StrategyCard: React.FC<{ strategy: Strategy; onEdit: () => void; onToggle: () => void; onDelete: () => void }> = ({ 
  strategy, 
  onEdit, 
  onToggle, 
  onDelete 
}) => (
  <div className="relative group">
    <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-white/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
    <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-blue-400/40 transition-all duration-300 shadow-2xl shadow-black/50 hover:shadow-yellow-400/10">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-lg tracking-wide drop-shadow-md">{strategy.name}</h3>
          <p className="text-sm text-gray-400">{strategy.symbol} • {strategy.timeframe}</p>
        </div>
        <span className={`text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider shadow-lg ${
          strategy.status === 'ACTIVE' 
            ? 'bg-gradient-to-r from-green-500/20 to-green-400/20 text-green-300 border border-green-500/40 shadow-green-400/20'
            : strategy.status === 'PAUSED'
            ? 'bg-gradient-to-r from-orange-500/20 to-orange-400/20 text-orange-300 border border-orange-500/40 shadow-orange-400/20'
            : strategy.status === 'BACKTESTING'
            ? 'bg-gradient-to-r from-blue-500/20 to-blue-400/20 text-blue-300 border border-blue-500/40 shadow-blue-400/20'
            : strategy.status === 'OPTIMIZING'
            ? 'bg-gradient-to-r from-purple-500/20 to-purple-400/20 text-purple-300 border border-purple-500/40 shadow-purple-400/20'
            : 'bg-gradient-to-r from-red-500/20 to-red-400/20 text-red-300 border border-red-500/40 shadow-red-400/20'
        }`}>
          {strategy.status}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-300 mb-4 line-clamp-2">{strategy.description}</p>

      {/* Indicators */}
      <div className="flex flex-wrap gap-1 mb-4">
        {strategy.indicators.slice(0, 3).map((indicator, index) => (
          <span key={index} className="px-2 py-1 text-xs bg-gray-800/50 text-gray-300 border border-gray-600/40 rounded">
            {indicator}
          </span>
        ))}
        {strategy.indicators.length > 3 && (
          <span className="px-2 py-1 text-xs bg-gray-800/50 text-gray-400 border border-gray-600/40 rounded">
            +{strategy.indicators.length - 3} more
          </span>
        )}
      </div>

      {/* ML Model Badge */}
      {strategy.mlModel && (
        <div className="mb-4">
          <span className="px-3 py-1 text-xs bg-gradient-to-r from-purple-500/20 to-purple-400/20 text-purple-300 border border-purple-500/40 rounded-full">
            🤖 {strategy.mlModel}
          </span>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="text-center p-3 bg-gray-900/50 rounded-lg border border-gray-700/40">
          <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Profit</div>
          <div className={`text-lg font-bold ${strategy.profit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {strategy.profit >= 0 ? '+' : ''}{toCurrency(strategy.profit)}
          </div>
        </div>
        <div className="text-center p-3 bg-gray-900/50 rounded-lg border border-gray-700/40">
          <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Win Rate</div>
          <div className="text-lg font-bold text-cyan-300">{strategy.winRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* Risk Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Risk Score</span>
          <span>{strategy.riskScore}/10</span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              strategy.riskScore <= 3 ? 'bg-green-400' : 
              strategy.riskScore <= 6 ? 'bg-orange-400' : 'bg-red-400'
            }`}
            style={{ width: `${strategy.riskScore * 10}%` }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={onEdit}
          className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 shadow-lg hover:shadow-blue-400/30"
        >
          📊 Details
        </button>
        <button
          onClick={onToggle}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 shadow-lg ${
            strategy.status === 'ACTIVE'
              ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white hover:shadow-yellow-400/30'
              : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white hover:shadow-green-400/30'
          }`}
        >
          {strategy.status === 'ACTIVE' ? '⏸️ Pause' : '▶️ Start'}
        </button>
        <button
          onClick={onDelete}
          className="p-2 bg-gradient-to-r from-red-600/80 to-red-500/80 hover:from-red-500 hover:to-red-400 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-red-400/30"
        >
          🗑️
        </button>
      </div>
      
      {/* Edit Button - Goes to Wizard */}
      <div className="mt-3">
        <button
          onClick={() => {
            // Save strategy for editing in wizard
            localStorage.setItem('strategyToEdit', JSON.stringify(strategy));
            window.location.href = '/strategies/builder';
          }}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 shadow-lg hover:shadow-purple-400/30 flex items-center justify-center space-x-2"
        >
          <span>✏️</span>
          <span>Edit in Wizard</span>
        </button>
      </div>

      {/* Created Date */}
      <div className="text-xs text-gray-500 mt-3 text-center">
        Created: {new Date(strategy.createdAt).toLocaleDateString()}
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

  // Load strategies from localStorage or API
  useEffect(() => {
    const loadStrategies = () => {
      // Load from localStorage first
      const saved = localStorage.getItem('userStrategies');
      if (saved) {
        try {
          const parsedStrategies = JSON.parse(saved);
          setStrategies(parsedStrategies);
        } catch (error) {
          console.error('Error parsing saved strategies:', error);
          setStrategies([]);
        }
      } else {
        setStrategies([]);
      }
      setLoading(false);
    };

    setTimeout(loadStrategies, 500);
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

  const handleEditStrategy = (strategyId: string) => {
    const strategy = strategies.find(s => s.id === strategyId);
    if (strategy) {
      setSelectedStrategy(strategy);
      setShowDetails(true);
      setIsEditing(false);
    }
  };

  const handleSaveStrategy = () => {
    if (selectedStrategy) {
      setStrategies(prev => prev.map(strategy => 
        strategy.id === selectedStrategy.id ? selectedStrategy : strategy
      ));
      
      // Save to localStorage
      const updatedStrategies = strategies.map(strategy => 
        strategy.id === selectedStrategy.id ? selectedStrategy : strategy
      );
      localStorage.setItem('userStrategies', JSON.stringify(updatedStrategies));
      
      setIsEditing(false);
      alert('Strategy updated successfully!');
    }
  };

  const updateSelectedStrategy = (field: string, value: any) => {
    if (selectedStrategy) {
      setSelectedStrategy({
        ...selectedStrategy,
        [field]: value
      });
    }
  };

  const handleToggleStrategy = (strategyId: string) => {
    setStrategies(prev => prev.map(strategy => {
      if (strategy.id === strategyId) {
        return {
          ...strategy,
          status: strategy.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
        };
      }
      return strategy;
    }));
  };

  const handleDeleteStrategy = (strategyId: string) => {
    if (confirm('Are you sure you want to delete this strategy?')) {
      setStrategies(prev => prev.filter(strategy => strategy.id !== strategyId));
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center py-16">
          <div className="animate-spin text-6xl mb-4">🧠</div>
          <div className="text-white text-xl font-bold">Loading AI Strategies...</div>
          <div className="text-gray-400 mt-2">Analyzing your trading algorithms</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-white via-gray-200 to-blue-400 bg-clip-text text-transparent drop-shadow-lg">
            🧠 AI Trading Strategies
          </h2>
          <p className="text-gray-400 mt-2">Machine Learning powered trading algorithms</p>
        </div>
        <button 
          onClick={() => navigate('/strategies/builder')}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-500 rounded-lg blur opacity-75 group-hover:opacity-100 transition-all duration-300"></div>
          <div className="relative bg-gradient-to-r from-blue-400 to-blue-500 hover:from-yellow-300 hover:to-blue-400 px-6 py-3 rounded-lg text-black font-bold transition-all duration-300 shadow-2xl shadow-yellow-400/25 flex items-center space-x-2">
            <span>🚀</span>
            <span>Maak Nieuwe AI & ML Strategy</span>
          </div>
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-black to-gray-900 p-4 rounded-xl border border-gray-600/30">
          <div className="text-2xl font-bold text-white">{strategies.length}</div>
          <div className="text-sm text-gray-400">Total Strategies</div>
        </div>
        <div className="bg-gradient-to-br from-black to-gray-900 p-4 rounded-xl border border-gray-600/30">
          <div className="text-2xl font-bold text-green-300">{strategies.filter(s => s.status === 'ACTIVE').length}</div>
          <div className="text-sm text-gray-400">Active</div>
        </div>
        <div className="bg-gradient-to-br from-black to-gray-900 p-4 rounded-xl border border-gray-600/30">
          <div className="text-2xl font-bold text-white">
            {toCurrency(strategies.reduce((sum, s) => sum + s.profit, 0))}
          </div>
          <div className="text-sm text-gray-400">Total Profit</div>
        </div>
        <div className="bg-gradient-to-br from-black to-gray-900 p-4 rounded-xl border border-gray-600/30">
          <div className="text-2xl font-bold text-cyan-300">
            {(strategies.reduce((sum, s) => sum + s.winRate, 0) / strategies.length || 0).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-400">Avg Win Rate</div>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 text-sm">Filter:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-gray-900 border border-gray-600/40 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-400/60 focus:outline-none"
            >
              <option value="ALL">All Strategies</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="STOPPED">Stopped</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 text-sm">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-900 border border-gray-600/40 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-400/60 focus:outline-none"
            >
              <option value="profit">Profit</option>
              <option value="winRate">Win Rate</option>
              <option value="created">Created Date</option>
            </select>
          </div>
        </div>
        <div className="text-sm text-gray-400">
          Showing {filteredStrategies.length} of {strategies.length} strategies
        </div>
      </div>

      {/* Strategies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStrategies.map((strategy) => (
          <StrategyCard
            key={strategy.id}
            strategy={strategy}
            onEdit={() => handleEditStrategy(strategy.id)}
            onToggle={() => handleToggleStrategy(strategy.id)}
            onDelete={() => handleDeleteStrategy(strategy.id)}
          />
        ))}
      </div>

      {filteredStrategies.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4 opacity-50">🤖</div>
          <h3 className="text-xl font-bold text-gray-300 mb-2">No Strategies Found</h3>
          <p className="text-gray-500 mb-6">Create your first AI-powered trading strategy to get started.</p>
          <button 
            onClick={() => navigate('/strategies/builder')}
            className="bg-gradient-to-r from-blue-400 to-blue-500 hover:from-yellow-300 hover:to-blue-400 px-6 py-3 rounded-lg text-black font-bold transition-all duration-300 shadow-lg"
          >
            🚀 Create First Strategy
          </button>
        </div>
      )}

      {/* Strategy Details Modal */}
      {showDetails && selectedStrategy && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] bg-gradient-to-b from-gray-900 to-black rounded-xl border border-gray-600/30 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-700/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedStrategy.name}</h2>
                  <p className="text-gray-400 mt-1">{selectedStrategy.symbol} • {selectedStrategy.timeframe}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300"
                  >
                    <span>{isEditing ? '👁️' : '✏️'}</span>
                    <span>{isEditing ? 'View' : 'Edit'}</span>
                  </button>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="p-2 hover:bg-gray-800 rounded transition-all"
                  >
                    <span className="text-gray-400 text-xl">✕</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Left Column - Strategy Info */}
                <div className="space-y-6">
                  {/* Performance Overview */}
                  <div className="bg-gradient-to-br from-gray-900/50 to-black/50 p-6 rounded-xl border border-gray-600/30">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                      <span className="mr-2">📊</span>
                      Performance Overview
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                        <div className="text-2xl font-bold text-green-300">
                          {selectedStrategy.profit >= 0 ? '+' : ''}{toCurrency(selectedStrategy.profit)}
                        </div>
                        <div className="text-xs text-gray-400">Total Profit</div>
                      </div>
                      <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                        <div className="text-2xl font-bold text-cyan-300">{selectedStrategy.winRate.toFixed(1)}%</div>
                        <div className="text-xs text-gray-400">Win Rate</div>
                      </div>
                      <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                        <div className="text-2xl font-bold text-white">{selectedStrategy.trades}</div>
                        <div className="text-xs text-gray-400">Total Trades</div>
                      </div>
                      <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-300">{selectedStrategy.riskScore}/10</div>
                        <div className="text-xs text-gray-400">Risk Score</div>
                      </div>
                    </div>
                  </div>

                  {/* Strategy Configuration */}
                  <div className="bg-gradient-to-br from-gray-900/50 to-black/50 p-6 rounded-xl border border-gray-600/30">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                      <span className="mr-2">⚙️</span>
                      Configuration
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-gray-400">Strategy Name</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={selectedStrategy.name}
                              onChange={(e) => updateSelectedStrategy('name', e.target.value)}
                              className="w-full p-2 bg-gray-900 border border-gray-600/40 rounded text-white focus:border-blue-400/60 focus:outline-none"
                            />
                          ) : (
                            <div className="text-white font-medium">{selectedStrategy.name}</div>
                          )}
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Trading Pair</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={selectedStrategy.symbol}
                              onChange={(e) => updateSelectedStrategy('symbol', e.target.value)}
                              className="w-full p-2 bg-gray-900 border border-gray-600/40 rounded text-white focus:border-blue-400/60 focus:outline-none"
                            />
                          ) : (
                            <div className="text-white font-medium">{selectedStrategy.symbol}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-gray-400">Timeframe</label>
                          {isEditing ? (
                            <select
                              value={selectedStrategy.timeframe}
                              onChange={(e) => updateSelectedStrategy('timeframe', e.target.value)}
                              className="w-full p-2 bg-gray-900 border border-gray-600/40 rounded text-white focus:border-blue-400/60 focus:outline-none"
                            >
                              <option value="5m">5 minutes</option>
                              <option value="15m">15 minutes</option>
                              <option value="30m">30 minutes</option>
                              <option value="1h">1 hour</option>
                              <option value="4h">4 hours</option>
                              <option value="1d">1 day</option>
                            </select>
                          ) : (
                            <div className="text-white font-medium">{selectedStrategy.timeframe}</div>
                          )}
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Status</label>
                          {isEditing ? (
                            <select
                              value={selectedStrategy.status}
                              onChange={(e) => updateSelectedStrategy('status', e.target.value)}
                              className="w-full p-2 bg-gray-900 border border-gray-600/40 rounded text-white focus:border-blue-400/60 focus:outline-none"
                            >
                              <option value="ACTIVE">Active</option>
                              <option value="PAUSED">Paused</option>
                              <option value="STOPPED">Stopped</option>
                              <option value="BACKTESTING">Backtesting</option>
                              <option value="OPTIMIZING">Optimizing</option>
                            </select>
                          ) : (
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`w-2 h-2 rounded-full ${
                                selectedStrategy.status === 'ACTIVE' ? 'bg-green-400' : 
                                selectedStrategy.status === 'PAUSED' ? 'bg-orange-400' : 'bg-red-400'
                              }`}></span>
                              <span className="text-white font-medium">{selectedStrategy.status}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm text-gray-400">Description</label>
                        {isEditing ? (
                          <textarea
                            value={selectedStrategy.description}
                            onChange={(e) => updateSelectedStrategy('description', e.target.value)}
                            rows={3}
                            className="w-full p-2 bg-gray-900 border border-gray-600/40 rounded text-white focus:border-blue-400/60 focus:outline-none resize-none"
                          />
                        ) : (
                          <div className="text-white">{selectedStrategy.description}</div>
                        )}
                      </div>

                      <div>
                        <label className="text-sm text-gray-400">Risk Score (1-10)</label>
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={selectedStrategy.riskScore}
                            onChange={(e) => updateSelectedStrategy('riskScore', parseInt(e.target.value))}
                            className="w-full p-2 bg-gray-900 border border-gray-600/40 rounded text-white focus:border-blue-400/60 focus:outline-none"
                          />
                        ) : (
                          <div className="text-blue-300 font-medium">{selectedStrategy.riskScore}/10</div>
                        )}
                      </div>

                      {selectedStrategy.mlModel && (
                        <div>
                          <label className="text-sm text-gray-400">ML Model</label>
                          <div className="text-purple-300 font-medium">🤖 {selectedStrategy.mlModel}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Indicators */}
                  <div className="bg-gradient-to-br from-gray-900/50 to-black/50 p-6 rounded-xl border border-gray-600/30">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                      <span className="mr-2">📈</span>
                      Indicators ({selectedStrategy.indicators.length})
                    </h3>
                    
                    <div className="flex flex-wrap gap-2">
                      {selectedStrategy.indicators.map((indicator, index) => (
                        <span key={index} className="px-3 py-1 text-sm bg-gray-800/50 text-gray-300 border border-gray-600/40 rounded-full">
                          {indicator}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column - Advanced Metrics */}
                <div className="space-y-6">
                  {/* Live Trading Stats */}
                  <div className="bg-gradient-to-br from-gray-900/50 to-black/50 p-6 rounded-xl border border-gray-600/30">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                      <span className="mr-2">📉</span>
                      Live Trading Statistics
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-gray-400">Best Trade</label>
                          <div className="text-green-300 font-bold">+$87.45</div>
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Worst Trade</label>
                          <div className="text-red-300 font-bold">-$23.12</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-gray-400">Avg Win</label>
                          <div className="text-white font-medium">$45.23</div>
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Avg Loss</label>
                          <div className="text-white font-medium">$18.67</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-gray-400">Profit Factor</label>
                          <div className="text-cyan-300 font-bold">2.42</div>
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Max Drawdown</label>
                          <div className="text-red-300 font-bold">-8.3%</div>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm text-gray-400">R:R Ratio</label>
                        <div className="text-blue-300 font-bold">1:2.4</div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Trades */}
                  <div className="bg-gradient-to-br from-gray-900/50 to-black/50 p-6 rounded-xl border border-gray-600/30">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                      <span className="mr-2">🔄</span>
                      Recent Trades
                    </h3>
                    
                    <div className="space-y-3">
                      {[
                        { date: '2024-01-20', type: 'LONG', pnl: 45.67, status: 'WIN' },
                        { date: '2024-01-19', type: 'SHORT', pnl: -12.34, status: 'LOSS' },
                        { date: '2024-01-18', type: 'LONG', pnl: 78.90, status: 'WIN' },
                        { date: '2024-01-17', type: 'SHORT', pnl: 23.45, status: 'WIN' },
                        { date: '2024-01-16', type: 'LONG', pnl: -8.76, status: 'LOSS' },
                      ].map((trade, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-900/30 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className={`w-2 h-2 rounded-full ${
                              trade.type === 'LONG' ? 'bg-green-400' : 'bg-red-400'
                            }`}></span>
                            <div>
                              <div className="text-white text-sm font-medium">{trade.type}</div>
                              <div className="text-gray-400 text-xs">{trade.date}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-bold ${trade.pnl >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                              {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                            </div>
                            <div className={`text-xs ${trade.status === 'WIN' ? 'text-green-400' : 'text-red-400'}`}>
                              {trade.status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Market Analysis */}
                  <div className="bg-gradient-to-br from-gray-900/50 to-black/50 p-6 rounded-xl border border-gray-600/30">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                      <span className="mr-2">🎯</span>
                      Market Analysis
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-gray-400">Best Market Conditions</label>
                        <div className="text-white">Trending markets with medium volatility</div>
                      </div>
                      
                      <div>
                        <label className="text-sm text-gray-400">Worst Market Conditions</label>
                        <div className="text-white">Sideways choppy markets</div>
                      </div>
                      
                      <div>
                        <label className="text-sm text-gray-400">Optimal Trading Hours</label>
                        <div className="text-white">8:00 - 16:00 UTC (London/NY overlap)</div>
                      </div>

                      <div>
                        <label className="text-sm text-gray-400">Strategy Strengths</label>
                        <div className="space-y-1 text-sm">
                          <div className="text-green-300">• Strong trend detection</div>
                          <div className="text-green-300">• Good exit timing</div>
                          <div className="text-green-300">• Risk management</div>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm text-gray-400">Areas for Improvement</label>
                        <div className="space-y-1 text-sm">
                          <div className="text-cyan-300">• Entry timing could be better</div>
                          <div className="text-cyan-300">• Consider adding volume filter</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-700/30">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  Created: {new Date(selectedStrategy.createdAt).toLocaleString()}
                  {selectedStrategy.id && (
                    <span className="ml-4">ID: {selectedStrategy.id}</span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="bg-gradient-to-r from-gray-600 to-gray-500 hover:from-gray-500 hover:to-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300"
                      >
                        ❌ Cancel
                      </button>
                      <button
                        onClick={handleSaveStrategy}
                        className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300"
                      >
                        💾 Save Changes
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => navigate('/strategies/builder')}
                        className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300"
                      >
                        🚀 Create Similar
                      </button>
                      <button
                        onClick={() => {
                          // Clone strategy by pre-filling builder with current strategy data
                          if (selectedStrategy.config) {
                            localStorage.setItem('strategyToClone', JSON.stringify(selectedStrategy.config));
                          }
                          navigate('/strategies/builder');
                        }}
                        className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300"
                      >
                        📋 Clone Strategy
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategiesPage;