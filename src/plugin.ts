import { createUnplugin } from 'unplugin'
import { createTransformer, TransformerOptions } from './transform'

export interface UnctxPluginOptions extends TransformerOptions {
  transformInclude?: (id: string) => boolean
}

export const unctxPlugin = createUnplugin((opts: UnctxPluginOptions = {}) => {
  const transformer = createTransformer(opts)
  return {
    name: 'unctx:transfrom',
    enforce: 'post',
    transformInclude: opts.transformInclude,
    transform (code, id) {
      const result = transformer.transform(code)
      if (result) {
        return {
          code: result.code,
          map: result.magicString.generateMap({ source: id, includeContent: true })
        }
      }
    }
  }
})
