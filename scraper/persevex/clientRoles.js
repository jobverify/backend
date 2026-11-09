import { parse, parseExpressionAt } from 'acorn'

export const contractFailure = message => Object.assign(new Error(message), { code: 'PERSEVEX_CONTRACT_CHANGED', softFailure: true, failureKind: 'upstream_contract_changed', abortRetries: true })
const requireBinding = value => { if (!value) throw contractFailure('Persevex active published client detail/application binding changed') }
const id = (node, name) => node?.type === 'Identifier' && node.name === name
const literal = (node, value) => node?.type === 'Literal' && node.value === value
const key = node => node?.type === 'Identifier' ? node.name : node?.type === 'Literal' ? node.value : null
const member = (node, object, name) => node?.type === 'MemberExpression' && !node.computed && id(node.object, object) && key(node.property) === name
const property = (node, name) => node?.properties?.find(value => value.type === 'Property' && !value.computed && key(value.key) === name)
const value = (node, name) => property(node, name)?.value
const nodes = function * (node) {
  if (!node || typeof node.type !== 'string') return
  yield node
  for (const item of Object.values(node)) {
    if (Array.isArray(item)) { for (const child of item) yield * nodes(child) }
    else if (item && typeof item === 'object') yield * nodes(item)
  }
}
const find = (root, predicate) => [...nodes(root)].filter(predicate)
const directDeclarations = fn => fn.body?.body?.flatMap(statement => statement.type === 'VariableDeclaration' ? statement.declarations : []) ?? []
const declaration = (fn, name) => directDeclarations(fn).find(node => id(node.id, name))
const namedFunction = (scope, name) => scope.body.body.find(node => node.type === 'FunctionDeclaration' && id(node.id, name))
const returned = fn => fn?.body?.type === 'BlockStatement' ? fn.body.body.find(node => node.type === 'ReturnStatement')?.argument : fn?.body
const last = node => node?.type === 'SequenceExpression' ? node.expressions.at(-1) : node
const shape = node => Array.isArray(node) ? node.map(shape) : node && typeof node === 'object'
  ? Object.fromEntries(Object.entries(node).filter(([name]) => !['start', 'end', 'raw'].includes(name)).map(([name, child]) => [name, shape(child)])) : node
const sameExpression = (node, text) => JSON.stringify(shape(node)) === JSON.stringify(shape(parseExpressionAt(text, 0, { ecmaVersion: 'latest' })))
const jsx = node => {
  const callee = last(node?.callee)
  if (node?.type !== 'CallExpression' || callee?.type !== 'MemberExpression' || !['jsx', 'jsxs'].includes(key(callee.property))
    || node.arguments[1]?.type !== 'ObjectExpression') return null
  return { node, tag: node.arguments[0], props: node.arguments[1] }
}

// Follow expressions returned as React children, including map callbacks.
// An unused nested function or unrelated property is not a renderer.
const rendered = expression => {
  const elements = [], maps = []
  const visit = node => {
    const element = jsx(node)
    if (element) { elements.push(element); visit(value(element.props, 'children')); return }
    if (node?.type === 'ArrayExpression') { node.elements.forEach(visit); return }
    if (node?.type === 'LogicalExpression') { visit(node.right); return }
    if (node?.type === 'ConditionalExpression') { visit(node.consequent); visit(node.alternate); return }
    if (node?.type === 'CallExpression' && node.callee.type === 'MemberExpression' && key(node.callee.property) === 'map'
      && node.arguments[0]?.type === 'ArrowFunctionExpression') {
      maps.push(node); visit(returned(node.arguments[0]))
    }
  }
  visit(expression)
  return { elements, maps }
}
const tag = (element, name) => literal(element.tag, name) || id(element.tag, name)
const hasChildField = (elements, tagName, object, field) => elements.some(element => tag(element, tagName) && member(value(element.props, 'children'), object, field))

