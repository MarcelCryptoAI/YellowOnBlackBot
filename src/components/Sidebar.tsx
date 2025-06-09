import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊', description: 'Overview & Analytics' },
    { path: '/manual-order', label: 'Manual Order', icon: '⚡', description: 'Place Orders' },
    { path: '/trades', label: 'Trades', icon: '💹', description: 'Trade History' },
    { path: '/strategies', label: 'Strategies', icon: '🧠', description: 'AI Strategies' },
    { path: '/api', label: 'API Config', icon: '🔧', description: 'API Settings' }
  ];

  return (
    <div className={`sticky top-[73px] h-[calc(100vh-73px)] bg-gradient-to-b from-gray-900 to-black border-r border-gray-600/30 shadow-2xl z-40 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Toggle Header */}
      <div className="p-4 border-b border-gray-700/30">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-300">Navigation</span>
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-800/50 rounded-lg transition-all duration-300 text-gray-400 hover:text-white"
          >
            {isCollapsed ? '▶' : '◀'}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 group ${
                  isActive
                    ? 'bg-gradient-to-r from-primary-blue to-primary-blue-dark text-white shadow-lg shadow-primary-blue/30'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/50 hover:shadow-lg'
                }`}
                title={isCollapsed ? `${item.label} - ${item.description}` : undefined}
              >
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                {!isCollapsed && (
                  <div className="flex-1 text-left">
                    <div className="font-semibold">{item.label}</div>
                    <div className={`text-xs ${isActive ? 'text-black/70' : 'text-gray-400 group-hover:text-gray-300'}`}>
                      {item.description}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700/30">
        {!isCollapsed && (
          <div className="text-xs text-gray-400 text-center">
            <div className="mb-2">© 2025 ArIe Platform</div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Live Data</span>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="flex justify-center">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;