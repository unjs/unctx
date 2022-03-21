import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import { Plugin } from 'vite'
import { createTransformer } from './src/transform'

const indexPath = resolve('./src/index.ts')

function UnctxPlugin (): Plugin {
  const transformer = createTransformer({
    helperModule: indexPath
  })

  return {
    name: 'unctx:transfrom',
    enforce: 'post',
    transform (code, id) {
      if (id.includes('async.test.ts')) {
        const result = transformer.transform(code)!
        return {
          code: result.code,
          map: result.magicString.generateMap()
        }
      }
    }
  }
}

export default defineConfig({
  plugins: [
    UnctxPlugin()
  ]
})
