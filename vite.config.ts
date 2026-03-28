import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
    },
    // Tauri expects a fixed dev server port
    server: {
        port: 1420,
        strictPort: true,
    },
    envPrefix: ['VITE_', 'TAURI_'],
    // QuickJS WASM must not be bundled by esbuild — let the browser fetch .wasm natively
    optimizeDeps: {
        exclude: ['quickjs-emscripten', 'quickjs-emscripten-core',
            '@jitl/quickjs-wasmfile-release-sync', '@jitl/quickjs-wasmfile-release-asyncify',
            '@jitl/quickjs-wasmfile-debug-sync', '@jitl/quickjs-wasmfile-debug-asyncify'],
    },
    assetsInclude: ['**/*.wasm'],
});
