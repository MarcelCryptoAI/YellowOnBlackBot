// Header.tsx
import React from 'react';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentTab, setCurrentTab, isRefreshing, onRefresh }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'trades', label: 'Trades', icon: '💹' },
    { id: 'strategies', label: 'Strategies', icon: '🧠' },
    { id: 'api-config', label: 'API Config', icon: '🔧' },
  ];

  return (
    <header className="relative z-10 border-b border-gray-700/30 backdrop-blur-xl bg-black/60 p-6 shadow-2xl shadow-black/50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <img
                src="/header_logo.png"
                alt="CTB Logo"
                className="h-12 w-auto drop-shadow-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-yellow-600/20 rounded-lg blur-lg"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-gray-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                CRYPTO TRADING BOT
              </h1>
              <p className="text-gray-400 text-sm">AI-Powered Trading Platform</p>
            </div>
          </div>
          
          <nav className="flex space-x-1 bg-gradient-to-r from-gray-900/50 to-black/50 p-2 rounded-xl border border-gray-700/30 backdrop-blur-sm">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center space-x-2 ${
                  currentTab === item.id
                    ? 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-black shadow-lg shadow-yellow-400/30'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-blue-400/30 flex items-center space-x-2"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