// Resolve the entry actually loaded by the top-level webpack registration.
// Comment/string/function decoys and unrelated sibling modules cannot qualify.
const publishedModule = program => {
  const registrations = program.body.map(statement => statement.type === 'ExpressionStatement' ? statement.expression : null).filter(call =>
    call?.type === 'CallExpression' && call.callee.type === 'MemberExpression' && key(call.callee.property) === 'push'
    && call.callee.object.type === 'AssignmentExpression' && member(call.callee.object.left, 'self', 'webpackChunk_N_E')
    && sameExpression(call.callee.object.right, 'self.webpackChunk_N_E||[]'))
  requireBinding(registrations.length === 1)
  const payload = registrations[0].arguments[0]
  requireBinding(payload?.type === 'ArrayExpression' && payload.elements.length === 3)
  const modules = payload.elements[1], runtime = payload.elements[2]
  requireBinding(modules?.type === 'ObjectExpression' && runtime?.type === 'ArrowFunctionExpression' && runtime.params.length === 1 && runtime.params[0].type === 'Identifier')
  const runtimeName = runtime.params[0].name
  requireBinding(runtime.body.type === 'BlockStatement' && runtime.body.body.length === 1 && runtime.body.body[0].type === 'ExpressionStatement')
  const sequence = runtime.body.body[0].expression
  requireBinding(sequence.type === 'SequenceExpression' && sequence.expressions.length === 2)
  const loadEntry = sequence.expressions[0], complete = sequence.expressions[1]
  requireBinding(loadEntry.type === 'CallExpression' && member(loadEntry.callee, runtimeName, 'O') && loadEntry.arguments.length === 3
    && literal(loadEntry.arguments[0], 0) && loadEntry.arguments[1].type === 'ArrayExpression'
    && loadEntry.arguments[1].elements.every(node => node?.type === 'Literal' && Number.isSafeInteger(node.value))
    && loadEntry.arguments[2].type === 'ArrowFunctionExpression' && loadEntry.arguments[2].params.length === 0)
  const invoke = loadEntry.arguments[2].body, assignedEntry = invoke?.arguments?.[0]
  requireBinding(invoke?.type === 'CallExpression' && id(invoke.callee, runtimeName) && invoke.arguments.length === 1
    && assignedEntry?.type === 'AssignmentExpression' && assignedEntry.operator === '=' && member(assignedEntry.left, runtimeName, 's')
    && assignedEntry.right.type === 'Literal' && Number.isSafeInteger(assignedEntry.right.value)
    && complete.type === 'AssignmentExpression' && complete.operator === '=' && id(complete.left, '_N_E')
    && complete.right.type === 'CallExpression' && member(complete.right.callee, runtimeName, 'O') && complete.right.arguments.length === 0)
  requireBinding(modules.properties.every(node => node.type === 'Property' && !node.computed)
    && new Set(modules.properties.map(node => key(node.key))).size === modules.properties.length)
  const entry = modules.properties.find(node => key(node.key) === assignedEntry.right.value)?.value
  requireBinding(entry?.type === 'ArrowFunctionExpression' && entry.params.length === 3 && entry.body.body?.length === 1)
  const load = entry.body.body[0].expression, then = load?.callee
  requireBinding(load?.type === 'CallExpression' && then?.type === 'MemberExpression' && key(then.property) === 'then'
    && then.object.type === 'CallExpression' && member(then.object.callee, 'Promise', 'resolve'))
  const bind = load.arguments[0], loader = entry.params[2]?.name
  requireBinding(bind?.type === 'CallExpression' && member(bind.callee, loader, 'bind') && id(bind.arguments[0], loader)
    && bind.arguments[1]?.type === 'Literal')
  const module = modules.properties.find(node => node.type === 'Property' && key(node.key) === bind.arguments[1].value)?.value
  requireBinding(module?.type === 'ArrowFunctionExpression' && module.params.length === 3 && module.body.type === 'BlockStatement')
  return module
}

const validateApplication = (scope, rootOutput, modern) => {
  const modalName = modern ? 'l' : 'c', selected = modern ? 's' : 'd'
  const modalElement = rootOutput.elements.find(element => tag(element, modalName))
  requireBinding(modalElement && member(value(modalElement.props, 'jobTitle'), selected, 'title') && member(value(modalElement.props, 'jobId'), selected, 'id'))
  const modal = namedFunction(scope, modalName)
  requireBinding(modal && directDeclarations(modal).some(node => node.id.type === 'ObjectPattern' && id(node.init, 'e')
    && value(node.id, 'jobTitle')?.type === 'AssignmentPattern' && id(value(node.id, 'jobTitle').left, modern ? 'l' : 'c')
    && value(node.id, 'jobId')?.type === 'AssignmentPattern' && id(value(node.id, 'jobId').left, modern ? 'x' : 'm')))
  const submit = declaration(modal, 'f')?.init
  requireBinding(submit?.type === 'ArrowFunctionExpression' && submit.async
    && rendered(returned(modal)).elements.some(element => tag(element, 'form') && id(value(element.props, 'onSubmit'), 'f')))
  const fetches = find(submit.body, node => node.type === 'CallExpression' && id(node.callee, 'fetch'))
  requireBinding(fetches.length === 1 && literal(fetches[0].arguments[0], '/api/applications'))
  const request = fetches[0].arguments[1], body = value(request, 'body')
  requireBinding(literal(value(request, 'method'), 'POST') && literal(value(value(request, 'headers'), 'Content-Type'), 'application/json')
    && body?.type === 'CallExpression' && member(body.callee, 'JSON', 'stringify')
    && id(value(body.arguments[0], 'jobTitle'), modern ? 'l' : 'c') && id(value(body.arguments[0], 'jobId'), modern ? 'x' : 'm'))
}

