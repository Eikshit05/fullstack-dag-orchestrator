/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f6f7fb',
        node: '#ffffff',
        accent: {
          io: '#2563eb',
          ai: '#7c3aed',
          logic: '#d97706',
          text: '#059669',
          neutral: '#64748b',
        },
      },
      borderRadius: { node: '12px' },
      boxShadow: { node: '0 2px 8px rgba(15,23,42,0.12)' },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
