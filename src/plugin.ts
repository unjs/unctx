import {
  createUnplugin,
  type HookFilter,
  type UnpluginInstance,
} from "unplugin";
import {
  createTransformerFilter,
  type TransformerOptions,
} from "./transform/_shared.ts";

export interface UnctxPluginOptions extends TransformerOptions {
  /** The parser to use.
   * @default 'acorn'
   */
  parser?: "acorn" | "oxc";
  /** Plugin Hook Filter for the transform hook
   * @see https://unplugin.unjs.io/guide/#filters
   */
  transformFilter?: HookFilter;
  /** Function to determine whether a file should be transformed. If possible, use `transformFilter` instead for better performance.  */
  transformInclude?: (id: string) => boolean;
}

export const unctxPlugin: UnpluginInstance<UnctxPluginOptions, false> =
  createUnplugin((options: UnctxPluginOptions = {}) => {
    const transformer = (
      options.parser === "oxc"
        ? import("./transform/oxc.ts")
        : import("./transform/acorn.ts")
    ).then(({ createTransformer }) => createTransformer(options));

    return {
      name: "unctx:transform",
      enforce: "post",
      transformInclude: options.transformInclude,
      transform: {
        filter: options.transformFilter ?? createTransformerFilter(options),
        async handler(code, id) {
          const result = (await transformer).transform(code);
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
  });
