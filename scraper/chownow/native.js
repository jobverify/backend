import { parse } from 'acorn'
import { createHash } from 'node:crypto'
import { createHTMLTransport } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { readNativeAttributeDocument, normalizeNativeAttributeBoundaries } from '../../scraper-support/utils/nativeHtmlAttributes.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'
import { OFFICIAL_ATS_DISCOVERY } from '../../scraper-support/utils/officialAtsRecovery.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

export const CAREERS = 'https://get.chownow.com/careers/'
const ORIGIN = new URL(CAREERS).origin
const requireNative = (condition, reason) => { if (!condition) throw Error('ChowNow: ' + reason) }
const one = (values, reason) => { requireNative(values.length === 1, reason); return values[0] }
const name = node => node?.type === 'Identifier' ? node.name : null
const literal = node => node?.type === 'Literal' ? node.value : undefined
const expressionCalls = body => body.filter(node => node.type === 'ExpressionStatement' && node.expression?.type === 'CallExpression').map(node => node.expression)
const functions = (body, id) => body.filter(node => node.type === 'FunctionDeclaration' && node.id?.name === id)
const variables = (body, id) => body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations).filter(node => node.id?.name === id)
const syncFunction = node => ['FunctionDeclaration', 'FunctionExpression'].includes(node?.type) && !node.generator && !node.async
const member = (node, object, property) => node?.type === 'MemberExpression' && !node.computed
  && name(node.object) === object && name(node.property) === property
const selectorMethod = (call, alias, selector, method) => call?.type === 'CallExpression'
  && call.callee?.type === 'MemberExpression' && !call.callee.computed && name(call.callee.property) === method
  && call.callee.object?.type === 'CallExpression' && name(call.callee.object.callee) === alias
  && call.callee.object.arguments.length === 1 && literal(call.callee.object.arguments[0]) === selector
