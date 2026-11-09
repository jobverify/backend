import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { readNativeDocument, extractActiveDescription, decodeNativeEntities } from './activeNativeHtml.js'
import { readVisibleNativeDocument } from './visibleNativeHtml.js'
import { attachInventoryEvidence } from './inventoryEvidence.js'

const PROOF = Symbol.for('jobverify.official-ats-discovery')
const ORIGIN = 'https://www.comeet.com'
const DATA_NAMES = new Set(['COMPANY_DATA', 'COMPANY_POSITIONS_DATA', 'POSITION_DATA'])
// This reviewed, unchanged widget initializer only copies company scalars and
// the role UID. It neither writes native records nor establishes job evidence.
const READONLY_WIDGET_SHA256 = 'fefc685eafc0f1799ef16912717e6030f3311c1880758329fc3bb8f3b118d723'
const uidPattern = /^[A-Z\d]{1,16}\.[A-Z\d]{1,32}$/i
const text = value => typeof value === 'string' && Boolean(value.trim())
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const same = (a, b) => canonical(a) === canonical(b)
const need = (condition, message) => {
  if (!condition) throw Object.assign(new Error('Comeet native: ' + message), {
    code: 'COMEET_NATIVE_CONTRACT', softFailure: true, abortRetries: true, failureKind: 'coverage_gap',
  })
}
function literal(node) {
  if (node?.type === 'Literal') {
    need(node.value === null || ['string', 'boolean'].includes(typeof node.value) || typeof node.value === 'number' && Number.isFinite(node.value), 'non-JSON native literal')
    return node.value
  }
  if (node?.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') return -literal(node.argument)
  if (node?.type === 'ArrayExpression') return node.elements.map(literal)
  if (node?.type === 'ObjectExpression') {
    const entries = [], keys = new Set()
    for (const property of node.properties) {
      need(property.type === 'Property' && property.kind === 'init' && !property.computed && !property.method && !property.shorthand, 'non-literal native data property')
      const key = property.key.type === 'Identifier' ? property.key.name : property.key.value
      need(typeof key === 'string' && !keys.has(key), 'duplicate native literal key')
      keys.add(key); entries.push([key, literal(property.value)])
    }
    return Object.fromEntries(entries)
  }
  need(false, 'native bootstrap contains a non-literal data expression')
}
const readonlyCountry = node => node?.type === 'Literal' || node?.type === 'Identifier' && node.name === 'COMPANY_DATA'
  || node?.type === 'MemberExpression' && !node.computed && node.object.type === 'Identifier' && node.object.name === 'COMPANY_DATA' && node.property.name === 'detected_country'
  || node?.type === 'LogicalExpression' && node.operator === '&&' && readonlyCountry(node.left) && readonlyCountry(node.right)
  || node?.type === 'ConditionalExpression' && readonlyCountry(node.test) && readonlyCountry(node.consequent) && readonlyCountry(node.alternate)
// https://mimesniff.spec.whatwg.org/#javascript-mime-type
const javascriptTypes = new Set(['application/ecmascript', 'application/javascript', 'application/x-ecmascript', 'application/x-javascript',
  'text/ecmascript', 'text/javascript', 'text/javascript1.0', 'text/javascript1.1', 'text/javascript1.2', 'text/javascript1.3',
  'text/javascript1.4', 'text/javascript1.5', 'text/jscript', 'text/livescript', 'text/x-ecmascript', 'text/x-javascript'])
function scriptBlockType(node) {
  const hasType = Object.hasOwn(node.attrs, 'type')
  const value = hasType ? node.attrs.type : node.attrs.language ? 'text/' + node.attrs.language : 'text/javascript'
  const normalized = value.toLowerCase()
  if (value === '' || javascriptTypes.has(normalized)
    || hasType && javascriptTypes.has(normalized.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, ''))) return 'classic'
  return normalized === 'module' ? 'module' : null
}
const classicScript = node => scriptBlockType(node) === 'classic' && !Object.hasOwn(node.attrs, 'nomodule')
function constantString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node?.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis.map(part => part.value.cooked ?? part.value.raw).join('')
  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    const left = constantString(node.left), right = constantString(node.right)
    if (left !== null && right !== null) return left + right
  }
  return null
}
function nativeDataReference(node) {
  if (!node || typeof node !== 'object') return false
  if (node.type === 'Identifier' && DATA_NAMES.has(node.name)) return true
  // Acorn resolves escaped identifiers/string literals. Check strings too so
  // window["POSITION_DATA"] and a literal eval/Function body cannot bypass the
  // native-global contract guard. No script is evaluated.
  const value = constantString(node) ?? (node.type === 'TemplateElement' ? node.value.cooked : null)
  if (typeof value === 'string' && /\b(?:COMPANY_DATA|COMPANY_POSITIONS_DATA|POSITION_DATA)\b/.test(value)) return true
  return Object.values(node).some(value => Array.isArray(value) ? value.some(nativeDataReference) : nativeDataReference(value))
}