const validateRenderer = (scope, arrayName) => {
  const modern = arrayName === 'P', rootName = modern ? 'D' : 'I', root = namedFunction(scope, rootName)
  const loader = scope.params[2].name, exports = scope.params[1].name
  const activeExpressions = scope.body.body.flatMap(statement => statement.type === 'ExpressionStatement'
    ? statement.expression.type === 'SequenceExpression' ? statement.expression.expressions : [statement.expression] : [])
  requireBinding(root && activeExpressions.some(call => call.type === 'CallExpression' && member(call.callee, loader, 'd') && id(call.arguments[0], exports)
    && value(call.arguments[1], 'default')?.type === 'ArrowFunctionExpression' && id(value(call.arguments[1], 'default').body, rootName)))
  const rootOutput = rendered(returned(root)), renderer = modern ? namedFunction(scope, 'T') : namedFunction(scope, 'S')
  requireBinding(renderer)
  let card, position
  if (modern) {
    requireBinding(rootOutput.elements.some(element => tag(element, 'T') && id(value(element.props, 'onApply'), 'c'))
      && sameExpression(declaration(root, 'c')?.init, 'e=>{p(e),d(!0)}'))
    requireBinding(directDeclarations(root).some(node => node.id.type === 'ArrayPattern' && id(node.id.elements[0], 's') && id(node.id.elements[1], 'p')))
    requireBinding(sameExpression(declaration(scope, 'L')?.init, '({query:"",department:"",type:"",location:"",remoteOnly:!1})'))
    const filtered = declaration(renderer, 'x')?.init
    requireBinding(filtered?.type === 'CallExpression' && id(filtered.arguments[0], 'P') && id(filtered.arguments[1], 'a')
      && filtered.callee.type === 'FunctionExpression' && sameExpression(returned(filtered.callee), 'e.filter(e=>(e.title.toLowerCase().includes(d)||e.description.toLowerCase().includes(d)||e.department.toLowerCase().includes(d))&&(!i||e.department===i)&&(!n||e.type===n)&&(!o||e.location===o)&&(!a||e.location.toLowerCase().includes("remote")))'))
    const output = rendered(returned(renderer)), maps = output.maps.filter(call => member(call.callee, 'x', 'map'))
    requireBinding(maps.length === 1 && id(maps[0].arguments[0].params[0], 'e'))
    const element = jsx(returned(maps[0].arguments[0]))
    requireBinding(element && tag(element, 'article') && member(element.node.arguments[2], 'e', 'id'))
    card = rendered(element.node); position = 'e'
    requireBinding(directDeclarations(renderer).some(node => node.id.type === 'ObjectPattern' && id(value(node.id, 'onApply'), 't') && id(node.init, 'e')))
    requireBinding(card.elements.some(element => tag(element, 'a') && literal(value(element.props, 'href'), '#application')
      && sameExpression(value(element.props, 'onClick'), 'r=>{r.preventDefault(),t(e)}')))
  } else {
    requireBinding(member(declaration(root, 'M')?.init?.callee, 'C', 'filter') && member(declaration(root, 'E')?.init?.callee, 'M', 'reduce'))
    const cards = rootOutput.elements.filter(element => tag(element, 'S'))
    requireBinding(cards.length === 1 && id(value(cards[0].props, 'position'), 'e')
      && sameExpression(value(cards[0].props, 'onApply'), '(e,t)=>{u({title:e,id:t}),l(!0)}')
      && rootOutput.maps.some(call => call.callee.object?.type === 'MemberExpression' && id(call.callee.object.object, 'E')))
    requireBinding(directDeclarations(renderer).some(node => node.id.type === 'ObjectPattern' && id(value(node.id, 'position'), 't') && id(value(node.id, 'onApply'), 'o') && id(node.init, 'e')))
    card = rendered(returned(renderer)); position = 't'
    requireBinding(card.elements.some(element => tag(element, 'button') && sameExpression(value(element.props, 'onClick'), '()=>o(t.title,t.id)')))
  }
  requireBinding(hasChildField(card.elements, 'h3', position, 'title') && hasChildField(card.elements, 'p', position, 'description'))
  const requirementMaps = card.maps.filter(call => call.callee.object?.type === 'MemberExpression' && member(call.callee.object, position, 'requirements'))
  requireBinding(requirementMaps.length === 1)
  const requirement = requirementMaps[0].arguments[0], item = jsx(returned(requirement))
  const requirementChildren = value(item?.props, 'children')
  requireBinding(requirement.params.length >= 1 && requirement.params.length <= 2 && item && tag(item, 'li')
    && (id(requirementChildren, requirement.params[0].name) || requirementChildren?.type === 'ArrayExpression'
      && requirementChildren.elements.some(child => id(child, requirement.params[0].name))))
  validateApplication(scope, rootOutput, modern)
}

