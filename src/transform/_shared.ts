import type MagicString from "magic-string";

export interface TransformerOptions {
  /**
   * The function names to be transformed.
   *
   * @default ['withAsyncContext']
   */
  asyncFunctions?: string[];
  /**
   * @default 'unctx'
   */
  helperModule?: string;
  /**
   * @default 'executeAsync'
   */
  helperName?: string;
  /**
   * Whether to transform properties of an object defined with a helper function. For example,
   * to transform key `middleware` within the object defined with function `defineMeta`, you would pass:
   * `{ defineMeta: ['middleware'] }`.
   * @default {}
   */
  objectDefinitions?: Record<string, string[]>;
}

export const kInjected = "__unctx_injected__";

export interface Transformer {
  transform: (
    code: string,
    options?: { force?: false },
  ) => { code: string; magicString: MagicString } | undefined;
  filter: {
    code: RegExp;
  };
  shouldTransform: (code: string) => boolean;
}

export function defaultTransformerOptions(): TransformerOptions {
  return {
    asyncFunctions: ["withAsyncContext"],
    helperModule: "unctx",
    helperName: "executeAsync",
    objectDefinitions: {},
  };
}

export function createTransformerFilter(options: TransformerOptions): {
  code: RegExp;
} {
  const {
    asyncFunctions = defaultTransformerOptions().asyncFunctions,
    objectDefinitions = defaultTransformerOptions().objectDefinitions,
  } = options;
  return {
    code: new RegExp(
      `\\b(${[...asyncFunctions!, ...Object.keys(objectDefinitions!)].join(
        "|",
      )})\\(`,
    ),
  };
}
