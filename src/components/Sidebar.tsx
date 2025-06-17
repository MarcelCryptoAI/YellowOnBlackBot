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
    { path: '/dashboard', label: 'Dashboard', icon: '🚀', color: 'cyan', description: 'Overview & Analytics' },
    { path: '/manual-order', label: 'Manual Order', icon: '⚡', color: 'purple', description: 'Place Orders' },
    { path: '/positions-orders', label: 'Positions', icon: '📊', color: 'pink', description: 'Manage Positions' },
    { path: '/trades', label: 'Trades', icon: '💎', color: 'green', description: 'Trade History' },
    { path: '/strategies', label: 'Strategies', icon: '🧠', color: 'orange', description: 'AI Strategies' },
    { path: '/automation/engine', label: 'Strategy Engine', icon: '🤖', color: 'blue', description: 'Auto Trading' },
    { path: '/automation/risk', label: 'Risk Manager', icon: '🛡️', color: 'red', description: 'Risk Control' },
    { path: '/automation/monitoring', label: 'Monitoring', icon: '📈', color: 'emerald', description: 'System Health' },
    { path: '/api', label: 'API Config', icon: '🔧', color: 'yellow', description: 'API Settings' }
  ];

  return (
    <div className={`sticky top-0 h-screen glass-panel border-r border-white/10 transition-all duration-500 ease-in-out ${
      isCollapsed ? 'w-20' : 'w-72'
    } transform-style-preserve-3d`}
    style={{
      transform: `perspective(1000px) rotateY(${isCollapsed ? '-2deg' : '0deg'})`,
    }}>
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-neon-purple/5 via-transparent to-neon-cyan/5 opacity-50"></div>
      
      {/* Vertical Glow Line */}
      <div className="glow-line-y right-0"></div>
      
      {/* Toggle Header */}
      <div className="relative p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="animate-fade-in">
              <h2 className="text-lg font-rajdhani font-bold text-gradient uppercase tracking-wider">
                Navigation
              </h2>
              <p className="text-xs text-gray-500 mt-1">System Control</p>
            </div>
          )}
          <button
            onClick={onToggle}
            className="relative p-3 rounded-xl glass-panel border border-white/10 
                     hover:border-neon-cyan/50 transition-all duration-300
                     hover:shadow-neon-cyan transform hover:scale-110"
          >
            <span className={`block transition-transform duration-500 ${isCollapsed ? 'rotate-180' : ''}`}>
              {isCollapsed ? '→' : '←'}
            </span>
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="relative flex-1 p-4 overflow-y-auto">
        <div className="space-y-2">
          {menuItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            const colorVar = `var(--neon-${item.color})`;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`
                  w-full relative group
                  transition-all duration-300 ease-out
                  transform hover:translate-x-1
                  animate-fade-in
                `}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className={`
                  relative p-4 rounded-xl
                  ${isActive 
                    ? 'glass-card border-2' 
                    : 'glass-panel border border-transparent hover:border-white/20'
                  }
                  transition-all duration-300
                  ${!isCollapsed ? 'pr-4' : ''}
                `}
                style={{
                  borderColor: isActive ? colorVar : undefined,
                  boxShadow: isActive ? `0 0 30px ${colorVar}40` : undefined,
                }}>
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-4'}`}>
                    {/* Icon with 3D effect */}
                    <div className={`
                      relative text-2xl
                      ${isActive ? 'animate-float' : 'group-hover:animate-bounce-slow'}
                      transition-all duration-300
                    `}
                    style={{
                      filter: isActive ? `drop-shadow(0 0 20px ${colorVar})` : undefined,
                    }}>
                      {item.icon}
                    </div>
                    
                    {!isCollapsed && (
                      <div className="flex-1 text-left animate-fade-in">
                        <div className={`
                          font-rajdhani font-bold tracking-wide
                          ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}
                          transition-colors duration-300
                        `}>
                          {item.label}
                        </div>
                        <div className={`
                          text-xs mt-0.5
                          ${isActive ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-400'}
                          transition-colors duration-300
                        `}>
                          {item.description}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Active Indicator */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                         style={{ backgroundColor: colorVar }}></div>
                  )}
                  
                  {/* Hover Effect */}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                         style={{ 
                           background: `radial-gradient(circle at center, ${colorVar}10 0%, transparent 70%)` 
                         }}></div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer Section */}
      <div className="relative p-6 border-t border-white/10">
        {!isCollapsed ? (
          <div className="space-y-4 animate-fade-in">
            {/* System Status */}
            <div className="glass-panel p-4 rounded-xl border border-neon-green/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-rajdhani text-gray-400 uppercase tracking-wider">System Status</span>
                <div className="status-dot status-online"></div>
              </div>
              <div className="text-2xl font-orbitron font-bold text-neon-green">
                ONLINE
              </div>
              <div className="text-xs text-gray-500 mt-1">All systems operational</div>
            </div>
            
            {/* Version Info */}
            <div className="text-center">
              <div className="text-xs text-gray-500">© 2025 ArIe Platform</div>
              <div className="text-xs text-neon-cyan mt-1 font-mono">v2.0.0</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <div className="status-dot status-online"></div>
            <div className="text-xs text-gray-500 writing-mode-vertical transform rotate-180">
              v2.0
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;