import { parse, tokenizer } from 'acorn'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { parseRemoteLiteral } from '../../scraper-support/utils/remoteScriptData.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fail = reason => { throw Object.assign(new Error(`[aindrasystems] Current native careers ${reason}`), {
  code: 'AINDRA_NATIVE_UNQUALIFIED', abortRetries: true,
}) }
const requireNative = (condition, reason) => { if (!condition) fail(reason) }
const normalize = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const one = (values, reason) => { requireNative(values.length === 1, reason); return values[0] }
function nodes(root, predicate) {
  const found = [], pending = [root]
  let visited = 0
  while (pending.length) {
    const node = pending.pop()
    if (!node || typeof node !== 'object') continue
    requireNative(++visited <= 250_000, 'program node bound exceeded')
    if (Array.isArray(node)) { pending.push(...node); continue }
    if (predicate(node)) found.push(node)
    for (const [key, value] of Object.entries(node)) if (key !== 'start' && key !== 'end' && value && typeof value === 'object') pending.push(value)
  }
  return found
}
const property = (object, name) => object?.type === 'ObjectExpression' && object.properties.find(row =>
  row.type === 'Property' && !row.computed && (row.key.name ?? row.key.value) === name)?.value
const member = (node, object, name) => node?.type === 'MemberExpression' && !node.computed && !node.optional
  && node.object.type === 'Identifier' && node.object.name === object && node.property.name === name
const jsx = node => node?.type === 'CallExpression' && !node.optional && node.callee.type === 'MemberExpression'
  && !node.callee.computed && ['jsx', 'jsxs'].includes(node.callee.property.name)

export function currentAindraAppEntry(html, sourceUrl) {
  if (!/AiNDRA\s*-\s*AI-Powered Cancer Detection/i.test(html)) return null
  const doc = readNativeDocument(html)
  requireNative(doc.nodes(node => node.tag === 'title' && /AiNDRA\s*-\s*AI-Powered Cancer Detection/i.test(node.raw || '')).length === 1
    && doc.nodes(node => node.attrs.id === 'root').length === 1, 'application identity changed')
  const entry = one(doc.nodes(node => node.tag === 'script' && node.attrs.type === 'module' && node.attrs.src
    && !Object.hasOwn(node.attrs, 'nomodule')).filter(node => {
    const url = new URL(node.attrs.src, sourceUrl)
    return url.origin === new URL(sourceUrl).origin && /^\/assets\/index-[\w-]+\.js$/.test(url.pathname) && !url.search && !url.hash
  }), 'active first-party app entry is missing or ambiguous')
  return new URL(entry.attrs.src, sourceUrl).href
}

