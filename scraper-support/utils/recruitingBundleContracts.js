import { parse } from 'acorn'

const functions = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])
const member = (node, name) => node?.type === 'MemberExpression' && !node.computed && node.property.name === name
const storageCall = (node, method) => node?.type === 'CallExpression' && member(node.callee, method)
  && node.callee.object.type === 'Identifier' && node.callee.object.name === 'sessionStorage'
const findBinding = (scope, name) => scope?.bindings.has(name) ? scope.bindings.get(name) : scope?.parent ? findBinding(scope.parent, name) : null

// Read static URL/tenant contracts from executable syntax. This never evaluates
// downloaded JavaScript; comments and quoted code cannot become calls/bindings.
export const inspectRecruitingBundle = (source, { sessionTenant } = {}) => {
  if (typeof source !== 'string' || source.length > 3000000) throw new Error('Recruiting bundle exceeds supported contract budget')
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' })
  const scopes = new WeakMap(), calls = [], assignments = []
  const bindPattern = (node, scope) => {
    if (!node) return
    if (node.type === 'Identifier') scope.bindings.set(node.name, { values: [], scope })
    else if (node.type === 'AssignmentPattern') bindPattern(node.left, scope)
    else if (node.type === 'RestElement') bindPattern(node.argument, scope)
    else if (node.type === 'ArrayPattern') for (const item of node.elements) bindPattern(item, scope)
    else if (node.type === 'ObjectPattern') for (const property of node.properties) bindPattern(property.value || property.argument, scope)
  }
  const visit = (node, scope, parent) => {
    if (!node || typeof node !== 'object' || !node.type) return
    if (node.type === 'IfStatement' && typeof node.test.value === 'boolean') {
      visit(node.test, scope, node); visit(node.test.value ? node.consequent : node.alternate, scope, node); return
    }
    if (node.type === 'LogicalExpression' && typeof node.left.value === 'boolean') {
      visit(node.left, scope, node)
      if ((node.operator === '&&' && node.left.value) || (node.operator === '||' && !node.left.value)) visit(node.right, scope, node)
      return
    }
    if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id) bindPattern(node.id, scope)
    if (node.type === 'ImportDeclaration') for (const specifier of node.specifiers) bindPattern(specifier.local, scope)
    if (node.type === 'Program' || node.type === 'BlockStatement' || functions.has(node.type) || node.type === 'ClassBody' || node.type === 'CatchClause') {
      const next = { parent: scope, bindings: new Map(), functionScope: null, classBody: scope?.classBody }
      next.functionScope = node.type === 'Program' || functions.has(node.type) ? next : scope.functionScope
      if (node.type === 'ClassBody') next.classBody = node
      scope = next
      if (functions.has(node.type)) for (const parameter of node.params) bindPattern(parameter, scope)
      if (functions.has(node.type) && node.id) bindPattern(node.id, scope)
      if (node.type === 'CatchClause') bindPattern(node.param, scope)
      if (node.type === 'ClassBody' && parent.id) bindPattern(parent.id, scope)
    }
    scopes.set(node, scope)
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
      const target = parent.kind === 'var' ? scope.functionScope : scope
      const binding = target.bindings.get(node.id.name) || { values: [], scope }
      if (node.init) binding.values.push(node.init)
      target.bindings.set(node.id.name, binding)
    }
    if (node.type === 'VariableDeclarator' && node.id.type !== 'Identifier') bindPattern(node.id, parent.kind === 'var' ? scope.functionScope : scope)
    if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') assignments.push({ node, scope })
    if (node.type === 'CallExpression') calls.push({ node, scope })
    for (const [key, value] of Object.entries(node)) {
      if (['start', 'end', 'type'].includes(key)) continue
      if (Array.isArray(value)) for (const child of value) visit(child, scope, node)
      else if (value?.type) visit(value, scope, node)
    }
  }
  visit(ast, null, null)
  for (const { node, scope } of assignments) {
    const binding = findBinding(scope, node.left.name)
    if (binding) { binding.mutated = true; binding.values.push(node.operator === '=' ? node.right : null) }
  }
  const combine = (left, right) => [...new Set(left.flatMap(a => right.map(b => a + b)))].slice(0, 8)
  const tenantWrites = new Set()
  const resolve = (node, scope, holes = false, seen = new Set(), immutable = false) => {
    const unknown = () => holes ? ['{?}'] : []
    if (!node) return unknown()
    if (node.type === 'Literal' && ['string', 'number'].includes(typeof node.value)) return [String(node.value)]
    if (node.type === 'Identifier') {
      const binding = findBinding(scope, node.name)
      if (!binding || seen.has(binding) || (immutable && binding.mutated)) return unknown()
      const nextSeen = new Set([...seen, binding])
      const alternatives = binding.values.map(value => resolve(value, scopes.get(value) || binding.scope, holes, nextSeen, immutable))
      if (!holes && alternatives.some(values => !values.length)) return []
      const values = alternatives.flat()
      return values.length ? [...new Set(values)].slice(0, 8) : unknown()
    }
    if (node.type === 'TemplateLiteral') {
      let values = [node.quasis[0].value.cooked]
      for (let i = 0; i < node.expressions.length; i++) {
        values = combine(values, resolve(node.expressions[i], scope, holes, seen, immutable)).map(value => value + node.quasis[i + 1].value.cooked)
      }
      return values
    }
    if (node.type === 'BinaryExpression' && node.operator === '+') {
      return combine(resolve(node.left, scope, holes, seen, immutable), resolve(node.right, scope, holes, seen, immutable))
    }
    if (node.type === 'CallExpression' && node.callee.object?.type === 'ThisExpression'
      && member(node.callee, 'getTenant') && sessionTenant && tenantWrites.has(sessionTenant)) {
      const getter = scope.classBody?.body.find(method => method.key?.name === 'getTenant')
      const returned = getter?.value?.body?.body
      if (returned?.length === 1 && returned[0].type === 'ReturnStatement'
        && storageCall(returned[0].argument, 'getItem')
        && returned[0].argument.arguments[0]?.value === 'TENANT') return [sessionTenant]
    }
    return unknown()
  }
  for (const { node, scope } of calls) if (storageCall(node, 'setItem') && node.arguments[0]?.value === 'TENANT') {
    for (const value of resolve(node.arguments[1], scope, false, new Set(), true)) tenantWrites.add(value)
  }
  const fetchUrls = new Set(), httpGetTemplates = new Set(), httpGetStaticUrls = new Set()
  for (const { node, scope } of calls) {
    if (node.callee.type === 'Identifier' && node.callee.name === 'fetch' && !findBinding(scope, 'fetch')) {
      for (const url of resolve(node.arguments[0], scope, false, new Set(), true)) if (/^https:\/\//.test(url)) fetchUrls.add(url)
    }
    if (member(node.callee, 'get')) for (const url of resolve(node.arguments[0], scope, true)) {
      if (/^https:\/\//.test(url)) httpGetTemplates.add(url)
    }
    if (member(node.callee, 'get')) for (const url of resolve(node.arguments[0], scope)) {
      if (/^https:\/\//.test(url)) httpGetStaticUrls.add(url)
    }
  }
  return { fetchUrls: [...fetchUrls], httpGetTemplates: [...httpGetTemplates], httpGetStaticUrls: [...httpGetStaticUrls], tenantWrites: [...tenantWrites] }
}