const readLiteral = (node, depth = 0) => {
  if (depth > 5) throw contractFailure('Persevex malformed client literal depth')
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node?.type === 'ArrayExpression' && node.elements.length <= 200) return node.elements.map(item => readLiteral(item, depth + 1))
  if (node?.type === 'ObjectExpression') {
    const object = Object.create(null)
    for (const field of node.properties) {
      if (field.type !== 'Property' || field.computed || field.method || field.shorthand || field.kind !== 'init'
        || !['Identifier', 'Literal'].includes(field.key.type) || typeof key(field.key) !== 'string') throw contractFailure('Persevex invalid non-static client data literal')
      const name = key(field.key)
      if (Object.hasOwn(object, name)) throw contractFailure('Persevex duplicate client role property')
      object[name] = readLiteral(field.value, depth + 1)
    }
    return object
  }
  throw contractFailure('Persevex invalid non-static client data literal')
}

// Parse source as data only. No eval, Function, import or page script execution.
export const extractClientRoles = input => {
  const client = String(input ?? '')
  if (!client || Buffer.byteLength(client) > 1024 * 1024) throw contractFailure('Persevex published careers client is required and bounded')
  let program
  try { program = parse(client, { ecmaVersion: 'latest', sourceType: 'script' }) } catch { throw contractFailure('Persevex malformed active published client') }
  const scope = publishedModule(program)
  const arrays = directDeclarations(scope).filter(node => ['P', 'C'].includes(node.id.name) && node.init?.type === 'ArrayExpression'
    && node.init.elements[0]?.type === 'ObjectExpression' && property(node.init.elements[0], 'id'))
  requireBinding(arrays.length === 1)
  const roleDeclaration = arrays[0], arrayName = roleDeclaration.id.name
  requireBinding(!find(scope.body, node => node.type === 'AssignmentExpression' && id(node.left, arrayName) || node.type === 'UpdateExpression' && id(node.argument, arrayName)).length)
  validateRenderer(scope, arrayName)
  const roles = readLiteral(roleDeclaration.init)
  if (!roles.length) throw contractFailure('Persevex zero inventory has no verified explicit empty-opening statement')
  const ids = new Set(), titles = new Set(), allowed = new Set(['id', 'title', 'department', 'type', 'location', 'stipend', 'description', 'requirements'])
  for (const role of roles) {
    if (!role || Array.isArray(role) || Object.keys(role).some(name => !allowed.has(name))) throw contractFailure('Persevex invalid published role schema')
    for (const name of ['id', 'title', 'department', 'type', 'location', 'description']) if (typeof role[name] !== 'string' || !role[name].trim()) throw contractFailure('Persevex invalid published role ' + name)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(role.id)) throw contractFailure('Persevex invalid published role identity')
    if (!Array.isArray(role.requirements) || !role.requirements.length || role.requirements.some(text => typeof text !== 'string' || !text.trim())) throw contractFailure('Persevex invalid published role requirements')
    if (role.stipend != null && (typeof role.stipend !== 'string' || !role.stipend.trim())) throw contractFailure('Persevex invalid published role stipend')
    if (ids.has(role.id) || titles.has(role.title)) throw contractFailure('Persevex duplicate published role identity')
    ids.add(role.id); titles.add(role.title)
  }
  return roles
}
