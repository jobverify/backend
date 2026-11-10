import { parse } from 'acorn'
import { identifyPublicAtsBoard } from './publicAtsIdentity.js'
import { recruitmentProgramProfile } from './recruitmentProgramProfile.js'

// This finite profile was reviewed from the current public native widget.
// Only its explicitly parsed account literal varies; arbitrary JavaScript is
// never executed and incomplete/unused data flows cannot authorize a board.
const profile = 'f4c872d3de4eccdec567ed2de498b1a3bb6cc9fecf7d087cb28b7f7da49600bd'
export function activeAshbyCareersFeeds(document) {
  if (['ashby-dept-filter', 'ashby-jobs-list'].some(id => document.nodes(node => node.attrs.id === id).length !== 1)) return []
  const feeds = new Set()
  for (const script of document.nodes(node => node.tag === 'script' && !node.attrs.src
    && !Object.hasOwn(node.attrs, 'nomodule')
    && /^(?:|module|(?:text|application)\/(?:java|ecma)script)$/i.test(node.attrs.type || ''))) {
    if (!script.raw?.includes('api.ashbyhq.com/posting-api/job-board/')) continue
    try {
      const program = parse(script.raw, { ecmaVersion: 'latest', sourceType: 'module' })
      const invoke = program.body.length === 1 && program.body[0].expression
      const closure = invoke?.callee
      if (invoke?.type !== 'CallExpression' || invoke.arguments.length
        || closure?.type !== 'FunctionExpression' || closure.params.length || closure.async || closure.generator) continue
      const declarations = closure.body.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
      const api = declarations.filter(node => node.id?.type === 'Identifier' && node.id.name === 'API_URL')
      if (api.length !== 1 || api[0].init?.type !== 'Literal' || typeof api[0].init.value !== 'string') continue
      const url = new URL(api[0].init.value), board = identifyPublicAtsBoard(url.href)
      if (board?.atsPlatform !== 'ashby' || url.href !== 'https://api.ashbyhq.com/posting-api/job-board/' + encodeURIComponent(board.boardToken)
        || recruitmentProgramProfile(program, api[0].init) !== profile) continue
      feeds.add(url.href)
    } catch { /* Unreviewed programs remain unqualified. */ }
  }
  return [...feeds]
}
