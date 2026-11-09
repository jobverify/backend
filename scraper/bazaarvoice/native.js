import { createHash } from 'node:crypto'
import { decodeHTML } from 'entities'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { document as rawDocument } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName, nativeLocationCountryName, nativeDate } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { parseBoundedProgram, parseRemoteLiteral } from '../../scraper-support/utils/remoteScriptData.js'
import { readBazaarvoiceRawScripts, isReviewedBazaarvoiceClassicScript, bazaarvoiceScriptMode } from './scriptExecution.js'
import { projectBazaarvoiceScreenStyles } from './screenStyles.js'

export const SOURCE = 'bazaarvoice'
export const CAREERS_URL = 'https://www.bazaarvoice.com/company/careers/'
export const API_URL = 'https://api.lever.co/v0/postings/bazaarvoice?mode=json'
const ACCOUNT = '714170d1-1117-4943-89d7-fa08f7e6af25'
// This current employer-advertised executable was reviewed in full. Its setup
// invokes fetchData({}) and initializes all filters from that unfiltered array.
// page/limit/skip and team/location/department are optional user-interface calls.
// A new executable requires review; neither an endpoint in a comment nor a
// guessed tenant can replace this binding. No remote code is executed here.
const REVIEWED_CONTROLLER_SHA256 = '3e9f05e2dc10b14bd11cbae51ccceb9288a4589f5fb74e115cbb286693f8ae54'
const REVIEWED_EXTERNAL_SCRIPTS = new Set([
  '//resources.bazaarvoice.com/js/forms2/js/forms2.min.js',
  'https://fast.wistia.com/assets/external/E-v1.js',
  ...['2n4qbn389s', '65ca1qdwt9', 'jhxj7d0lmc', 's2v1deazdc'].map(id => 'https://fast.wistia.com/embed/medias/' + id + '.jsonp'),
  'https://www.bazaarvoice.com/wp-content/themes/bazaarvoice/js/bv-89f7a8ce-vendor.js',
])
const REVIEWED_INLINE_SCRIPTS = new Set([
  '5613505499d298858baddb51e51ac3cd16dff28637195d0ccc2637766ad8f288', // New Relic loader
  '459d2bfec99d611b854f0a813c6bba83abf63d9d456901571a4c46b6664df011', // WordPress Ajax URL
  'cca97f14605a275e4af2696dbe6a8c9fe22ae5622f5a3a0a4ac6fcb5e8d3134f', // analytics initialization
  'fa4c5d9ddeea128e82e72c2c3ac7437856fa11c8b3be490bfdc03cdaec6e19d9', // Google Tag Manager
  '4c5f32d1c07b6953d89f0ed2fedfb9d6ad6e670a5d42600237168ec16025c383', // video helper
  '46c6176e76d6a34654c9ef6b398c3b64cf232e0f43ca28f284ad04c55e1374b8', // page template label
])
const PROOF = Symbol.for('jobverify.bazaarvoice-public-inventory')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const hash = value => createHash('sha256').update(value).digest('hex')
const norm = value => typeof value === 'string' ? decodeHTML(value).replace(/\s+/g, ' ').trim() : ''
const equal = (left, right) => norm(left) === norm(right)
const fail = (message, fields = {}) => Object.assign(new Error('Bazaarvoice ' + message), { code: 'native_contract', abortRetries: true, ...fields })
const need = (condition, message) => { if (!condition) throw fail(message) }
const one = (values, label) => { need(values.length === 1, 'missing-or-ambiguous-' + label); return values[0] }
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const sorted = values => [...values].sort()
const sameSet = (left, right) => left.length === right.length && JSON.stringify(sorted(left)) === JSON.stringify(sorted(right))
const astKey = value => JSON.stringify(value, (key, item) => ['start', 'end', 'raw'].includes(key) ? undefined : item)
const telemetryTemplate = parseBoundedProgram('window.NREUM||(NREUM={});NREUM.info={};')
const reviewedTelemetryMetadata = source => {
  try {
    const ast = parseBoundedProgram(source), assignment = ast.body[1]?.expression
    if (ast.body.length !== 2 || astKey(ast.body[0]) !== astKey(telemetryTemplate.body[0])
      || assignment?.type !== 'AssignmentExpression' || assignment.operator !== '='
      || astKey(assignment.left) !== astKey(telemetryTemplate.body[1].expression.left)) return false
    const value = parseRemoteLiteral(source.slice(assignment.right.start, assignment.right.end))
    return value && sameSet(Object.keys(value), ['beacon', 'licenseKey', 'applicationID', 'transactionName', 'queueTime', 'applicationTime', 'atts', 'errorBeacon', 'agent'])
      && Object.values(value).every(item => typeof item === 'string' || typeof item === 'number' && Number.isFinite(item))
  } catch { return false }
}
// The native Lever stylesheet hides all application buttons in print. This
// collector observes the screen page. Keep every conditional screen hiding
// rule conservative; remove only complete, explicitly print-only media blocks.
const visibleDocument = html => readVisibleNativeDocument(projectBazaarvoiceScreenStyles(html), { strict: true })
const plain = html => { const doc = visibleDocument(html); return norm(doc.text(one(doc.nodes(node => node.tag === 'root'), 'description-root'))) }
// Lever's schema joins native sections with literal backslash-n separators.
// Keep both original bodies; normalize only those separators for comparison.
const contentKey = html => plain(html.replace(/\\n/g, ' ')).replace(/\s/g, '')
const closed = text => /\b(?:this (?:job|position|posting|requisition) is no longer (?:available|active|open)|(?:this )?position (?:has been|is) filled|this (?:job|position|posting) (?:has been|is) closed)\b/i.test(text)
const allowedURL = value => {
  try {
    const url = new URL(value)
    if (url.username || url.password || url.hash || url.protocol !== 'https:') return false
    if (url.href === CAREERS_URL || url.href === API_URL) return true
    if (url.origin === 'https://www.bazaarvoice.com') return /^\/wp-content\/themes\/bazaarvoice\/js\/bv-[a-f0-9]+-app\.js$/.test(url.pathname) && !url.search
    if (url.origin === 'https://jobs.lever.co') return /^\/bazaarvoice\/[0-9a-f-]{36}(?:\/apply)?$/.test(url.pathname) && !url.search
    return url.origin === 'https://api.lever.co' && url.pathname === '/v0/postings/bazaarvoice'
      && /^\?mode=json&limit=10&skip=(?:0|[1-9]\d{0,5})$/.test(url.search)
  } catch { return false }
}
const bounded = (operation, signal) => new Promise((resolve, reject) => {
  const cleanup = () => signal.removeEventListener('abort', abort)
  const abort = () => { cleanup(); reject(signal.reason) }
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) { abort(); Promise.resolve(operation).catch(() => {}); return }
  Promise.resolve(operation).then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) })
})
const positiveLimit = (value, maximum, name) => {
  need(Number.isSafeInteger(value) && value > 0 && value <= maximum, 'invalid-' + name)
  return value
}

