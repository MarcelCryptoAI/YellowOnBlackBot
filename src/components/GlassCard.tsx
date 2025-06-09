import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'accent' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  neonColor?: string;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '',
  variant = 'default',
  size = 'md',
  neonColor,
  onClick
}) => {
  const neonColors = {
    default: 'before:from-[#07d7fa] before:via-[#942dff] before:to-[#ff2ef8]',
    accent: 'before:from-[#ff2ef8] before:via-[#4efcff] before:to-[#942dff]',
    success: 'before:from-[#00ff88] before:via-[#00d4ff] before:to-[#4efcff]',
    danger: 'before:from-[#ff0080] before:via-[#ff2ef8] before:to-[#942dff]'
  };

  const sizes = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10'
  };

  return (
    <div className={`relative ${className}`} onClick={onClick}>
      <div className={`
        rounded-3xl
        bg-gradient-to-br from-[#0A1134] to-[#181432]
        p-1
        shadow-[12px_16px_48px_0_rgba(27,22,77,0.7)]
        before:content-[''] before:absolute before:inset-0 before:rounded-3xl before:-z-10
        before:bg-gradient-to-tr ${neonColor || neonColors[variant]}
        before:blur-[4px] before:opacity-60
        hover:scale-[1.03] hover:shadow-[24px_32px_64px_0_rgba(80,0,210,0.6)] 
        transition-all duration-300
        ${onClick ? 'cursor-pointer' : ''}
      `}>
        <div className={`
          bg-[#10132a]/95
          rounded-[22px]
          ${sizes[size]}
          backdrop-blur-xl
          shadow-[inset_1px_1px_24px_1px_rgba(0,185,255,0.08)]
        `}>
          {children}
        </div>
      </div>
    </div>
  );
};

export const GlassButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}> = ({ children, onClick, variant = 'primary', size = 'md', className = '', disabled = false }) => {
  const variants = {
    primary: 'bg-[#1b0d2a] text-[#f052ff] shadow-[0_0_18px_2px_#7c27ffb0] hover:bg-[#29085d] hover:shadow-[0_0_32px_6px_#fc36ff99]',
    secondary: 'bg-[#0a1134] text-[#07d7fa] shadow-[0_0_18px_2px_#07d7fa60] hover:bg-[#181432] hover:shadow-[0_0_32px_6px_#4efcff99]',
    danger: 'bg-[#2a0d1b] text-[#ff0080] shadow-[0_0_18px_2px_#ff008060] hover:bg-[#5d0829] hover:shadow-[0_0_32px_6px_#ff2ef899]'
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3',
    lg: 'px-8 py-4 text-lg'
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizes[size]}
        rounded-xl font-medium
        ${variants[variant]}
        transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
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
      className={`
        w-full px-4 py-3 rounded-lg 
        bg-transparent 
        border border-[#a86fff] 
        text-[#f9f9f9] 
        placeholder-[#a86fff80] 
        outline-none 
        focus:ring-2 focus:ring-[#4efcff]
        transition-all duration-300
        ${className}
      `}
    />
  );
};