const protectNativeBindings = (tree, declarations) => {
  const contains = node => node && typeof node === 'object' && (declarations.has(name(node))
    || Object.values(node).some(value => typeof value === 'object' && contains(value)))
  const visit = node => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'VariableDeclarator' && declarations.get(name(node.id)) !== node) requireNative(!contains(node.id), 'native binding is shadowed')
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      requireNative((declarations.get(name(node.id)) === node || !contains(node.id))
        && !node.params.some(parameter => declarations.get(name(parameter)) !== parameter && contains(parameter)), 'native function binding changed')
    }
    if (['AssignmentExpression', 'UpdateExpression'].includes(node.type)) requireNative(!contains(node.left || node.argument), 'native binding is reassigned')
    Object.values(node).forEach(visit)
  }
  visit(tree)
}
const verifyPathSelection = init => {
  const value = id => one(variables(init.body.body, id), 'native initializer binding changed: ' + id).init
  const selectors = { $jobsLocation: '.jobs-sort .jobs-locations', $jobsTeamList: '.jobs-postings-wrap .jobs-teams-list',
    $jobsTeam: '.jobs-sort .jobs-teams', $jobsSort: '#jobs-container .jobs-sort', $jobsListContainer: '#jobs-container .jobs-list',
    $noJobResult: '#jobs-container .jobs-list .no-job-result', $jobTotal: '.total-jobs' }
  const expected = new Set(['pageUrl', 'pathArray', 'lastSegment', 'leverTeam', 'leverParameter', 'trackingPrefix', 'fetchOptions', ...Object.keys(selectors)])
  const declared = init.body.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
  requireNative(declared.length === expected.size && new Set(declared.map(node => name(node.id))).size === expected.size
    && declared.every(node => expected.has(name(node.id))), 'unsupported native initializer declarations')
  for (const [id, selector] of Object.entries(selectors)) {
    const call = value(id)
    requireNative(call?.type === 'CallExpression' && name(call.callee) === '$' && call.arguments.length === 1
      && literal(call.arguments[0]) === selector, 'unsupported native selector initializer')
  }
  const options = value('fetchOptions')
  requireNative(options?.type === 'ObjectExpression' && options.properties.length === 1 && options.properties[0].type === 'Property'
    && !options.properties[0].computed && options.properties[0].kind === 'init' && name(options.properties[0].key) === 'page'
    && literal(options.properties[0].value) === 1, 'native fetch options initialization changed')
  const page = value('pageUrl'), parts = value('pathArray'), slug = value('lastSegment'), team = value('leverTeam')
  requireNative(page?.type === 'MemberExpression' && !page.computed && member(page.object, 'window', 'location') && name(page.property) === 'href'
    && parts?.type === 'CallExpression' && member(parts.callee, 'pageUrl', 'split') && parts.arguments.length === 1
    && literal(parts.arguments[0]) === '/' && slug?.type === 'MemberExpression' && slug.computed
    && name(slug.object) === 'pathArray' && slug.property?.type === 'BinaryExpression' && slug.property.operator === '-'
    && member(slug.property.left, 'pathArray', 'length') && literal(slug.property.right) === 2
    && team?.type === 'CallExpression' && name(team.callee) === 'getLeverTeam' && team.arguments.length === 1
    && name(team.arguments[0]) === 'lastSegment' && literal(value('leverParameter')) === '' && literal(value('trackingPrefix')) === '?lever-',
  'native path selection or initializer side effects changed')
  const helper = one(functions(init.body.body, 'getLeverTeam'), 'native path helper changed')
  const map = helper.body.body[0]?.declarations?.[0], result = helper.body.body[1]?.argument
  requireNative(syncFunction(helper) && helper.params.length === 1 && name(helper.params[0]) === 'pageSlug'
    && helper.body.body.length === 2 && helper.body.body[0].type === 'VariableDeclaration'
    && helper.body.body[0].declarations.length === 1 && name(map?.id) === 'pageTeamMap' && map.init?.type === 'ObjectExpression'
    && map.init.properties.every(property => property.type === 'Property' && !property.computed && property.kind === 'init'
      && typeof (name(property.key) || literal(property.key)) === 'string'
      && !['hasOwnProperty', '__proto__'].includes(name(property.key) || literal(property.key)) && typeof literal(property.value) === 'string')
    && helper.body.body[1].type === 'ReturnStatement' && result?.type === 'ConditionalExpression'
    && result.test?.type === 'CallExpression' && member(result.test.callee, 'pageTeamMap', 'hasOwnProperty')
    && result.test.arguments.length === 1 && name(result.test.arguments[0]) === 'pageSlug'
    && result.consequent?.type === 'MemberExpression' && result.consequent.computed && name(result.consequent.object) === 'pageTeamMap'
    && name(result.consequent.property) === 'pageSlug' && literal(result.alternate) === '', 'native path helper execution changed')
}
const htmlSink = (statement, accepts) => statement?.type === 'ExpressionStatement'
  && statement.expression?.type === 'CallExpression' && member(statement.expression.callee, '$jobsListContainer', 'html')
  && statement.expression.arguments.length === 1 && accepts(statement.expression.arguments[0])
