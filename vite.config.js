// vite.config.js

import { defineConfig } from 'vite'
import commonjs from 'vite-plugin-commonjs'
export default defineConfig({
    plugins: [commonjs()],
    server: {
        host: '127.0.0.1'
    },
})
