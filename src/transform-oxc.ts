import { parseSync } from "oxc-parser";
import MagicString from "magic-string";
import { walk } from "oxc-walker";
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

const kInjected = "__unctx_injected__";

type MaybeHandledNode = Node & {
  [kInjected]?: boolean;
};

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
    const ast = parseSync("", code, {
      sourceType: "module",
    });

    const s = new MagicString(code);

    let detected = false;

    walk(ast.program, {
      enter(node: Node) {
        if (node.type === "CallExpression") {
          const functionName = _getFunctionName(node.callee);
          if (options.asyncFunctions!.includes(functionName)) {
            transformFunctionArguments(node);
            if (functionName !== "callAsync") {
              const lastArgument = node.arguments[node.arguments.length - 1];
              if (lastArgument && lastArgument.end) {
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
        enter(
          node: MaybeHandledNode,
          parent: MaybeHandledNode | undefined | null,
        ) {
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
        },
      });

      if (injectVariable && body.start) {
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

      if (!node.start || !node.argument.start) {
        return;
      }

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
