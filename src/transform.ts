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
}

export function createTransformer(options: TransformerOptions = {}) {
  options = {
    asyncFunctions: ["withAsyncContext"],
    helperModule: "unctx",
    helperName: "executeAsync",
    ...options,
  };

  const matchRE = new RegExp(`\\b(${options.asyncFunctions.join("|")})\\(`);

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
          if (options.asyncFunctions.includes(functionName)) {
            transformFunctionBody(node);
            if (functionName !== "callAsync") {
              const lastArgument = node.arguments[node.arguments.length - 1];
              if (lastArgument) {
                s.appendRight(toIndex(lastArgument.loc.end), ",1");
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
      `import { ${options.helperName} as __executeAsync } from "${options.helperModule}";`
    );

    return {
      code: s.toString(),
      magicString: s,
    };

    function toIndex(pos: Position) {
      return lines.slice(0, pos.line - 1).join("\n").length + pos.column + 1;
    }

    function transformFunctionBody(node: CallExpression) {
      for (const function_ of node.arguments) {
        if (
          function_.type !== "ArrowFunctionExpression" &&
          function_.type !== "FunctionExpression"
        ) {
          continue;
        }

        // No need to transform non-async function
        if (!function_.async) {
          continue;
        }

        const body = function_.body as BlockStatement;

        let injectVariable = false;
        walk(body, {
          enter(node: Node, parent: Node | undefined) {
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

        if (injectVariable) {
          s.appendLeft(toIndex(body.loc.start) + 1, "let __temp, __restore;");
        }
      }
    }

    function injectForNode(node: AwaitExpression, parent: Node | undefined) {
      const body = code.slice(
        toIndex(node.argument.loc.start),
        toIndex(node.argument.loc.end)
      );

      const isStatement = parent?.type === "ExpressionStatement";

      s.overwrite(
        toIndex(node.loc.start),
        toIndex(node.loc.end),
        isStatement
          ? `;(([__temp,__restore]=__executeAsync(()=>${body})),await __temp,__restore());`
          : `(([__temp,__restore]=__executeAsync(()=>${body})),__temp=await __temp,__restore(),__temp)`
      );
    }
  }

  return {
    transform,
    shouldTransform,
  };
}

function _getFunctionName(node: Node) {
  if (node.type === "Identifier") {
    return node.name;
  } else if (node.type === "MemberExpression") {
    return _getFunctionName(node.property);
  }
}
