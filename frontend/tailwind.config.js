/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Solo para el título de DocumentCard — ver index.html.
        document: ['"Fraunces"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
