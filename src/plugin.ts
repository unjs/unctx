import { createUnplugin, type HookFilter } from "unplugin";
import { type TransformerOptions } from "./transform/index.js";

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

let transformer:
  | ReturnType<typeof import("./transform/acorn.js").createTransformer>
  | ReturnType<typeof import("./transform/oxc.js").createTransformer>
  | undefined;
async function loadCreateTransformerFn(options: UnctxPluginOptions) {
  if (transformer) {
    return;
  }
  const { createTransformer } =
    !options.parser || options.parser === "acorn"
      ? await import("./transform/acorn")
      : await import("./transform/oxc");
  transformer = createTransformer(options);
}

export const unctxPlugin = createUnplugin(
  (options: UnctxPluginOptions = {}) => {
    return {
      name: "unctx:transform",
      enforce: "post",
      transformInclude: options.transformInclude,
      transform: {
        filter: options.transformFilter,
        async handler(code, id) {
          await loadCreateTransformerFn(options);
          const result = transformer!.transform(code);
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
