/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'glass': {
          'primary': 'rgba(20, 25, 40, 0.7)',
          'secondary': 'rgba(30, 35, 60, 0.5)',
          'tertiary': 'rgba(40, 45, 80, 0.3)',
          'border': 'rgba(100, 100, 255, 0.2)',
          'glow': 'rgba(100, 200, 255, 0.6)',
        },
        'neon': {
          'cyan': '#00ffff',
          'blue': '#0080ff',
          'purple': '#bf00ff',
          'pink': '#ff0080',
          'green': '#00ff88',
          'yellow': '#ffff00',
          'orange': '#ff8800',
          'red': '#ff0044',
        }
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 3s infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'gradient-x': 'gradient-x 3s ease infinite',
        'gradient-y': 'gradient-y 3s ease infinite',
        'gradient-xy': 'gradient-xy 3s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'rotate-slow': 'rotate 20s linear infinite',
        'bounce-slow': 'bounce 3s ease-in-out infinite',
        'morph': 'morph 8s ease-in-out infinite',
        'wave': 'wave 2s ease-in-out infinite',
        'pulse-border': 'pulse-border 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) translateZ(0)' },
          '50%': { transform: 'translateY(-20px) translateZ(50px)' },
        },
        glow: {
          '0%, 100%': { 
            boxShadow: '0 0 20px rgba(100, 200, 255, 0.5), 0 0 40px rgba(100, 200, 255, 0.3)' 
          },
          '50%': { 
            boxShadow: '0 0 30px rgba(100, 200, 255, 0.8), 0 0 60px rgba(100, 200, 255, 0.5)' 
          },
        },
        'gradient-x': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        'gradient-y': {
          '0%, 100%': { 'background-position': '50% 0%' },
          '50%': { 'background-position': '50% 100%' },
        },
        'gradient-xy': {
          '0%, 100%': { 'background-position': '0% 0%' },
          '25%': { 'background-position': '100% 0%' },
          '50%': { 'background-position': '100% 100%' },
          '75%': { 'background-position': '0% 100%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%) translateZ(-100px)', opacity: '0' },
          '100%': { transform: 'translateY(0) translateZ(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%) translateZ(-100px)', opacity: '0' },
          '100%': { transform: 'translateY(0) translateZ(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'scale(0.9) translateZ(-50px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateZ(0)' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0) translateZ(-200px)' },
          '100%': { transform: 'scale(1) translateZ(0)' },
        },
        rotate: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        morph: {
          '0%, 100%': { 
            borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
            transform: 'rotate(0deg) translateZ(0)',
          },
          '50%': { 
            borderRadius: '70% 30% 30% 70% / 70% 70% 30% 30%',
            transform: 'rotate(180deg) translateZ(100px)',
          },
        },
        wave: {
          '0%, 100%': { transform: 'translateY(0) scaleY(1)' },
          '50%': { transform: 'translateY(-10px) scaleY(0.9)' },
        },
        'pulse-border': {
          '0%, 100%': { borderColor: 'rgba(100, 200, 255, 0.2)' },
          '50%': { borderColor: 'rgba(100, 200, 255, 0.8)' },
        },
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
        '3xl': '40px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-lg': '0 16px 48px 0 rgba(31, 38, 135, 0.5)',
        'neon-blue': '0 0 20px rgba(0, 255, 255, 0.5), 0 0 40px rgba(0, 255, 255, 0.3)',
        'neon-purple': '0 0 20px rgba(255, 0, 255, 0.5), 0 0 40px rgba(255, 0, 255, 0.3)',
        'neon-pink': '0 0 20px rgba(255, 0, 127, 0.5), 0 0 40px rgba(255, 0, 127, 0.3)',
        'inner-glow': 'inset 0 0 20px rgba(100, 200, 255, 0.2)',
        '3d': '0 10px 20px rgba(0, 0, 0, 0.5), 0 6px 6px rgba(0, 0, 0, 0.4)',
        '3d-lg': '0 20px 40px rgba(0, 0, 0, 0.6), 0 10px 10px rgba(0, 0, 0, 0.5)',
      },
      perspective: {
        '500': '500px',
        '1000': '1000px',
        '1500': '1500px',
      },
      transformStyle: {
        'preserve-3d': 'preserve-3d',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-mesh': 'radial-gradient(at 40% 20%, hsla(280,100%,74%,0.3) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,0.3) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(355,100%,93%,0.3) 0px, transparent 50%), radial-gradient(at 80% 50%, hsla(340,100%,76%,0.3) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(224,100%,81%,0.3) 0px, transparent 50%)',
      },
      fontSize: {
        'xs': ['0.375rem', { lineHeight: '0.5rem' }],
        'sm': ['0.4375rem', { lineHeight: '0.625rem' }],
        'base': ['0.5rem', { lineHeight: '0.75rem' }],
        'lg': ['0.5625rem', { lineHeight: '0.875rem' }],
        'xl': ['0.625rem', { lineHeight: '0.875rem' }],
        '2xl': ['0.75rem', { lineHeight: '1rem' }],
        '3xl': ['0.9375rem', { lineHeight: '1.125rem' }],
        '4xl': ['1.125rem', { lineHeight: '1.25rem' }],
        '5xl': ['1.5rem', { lineHeight: '1' }],
        '6xl': ['1.875rem', { lineHeight: '1' }],
        '7xl': ['2.25rem', { lineHeight: '1' }],
        '8xl': ['3rem', { lineHeight: '1' }],
        '9xl': ['4rem', { lineHeight: '1' }],
      },
      fontFamily: {
        'orbitron': ['Orbitron', 'monospace'],
        'rajdhani': ['Rajdhani', 'sans-serif'],
        'space-grotesk': ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
