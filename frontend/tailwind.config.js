/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Environment 1: Research Dashboard (Premium Light)
        rd: {
          bg: "#F5F7FA",
          surface: "#FFFFFF",
          subtle: "#EEF2F6",
          primary: "#0D9488",
          secondary: "#142B45",
          highlight: "#38BDF8",
          text: "#172033",
          muted: "#64748B",
          border: "#E2E8F0",
          borderStrong: "#CBD5E1",
        },
        // Environment 2: Medical Imaging Workspace (Professional Dark Workstation)
        ws: {
          bg: "#080B10",
          panel: "#111722",
          elevated: "#18212D",
          border: "#263445",
          accent: "#0D9488",
          crosshair: "#38BDF8",
          text: "#E5EDF5",
          muted: "#94A3B8",
        },
        // Legacy alias compatibility
        pv: {
          bg: "#080B10",
          surface: "#111722",
          elevated: "#18212D",
          primary: "#38BDF8",
          secondary: "#0D9488",
          text: "#E5EDF5",
          muted: "#94A3B8",
          border: "#263445",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["IBM Plex Mono", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
