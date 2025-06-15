import React, { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'neon' | 'holographic' | 'data';
  color?: 'cyan' | 'purple' | 'pink' | 'green' | 'orange' | 'yellow';
  hover3d?: boolean;
  animated?: boolean;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  variant = 'default',
  color = 'cyan',
  hover3d = true,
  animated = false,
  onClick
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'neon':
        return `border-neon-${color}/30 hover:border-neon-${color}/60`;
      case 'holographic':
        return 'border-gradient bg-gradient-to-br from-white/5 via-transparent to-white/5';
      case 'data':
        return 'data-card';
      default:
        return '';
    }
  };

  const getAnimationClasses = () => {
    if (!animated) return '';
    return 'animate-fade-in';
  };

  const get3dClasses = () => {
    if (!hover3d) return '';
    return 'hover:transform hover:perspective-1000 hover:rotate-y-5 hover:scale-105';
  };

  return (
    <div
      className={`
        glass-card
        ${getVariantClasses()}
        ${getAnimationClasses()}
        ${get3dClasses()}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      style={{
        '--card-color': `var(--neon-${color})`,
      } as React.CSSProperties}
    >
      {variant === 'neon' && (
        <>
          <div className="absolute inset-0 rounded-[24px] opacity-0 hover:opacity-20 transition-opacity duration-300"
               style={{ background: `radial-gradient(circle at center, var(--card-color) 0%, transparent 70%)` }}></div>
          <div className="absolute -inset-[1px] rounded-[24px] opacity-0 hover:opacity-100 transition-opacity duration-300"
               style={{ 
                 background: `linear-gradient(135deg, var(--card-color), transparent, var(--card-color))`,
                 filter: 'blur(10px)',
                 zIndex: -1
               }}></div>
        </>
      )}
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

interface GlassMetricProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: string;
  color?: 'cyan' | 'purple' | 'pink' | 'green' | 'orange' | 'yellow';
}

export const GlassMetric: React.FC<GlassMetricProps> = ({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
  color = 'cyan'
}) => {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive': return 'text-neon-green';
      case 'negative': return 'text-neon-red';
      default: return 'text-gray-400';
    }
  };

  return (
    <GlassCard variant="neon" color={color} className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-rajdhani text-gray-400 uppercase tracking-wider mb-2">
            {label}
          </p>
          <div className="flex items-baseline space-x-3">
            <h3 className="text-3xl font-orbitron font-bold text-white">
              {value}
            </h3>
            {change && (
              <span className={`text-sm font-medium ${getChangeColor()}`}>
                {changeType === 'positive' ? '↑' : changeType === 'negative' ? '↓' : '→'} {change}
              </span>
            )}
          </div>
        </div>
        {icon && (
          <div className="text-3xl filter" style={{ filter: `drop-shadow(0 0 20px var(--neon-${color}))` }}>
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

interface GlassTableProps {
  headers: string[];
  rows: any[][];
  className?: string;
}

export const GlassTable: React.FC<GlassTableProps> = ({ headers, rows, className = '' }) => {
  return (
    <div className={`glass-panel rounded-xl overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {headers.map((header, index) => (
                <th key={index} className="px-6 py-4 text-left text-sm font-rajdhani font-bold text-gray-400 uppercase tracking-wider">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-6 py-4 text-sm text-gray-300">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const GlassButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'cyan' | 'purple' | 'pink' | 'green' | 'orange';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}> = ({ children, onClick, variant = 'cyan', size = 'md', className = '', disabled = false }) => {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`btn-neon-${variant} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};

export const GlassInput: React.FC<{
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}> = ({ type = 'text', value, onChange, placeholder, className = '', readOnly = false }) => {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`input-3d ${className}`}
    />
  );
};

export default GlassCard;