export async function fetchBazaarvoicePacket(url, {
  signal, fetchImpl = globalThis.fetch, requestTimeoutMs = 20000, maximumBytes = 2 * 1024 * 1024,
} = {}) {
  signal?.throwIfAborted()
  need(allowedURL(url), 'unadvertised-request-url')
  positiveLimit(requestTimeoutMs, 20000, 'request-timeout')
  positiveLimit(maximumBytes, 2 * 1024 * 1024, 'response-byte-limit')
  const own = new AbortController(), timeout = fail('request-timeout', { name: 'TimeoutError', code: 'native_timeout' })
  const timer = setTimeout(() => own.abort(timeout), requestTimeoutMs)
  const attempt = AbortSignal.any([own.signal, ...(signal ? [signal] : [])])
  const check = () => { signal?.throwIfAborted(); attempt.throwIfAborted() }
  let response, reader, cancelled = false
  const cancel = reason => {
    if (cancelled || !reader && !response?.body) return
    cancelled = true
    try { Promise.resolve(reader ? reader.cancel(reason) : response.body.cancel(reason)).catch(() => {}) } catch {}
  }
  const abort = () => cancel(signal?.aborted ? signal.reason : attempt.reason)
  attempt.addEventListener('abort', abort, { once: true })
  try {
    const requestedAt = new Date().toISOString()
    const pending = Promise.resolve(fetchImpl(url, { method: 'GET', redirect: 'manual', signal: attempt,
      headers: { Accept: url.startsWith(API_URL) ? 'application/json' : 'text/html,application/javascript;q=0.9' } })).then(value => {
      response = value
      if (attempt.aborted) cancel(signal?.aborted ? signal.reason : attempt.reason)
      return value
    })
    response = await bounded(pending, attempt); check()
    need(!response.url || response.url === url, 'unreviewed-response-url')
    const declared = response.headers.get('content-length')
    if (declared != null && (!/^\d+$/.test(declared) || Number(declared) > maximumBytes)) throw fail('response-byte-limit', { code: 'native_byte_limit' })
    reader = response.body?.getReader()
    const chunks = []; let bytes = 0
    if (reader) while (true) {
      const next = await bounded(reader.read(), attempt); check()
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > maximumBytes) throw fail('response-byte-limit', { code: 'native_byte_limit' })
      chunks.push(Buffer.from(next.value))
    }
    const body = Buffer.concat(chunks).toString('utf8')
    const packet = { url, status: response.status, headers: Object.fromEntries(response.headers), requestedAt,
      completedAt: new Date().toISOString(), bytes, sha256: hash(body), body }
    if (!response.ok || response.status < 200 || response.status >= 300) throw fail('HTTP-' + response.status, {
      status: response.status, code: response.status === 403 ? 'http_forbidden' : response.status === 429 ? 'http_rate_limited'
        : response.status >= 300 && response.status < 400 ? 'native_redirect' : 'native_http',
      retryAfter: response.headers.get('retry-after'), retainedResponse: packet,
    })
    check()
    return packet
  } catch (error) {
    cancel(signal?.aborted ? signal.reason : attempt.aborted ? attempt.reason : error)
    check()
    throw error
  } finally {
    clearTimeout(timer); attempt.removeEventListener('abort', abort)
    try { reader?.releaseLock() } catch {}
  }
}

