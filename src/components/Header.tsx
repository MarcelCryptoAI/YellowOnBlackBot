// Header.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
}

interface SystemStatus {
  backend: {
    online: boolean;
    version?: string;
  };
  bybit: {
    online: boolean;
    totalBalance: number;
    activeConnections: number;
  };
  openai: {
    online: boolean;
    monthlyUsage: number;
    remainingCredits: number;
  };
  strategies: {
    online: boolean;
    activeCount: number;
    pendingCount: number;
  };
}

export const Header: React.FC<HeaderProps> = ({ currentTab, setCurrentTab, isRefreshing, onRefresh }) => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    backend: { online: false },
    bybit: { online: false, totalBalance: 0, activeConnections: 0 },
    openai: { online: false, monthlyUsage: 0, remainingCredits: 0 },
    strategies: { online: false, activeCount: 0, pendingCount: 0 }
  });

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🚀', color: 'cyan' },
    { id: 'trades', label: 'Trades', icon: '⚡', color: 'purple' },
    { id: 'strategies', label: 'Strategies', icon: '🧠', color: 'pink' },
    { id: 'api-config', label: 'API Config', icon: '🔧', color: 'green' },
  ];

  // Fetch system status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // Check backend health
        const backendHealth = await api.healthCheck();
        
        // Get ByBit connections and calculate total balance
        const connections = await api.bybit.getConnections();
        let totalBalance = 0;
        let activeConnections = 0;
        
        if (connections.success && connections.connections) {
          activeConnections = connections.connections.length;
          connections.connections.forEach((conn: any) => {
            if (conn.data?.balance?.total) {
              totalBalance += conn.data.balance.total;
            }
          });
        }

        // Get OpenAI status (mock for now - will need actual API)
        const openaiStatus = {
          online: true,
          monthlyUsage: 12.45,
          remainingCredits: 87.55
        };

        // Get strategies status (mock for now - will need actual API)
        const strategiesStatus = {
          online: true,
          activeCount: 2,
          pendingCount: 1
        };

        setSystemStatus({
          backend: {
            online: backendHealth.success,
            version: backendHealth.version
          },
          bybit: {
            online: connections.success,
            totalBalance,
            activeConnections
          },
          openai: openaiStatus,
          strategies: strategiesStatus
        });
      } catch (error) {
        console.error('Failed to fetch system status:', error);
        setSystemStatus(prev => ({
          ...prev,
          backend: { online: false }
        }));
      }
    };

    fetchStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  return (
    <header className="relative z-50 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-2xl"></div>
      <div className="absolute inset-0 bg-neon-cyan/10"></div>
      
      {/* Top Glow Line */}
      <div className="glow-line-x top-0"></div>
      
      <div className="relative px-8 py-6">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between">
          {/* Brand Section */}
          <div className="flex items-center space-x-8">
            <div className="group relative">
              {/* Logo Container with 3D Effect */}
              <div className="relative transform-style-preserve-3d animate-float">
                <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/40 via-neon-purple/40 to-neon-pink/40 blur-2xl animate-pulse-slow"></div>
                <img
                  src="/header_logo.png"
                  alt="CTB Logo"
                  className="relative h-16 w-auto filter drop-shadow-[0_0_20px_rgba(0,255,255,0.8)] group-hover:scale-110 transition-all duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              
              {/* Title Section */}
              <div className="relative ml-6">
                <h1 className="text-xs font-black font-orbitron text-holographic tracking-wider">
                  CRYPTO TRADING BOT
                </h1>
                <p className="text-sm font-rajdhani text-neon-cyan mt-1 tracking-[0.3em] uppercase">
                  ⚡ AI-Powered Trading Platform
                </p>
              </div>
            </div>
            
            {/* Navigation with Glass Effect */}
            <nav className="flex items-center glass-panel px-2 py-2 border-neon-cyan/20">
              <div className="flex space-x-2">
                {navItems.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentTab(item.id)}
                    className={`
                      relative px-6 py-3 font-medium transition-all duration-300
                      ${currentTab === item.id 
                        ? `text-neon-${item.color} bg-neon-${item.color}/10 border-2 border-neon-${item.color}/50` 
                        : 'text-gray-400 hover:text-white border-2 border-transparent hover:border-white/20'
                      }
                      rounded-xl backdrop-blur-xl
                      transform hover:scale-105 hover:-translate-y-0.5
                      animate-fade-in
                    `}
                    style={{ 
                      animationDelay: `${index * 0.1}s`,
                      boxShadow: currentTab === item.id ? `0 0 30px var(--neon-${item.color})` : ''
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-xs">{item.icon}</span>
                      <span className="font-rajdhani font-semibold tracking-wide">{item.label}</span>
                    </div>
                    
                    {/* Active Indicator */}
                    {currentTab === item.id && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full h-0.5 bg-gradient-to-r from-transparent via-current to-transparent"></div>
                    )}
                  </button>
                ))}
              </div>
            </nav>
          </div>
          
          {/* Status Section */}
          <div className="flex items-center space-x-4">
            {/* Backend Status */}
            <div className={`glass-panel px-4 py-2 flex items-center space-x-2 ${systemStatus.backend.online ? 'border-neon-green/30' : 'border-neon-red/30'}`}>
              <div className={`status-dot ${systemStatus.backend.online ? 'status-online' : 'status-offline'}`}></div>
              <span className={`font-rajdhani font-semibold text-sm ${systemStatus.backend.online ? 'text-neon-green' : 'text-neon-red'}`}>
                Backend
              </span>
            </div>
            
            {/* ByBit API Status */}
            <div className={`glass-panel px-4 py-2 flex items-center space-x-2 ${systemStatus.bybit.online ? 'border-neon-blue/30' : 'border-neon-red/30'}`}>
              <div className={`status-dot ${systemStatus.bybit.online ? 'status-online' : 'status-offline'}`}></div>
              <span className={`font-rajdhani font-semibold text-sm ${systemStatus.bybit.online ? 'text-neon-blue' : 'text-neon-red'}`}>
                ByBit API
              </span>
              {systemStatus.bybit.online && (
                <span className="text-xs text-gray-400 font-mono">
                  {formatCurrency(systemStatus.bybit.totalBalance)}
                </span>
              )}
            </div>
            
            {/* OpenAI API Status */}
            <div className={`glass-panel px-4 py-2 flex items-center space-x-2 ${systemStatus.openai.online ? 'border-neon-purple/30' : 'border-neon-red/30'}`}>
              <div className={`status-dot ${systemStatus.openai.online ? 'status-online' : 'status-offline'}`}></div>
              <span className={`font-rajdhani font-semibold text-sm ${systemStatus.openai.online ? 'text-neon-purple' : 'text-neon-red'}`}>
                OpenAI API
              </span>
              {systemStatus.openai.online && (
                <span className="text-xs text-gray-400 font-mono">
                  {formatCurrency(systemStatus.openai.monthlyUsage)}
                </span>
              )}
            </div>
            
            {/* Strategies Status */}
            <div className={`glass-panel px-4 py-2 flex items-center space-x-2 ${systemStatus.strategies.online ? 'border-neon-yellow/30' : 'border-neon-red/30'}`}>
              <div className={`status-dot ${systemStatus.strategies.online ? (systemStatus.strategies.activeCount > 0 ? 'status-online' : 'status-warning') : 'status-offline'}`}></div>
              <span className={`font-rajdhani font-semibold text-sm ${systemStatus.strategies.online ? 'text-neon-yellow' : 'text-neon-red'}`}>
                Strategies
              </span>
              {systemStatus.strategies.online && (
                <span className="text-xs text-gray-400 font-mono">
                  {systemStatus.strategies.activeCount} Active
                </span>
              )}
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`
                btn-neon-cyan px-4 py-2
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center space-x-2
              `}
            >
              <span className={`text-xs ${isRefreshing ? 'animate-spin' : ''}`}>⚡</span>
              <span className="font-rajdhani font-bold text-sm">
                {isRefreshing ? 'SYNC' : 'REFRESH'}
              </span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Bottom Glow Line */}
      <div className="glow-line-x bottom-0"></div>
    </header>
  );
};

export default Header;