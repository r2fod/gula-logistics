export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-20px) scale(1.05)' },
        }
      },
      animation: {
        float: 'float 15s ease-in-out infinite',
        // Los @keyframes de estas animaciones están en index.css (Tailwind solo
        // emite los de config si se usa la clase; así también valen desde CSS).
        fadeIn: 'fadeIn 0.3s ease-out',
        aparecer: 'aparecer 0.55s cubic-bezier(0.22, 1, 0.36, 1) backwards',
        pop: 'pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) backwards',
        latido: 'latido 1.6s ease-in-out infinite',
        flotar: 'flotar 3.4s ease-in-out infinite',
        destello: 'destello 2.6s ease-in-out infinite',
      }
    }
  },
  plugins: [],
}
