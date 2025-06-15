// Header.tsx
import React from 'react';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, setCurrentTab, isRefreshing, onRefresh }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🚀', color: 'cyan' },
    { id: 'trades', label: 'Trades', icon: '⚡', color: 'purple' },
    { id: 'strategies', label: 'Strategies', icon: '🧠', color: 'pink' },
    { id: 'api-config', label: 'API Config', icon: '🔧', color: 'green' },
  ];

  return (
    <header className="relative z-50 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/10 via-neon-purple/10 to-neon-pink/10 animate-gradient-x"></div>
      
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
                <h1 className="text-4xl font-black font-orbitron text-holographic tracking-wider">
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
                      <span className="text-xl">{item.icon}</span>
                      <span className="font-rajdhani font-semibold tracking-wide">{item.label}</span>
                    </div>
                    
                    {/* Active Indicator */}
                    {currentTab === item.id && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full h-0.5 bg-gradient-to-r from-transparent via-current to-transparent animate-pulse"></div>
                    )}
                  </button>
                ))}
              </div>
            </nav>
          </div>
          
          {/* Action Section */}
          <div className="flex items-center space-x-6">
            {/* Status Indicator with Holographic Effect */}
            <div className="glass-panel px-6 py-3 flex items-center space-x-3 border-neon-green/30 animate-fade-in">
              <div className="status-dot status-online"></div>
              <span className="text-neon-green font-rajdhani font-semibold tracking-wider uppercase">
                Live Trading
              </span>
              <div className="text-xs text-gray-400 font-mono">
                {new Date().toLocaleTimeString()}
              </div>
            </div>
            
            {/* Refresh Button with Neon Effect */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`
                btn-neon-cyan
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center space-x-3
                ${isRefreshing ? 'animate-pulse' : ''}
              `}
            >
              <span className={`text-xl ${isRefreshing ? 'animate-spin' : ''}`}>
                ⚡
              </span>
              <span className="font-rajdhani font-bold">
                {isRefreshing ? 'SYNCING...' : 'REFRESH'}
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