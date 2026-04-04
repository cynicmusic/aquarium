import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [glsl()],
  server: { port: 3456 },
  assetsInclude: ['**/*.mp3'],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        spinner: 'fish-spinner.html',
      },
    },
  },
});
