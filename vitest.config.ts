import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import { unctxPlugin } from './src/plugin'

export default defineConfig({
  plugins: [
    unctxPlugin.vite({
      helperModule: resolve('./src/index.ts'),
      transformInclude: id => id.includes('async.test')
    })
  ]
})