function careersBinding(html) {
  const doc = visibleDocument(html), scripts = readBazaarvoiceRawScripts(html)
  need(!doc.nodes(node => node.tag === 'base').length, 'unreviewed-careers-base')
  const canonical = one(doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'careers-canonical')
  need(canonical.attrs.href === CAREERS_URL, 'current-employer-page-identity')
  need(doc.nodes(node => node.tag === 'h1' && /\bBazaarvoice\b/.test(doc.text(node))).length === 1, 'current-employer-heading')
  const loader = one(scripts.filter(node => node.attrs.id === 'bazaarvoice-app-js' && node.attrs.src), 'active-careers-controller')
  need(isReviewedBazaarvoiceClassicScript(loader), 'current-controller-execution-mode-unreviewed')
  need(allowedURL(loader.attrs.src) && loader.attrs.src.startsWith('https://www.bazaarvoice.com/'), 'unreviewed-controller-url')
  const issues = []
  if (doc.nodes(node => node.attrs.id === 'bvblock-careers__jobs-container').length !== 1
    || doc.nodes(node => doc.hasClass(node, 'bv-js-jobs-sort') && node.attrs['data-location'] === 'All locations').length !== 1
    || !['All departments', 'All teams', 'All locations'].every(label => doc.nodes(node => node.tag === 'li' && node.attrs['data-value'] === label).length === 1)) issues.push('current-component-not-unfiltered')
  const known = new Set([CAREERS_URL, 'https://jobs.lever.co/bazaarvoice', 'https://jobs.lever.co/bazaarvoice/'])
  const recruitingText = text => /\b(?:apply|open (?:roles|positions)|job openings|current jobs|vacancies|careers|recruiting)\b/i.test(text)
  for (const anchor of doc.nodes(node => node.tag === 'a' && node.attrs.href)) {
    const href = anchor.attrs.href
    if (href.startsWith('#')) {
      if (href !== '#job-openings' && recruitingText(doc.text(anchor))) issues.push('additional-recruiting-component:' + href)
      continue
    }
    let url
    try { url = new URL(href, CAREERS_URL) } catch { issues.push('unreviewed-active-link'); continue }
    if (!['http:', 'https:'].includes(url.protocol)) continue
    if (known.has(url.href)) continue
    const recruitingHost = /(?:lever\.co|greenhouse\.io|ashbyhq\.com|myworkdayjobs\.com|workable\.com|jobvite\.com|smartrecruiters\.com|rippling\.com|darwinbox\.in|keka\.com|recruitee\.com|bamboohr\.com)$/i.test(url.hostname)
    const recruitingLabel = recruitingText(doc.text(anchor))
    const recruitingPath = /\/(?:careers|open-roles|open-positions|jobs|job-openings|vacancies|recruitment)(?:\/|$)/i.test(url.pathname)
    if (recruitingHost || recruitingLabel || recruitingPath) issues.push('additional-recruiting-surface:' + url.origin + url.pathname)
  }
  if (doc.frames().length) issues.push('additional-recruiting-frame-unreviewed')
  for (const script of scripts) {
    if (script === loader) continue
    if (script.attrs.type?.toLowerCase() === 'application/ld+json') {
      if (/"(?:@type)"\s*:\s*"JobPosting"/.test(script.raw || '')) issues.push('additional-recruiting-structured-inventory')
      continue
    }
    const mode = bazaarvoiceScriptMode(script)
    if (mode === 'inert') continue
    if (mode !== 'classic' || !isReviewedBazaarvoiceClassicScript(script)) {
      issues.push('additional-recruiting-script-unreviewed'); continue
    }
    const reviewed = script.attrs.src ? REVIEWED_EXTERNAL_SCRIPTS.has(script.attrs.src)
      : REVIEWED_INLINE_SCRIPTS.has(hash(script.raw || '')) || reviewedTelemetryMetadata(script.raw || '')
    if (!reviewed) issues.push('additional-recruiting-script-unreviewed')
  }
  return { controllerURL: loader.attrs.src, issues }
}

