import { parseBoundedProgram } from '../../scraper-support/utils/remoteScriptData.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { tokenizer } from 'acorn'
import { ACCOUNT, CAREERS_URL, EMBED_URL, TITLES_URL, DETAILS_URL, COMPANY, need } from './nativeContract.js'

const literal = (node, value) => node?.type === 'Literal' && node.value === value
const ident = (node, name) => node?.type === 'Identifier' && node.name === name
const member = (node, object, property) => node?.type === 'MemberExpression' && !node.computed && !node.optional && ident(node.object, object) && ident(node.property, property)
const fn = node => ['ArrowFunctionExpression', 'FunctionExpression'].includes(node?.type) && !node.async && !node.generator
const rawWithin = (node, predicate) => [...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => rawWithin(child, predicate))]
const one = (nodes, label) => { need(nodes.length === 1, 'missing or ambiguous ' + label); return nodes[0] }
const visit = (node, visitor) => {
  if (!node || typeof node !== 'object') return
  if (node.type) visitor(node)
  for (const [key, value] of Object.entries(node)) if (!['start', 'end', 'raw', 'type'].includes(key)) { if (Array.isArray(value)) value.forEach(child => visit(child, visitor)); else if (value?.type) visit(value, visitor) }
}
const widgetNames = new Set(['whr', 'whr_embed'])
const namespaceNames = new Set(['window', 'globalThis', 'self', 'this'])
const mutationNames = new Set(['assign', 'defineProperty', 'defineProperties', 'set'])
const namespace = node => node?.type === 'ThisExpression' || node?.type === 'Identifier' && namespaceNames.has(node.name)
const memberName = node => node?.type === 'MemberExpression' ? node.computed ? node.property.type === 'Literal' ? node.property.value : null : node.property.name : null
const unresolvedNamespace = node => node.type === 'MemberExpression' && namespace(node.object) && node.computed && !(node.property.type === 'Literal' && ['string', 'number'].includes(typeof node.property.value)) || node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && ['Object', 'Reflect'].some(name => ident(node.callee.object, name)) && mutationNames.has(memberName(node.callee)) && namespace(node.arguments[0])
const widgetReference = node => node.type === 'Identifier' && widgetNames.has(node.name) || node.type === 'Literal' && widgetNames.has(node.value) || node.type === 'TemplateElement' && widgetNames.has(node.value.cooked) || unresolvedNamespace(node)
const relevantTokens = source => {
  // Acorn decodes escaped identifiers/string tokens; raw spellings have no authority.
  let count = 0, depth = 0, relevant = false, hasNamespace = false, hasMutation = false, namespaceTail = false
  for (const token of tokenizer(source, { ecmaVersion: 'latest' })) {
    need(++count <= 100000, 'native inline script token budget exceeded')
    if (['{', '[', '(', '${'].includes(token.type.label)) need(++depth <= 80, 'native inline script nesting budget exceeded')
    if (['}', ']', ')'].includes(token.type.label)) depth--
    if (widgetNames.has(token.value)) relevant = true
    if (namespaceNames.has(token.value)) hasNamespace = true
    if (mutationNames.has(token.value)) hasMutation = true
    if (namespaceTail && token.type.label === '[') relevant = true
    // Parentheses do not change a direct namespace object; the AST confirms it.
    namespaceTail = namespaceNames.has(token.value) || namespaceTail && token.type.label === ')'
  }
  return relevant || hasNamespace && hasMutation
}
const scriptKind = node => {
  const type = (node.attrs.type || '').trim().toLowerCase()
  if (['', 'text/javascript', 'application/javascript'].includes(type)) return 'classic'
  if (type === 'module') return 'module'
  if (['application/json', 'application/ld+json', 'speculationrules', 'text/plain'].includes(type)) return 'data'
  need(false, 'unsupported native script execution type')
}
const executableScripts = root => {
  const scripts = [], containers = new Set(['root', 'html', 'head', 'body', 'div', 'p', 'span', 'section', 'main', 'article', 'header', 'footer', 'aside'])
  const walk = (node, context = true) => {
    if (['template', 'noscript'].includes(node.tag)) return
    if (node.tag === 'script') {
      if (scriptKind(node) === 'data') return
      need(context, 'unsupported native script execution context')
      scripts.push(node); return
    }
    const qualified = context && containers.has(node.tag)
    for (const child of node.children) if (typeof child !== 'string') walk(child, qualified)
  }
  // CSS, hidden, inert and ARIA attributes do not disable script execution.
  walk(root); return scripts
}
const readyCall = program => {
  const call = program.body[0]?.expression, receiver = call?.callee?.object
  return program.body.length === 1 && program.body[0].type === 'ExpressionStatement' && call?.type === 'CallExpression' && !call.optional && call.callee.type === 'MemberExpression' && !call.callee.computed && ident(call.callee.property, 'ready') && receiver?.type === 'CallExpression' && !receiver.optional && ident(receiver.callee, 'whr') && receiver.arguments.length === 1 && ident(receiver.arguments[0], 'document') ? call : null
}

