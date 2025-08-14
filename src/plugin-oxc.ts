// Copy of plugin.ts but uses oxc transform
import { createUnplugin, type HookFilter } from "unplugin";
import { createTransformer, type TransformerOptions } from "./transform-oxc";

export interface UnctxPluginOptions extends TransformerOptions {
  /** Plugin Hook Filter for the transform hook
   * @see https://unplugin.unjs.io/guide/#filters
   */
  transformFilter?: HookFilter;
  /** Function to determine whether a file should be transformed. If possible, use `transformFilter` instead for better performance.  */
  transformInclude?: (id: string) => boolean;
}

export const unctxPlugin = createUnplugin(
  (options: UnctxPluginOptions = {}) => {
    const transformer = createTransformer(options);
    return {
      name: "unctx:transform",
      enforce: "post",
      transformInclude: options.transformInclude,
      transform: {
        filter: options.transformFilter,
        handler(code, id) {
          const result = transformer.transform(code);
          if (result) {
            return {
              code: result.code,
              map: result.magicString.generateMap({
                source: id,
                includeContent: true,
              }),
            };
          }
        },
      },
    };
  },
);
