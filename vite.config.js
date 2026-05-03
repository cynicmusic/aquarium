import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [glsl()],
  server: { port: 3456 },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        spinner: 'fish-spinner.html',
        cuttlefish: 'cuttlefish-preview.html',
        cuttlefishPublish: 'cuttlefish-publish.html',
        cuttlefishSheet: 'cuttlefish-sheet.html',
        skinSheet: 'skin-sheet.html',
        zebraSheet: 'zebra-sheet.html',
        playground: 'chromatophore-playground.html',
        workshop: 'chromatophore-workshop.html',
      },
    },
  },
});