export const inspectOfficialPage = html => {
  need(typeof html === 'string' && Buffer.byteLength(html) <= 2000000, 'missing or oversized official HTML')
  const raw = readNativeDocument(html), visible = readVisibleNativeDocument(html, { strict: true }), root = one(raw.nodes(node => node.tag === 'root'), 'official document')
  need(one(raw.nodes(node => node.tag === 'title'), 'official title').raw === 'Career - Flatgigs', 'official publisher title contradiction')
  const canonical = one(raw.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'official canonical')
  need(canonical.attrs.href === CAREERS_URL, 'official canonical contradiction')
  for (const [property, value] of [['og:title', 'Career - Flatgigs'], ['og:url', CAREERS_URL], ['og:site_name', COMPANY]]) need(one(raw.nodes(node => node.tag === 'meta' && node.attrs.property === property), 'official ' + property).attrs.content === value, 'official publisher metadata contradiction')
  need(visible.nodes(node => node.tag === 'h2' && visible.text(node) === 'Career').length === 1, 'visible careers heading missing')
  need(rawWithin(root, node => node.attrs.id === 'whr_embed_hook').length === 1, 'duplicate or missing literal widget hook')
  const hook = one(visible.nodes(node => node.attrs.id === 'whr_embed_hook'), 'visible widget hook')
  need(hook.tag === 'div' && !Object.hasOwn(hook.attrs, 'disabled') && hook.attrs['aria-disabled'] !== 'true', 'disabled or unsupported widget hook')
  const scripts = executableScripts(root), external = one(scripts.filter(node => node.attrs.src === EMBED_URL), 'advertised native embed script')
  need(scriptKind(external) === 'classic' && !['async', 'defer', 'nomodule'].some(name => Object.hasOwn(external.attrs, name)), 'native embed script is not synchronous classic JavaScript')
  const candidates = []
  for (const script of scripts.filter(node => !node.attrs.src && relevantTokens(node.raw || ''))) {
    const program = parseBoundedProgram(script.raw || ''), call = readyCall(program)
    if (call) {
      need(scriptKind(script) === 'classic' && !['async', 'defer', 'nomodule'].some(name => Object.hasOwn(script.attrs, name)), 'native initializer is not synchronous classic JavaScript')
      candidates.push({ script, call })
    }
    else {
      let relevant = false
      visit(program, node => { if (widgetReference(node)) relevant = true })
      need(!relevant, 'unsupported or conflicting native widget initializer/global binding')
    }
  }
  const { script, call } = one(candidates, 'active literal ready initializer'), callback = call.arguments[0]
  need(scripts.indexOf(external) < scripts.indexOf(script), 'native initializer precedes its synchronous client')
  need(call.arguments.length === 1 && fn(callback) && callback.params.length === 0 && callback.body.type === 'BlockStatement' && callback.body.body.length === 1, 'unsupported ready callback control flow or shadowing')
  const statement = callback.body.body[0], embed = statement.expression
  need(statement.type === 'ExpressionStatement' && embed?.type === 'CallExpression' && !embed.optional && ident(embed.callee, 'whr_embed') && embed.arguments.length === 2 && literal(embed.arguments[0], ACCOUNT), 'native literal account contradiction')
  const options = embed.arguments[1], values = Object.create(null)
  need(options?.type === 'ObjectExpression', 'nonliteral native widget options')
  for (const property of options.properties) {
    need(property.type === 'Property' && !property.computed && property.kind === 'init' && !property.method && !property.shorthand && ['Literal', 'Identifier'].includes(property.key.type) && property.value.type === 'Literal' && typeof property.value.value === 'string', 'unsupported native widget option')
    const key = property.key.name ?? property.key.value
    need(!Object.hasOwn(values, key), 'duplicate native widget option'); values[key] = property.value.value
  }
  need(JSON.stringify(Object.keys(values).sort()) === JSON.stringify(['base', 'detail', 'grouping', 'zoom']) && values.base === 'jobs' && values.detail === 'titles' && values.zoom === 'country' && values.grouping === 'none', 'native widget option contract changed')
  return { account: ACCOUNT, canonical: CAREERS_URL, publisher: COMPANY, publisherQualified: true, reciprocalDomainQualified: false, hostId: 'whr_embed_hook', scriptURL: EMBED_URL, options: { ...values }, runtimeExecuted: false }
}

