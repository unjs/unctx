import type MagicString from "magic-string";
import type {
  Node,
  CallExpression,
  BlockStatement,
  AwaitExpression,
} from "oxc-parser";

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

const kInjected = "__unctx_injected__";

const AWAIT_RE = /(?<![\w$.])await(?![\w$])/;

type MaybeHandledNode = Node & {
  [kInjected]?: boolean;
};

/**
 * Compute the (synchronous) code filter used to cheaply skip files that cannot
 * contain a transformable call. This is exposed separately so the plugin can
 * provide a filter without awaiting the (lazily loaded) transformer.
 */
export function getTransformFilter(options: TransformerOptions = {}): {
  code: RegExp;
} {
  const asyncFunctions = options.asyncFunctions ?? ["withAsyncContext"];
  const objectDefinitionFunctions = Object.keys(
    options.objectDefinitions ?? {},
  );
  return {
    code: new RegExp(
      `\\b(${[...asyncFunctions, ...objectDefinitionFunctions].join("|")})\\(`,
    ),
  };
}

/**
 * Load oxc's `parseSync`, dynamically importing `oxc-parser` and falling back
 * to `rolldown/utils` (which re-exports the oxc utilities) so that consumers
 * already depending on rolldown don't need `oxc-parser` installed separately.
 */
async function loadParseSync(): Promise<typeof import("oxc-parser").parseSync> {
  try {
    return (await import("oxc-parser")).parseSync;
  } catch {
    return (await import("rolldown/utils"))
      .parseSync as typeof import("oxc-parser").parseSync;
  }
}

export async function createTransformer(
  options: TransformerOptions = {},
): Promise<Transformer> {
  options = {
    asyncFunctions: ["withAsyncContext"],
    helperModule: "unctx",
    helperName: "executeAsync",
    objectDefinitions: {},
    ...options,
  };

  const [parseSync, MagicString] = await Promise.all([
    loadParseSync(),
    import("magic-string").then((r) => r.default),
  ]);

  const objectDefinitionFunctions = Object.keys(options.objectDefinitions!);

  const filter = getTransformFilter(options);
  const matchRE = filter.code;

  function shouldTransform(code: string): boolean {
    return (
      typeof code === "string" && matchRE.test(code) && AWAIT_RE.test(code)
    );
  }

  function transform(
    code: string,
    options_: { force?: false } = {},
  ): { code: string; magicString: MagicString } | undefined {
    if (!options_.force && !shouldTransform(code)) {
      return;
    }
    const parsed = parseSync("", code, {
      sourceType: "module",
    });
    if (parsed.errors.length > 0) {
      throw new SyntaxError(
        parsed.errors.map((error) => error.message).join("\n"),
      );
    }

    const s = new MagicString(code);

    let detected = false;

    walk(parsed.program, function (node: Node) {
      if (node.type === "CallExpression") {
        const functionName = _getFunctionName(node.callee);
        if (options.asyncFunctions!.includes(functionName)) {
          transformFunctionArguments(node);
          if (functionName !== "callAsync") {
            const lastArgument = node.arguments[node.arguments.length - 1];
            if (lastArgument) {
              s.appendRight(lastArgument.end, ",1");
            }
          }
        }
        if (objectDefinitionFunctions.includes(functionName)) {
          for (const argument of node.arguments) {
            if (argument.type !== "ObjectExpression") {
              continue;
            }

            for (const property of argument.properties) {
              if (
                property.type !== "Property" ||
                property.key.type !== "Identifier"
              ) {
                continue;
              }

              if (
                options.objectDefinitions![functionName]?.includes(
                  property.key?.name,
                )
              ) {
                transformFunctionBody(property.value);
              }
            }
          }
        }
      }
    });

    if (!detected) {
      return;
    }

    s.appendLeft(
      0,
      `import { ${options.helperName} as __executeAsync } from "${options.helperModule}";`,
    );

    return {
      code: s.toString(),
      magicString: s,
    };

    function transformFunctionBody(function_: Node) {
      if (
        function_.type !== "ArrowFunctionExpression" &&
        function_.type !== "FunctionExpression"
      ) {
        return;
      }

      // No need to transform non-async function
      if (!function_.async) {
        return;
      }

      const body = function_.body as BlockStatement;

      let injectVariable = false;
      walk(body, function (node: MaybeHandledNode, parent) {
        if (node.type === "AwaitExpression" && !node[kInjected]) {
          detected = true;
          injectVariable = true;
          injectForNode(node, parent);
        } else if (
          node.type === "IfStatement" &&
          node.consequent.type === "ExpressionStatement" &&
          node.consequent.expression.type === "AwaitExpression"
        ) {
          detected = true;
          injectVariable = true;
          (node.consequent.expression as MaybeHandledNode)[kInjected] = true;
          injectForNode(node.consequent.expression, node);
        }
        // Skip transform for nested functions
        if (
          node.type === "ArrowFunctionExpression" ||
          node.type === "FunctionExpression" ||
          node.type === "FunctionDeclaration"
        ) {
          return this.skip();
        }
      });

      if (injectVariable) {
        s.appendLeft(body.start + 1, "let __temp, __restore;");
      }
    }

    function transformFunctionArguments(node: CallExpression) {
      for (const function_ of node.arguments) {
        transformFunctionBody(function_);
      }
    }

    function injectForNode(
      node: AwaitExpression,
      parent: Node | undefined | null,
    ) {
      const isStatement = parent?.type === "ExpressionStatement";

      s.remove(node.start, node.argument.start);
      s.remove(node.end, node.argument.end);

      s.appendLeft(
        node.argument.start,
        isStatement
          ? `;(([__temp,__restore]=__executeAsync(()=>`
          : `(([__temp,__restore]=__executeAsync(()=>`,
      );
      s.appendRight(
        node.argument.end,
        isStatement
          ? `)),await __temp,__restore());`
          : `)),__temp=await __temp,__restore(),__temp)`,
      );
    }
  }

  return {
    transform,
    filter,
    shouldTransform,
  };
}

function _getFunctionName(node: Node): string {
  if (node.type === "Identifier") {
    return node.name;
  } else if (node.type === "MemberExpression") {
    return _getFunctionName(node.property);
  }
  return "";
}

type WalkContext = { skip: () => void };
type WalkEnter = (this: WalkContext, node: Node, parent: Node | null) => void;

/**
 * Minimal depth-first AST walker. It recurses into every child node
 * (any nested object/array entry that looks like an AST node)
 * and invokes `enter` for each. `enter` may call `this.skip()` to avoid descending
 * into the current node's children.
 */
function walk(root: Node, enter: WalkEnter): void {
  const visit = (node: Node, parent: Node | null): void => {
    let skipped = false;
    const context: WalkContext = {
      skip: () => {
        skipped = true;
      },
    };
    enter.call(context, node, parent);
    if (skipped) {
      return;
    }
    for (const key in node) {
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const child of value) {
          if (isNode(child)) {
            visit(child, node);
          }
        }
      } else if (isNode(value)) {
        visit(value, node);
      }
    }
  };
  visit(root, null);
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}