const optionAppend = (statement, property) => {
  const test = statement?.test, expressions = statement?.consequent?.body
  const assignment = expressions?.[0]?.expression
  return statement?.type === 'IfStatement' && statement.alternate == null && test?.type === 'LogicalExpression'
    && test.operator === '&&' && member(test.left, 'options', property) && test.right?.type === 'BinaryExpression'
    && test.right.operator === '!==' && member(test.right.left, 'options', property) && literal(test.right.right) === ''
    && expressions?.length === 1 && expressions[0].type === 'ExpressionStatement' && assignment?.type === 'AssignmentExpression'
    && assignment.operator === '+=' && name(assignment.left) === 'leverUrl' && assignment.right?.type === 'BinaryExpression'
    && assignment.right.operator === '+' && literal(assignment.right.left) === '&' + property + '='
    && member(assignment.right.right, 'options', property)
}
const trackingBranch = statement => {
  const test = statement?.test, block = statement?.consequent?.body
  const variable = block?.[0]?.declarations?.[0], assignment = block?.[1]?.expression
  return statement?.type === 'IfStatement' && statement.alternate == null && test?.type === 'BinaryExpression'
    && test.operator === '>=' && literal(test.right) === 0 && test.left?.type === 'CallExpression'
    && member(test.left.callee, 'pageUrl', 'indexOf') && test.left.arguments.length === 1
    && name(test.left.arguments[0]) === 'trackingPrefix' && block?.length === 2
    && block[0].type === 'VariableDeclaration' && block[0].declarations.length === 1 && name(variable.id) === 'pageUrlSplit'
    && variable.init?.type === 'CallExpression' && member(variable.init.callee, 'pageUrl', 'split')
    && variable.init.arguments.length === 1 && name(variable.init.arguments[0]) === 'trackingPrefix'
    && block[1].type === 'ExpressionStatement' && assignment?.type === 'AssignmentExpression'
    && assignment.operator === '=' && name(assignment.left) === 'leverParameter' && assignment.right?.type === 'BinaryExpression'
    && assignment.right.operator === '+' && literal(assignment.right.left) === '?lever-'
    && assignment.right.right?.type === 'MemberExpression' && assignment.right.right.computed
    && name(assignment.right.right.object) === 'pageUrlSplit' && literal(assignment.right.right.property) === 1
}
const verifyRenderer = renderer => {
  requireNative(syncFunction(renderer) && renderer.params.length === 1 && name(renderer.params[0]) === '_data'
    && renderer.body.body.length === 1, 'native renderer execution changed')
  const branch = renderer.body.body[0], contents = branch.alternate?.body
  requireNative(branch.type === 'IfStatement' && branch.test?.type === 'UnaryExpression' && branch.test.operator === '!'
    && member(branch.test.argument, '_data', 'length') && branch.consequent?.body?.length === 1
    && htmlSink(branch.consequent.body[0], value => typeof literal(value) === 'string')
    && contents?.length === 3, 'native renderer branches or visible sink changed')
  const list = one(variables(contents, 'jobsList'), 'native rendered row list changed')
  requireNative(contents[0].declarations?.length === 1 && list.init?.type === 'ArrayExpression' && list.init.elements.length === 0,
    'native rendered row list initialization changed')
  const loop = contents[1], counter = loop.init?.declarations?.[0]
  requireNative(loop.type === 'ForStatement' && loop.init?.declarations?.length === 1 && name(counter?.id) === 'i'
    && literal(counter.init) === 0 && loop.test?.type === 'BinaryExpression' && loop.test.operator === '<'
    && name(loop.test.left) === 'i' && member(loop.test.right, '_data', 'length') && loop.update?.type === 'UpdateExpression'
    && loop.update.operator === '++' && name(loop.update.argument) === 'i' && loop.body?.type === 'BlockStatement',
  'native rendered row iteration changed')
  const row = one(variables(loop.body.body, 'posting'), 'native renderer row source changed').init
  const title = one(variables(loop.body.body, 'title'), 'native renderer title source changed').init
  const link = one(variables(loop.body.body, 'link'), 'native renderer link source changed').init
  const markup = one(variables(loop.body.body, 'jobPosting'), 'native rendered row markup changed').init
  const permitted = ['posting', 'title', 'location', 'locationCleanString', 'commitment', 'commitmentCleanString', 'team', 'teamCleanString', 'link', 'jobPosting']
  const declarations = loop.body.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
  requireNative(declarations.length === permitted.length && declarations.every((node, index) => name(node.id) === permitted[index]),
    'native rendered row declarations changed')
  for (const field of ['location', 'commitment', 'team']) {
    const raw = one(variables(loop.body.body, field), 'native row category changed').init
    const clean = one(variables(loop.body.body, field + 'CleanString'), 'native row category normalization changed').init
    requireNative(raw?.type === 'CallExpression' && name(raw.callee) === 'nullCheck' && raw.arguments.length === 1
      && raw.arguments[0]?.type === 'MemberExpression' && !raw.arguments[0].computed
      && member(raw.arguments[0].object, 'posting', 'categories') && name(raw.arguments[0].property) === field
      && clean?.type === 'CallExpression' && name(clean.callee) === 'cleanString' && clean.arguments.length === 1
      && name(clean.arguments[0]) === field, 'unsupported native row initializer side effects')
  }
  requireNative(row?.type === 'MemberExpression' && row.computed && name(row.object) === '_data' && name(row.property) === 'i'
    && member(title, 'posting', 'text') && link?.type === 'BinaryExpression' && link.operator === '+'
    && member(link.left, 'posting', 'hostedUrl') && name(link.right) === 'leverParameter'
    && markup?.type === 'TemplateLiteral' && markup.expressions.some(value => name(value) === 'title')
    && markup.expressions.some(value => name(value) === 'link') && markup.expressions.every(value =>
      ['title', 'location', 'commitment', 'team', 'locationCleanString', 'commitmentCleanString', 'teamCleanString', 'link'].includes(name(value))),
  'native renderer data is detached')
  const pushes = expressionCalls(loop.body.body)
  requireNative(pushes.length === 1 && member(pushes[0].callee, 'jobsList', 'push') && pushes[0].arguments.length === 1
    && name(pushes[0].arguments[0]) === 'jobPosting' && loop.body.body.every(node => node.type === 'VariableDeclaration'
      || node.type === 'ExpressionStatement' && node.expression === pushes[0]), 'native renderer row append changed')
  requireNative(htmlSink(contents[2], value => value?.type === 'CallExpression' && member(value.callee, 'jobsList', 'join')
    && value.arguments.length === 1 && literal(value.arguments[0]) === ''), 'native rendered data sink detached')
}
const hasBase = node => node.tag !== 'template' && (node.tag === 'base'
  || node.children.some(child => typeof child !== 'string' && hasBase(child)))

