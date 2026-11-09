import { parse } from 'acorn'

// The native page publishes parseInt("100") / parseInt("10") in its search
// configuration. Read that restricted literal form as data; invoke no page code.
export const readSearchConfiguration = doc => {
  const calls = [], unqualifiedCalls = [], errors = []
  const literal = node => {
    if (node?.type === 'Literal') return node.value
    if (node?.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'parseInt'
      && (node.arguments.length === 1 || node.arguments.length === 2 && node.arguments[1].type === 'Literal' && node.arguments[1].value === 10)
      && node.arguments[0]?.type === 'Literal' && typeof node.arguments[0].value === 'string' && /^\d+$/.test(node.arguments[0].value))
      return Number(node.arguments[0].value)
    return undefined
  }
  for (const script of doc.nodes(node => node.tag === 'script' && !node.attrs.src
    && (!node.attrs.type || /^(?:text|application)\/javascript$/i.test(node.attrs.type)))) {
    const raw = script.raw || ''
    if (!raw.includes('SearchResults')) continue
    try {
      const ast = parse(raw, { ecmaVersion: 'latest', sourceType: 'script' })
      // Only the source's observed direct, top-level $(function () { ... })
      // registration qualifies. Read its immediate init expression as data;
      // never evaluate the callback or assume other control flow executes.
      const readyBodies = new Set()
      for (const statement of ast.body) {
        const call = statement.type === 'ExpressionStatement' ? statement.expression : null
        const callback = call?.type === 'CallExpression' && call.callee.type === 'Identifier'
          && call.callee.name === '$' && call.arguments.length === 1 ? call.arguments[0] : null
        if (callback?.type === 'FunctionExpression' && !callback.async && !callback.generator
          && callback.params.length === 0 && callback.body.type === 'BlockStatement') readyBodies.add(callback.body)
      }
      const visit = (node, parent, grandparent) => {
        if (!node || typeof node !== 'object') return
        if (node.type === 'CallExpression' && memberPath(node.callee) === 'j2w.SearchResults.init') {
          const object = node.arguments.length === 1 ? node.arguments[0] : null, values = Object.create(null), issues = []
          if (object?.type !== 'ObjectExpression') issues.push('Search configuration is not an object literal')
          else for (const property of object.properties) {
            const key = !property.computed && property.key?.type === 'Identifier' ? property.key.name
              : property.key?.type === 'Literal' ? String(property.key.value) : null
            if (property.type !== 'Property' || !key || property.kind !== 'init' || property.method || Object.hasOwn(values, key))
              issues.push('Duplicate or dynamic search configuration field')
            if (key) values[key] = literal(property.value)
          }
          if (script.duplicateAttributes.length || !script.closed) issues.push('Search configuration script markup unqualified')
          const qualified = parent?.type === 'ExpressionStatement' && readyBodies.has(grandparent)
          if (!qualified) issues.push('Search init is not a direct expression in the observed top-level ready callback')
          ;(qualified ? calls : unqualifiedCalls).push({ values, issues, originalCall: raw.slice(node.start, node.end),
            originalObjectLiteral: object ? raw.slice(object.start, object.end) : null })
        }
        for (const value of Object.values(node)) {
          if (Array.isArray(value)) value.forEach(child => { if (child?.type) visit(child, node, parent) })
          else if (value?.type) visit(value, node, parent)
        }
      }
      visit(ast)
    } catch (error) { errors.push(error.message) }
  }
  const scripts = doc.nodes(node => node.tag === 'script' && node.attrs.src
    && !node.duplicateAttributes.length).map(node => ({ attrs: { ...node.attrs } }))
  return { calls, unqualifiedCalls, errors, originalDeclaredScripts: scripts }
}

export const nativeUTCDate = value => {
  const match = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC (\d{4})$/.exec(value || '')
  if (!match) return null
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(match[2])
  const timestamp = new Date(Date.UTC(Number(match[7]), month, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])))
  return timestamp.getUTCFullYear() === Number(match[7]) && timestamp.getUTCMonth() === month && timestamp.getUTCDate() === Number(match[3])
    && timestamp.getUTCHours() === Number(match[4]) && timestamp.getUTCMinutes() === Number(match[5]) && timestamp.getUTCSeconds() === Number(match[6])
    && ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][timestamp.getUTCDay()] === match[1] ? timestamp.toISOString() : null
}
export const placeholder = value => /^(?:(?:NA|TBD|TBC|TOBEUPDATED|TOBEDETERMINED))+$/.test(value.replace(/[\s/.,:;!_\-–—()]/g, '').toUpperCase())
const memberPath = node => node?.type === 'Identifier' ? node.name : node?.type === 'MemberExpression'
  ? memberPath(node.object) + '.' + (node.computed ? node.property.type === 'Literal' ? node.property.value : '?' : node.property.name) : ''

// Parse published JavaScript syntax as data. Never execute page code. Strings,
// comments, templates and regex literals cannot supply an application identity.
export const readApply = (doc, cache) => {
  const results = [], errors = []
  for (const script of doc.nodes(node => node.tag === 'script' && !node.attrs.src
    && (!node.attrs.type || /^(?:text|application)\/javascript$/i.test(node.attrs.type)))) {
    const raw = script.raw || ''
    if (!/\bj2w\b/.test(raw)) continue
    if (script.duplicateAttributes.length || !script.closed) errors.push('Native init script markup is ambiguous or unterminated')
    let result = cache.get(raw)
    if (!result) {
      result = { calls: [], errors: [] }
      try {
        const ast = parse(raw, { ecmaVersion: 'latest', sourceType: 'script' })
        const visit = (node, parent, grandparent) => {
          if (!node || typeof node !== 'object') return
          if (node.type === 'CallExpression' && memberPath(node.callee) === 'j2w.Apply.init') {
            const object = node.arguments.length === 1 ? node.arguments[0] : null
            const fields = [], originals = [], seen = new Set(), issues = []
            if (parent?.type !== 'ExpressionStatement' || grandparent?.type !== 'Program')
              issues.push('Native init call is not a direct top-level published expression')
            if (object?.type !== 'ObjectExpression') issues.push('Native init argument is not an object literal')
            else for (const property of object.properties) {
              const key = !property.computed && property.key?.type === 'Identifier' ? property.key.name
                : property.key?.type === 'Literal' ? String(property.key.value) : null
              originals.push(raw.slice(property.start, property.end))
              if (property.type !== 'Property' || !key || property.kind !== 'init' || property.method || seen.has(key)) issues.push('Duplicate or nonliteral native init property')
              if (key) seen.add(key)
              if (key && property.value?.type === 'Literal') fields.push([key, property.value.value])
              else if (['jobID', 'sourceId'].includes(key)) issues.push('Native identity is not a literal')
            }
            result.calls.push({ fields: Object.fromEntries(fields), originalCall: raw.slice(node.start, node.end),
              originalObjectLiteral: object ? raw.slice(object.start, object.end) : null, originalProperties: originals, issues })
          }
          if (node.type === 'AssignmentExpression' && memberPath(node.left).startsWith('j2w.Apply.init')) result.errors.push('Native init function overwritten')
          for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(child => { if (child?.type) visit(child, node, parent) })
            else if (value?.type) visit(value, node, parent)
          }
        }
        visit(ast)
      } catch (error) { result.errors.push(error.message) }
      cache.set(raw, result)
    }
    results.push(...result.calls);errors.push(...result.errors)
  }
  return { calls: results, errors }
}
