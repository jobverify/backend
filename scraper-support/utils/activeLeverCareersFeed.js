import { parse } from 'acorn'

// Recognize the reviewed inline Lever job-board data flow without executing
// employer JavaScript. A tenant string alone does not establish a binding.
export const activeLeverCareersFeeds = document => {
  const feeds = []
  for (const script of document.nodes(node => node.tag === 'script' && !node.attrs.src
    && !Object.hasOwn(node.attrs, 'nomodule')
    && /^(?:|(?:text|application)\/javascript)$/i.test(node.attrs.type || ''))) {
    if (!script.raw?.includes('api.lever.co/v0/postings/')) continue
    try {
      const program = parse(script.raw, { ecmaVersion: 'latest' })
      const declarations = program.body.filter(node => node.type === 'VariableDeclaration' && node.kind === 'const')
        .flatMap(node => node.declarations)
      const unique = name => { const nodes = declarations.filter(node => node.id.name === name); return nodes.length === 1 ? nodes[0].init : null }
      const account = unique('ACCOUNT_NAME'), api = unique('API_URL'), container = unique('listingsContainer')
      if (account?.type !== 'Literal' || typeof account.value !== 'string' || !/^[a-z\d][a-z\d._-]{0,100}$/i.test(account.value)
        || api?.type !== 'TemplateLiteral' || api.expressions.length !== 1 || api.expressions[0].name !== 'ACCOUNT_NAME'
        || api.quasis[0].value.cooked !== 'https://api.lever.co/v0/postings/' || api.quasis[1].value.cooked !== '?mode=json') continue
      if (container?.type !== 'CallExpression' || container.callee?.object?.name !== 'document'
        || container.callee?.property?.name !== 'getElementById' || container.arguments.length !== 1
        || container.arguments[0].value !== 'job-listings'
        || document.nodes(node => node.attrs.id === 'job-listings').length !== 1) continue
      const functions = name => program.body.filter(node => node.type === 'FunctionDeclaration' && node.id.name === name)
      const fetchers = functions('fetchJobs'), initializers = functions('initJobBoard'), renderers = functions('renderJobs')
      if (fetchers.length !== 1 || initializers.length !== 1 || renderers.length !== 1 || !fetchers[0].async || !initializers[0].async) continue
      const fetch = fetchers[0].body.body[0]?.declarations?.[0]
      if (fetch?.id.name !== 'response' || fetch.init?.type !== 'AwaitExpression'
        || fetch.init.argument?.callee?.name !== 'fetch' || fetch.init.argument.arguments.length !== 1
        || fetch.init.argument.arguments[0].name !== 'API_URL') continue
      const json = fetchers[0].body.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
        .filter(node => node.id.name === 'jobs' && node.init?.type === 'AwaitExpression'
          && node.init.argument?.callee?.object?.name === 'response' && node.init.argument.callee.property?.name === 'json')
      const statements = initializers[0].body.body[0]?.type === 'TryStatement' ? initializers[0].body.body[0].block.body : []
      const read = statements[0]?.declarations?.[0]
      const render = statements.some(node => node.expression?.type === 'CallExpression'
        && node.expression.callee.name === 'renderJobs' && node.expression.arguments.length === 1 && node.expression.arguments[0].name === 'jobs')
      const starts = program.body.filter(node => node.expression?.type === 'CallExpression'
        && node.expression.callee.name === 'initJobBoard' && node.expression.arguments.length === 0)
      if (json.length !== 1 || read?.id.name !== 'jobs' || read.init?.type !== 'AwaitExpression'
        || read.init.argument?.callee?.name !== 'fetchJobs' || !render || starts.length !== 1) continue
      feeds.push(`https://api.lever.co/v0/postings/${account.value}?mode=json`)
    } catch { /* Unreviewed source code remains an unverified candidate. */ }
  }
  return feeds
}
