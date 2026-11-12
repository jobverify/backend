import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse } from 'acorn'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const origin = 'https://www.sixt.jobs'
export const SIXT_LIST = origin + '/in/jobs?q=&country=IN'
const pages = ['/in/research-and-development-india', '/in/about-us', '/in/tech-engineering', '/in/corporate-functions'].map(path => origin + path)
const results = page => origin + '/in/jobs/results?q=&country=IN&page=' + page + '&per_page=20'
const smart = offset => 'https://api.smartrecruiters.com/v1/companies/SIXT/postings?offset=' + offset + '&limit=100&country=in'
const clients = new Map([
  ['https://cdn.sixt.jobs/build/assets/app-kLBNkimr.js', ''],
  ['https://cdn.sixt.jobs/build/assets/vendor-DHApjQxJ.js', ''],
])
const reviewed = JSON.parse(readFileSync(new URL('./publicScopeReviewed20261112.json', import.meta.url)))
const sha = value => createHash('sha256').update(value).digest('hex')
const insist = (condition, reason) => { if (!condition) throw new Error('SIXT public scope: ' + reason) }
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const equal = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
const norm = value => String(value).normalize('NFKC').replace(/\s/g, '')
const keys = (value, names) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === names.split(',').sort().join(',')
const member = (node, object, property) => node?.type === 'MemberExpression' && !node.computed && !node.optional
  && node.object?.type === 'Identifier' && node.object.name === object && node.property?.name === property
const dataVariables = new Set(['countryData', 'cityData', 'roleData', 'levelData', 'departmentData'])

// Parse syntax; never evaluate publisher JavaScript. Only unconditional native
// JSON data slots are replaced. All code, carriers and attributes stay pinned.
function scriptBody(body, initialStates) {
  const ast = parse(body, { ecmaVersion: 'latest', sourceType: 'script' }), slots = []
  for (const statement of ast.body) {
    if (statement.type === 'VariableDeclaration' && statement.kind === 'const') {
      for (const declaration of statement.declarations) {
        if (declaration.id.type !== 'Identifier' || !dataVariables.has(declaration.id.name)) continue
        const init = declaration.init
        insist(init && ['ObjectExpression', 'ArrayExpression'].includes(init.type), 'native lookup data is executable or unavailable')
        const data = JSON.parse(body.slice(init.start, init.end))
        insist(data && typeof data === 'object' && !Object.hasOwn(data, '__proto__'), 'native lookup data changed shape')
        if (declaration.id.name === 'countryData') insist(data.IN?.code === 'IN' && data.IN.name === 'India', 'India country control changed')
        slots.push({ start: init.start, end: init.end, text: '{} /* native ' + declaration.id.name + ' data */' })
      }
    }
    const expression = statement.type === 'ExpressionStatement' ? statement.expression : null
    if (expression?.type !== 'AssignmentExpression' || !member(expression.left, 'window', '__JOB_SEARCH_INITIAL_STATE__')) continue
    const call = expression.right
    insist(expression.operator === '=' && call?.type === 'CallExpression' && !call.optional
      && member(call.callee, 'JSON', 'parse') && call.arguments.length === 1
      && call.arguments[0].type === 'Literal' && typeof call.arguments[0].value === 'string', 'native inventory initializer changed')
    initialStates.push(JSON.parse(call.arguments[0].value))
    slots.push({ start: call.arguments[0].start, end: call.arguments[0].end, text: '"<qualified-native-inventory>"' })
  }
  for (const slot of slots.sort((a, b) => b.start - a.start)) body = body.slice(0, slot.start) + slot.text + body.slice(slot.end)
  return body
}

