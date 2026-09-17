/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand tokens — swap these for Printello's palette once it's confirmed.
        brand: {
          50: '#f1f9f5',
          100: '#dcf0e4',
          500: '#00796b',
          600: '#007057',
          700: '#00594a',
          900: '#03372f',
        },
        ink: '#1b1b1b',
        muted: '#5b5b5b',
      },
    },
  },
  plugins: [],
};
