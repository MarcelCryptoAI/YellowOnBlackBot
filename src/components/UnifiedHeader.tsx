import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface UnifiedHeaderProps {
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({ isRefreshing, onRefresh }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', label: 'Neural Dashboard', icon: '🚀', color: 'cyan' },
    { path: '/manual-order', label: 'Quantum Orders', icon: '⚡', color: 'purple' },
    { path: '/positions-orders', label: 'Live Positions', icon: '📊', color: 'pink' },
    { path: '/trades', label: 'Trade Matrix', icon: '💎', color: 'green' },
    { path: '/strategies', label: 'AI Strategies', icon: '🧠', color: 'orange' },
    { path: '/api', label: 'Neural Links', icon: '🔧', color: 'yellow' }
  ];

  return (
    <header className="relative z-50 overflow-hidden">
      {/* Ultra Deep Background */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-3xl"></div>
      <div className="absolute inset-0 bg-neon-cyan/8"></div>
      
      {/* Holographic Grid Lines */}
      <div className="absolute inset-0 opacity-20">
        <div className="glow-line-x top-0"></div>
        <div className="glow-line-x bottom-0"></div>
      </div>
      
      <div className="relative px-8 py-6">
        <div className="max-w-[2000px] mx-auto">
          {/* Main Navigation Row */}
          <div className="flex items-center justify-between mb-6">
            {/* Left: Quantum Title */}
            <div className="relative">
              <h1 className="text-3xl font-orbitron font-black text-holographic tracking-wider">
                QUANTUM MATRIX
              </h1>
              <p className="text-sm font-rajdhani text-neon-cyan uppercase tracking-[0.3em] mt-1">
                Neural Trading Interface
              </p>
            </div>
            
            {/* Center: Navigation Matrix */}
            <nav className="flex items-center glass-panel px-4 py-3 border-neon-cyan/20">
              <div className="flex space-x-3">
                {menuItems.map((item, index) => {
                  const isActive = location.pathname === item.path;
                  const colorVar = `var(--neon-${item.color})`;
                  
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`
                        relative px-6 py-4 font-rajdhani font-bold transition-all duration-300
                        rounded-xl backdrop-blur-xl border-2
                        transform hover:scale-105 hover:-translate-y-1
                        animate-fade-in
                        ${isActive 
                          ? 'text-white bg-white/10 border-white/30' 
                          : 'text-gray-400 hover:text-white border-transparent hover:border-white/20'
                        }
                      `}
                      style={{ 
                        animationDelay: `${index * 0.05}s`,
                        borderColor: isActive ? colorVar : undefined,
                        boxShadow: isActive ? `0 0 40px ${colorVar}40, inset 0 0 20px ${colorVar}20` : undefined,
                        textShadow: isActive ? `0 0 20px ${colorVar}` : undefined,
                      }}
                    >
                      <div className="flex flex-col items-center space-y-1">
                        <span className="text-2xl" style={{ filter: isActive ? `drop-shadow(0 0 10px ${colorVar})` : undefined }}>
                          {item.icon}
                        </span>
                        <span className="text-xs uppercase tracking-widest">
                          {item.label}
                        </span>
                      </div>
                      
                      {/* Quantum Active Indicator */}
                      {isActive && (
                        <>
                          <div className="absolute inset-0 rounded-xl opacity-30"
                               style={{ background: `radial-gradient(circle at center, ${colorVar}20 0%, transparent 70%)` }}></div>
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 rounded-full"
                               style={{ backgroundColor: colorVar }}></div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>
            
            {/* Right: System Controls */}
            <div className="flex items-center space-x-4">
              {/* Neural Status */}
              <div className="glass-panel px-6 py-3 flex items-center space-x-3 border-neon-green/30">
                <div className="status-dot status-online"></div>
                <div className="flex flex-col">
                  <span className="text-neon-green font-rajdhani font-bold text-sm uppercase tracking-wider">
                    Neural Link Active
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </div>
              
              {/* Quantum Refresh */}
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="btn-neon-cyan flex items-center space-x-3 disabled:opacity-50"
              >
                <span className={`text-xl ${isRefreshing ? 'animate-spin' : ''}`}>
                  ⚡
                </span>
                <span className="font-rajdhani font-bold">
                  {isRefreshing ? 'SYNCING' : 'QUANTUM SYNC'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom Holographic Line */}
      <div className="glow-line-x bottom-0"></div>
    </header>
  );
};

export default UnifiedHeader;