export function describeSixtPublicPage(page, url, inventory) {
  insist(page.status === 200 && page.url === url && typeof page.html === 'string', 'official page authority changed')
  const doc = readNativeDocument(page.html), declarations = [], contracts = new Set(), initialStates = []
  const roles = new Map(inventory.items.map(item => [item.slug, item]))
  const visit = node => {
    const attrs = { ...node.attrs }, dynamic = {}
    for (const [name, value] of Object.entries(attrs)) {
      if (!/^on|^x-|^@|^:/.test(name)) continue
      let normalized = value
      const toggle = /^\$store\.jobFavourites\.toggle\('([a-f\d-]{36})'\)$/.exec(value)
      if (toggle) { insist(roles.has(toggle[1]), 'unreconciled favourite role'); normalized = "$store.jobFavourites.toggle('<native-role>')" }
      dynamic[name] = normalized
      attrs[name] = normalized
    }
    if (Object.keys(dynamic).length) contracts.add(JSON.stringify(canonical({ tag: node.tag, dynamic })))
    if (node.tag === 'script') {
      const body = node.raw || ''
      declarations.push({ tag: 'script', attrs, bodySHA256: sha(attrs.src || attrs.type === 'application/ld+json'
        || attrs.type && !/^(?:text|application)\/javascript$/i.test(attrs.type) ? body : scriptBody(body, initialStates)) })
    } else if (['a', 'area', 'form', 'base', 'iframe', 'frame', 'object', 'embed', 'portal', 'link'].includes(node.tag)
      || node.tag === 'meta' && attrs['http-equiv'] || ['input', 'button'].includes(node.tag) && (attrs.formaction || attrs.form)) {
      const destination = node.tag === 'a' && attrs.href ? new URL(attrs.href, url) : null
      const id = destination?.origin === origin && !destination.search && !destination.hash
        && destination.pathname.match(/^\/in\/jobs\/([a-f\d-]{36})$/)?.[1]
      const label = node.tag === 'a' ? doc.text(node) : null
      if (id) {
        const role = roles.get(id)
        insist(role && (!label || label === role.title || label === 'View'), 'unreconciled advertised public vacancy')
        attrs.href = '<qualified-native-role>'
        if (attrs['data-job-view-payload']) {
          insist(equal(JSON.parse(attrs['data-job-view-payload']), role.tracking_payload), 'native role tracking identity changed')
          attrs['data-job-view-payload'] = '<qualified-native-tracking>'
        }
        contracts.add(JSON.stringify(canonical({ tag: node.tag, attrs, label: label === role.title ? '<native-role-title>' : label })))
      } else declarations.push({ tag: node.tag, attrs, label })
    }
    node.children.filter(child => typeof child !== 'string').forEach(visit)
  }
  doc.nodes(node => node.tag === 'root').forEach(visit)
  if (url === SIXT_LIST) insist(initialStates.length === 1 && equal(initialStates[0], inventory), 'visible and JSON native inventories disagree')
  else insist(initialStates.length === 0, 'additional native inventory initializer requires review')
  return { sha256: sha(JSON.stringify(canonical({ declarations, dynamicContracts: [...contracts].sort() }))),
    declarationCount: declarations.length, dynamicContractCount: contracts.size }
}

