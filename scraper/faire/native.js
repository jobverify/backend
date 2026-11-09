import { parse } from 'acorn'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { createHTMLTransport } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { requireNative } from '../../scraper-support/shared/nativeJobPosting.js'
import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CAREERS = 'https://www.faire.com/careers/openings'
const ASSETS = 'https://cdn.faire.com/visitor/_next/static/chunks/'
const one = (values, label) => { requireNative(values.length === 1, `Faire: missing or ambiguous ${label}`); return values[0] }
const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return
  if (node.type) visit(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visit))
    else if (value && typeof value === 'object') walk(value, visit)
  }
}
const callee = node => node?.type === 'SequenceExpression' ? node.expressions.at(-1) : node
const literalFalse = node => node?.type === 'Literal' && node.value === false
  || node?.type === 'UnaryExpression' && node.operator === '!' && node.argument?.type === 'Literal' && node.argument.value === 1
const declarations = module => module.body.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
const imports = module => new Map(declarations(module).filter(node => node.id.type === 'Identifier' && node.init?.type === 'CallExpression'
  && node.init.callee.name === module.params[2]?.name && node.init.arguments.length === 1 && Number.isSafeInteger(node.init.arguments[0].value))
  .map(node => [node.id.name, node.init.arguments[0].value]))

function modules(body) {
  const program = parse(body, { ecmaVersion: 'latest' })
  const call = one(program.body.filter(node => node.directive !== 'use strict'), 'native client bundle statement').expression
  requireNative(call?.type === 'CallExpression' && call.callee?.property?.name === 'push'
    && call.callee.object?.type === 'AssignmentExpression' && call.callee.object.left?.object?.name === 'self'
    && call.callee.object.left.property?.name === 'webpackChunk_N_E', 'Faire: native client bundle identity changed')
  const properties = call.arguments[0]?.elements?.[1]?.properties
  requireNative(Array.isArray(properties) && properties.length > 0, 'Faire: native client modules missing')
  const result = new Map()
  for (const property of properties) {
    requireNative(property.type === 'Property' && Number.isSafeInteger(property.key.value) && !result.has(property.key.value)
      && ['ArrowFunctionExpression', 'FunctionExpression'].includes(property.value.type)
      && property.value.body.type === 'BlockStatement', 'Faire: duplicate or unreviewed native module')
    result.set(property.key.value, property.value)
  }
  return result
}

export function faireAssets(html) {
  const doc = readNativeDocument(html)
  const urls = doc.nodes(node => node.tag === 'script' && node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
    && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || ''))
    .map(node => node.attrs.src).filter(value => {
      try { const url = new URL(value); return url.href.startsWith(ASSETS) && !url.username && !url.password && !url.search && !url.hash } catch { return false }
    })
  const page = one(urls.filter(url => /\/careers\/openings\/page-[a-f\d]+\.js$/.test(url)), 'current careers page module')
  // This reviewed shared careers chunk is advertised by the current page.
  // A new chunk layout requires review instead of guessing a native tenant.
  const shared = one(urls.filter(url => /\/43927-[a-f\d]+\.js$/.test(url)), 'current shared careers module')
  return { page, shared }
}

export function faireBindings(pageBody, sharedBody, assets) {
  const entryModules = modules(pageBody), sharedModules = modules(sharedBody)
  const entries = [...entryModules].filter(([, module]) => {
    let exported = false
    walk(module.body, node => {
      if (node.type === 'CallExpression' && node.callee?.object?.name === module.params[2]?.name && node.callee.property?.name === 'd'
        && node.arguments[1]?.properties?.some(property => property.key.name === 'JobOpenings')) exported = true
    })
    return exported
  })
  const [, entry] = one(entries, 'current JobOpenings export')
  const hooks = []
  for (const id of imports(entry).values()) {
    const hook = sharedModules.get(id)
    if (!hook) continue
    const scopes = new Map()
    walk(hook.body, node => {
      const read = callee(node.callee), argument = node.arguments?.[0]
      if (node.type !== 'CallExpression' || read?.type !== 'MemberExpression' || read.property?.name !== 'Nr'
        || argument?.type !== 'MemberExpression' || argument.object?.type !== 'MemberExpression'
        || argument.object.object?.name !== read.object?.name || argument.object.property?.name !== 'CY'
        || !['EMPLOYMENT', 'CONSULTANT'].includes(argument.property?.name)) return
      const moduleId = imports(hook).get(read.object.name)
      if (moduleId) { if (!scopes.has(moduleId)) scopes.set(moduleId, new Set()); scopes.get(moduleId).add(argument.property.name) }
    })
    for (const [moduleId, types] of scopes) if (types.size === 2 && sharedModules.has(moduleId)) hooks.push(sharedModules.get(moduleId))
  }
  const routeModule = one(hooks, 'employee and consultant inventory hook')
  const routes = declarations(routeModule).filter(node => node.id.type === 'Identifier' && node.init?.type === 'ObjectExpression'
    && node.init.properties.length === 2 && node.init.properties.every(property => ['EMPLOYMENT', 'CONSULTANT'].includes(property.key.name)
      && property.value.type === 'Literal' && typeof property.value.value === 'string'))
  const routeMap = one(routes, 'native inventory route map')
  const requests = []
  walk(routeModule.body, node => {
    if (node.type !== 'CallExpression' || node.arguments.length !== 1 || node.arguments[0]?.type !== 'ObjectExpression') return
    const properties = node.arguments[0].properties
    if (properties.some(property => property.type !== 'Property' || property.computed || property.kind !== 'init')) return
    const fields = new Map(properties.map(property => [property.key.name, property.value]))
    if (fields.size !== properties.length || fields.get('baseUrl')?.value !== 'https://boards-api.greenhouse.io'
      || fields.get('method')?.value !== 'GET' || !literalFalse(fields.get('withCredentials'))
      || fields.get('headers')?.type !== 'NewExpression' || fields.get('headers').callee?.name !== 'Headers' || fields.get('headers').arguments.length
      || fields.get('url')?.type !== 'MemberExpression' || !fields.get('url').computed || fields.get('url').object?.name !== routeMap.id.name
      || fields.get('route')?.type !== 'MemberExpression' || fields.get('route').object?.name !== routeMap.id.name
      || fields.get('route').property?.name !== fields.get('url').property?.name
      || [...fields.keys()].some(key => !['url', 'route', 'baseUrl', 'method', 'withCredentials', 'headers'].includes(key))) return
    requests.push(fields)
  })
  one(requests, 'native public inventory GET data flow')
  const bindings = routeMap.init.properties.map(property => {
    const match = /^\/v1\/boards\/([a-z\d][a-z\d._-]{0,100})\/departments$/i.exec(property.value.value)
    requireNative(match, 'Faire: native inventory route changed')
    return { atsPlatform: 'greenhouse', boardToken: match[1], nativeWorkType: property.key.name,
      bindingEvidence: { verified: true, checkedAt: new Date().toISOString(), officialURL: CAREERS, evidenceURL: assets.shared,
        matchedLinks: [`https://boards-api.greenhouse.io${property.value.value}`], bindingMethod: 'official-careers-advertised-native-api-dataflow' } }
  })
  requireNative(new Set(bindings.map(binding => binding.boardToken)).size === 2, 'Faire: native inventory scopes overlap')
  return bindings
}