export function chownowClientURL(html) {
  const normalized = normalizeNativeAttributeBoundaries(html)
  requireNative(!hasBase(document(normalized).root), 'unreviewed corporate document base')
  const visible = readVisibleNativeDocument(normalized)
  requireNative(visible.nodes(node => node.attrs.id === 'jobs-container').length === 1
    && visible.nodes(node => (node.attrs.class || '').split(/\s+/).includes('jobs-list')).length === 1,
  'current public native job container missing')
  const doc = readNativeAttributeDocument(html), assignments = [], calls = []
  for (const script of doc.nodes(node => node.tag === 'script' && !node.attrs.src
    && !Object.hasOwn(node.attrs, 'nomodule') && /^(?:|(?:text|application)\/javascript)$/i.test(node.attrs.type || ''))) {
    let program
    try { program = parse(script.raw, { ecmaVersion: 'latest' }) } catch { continue }
    for (const node of program.body) {
      if (node.type === 'VariableDeclaration') assignments.push(...node.declarations.map(item => ({ id: item.id, value: item.init })))
      if (node.type === 'ExpressionStatement') {
        const expressions = node.expression.type === 'SequenceExpression' ? node.expression.expressions : [node.expression]
        assignments.push(...expressions.filter(item => item.type === 'AssignmentExpression' && item.operator === '=').map(item => ({ id: item.left, value: item.right })))
      }
    }
    calls.push(...expressionCalls(program.body))
  }
  const value = id => one(assignments.filter(item => name(item.id) === id), 'missing or ambiguous current ' + id).value
  const theme = new URL(literal(value('thessd')))
  requireNative(theme.origin === ORIGIN && !theme.username && !theme.password && !theme.search && !theme.hash
    && /^\/wp-content\/themes\/[a-z\d_-]+$/i.test(theme.pathname), 'foreign current theme URL')
  const directory = value('hwJsDir')
  requireNative(directory?.type === 'BinaryExpression' && directory.operator === '+' && name(directory.left) === 'thessd'
    && literal(directory.right) === '/assets/js/', 'unreviewed native client directory data flow')
  const loaders = calls.filter(call => name(call.callee) === 'loadjs' && call.arguments.length === 2
    && literal(call.arguments[1]) === 'careersjs' && call.arguments[0]?.type === 'ArrayExpression'
    && call.arguments[0].elements.some(item => item?.type === 'BinaryExpression' && item.operator === '+'
      && name(item.left) === 'hwJsDir' && literal(item.right) === 'careers-lever-api.js'))
  one(loaders, 'active current careers client loader missing or ambiguous')
  return theme.href + '/assets/js/careers-lever-api.js'
}