function listing(body, headers) {
  const rows = JSON.parse(body)
  need(Array.isArray(rows) && rows.length <= 200, 'unreviewed-listing-envelope-or-row-limit')
  const issues = []
  if (Object.keys(headers).some(key => /^(?:link|x-next-page|x-next-cursor|x-total-count|x-has-more)$/i.test(key))) issues.push('unreviewed-native-continuation-metadata')
  const seen = new Set(), records = []
  for (const row of rows) {
    try {
      need(row && typeof row === 'object' && !Array.isArray(row) && UUID.test(row.id) && norm(row.text), 'malformed-native-role')
      need(!seen.has(row.id), 'duplicate-native-role-identity'); seen.add(row.id)
      need(row.hostedUrl === 'https://jobs.lever.co/bazaarvoice/' + row.id && row.applyUrl === row.hostedUrl + '/apply', 'foreign-native-role-url')
      need(row.categories && norm(row.categories.location) && Array.isArray(row.categories.allLocations)
        && row.categories.allLocations.length > 0 && row.categories.allLocations.length <= 32
        && row.categories.allLocations.every(value => typeof value === 'string' && value === norm(value) && value)
        && new Set(row.categories.allLocations).size === row.categories.allLocations.length
        && row.categories.allLocations.includes(row.categories.location), 'native-location-enumeration')
      need(!Object.keys(row).some(key => /^(?:next|cursor|hasMore|total|pagination|unlisted|hidden|isInternal)$/i.test(key)), 'unreviewed-role-scope-metadata')
      records.push(row)
    } catch (error) { issues.push(error.message) }
  }
  return { rows, records, issues }
}

function roleHeader(doc, row) {
  need(!doc.nodes(node => node.tag === 'base').length, 'unreviewed-role-base')
  need(equal(doc.text(one(doc.nodes(node => node.tag === 'h2'), 'visible-role-title')), row.text), 'native-role-title-mismatch')
  const label = doc.text(one(doc.nodes(node => doc.hasClass(node, 'posting-category') && doc.hasClass(node, 'location')), 'visible-role-locations'))
  need(sameSet(label.split('/').map(norm).filter(Boolean), row.categories.allLocations), 'visible-role-location-mismatch')
  need(!closed(doc.text(one(doc.nodes(node => node.tag === 'root'), 'role-root'))), 'native-role-visibly-closed')
}

