/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: "#0A0A0A",
        carbon: "#1C1C1E",
        "plasma-blue": "#00F0FF",
        "plasma-magenta": "#FF00AA",
        "text-neon": "#E0E0E0",
        "text-muted": "#A0A0A0",
      },
      fontFamily: {
        display: ['"Orbitron"', "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-blue": "0 0 12px #00F0FF, 0 0 28px rgba(0,240,255,0.35)",
        "glow-magenta": "0 0 12px #FF00AA, 0 0 28px rgba(255,0,170,0.35)",
        "glow-soft": "0 0 8px rgba(0,240,255,0.25)",
      },
      backgroundImage: {
        "plasma-gradient": "linear-gradient(90deg, #00F0FF, #FF00AA)",
        "dark-gradient": "linear-gradient(180deg, #1C1C1E, #0A0A0A)",
      },
      keyframes: {
        "circuit-flow": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "200px 200px" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.7" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "circuit-flow": "circuit-flow 30s linear infinite",
        "glow-pulse": "glow-pulse 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
