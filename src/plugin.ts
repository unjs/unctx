import { createUnplugin } from "unplugin";
import { createTransformer, TransformerOptions } from "./transform";

export interface UnctxPluginOptions extends TransformerOptions {
  transformInclude?: (id: string) => boolean;
}

export const unctxPlugin = createUnplugin(
  (options: UnctxPluginOptions = {}) => {
    const transformer = createTransformer(options);
    return {
      name: "unctx:transfrom",
      enforce: "post",
      transformInclude: options.transformInclude,
      transform(code, id) {
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
    };
  }
);