// A small, finite webpack bootstrap grammar admits this native client family.
// It is parsed as syntax; no downloaded code or Function constructor is run.
const shape = node => JSON.stringify(node, (key, value) => ['start', 'end', 'raw'].includes(key) ? undefined : value)
const loaderGrammar = parseBoundedProgram('function n(r){var i=t[r];if(void 0!==i)return i.exports;var o=t[r]={id:r,loaded:!1,exports:{}};return e[r](o,o.exports,n),o.loaded=!0,o.exports}').body[0]
const bootstrapGrammar = parseBoundedProgram('n.c=t,n.amdO={},n.n=e=>{var t=e&&e.__esModule?()=>e.default:()=>e;return n.d(t,{a:t}),t},n.d=(e,t)=>{for(var r in t)n.o(t,r)&&!n.o(e,r)&&Object.defineProperty(e,r,{enumerable:!0,get:t[r]})},n.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(e){if("object"==typeof window)return window}}(),n.hmd=e=>((e=Object.create(e)).children||(e.children=[]),Object.defineProperty(e,"exports",{enumerable:!0,set:()=>{throw new Error("ES Modules may not assign module.exports or exports.*, Use ESM export syntax, instead: "+e.id)}}),e),n.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),n(n.s=0)').body[0].expression
const flatten = node => node?.type === 'BinaryExpression' && node.operator === '+' ? [...flatten(node.left), ...flatten(node.right)] : [node]
const optionFallback = (node, property, value) => node?.type === 'LogicalExpression' && node.operator === '||' && member(node.left, 't', property) && literal(node.right, value)
const stringTemplate = node => node?.type === 'Literal' && typeof node.value === 'string' || ident(node, 'n') || node?.type === 'BinaryExpression' && node.operator === '+' && stringTemplate(node.left) && stringTemplate(node.right)
const tailExpression = node => node?.type === 'SequenceExpression' ? tailExpression(node.expressions.at(-1)) : node
const selectCase = (node, property, value) => {
  need(node?.type === 'SwitchStatement' && member(node.discriminant, 't', property), 'unsupported native route switch')
  let start = node.cases.findIndex(branch => literal(branch.test, value))
  need(start >= 0, 'native route option is not supported')
  const statements = []
  for (; start < node.cases.length; start++) for (const statement of node.cases[start].consequent) { statements.push(statement); if (statement.type === 'BreakStatement') return statements }
  need(false, 'native route switch does not terminate')
}

