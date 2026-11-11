import { defineConfig } from 'vitest/config'
import { sveltekit } from '@sveltejs/kit/vite'
import adapter from '@sveltejs/adapter-static'
import { loadEnv } from 'vite'
export default defineConfig({
  plugins: [
    sveltekit({ adapter: adapter({ pages: 'build', assets: 'build', fallback: '200.html', strict: true }) })
  ],
  server: {
    proxy: {
      '/api':
        process.env.DEV_API_TARGET ||
        loadEnv('development', process.cwd(), 'DEV_').DEV_API_TARGET ||
        'http://127.0.0.1:8080'
    }
  },
  test: { include: ['src/**/*.test.ts'] }
})
