/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#142D4E',
        carblue: '#2474E8',
        canvas: '#F4F7FB',
        cargreen: '#16836B'
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif']
      },
      boxShadow: {
        soft: '0 18px 50px rgba(20, 45, 78, 0.08)'
      }
    }
  },
  plugins: []
}