export function chownowNativeFeed(client) {
  const program = parse(client, { ecmaVersion: 'latest' })
  const call = one(expressionCalls(program.body), 'native client entry missing or ambiguous')
  requireNative(program.body.every(node => node.type === 'ExpressionStatement' && (node.expression === call || node.directive === 'use strict')),
    'unsupported native program entry control flow')
  requireNative(syncFunction(call.callee) && call.callee.params.length === 1 && name(call.callee.params[0]) === '$'
    && call.arguments.length === 1 && name(call.arguments[0]) === 'jQuery', 'native client wrapper changed')
  const body = call.callee.body.body
  const init = one(functions(body, 'leverJobsInit'), 'native initializer missing or ambiguous')
  requireNative(expressionCalls(body).every(node => name(node.callee) === 'jQuery' && node.arguments.length === 1 && syncFunction(node.arguments[0])
    || selectorMethod(node, 'jQuery', '.jobs-teams-list', 'on') && node.arguments.length === 3 && literal(node.arguments[0]) === 'click'
      && literal(node.arguments[1]) === '.btn' && syncFunction(node.arguments[2])
    || selectorMethod(node, 'jQuery', '.jobs-teams', 'change') && node.arguments.length === 1 && syncFunction(node.arguments[0])),
  'unsupported native wrapper execution')
  requireNative(body.every(node => node === init || node.type === 'ExpressionStatement' && node.expression?.type === 'CallExpression')
    && syncFunction(init) && init.params.length === 0 && init.body.body.every(node => {
      if (['VariableDeclaration', 'FunctionDeclaration'].includes(node.type)) return true
      if (node.type === 'ExpressionStatement') return node.expression?.type === 'CallExpression'
      if (trackingBranch(node)) return true
      const assignment = node.consequent?.expression
      return node.type === 'IfStatement' && name(node.test) === 'leverTeam' && node.alternate == null
        && assignment?.type === 'AssignmentExpression' && assignment.operator === '='
        && member(assignment.left, 'fetchOptions', 'team') && name(assignment.right) === 'leverTeam'
    }), 'native initialization execution changed')
  const ready = expressionCalls(body).filter(node => name(node.callee) === 'jQuery' && node.arguments.length === 1
    && syncFunction(node.arguments[0]) && node.arguments[0].params.length === 0 && node.arguments[0].body.body.length === 1
    && expressionCalls(node.arguments[0].body.body).some(start => name(start.callee) === 'leverJobsInit' && start.arguments.length === 0))
  one(ready, 'current native initialization detached')
  const activeReads = new Map()
  requireNative(expressionCalls(init.body.body).every(node => {
    if (selectorMethod(node, '$', '.jobs-sort select', 'change')) return node.arguments.length === 1 && name(node.arguments[0]) === 'filterJobs'
    if (name(node.callee) !== 'fetchCareersData' || node.arguments.length !== 2) return false
    const callback = node.arguments[1], statement = callback?.body?.body?.[0], render = statement?.expression
    if (!syncFunction(callback) || callback.params.length !== 1 || callback.body.body.length !== 1 || statement.type !== 'ExpressionStatement'
      || render?.type !== 'CallExpression' || render.arguments.length !== 1 || name(render.arguments[0]) !== name(callback.params[0])) return false
    const target = name(render.callee)
    if (!['renderCareersFilters', 'renderJobs', 'countJobs'].includes(target)) return false
    activeReads.set(target, (activeReads.get(target) || 0) + 1)
    return target === 'renderJobs' ? name(node.arguments[0]) === 'fetchOptions'
      : node.arguments[0]?.type === 'ObjectExpression' && node.arguments[0].properties.length === 0
  }) && activeReads.size === 3 && [...activeReads.values()].every(count => count === 1), 'unsupported native initializer calls')
  const fetcher = one(functions(init.body.body, 'fetchCareersData'), 'native fetcher missing or ambiguous')
  requireNative(syncFunction(fetcher) && fetcher.params.length === 2 && name(fetcher.params[0]) === 'options'
    && name(fetcher.params[1]) === 'callback', 'native fetch signature changed')
  requireNative(fetcher.body.body.length === 4 && fetcher.body.body[0].type === 'VariableDeclaration'
    && fetcher.body.body[0].declarations.length === 1 && optionAppend(fetcher.body.body[1], 'team')
    && optionAppend(fetcher.body.body[2], 'location') && fetcher.body.body[3].type === 'ExpressionStatement'
    && fetcher.body.body[3].expression.type === 'CallExpression', 'unsupported native endpoint mutation or fetch control flow')
  const api = literal(one(variables(fetcher.body.body, 'leverUrl'), 'native endpoint declaration changed').init)
  requireNative(api === 'https://api.lever.co/v0/postings/chownow?mode=json', 'native employer account or endpoint changed')
  const ajax = one(expressionCalls(fetcher.body.body).filter(node => node.callee?.type === 'MemberExpression'
    && name(node.callee.object) === '$' && !node.callee.computed && name(node.callee.property) === 'ajax'), 'native public AJAX flow changed')
  const object = ajax.arguments[0]
  requireNative(ajax.arguments.length === 1 && object?.type === 'ObjectExpression', 'native AJAX options changed')
  const fields = new Map()
  for (const property of object.properties) {
    const key = name(property.key) || literal(property.key)
    requireNative(property.type === 'Property' && property.kind === 'init' && !property.computed && !fields.has(key), 'native AJAX property changed')
    fields.set(key, property.value)
  }
  requireNative(fields.size === 4 && [...fields.keys()].every(key => ['dataType', 'url', 'success', 'error'].includes(key))
    && literal(fields.get('dataType')) === 'json' && name(fields.get('url')) === 'leverUrl', 'native public GET contract changed')
  const success = fields.get('success')
  requireNative(syncFunction(success) && success.params.length === 1 && name(success.params[0]) === 'data'
    && success.body.body.length === 1
    && expressionCalls(success.body.body).some(node => name(node.callee) === 'callback' && node.arguments.length === 1 && name(node.arguments[0]) === 'data'),
  'native response is detached from published job data')
  const containerDeclaration = one(variables(init.body.body, '$jobsListContainer'), 'native renderer container changed')
  const container = containerDeclaration.init
  requireNative(container?.type === 'CallExpression' && name(container.callee) === '$'
    && container.arguments.length === 1 && literal(container.arguments[0]) === '#jobs-container .jobs-list', 'native visible container binding changed')
  requireNative(variables(init.body.body, 'fetchCareersData').length === 0 && variables(init.body.body, 'renderJobs').length === 0,
    'native functions are shadowed')
  const bindings = new Map([['$jobsListContainer', containerDeclaration], ['$', call.callee.params[0]], ['jQuery', null],
    ['leverJobsInit', init], ...init.body.body.filter(node => node.type === 'FunctionDeclaration').map(node => [node.id.name, node])])
  protectNativeBindings(program, bindings)
  verifyPathSelection(init)
  for (const id of ['cleanString', 'nullCheck']) {
    const helper = one(functions(init.body.body, id), 'native row helper missing or ambiguous')
    const statement = helper.body.body[0], value = statement?.argument
    requireNative(syncFunction(helper) && helper.params.length === 1 && name(helper.params[0]) === 'string'
      && helper.body.body.length === 1 && statement.type === 'ReturnStatement' && value?.type === 'ConditionalExpression'
      && name(value.test) === 'string' && literal(value.alternate) === 'Uncategorized', 'native row helper execution changed')
    requireNative(id === 'nullCheck' ? name(value.consequent) === 'string'
      : value.consequent?.type === 'CallExpression' && member(value.consequent.callee, 'string', 'replace')
        && value.consequent.arguments.length === 2 && value.consequent.arguments[0]?.regex?.pattern === '\\s+'
        && /^[gi]+$/.test(value.consequent.arguments[0].regex.flags) && value.consequent.arguments[0].regex.flags.includes('g')
        && literal(value.consequent.arguments[1]) === '', 'native row helper transformation changed')
  }
  verifyRenderer(one(functions(init.body.body, 'renderJobs'), 'native renderer missing or ambiguous'))
  const rendering = expressionCalls(init.body.body).filter(node => name(node.callee) === 'fetchCareersData'
    && node.arguments.length === 2 && syncFunction(node.arguments[1]) && node.arguments[1].params.length === 1
    && node.arguments[1].body.body.length === 1
    && expressionCalls(node.arguments[1].body.body).some(render => name(render.callee) === 'renderJobs'
      && render.arguments.length === 1 && name(render.arguments[0]) === name(node.arguments[1].params[0])))
  one(rendering, 'native fetch-to-render initialization missing or ambiguous')
  return api
}

