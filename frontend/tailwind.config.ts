import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mc: {
          green: '#5da832',
          dark: '#1a1a1a',
          panel: '#242424',
          border: '#333333',
          muted: '#888888',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
