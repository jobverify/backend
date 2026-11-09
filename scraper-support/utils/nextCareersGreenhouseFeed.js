import { parse } from 'acorn'

const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return
  if (node.type) visit(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) walk(child, visit)
    else if (value && typeof value === 'object') walk(value, visit)
  }
}

// A current Next.js careers route must register the same module that contains
// the native GET call. Strings in a detached/shared bundle are insufficient.
export const nextCareersGreenhouseFeeds = (document, scriptURL, body) => {
  try {
    if (!/^\/_next\/static\/chunks\/pages\/careers-[a-f\d]+\.js$/i.test(new URL(scriptURL).pathname)) return []
    const metadata = document.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__' && node.attrs.type === 'application/json')
    if (metadata.length !== 1 || JSON.parse(metadata[0].raw).page !== '/careers') return []
    const program = parse(body, { ecmaVersion: 'latest' })
    const statement = program.body.length === 1 && program.body[0].expression
    const assignment = statement?.callee?.object
    if (statement?.type !== 'CallExpression' || statement.callee.property?.name !== 'push'
      || assignment?.type !== 'AssignmentExpression' || assignment.left?.object?.name !== 'self'
      || assignment.left.property?.name !== 'webpackChunk_N_E') return []
    const properties = statement.arguments[0]?.elements?.[1]?.properties
    if (!Array.isArray(properties)) return []
    const modules = new Map(properties.map(property => [property.key.value, property.value]))
    const registered = []
    for (const module of modules.values()) walk(module.body, node => {
      const target = node.callee?.object
      const route = node.arguments?.[0]
      if (node.type !== 'CallExpression' || node.callee.property?.name !== 'push' || target?.type !== 'AssignmentExpression'
        || target.left?.object?.name !== 'window' || target.left.property?.name !== '__NEXT_P'
        || route?.type !== 'ArrayExpression' || route.elements[0]?.value !== '/careers') return
      const read = route.elements[1]?.body?.body?.[0]?.argument
      if (read?.type === 'CallExpression' && read.callee?.name === module.params[2]?.name && read.arguments.length === 1
        && read.arguments[0]?.type === 'Literal') registered.push(read.arguments[0].value)
    })
    if (registered.length !== 1 || !modules.has(registered[0])) return []
    const feeds = []
    walk(modules.get(registered[0]).body, node => {
      if (node.type !== 'CallExpression' || node.arguments.length !== 1 || node.arguments[0]?.type !== 'Literal') return
      const callee = node.callee.type === 'SequenceExpression' ? node.callee.expressions.at(-1) : node.callee
      if (!(callee.type === 'MemberExpression' && !callee.computed && callee.property?.name === 'fetch')) return
      const value = node.arguments[0].value
      if (typeof value === 'string' && /^https:\/\/(?:api|boards-api)\.greenhouse\.io\/v1\/boards\/[a-z\d][a-z\d._-]{0,100}\/(?:departments|jobs)$/i.test(value)) feeds.push(value)
    })
    return [...new Set(feeds)]
  } catch { return [] }
}