export function extractCurrentAindraBriefs(client, { sourceUrl, now = () => new Date().toISOString() }) {
  requireNative(typeof client === 'string' && Buffer.byteLength(client) <= 1_000_000, 'client byte bound exceeded')
  let tokens = 0, depth = 0
  for (const token of tokenizer(client, { ecmaVersion: 'latest', sourceType: 'module' })) {
    requireNative(++tokens <= 200_000, 'client token bound exceeded')
    if (['{', '[', '(', '${'].includes(token.type.label)) requireNative(++depth <= 160, 'client depth bound exceeded')
    if (['}', ']', ')'].includes(token.type.label)) depth--
  }
  // Read syntax and literal data only. The employer's client is never evaluated.
  const program = parse(client, { ecmaVersion: 'latest', sourceType: 'module' })
  const declarations = nodes(program, node => node.type === 'VariableDeclarator' && node.id.type === 'Identifier')
  const declaration = name => one(declarations.filter(row => row.id.name === name), 'ambiguous native data binding')
  const arrays = declarations.filter(row => row.init?.type === 'ArrayExpression' && row.init.elements.length > 0
    && row.init.elements.every(item => item?.type === 'ObjectExpression' && item.properties.length === 3
      && property(item, 'id') && property(item, 'title') && property(item, 'location')))
  const candidate = one(arrays, 'role data array is missing or ambiguous')
  const name = candidate.id.name
  const references = nodes(program, node => node.type === 'Identifier' && node.name === name)
  requireNative(references.length === 2, 'role array has aliases, overrides or mutations')
  const positions = one(declarations.filter(row => ['ArrowFunctionExpression', 'FunctionExpression'].includes(row.init?.type)
    && nodes(row.init, node => node.type === 'Literal' && node.value === 'Current openings at Aindra Systems').length === 1
    && nodes(row.init, node => node.type === 'CallExpression' && member(node.callee, name, 'map')).length === 1),
  'current openings renderer is not bound to the native role array')
  const map = one(nodes(positions.init, node => node.type === 'CallExpression' && member(node.callee, name, 'map')), 'native role map changed')
  const callback = map.arguments[0]
  requireNative(map.arguments.length === 1 && callback?.type === 'ArrowFunctionExpression'
    && callback.params.length === 1 && callback.params[0].type === 'Identifier' && jsx(callback.body), 'native role renderer changed')
  const rowName = callback.params[0].name, call = callback.body
  requireNative(call.arguments[0]?.type === 'Identifier' && property(call.arguments[1], 'job')?.type === 'Identifier'
    && property(call.arguments[1], 'job').name === rowName && member(call.arguments[2], rowName, 'id'), 'native role card binding changed')
  const card = declaration(call.arguments[0].name)
  const pattern = card.init?.params?.[0]
  const binding = pattern?.type === 'ObjectPattern' && pattern.properties.find(row => row.key.name === 'job')?.value
  requireNative(binding?.type === 'Identifier', 'native role card input changed')
  for (const [tag, field] of [['h3', 'title'], ['p', 'location']]) requireNative(nodes(card.init, node => jsx(node)
    && node.arguments[0]?.value === tag && member(property(node.arguments[1], 'children'), binding.name, field)).length === 1,
  `native role ${field} is not rendered`)
  const careers = one(declarations.filter(row => ['ArrowFunctionExpression', 'FunctionExpression'].includes(row.init?.type)
    && nodes(row.init, node => jsx(node) && node.arguments[0]?.type === 'Identifier' && node.arguments[0].name === positions.id.name).length === 1),
  'native careers component is missing or ambiguous')
  requireNative(nodes(program, node => node.type === 'SwitchCase' && node.test?.value === '/careers'
    && nodes(node, value => value.type === 'ReturnStatement' && jsx(value.argument)
      && value.argument.arguments[0]?.name === careers.id.name).length === 1).length === 1, 'careers route is not bound')
  const rows = parseRemoteLiteral(client.slice(candidate.init.start, candidate.init.end))
  requireNative(rows.length <= 100 && rows.every(row => Number.isSafeInteger(row.id) && row.id > 0
    && normalize(row.title) && normalize(row.location)) && new Set(rows.map(row => row.id)).size === rows.length,
  'native role identities or labels changed')
  const careerUrl = new URL('#/careers', sourceUrl).href
  const jobs = rows.map(row => ({
    source: 'aindrasystems', company: 'Aindra Systems', title: normalize(row.title),
    jobId: `aindrasystems-native-${row.id}`, requisitionId: null,
    sourceUrl: careerUrl, applyUrl: careerUrl, link: careerUrl,
    location: normalize(row.location).replace(/\s*-\s*Full time$/i, ''),
    city: normalize(row.location).split(',')[0] || null, country: /\bindia\b/i.test(row.location) ? 'India' : null,
    employmentType: /\bFull time\b/i.test(row.location) ? 'Full-time' : null,
    jobDescription: null, experienceRequired: null, minimumQualification: null,
    preferredQualification: null, requiredSkills: [], postingDate: null, closingDate: null,
    nativeSourceRecord: structuredClone(row), nativeIdentityKind: 'rendered-career-card',
    sourceDetailComplete: false, sourceDetailFailureKind: 'native-description-and-country-unavailable',
    sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    preserveExistingSourceContent: true, scrapedAt: now(),
  }))
  return attachInventoryEvidence(jobs, {
    status: 'discovery-only', surface: careerUrl, firstParty: true, listingComplete: false,
    pagesFetched: 2, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
    reason: 'aindra-current-bound-careers-card-briefs-only:native-description-and-country-unavailable',
  })
}
