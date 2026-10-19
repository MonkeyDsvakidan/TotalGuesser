import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative Pfade, damit die Seite unter /TotalGuesser/ auf GitHub Pages läuft
  base: './',
  plugins: [react()],
})