// Parse the publisher's literal globals; never evaluate its bootstrap, client,
// questionnaire, application or tracking code.
function bootstrap(html, url) {
  const document = readNativeDocument(html)
  // The reader retains the complete tree under its root. Walk that tree for
  // execution contracts: hidden/style/inert attributes do not stop scripts.
  // Template contents and raw noscript/iframe fallback remain non-executable.
  const root = document.nodes(node => node.tag === 'root')[0]
  const walk = node => typeof node === 'string' || node.tag === 'template' ? [] : [node, ...node.children.flatMap(walk)]
  const nodes = walk(root)
  need(!nodes.filter(node => node.tag === 'base' && node.attrs.href && !['/', ORIGIN + '/'].includes(node.attrs.href)).length, 'unqualified native base URL')
  const scripts = nodes.filter(node => node.tag === 'script')
  const candidates = scripts.filter(node => !Object.hasOwn(node.attrs, 'src') && classicScript(node) && /\bCOMPANY_DATA\s*=/.test(node.raw || ''))
  const found = []
  for (const script of candidates) {
    let program
    try { program = parse(script.raw, { ecmaVersion: 'latest', sourceType: 'script' }) }
    catch { need(false, 'native literal bootstrap cannot be parsed') }
    const hasData = program.body.some(statement => statement.type === 'ExpressionStatement' && DATA_NAMES.has(statement.expression?.left?.name))
    if (!hasData) continue
    const values = {}, assigned = new Set(); let version = null
    for (const statement of program.body) {
      if (statement.type === 'EmptyStatement') continue
      if (statement.type === 'VariableDeclaration') {
        need(statement.kind === 'var', 'native bootstrap declaration contract changed')
        for (const declaration of statement.declarations) {
          need(declaration.id.type === 'Identifier', 'non-literal native bootstrap declaration')
          if (declaration.init) {
            need(declaration.id.name === 'serverVersion', 'unqualified native bootstrap initializer')
            version = literal(declaration.init)
          }
        }
        continue
      }
      const expression = statement.type === 'ExpressionStatement' ? statement.expression : null
      need(expression?.type === 'AssignmentExpression' && expression.operator === '=' && expression.left.type === 'Identifier', 'non-literal native bootstrap assignment')
      const name = expression.left.name
      if (name === 'DETECTED_COUNTRY') { need(readonlyCountry(expression.right), 'unqualified native bootstrap country expression'); continue }
      need(/^[A-Z_]+$/.test(name), 'unqualified native bootstrap assignment target')
      const value = literal(expression.right)
      if (DATA_NAMES.has(name)) {
        need(!assigned.has(name), 'duplicate native bootstrap data assignment')
        assigned.add(name); values[name] = value
      }
    }
    need(assigned.size === DATA_NAMES.size && typeof version === 'string' && /^rc-\d+(?:-\d+)*$/.test(version), 'native bootstrap data/version missing')
    found.push({ values, version, script })
  }
  need(found.length === 1, 'native literal bootstrap missing or ambiguous')
  for (const script of scripts) {
    if (script === found[0].script || Object.hasOwn(script.attrs, 'src')) continue
    const module = scriptBlockType(script) === 'module'
    if (!module && !classicScript(script)) continue
    if (createHash('sha256').update(script.raw || '').digest('hex') === READONLY_WIDGET_SHA256) continue
    let program
    try { program = parse(script.raw || '', { ecmaVersion: 'latest', sourceType: module ? 'module' : 'script' }) }
    catch { need(false, 'unqualified active native script cannot be parsed') }
    need(!nativeDataReference(program), 'unqualified active script references or mutates native data')
  }
  const clients = scripts.filter(node => node.attrs.src?.startsWith('/common/careers.js?'))
  need(clients.length === 1, 'advertised native client missing or ambiguous')
  need(classicScript(clients[0]) && !Object.hasOwn(clients[0].attrs, 'async') && !Object.hasOwn(clients[0].attrs, 'defer'), 'native client is not the qualified executable synchronous element')
  need(scripts.indexOf(found[0].script) < scripts.indexOf(clients[0]), 'native bootstrap must precede its executable client')
  const clientURL = new URL(clients[0].attrs.src, url)
  need(clientURL.origin === ORIGIN && clientURL.pathname === '/common/careers.js' && clientURL.search === '?' + found[0].version && !clientURL.hash, 'native client/version identity changed')
  return { ...found[0].values, clientURL: clientURL.href, version: found[0].version }
}
function positionURL(value, config, expectedUid) {
  let url
  try { url = new URL(value) } catch { need(false, 'native position URL identity missing') }
  const parts = url.pathname.split('/').filter(Boolean)
  need(url.origin === ORIGIN && !url.username && !url.password && !url.search && !url.hash
    && parts.length === 5 && parts[0] === 'jobs' && parts[1] === config.nativeSlug && parts[2] === config.nativeCompanyUid
    && uidPattern.test(parts[4]) && (!expectedUid || parts[4] === expectedUid), 'native position UID/account/URL identity mismatch')
  return { url: url.href, uid: parts[4] }
}
function corporate(html, config) {
  const document = readVisibleNativeDocument(html, { strict: true }), records = new Map()
  for (const node of document.nodes(node => node.tag === 'a' && node.attrs.href?.startsWith(ORIGIN + '/jobs/'))) {
    const parsed = positionURL(node.attrs.href, config)
    if (!records.has(parsed.uid)) records.set(parsed.uid, { ...parsed, texts: [] })
    records.get(parsed.uid).texts.push(document.text(node))
  }
  need(records.size > 0, 'current visible corporate native handoff/binding unavailable')
  return [...records.values()].sort((a, b) => a.uid.localeCompare(b.uid))
}
function company(data, config, accountURL) {
  const record = data.COMPANY_DATA
  need(record && typeof record === 'object' && !Array.isArray(record) && record.name === config.companyName
    && record.company_uid === config.nativeCompanyUid && record.slug === config.nativeSlug && record.url_comeet_hosted_page === accountURL, 'native company/employer identity mismatch')
  let website
  try { website = new URL(record.website) } catch { need(false, 'native reciprocal company website missing') }
  need(website.protocol === 'https:' && !website.username && !website.password && website.hostname.replace(/^www\./, '') === config.companyDomain.replace(/^www\./, ''), 'native reciprocal company identity mismatch')
  need(record.description == null || typeof record.description === 'string', 'native company description malformed')
  return { companyUid: record.company_uid, brand: record.name, slug: record.slug, website: record.website,
    accountURL, description: record.description ?? null }
}
const regions = new Intl.DisplayNames(['en'], { type: 'region' })
const countryNames = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = regions.of(code)
  if (name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) countryNames.set(name.toLowerCase(), code)
}
// Exact, qualified pairs only: city names and short state codes can occur in
// other countries. These pairs detect contradictions; they never infer India
// when the native country is missing or establish exhaustive geography.
const indiaCityStates = Object.fromEntries([
  ['mh|maharashtra', 'mumbai|navi mumbai|pune|nagpur|nashik|thane'],
  ['ka|karnataka', 'bangalore|bengaluru|mysore|mysuru|mangalore|mangaluru'],
  ['tn|tamil nadu', 'chennai|coimbatore|madurai'],
  ['tg|ts|telangana', 'hyderabad|secunderabad|warangal'],
  ['dl|delhi', 'delhi|new delhi'],
  ['hr|haryana', 'gurgaon|gurugram|faridabad'],
  ['up|uttar pradesh', 'noida|greater noida|lucknow|kanpur|ghaziabad'],
  ['gj|gujarat', 'ahmedabad|gandhinagar|vadodara|baroda|surat'],
  ['wb|west bengal', 'kolkata|calcutta'],
  ['kl|kerala', 'kochi|cochin|thiruvananthapuram|trivandrum'],
  ['rj|rajasthan', 'jaipur|udaipur'],
  ['mp|madhya pradesh', 'indore|bhopal'],
  ['od|or|odisha|orissa', 'bhubaneswar|cuttack'],
  ['pb|punjab', 'mohali|amritsar|ludhiana'],
  ['ch|chandigarh', 'chandigarh'],
  ['ap|andhra pradesh', 'visakhapatnam|vijayawada|tirupati'],
  ['br|bihar', 'patna'],
  ['cg|ct|chhattisgarh', 'raipur'],
  ['jh|jharkhand', 'ranchi|jamshedpur'],
  ['uk|ut|uttarakhand', 'dehradun'],
  ['hp|himachal pradesh', 'shimla'],
  ['ga|goa', 'panaji|panjim'],
  ['as|assam', 'guwahati|dispur'],
  ['ar|arunachal pradesh', 'itanagar'],
  ['mn|manipur', 'imphal'],
  ['ml|meghalaya', 'shillong'],
  ['mz|mizoram', 'aizawl'],
  ['nl|nagaland', 'kohima'],
  ['sk|sikkim', 'gangtok'],
  ['tr|tripura', 'agartala'],
  ['py|puducherry|pondicherry', 'puducherry|pondicherry'],
  ['jk|jammu and kashmir', 'jammu|srinagar'],
  ['la|ladakh', 'leh'],
  ['an|andaman and nicobar islands', 'port blair'],
].flatMap(([states, cities]) => cities.split('|').map(city => [city, states.split('|')])))
function location(record) {
  if (record == null) return { country: null, raw: null }
  need(typeof record === 'object' && !Array.isArray(record), 'native location malformed')
  for (const key of ['name', 'city', 'state', 'location_uid']) need(record[key] == null || typeof record[key] === 'string', 'native location field malformed')
  if (record.country == null || record.country === '') return { country: null, raw: record }
  need(typeof record.country === 'string' && /^[A-Z]{2}$/.test(record.country) && regions.of(record.country) !== record.country
    && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(record.country), 'native country code is invalid or unqualified')
  // Country comes at the end of the native display label. A middle component
  // such as Georgia is a state when the explicit country is United States.
  const tail = (record.name || '').split(/[,/|]/).at(-1).trim().replace(/^remote\s*[([]\s*([^\])]+)\s*[)\]]$/i, '$1').toLowerCase()
  const hint = countryNames.get(tail)
  need((!hint || hint === record.country) && (record.country === 'IN' || !/\bIndia\b/i.test(record.name || '')),
    'native country/location geography contradicts its explicit country')
  const city = (record.city || '').trim().toLowerCase(), state = (record.state || '').trim().toLowerCase().replace(/^in-/, '')
  need(!(record.country !== 'IN' && indiaCityStates[city]?.includes(state)), 'native country contradicts known India city/state geography')
  need(!(record.country === 'IN' && /\b(?:North America|South America|Latin America|Europe|EMEA|LATAM)\b/i.test(record.name || '') && !/\bIndia\b/i.test(record.name)), 'native India country conflicts with exclusive regional geography')
  return { country: record.country, raw: record }
}
function followingText(document, marker) {
  const parts = []; let after = false
  const visit = node => {
    if (typeof node === 'string') { if (after) parts.push(decodeNativeEntities(node)); return }
    if (node.inert || node.tag === 'script') return
    if (node === marker) { after = true; return }
    if (after) { parts.push(document.text(node)); return }
    node.children.forEach(visit)
  }
  visit(document.nodes(node => node.tag === 'root')[0])
  return parts.join(' ')
}
function sections(fields, companyDescription, roleHeading) {
  need(fields && typeof fields === 'object' && Array.isArray(fields.details) && Array.isArray(fields.categories), 'native content sections missing')
  for (const group of [fields.details, fields.categories]) {
    const orders = new Set()
    for (const field of group) {
      need(field && text(field.name) && Number.isSafeInteger(field.order) && !orders.has(field.order)
        && (field.value == null || typeof field.value === 'string'), 'native content field malformed or duplicate')
      orders.add(field.order)
    }
  }
  const core = fields.details.filter(field => /^description$/i.test(field.name.trim()))
  need(core.length === 1, 'native core description field missing/ambiguous')
  const normalize = value => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()
  const boilerplate = normalize(extractActiveDescription(companyDescription) || ''), heading = normalize(roleHeading)
  const document = readNativeDocument(core[0].value || '')
  const headings = document.nodes(node => /^(?:p|h[1-6])$/.test(node.tag) && normalize(document.text(node)) === heading)
  const section = headings.length === 1 ? normalize(followingText(document, headings[0])) : ''
  // Employer introductions are preserved in output, but cannot establish that
  // the role itself has a substantive description. Require the reviewed native
  // role section, excluding the separate introduction inside Description too.
  const roleContent = boilerplate ? section.split(boilerplate).join(' ').trim() : section
  return { complete: roleContent.length >= 100,
    raw: fields, semantic: { details: fields.details.map(field => ({ ...field, value: field.value ?? null })),
      categories: fields.categories.map(field => ({ ...field, value: field.value ?? null })) } }
}
function posting(raw, config, companyDescription) {
  need(raw && typeof raw === 'object' && !Array.isArray(raw) && uidPattern.test(raw.uid || '') && text(raw.name)
    && raw.company_name === config.companyName, 'native position identity/company missing')
  need(raw.is_internal === false, 'native account contains an internal/private rather than public posting')
  for (const key of ['is_closed', 'is_archived', 'is_deleted']) need(raw[key] == null || raw[key] === false, 'native posting is unavailable')
  for (const key of ['is_active', 'is_published']) need(raw[key] == null || raw[key] === true, 'native posting is inactive')
  need(!Object.keys(raw).some(key => /^(?:date_?posted|published_?at|published_?on|time_published|posting_?date)$/i.test(key) && raw[key] != null), 'native publication contract changed; qualify original publication before mapping')
  const identity = positionURL(raw.url_comeet_hosted_page, config, raw.uid), geographic = location(raw.location), content = sections(raw.custom_fields, companyDescription, config.nativeRoleDescriptionHeading)
  need(geographic.country == null || content.complete, 'located native posting lacks substantive role description/content')
  need(raw.time_updated == null || typeof raw.time_updated === 'string' && Number.isFinite(Date.parse(raw.time_updated)), 'native revision metadata malformed')
  const fields = { uid: raw.uid, name: raw.name, company_name: raw.company_name, department: raw.department ?? null,
    employment_type: raw.employment_type ?? null, experience_level: raw.experience_level ?? null,
    location: raw.location ?? null, url_comeet_hosted_page: identity.url, time_updated: raw.time_updated ?? null,
    is_internal: raw.is_internal, workplace_type: raw.workplace_type ?? null, custom_fields: content.semantic }
  return { uid: raw.uid, url: identity.url, country: geographic.country, contentComplete: content.complete,
    sections: content.raw, fields }
}

