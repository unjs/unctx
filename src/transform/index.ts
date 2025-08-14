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

export type MaybeHandledNode = Node & {
  [kInjected]?: boolean;
};

export const defaultTransformerOptions: TransformerOptions = {
  asyncFunctions: ["withAsyncContext"],
  helperModule: "unctx",
  helperName: "executeAsync",
  objectDefinitions: {},
};