export const inspectNativeClient = (source, official) => {
  need(official?.account === ACCOUNT && official.hostId === 'whr_embed_hook', 'missing qualified official widget binding')
  const ast = parseBoundedProgram(source), call = ast.body[0]?.expression, owner = call?.callee
  need(ast.body.length === 1 && ast.body[0].type === 'ExpressionStatement' && call?.type === 'CallExpression' && call.arguments.length === 0 && fn(owner) && owner.params.length === 0 && owner.body.type === 'BlockStatement' && owner.body.body.length === 3, 'unsupported or unreachable native client owner')
  const [declaration, loader, tail] = owner.body.body
  need(declaration.type === 'VariableDeclaration' && declaration.kind === 'var' && declaration.declarations.length === 2 && ident(declaration.declarations[0].id, 'e') && declaration.declarations[0].init?.type === 'ObjectExpression' && ident(declaration.declarations[1].id, 't') && declaration.declarations[1].init?.type === 'ObjectExpression' && declaration.declarations[1].init.properties.length === 0, 'unsupported native module registry/cache')
  need(shape(loader) === shape(loaderGrammar), 'unsupported native module loader control flow')
  need(tail.type === 'ExpressionStatement' && tail.expression.type === 'SequenceExpression', 'unsupported native client startup')
  const entry = tail.expression.expressions.at(-1)
  need(entry?.type === 'CallExpression' && ident(entry.callee, 'n') && entry.arguments.length === 1 && entry.arguments[0]?.type === 'AssignmentExpression' && entry.arguments[0].operator === '=' && member(entry.arguments[0].left, 'n', 's') && entry.arguments[0].right.type === 'Literal' && Number.isInteger(entry.arguments[0].right.value), 'unsupported native client entry')
  const entryId = entry.arguments[0].right.value, templateTail = structuredClone(tail.expression)
  templateTail.expressions.at(-1).arguments[0].right.value = 0
  need(shape(templateTail) === shape(bootstrapGrammar), 'unsupported native bootstrap prefix/suffix or global shadowing')
  const modules = new Map()
  for (const property of declaration.declarations[0].init.properties) {
    need(property.type === 'Property' && property.kind === 'init' && !property.computed && !property.method && property.key.type === 'Literal' && Number.isInteger(property.key.value) && fn(property.value) && property.value.body.type === 'BlockStatement' && !modules.has(property.key.value), 'unsupported or duplicate native module')
    modules.set(property.key.value, property.value)
  }
  const startup = modules.get(entryId)
  need(startup && startup.params.map(param => param.name).join(',') === 'e,t,n' && startup.body.body.length === 2 && literal(startup.body.body[0].expression, 'use strict') && startup.body.body[1].type === 'ExpressionStatement', 'unsupported native startup module control flow')
  const imports = startup.body.body[1].expression.type === 'SequenceExpression' ? startup.body.body[1].expression.expressions : [startup.body.body[1].expression]
  need(imports.length === 4 && imports.every(node => node.type === 'CallExpression' && ident(node.callee, 'n') && node.arguments.length === 1 && node.arguments[0].type === 'Literal' && modules.has(node.arguments[0].value)) && new Set(imports.map(node => node.arguments[0].value)).size === 4, 'unsupported native startup dependency')
  const namespaceModules = { handlebars: [], whr: [], jsonp: [] }
  for (const [id, module] of modules) {
    const tail = tailExpression(module.body.body.at(-1)?.expression)
    if (tail?.type === 'AssignmentExpression' && tail.operator === '=' && member(tail.left, 'window', 'Handlebars')) namespaceModules.handlebars.push(id)
    if (tail?.type === 'AssignmentExpression' && tail.operator === '=' && ident(tail.left, 'whr') && tail.right?.type === 'CallExpression' && member(tail.right.callee, 'jQuery', 'noConflict') && tail.right.arguments.length === 1 && (literal(tail.right.arguments[0], true) || tail.right.arguments[0]?.type === 'UnaryExpression' && tail.right.arguments[0].operator === '!' && literal(tail.right.arguments[0].argument, 0))) namespaceModules.whr.push(id)
    const shell = module.body.body[0]?.expression, invoked = shell?.type === 'UnaryExpression' && shell.operator === '!' ? shell.argument : null
    if (module.body.body.length === 1 && invoked?.type === 'CallExpression' && fn(invoked.callee) && invoked.arguments.length === 1 && ident(invoked.arguments[0], 'jQuery')) {
      const exported = tailExpression(invoked.callee.body.body.at(-1)?.expression)
      if (exported?.type === 'AssignmentExpression' && exported.operator === '=' && member(exported.left, 'whr', 'jsonp')) namespaceModules.jsonp.push(id)
    }
  }
  const namespaceIds = ['handlebars', 'whr', 'jsonp'].map(name => one(namespaceModules[name], 'native ' + name + ' startup namespace'))
  need(namespaceIds.every((id, index) => imports[index].arguments[0].value === id), 'native namespace initialization order contradiction')
  const bindings = []
  for (const [id, module] of modules) visit(module.body, node => { if (node.type === 'AssignmentExpression' && node.operator === '=' && (member(node.left, 'window', 'whr_embed') || node.left.type === 'MemberExpression' && ident(node.left.object, 'window') && literal(node.left.property, 'whr_embed'))) bindings.push({ id, node }) })
  const binding = one(bindings, 'native embed function binding'), module = modules.get(binding.id)
  need(imports.at(-1).arguments[0].value === binding.id && module.params.length === 0 && module.body.body.length === 1 && module.body.body[0].expression === binding.node && member(binding.node.left, 'window', 'whr_embed'), 'native embed installation is not the final finite startup action')
  const embed = binding.node.right, body = embed.body?.body
  need(embed.type === 'FunctionExpression' && embed.params.map(param => param.name).join(',') === 'e,t' && body?.length === 8, 'unsupported native protocol owner or immediate work')
  const localNames = new Set(['e', 't'])
  for (const statement of body) {
    const names = statement.type === 'VariableDeclaration' ? statement.declarations.map(node => node.id.type === 'Identifier' ? node.id.name : null) : statement.type === 'FunctionDeclaration' ? [statement.id?.name] : []
    for (const name of names) { need(name && !localNames.has(name) && !['whr', 'whr_embed', 'Handlebars', 'Object', 'window', 'document'].includes(name), 'native protocol binding is redeclared or shadowed'); localNames.add(name) }
  }
  need(body[0].type === 'VariableDeclaration' && body[0].declarations.map(node => node.id.name).join(',') === 'n,r,i,o,s', 'unsupported native domain/target declarations')
  need(optionFallback(body[0].declarations[0].init, 'domain', 'https://apply.workable.com') && optionFallback(body[0].declarations[4].init, 'target', '#whr_embed_hook') && body[0].declarations.slice(1, 4).every(node => node.init.type === 'Literal' && typeof node.init.value === 'string'), 'native domain or target contradiction')
  const loading = body[1].expression
  need(body[1].type === 'ExpressionStatement' && loading?.type === 'CallExpression' && loading.callee?.type === 'MemberExpression' && !loading.callee.computed && ident(loading.callee.property, 'append') && loading.callee.object.type === 'CallExpression' && ident(loading.callee.object.callee, 'whr') && loading.callee.object.arguments.length === 1 && ident(loading.callee.object.arguments[0], 's') && loading.arguments.length === 1 && loading.arguments[0].type === 'Literal', 'unsupported native initial target operation')
  need(body[2].type === 'VariableDeclaration' && body[2].declarations.every(node => node.id.type === 'Identifier' && stringTemplate(node.init)), 'unsupported native template initialization')
  const helpers = body[3].expression?.expressions
  need(body[3].type === 'ExpressionStatement' && helpers?.length === 2 && helpers.every((node, index) => node.type === 'CallExpression' && member(node.callee, 'Handlebars', 'registerHelper') && node.arguments.length === 2 && literal(node.arguments[0], ['creation_date', 'each_with_key'][index]) && fn(node.arguments[1])), 'unsupported native helper registration')
  need(body[4].type === 'VariableDeclaration' && body[4].declarations.length === 1 && ident(body[4].declarations[0].id, 'h') && body[4].declarations[0].init.type === 'CallExpression' && member(body[4].declarations[0].init.callee, 'Object', 'freeze') && body[5].type === 'FunctionDeclaration' && ident(body[5].id, 'f'), 'unsupported native grouping declaration')
  const frozen = body[4].declarations[0].init.arguments
  need(frozen.length === 1 && frozen[0].type === 'ObjectExpression' && frozen[0].properties.length === 2 && frozen[0].properties.every((property, index) => property.type === 'Property' && !property.computed && property.kind === 'init' && !property.method && ident(property.key, ['DEPARTMENT', 'LOCATION'][index]) && literal(property.value, ['department', 'location'][index])), 'unsupported evaluated grouping initializer')
  need(body[6].type === 'VariableDeclaration' && body[6].declarations.length === 2 && ident(body[6].declarations[0].id, 'd') && fn(body[6].declarations[0].init) && ident(body[6].declarations[1].id, 'm'), 'unsupported native detail capability declaration')
  const suffix = body[6].declarations[1].init, detailModes = []
  const predicate = node => { if (node.type === 'LogicalExpression' && node.operator === '||') { predicate(node.left); predicate(node.right); return }; need(node.type === 'BinaryExpression' && node.operator === '==' && node.left.type === 'Literal' && typeof node.left.value === 'string' && member(node.right, 't', 'detail'), 'unsupported native detail predicate'); detailModes.push(node.left.value) }
  need(suffix?.type === 'ConditionalExpression' && literal(suffix.consequent, '&details=true') && literal(suffix.alternate, ''), 'native detail suffix contradiction'); predicate(suffix.test)
  need(detailModes.join(',') === 'descriptions,description,all,true', 'unsupported native detail modes')
  const route = selectCase(body[7], 'base', official.options.base)
  need(route.length === 2 && route[1].type === 'BreakStatement', 'unsupported current base route work')
  const selected = selectCase(route[0], 'grouping', official.options.grouping)
  need(selected.length === 2 && selected[0].type === 'ExpressionStatement' && selected[1].type === 'BreakStatement', 'unsupported current grouping route work')
  const request = selected[0].expression
  need(request?.type === 'CallExpression' && member(request.callee, 'whr', 'jsonp') && request.arguments.length === 1 && request.arguments[0].type === 'ObjectExpression', 'native current request is not the observed JSONP call')
  const options = request.arguments[0].properties
  need(options.every(property => property.type === 'Property' && !property.computed && property.kind === 'init' && !property.method) && options.map(property => property.key.name ?? property.key.value).sort().join(',') === 'cache,callback,error,success,url', 'unsupported native request options')
  const option = name => options.find(property => (property.key.name ?? property.key.value) === name)?.value
  const parts = flatten(option('url'))
  need(parts.length === 5 && ident(parts[0], 'n') && literal(parts[1], '/api/v1/widget/accounts/') && ident(parts[2], 'e') && literal(parts[3], '?origin=embed&callback=whrcallback') && ident(parts[4], 'm') && literal(option('callback'), 'whrcallback'), 'native URL/callback template contradiction')
  need(fn(option('success')) && fn(option('error')), 'unsupported native response callback contract')
  const cache = option('cache')
  need(literal(cache, true) || cache?.type === 'UnaryExpression' && cache.operator === '!' && literal(cache.argument, 0), 'unsupported evaluated native cache option')
  return { account: ACCOUNT, titlesURL: TITLES_URL, detailsURL: DETAILS_URL, callback: 'whrcallback', hostSelector: '#whr_embed_hook', detailModes, protocolQualified: true, runtimeExecuted: false, vendorRuntimeExecutionObserved: false, fullDescriptionRendered: false, reciprocalDomainQualified: false }
}
