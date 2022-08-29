
import * as acorn from 'acorn'
import MagicString from 'magic-string'
import { walk } from 'estree-walker'
import type {
  Node, CallExpression,
  BlockStatement,
  AwaitExpression,
  Position
} from 'estree'

export interface TransformerOptions {
  /**
   * The function names to be transformed.
   *
   * @default ['withAsyncContext', 'callAsync']
   */
  asyncFunctions?: string[]
  /**
   * @default 'unctx'
   */
  helperModule?: string
  /**
   * @default 'executeAsync'
   */
  helperName?: string
}

export function createTransformer (options: TransformerOptions = {}) {
  options = {
    asyncFunctions: ['withAsyncContext'],
    helperModule: 'unctx',
    helperName: 'executeAsync',
    ...options
  }

  const matchRE = new RegExp(`\\b(${options.asyncFunctions.join('|')})\\(`)

  function shouldTransform (code: string) {
    return typeof code === 'string' && matchRE.test(code)
  }

  function transform (code: string, opts: { force?: false } = {}) {
    if (!opts.force && !shouldTransform(code)) {
      return
    }
    const ast = acorn.parse(code, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      locations: true
    })

    const s = new MagicString(code)
    const lines = code.split('\n')

    let detected = false

    walk(ast, {
      enter (node: Node) {
        if (node.type === 'CallExpression') {
          const functionName = getFunctionName(node.callee)
          if (options.asyncFunctions.includes(functionName)) {
            transformFunctionBody(node)
            if (functionName !== 'callAsync') {
              const lastArg = node.arguments[node.arguments.length - 1]
              if (lastArg) {
                s.appendRight(toIndex(lastArg.loc.end), ',1')
              }
            }
          }
        }
      }
    })

    if (!detected) {
      return null
    }

    s.appendLeft(0, `import { ${options.helperName} as __executeAsync } from "${options.helperModule}";`)

    return {
      code: s.toString(),
      magicString: s
    }

    function getFunctionName (node: Node) {
      if (node.type === 'Identifier') {
        return node.name
      } else if (node.type === 'MemberExpression') {
        return getFunctionName(node.property)
      }
    }

    function toIndex (pos: Position) {
      return lines.slice(0, pos.line - 1).join('\n').length + pos.column + 1
    }

    function transformFunctionBody (node: CallExpression) {
      for (const fn of node.arguments) {
        if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') {
          continue
        }

        // No need to transform non-async function
        if (!fn.async) {
          continue
        }

        const body = fn.body as BlockStatement

        walk(body, {
          enter (node: Node) {
            if (node.type === 'AwaitExpression') {
              detected = true
              injectForNode(node)
            }
            // Skip transform for nested functions
            if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
              return this.skip()
            }
          }
        })
      }
    }

    function injectForNode (node: AwaitExpression) {
      const body = code.slice(
        toIndex(node.argument.loc.start),
        toIndex(node.argument.loc.end)
      )

      s.overwrite(
        toIndex(node.loc.start),
        toIndex(node.loc.end),
        `await __executeAsync(()=>${body})`
      )
    }
  }

  return {
    transform,
    shouldTransform
  }
}
