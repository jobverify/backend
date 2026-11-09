import { parse } from 'acorn'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

export const CLASSPLUS_LIST_API = 'https://crm.classplus.co/ts/jobs/get-job-list?'
export const CLASSPLUS_DETAIL_API = 'https://crm.classplus.co/ts/jobs/get-job-description?jobId='
const requireContract = (ok, reason) => { if (!ok) throw Error('Classplus native client contract: ' + reason) }
const nodes = root => {
  const result = []
  const visit = node => {
    if (!node || typeof node !== 'object') return
    if (typeof node.type === 'string') result.push(node)
    for (const [key, value] of Object.entries(node)) if (!['start', 'end'].includes(key)) {
      if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value === 'object') visit(value)
    }
  }
  visit(root); return result
}
const ast = source => { try { return parse(source, { ecmaVersion: 'latest' }) } catch { requireContract(false, 'executable JavaScript unavailable') } }
const property = node => node?.type === 'MemberExpression' && (!node.computed ? node.property.name : node.property.value)
const literal = (node, value) => node?.type === 'Literal' && node.value === value
const properties = node => Object.fromEntries((node?.properties || []).filter(p => p.type === 'Property').map(p => [p.key.name ?? p.key.value, p.value]))
const last = node => node?.type === 'SequenceExpression' ? node.expressions.at(-1) : node
const definitions = tree => {
  const map = new Map()
  for (const n of nodes(tree)) {
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') map.set(n.id.name, last(n.init))
    if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier') map.set(n.left.name, last(n.right))
  }
  return map
}
const lexicalBindings = root => {
  const at = new WeakMap(), functionType = n => /^(?:FunctionExpression|FunctionDeclaration|ArrowFunctionExpression)$/.test(n.type)
  const bind = (scope, name, value) => {
    if (!scope.values.has(name)) scope.values.set(name, [])
    if (value) scope.values.get(name).push(last(value))
  }
  const visit = (node, parentScope) => {
    if (!node || typeof node !== 'object' || !node.type) return
    const scope = functionType(node) ? { parent: parentScope, values: new Map() } : parentScope
    at.set(node, scope)
    if (functionType(node)) for (const p of node.params) if (p.type === 'Identifier') bind(scope, p.name)
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') bind(scope, node.id.name, node.init)
    if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') {
      let target = scope
      while (target.parent && !target.values.has(node.left.name)) target = target.parent
      bind(target, node.left.name, node.right)
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) for (const item of value) visit(item, scope)
      else if (value && typeof value === 'object') visit(value, scope)
    }
  }
  visit(root, { parent: null, values: new Map() })
  return node => {
    let scope = at.get(node)
    while (scope && !scope.values.has(node.name)) scope = scope.parent
    return scope?.values.get(node.name) || []
  }
}

export const readClassplusClientReferences = html => {
  const document = readNativeDocument(html)
  requireContract(document.nodes(n => n.tag === 'title' && /^Classplus careers$/i.test(n.raw || '')).length === 1, 'employer careers document identity changed')
  requireContract(document.nodes(n => n.attrs.id === 'root').length === 1, 'active careers application unavailable')
  const scripts = document.nodes(n => n.tag === 'script' && /^(?:|module|text\/javascript|application\/javascript)$/i.test(n.attrs.type || ''))
  const main = scripts.filter(n => /^\/careers\/static\/js\/main\.[a-f\d]+\.chunk\.js$/.test(n.attrs.src || ''))
  requireContract(main.length === 1, 'current main bundle unavailable')
  const maps = []
  for (const script of scripts.filter(n => !n.attrs.src)) {
    const tree = ast(script.raw || ''), defs = definitions(tree)
    for (const statement of nodes(tree).filter(n => n.type === 'ReturnStatement')) {
      if (!nodes(statement.argument).some(n => literal(n, 'static/js/'))) continue
      const candidates = nodes(statement.argument).filter(n => n.type === 'ObjectExpression')
      for (const n of nodes(statement.argument)) if (n.type === 'Identifier' && defs.get(n.name)?.type === 'ObjectExpression') candidates.push(defs.get(n.name))
      for (const candidate of candidates) {
        const values = properties(candidate)
        if (['4', '5'].every(k => values[k]?.type === 'Literal' && /^[a-f\d]+$/.test(values[k].value))) maps.push(values)
      }
    }
  }
  requireContract(maps.length === 1, 'current executable lazy chunk map unavailable')
  return { mainUrl: new URL(main[0].attrs.src, 'https://classplusapp.com').href,
    listUrl: `https://classplusapp.com/careers/static/js/4.${maps[0][4].value}.chunk.js`,
    detailUrl: `https://classplusapp.com/careers/static/js/5.${maps[0][5].value}.chunk.js` }
}