const escapeHTML = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const originalContent = record => {
  const html = (field, fallback) => {
    requireNative(record[field] == null || typeof record[field] === 'string', 'non-string native content')
    requireNative(record[fallback] == null || typeof record[fallback] === 'string', 'non-string native plain content')
    return record[field] || (record[fallback] ? escapeHTML(record[fallback]) : '')
  }
  const primary = html('descriptionBody', 'descriptionBodyPlain') || html('description', 'descriptionPlain')
  requireNative(record.lists == null || Array.isArray(record.lists), 'native content section inventory changed')
  const sections = (record.lists || []).map(section => {
    requireNative(section && typeof section === 'object' && typeof section.text === 'string' && typeof section.content === 'string', 'native content section changed')
    return (section.text ? '<h3>' + escapeHTML(section.text) + '</h3>' : '') + section.content
  })
  const content = [html('opening', 'openingPlain'), primary, ...sections, html('additional', 'additionalPlain')].filter(Boolean).join('\n\n')
  requireNative(hasSourceDescription({ sourceDescription: content }), 'native full role content missing')
  return content
}

export async function runNativeChownow(options = {}) {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(90000)])
  signal.throwIfAborted()
  const allowed = new Set([CAREERS])
  const request = createHTMLTransport({ validateURL: url => requireNative(allowed.has(url), 'unadvertised native resource'),
    expectedContentType: url => url === CAREERS ? 'text/html' : url.startsWith('https://api.lever.co/') ? 'application/json' : 'application/javascript' }, { signal })
  let bytes = 0
  const checks = []
  const read = async (url, types) => {
    const response = await request(url)
    signal.throwIfAborted()
    bytes += response.body.byteLength
    requireNative(response.status === 200 && bytes <= 6 * 1024 * 1024, 'native HTTP ' + response.status + ' or byte bound')
    requireNative(types.includes(response.headers['content-type']?.split(';')[0].trim().toLowerCase()), 'native resource MIME changed')
    checks.push({ requestedURL: url, finalURL: response.url, httpStatus: response.status,
      bodySHA256: createHash('sha256').update(response.body).digest('hex'), checkedAt: new Date().toISOString() })
    return new TextDecoder('utf-8', { fatal: true }).decode(response.body)
  }
  const client = chownowClientURL(await read(CAREERS, ['text/html']))
  allowed.add(client)
  const api = chownowNativeFeed(await read(client, ['application/javascript', 'text/javascript']))
  allowed.add(api)
  const payload = JSON.parse(await read(api, ['application/json']))
  requireNative(Array.isArray(payload), 'invalid native posting inventory')
  const nativeById = new Map()
  for (const record of payload) {
    requireNative(record && typeof record.id === 'string' && !nativeById.has(record.id), 'missing or duplicate native posting identity')
    nativeById.set(record.id, record)
  }
  const bindingEvidence = { verified: true, officialURL: CAREERS, evidenceURL: client,
    matchedLinks: [api], bindingMethod: 'current-official-loader-native-public-AJAX-to-visible-job-renderer', checkedAt: new Date().toISOString() }
  const jobs = await createPublishingGapAtsScraper({ source: 'chownow', companyName: 'Chownow',
    atsPlatform: 'lever', boardToken: 'chownow', companyCareerPage: CAREERS, sourceScopeComplete: false,
    zeroResultPolicy: 'evidence-required', bindingEvidence }).run({ signal, fetchJson: async url => {
    requireNative(url === api, 'native request identity changed')
    return payload
  } })
  signal.throwIfAborted()
  for (const job of jobs) {
    const native = nativeById.get(job.jobId)
    requireNative(native && (native.createdAt == null || Number.isSafeInteger(native.createdAt)
      && native.createdAt >= 0 && Number.isFinite(new Date(native.createdAt).getTime())), 'invalid native publication timestamp')
    const content = originalContent(native)
    Object.assign(job, { jobDescription: content, sourceDescription: content,
      postingDate: native.createdAt == null ? null : new Date(native.createdAt).toISOString(),
      nativeCreatedAt: native.createdAt ?? null, officialAtsBinding: bindingEvidence,
      sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false })
  }
  Object.defineProperty(jobs, OFFICIAL_ATS_DISCOVERY, { value: { boards: [{ atsPlatform: 'lever', boardToken: 'chownow', bindingEvidence }], checks } })
  return jobs
}
