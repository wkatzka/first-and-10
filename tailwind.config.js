/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tier colors
        tier: {
          1: '#9CA3AF',  // Gray - Basic
          2: '#6B7280',  // Dark Gray - Common
          3: '#22C55E',  // Green - Common+
          4: '#3B82F6',  // Blue - Uncommon
          5: '#6366F1',  // Indigo - Uncommon+
          6: '#8B5CF6',  // Purple - Rare
          7: '#A855F7',  // Violet - Very Rare
          8: '#EC4899',  // Pink - Ultra Rare
          9: '#F97316',  // Orange - Epic
          10: '#EAB308', // Gold - Legendary
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px currentColor' },
          '100%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
      },
    },
  },
  plugins: [],
};
