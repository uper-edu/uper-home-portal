import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

const preventFetchOverwritePlugin = () => {
  return {
    name: 'prevent-fetch-overwrite',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (id.includes('node_modules')) {
        if (code.includes('fetch =')) {
          return code.replace(/(?:window|global|self|globalThis)\.fetch\s*=/g, 'var __dummy_fetch_assign__ =');
        }
      }
      return null;
    }
  };
};

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), preventFetchOverwritePlugin()],
    build: {
      outDir: 'dist',
      target: 'esnext',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react') || id.includes('motion')) {
                return 'vendor-ui';
              }
              if (id.includes('recharts') || id.includes('d3-')) {
                return 'vendor-charts';
              }
              if (id.includes('react-markdown') || id.includes('remark-gfm')) {
                return 'vendor-markdown';
              }
            }
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // Runtime CRM writes must not reload pages with an active questionnaire/test.
      // Keep src/data/content watched so CMS content edits still update in development.
      watch: {
        ignored: [path.resolve(__dirname, 'data') + '/**', '**/*.log'],
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR === 'true' ? false : {host:'127.0.0.1'},
    },
  };
});
