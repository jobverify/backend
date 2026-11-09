import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { readNativeDocument, decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { recruitmentEmployerMatches, recruitmentJobPostings } from '../../scraper-support/utils/verifiedRecruitment.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { isRecruitmentIntakeTitle } from '../../scraper-support/utils/recruitmentObservationAccounting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'

const CAREERS = 'https://www.synchronycareers.com/'
const SEARCH = CAREERS + 'search-jobs'
const CLIENT = 'https://tbcdn.talentbrew.com/js/client/search.js'
const CLIENT_SHA256 = 'f58913158b9aa603a2a21969c4533ae9023d26ff6699d5ac505ef9d469bd85dd'
const POST = SEARCH + '/resultspost'
const OBSERVATIONS = Symbol.for('jobverify.verified-recruitment-observations')
const sha = value => createHash('sha256').update(value).digest('hex')
const nativeFields = new Set(['@context', '@type', 'baseSalary', 'datePosted', 'description', 'identifier', 'title', 'url',
  'directApply', 'hiringOrganization', 'jobLocation', 'validThrough'])
const placeFields = new Set(['@type', 'address'])
const addressFields = new Set(['@type', 'addressLocality', 'addressRegion', 'addressCountry', 'streetAddress', 'postalCode'])
const countryFields = new Set(['@type', 'name', 'descriptor', 'alpha2Code'])
const employerFields = new Set(['@type', 'name'])
const nonempty = value => value != null && (typeof value === 'string' ? value.trim().length > 0
  : Array.isArray(value) ? value.length > 0 : typeof value === 'object' ? Object.keys(value).length > 0 : true)
const fieldsQualified = (value, allowed, path, issues) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { issues.push(path + ':missing-or-unsupported-object'); return false }
  for (const [name, field] of Object.entries(value)) if (!allowed.has(name) && nonempty(field)) issues.push(path + '.' + name + ':unreviewed-nonempty-carrier')
  return true
}
const calendarDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const need = (value, message) => {
  if (!value) throw Object.assign(new Error("Synchrony native: " + message), {
    softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap', abortRetries: true, lifecycleCleanupAllowed: false,
  })
}
const one = (values, name) => { need(values.length === 1, 'ambiguous or missing ' + name); return values[0] }
const absolute = (value, base) => new URL(value, base).href
// Injected transports and readers need not honor their signal. Keep caller and
// deadline cancellation independent of those callbacks, including late headers.
const cancelWithoutWaiting = cancel => {
  try { Promise.resolve(cancel()).catch(() => {}) } catch { /* Cleanup cannot replace the original result. */ }
}
const abortable = (signal, operation, lateValue) => {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    let settled = false
    const stop = () => {
      if (settled) return
      settled = true; signal.removeEventListener('abort', stop); reject(signal.reason)
    }
    signal.addEventListener('abort', stop, { once: true })
    Promise.resolve().then(() => { signal.throwIfAborted(); return operation() }).then(value => {
      if (settled || signal.aborted) {
        if (lateValue) cancelWithoutWaiting(() => lateValue(value))
        stop(); return
      }
      settled = true; signal.removeEventListener('abort', stop); resolve(value)
    }, error => {
      if (settled) return
      settled = true; signal.removeEventListener('abort', stop); reject(signal.aborted ? signal.reason : error)
    })
  })
}
const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return
  visit(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visit))
    else if (value && typeof value === 'object') walk(value, visit)
  }
}
const dataset = node => Object.fromEntries(Object.entries(node.attrs).filter(([name]) => name.startsWith('data-')).map(([name, value]) => {
  const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
  if (value === 'true') value = true
  else if (value === 'false') value = false
  else if (value === 'null') value = null
  else if (value && String(Number(value)) === value) value = Number(value)
  else if (/^[\[{]/.test(value)) { try { value = JSON.parse(value) } catch { /* Preserve a literal string. */ } }
  return [key, value]
}))

// Interpret only the pinned publisher's literal defaults and DOM-field mapping.
// No publisher program, event handler, eval(), or request is executed here.
export function deriveSynchronySearchProfile(html, client) {
  need(sha(client) === CLIENT_SHA256, 'current search client changed; static contract review required')
  const document = readNativeDocument(html)
  need(!document.nodes(node => node.tag === 'base').length, 'unreviewed search document base')
  need(document.nodes(node => node.tag === 'script' && node.attrs.src && absolute(node.attrs.src, SEARCH) === CLIENT).length === 1,
    'current search client is not actively declared')
  for (const [name, value] of [['Pe_TenantId', '49398'], ['Pe_OrganizationId', '49398'], ['Pe_SiteHost', 'www.synchronycareers.com']]) {
    need(one(document.nodes(node => node.tag === 'input' && node.attrs.id === name), name).attrs.value === value,
      'current native search account changed')
  }
  const results = one(document.nodes(node => node.attrs.id === 'search-results'), 'native results envelope')
  const filters = one(document.nodes(node => node.attrs.id === 'search-filters'), 'native filters envelope')
  const facet = one(document.nodes(node => node.tag === 'input' && node.attrs['data-facet-type'] === '2'
    && node.attrs['data-display'] === 'India'), 'native India country facet')
  need(facet.attrs['data-id'] === '1269750', 'native India country identity changed')
  const total = Number(facet.attrs['data-count']), pageSize = Number(results.attrs['data-records-per-page'])
  need(Number.isSafeInteger(total) && total >= 0 && total <= 200 && Number.isSafeInteger(pageSize) && pageSize > 0 && pageSize <= 100,
    'native country inventory exceeds its reviewed bounds')
  need(absolute(results.attrs['data-ajax-post-url'], SEARCH) === POST
    && absolute(results.attrs['data-ajax-url'], SEARCH) === SEARCH + '/results', 'native listing endpoint changed')
  need(!document.nodes(node => document.hasClass(node, 'filter-checkbox') && Object.hasOwn(node.attrs, 'checked')).length,
    'unreviewed initial static or selected filters')

  const program = parse(client, { ecmaVersion: 'latest' }), declarations = new Map(), mappings = []
  walk(program, node => {
    if (node.type === 'VariableDeclarator' && ['SearchResultTypes', 'defaultValues'].includes(node.id?.name)) {
      need(!declarations.has(node.id.name), 'duplicate native client defaults'); declarations.set(node.id.name, node.init)
    }
    if (node.type === 'AssignmentExpression' && node.operator === '=' && node.left?.name === 'searchOptions'
      && node.right.type === 'ObjectExpression' && node.right.properties.some(property => property.key?.name === 'ActiveFacetID')) mappings.push(node.right)
  })
  const constants = {}
  const literal = node => {
    if (node?.type === 'Literal' && !node.regex) return node.value
    if (node?.type === 'ArrayExpression') return node.elements.map(literal)
    if (node?.type === 'MemberExpression' && !node.computed && node.object?.name === 'SearchResultTypes') return constants.SearchResultTypes[node.property.name]
    need(node?.type === 'ObjectExpression', 'nonliteral native default')
    const value = {}
    for (const property of node.properties) {
      need(property.type === 'Property' && !property.computed && property.kind === 'init' && !property.method, 'nonliteral native default property')
      const name = property.key.name ?? property.key.value
      need(!['__proto__', 'constructor', 'prototype'].includes(name) && !Object.hasOwn(value, name), 'invalid native default property')
      value[name] = literal(property.value)
    }
    return value
  }
  constants.SearchResultTypes = literal(declarations.get('SearchResultTypes'))
  const defaults = literal(declarations.get('defaultValues'))
  const objects = { query: dataset(results), filterQuery: dataset(filters) }
  const selected = [{ ID: Number(facet.attrs['data-id']), FacetType: 2, Count: total, Display: 'India', IsApplied: true,
    FieldName: facet.attrs['data-field-name'] }]
  const expression = node => {
    if (node.type === 'Literal') return node.value
    if (node.type === 'ConditionalExpression') {
      const guard = node.test
      need(guard.type === 'BinaryExpression' && guard.operator === '!=' && guard.left.type === 'UnaryExpression'
        && guard.left.operator === 'typeof' && guard.left.argument.name === 'filterQuery' && guard.right.value === 'undefined',
      'unsupported native conditional mapping')
      return expression(node.consequent)
    }
    if (node.type === 'MemberExpression' && !node.computed && Object.hasOwn(objects, node.object?.name)) return objects[node.object.name][node.property.name]
    need(node.type === 'CallExpression', 'unsupported native DOM mapping')
    if (node.callee.type === 'Identifier') {
      const method = node.callee.name
      if (method === 'facetFilters') return selected
      if (method === 'staticFacets') return null
      if (method === 'appliedKeywordFilters') {
        need(Array.isArray(objects.query.refinedKeywords) && objects.query.refinedKeywords.length === 0, 'unreviewed initial keywords')
        return []
      }
      need(['intOrDefault', 'stringOrDefault', 'floatOrDefault'].includes(method), 'unsupported native conversion')
      const object = objects[node.arguments[0]?.name], property = node.arguments[1]?.value
      need(object && typeof property === 'string', 'invalid native conversion fields')
      const value = object[property], fallback = defaults[property[0].toUpperCase() + property.slice(1)]
      if (method === 'intOrDefault') return value === undefined || Number.isNaN(parseInt(value)) ? fallback : parseInt(value)
      if (method === 'floatOrDefault') return value === undefined || Number.isNaN(parseFloat(value)) ? fallback : parseFloat(value).toFixed(5)
      return value === undefined || value.length <= 0 ? fallback : value.toString()
    }
    need(node.callee.type === 'MemberExpression' && node.callee.property.name === 'attr'
      && node.callee.object.type === 'CallExpression' && node.callee.object.callee.name === '$', 'unsupported native attribute mapping')
    const selector = node.callee.object.arguments[0]
    need(selector.type === 'MemberExpression' && selector.object.name === 'ids' && selector.property.name === 'filterPanel'
      && node.arguments[0].type === 'Literal', 'unexpected native attribute carrier')
    return filters.attrs[node.arguments[0].value]
  }
  const options = {}
  for (const property of one(mappings, 'native DOM mapping').properties) {
    need(property.type === 'Property' && !property.computed && property.kind === 'init', 'unexpected native mapping property')
    options[property.key.name] = expression(property.value)
  }
  options.TotalContentPages = Math.ceil(options.TotalContentResults / options.RecordsPerPage)
  const criteria = Object.fromEntries(Object.entries(options).filter(([name]) => !['TotalPages', 'TotalResults', 'StaticFacets'].includes(name)))
  criteria.ActiveFacetID = selected[0].ID
  criteria.FacetFilters = selected
  criteria.CurrentPage = 1
  const model = JSON.parse(JSON.stringify(criteria))
  need(model.Keywords === '' && model.Location === '' && model.RecordsPerPage === pageSize, 'unreviewed native initial search')
  return { total, pageSize, pages: Math.ceil(total / pageSize), model, clientSHA256: CLIENT_SHA256 }
}

export async function runSynchronyTalentbrewInventory(provider, options = {}) {
  options.signal?.throwIfAborted()
  need(!options.fetchText && !options.fetchPage && !options.maxJobs, 'unsupported legacy transport or inventory cap')
  const sourceTimeoutMs = options.sourceTimeoutMs ?? 180000
  need(Number.isSafeInteger(sourceTimeoutMs) && sourceTimeoutMs > 0 && sourceTimeoutMs <= 180000, 'aggregate timeout exceeds its reviewed bound')
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(sourceTimeoutMs)])
  const observedAt = options.now ? options.now() : new Date().toISOString()
  need(Number.isFinite(Date.parse(observedAt)), 'invalid observation time')
  const fetchImpl = options.fetchImpl || fetch, receipts = [], declaredRoles = new Set()
  let totalBytes = 0
  const httpFailure = receipt => {
    const safeURL = value => {
      try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? (url.origin + url.pathname).slice(0, 500) : null } catch { return null }
    }
    const safeReceipts = receipts.map(row => ({ requestedURL: safeURL(row.requestedURL), method: row.method, status: row.status,
      finalURL: safeURL(row.finalURL), bodySHA256: row.bodySHA256, bodyBytes: row.bodyBytes,
      contentType: row.contentType?.slice(0, 150).match(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+/i)?.[0] || null }))
    const requestUrl = safeURL(receipt.requestedURL)
    const cause = Object.assign(new Error('Native HTTP ' + receipt.status + ' at ' + requestUrl), { status: receipt.status, requestUrl })
    const observations = { source: provider.source, observedAt, requestCount: receipts.length, nativeRecords: declaredRoles.size,
      returnedIndiaJobs: 0, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      unresolved: ['native-http-response-unavailable'], receipts: safeReceipts,
      failures: [{ stage: 'native-http', status: receipt.status, requestUrl, message: cause.message }] }
    return Object.assign(new Error("Synchrony native: HTTP " + receipt.status + ' at ' + requestUrl, { cause }),
      classifyScraperError(cause), { status: receipt.status, requestUrl, abortRetries: true, lifecycleCleanupAllowed: false,
        recruitmentObservations: observations })
  }
  const read = async (initialURL, init = {}) => {
    let url = initialURL
    for (let hop = 0; hop < 2; hop++) {
      signal.throwIfAborted()
      need(receipts.length < 256, 'native request bound reached')
      need([CAREERS, SEARCH, CLIENT, POST].includes(url) || declaredRoles.has(url), 'undeclared native request')
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20000)])
      const response = await abortable(requestSignal, () => fetchImpl(url, { ...init, redirect: 'manual', signal: requestSignal,
        headers: { Accept: 'application/json,text/html,application/javascript', ...init.headers } }), response => response?.body?.cancel())
      const chunks = [], reader = response.body?.getReader()
      need(reader, 'missing native response stream')
      let bytes = 0
      try {
        for (;;) {
          const part = await abortable(requestSignal, () => reader.read()); requestSignal.throwIfAborted(); if (part.done) break
          bytes += part.value.byteLength; totalBytes += part.value.byteLength
          need(bytes <= 4000000 && totalBytes <= 64000000, 'native response body bound reached')
          chunks.push(Buffer.from(part.value))
        }
      } finally {
        cancelWithoutWaiting(() => reader.cancel())
        try { reader.releaseLock() } catch { /* A transport may retain its pending read after cancellation. */ }
      }
      requestSignal.throwIfAborted()
      const body = Buffer.concat(chunks), location = response.headers.get('location')
      const receipt = { requestedURL: url, method: init.method || 'GET', requestBody: init.body || null, status: response.status,
        finalURL: response.url, bodySHA256: sha(body), bodyBytes: body.length, contentType: response.headers.get('content-type') }
      receipts.push(receipt)
      if (response.status !== 200) throw httpFailure(receipt)
      need(response.url === url, 'native HTTP final URL identity changed')
      return { url, body, html: body.toString('utf8'), receipt }
    }
    need(false, 'native redirect bound exceeded')
  }
  const publisher = async () => {
    const home = await read(CAREERS), homeDoc = readNativeDocument(home.html)
    need(homeDoc.nodes(node => node.tag === 'title' && clean(decodeNativeEntities(node.raw || '')) === 'Working at Synchrony Financial').length === 1
      && !homeDoc.nodes(node => node.tag === 'base').length
      && homeDoc.nodes(node => node.tag === 'a' && node.attrs.href && absolute(node.attrs.href, CAREERS) === SEARCH).length > 0,
      'current named publisher and careers search handoff unavailable')
    const search = await read(SEARCH), client = await read(CLIENT)
    return deriveSynchronySearchProfile(search.html, client.html)
  }
  const profile = await publisher()
  need(profile.pages <= 16, 'native pagination bound exceeded')
  const listing = async page => {
    const body = JSON.stringify({ ...profile.model, CurrentPage: page, IsPagination: page === 1 ? 'False' : 'True' })
    const reply = await read(POST, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    const payload = JSON.parse(reply.html)
    need(payload && typeof payload.results === 'string' && typeof payload.filters === 'string'
      && payload.hasJobs === (profile.total > 0) && payload.hasContent === false, 'native listing envelope changed')
    const document = readNativeDocument(payload.results), filters = readNativeDocument(payload.filters)
    const envelope = one(document.nodes(node => node.attrs.id === 'search-results'), 'selected results envelope').attrs
    need(Number(envelope['data-total-results']) === profile.total && Number(envelope['data-total-job-results']) === profile.total
      && Number(envelope['data-total-pages']) === profile.pages && Number(envelope['data-current-page']) === page
      && Number(envelope['data-records-per-page']) === profile.pageSize && envelope['data-active-facet-id'] === '1269750', 'native selected total or pagination changed')
    const facet = one(filters.nodes(node => node.tag === 'input' && node.attrs['data-facet-type'] === '2'
      && node.attrs['data-id'] === '1269750' && node.attrs['data-display'] === 'India'), 'selected country facet')
    need(Object.hasOwn(facet.attrs, 'checked') && Number(facet.attrs['data-count']) === profile.total, 'native selected country filter changed')
    const entries = document.nodes(node => node.tag === 'a' && node.attrs['data-job-id']).map(node => {
      const url = new URL(node.attrs.href, SEARCH), publishedId = node.attrs['data-job-id'], title = clean(document.text(node))
      need(url.origin === new URL(CAREERS).origin && !url.search && !url.hash
        && /^\/job\/[^/]+\/[^/]+\/49398\/\d+$/.test(url.pathname)
        && url.pathname.split('/').at(-1) === publishedId && /^\d+$/.test(publishedId) && title, 'native publication identity changed')
      return { url: url.href, publishedId, title }
    })
    need(entries.length === Math.min(profile.pageSize, profile.total - (page - 1) * profile.pageSize), 'native selected page length changed')
    return entries
  }
  const pages = [], identities = new Set()
  for (let page = 1; page <= profile.pages; page++) {
    const entries = await listing(page)
    for (const entry of entries) { need(!identities.has(entry.publishedId), 'duplicate native publication identity'); identities.add(entry.publishedId); declaredRoles.add(entry.url) }
    pages.push(entries)
  }
  need(identities.size === profile.total, 'native selected inventory did not reconcile')
  const qualify = async (entry, phase = 'opening') => {
    const reply = await read(entry.url), document = readNativeDocument(reply.html)
    const native = one(recruitmentJobPostings(document), 'own full native role')
    need(native.url === entry.url && clean(native.title) === entry.title && typeof native.identifier?.value === 'string'
      && native.identifier.value.trim() && typeof native.description === 'string', 'native listing/full-role identity changed')
    need(Object.keys(native).every(name => nativeFields.has(name)), 'unreviewed native authority or lifecycle carrier')
    need(calendarDate(native.datePosted), 'native calendar posting date unavailable')
    const sections = document.nodes(node => node.tag === 'section' && node.attrs['data-selector-name'] === 'jobdetails')
    need(sections.length === 2 && sections.every(node => node.attrs['data-org-id'] === '49398'
      && node.attrs['data-job-id'] === entry.publishedId)
      && sections.filter(node => node.attrs.id === 'ajd-header').length === 1,
      phase + ' native AJD section identity changed')
    const section = one(sections.filter(node => node.attrs.id === 'anchor-responsibilities'), phase + ' own full native role section')
    const description = one(document.nodes(node => node.tag === 'div' && document.hasClass(node, 'ats-description'), section),
      phase + ' full native role criteria')
    const fullCriteria = clean(extractActiveDescription(native.description))
    need(fullCriteria.length >= 100 && clean(document.text(description)) === fullCriteria,
      phase + ' full native role criteria differ from the active description')
    const applications = sections.flatMap(owner => document.nodes(node => node.tag === 'a' && node.attrs['data-selector-name'] === 'job-apply-link', owner))
    need(applications.length > 0, phase + ' native application context unavailable')
    const applicationURLs = new Set()
    for (const application of applications) {
      need(application.attrs['data-job-id'] === entry.publishedId && application.attrs['data-job-organization-id'] === '49398'
        && application.attrs.href === application.attrs['data-apply-url'], phase + ' native application role identity changed')
      const url = new URL(application.attrs.href)
      // This is the exact Workday application context published on this role;
      // no application page is visited and no URL is repaired or synthesized.
      need(url.origin === 'https://synchronyfinancial.wd5.myworkdayjobs.com'
        && !url.username && !url.password && !url.search && !url.hash
        && /^\/careers\/job\/[^/]+\/[^/]+\/apply$/.test(url.pathname), phase + ' native application account or handoff changed')
      const slug = url.pathname.split('/').at(-2), nativeId = native.identifier.value
      need(/^\d+$/.test(nativeId) && new RegExp('_' + nativeId + '(?:-\\d+)?$').test(slug),
        phase + ' native application requisition identity changed')
      applicationURLs.add(url.href)
    }
    need(applicationURLs.size === 1, phase + ' ambiguous native application context')
    const header = one(sections.filter(node => node.attrs.id === 'ajd-header'), phase + ' native role title section')
    need(clean(document.text(one(document.nodes(node => node.tag === 'h1', header), phase + ' native role title'))) === entry.title
      && !document.nodes(node => node.tag === 'base').length, phase + ' native visible role identity changed')
    // A status must be an affirmative, complete notice within this role's own
    // AJD context. Navigation/footer prose and company-overview narratives do
    // not determine this position's status. Raw HTML and criteria remain intact.
    const notices = [...new Set(sections.flatMap(owner => document.nodes(node => ['p', 'div', 'span'].includes(node.tag), owner))
      .map(node => clean(document.text(node))).filter(value => value.length <= 160))]
    const heldNotices = notices.filter(value => /^(?:this (?:job|position|requisition) (?:is|has been) (?:placed )?on hold|hiring for this (?:job|position|requisition) (?:is|has been) paused)[.!]?$/i.test(value))
    const closedNotices = notices.filter(value => /^(?:this (?:job|position|requisition) (?:is no longer (?:available|active)|(?:has been|is) (?:filled|closed))|(?:this )?position (?:has been|is) filled)[.!]?$/i.test(value))
    const countryIssues = [], employerIssues = []
    const typedCountry = (value, path, depth = 0) => {
      if (Array.isArray(value)) {
        if (depth >= 1 || value.length !== 1) { countryIssues.push(path + ':unsupported-country-array'); return null }
        return typedCountry(value[0], path + '[0]', depth + 1)
      }
      if (typeof value === 'string') {
        const country = nativeCountryName(value)
        if (!country) countryIssues.push(path + ':unknown-or-empty-country-label')
        return country
      }
      if (!fieldsQualified(value, countryFields, path, countryIssues)) return null
      if (nonempty(value['@type']) && value['@type'] !== 'Country') countryIssues.push(path + '.@type:unsupported-country-type')
      const countries = new Set()
      for (const name of ['name', 'descriptor', 'alpha2Code']) {
        const label = value[name]
        if (!nonempty(label)) continue
        const country = typeof label === 'string' ? nativeCountryName(label) : null
        if (!country) countryIssues.push(path + '.' + name + ':unknown-or-unsupported-country-label')
        else countries.add(country)
      }
      need(countries.size <= 1, phase + ' contradictory native country labels')
      if (!countries.size) countryIssues.push(path + ':native-country-label-unavailable')
      return [...countries][0] || null
    }
    // Validate every published location before selecting India. An addressless
    // Place or an additional nonempty authority carrier must remain in the raw
    // exclusion audit, never disappear through map(address).filter(Boolean).
    const places = Array.isArray(native.jobLocation) ? native.jobLocation : [native.jobLocation]
    if (!places.length) countryIssues.push('jobLocation:empty-native-locations')
    const locations = places.map((place, index) => {
      const path = 'jobLocation[' + index + ']'
      if (!fieldsQualified(place, placeFields, path, countryIssues)) return { address: null, country: null }
      if (place['@type'] !== 'Place') countryIssues.push(path + '.@type:unsupported-native-place-type')
      const address = place.address
      if (!fieldsQualified(address, addressFields, path + '.address', countryIssues)) return { address: null, country: null }
      if (address['@type'] !== 'PostalAddress') countryIssues.push(path + '.address.@type:unsupported-native-address-type')
      for (const name of ['addressLocality', 'addressRegion', 'streetAddress', 'postalCode'])
        if (nonempty(address[name]) && typeof address[name] !== 'string') countryIssues.push(path + '.address.' + name + ':unsupported-native-address-field')
      return { address, country: typedCountry(address.addressCountry, path + '.address.addressCountry') }
    })
    const india = locations.filter(row => row.country === 'India').map(row => row.address)
    if (fieldsQualified(native.hiringOrganization, employerFields, 'hiringOrganization', employerIssues)) {
      if (native.hiringOrganization['@type'] !== 'Organization') employerIssues.push('hiringOrganization.@type:unsupported-native-employer-type')
      if (typeof native.hiringOrganization.name !== 'string') employerIssues.push('hiringOrganization.name:unsupported-native-employer-name')
    }
    need(native.validThrough == null || calendarDate(native.validThrough),
      phase + ' invalid native closing date')
    const expired = native.validThrough && Date.parse(native.validThrough) < Date.parse(observedAt)
    const reason = heldNotices.length ? 'native-role-on-hold' : closedNotices.length ? 'native-role-closed'
      : expired ? 'native-role-expired' : employerIssues.length ? 'native-employer-authority-unqualified'
      : countryIssues.length ? 'native-country-authority-unqualified' : !recruitmentEmployerMatches({ ...provider, requireNativeEmployerName: true }, native.hiringOrganization?.name)
        ? 'native-employer-mismatch' : (!india.length || india.length !== locations.length) ? 'native-country-not-explicit-india'
          : isRecruitmentIntakeTitle(native.title) ? 'native-generic-intake' : null
    const address = india[0], location = !reason && address ? [address.addressLocality, address.addressRegion, 'India'].filter(Boolean).join(', ') : null
    const job = reason ? null : {
      source: provider.source, company: provider.companyName, jobId: native.identifier.value, title: native.title,
      location, country: 'India', city: getValidIndiaCityForJob({ country: 'India', location, city: null }),
      applyUrl: entry.url, sourceUrl: entry.url, link: entry.url,
      sourceDescription: native.description, jobDescription: native.description,
      postingDate: native.datePosted, postedAt: native.datePosted, nativePostingDate: native.datePosted,
      closingDate: native.validThrough || null, employmentType: native.employmentType || null,
      nativeHiringOrganization: native.hiringOrganization, nativeSourceRecord: native, scrapedAt: observedAt,
      sourceDetailComplete: true, sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false, applicationVisited: false,
    }
    return { native, job, held: heldNotices.length > 0, reason, nativeRoleHTML: reply.html,
      observations: { reason, ...(countryIssues.length || employerIssues.length ? { qualificationIssues: [...countryIssues, ...employerIssues] } : {}),
        heldNotices, closedNotices, typedNativeCountryRequired: true, fullCriteriaVisibleExact: true },
      bodySHA256: reply.receipt.bodySHA256, fullCriteriaSHA256: sha(fullCriteria), applicationURL: [...applicationURLs][0] }
  }

  const openings = [], nativeIds = new Set()
  for (const entry of pages.flat()) {
    const opening = await qualify(entry)
    need(!nativeIds.has(opening.native.identifier.value), 'duplicate native schema job identity'); nativeIds.add(opening.native.identifier.value)
    openings.push({ entry, ...opening })
  }
  const jobs = [], excluded = []
  for (const opening of openings) {
    const closing = await qualify(opening.entry, 'closing')
    need(JSON.stringify(closing.native) === JSON.stringify(opening.native) && Boolean(closing.job) === Boolean(opening.job)
      && closing.fullCriteriaSHA256 === opening.fullCriteriaSHA256 && closing.applicationURL === opening.applicationURL && closing.held === opening.held && closing.reason === opening.reason,
    'closing full native role changed')
    if (!opening.job) { excluded.push({ ...opening.entry, reason: opening.reason,
      nativeSourceRecord: opening.native, nativeClosingSourceRecord: closing.native,
      openingNativeRoleHTML: opening.nativeRoleHTML, closingNativeRoleHTML: closing.nativeRoleHTML, observations: opening.observations }); continue }
    const job = opening.job
    job.nativeListingRecord = opening.entry
    job.nativeClosingSourceRecord = closing.native
    job.nativeTalentbrewEvidence = { publishedId: opening.entry.publishedId, nativeSchemaIdentifier: job.jobId,
      selectedFacetId: '1269750', selectedReportedTotal: profile.total, clientSHA256: profile.clientSHA256,
      openingBodySHA256: opening.bodySHA256, closingBodySHA256: closing.bodySHA256,
      fullCriteriaVisibleExact: true, fullCriteriaSHA256: opening.fullCriteriaSHA256,
      applicationContext: { url: opening.applicationURL, employerAccount: 'synchronyfinancial/careers', nativeSchemaIdentifier: opening.native.identifier.value,
        visited: false, acceptingApplicationsVerified: false },
      roleClosingConfirmed: true, listingClosingConfirmed: false }
    job.sourceScopeComplete = false; job.sourceListingComplete = false; job.lifecycleCleanupAllowed = false
    job.activeApplyVerified = false; job.applicationVisited = false
    job.postingDatePrecision = /^\d{4}-\d{2}-\d{2}$/.test(opening.native.datePosted) ? 'calendar-date' : 'native-timestamp'
    job.firstEverPostedAt = null
    jobs.push(job)
  }
  for (let page = 1; page <= pages.length; page++) need(JSON.stringify(await listing(page)) === JSON.stringify(pages[page - 1]), 'closing native listing changed')
  need(JSON.stringify(await publisher()) === JSON.stringify(profile), 'closing corporate binding or search client changed')
  for (const job of jobs) job.nativeTalentbrewEvidence.listingClosingConfirmed = true
  Object.defineProperty(jobs, OBSERVATIONS, { value: { source: provider.source, observedAt, requestCount: receipts.length,
    nativeRecords: profile.total, returnedIndiaJobs: jobs.length, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    unresolved: ['whole-company-recruitment-scope-unverified'], exclusions: excluded, failures: [], receipts,
    nativeInventoryReads: [{ kind: 'talentbrew-country', surface: POST, reportedTotal: profile.total, pages: profile.pages, countryFacetId: '1269750' }] } })
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: SEARCH, firstParty: true, listingComplete: false,
    pagesFetched: receipts.length, reportedTotal: null, indiaFacetCount: null, verifiedAt: observedAt,
    reason: 'current-declared-TalentBrew-India-facet-and-all-selected-full-roles-closing-reconciled;whole-company-scope-unverified;cleanup-forbidden' })
}
