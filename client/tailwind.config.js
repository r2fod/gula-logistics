export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-20px) scale(1.05)' },
        },
        // Entrada suave: sube unos píxeles mientras aparece. Con `both` se queda
        // invisible durante el `animation-delay` (escalonar tarjetas y filas).
        aparecer: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        float: 'float 15s ease-in-out infinite',
        aparecer: 'aparecer 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
      }
    }
  },
  plugins: [],
}