const filters = {
  q: '', search: '', search_mode: '', suggestion_type: '', suggestion_title: '', country: 'IN', city: '', role: '',
  level: '', department: '', sort: 'best_fit',
}
const itemKeys = 'slug,title,score,priority,type_of_employment,city,city_slug,geo,region,role,level_slug,level,country,country_slug,released_date,posting_url,apply_url,url,trashed,tracking_payload'
function readNativeInventory(json, page, rows) {
  insist(keys(json, 'items,total,page,per_page,has_more,search_text,cta_headline,filters,tracking_payload')
    && Array.isArray(json.items) && json.total === rows.length && json.page === page && json.per_page === 20
    && json.has_more === false && equal(json.filters, filters) && json.search_text === 'located in India.'
    && json.cta_headline === 'Join Team Orange in India!', 'native India filter, count or terminal changed')
  if (page === 2) { insist(json.items.length === 0, 'native terminal is not empty'); return json }
  insist(json.items.length === rows.length && rows.length > 0 && rows.length <= 20
    && new Set(json.items.map(item => item.slug)).size === rows.length, 'native inventory is duplicate, empty or truncated')
  for (const row of rows) {
    const item = json.items.find(item => item.slug === row.jobId)
    insist(keys(item, itemKeys) && item.title === row.title && item.country_slug === 'IN' && item.country === 'India'
      && item.trashed === false && origin + item.url === row.sourceUrl && item.tracking_payload?.job_id === item.slug
      && item.tracking_payload.job_title === item.title && item.tracking_payload.job_country === 'India', 'native role identity or country is unresolved')
    insist(/^https:\/\/jobs\.smartrecruiters\.com\/SIXT\/\d{15}-[^?#]+$/.test(item.posting_url)
      && item.apply_url === item.posting_url + '?oga=true', 'native independent ATS handoff changed')
  }
  return json
}

function readSmartInventory(json, offset, items) {
  insist(keys(json, 'offset,limit,totalFound,content') && json.offset === offset && json.limit === 100
    && json.totalFound === items.length && Array.isArray(json.content), 'independent native ATS pagination changed')
  if (offset) { insist(json.content.length === 0, 'independent native ATS terminal is not empty'); return json }
  insist(json.content.length === items.length && new Set(json.content.map(item => item.id)).size === items.length,
    'independent native ATS identities do not reconcile')
  for (const item of items) {
    const id = item.posting_url.match(/\/SIXT\/(\d{15})-/)[1], row = json.content.find(row => row.id === id)
    insist(row && row.name === item.title && row.company?.identifier === 'SIXT' && row.location?.country === 'in'
      && row.ref === 'https://api.smartrecruiters.com/v1/companies/SIXT/postings/' + id,
    'independent ATS role, employer or India workplace is unresolved')
  }
  return json
}

function qualifyOriginalCriteria(row, item, job) {
  const id = item.posting_url.match(/\/SIXT\/(\d{15})-/)[1]
  insist(row.id === id && row.name === job.title && row.refNumber === job.requisitionId && row.company?.identifier === 'SIXT'
    && row.company.name === 'SIXT' && row.active === true && row.visibility === 'PUBLIC'
    && row.location?.country === 'in' && row.location.city === item.city && row.postingUrl === item.posting_url
    && row.applyUrl === item.apply_url, 'original native role, employer, workplace or active state changed')
  insist(Array.isArray(row.customField) && row.customField.filter(field => field.fieldLabel === 'Brands').length === 1
    && row.customField.find(field => field.fieldLabel === 'Brands').valueLabel === 'SIXT India'
    && row.customField.filter(field => field.fieldId === 'COUNTRY').length === 1
    && row.customField.find(field => field.fieldId === 'COUNTRY').valueId === 'in', 'native India brand or country control changed')
  const sections = row.jobAd?.sections
  insist(keys(sections, 'companyDescription,jobDescription,qualifications,additionalInformation,videos')
    && typeof sections.jobDescription?.text === 'string' && sections.jobDescription.text.length > 1000,
  'original native duties are unavailable or criteria schema changed')
  for (const section of Object.values(sections)) {
    insist(typeof section.text === 'string', 'unqualified original native content')
    const doc = readNativeDocument(section.text), text = doc.text(doc.nodes(node => node.tag === 'root')[0])
    insist(norm(job.jobDescription).includes(norm(text)), 'original native criteria are missing from the extracted description')
  }
}

export async function qualifySixtPublicScope({ listPage, rows, jobs, readPage, signal }) {
  let requests = 0, bytes = 0
  const read = async url => {
    signal?.throwIfAborted()
    insist(++requests <= 40, 'public proof request bound exceeded')
    const page = await readPage(url)
    signal?.throwIfAborted()
    const size = typeof page.html === 'string' ? Buffer.byteLength(page.html) : Infinity
    bytes += size
    insist(page.status === 200 && page.url === url && size <= 2 * 1024 * 1024 && bytes <= 12 * 1024 * 1024,
      'public proof authority, response size or byte bound changed')
    return page
  }
  const readJSON = async url => JSON.parse((await read(url)).html)
  const inventory = readNativeInventory(await readJSON(results(1)), 1, rows)
  const terminal = readNativeInventory(await readJSON(results(2)), 2, rows)
  const independent = readSmartInventory(await readJSON(smart(0)), 0, inventory.items)
  const independentTerminal = readSmartInventory(await readJSON(smart(100)), 100, inventory.items)
  const profiles = []
  const qualifyPage = (page, url) => {
    const profile = describeSixtPublicPage(page, url, inventory)
    insist(reviewed.pages[url] === profile.sha256, 'official executable/navigation declarations changed: ' + url)
    profiles.push({ url, ...profile })
  }
  qualifyPage(listPage, SIXT_LIST)
  for (const url of pages) qualifyPage(await read(url), url)
  const qualifyClients = async () => {
    for (const url of clients.keys()) insist(sha((await read(url)).html) === reviewed.clients[url], 'current official client changed')
  }
  await qualifyClients()
  for (const item of inventory.items) {
    const id = item.posting_url.match(/\/SIXT\/(\d{15})-/)[1]
    const job = jobs.find(job => job.jobId === item.slug)
    insist(job, 'original detail was not extracted')
    qualifyOriginalCriteria(await readJSON('https://api.smartrecruiters.com/v1/companies/SIXT/postings/' + id), item, job)
  }
  for (const url of pages) qualifyPage(await read(url), url)
  await qualifyClients()
  const closing = readNativeInventory(await readJSON(results(1)), 1, rows)
  insist(equal(closing, inventory)
    && equal(readNativeInventory(await readJSON(results(2)), 2, rows), terminal)
    && equal(readSmartInventory(await readJSON(smart(0)), 0, inventory.items), independent)
    && equal(readSmartInventory(await readJSON(smart(100)), 100, inventory.items), independentTerminal), 'closing full native inventory models changed')
  qualifyPage(await read(SIXT_LIST), SIXT_LIST)
  return { complete: true, scope: 'current-official-public-India-recruitment-channels', requests, bytes,
    profiles, nativeIndiaRoles: inventory.items.length, independentNativeIndiaRoles: independent.content.length,
    originalCriteriaReconciled: jobs.length, closingModelsMatch: true,
    privateOrUnadvertisedLegalInventory: 'unknown', lifecycleCleanupAllowed: true }
}