const routeModule = (tree, route, chunk) => {
  const bindings = new Map()
  for (const n of nodes(tree).filter(n => n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init?.type === 'CallExpression')) {
    const callee = n.init.callee
    if (callee.type !== 'CallExpression' || !nodes(callee).some(v => property(v) === 'lazy')) continue
    const body = n.init.arguments[0], calls = nodes(body).filter(v => v.type === 'CallExpression')
    if (!calls.some(c => property(c.callee) === 'e' && literal(c.arguments[0], chunk))) continue
    const ids = calls.filter(c => property(c.callee) === 'bind' && literal(c.arguments[0], null) && Number.isSafeInteger(c.arguments[1]?.value)).map(c => c.arguments[1].value)
    if (ids.length === 1) bindings.set(n.id.name, ids[0])
  }
  const modules = nodes(tree).filter(n => n.type === 'ObjectExpression').map(properties)
    .filter(p => literal(p.path, route) && p.component?.type === 'Identifier').map(p => bindings.get(p.component.name)).filter(Number.isSafeInteger)
  requireContract(modules.length === 1, 'current route/lazy module binding changed')
  return modules[0]
}
const inspectModule = (source, id, endpoint) => {
  const tree = ast(source)
  const matches = nodes(tree).filter(n => n.type === 'Property' && String(n.key.value ?? n.key.name) === String(id) && n.value?.type === 'FunctionExpression')
  requireContract(matches.length === 1, 'current routed module missing')
  const module = matches[0].value, requireName = module.params[2]?.name, values = lexicalBindings(module)
  const isAxiosWrapper = node => {
    if (node?.type !== 'Identifier') return false
    return values(node).some(wrapper => wrapper?.type === 'CallExpression' && property(wrapper.callee) === 'n'
      && wrapper.callee.object.name === requireName && wrapper.arguments[0]?.type === 'Identifier'
      && values(wrapper.arguments[0]).some(value => value?.type === 'CallExpression' && value.callee.name === requireName && literal(value.arguments[0], 26)))
  }
  const resolve = (node, seen = new Set()) => {
    if (!node) return null
    if (node.type === 'Literal' && typeof node.value === 'string') return node.value
    if (node.type === 'Identifier' && !seen.has(node.name)) {
      const strings = [...new Set(values(node).map(value => resolve(value, new Set([...seen, node.name]))).filter(Boolean))]
      return strings.length === 1 ? strings[0] : null
    }
    if (node.type === 'CallExpression' && property(node.callee) === 'concat') return resolve(node.callee.object, seen)
    return null
  }
  const calls = nodes(module).filter(n => n.type === 'CallExpression' && property(n.callee) === 'get'
    && property(n.callee.object) === 'a' && isAxiosWrapper(n.callee.object.object) && resolve(n.arguments[0]) === endpoint)
  requireContract(calls.length === 1 && calls[0].arguments.length === 1, 'ordinary public jobs GET delegation changed')
  return nodes(module)
}

export const verifyClassplusClientContract = ({ main, listing, detail }) => {
  const tree = ast(main), listId = routeModule(tree, '/open-role', 4), detailId = routeModule(tree, '/job-description', 5)
  const list = inspectModule(listing, listId, CLASSPLUS_LIST_API), role = inspectModule(detail, detailId, CLASSPLUS_DETAIL_API)
  requireContract(list.some(n => property(n) === 'Jobs'), 'native listing envelope changed')
  const clientExcludesVidu = list.some(n => n.type === 'BinaryExpression' && n.operator === '!=='
    && ((literal(n.left, 'VIDU') && property(n.right) === 'department') || (literal(n.right, 'VIDU') && property(n.left) === 'department')))
  requireContract(clientExcludesVidu, 'native employer visibility filter changed')
  requireContract(role.some(n => property(n) === 'jobDescription') && role.some(n => property(n) === 'designation')
    && role.some(n => property(n) === 'locationCity') && role.some(n => property(n) === 'employeeType'), 'native full detail presentation changed')
  requireContract(role.some(n => n.type === 'AssignmentExpression' && property(n.left) === 'innerHTML')
    && role.some(n => property(n) === 'nodeValue') && role.some(n => property(n) === '__html' || n.type === 'Property' && (n.key.name ?? n.key.value) === '__html'), 'native description decoding/rendering contract changed')
  requireContract(role.some(n => n.type === 'CallExpression' && property(n.callee) === 'open' && n.callee.object.name === 'window'
    && property(n.arguments[0]) === 'jobLink' || n.type === 'CallExpression' && property(n.callee) === 'open' && n.callee.object.name === 'window'
    && n.arguments[0]?.type === 'Identifier') && role.some(n => property(n) === 'jobLink'), 'native apply handoff unavailable')
  // The current client submits only optional department/location/employmentType
  // filters. It renders the entire response, with no page/offset/cursor controls.
  const literals = list.filter(n => n.type === 'Literal' && typeof n.value === 'string').map(n => n.value)
  requireContract(!literals.some(s => /(?:[?&]|^)(?:page|offset|cursor|limit|perPage)=/i.test(s)), 'native pagination contract changed')
  requireContract(['department=', '&location=', '&employmentType='].every(s => literals.includes(s)), 'native unfiltered inventory contract changed')
  return { listId, detailId, clientExcludesVidu, pagination: 'current-client-unpaginated-response' }
}
