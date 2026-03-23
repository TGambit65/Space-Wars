/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          900: '#0a0a1a',
          800: '#12122e',
          700: '#1a1a42',
          600: '#252556',
          500: '#30306a',
          400: '#3d3d7e',
        },
        accent: {
          primary: 'var(--sw3-primary)',
          cyan: '#00d4ff',
          purple: '#8b5cf6',
          green: '#10b981',
          orange: '#f59e0b',
          red: '#ef4444',
        },
        neon: {
          cyan: '#00ffff',
          'cyan-dark': '#0099cc',
          orange: '#ff6600',
          'orange-dark': '#cc5200',
        },
        surface: {
          DEFAULT: '#1a1a2e',
          light: '#2a2a2a',
        },
        status: {
          success: '#4caf50',
          warning: '#ffc107',
          danger: '#f44336',
          info: '#2196f3',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 255, 255, 0.3)',
        'glow-cyan-lg': '0 0 40px rgba(0, 255, 255, 0.4)',
        'glow-cyan-inset': '0 0 20px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1)',
        'glow-orange': '0 0 20px rgba(255, 102, 0, 0.3)',
        'glow-orange-lg': '0 0 40px rgba(255, 102, 0, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'holo-sweep': 'holo-sweep 3s ease-in-out infinite',
        'holo-scanlines': 'holo-scanlines-move 2s linear infinite',
        'holo-flicker': 'holo-text-flicker 2s ease-in-out infinite',
        'holo-border': 'holo-border-rotate 3s linear infinite',
        'shine': 'shine 1.5s ease-in-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 255, 255, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 255, 255, 0.8)' },
        },
        'holo-sweep': {
          '0%, 100%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(100%)' },
        },
        'holo-scanlines-move': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(4px)' },
        },
        'holo-text-flicker': {
          '0%, 100%': { opacity: '1', textShadow: '0 0 10px currentColor, 0 0 20px currentColor' },
          '50%': { opacity: '0.85', textShadow: '0 0 5px currentColor, 0 0 10px currentColor' },
        },
        'holo-border-rotate': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        shine: {
          '0%': { left: '-100%' },
          '100%': { left: '200%' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(0, 255, 255, 0.6)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
