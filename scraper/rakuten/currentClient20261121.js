import { parse } from 'acorn'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { need, one } from './currentFacts20261121.js'
import { nativePrograms } from './currentLexical20261121.js'
import { normalizeInvocation } from './currentInvocations20261121.js'

const cache = new Map()
const key = node => node?.type === 'Identifier' ? node.name : node?.value
const member = node => node?.type === 'ChainExpression' ? member(node.expression) : node?.type === 'ThisExpression' ? 'this' : node?.type === 'Identifier' ? node.name : node?.type === 'MemberExpression' && (!node.computed || node.property.type === 'Literal') ? member(node.object) + '.' + key(node.property) : null
const children = node => Object.entries(node).filter(([name]) => !['start', 'end', 'loc', 'raw'].includes(name)).flatMap(([, value]) => Array.isArray(value) ? value.filter(n => n && typeof n === 'object') : value && typeof value === 'object' ? [value] : [])
function plain(node) {
  if (node?.type === 'Literal' && (node.value == null || ['string', 'number', 'boolean'].includes(typeof node.value))) return node.value
  if (node?.type === 'UnaryExpression' && node.operator === '!' && node.argument.type === 'Literal' && [0, 1].includes(node.argument.value)) return !node.argument.value
  if (node?.type === 'ArrayExpression') { need(node.elements.every(Boolean), 'client sparse literal'); return node.elements.map(plain) }
  need(node?.type === 'ObjectExpression', 'client nonliteral public configuration')
  const out = {}
  for (const p of node.properties) {
    const name = key(p.key)
    need(p.type === 'Property' && p.kind === 'init' && !p.computed && !p.method && !p.shorthand && typeof name === 'string' && !['__proto__', 'constructor', 'prototype'].includes(name) && !Object.hasOwn(out, name), 'client duplicate/dynamic configuration')
    Object.defineProperty(out, name, { value: plain(p.value), enumerable: true })
  }
  return out
}
const property = (node, name) => one(node.properties.filter(p => key(p.key) === name), 'client property ' + name).value
function semantic(node) {
  const bindings = new Map(), stack = [node.value]
  while (stack.length) {
    const n = stack.shift()
    if (n.type === 'VariableDeclarator') { need(n.id.type === 'Identifier', 'client binding pattern'); if (!bindings.has(n.id.name)) bindings.set(n.id.name, '$' + bindings.size) }
    if (['FunctionExpression', 'ArrowFunctionExpression'].includes(n.type)) for (const p of n.params) { need(p.type === 'Identifier', 'client parameter pattern'); if (!bindings.has(p.name)) bindings.set(p.name, '$' + bindings.size) }
    stack.push(...children(n))
  }
  function copy(n, parent, field) {
    if (Array.isArray(n)) return n.map(v => copy(v, parent, field))
    if (!n || typeof n !== 'object') return n
    if (n.type === 'Identifier') return { type: 'Identifier', name: (parent?.type === 'MemberExpression' && field === 'property' && !parent.computed || parent?.type === 'Property' && field === 'key' && !parent.computed || parent?.type === 'MethodDefinition' && field === 'key') ? n.name : bindings.get(n.name) ?? n.name }
    const result = {}
    for (const [name, value] of Object.entries(n)) if (!['start', 'end', 'raw', 'loc'].includes(name)) result[name] = copy(value, n, name)
    if (n.type === 'ObjectExpression') result.properties.sort((a, b) => String(key(a.key)).localeCompare(String(key(b.key))))
    return result
  }
  return copy(node)
}
function meaning(actual, template) {
  const expected = parse('class Current{' + template + '}', { ecmaVersion: 'latest' }).body[0].body.body[0]
  need(isDeepStrictEqual(semantic(actual), semantic(expected)), 'client declared public method semantics changed: ' + key(actual.key))
}
const writeTargets = node => !node ? [] : node.type === 'ArrayPattern' ? node.elements.flatMap(writeTargets) : node.type === 'ObjectPattern' ? node.properties.flatMap(property => writeTargets(property.type === 'RestElement' ? property.argument : property.value)) : node.type === 'AssignmentPattern' ? writeTargets(node.left) : node.type === 'RestElement' ? writeTargets(node.argument) : node.type === 'VariableDeclaration' ? node.declarations.flatMap(declaration => writeTargets(declaration.id)) : [node]
const writeTarget = node => node.type === 'AssignmentExpression' ? node.left : node.type === 'UpdateExpression' || node.type === 'UnaryExpression' && node.operator === 'delete' ? node.argument : ['ForInStatement', 'ForOfStatement'].includes(node.type) ? node.left : null
function protectEnvironment(p, declaration) {
  const fields = new Set(['COMPANYID', 'DOMAIN', 'APIENDPOINT', 'APIENDPOINTNEW']), binding = p.binding(declaration.id)
  need(binding?.defs.length === 1 && binding.writes.length === 0, 'current native environment binding is replaced')
  const path = (node, depth = 0, seen = new Set()) => {
    need(depth <= 32, 'finite current environment alias scope')
    if (node === declaration.init) return []
    if (node?.type === 'Identifier') {
      const owner = p.binding(node)
      if (owner === binding) return []
      if (!owner || seen.has(owner) || owner.defs.length !== 1 || !owner.defs[0].init) return null
      const next = new Set(seen); next.add(owner)
      return path(owner.defs[0].init, depth + 1, next)
    }
    if (node?.type === 'MemberExpression') { const root = path(node.object, depth + 1, seen); return root == null ? null : [...root, p.member(node)] }
    return null
  }
  const protectedTarget = node => { const target = path(node); return target != null && (target.length === 0 || target[0] == null || fields.has(target[0])) }
  const builtinCall = (call, name, method) => call.callee?.type === 'MemberExpression' && p.builtin(call.callee.object, name) && p.member(call.callee) === method
  for (const node of p.nodes) {
    for (const target of writeTargets(writeTarget(node))) need(!protectedTarget(target), 'current native account/environment field is overwritten')
    if (node.type !== 'CallExpression') continue
    const object = p.resolve(node.callee?.object), method = p.member(node.callee)
    const intrinsic = node.callee?.type === 'MemberExpression' && (p.builtin(object, 'Object') || p.builtin(object, 'Reflect'))
    const first = path(node.arguments[0])
    if (intrinsic && first != null && ['assign', 'defineProperties', 'setPrototypeOf'].includes(method)) {
      if (method === 'assign' || method === 'defineProperties') {
        for (const input of node.arguments.slice(1)) {
          const literal = p.resolve(input)
          need(first.length === 0 && literal?.type === 'ObjectExpression' && literal.properties.every(property => property.type === 'Property' && !property.computed && !fields.has(key(property.key))), 'current native environment is overwritten through object helper')
        }
      } else need(false, 'current native environment prototype is replaced')
    }
    if (intrinsic && first != null && ['set', 'defineProperty', 'deleteProperty'].includes(method)) {
      const field = p.literal(node.arguments[1]); need(first.length === 0 && typeof field === 'string' && !fields.has(field), 'current native account/environment is overwritten through reflection')
    }
    const escapes = node.arguments.some(argument => { const candidate = path(argument); return candidate != null && candidate.length === 0 })
    if (escapes) {
      const sourceOnlyAssign = builtinCall(node, 'Object', 'assign') && first == null
      const readOnly = node.callee?.type === 'MemberExpression' && p.builtin(object, 'Object') && ['keys', 'values', 'entries', 'getOwnPropertyNames', 'getOwnPropertySymbols', 'getOwnPropertyDescriptor', 'getOwnPropertyDescriptors', 'freeze', 'seal', 'preventExtensions', 'isExtensible', 'isFrozen', 'isSealed', 'assign', 'defineProperty', 'defineProperties'].includes(method)
      need(sourceOnlyAssign || readOnly, 'current native environment escapes to an unqualified mutator')
    }
  }
  // Only the selected object identity is protected. Immutable aliases and
  // independent read-only copies remain distinct from mutable container escape.
  for (const node of p.nodes) if (node.type === 'Identifier') {
    const parent = p.parents.get(node)
    if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed || parent?.type === 'Property' && parent.key === node && parent.value !== node && !parent.computed) continue
    const reference = path(node)
    if (reference == null || reference.length !== 0) continue
    const alias = parent?.type === 'VariableDeclarator' && (parent.id === node || parent.init === node)
    const field = parent?.type === 'MemberExpression' && parent.object === node
    const readCall = parent?.type === 'CallExpression' && parent.arguments.includes(node)
    const clone = parent?.type === 'SpreadElement' && p.parents.get(parent)?.type === 'ObjectExpression'
    need(alias || field || readCall || clone, 'current native environment escapes through an unqualified identity transfer')
  }
}
function stableInvocationArrays(p, arrays) {
  if (!arrays.size) return
  for (const array of arrays) need(array.elements.every(Boolean), 'current native invocation tuple is sparse')
  const bindings = new Set(), depends = (node, seen = new Set()) => {
    if (!node || seen.has(node)) return false
    seen.add(node)
    if (arrays.has(node) || node.type === 'Identifier' && bindings.has(p.binding(node))) return true
    if (node.type === 'MemberExpression') return depends(node.object, seen)
    if (node.type === 'ArrayExpression') return node.elements.some(value => depends(value, seen))
    if (node.type === 'ObjectExpression') return node.properties.some(property => depends(property.type === 'SpreadElement' ? property.argument : property.value, seen))
    if (node.type === 'SpreadElement') return depends(node.argument, seen)
    const resolved = p.resolve(node)
    return resolved !== node && depends(resolved, seen)
  }
  for (let pass = 0; pass < 16; pass++) {
    let changed = false
    for (const node of p.nodes) if (node.type === 'VariableDeclarator' && depends(node.init) && node.id.type === 'Identifier') {
      const binding = p.binding(node.id)
      if (binding && !bindings.has(binding)) { bindings.add(binding); changed = true }
    }
    if (!changed) break
    need(pass < 15, 'finite current native invocation tuple aliases')
  }
  for (const node of p.nodes) {
    for (const target of writeTargets(writeTarget(node))) need(!depends(target), 'current native invocation tuple is mutated')
    if (node.type === 'AssignmentExpression' && depends(node.right) || node.type === 'ReturnStatement' && depends(node.argument)) need(false, 'current native invocation tuple escapes through a mutable transfer')
    if (node.type !== 'CallExpression') continue
    const call = normalizeInvocation(p, node.callee, node.arguments)
    if (!call) continue
    const callee = call.callee, name = p.member(callee)
    if (['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin'].includes(name)) need(!depends(call.thisValue ?? callee.object), 'current native invocation tuple mutator')
    const reflection = callee?.type === 'MemberExpression' && (p.builtin(p.resolve(callee.object), 'Object') || p.builtin(p.resolve(callee.object), 'Reflect'))
    if (reflection && ['assign', 'defineProperty', 'defineProperties', 'set', 'deleteProperty', 'setPrototypeOf'].includes(name)) need(!call.unknown && !depends(call.args[0]), 'current native invocation tuple reflection')
    if (call.args.some(argument => depends(argument))) need(reflection && ['keys', 'values', 'entries', 'getOwnPropertyNames', 'getOwnPropertySymbols', 'getOwnPropertyDescriptor', 'getOwnPropertyDescriptors', 'isExtensible', 'isFrozen', 'isSealed'].includes(name), 'current native invocation tuple escapes to an unqualified consumer')
  }
}
function protectInstance(p, cls, fields, allowed, classOwner) {
  const path = (node, depth = 0, seen = new Set()) => {
    need(depth <= 32, 'finite current instance alias scope')
    if (node?.type === 'ThisExpression') return classOwner(node) === cls ? [] : null
    if (node?.type === 'Identifier') {
      const binding = p.binding(node)
      if (!binding || seen.has(binding) || binding.defs.length !== 1 || !binding.defs[0].init) return null
      const next = new Set(seen); next.add(binding)
      return path(binding.defs[0].init, depth + 1, next)
    }
    if (node?.type === 'MemberExpression') { const root = path(node.object, depth + 1, seen); return root == null ? null : [...root, p.member(node)] }
    return null
  }
  const protectedTarget = node => { const target = path(node); return target != null && target.length > 0 && (target[0] == null || fields.has(target[0])) }
  for (const node of p.nodes) {
    for (const target of writeTargets(writeTarget(node))) if (protectedTarget(target)) need(allowed.has(node), 'current native selected instance configuration is overwritten')
    if (node.type !== 'CallExpression') continue
    const arrays = new Set(), call = normalizeInvocation(p, node.callee, node.arguments, { onArray: array => arrays.add(array) })
    if (!call || call.callee?.type !== 'MemberExpression' || !(p.builtin(p.resolve(call.callee.object), 'Object') || p.builtin(p.resolve(call.callee.object), 'Reflect'))) continue
    const method = p.member(call.callee), target = path(call.args[0])
    if (!['assign', 'defineProperty', 'defineProperties', 'set', 'deleteProperty', 'setPrototypeOf'].includes(method)) continue
    if (target != null || classOwner(node) === cls) { need(!call.unknown, 'current native selected instance invocation arguments are unresolved'); stableInvocationArrays(p, arrays) }
    if (target == null) continue
    need(!protectedTarget(call.args[0]), 'current native selected instance configuration is mutated through object helper')
    if (target.length > 0) continue
    const safeField = field => typeof field === 'string' && !fields.has(field) && !['__proto__', 'constructor', 'prototype'].includes(field)
    if (method === 'assign' || method === 'defineProperties') {
      for (const input of call.args.slice(1)) {
        const literal = p.resolve(input)
        need(literal?.type === 'ObjectExpression' && literal.properties.every(property => property.type === 'Property' && property.kind === 'init' && safeField(property.computed ? p.literal(property.key) : key(property.key))), 'current native selected instance field is overwritten through object helper')
      }
    } else if (method === 'setPrototypeOf') need(false, 'current native selected instance prototype is replaced')
    else need(safeField(p.literal(call.args[1])), 'current native selected instance field is overwritten through reflection')
  }
}
export function qualifyCurrentClient(source) {
  need(typeof source === 'string' && Buffer.byteLength(source) <= 4000000, 'finite current public client')
  const digest = createHash('sha256').update(source).digest('hex')
  if (cache.has(digest)) return structuredClone(cache.get(digest))
  const [lexical] = nativePrograms([{ raw: source, attrs: { type: 'module' } }]), { nodes, parents } = lexical
  need(nodes.length < 1000000, 'finite public client AST')
  const ancestors = node => { const values = []; for (let n = node; n; n = parents.get(n)) values.push(n); return values }
  const within = (node, owner) => ancestors(node).includes(owner)
  const method = name => one(nodes.filter(n => n.type === 'MethodDefinition' && key(n.key) === name), 'current public method ' + name)
  const owner = n => ancestors(n).find(p => ['ClassDeclaration', 'ClassExpression'].includes(p.type))
  const reachable = (node, stop, allowUnconditionalIfTest = false) => {
    for (const n of ancestors(node)) {
      if (n === stop) return true
      need(!['IfStatement', 'ConditionalExpression', 'LogicalExpression', 'ForStatement', 'WhileStatement', 'DoWhileStatement', 'TryStatement', 'ReturnStatement', 'ThrowStatement'].includes(n.type) || allowUnconditionalIfTest && n.type === 'IfStatement' && within(node, n.test), 'critical native consumer unreachable or conditional')
      const p = parents.get(n)
      if (p?.type === 'BlockStatement') for (const previous of p.body.slice(0, p.body.indexOf(n))) need(!['ReturnStatement', 'ThrowStatement', 'IfStatement', 'TryStatement'].includes(previous.type), 'critical native consumer preceded by an unresolved exit')
    }
    need(false, 'critical native consumer outside selected method')
  }
  const registration = cls => {
    const lexical = ancestors(cls).find(n => n.type === 'ArrowFunctionExpression'), matches = nodes.filter(n => n.type === 'AssignmentExpression' && member(n.left) === cls.id.name + '.ɵcmp' && ancestors(n).find(n => n.type === 'ArrowFunctionExpression') === lexical)
    const reg = one(matches, 'registered selected native component')
    need(reg.right.type === 'CallExpression' && reg.right.arguments.length === 1, 'native component registration shape')
    const config = reg.right.arguments[0]
    need(config.type === 'ObjectExpression' && property(config, 'type').name === cls.id.name, 'native registered component identity')
    need(lexical && parents.get(lexical)?.type === 'CallExpression' && parents.get(lexical).callee === lexical, 'native component factory is not invoked')
    return { config, selectors: plain(property(config, 'selectors')) }
  }
  const environment = one(nodes.filter(n => n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init?.type === 'ObjectExpression' && ['COMPANYID', 'DOMAIN', 'APIENDPOINTNEW'].every(name => n.init.properties.some(p => key(p.key) === name))), 'current account environment')
  const env = plain(environment.init)
  need(env.COMPANYID === 'MTUxMjQ=' && env.DOMAIN === 'rakuten.openings.co' && env.APIENDPOINT === 'https://apic2.zwayam.com/' && env.APIENDPOINTNEW === env.APIENDPOINT, 'current native account/API origin differs')
  protectEnvironment(lexical, environment)
  let rootClass
  for (const name of ['COMPANYID', 'DOMAIN', 'APIENDPOINT', 'APIENDPOINTNEW']) {
    const call = one(nodes.filter(n => n.type === 'CallExpression' && member(n.callee) === 'sessionStorage.setItem' && n.arguments[0]?.value === name), 'selected native account storage write ' + name)
    const writer = ancestors(call).find(n => n.type === 'MethodDefinition')
    need(key(writer?.key) === 'ngOnInit' && member(call.arguments[1]) === environment.id.name + '.' + name, 'current root account handoff differs')
    need(lexical.builtin(call.callee.object, 'sessionStorage') && lexical.binding(call.arguments[1].object) === lexical.binding(environment.id), 'current root account consumer has a different lexical owner')
    reachable(call, writer.value.body)
    rootClass ??= owner(writer); need(rootClass === owner(writer), 'account writes belong to different native components')
  }
  need(isDeepStrictEqual(registration(rootClass).selectors, [['app-root']]), 'current app-root account owner differs')
  meaning(method('getFormDataFromJson'), 'getFormDataFromJson(t){const o=new FormData;for(const r in t)o.append(r,"object"!=typeof t[r]||"file"==r?t[r]:JSON.stringify(t[r]));return o}')
  meaning(method('searchJobsv1'), 'searchJobsv1(t,o){!1!==o&&(this.dataStore.fetchingJobs=!0);const r=this.commonService.getFormDataFromJson(t),s=this.SERVER_HOST+this.API_ENDPOINTS.search.v1,u=this.returnTenantHeader();return this.http.post(s,r,{headers:u})}')
  meaning(method('getJobData'), 'getJobData(t){this.commonService.getFormDataFromJson(t);const r=this.SERVER_HOST+this.API_ENDPOINTS.getJobData,s=this.returnTenantHeader();return this.http.post(r,t,{headers:s})}')
  meaning(method('getDomain'), 'getDomain(){let t;return t="localhost"==window.location.hostname?sessionStorage.getItem("DOMAIN")||"":window.location.hostname,t}')
  const endpointAssignment = one(nodes.filter(n => n.type === 'AssignmentExpression' && member(n.left) === 'this.API_LIST' && n.right.type === 'ObjectExpression' && n.right.properties.some(p => key(p.key) === 'getJobData')), 'selected native endpoint registry'), endpoints = endpointAssignment.right
  need(plain(property(endpoints, 'search')).v1 === 'jobs/search' && plain(property(endpoints, 'getJobData')) === 'jobs-service/v1/jobs/careersite' && plain(property(endpoints, 'getCompanyConfigurationDetails')) === 'data-service/v2/company/', 'native public endpoint paths differ')
  protectInstance(lexical, owner(endpointAssignment), new Set(['API_LIST']), new Set([endpointAssignment]), owner)
  const service = owner(method('searchJobsv1')), serviceSetter = one(service.body.body.filter(node => node.type === 'MethodDefinition' && key(node.key) === 'setApiEndpointsFromSession'), 'current actual selected endpoint setter')
  need(owner(method('getJobData')) === service, 'current search/detail services have different owners')
  meaning(serviceSetter, 'setApiEndpointsFromSession(){sessionStorage.getItem("APIENDPOINTNEW")&&(this.serverApi.API_LIST.serverHostUrl=sessionStorage.getItem("APIENDPOINTNEW")||"",this.SERVER_HOST=sessionStorage.getItem("APIENDPOINTNEW")||""),sessionStorage.getItem("TENANTAPIURL")&&(this.serverApi.API_LIST.tenantApiUrl=sessionStorage.getItem("TENANTAPIURL")||"",this.TENANT_API_URL=sessionStorage.getItem("TENANTAPIURL")||"")}')
  const constructor = one(service.body.body.filter(node => node.type === 'MethodDefinition' && key(node.key) === 'constructor'), 'current actual selected service constructor'), dependency = constructor.value.params[2]
  need(dependency?.type === 'Identifier', 'current selected registry dependency differs')
  const sameDependency = expression => expression?.type === 'Identifier' && lexical.binding(expression) === lexical.binding(dependency)
  const registryMember = expression => expression?.type === 'MemberExpression' && lexical.member(expression) === 'API_LIST' && sameDependency(expression.object)
  const serviceWrites = nodes.filter(node => node.type === 'AssignmentExpression' && owner(node) === service && ['this.SERVER_HOST', 'this.API_ENDPOINTS', 'this.serverApi'].includes(member(node.left)))
  const initial = serviceWrites.filter(node => within(node, constructor.value.body))
  need(initial.length === 4, 'current selected service initial configuration has extra writers')
  for (const node of initial) {
    if (member(node.left) === 'this.serverApi') need(sameDependency(node.right), 'current selected registry instance differs')
    if (member(node.left) === 'this.API_ENDPOINTS') need(registryMember(node.right), 'current search/detail endpoint table is disconnected')
    if (member(node.left) === 'this.SERVER_HOST') need(node.right.type === 'Literal' && node.right.value === '' || node.right.type === 'MemberExpression' && lexical.member(node.right) === 'serverHostUrl' && registryMember(node.right.object), 'current service host initial dependency differs')
  }
  const allowedService = nodes.filter(node => node.type === 'AssignmentExpression' && owner(node) === service && (within(node, serviceSetter.value.body) || initial.includes(node)))
  protectInstance(lexical, service, new Set(['SERVER_HOST', 'API_ENDPOINTS', 'serverApi']), new Set(allowedService), owner)
  const defaults = one(nodes.filter(n => n.type === 'AssignmentExpression' && member(n.left) === 'this.searchJobsv1Params' && n.right.type === 'ObjectExpression'), 'native public search defaults')
  const searchDefaults = plain(defaults.right)
  need(isDeepStrictEqual(searchDefaults, { filterCri: { paginationStartNo: 0, selectedCall: 'sort', sortCriteria: { name: 'modifiedDate', isAscending: false }, anyOfTheseWords: '' }, domain: '', companyId: '' }), 'native default public filter differs')
  const setter = method('setCompanyIdUrlDomainFromSession')
  for (const [left, right] of [['this.companyId', 'sessionStorage.getItem'], ['this.domain', 'this.commonService.getDomain'], ['this.searchJobsv1Params.domain', 'this.domain']]) {
    const writes = nodes.filter(n => n.type === 'AssignmentExpression' && member(n.left) === left && within(n, setter.value.body))
    const n = one(writes, 'native account/default request assignment ' + left); reachable(n, setter.value.body)
    const value = n.right.type === 'LogicalExpression' ? n.right.left : n.right
    need(value.type === 'CallExpression' ? member(value.callee) === right && (left !== 'this.companyId' || value.arguments[0]?.value === 'COMPANYID') : member(value) === right, 'native default account consumer differs')
  }
  const defaultClass = owner(defaults), allowedDefaults = new Set([defaults])
  for (const node of nodes.filter(node => node.type === 'AssignmentExpression' && owner(node) === defaultClass && member(node.left)?.startsWith('this.searchJobsv1Params.'))) {
    const writer = ancestors(node).find(value => value.type === 'MethodDefinition'), path = member(node.left)
    if (writer === setter && path === 'this.searchJobsv1Params.domain') allowedDefaults.add(node)
    if (key(writer?.key) === 'setBaseFilterCriteria') {
      const expected = { 'this.searchJobsv1Params.filterCriteria.paginationStartNo': 0, 'this.searchJobsv1Params.filterCriteria.selectedCall': 'sort', 'this.searchJobsv1Params.filterCriteria.sortCriteria': { name: 'modifiedDate', isAscending: false } }
      need(Object.hasOwn(expected, path) && isDeepStrictEqual(plain(node.right), expected[path]), 'current base public filter semantics differ'); allowedDefaults.add(node)
    }
  }
  protectInstance(lexical, defaultClass, new Set(['searchJobsv1Params']), allowedDefaults, owner)
  const sourceMethod = method('getSourceFromURL'), sourceDefault = one(nodes.filter(n => n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && key(n.left.property) === 'source' && n.right.value === 'CareerSite' && within(n, sourceMethod)), 'actual native detail default source')
  reachable(sourceDefault, sourceMethod.value.body, true)
  const emissions = nodes.filter(n => n.type === 'CallExpression' && member(n.callee) === 'this.jobViewLoad.emit' && n.arguments[0]?.type === 'ObjectExpression' && n.arguments[0].properties.some(p => key(p.key) === 'closedJob'))
  need(emissions.length === 2, 'native successful/failed detail publication mapping ambiguous')
  let consumerClass
  for (const emission of emissions) {
    const branch = ancestors(emission).find(n => n.type === 'Property' && ['next', 'error'].includes(key(n.key)))
    need(branch && branch.value.type === 'ArrowFunctionExpression', 'native closed state is not connected to detail result')
    const subscription = ancestors(branch).find(n => n.type === 'CallExpression' && member(n.callee)?.endsWith('.subscribe') && n.callee.object.type === 'CallExpression' && member(n.callee.object.callee) === 'this.endpointService.getJobData')
    need(subscription, 'native closed mapping detached from same-role public detail')
    reachable(emission, branch.value.body)
    need(plain(property(emission.arguments[0], 'closedJob')) === (key(branch.key) === 'error'), 'native successful detail/closed mapping inverted')
    const writer = ancestors(emission).find(n => n.type === 'MethodDefinition')
    need(key(writer.key) === 'ngOnInit', 'native publication result outside current component init')
    consumerClass ??= owner(writer); need(consumerClass === owner(writer), 'native detail state belongs to different components')
  }
  registration(consumerClass)
  const roleView = method('onJobViewLoad'), roleClass = owner(roleView)
  need(isDeepStrictEqual(registration(roleClass).selectors, [['app-jobview']]), 'native public role view registration differs')
  meaning({ ...roleView, value: { ...roleView.value, body: { ...roleView.value.body, body: roleView.value.body.body.slice(0, 2) } } }, 'onJobViewLoad(t){if(t.closedJob)return void(this.isJobClosed=!0);this.isJobClosed=!1}')
  const closedWrites = nodes.filter(n => n.type === 'AssignmentExpression' && member(n.left) === 'this.isJobClosed' && within(n, roleClass))
  need(closedWrites.length === 3 && closedWrites.filter(n => plain(n.right) === true).length === 1, 'native role closed-state writes differ')
  const apply = one(roleClass.body.body.filter(n => n.type === 'MethodDefinition' && key(n.key) === 'onApplyClick'), 'same-role declared application trigger')
  meaning(apply, 'onApplyClick(){this.loadApplyForm=!0,this.loaderLoad=!0,this.isApplyFormLoaded&&this.scrollBtn()}')
  const route = one(nodes.filter(n => n.type === 'ObjectExpression' && n.properties.some(p => key(p.key) === 'path' && p.value.value === 'jobview/:jobUrl')), 'actual public job-view route')
  const outer = ancestors(roleClass).find(n => n.type === 'VariableDeclarator')
  need(outer && property(route, 'component').name === outer.id.name, 'public route is not wired to current role component')
  const result = { companyId: '15124', encodedCompanyId: env.COMPANYID, domain: env.DOMAIN, apiOrigin: env.APIENDPOINTNEW, listURL: env.APIENDPOINTNEW + 'jobs/search', detailURL: env.APIENDPOINTNEW + 'jobs-service/v1/jobs/careersite', configurationURL: env.APIENDPOINTNEW + 'data-service/v2/company/15124/careersite-configurations', publicRoleBaseURL: 'https://rakuten.openings.co/rakuten/jobview/', defaultSource: 'CareerSite', searchDefaults, originalEnvironment: env, publicationProof: { selectedCurrentPublicAccount: true, successfulSameRoleDetailClosedJob: false, failedDetailClosedJob: true, nativeProgramsExecuted: false }, originalClientSha256: digest }
  if (cache.size >= 4) cache.delete(cache.keys().next().value)
  cache.set(digest, result)
  return structuredClone(result)
}
