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
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', description: 'Overview & Analytics' },
    { id: 'trades', label: 'Trades', icon: '💹', description: 'Live Positions' },
    { id: 'strategies', label: 'Strategies', icon: '🧠', description: 'AI Algorithms' },
    { id: 'api-config', label: 'API Config', icon: '🔧', description: 'Connections' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-primary-blue/20 backdrop-blur-xl bg-gradient-to-r from-black/80 via-gray-900/90 to-black/80 shadow-2xl shadow-black/50">
      {/* Premium Top Border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-blue to-transparent"></div>
      
      <div className="max-w-8xl mx-auto px-8 py-6">
        <div className="flex items-center justify-between">
          {/* Brand Section */}
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-4 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-blue/30 to-primary-purple/30 rounded-xl blur-lg animate-pulse-glow"></div>
                <img
                  src="/header_logo.png"
                  alt="CTB Logo"
                  className="relative h-14 w-auto drop-shadow-2xl group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="relative">
                <h1 className="text-3xl font-black bg-gradient-to-r from-primary-blue via-white to-primary-purple bg-clip-text text-transparent">
                  CRYPTO TRADING BOT
                </h1>
                <p className="text-info-cyan-light text-sm font-semibold tracking-wide">
                  ⚡ AI-Powered Trading Platform
                </p>
                <div className="absolute -inset-2 bg-gradient-to-r from-primary-blue/5 via-transparent to-primary-purple/5 blur-xl opacity-70"></div>
              </div>
            </div>
            
            {/* Premium Navigation */}
            <nav className="flex items-center bg-gradient-to-r from-black/50 to-gray-900/50 rounded-2xl p-2 border border-primary-blue/20 backdrop-blur-xl shadow-xl">
              {navItems.map((item) => (
                <div key={item.id} className="relative group">
                  <button
                    onClick={() => setCurrentTab(item.id)}
                    className={`relative px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                      currentTab === item.id
                        ? 'bg-gradient-to-r from-primary-blue to-primary-blue-dark text-white shadow-lg shadow-primary-blue/50 scale-105'
                        : 'text-info-cyan-light hover:text-white hover:bg-primary-blue/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{item.icon}</span>
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-bold">{item.label}</span>
                        <span className="text-xs opacity-75">{item.description}</span>
                      </div>
                    </div>
                    
                    {/* Active indicator */}
                    {currentTab === item.id && (
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary-blue rounded-full animate-pulse"></div>
                    )}
                  </button>
                  
                  {/* Hover effect */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary-blue/0 via-primary-blue/15 to-primary-purple/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              ))}
            </nav>
          </div>
          
          {/* Action Section */}
          <div className="flex items-center space-x-6">
            {/* Status Indicator */}
            <div className="flex items-center space-x-3 px-4 py-2 bg-gradient-to-r from-success-green/20 to-success-green/10 border border-success-green/30 rounded-xl">
              <div className="w-3 h-3 bg-success-green rounded-full animate-pulse shadow-lg shadow-success-green/50"></div>
              <span className="text-success-green-light font-semibold text-sm">Live Trading</span>
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 shadow-lg shadow-primary-blue/30"
            >
              <span className={`text-xl ${isRefreshing ? 'animate-spin' : 'hover:scale-110 transition-transform'}`}>
                🔄
              </span>
              <span className="font-bold">
                {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
              </span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Bottom glow effect */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-blue/50 to-transparent"></div>
    </header>
  );
};

export default Header;
