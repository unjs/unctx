import * as acorn from "acorn";
import MagicString from "magic-string";
import { walk } from "estree-walker";
import type {
  Node,
  CallExpression,
  BlockStatement,
  AwaitExpression,
  Position,
} from "estree";

export interface TransformerOptions {
  /**
   * The function names to be transformed.
   *
   * @default ['withAsyncContext', 'callAsync']
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

export function createTransformer(options: TransformerOptions = {}) {
  options = {
    asyncFunctions: ["withAsyncContext"],
    helperModule: "unctx",
    helperName: "executeAsync",
    objectDefinitions: {},
    ...options,
  };

  const objectDefinitionFunctions = Object.keys(options.objectDefinitions!);

  const matchRE = new RegExp(
    `\\b(${[...options.asyncFunctions!, ...objectDefinitionFunctions].join(
      "|",
    )})\\(`,
  );

  function shouldTransform(code: string) {
    return typeof code === "string" && matchRE.test(code);
  }

  function transform(code: string, options_: { force?: false } = {}) {
    if (!options_.force && !shouldTransform(code)) {
      return;
    }
    const ast = acorn.parse(code, {
      sourceType: "module",
      ecmaVersion: "latest",
      locations: true,
    });

    const s = new MagicString(code);
    const lines = code.split("\n");

    let detected = false;

    walk(ast as any, {
      enter(node: Node) {
        if (node.type === "CallExpression") {
          const functionName = _getFunctionName(node.callee);
          if (options.asyncFunctions!.includes(functionName)) {
            transformFunctionArguments(node);
            if (functionName !== "callAsync") {
              const lastArgument = node.arguments[node.arguments.length - 1];
              if (lastArgument && lastArgument.loc) {
                s.appendRight(toIndex(lastArgument.loc.end), ",1");
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
      },
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

    function toIndex(pos: Position) {
      return lines.slice(0, pos.line - 1).join("\n").length + pos.column + 1;
    }

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
      walk(body, {
        enter(node: Node, parent: Node | undefined | null) {
          if (node.type === "AwaitExpression") {
            detected = true;
            injectVariable = true;
            injectForNode(node, parent);
          }
          // Skip transform for nested functions
          if (
            node.type === "ArrowFunctionExpression" ||
            node.type === "FunctionExpression" ||
            node.type === "FunctionDeclaration"
          ) {
            return this.skip();
          }
        },
      });

      if (injectVariable && body.loc) {
        s.appendLeft(toIndex(body.loc.start) + 1, "let __temp, __restore;");
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

      if (!node.loc || !node.argument.loc) {
        return;
      }

      s.remove(toIndex(node.loc.start), toIndex(node.argument.loc.start));
      s.remove(toIndex(node.loc.end), toIndex(node.argument.loc.end));

      s.appendLeft(
        toIndex(node.argument.loc.start),
        isStatement
          ? `;(([__temp,__restore]=__executeAsync(()=>`
          : `(([__temp,__restore]=__executeAsync(()=>`,
      );
      s.appendRight(
        toIndex(node.argument.loc.end),
        isStatement
          ? `)),await __temp,__restore());`
          : `)),__temp=await __temp,__restore(),__temp)`,
      );
    }
  }

  return {
    transform,
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
