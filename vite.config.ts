import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {frontendEnvironment} from './server/environment.mjs';
import {verifyFrontendBuildIdentity} from './server/runtimeVersion.mjs';
import {analyticsBuildConfiguration} from './server/analyticsEnvironment.mjs';
import {hskArchiveBundle} from './scripts/lib/hskArchiveBundle.mjs';

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

function publicRoutePreload():Plugin {
  return {
    name:'uper-public-route-preload',
    apply:'build',
    transformIndexHtml:{
      order:'post',
      handler(_html,{bundle}) {
        if(!bundle)return;
        const chunks=Object.values(bundle);
        function preloadFiles(...modules:string[]) {
          const paths=modules.map(id=>'/src/'+id);
          return chunks.flatMap(chunk=>chunk.type==='chunk'&&!chunk.isEntry&&
            chunk.moduleIds.some(id=>paths.some(path=>id.replaceAll('\\','/').endsWith(path)))?['/'+chunk.fileName]:[]);
        }
        const routes={
          enrollment:preloadFiles('pages/Enrollment.tsx','components/Layout.tsx'),
          chat:preloadFiles('pages/StandAloneChat.tsx'),
          link:preloadFiles('pages/LinkHub.tsx'),
        };
        return [{tag:'script',injectTo:'head-prepend',children:`
          (function() {
            var path = location.pathname.toLowerCase().split('/')[1];
            var routes = ${JSON.stringify(routes)};
            var files = path === 'consult' ? routes.chat : Object.prototype.hasOwnProperty.call(routes, path) && routes[path];
            if (!files) return;
            files.forEach(function(file) {
              var link = document.createElement('link');
              link.rel = 'modulepreload';
              link.crossOrigin = 'anonymous';
              link.href = file;
              document.head.appendChild(link);
            });
          })();
        `}];
      },
    },
  };
}

export default defineConfig(({mode}) => {
  const env = frontendEnvironment(mode);
  const analytics = analyticsBuildConfiguration(mode);
  const releaseIdentity = process.env.UPER_BUILD_IDENTITY;
  const identity = releaseIdentity ? verifyFrontendBuildIdentity(JSON.parse(releaseIdentity), mode, env) : null;
  return {
    // Vite must not silently merge legacy .env / .env.local files across targets.
    envDir: false,
    define: {...Object.fromEntries(Object.entries(env).map(([key,value])=>['import.meta.env.'+key,JSON.stringify(value)])),__UPER_ANALYTICS__:JSON.stringify(analytics),__UPER_BUILD__:JSON.stringify(identity)},
    plugins: [hskArchiveBundle(), react(), tailwindcss(), preventFetchOverwritePlugin(), publicRoutePreload()],
    build: {
      outDir: 'dist',
      target: 'esnext',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          onlyExplicitManualChunks: true,
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) {
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
