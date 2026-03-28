import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f9ff',
          100: '#e6f6ff',
          200: '#cfe6f2',
          300: '#85c0d7',
          400: '#4c626a',
          500: '#004f63',
          600: '#003746',
          700: '#002a36',
          800: '#001e27',
          900: '#071e27',
          950: '#031219',
        },
        surface: {
          DEFAULT: '#f3faff',
          low: '#e6f6ff',
          container: '#dbf1fe',
          high: '#d5ecf8',
          highest: '#cfe6f2',
        },
        outline: {
          DEFAULT: '#70787c',
          variant: '#c0c8cc',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