export async function runNativeFaire(options = {}) {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(120000)])
  signal.throwIfAborted()
  const allowed = new Set([CAREERS])
  const request = options.transport || createHTMLTransport({ validateURL: url => requireNative(allowed.has(url), 'Faire: unadvertised resource'),
    expectedContentType: url => url.startsWith('https://boards-api.greenhouse.io/') ? 'application/json' : url.endsWith('.js') ? 'application/javascript' : 'text/html' },
  { signal, fetchImpl: (url, init) => fetch(url, { ...init, headers: { ...init.headers, 'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)' } }) })
  let reads = 0, bytes = 0
  const read = async (url, types) => {
    signal.throwIfAborted()
    requireNative(allowed.has(url) && ++reads <= 5, 'Faire: native request budget or identity changed')
    const response = await request(url, { signal })
    signal.throwIfAborted()
    requireNative(response?.url === url && response.bodyComplete === true && response.body instanceof Uint8Array,
      'Faire: native public HTTP response incomplete')
    requireNative(response.status === 200, `Faire: native public HTTP ${response.status}`)
    bytes += response.body.byteLength
    requireNative(response.body.byteLength <= 2 * 1024 * 1024 && bytes <= 8 * 1024 * 1024
      && types.includes(response.headers?.['content-type']?.split(';')[0].trim().toLowerCase()), 'Faire: native MIME or byte budget changed')
    return new TextDecoder('utf-8', { fatal: true }).decode(response.body)
  }
  const assets = faireAssets(await read(CAREERS, ['text/html']))
  allowed.add(assets.page); allowed.add(assets.shared)
  const [page, shared] = await Promise.all([read(assets.page, ['application/javascript', 'text/javascript']), read(assets.shared, ['application/javascript', 'text/javascript'])])
  const bindings = faireBindings(page, shared, assets)
  const scopes = await Promise.all(bindings.map(async binding => {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(binding.boardToken)}/jobs?content=true`
    allowed.add(url)
    const jobs = await createPublishingGapAtsScraper({ ...binding, source: 'faire', companyName: 'Faire', companyCareerPage: CAREERS,
      sourceScopeComplete: false, zeroResultPolicy: 'evidence-required' }).run({ signal, fetchJson: async requested => {
      requireNative(requested === url, 'Faire: native board request changed')
      const payload = JSON.parse(await read(url, ['application/json']))
      requireNative(!Array.isArray(payload?.jobs) || payload.jobs.every(job => job.company_name === 'Faire'), 'Faire: native employer label mismatch')
      return payload
    } })
    for (const job of jobs) Object.assign(job, { officialAtsBinding: binding.bindingEvidence, nativeBoardWorkType: binding.nativeWorkType,
      sourceDescription: job.sourceDescription || job.jobDescription,
      sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false })
    return jobs
  }))
  const jobs = scopes.flat(), identities = jobs.map(job => job.jobId || job.id)
  requireNative(new Set(identities).size === identities.length, 'Faire: duplicate role identity across native scopes')
  signal.throwIfAborted()
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: CAREERS, firstParty: true, listingComplete: false,
    pagesFetched: 2, reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
    reason: `current-first-party-Faire-EMPLOYMENT-and-CONSULTANT-native-feeds;returned-india-details=${jobs.length};whole-company-scope-unverified` })
}
