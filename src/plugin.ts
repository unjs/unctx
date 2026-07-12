import {
  createUnplugin,
  type HookFilter,
  type UnpluginInstance,
} from "unplugin";
import {
  createTransformer,
  getTransformFilter,
  type Transformer,
  type TransformerOptions,
} from "./transform.ts";

export interface UnctxPluginOptions extends TransformerOptions {
  /** Plugin Hook Filter for the transform hook
   * @see https://unplugin.unjs.io/guide/#filters
   */
  transformFilter?: HookFilter;
  /** Function to determine whether a file should be transformed. If possible, use `transformFilter` instead for better performance.  */
  transformInclude?: (id: string) => boolean;
}

export const unctxPlugin: UnpluginInstance<UnctxPluginOptions, boolean> =
  createUnplugin((options: UnctxPluginOptions = {}) => {
    // The transformer resolves asynchronously (dynamic oxc import). Cache the
    // resolved instance so that, once ready, the transform hook can run
    // synchronously instead of paying an `await` tick on every file.
    let transformer: Transformer | undefined;
    const transformerPromise = createTransformer(options).then((t) => {
      transformer = t;
      return t;
    });

    // The import starts eagerly, but nothing awaits it until the first matching
    // file is transformed -- which may never happen. Without this, a failure to
    // load the parser would surface as an unhandled rejection (and crash the
    // build) instead of an error on the transform hook. The rejection is still
    // delivered to the `.then()` below, so real failures are reported in place.
    transformerPromise.catch(() => {});

    const run = (transformer: Transformer, code: string, id: string) => {
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
    };

    return {
      name: "unctx:transform",
      enforce: "post",
      transformInclude: options.transformInclude,
      transform: {
        filter: options.transformFilter ?? getTransformFilter(options),
        handler(code, id) {
          return transformer
            ? run(transformer, code, id)
            : transformerPromise.then((t) => run(t, code, id));
        },
      },
    };
  });
