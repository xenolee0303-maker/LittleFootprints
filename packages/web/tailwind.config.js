/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        art: '#D97706',
        sport: '#059669',
        tech: '#0891B2',
        reading: '#7C3AED',
        life: '#DB2777',
      },
    },
  },
  plugins: [],
};
