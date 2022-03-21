
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
  triggerFunctions?: string[]
  /**
   * @default 'unctx'
   */
  helperModule?: string
  /**
   * @default 'excuteAsync'
   */
  helperName?: string
}

export function createTransformer (options: TransformerOptions = {}) {
  const {
    triggerFunctions: functions = ['withAsyncContext', 'callAsync'],
    helperModule = 'unctx',
    helperName = 'excuteAsync'
  } = options

  const matchRE = new RegExp(`\\b(${functions.join('|')})\\(`)

  function shouldTransform (code: string) {
    return matchRE.test(code)
  }

  function doTransform (code: string) {
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
          if (functions.includes(getFunctionName(node.callee))) {
            transformFunctionBody(node)
          }
        }
      }
    })

    if (!detected) {
      return null
    }

    s.appendLeft(0, `import { ${helperName} as __excuteAsync } from "${helperModule}";`)

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

        let injectVariable = false
        walk(body, {
          enter (node: Node, parent: Node | undefined) {
            if (node.type === 'AwaitExpression') {
              detected = true
              injectVariable = true
              injectForNode(node, parent)
            }
            // Skip transform for nested functions
            if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
              return this.skip()
            }
          }
        })

        if (injectVariable) {
          s.appendLeft(
            toIndex(body.loc.start) + 1,
            'let __temp, __restore;'
          )
        }
      }
    }

    function injectForNode (node: AwaitExpression, parent: Node | undefined) {
      const body = code.slice(
        toIndex(node.argument.loc.start),
        toIndex(node.argument.loc.end)
      )

      const isStatement = parent?.type === 'ExpressionStatement'

      s.overwrite(
        toIndex(node.loc.start),
        toIndex(node.loc.end),
        isStatement
          ? `;(([__temp,__restore]=__excuteAsync(()=>${body})),await __temp,__restore());`
          : `(([__temp,__restore]=__excuteAsync(()=>${body})),__temp=await __temp,__restore(),__temp)`
      )
    }
  }

  function transform (code: string) {
    if (!shouldTransform(code)) {
      return
    }
    return doTransform(code)
  }

  return {
    transform,
    doTransform,
    shouldTransform
  }
}