function detail(html, row) {
  const doc = visibleDocument(html), raw = rawDocument(html)
  roleHeader(doc, row)
  const schema = JSON.parse(one(doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json'), 'native-JobPosting').raw)
  need(schema['@type'] === 'JobPosting' && schema.hiringOrganization?.name === 'Bazaarvoice' && equal(schema.title, row.text), 'native-employer-role-mismatch')
  const locations = Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]
  need(locations.every(value => value?.address && typeof value.address.addressLocality === 'string')
    && sameSet(locations.map(value => norm(value.address.addressLocality)), row.categories.allLocations), 'schema-location-enumeration-mismatch')
  const sections = doc.nodes(node => node.tag === 'div' && doc.hasClass(node, 'section') && doc.hasClass(node, 'page-centered')
    && !doc.hasClass(node, 'posting-header') && !doc.hasClass(node, 'last-section-apply') && node.attrs['data-qa'] !== 'ai-disclaimer')
  need(doc.nodes(node => node.attrs['data-qa'] === 'job-description').length === 1 && sections.length > 0, 'missing-visible-full-description')
  const nativeSections = raw.nodes(node => node.tag === 'div' && raw.hasClass(node, 'section') && raw.hasClass(node, 'page-centered')
    && !raw.hasClass(node, 'posting-header') && !raw.hasClass(node, 'last-section-apply') && node.attrs['data-qa'] !== 'ai-disclaimer')
  const descriptionHTML = nativeSections.map(node => raw.inner(node)).join('\n')
  const visibleKey = sections.map(node => norm(doc.text(node))).join('').replace(/\s/g, '')
  need(typeof schema.description === 'string' && visibleKey.length >= 100 && visibleKey === contentKey(schema.description)
    && visibleKey === contentKey(descriptionHTML), 'visible-structured-full-description-mismatch')
  need(typeof row.descriptionBodyPlain === 'string' && norm(row.descriptionBodyPlain).length >= 80 && Array.isArray(row.lists), 'native-full-role-content-unavailable')
  for (const piece of [row.description, ...row.lists.flatMap(value => [value.text, value.content]), row.additional, row.salaryDescription]) {
    if (typeof piece === 'string' && norm(piece)) need(visibleKey.includes(contentKey(piece)), 'native-listing-detail-description-mismatch')
  }
  const applications = doc.nodes(node => node.tag === 'a' && doc.hasClass(node, 'postings-btn') && doc.hasClass(node, 'template-btn-submit'))
  need(applications.length > 0 && applications.every(node => node.attrs.href === row.applyUrl && !Object.hasOwn(node.attrs, 'disabled')
    && node.attrs['aria-disabled'] !== 'true' && !doc.hasClass(node, 'disabled')), 'native-application-identity-unavailable')
  const posted = nativeDate(schema.datePosted), closing = nativeDate(schema.validThrough)
  need(!closing.iso || (!posted.iso || closing.iso >= posted.iso) && Date.parse(closing.iso) > Date.now(), 'native-role-expired-or-contradictory-date')
  return { row, schema, addresses: locations.map(value => value.address), descriptionHTML, posted, closing }
}

function application(html, row) {
  const doc = visibleDocument(html)
  roleHeader(doc, row)
  const form = one(doc.nodes(node => node.tag === 'form' && node.attrs.id === 'application-form'), 'native-application-form')
  need(form.attrs.method?.toUpperCase() === 'POST' && (!form.attrs.action || form.attrs.action === row.applyUrl), 'unreviewed-application-action')
  const account = one(doc.nodes(node => node.tag === 'input' && node.attrs.name === 'accountId' && node.attrs.type === 'hidden'), 'native-employer-account')
  need(account.attrs.value === ACCOUNT, 'foreign-native-employer-account')
  const submit = one(doc.nodes(node => node.tag === 'button' && node.attrs.id === 'btn-submit'), 'enabled-application-submit')
  need(!Object.hasOwn(submit.attrs, 'disabled') && submit.attrs['aria-disabled'] !== 'true' && !doc.hasClass(submit, 'disabled')
    && ['name', 'email'].every(name => doc.nodes(node => node.tag === 'input' && node.attrs.name === name).length === 1), 'native-application-not-enabled')
  const choices = doc.nodes(node => node.tag === 'select' && node.attrs.name === 'opportunityLocationId')
  if (row.categories.allLocations.length === 1) { need(choices.length === 0, 'unreviewed-single-location-application'); return [] }
  const select = one(choices, 'native-multiple-location-selector')
  const options = select.children.filter(node => typeof node !== 'string' && node.tag === 'option' && node.attrs.value)
  const ids = options.map(node => node.attrs.value), labels = options.map(node => norm(doc.text(node)))
  need(ids.every(value => UUID.test(value)) && new Set(ids).size === ids.length && sameSet(labels, row.categories.allLocations)
    && !Object.hasOwn(select.attrs, 'disabled'), 'native-application-location-identities-mismatch')
  return options.map(node => ({ locationId: node.attrs.value, label: norm(doc.text(node)) }))
}

function countryPartition(facts, issues) {
  const anchors = new Map(), conflicts = new Set()
  // country describes the primary posting. Additional locations may use only
  // their own explicit native address/country label or the SAME location UUID
  // independently bound to a typed primary country in this observation. A city
  // label never creates a country relation, and primary country is not copied
  // to allLocations. Removing the New York primary anchor fails the proof.
  for (const fact of facts) {
    const country = typeof fact.row.country === 'string' && /^[A-Z]{2}$/.test(fact.row.country) ? nativeCountryName(fact.row.country) : null
    if (fact.row.country != null && !country) issues.add('unknown-native-primary-country:' + fact.row.id)
    const primary = fact.options.find(value => value.label === fact.row.categories.location)
    if (primary && country) {
      const existing = anchors.get(primary.locationId)
      if (existing && (existing.country !== country || existing.label !== primary.label)) conflicts.add(primary.locationId)
      else anchors.set(primary.locationId, { ...primary, country, primaryPostingIDs: [...(existing?.primaryPostingIDs || []), fact.row.id] })
    }
  }
  for (const id of conflicts) { anchors.delete(id); issues.add('conflicting-native-location-country:' + id) }
  for (const fact of facts) {
    fact.countryLocations = []
    for (const label of fact.row.categories.allLocations) {
      const primary = label === fact.row.categories.location
      const typed = primary && typeof fact.row.country === 'string' && /^[A-Z]{2}$/.test(fact.row.country) ? nativeCountryName(fact.row.country) : null
      const written = nativeLocationCountryName(label)
      const address = fact.addresses.find(value => norm(value.addressLocality) === label)
      const addressed = address?.addressCountry == null ? null : nativeCountryName(address.addressCountry)
      const option = fact.options.find(value => value.label === label)
      const anchored = option && !conflicts.has(option.locationId) ? anchors.get(option.locationId) : null
      const countries = [typed, written, addressed, anchored?.country].filter(Boolean)
      if (address?.addressCountry != null && !addressed || anchored && anchored.label !== label || new Set(countries).size > 1
        || option && conflicts.has(option.locationId)) {
        issues.add('conflicting-native-location-country:' + fact.row.id + ':' + label); continue
      }
      const country = countries[0]
      if (!country) issues.add('unresolved-native-location-country:' + fact.row.id + ':' + label)
      else fact.countryLocations.push({ label, country, locationId: option?.locationId || null,
        basis: typed ? 'typed-primary-country' : addressed ? 'native-address-country' : written ? 'explicit-native-country-label' : 'same-native-location-id-typed-primary-country' })
    }
  }
  return [...anchors.values()]
}

const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
export const readBazaarvoiceProof = jobs => jobs?.[PROOF] || null

export async function run({ signal, readPacket, fetchImpl, onProof, requestTimeoutMs = 20000, sourceTimeoutMs = 120000,
  maximumBytes = 2 * 1024 * 1024, maxAggregateBytes = 32 * 1024 * 1024, maxRequests = 96, maxJobs = Infinity,
} = {}) {
  signal?.throwIfAborted()
  positiveLimit(sourceTimeoutMs, 120000, 'source-timeout')
  positiveLimit(requestTimeoutMs, 20000, 'request-timeout')
  positiveLimit(maximumBytes, 2 * 1024 * 1024, 'response-byte-limit')
  positiveLimit(maxAggregateBytes, 32 * 1024 * 1024, 'aggregate-byte-limit')
  positiveLimit(maxRequests, 96, 'request-limit')
  need(maxJobs === Infinity || Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'invalid-job-limit')
  need(onProof == null || typeof onProof === 'function', 'invalid-audit-proof-sink')
  const own = new AbortController(), deadline = fail('source-timeout', { code: 'native_timeout', name: 'TimeoutError' })
  const timer = setTimeout(() => own.abort(deadline), sourceTimeoutMs)
  const sourceSignal = AbortSignal.any([own.signal, ...(signal ? [signal] : [])])
  const proof = { source: SOURCE, publicScope: 'Current employer-advertised public Bazaarvoice Lever inventory', legalEmployer: null,
    wholeCompanyScopeComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false, retainedResponses: [], failures: [],
    observedListingCount: 0, observedIndiaListingCount: 0, countryRelations: [], facts: [], reportedTotal: null }
  const issues = new Set(); let requests = 0, aggregate = 0, halted = false, firstParty = false, opening = null, closingMatches = false, verifiedAt = null
  const captureFailure = (stage, error) => {
    signal?.throwIfAborted()
    const code = error?.code || 'native_contract'
    proof.failures.push({ stage, code, message: String(error?.message || error), ...(error?.status == null ? {} : { status: error.status }) })
    issues.add(stage + ':' + code + ':' + String(error?.message || error))
    if (error?.status === 403 || error?.status === 429 || error?.code === 'native_redirect' || sourceSignal.aborted || /(?:byte|request)-limit/.test(String(error?.message))) halted = true
  }
  const request = async url => {
    signal?.throwIfAborted(); sourceSignal.throwIfAborted()
    need(!halted, 'request-after-terminal-failure')
    need(allowedURL(url), 'unadvertised-request-url')
    need(++requests <= maxRequests, 'request-limit')
    const requestController = new AbortController(), timeout = fail('request-timeout', { code: 'native_timeout', name: 'TimeoutError' })
    const requestTimer = setTimeout(() => requestController.abort(timeout), requestTimeoutMs)
    const attempt = AbortSignal.any([sourceSignal, requestController.signal])
    try {
      const pending = readPacket ? readPacket(url, { method: 'GET', redirect: 'manual', signal: attempt })
        : fetchBazaarvoicePacket(url, { signal: attempt, fetchImpl, requestTimeoutMs, maximumBytes })
      const packet = await bounded(pending, attempt)
      signal?.throwIfAborted(); attempt.throwIfAborted()
      need(packet && packet.url === url && typeof packet.body === 'string' && packet.sha256 === hash(packet.body)
        && packet.bytes === Buffer.byteLength(packet.body) && packet.bytes <= maximumBytes && packet.headers && typeof packet.headers === 'object'
        && validDate(packet.requestedAt) && validDate(packet.completedAt) && packet.requestedAt <= packet.completedAt
        && Date.parse(packet.completedAt) <= Date.now(), 'invalid-retained-response-packet')
      proof.retainedResponses.push(packet)
      aggregate += packet.bytes
      need(aggregate <= maxAggregateBytes, 'aggregate-byte-limit')
      if (packet.status !== 200) throw fail('HTTP-' + packet.status, { status: packet.status,
        code: packet.status === 403 ? 'http_forbidden' : packet.status === 429 ? 'http_rate_limited'
          : packet.status >= 300 && packet.status < 400 ? 'native_redirect' : 'native_http', retryAfter: packet.headers['retry-after'] || null })
      return packet
    } catch (error) {
      if (error?.retainedResponse) proof.retainedResponses.push(error.retainedResponse)
      signal?.throwIfAborted()
      throw error
    } finally { clearTimeout(requestTimer) }
  }
  const terminal = async (rows, stage) => {
    const packet = await request(API_URL + '&limit=10&skip=' + rows.length)
    const parsed = listing(packet.body, packet.headers)
    need(parsed.rows.length === 0 && parsed.issues.length === 0, stage + '-unconsumed-native-pagination')
    return packet
  }
  try {
    let binding
    try {
      const primary = await request(CAREERS_URL)
      binding = careersBinding(primary.body); firstParty = true
      binding.issues.forEach(issue => issues.add(issue))
      const controller = await request(binding.controllerURL)
      need(controller.sha256 === REVIEWED_CONTROLLER_SHA256, 'current-controller-contract-changed')
    } catch (error) { captureFailure('current-binding', error) }
    if (!halted) try {
      const packet = await request(API_URL)
      opening = listing(packet.body, packet.headers)
      opening.issues.forEach(issue => issues.add(issue))
      proof.observedListingCount = opening.rows.length
      try { await terminal(opening.rows, 'opening') } catch (error) { captureFailure('opening-termination', error) }
    } catch (error) { captureFailure('opening-inventory', error) }
    if (opening) for (const row of opening.records) {
      if (halted) break
      let fact
      try { fact = detail((await request(row.hostedUrl)).body, row) }
      catch (error) { captureFailure('native-detail', error); continue }
      if (halted) break
      try { fact.options = application((await request(row.applyUrl)).body, row); proof.facts.push(fact) }
      catch (error) { captureFailure('native-application', error) }
    }
    proof.countryRelations = countryPartition(proof.facts, issues)
    if (opening && !halted) try {
      const packet = await request(API_URL), closing = listing(packet.body, packet.headers)
      closing.issues.forEach(issue => issues.add(issue))
      closingMatches = sameSet(opening.rows.map(canonical), closing.rows.map(canonical))
      need(closingMatches, 'closing-native-role-records-changed')
      const last = await terminal(closing.rows, 'closing')
      verifiedAt = last.completedAt
    } catch (error) { captureFailure('closing-inventory', error) }
    signal?.throwIfAborted()
    if (sourceSignal.aborted) issues.add('source-timeout')
    if (!opening || proof.facts.length !== opening.rows.length) issues.add('native-role-detail-application-accounting-incomplete')
    if (!closingMatches || !verifiedAt) issues.add('closing-native-inventory-unverified')
    const india = proof.facts.filter(fact => fact.countryLocations.some(value => value.country === 'India'))
    proof.observedIndiaListingCount = india.length
    if (india.length > maxJobs) issues.add('selected-india-results-truncated')
    const complete = firstParty && Boolean(opening) && issues.size === 0
    proof.sourceScopeComplete = proof.lifecycleCleanupAllowed = complete
    proof.listingPaginationComplete = complete
    proof.closingInventoryMatches = closingMatches
    proof.candidateDetails = india.length
    proof.extractedDetailJobs = Math.min(india.length, maxJobs)
    proof.excludedDetailJobs = 0
    proof.nonIndiaListingCount = proof.facts.length - india.length
    proof.jobs = india
    proof.exclusions = []
    for (const fact of proof.facts) {
      fact.sourceScopeComplete = fact.lifecycleCleanupAllowed = complete
      fact.legalEmployer = null
    }
    proof.issues = sorted(issues)
    proof.requestCount = requests
    proof.aggregateBytes = aggregate
    const jobs = india.slice(0, maxJobs).map(fact => {
      const locations = fact.countryLocations.filter(value => value.country === 'India').map(value => value.label)
      const description = plain(fact.descriptionHTML)
      return { title: fact.row.text, company: 'Bazaarvoice', source: SOURCE, jobId: fact.row.id, requisitionId: fact.row.id,
        country: 'India', city: locations[0].split(',')[0].trim(), location: locations.join(' / '),
        locations: locations.map(label => ({ location: label, city: label.split(',')[0].trim(), country: 'India' })),
        link: fact.row.hostedUrl, sourceUrl: fact.row.hostedUrl, applyUrl: fact.row.applyUrl, companyCareerPage: CAREERS_URL,
        companyDomain: 'bazaarvoice.com', atsPlatform: 'lever', department: fact.row.categories.department || null,
        employmentType: fact.row.categories.commitment || null, remoteStatus: ({ remote: 'Remote', hybrid: 'Hybrid', 'on-site': 'On-site' })[fact.row.workplaceType] || null,
        jobDescription: description, sourceDescription: fact.descriptionHTML, postingDate: fact.posted.iso,
        sourcePostedDatePrecision: fact.posted.precision, closingDate: fact.closing.iso, nativeCreatedAt: fact.row.createdAt ?? null,
        sourceDetailComplete: true, sourceListingComplete: complete, sourceScopeComplete: complete, lifecycleCleanupAllowed: complete,
        nativeJobPosting: fact.schema, nativeListingRecord: fact.row, nativeCountryLocations: fact.countryLocations,
        nativeApplicationLocations: fact.options, nativeCollectionEvidence: proof, sourcePublicationHistoryComplete: false, legalEmployer: null,
        scrapedAt: verifiedAt || proof.retainedResponses.at(-1)?.completedAt || null }
    })
    // Raw response bodies also survive zero selected jobs through the exported
    // source proof. Catalog decoration keeps the ordinary inventory evidence.
    Object.defineProperty(jobs, PROOF, { value: proof })
    if (onProof) await bounded(onProof(proof), sourceSignal)
    signal?.throwIfAborted()
    return attachInventoryEvidence(jobs, { status: complete ? opening.rows.length ? 'complete-inventory' : 'verified-empty' : 'coverage-gap',
      surface: API_URL, firstParty, listingComplete: complete, pagesFetched: opening ? 1 : 0, reportedTotal: null,
      indiaFacetCount: complete ? india.length : null, verifiedAt: complete ? verifiedAt : null,
      reason: complete ? 'current-unfiltered-bazaarvoice-public-inventory-and-native-location-identities-reconciled' : proof.issues.join(';') })
  } finally { clearTimeout(timer) }
}