export const createEmployerBoundComeetScraper = config => ({
  async run({ signal: callerSignal, now = () => new Date().toISOString(), maxJobs = 0, maxNativeRecords = 1000 } = {}) {
    need(text(config?.source) && text(config.companyName) && text(config.companyDomain) && uidPattern.test(config.nativeCompanyUid || '')
      && /^[a-z\d-]+$/.test(config.nativeSlug || '') && /^[a-f\d]{64}$/.test(config.nativeClientSHA256 || '')
      && text(config.nativeRoleDescriptionHeading), 'qualified source/native contract configuration required')
    need(Number.isSafeInteger(maxJobs) && maxJobs >= 0 && Number.isSafeInteger(maxNativeRecords) && maxNativeRecords >= 1 && maxNativeRecords <= 1000, 'invalid native output/record bounds')
    const checkedAt = typeof now === 'function' ? now() : now
    need(typeof checkedAt === 'string' && Number.isFinite(Date.parse(checkedAt)), 'invalid native check time')
    const signal = AbortSignal.any([...(callerSignal ? [callerSignal] : []), AbortSignal.timeout(180000)])
    const accountURL = ORIGIN + '/jobs/' + config.nativeSlug + '/' + config.nativeCompanyUid
    let requests = 0, totalBytes = 0
    async function get(url, javascript = false) {
      signal.throwIfAborted(); need(++requests <= 2500, 'native request bound exceeded')
      const response = await fetch(url, { method: 'GET', redirect: 'error', credentials: 'omit', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
        headers: { Accept: javascript ? 'application/javascript,text/javascript' : 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)' } })
      need(response.status === 200, 'HTTP unavailable: ' + response.status)
      need(response.url === url, 'native HTTP redirect identity changed')
      need((javascript ? /^(?:application|text)\/(?:javascript|x-javascript)/i : /^text\/html\b/i).test(response.headers.get('content-type') || ''), 'native response content type changed')
      const reader = response.body?.getReader(), chunks = []; let bytes = 0
      need(reader, 'native response body missing')
      try {
        for (;;) {
          signal.throwIfAborted()
          const { value, done } = await reader.read(); if (done) break
          bytes += value.byteLength; totalBytes += value.byteLength
          need(bytes <= 3 * 1024 * 1024 && totalBytes <= 32 * 1024 * 1024, 'native response byte bound exceeded')
          chunks.push(value)
        }
      } catch (error) { await reader.cancel().catch(() => {}); throw error }
      finally { reader.releaseLock() }
      signal.throwIfAborted(); need(bytes > 0, 'native response body empty')
      return Buffer.concat(chunks).toString('utf8')
    }
    async function snapshot() {
      const links = corporate(await get(config.careersUrl), config), data = bootstrap(await get(accountURL), accountURL)
      const employer = company(data, config, accountURL)
      need(data.POSITION_DATA === null && Array.isArray(data.COMPANY_POSITIONS_DATA), 'native company list/route inventory missing')
      need(data.COMPANY_POSITIONS_DATA.length <= maxNativeRecords, 'native record bound would leave an incomplete inventory')
      const listing = data.COMPANY_POSITIONS_DATA.map(record => posting(record, config, employer.description)), ids = new Set(listing.map(record => record.uid))
      need(ids.size === listing.length, 'duplicate native position UID identity')
      const officeCountries = new Map()
      for (const record of listing) {
        const office = record.fields.location?.location_uid
        if (office && record.country) {
          need(!officeCountries.has(office) || officeCountries.get(office) === record.country, 'native location UID has conflicting country geography')
          officeCountries.set(office, record.country)
        }
      }
      need(links.every(link => ids.has(link.uid) && link.texts.some(value => value === listing.find(record => record.uid === link.uid).fields.name)), 'current corporate handoff and native list identities differ')
      const client = await get(data.clientURL, true)
      need(createHash('sha256').update(client).digest('hex') === config.nativeClientSHA256, 'current advertised native client contract changed')
      const records = []
      for (const record of listing) {
        const detailData = bootstrap(await get(record.url), record.url), detailEmployer = company(detailData, config, accountURL)
        need(detailData.COMPANY_POSITIONS_DATA === null && detailData.clientURL === data.clientURL && same(employer, detailEmployer), 'native detail/company/client identity changed')
        const detail = posting(detailData.POSITION_DATA, config, detailEmployer.description)
        need(same(record.fields, detail.fields), 'native position identity/location/content changed between list and detail')
        records.push(detail)
      }
      return { employer, links, clientURL: data.clientURL, records: records.sort((a, b) => a.uid.localeCompare(b.uid)) }
    }
    const initial = await snapshot(), closing = await snapshot()
    need(same(initial, closing), 'current corporate/native inventory/content changed during closing reconciliation')
    const india = initial.records.filter(record => record.country === 'IN')
    const jobs = (maxJobs ? india.slice(0, maxJobs) : india).map(record => {
      const fields = record.fields, location = fields.location, groups = [...record.sections.details, ...record.sections.categories]
      const description = [initial.employer.description, ...groups.filter(field => text(field.value)).map(field => field.name + '\n' + field.value)].filter(text).join('\n\n')
      return { source: config.source, company: config.companyName, jobId: record.uid, requisitionId: null, title: fields.name,
        companyCareerPage: config.careersUrl, companyDomain: config.companyDomain, country: 'India', city: location.city ?? null,
        state: location.state ?? null, location: location.name || [location.city, location.state, 'India'].filter(Boolean).join(', '),
        sourceUrl: record.url, applyUrl: record.url, link: record.url, sourceDescription: description, jobDescription: description,
        nativeDescriptionSections: record.sections.details, nativeCustomFields: record.sections, nativeCompanyDescription: initial.employer.description,
        nativeLocation: location, nativeUpdatedAt: fields.time_updated, nativePublicationDate: null, postingDate: null,
        nativeEmployerBrand: initial.employer.brand, nativeLegalEmployer: null,
        nativeCompanyEvidence: initial.employer, nativePosition: fields, employmentType: fields.employment_type,
        nativeExperienceLevel: fields.experience_level, remoteStatus: fields.workplace_type, sourceDetailComplete: true,
        sourcePostingStatusEvidence: 'current-native-company-list-member+explicit-not-internal+matching-native-detail-and-client',
        applicationVisited: false, applicationSubmitted: false, sourceListingComplete: false, sourceScopeComplete: false,
        lifecycleCleanupAllowed: false, scrapedAt: checkedAt }
    })
    signal.throwIfAborted()
    Object.defineProperty(jobs, PROOF, { value: { source: config.source,
      binding: { officialURL: config.careersUrl, nativeCompanyUid: config.nativeCompanyUid, nativeSlug: config.nativeSlug,
        nativeCompanyURL: accountURL, matchedRoleIds: initial.links.map(link => link.uid) },
      nativeInventory: { observedNativePostings: initial.records.length, locatedRolesWithFullContent: initial.records.filter(record => record.country && record.contentComplete).length,
        unresolvedCountryPostings: initial.records.filter(record => !record.country).map(record => record.uid),
        incompleteContentPostings: initial.records.filter(record => !record.contentComplete).map(record => record.uid), selectedIndiaPostings: india.length, snapshots: 2 } } })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: accountURL, firstParty: true, listingComplete: false,
      pagesFetched: 2, reportedTotal: null, indiaFacetCount: null, verifiedAt: checkedAt,
      reason: 'current-corporate-bound-native-literal-company-list-public-identities-client-and-details-closing-reconciled;unlocated-and-short-native-postings-remain-unresolved;native-publication-unknown;whole-company-scope-unverified' })
  },
})
