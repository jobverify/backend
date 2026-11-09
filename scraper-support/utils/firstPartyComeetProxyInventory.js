import { createHash } from 'node:crypto'
import { readNativeDocument, decodeNativeEntities } from './activeNativeHtml.js'
import { readVisibleNativeDocument } from './visibleNativeHtml.js'
import { attachInventoryEvidence } from './inventoryEvidence.js'

const PROOF = Symbol.for('jobverify.official-ats-discovery')
const uidPattern = /^[A-Z\d]{1,16}\.[A-Z\d]{1,32}$/i
const text = value => typeof value === 'string' && Boolean(value.trim())
const norm = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()
const heading = value => norm(value).replace(/[:.!]+$/, '').trim()
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const same = (a, b) => canonical(a) === canonical(b)
const need = (condition, message) => {
  if (!condition) throw Object.assign(new Error('First-party Comeet proxy: ' + message), {
    code: 'FIRST_PARTY_COMEET_PROXY_CONTRACT', softFailure: true, abortRetries: true, failureKind: 'coverage_gap',
  })
}
const object = value => value && typeof value === 'object' && !Array.isArray(value)
function keys(value, expected, label) {
  need(object(value) && same(Object.keys(value).sort(), [...expected].sort()), label + ' schema/status/publication fields changed')
}
// Visibility does not govern script execution. Template contents stay inert;
// their bindings are inspected separately as data consumed by the pinned client.
const treeNodes = (node, templates = false) => typeof node === 'string' || !templates && node.tag === 'template'
  ? [] : [node, ...node.children.flatMap(child => treeNodes(child, templates))]
function qualifiedDocument(html, config, documentURL) {
  const document = readNativeDocument(html), nodes = treeNodes(document.nodes(node => node.tag === 'root')[0])
  const bases = nodes.filter(node => node.tag === 'base' && Object.hasOwn(node.attrs, 'href'))
  need(bases.length <= 1, 'ambiguous corporate/primary document base URL')
  let baseURL
  try { baseURL = new URL(bases.length ? bases[0].attrs.href : documentURL, documentURL) }
  catch { need(false, 'unqualified corporate/primary document base URL') }
  need(baseURL.origin === config.origin && !baseURL.username && !baseURL.password, 'unqualified corporate/primary document base URL')
  return { document, nodes, baseURL }
}
function primaryDocument(html, config, documentURL) {
  const { document, nodes, baseURL } = qualifiedDocument(html, config, documentURL)
  const modules = nodes.filter(node => node.tag === 'script' && node.attrs.src && (node.attrs.type || '').toLowerCase() === 'module')
  need(modules.length === 1 && new URL(modules[0].attrs.src, baseURL).href === config.primaryClientURL,
    'current executable primary module/client identity missing or changed')
  return { document, nodes }
}
function corporate(html, config) {
  const { baseURL } = qualifiedDocument(html, config, config.careersURL)
  const document = readVisibleNativeDocument(html, { strict: true })
  const links = document.nodes(node => {
    if (node.tag !== 'a' || !node.attrs.href) return false
    try { return new URL(node.attrs.href, baseURL).href === config.listingURL } catch { return false }
  })
  need(links.some(node => /^(?:View Current Openings|View Openings)$/.test(document.text(node))), 'current visible corporate careers handoff/binding missing')
}
function listingPage(html, config) {
  const { document, nodes } = primaryDocument(html, config, config.listingURL)
  const visible = readVisibleNativeDocument(html, { strict: true })
  need(visible.nodes(node => node.attrs['x-data'] === 'comeet').length === 1, 'visible current primary listing component missing or ambiguous')
  const hosts = document.nodes(node => node.attrs['x-data'] === 'comeet')
  need(hosts.length === 1, 'primary listing component identity ambiguous')
  const templateNodes = treeNodes(hosts[0], true)
  need(templateNodes.filter(node => node.tag === 'template' && node.attrs['x-for'] === 'd in filteredPositions').length === 1
    && templateNodes.filter(node => node.tag === 'template' && node.attrs['x-for'] === 'p in d.positions').length === 1
    && templateNodes.filter(node => node.tag === 'a' && node.attrs[':href'] === '`/open-positions/${p.uid}`').length === 1,
  'current primary listing/UID route template contract changed')
  const widgets = nodes.filter(node => node.tag === 'script' && node.attrs.type === 'comeet-social')
  need(widgets.length === 1 && widgets[0].attrs['data-company-uid'] === config.nativeCompanyUid
    && text(widgets[0].attrs['data-token']), 'current native company widget account/binding missing or changed')
}
function rolePage(html, config, uid) {
  primaryDocument(html, config, config.listingURL + '/' + uid)
  const visible = readVisibleNativeDocument(html, { strict: true })
  const components = visible.nodes(node => /^comeetPosition\(/.test(node.attrs['x-data'] || ''))
  const parsed = components.length === 1 && /^comeetPosition\((['"])([A-Z\d]+\.[A-Z\d]+)\1\)$/i.exec(components[0].attrs['x-data'])
  need(parsed && parsed[2] === uid, 'public primary role component UID/identity binding mismatch')
}
function listing(groups, facets, maximum) {
  need(Array.isArray(groups), 'grouped native listing inventory is not an array')
  const rows = [], ids = new Set(), departments = new Set()
  for (const group of groups) {
    keys(group, ['department', 'positions'], 'native department group')
    need(text(group.department) && !departments.has(group.department) && Array.isArray(group.positions), 'native department group missing or duplicate')
    departments.add(group.department)
    for (const post of group.positions) {
      keys(post, ['name', 'department', 'location', 'uid', 'workplace_type'], 'native listing record')
      need(text(post.name) && post.department === group.department && text(post.location) && text(post.workplace_type)
        && uidPattern.test(post.uid || '') && !ids.has(post.uid), 'native listing UID/department identity missing or duplicate')
      ids.add(post.uid); rows.push(post)
      need(rows.length <= maximum, 'native record bound would leave an incomplete inventory')
    }
  }
  const expected = { departments: [...departments], locations: [...new Set(rows.map(row => row.location))], types: [...new Set(rows.map(row => row.workplace_type))] }
  for (const kind of Object.keys(expected)) {
    const values = facets[kind]
    need(Array.isArray(values) && values.every(text) && new Set(values).size === values.length
      && same([...values].sort(), expected[kind].sort()), 'native ' + kind + ' filter/facet and unfiltered listing inventory disagree')
  }
  return { rows: rows.sort((a, b) => a.uid.localeCompare(b.uid)), departments: [...departments].sort(),
    facets: Object.fromEntries(Object.entries(expected).map(([kind, values]) => [kind, values.sort()])) }
}
const regions = new Intl.DisplayNames(['en'], { type: 'region' })
const countryCode = code => typeof code === 'string' && /^[A-Z]{2}$/.test(code)
  && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code) && new Intl.Locale('und-' + code).region === code && regions.of(code) !== code
const indiaCityStates = Object.fromEntries([
  ['mh|maharashtra', 'mumbai|navi mumbai|pune|nagpur|nashik|thane'],
  ['ka|karnataka', 'bangalore|bengaluru|mysore|mysuru|mangalore|mangaluru'],
  ['tn|tamil nadu', 'chennai|coimbatore|madurai'], ['tg|ts|telangana', 'hyderabad|secunderabad|warangal'],
  ['dl|delhi', 'delhi|new delhi'], ['hr|haryana', 'gurgaon|gurugram|faridabad'],
  ['up|uttar pradesh', 'noida|greater noida|lucknow|kanpur|ghaziabad'], ['gj|gujarat', 'ahmedabad|gandhinagar|vadodara|baroda|surat'],
  ['wb|west bengal', 'kolkata|calcutta'], ['kl|kerala', 'kochi|cochin|thiruvananthapuram|trivandrum'],
  ['rj|rajasthan', 'jaipur|udaipur'], ['mp|madhya pradesh', 'indore|bhopal'], ['od|or|odisha|orissa', 'bhubaneswar|cuttack'],
  ['pb|punjab', 'mohali|amritsar|ludhiana'], ['ch|chandigarh', 'chandigarh'], ['ap|andhra pradesh', 'visakhapatnam|vijayawada|tirupati'],
  ['br|bihar', 'patna'], ['cg|ct|chhattisgarh', 'raipur'], ['jh|jharkhand', 'ranchi|jamshedpur'], ['uk|ut|uttarakhand', 'dehradun'],
  ['hp|himachal pradesh', 'shimla'], ['ga|goa', 'panaji|panjim'], ['as|assam', 'guwahati|dispur'], ['ar|arunachal pradesh', 'itanagar'],
  ['mn|manipur', 'imphal'], ['ml|meghalaya', 'shillong'], ['mz|mizoram', 'aizawl'], ['nl|nagaland', 'kohima'], ['sk|sikkim', 'gangtok'],
  ['tr|tripura', 'agartala'], ['py|puducherry|pondicherry', 'puducherry|pondicherry'], ['jk|jammu and kashmir', 'jammu|srinagar'],
  ['la|ladakh', 'leh'], ['an|andaman and nicobar islands', 'port blair'],
].flatMap(([states, cities]) => cities.split('|').map(city => [city, states.split('|')])))
// These qualified foreign pairs reject conflicting facts. State abbreviations
// alone are ambiguous (GA is also Goa); a missing country is never inferred.
const foreignCityStates = [
  ['US', 'atlanta', 'ga|georgia'], ['US', 'new york', 'ny|new york'],
  ['US', 'san francisco', 'ca|california'], ['US', 'los angeles', 'ca|california'],
  ['US', 'seattle', 'wa|washington'], ['US', 'austin', 'tx|texas'], ['US', 'boston', 'ma|massachusetts'],
  ['GB', 'london', 'greater london|lnd'], ['DE', 'berlin', 'berlin|be'],
  ['AU', 'sydney', 'new south wales|nsw'], ['SG', 'singapore', 'singapore'], ['JP', 'tokyo', 'tokyo|13'],
  ['CA', 'toronto', 'ontario|on'], ['CA', 'vancouver', 'british columbia|bc'],
]
function geography(value, label) {
  keys(value, ['name', 'country', 'city', 'state', 'postal_code', 'street_name', 'arrival_instructions', 'street_number', 'timezone', 'location_uid', 'is_remote'], 'native location')
  for (const key of ['name', 'country', 'city', 'state', 'postal_code', 'street_name', 'arrival_instructions', 'timezone', 'location_uid']) {
    need(value[key] == null || typeof value[key] === 'string', 'native location field malformed')
  }
  need(value.name === label && typeof value.is_remote === 'boolean'
    && (value.street_number == null || typeof value.street_number === 'string' || Number.isFinite(value.street_number)), 'native listing/detail location identity malformed')
  if (value.country == null || value.country === '') return null
  const code = value.country
  need(countryCode(code), 'native country code is invalid or unqualified')
  need(norm(value.name) === norm(regions.of(code)), 'native country/location geography contradicts the explicit country')
  const city = norm(value.city), rawState = norm(value.state), subdivision = /^([a-z]{2})-(.+)$/.exec(rawState)
  let state = rawState
  if (subdivision && countryCode(subdivision[1].toUpperCase())) {
    need(subdivision[1].toUpperCase() === code, 'native country/state subdivision geography contradicts the explicit country')
    state = subdivision[2]
  }
  need(!(code !== 'IN' && indiaCityStates[city]?.includes(state)), 'native country contradicts known India city/state geography')
  const foreignPair = foreignCityStates.find(([_country, knownCity, states]) => knownCity === city && states.split('|').includes(state))
  need(!foreignPair || foreignPair[0] === code, 'native country contradicts known foreign city/state geography')
  need(!(code !== 'IN' && /\bindia\b/i.test([value.name, value.city, value.state].join(' '))), 'native foreign country contradicts explicit India geography')
  return code
}
function substantiveSections(html, companyName) {
  need(text(html), 'native role details/content missing')
  const document = readVisibleNativeDocument(html, { strict: true })
  const h2s = document.nodes(node => node.tag === 'h2')
  const required = ['description', 'responsibilities', 'requirements']
  const markers = required.map(name => h2s.filter(node => heading(document.text(node)) === name))
  need(markers.every(nodes => nodes.length === 1) && markers.every((nodes, index) => !index || h2s.indexOf(markers[index - 1][0]) < h2s.indexOf(nodes[0])), 'native core content headings missing, reordered or ambiguous')
  const employerHeading = heading('About ' + companyName), lengths = {}
  for (let index = 0; index < required.length; index++) {
    const marker = markers[index][0], parts = []; let after = false, stopped = false
    const visit = node => {
      if (stopped) return
      if (typeof node === 'string') { if (after) parts.push(decodeNativeEntities(node)); return }
      if (node.inert || node.tag === 'script') return
      if (node === marker) { after = true; return }
      if (after && (node.tag === 'h2' || /^(?:p|h[1-6]|strong)$/.test(node.tag) && heading(document.text(node)) === employerHeading)) { stopped = true; return }
      node.children.forEach(visit)
    }
    visit(document.nodes(node => node.tag === 'root')[0])
    lengths[required[index]] = norm(parts.join(' ')).length
    need(lengths[required[index]] >= 100, 'native role ' + required[index] + ' content is incomplete or employer boilerplate only')
  }
  return lengths
}
function detail(value, post, config) {
  keys(value, ['name', 'department', 'url_comeet_hosted_page', 'employment_type', 'location', 'workplace_type', 'details'], 'native detail')
  need(value.name === post.name && value.department === post.department && value.workplace_type === post.workplace_type
    && (value.employment_type == null || typeof value.employment_type === 'string'), 'native detail/listing title/department identity changed')
  let url
  try { url = new URL(value.url_comeet_hosted_page) } catch { need(false, 'native position URL identity missing') }
  const parts = url.pathname.split('/').filter(Boolean)
  need(url.origin === 'https://www.comeet.com' && !url.username && !url.password && !url.search && !url.hash
    && parts.length === 5 && parts[0] === 'jobs' && parts[1] === config.nativeSlug && parts[2] === config.nativeCompanyUid
    && /^[a-z\d-]+$/i.test(parts[3]) && parts[4] === post.uid, 'native position UID/company/account URL identity mismatch')
  const country = geography(value.location, post.location), contentLengths = substantiveSections(value.details, config.companyName)
  return { uid: post.uid, country, listing: post, fields: value, contentLengths }
}

export const createFirstPartyComeetProxyScraper = sourceConfig => ({
  async run({ signal: callerSignal, now = () => new Date().toISOString(), maxJobs = 0, maxNativeRecords = 1000 } = {}) {
    const config = { ...sourceConfig, origin: 'https://' + sourceConfig.companyDomain }
    need(text(config.source) && text(config.companyName) && /^[a-z\d.-]+$/.test(config.companyDomain)
      && config.careersURL === config.origin + '/careers' && config.listingURL === config.origin + '/open-positions'
      && /^[a-z\d-]+$/i.test(config.nativeSlug || '') && uidPattern.test(config.nativeCompanyUid || '')
      && /^[a-f\d]{64}$/.test(config.primaryClientSHA256 || ''), 'qualified current source/client/native configuration required')
    const clientURL = new URL(config.primaryClientURL)
    need(clientURL.origin === config.origin && clientURL.pathname.startsWith('/build/assets/') && clientURL.pathname.endsWith('.js')
      && !clientURL.username && !clientURL.password && !clientURL.search && !clientURL.hash, 'qualified primary client URL required')
    need(Number.isSafeInteger(maxJobs) && maxJobs >= 0 && Number.isSafeInteger(maxNativeRecords) && maxNativeRecords >= 1 && maxNativeRecords <= 1000, 'invalid native output/inventory bounds')
    const checkedAt = typeof now === 'function' ? now() : now
    need(typeof checkedAt === 'string' && Number.isFinite(Date.parse(checkedAt)), 'invalid source check time')
    const signal = AbortSignal.any([...(callerSignal ? [callerSignal] : []), AbortSignal.timeout(180000)])
    const api = config.origin + '/api/v1/comeet/'
    let requests = 0, totalBytes = 0
    async function get(url, kind = 'html') {
      signal.throwIfAborted(); need(++requests <= 5000, 'native request bound exceeded')
      const response = await fetch(url, { method: 'GET', redirect: 'error', credentials: 'omit',
        signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), headers: {
          Accept: kind === 'json' ? 'application/json' : kind === 'js' ? 'application/javascript,text/javascript' : 'text/html',
          'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
        } })
      need(response.status === 200, 'HTTP unavailable: ' + response.status)
      need(response.url === url, 'native HTTP redirect identity changed')
      const mime = response.headers.get('content-type') || ''
      need((kind === 'json' ? /^application\/json\b/i : kind === 'js' ? /^(?:application|text)\/(?:javascript|x-javascript)\b/i : /^text\/html\b/i).test(mime), 'native response MIME contract changed')
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
      const body = Buffer.concat(chunks)
      if (kind === 'js') return body
      if (kind !== 'json') return body.toString('utf8')
      try { return JSON.parse(body.toString('utf8')) } catch { need(false, 'native JSON response cannot be parsed') }
    }
    async function snapshot() {
      corporate(await get(config.careersURL), config)
      listingPage(await get(config.listingURL), config)
      const client = await get(config.primaryClientURL, 'js')
      need(createHash('sha256').update(client).digest('hex') === config.primaryClientSHA256, 'current primary client/data consumer contract changed')
      const groups = await get(api + 'positions', 'json'), facets = {}
      for (const kind of ['departments', 'locations', 'types']) facets[kind] = await get(api + kind, 'json')
      const inventory = listing(groups, facets, maxNativeRecords), records = [], officeCountries = new Map()
      for (const post of inventory.rows) {
        const record = detail(await get(api + 'positions/' + post.uid, 'json'), post, config)
        const office = record.fields.location.location_uid
        if (office && record.country) {
          need(!officeCountries.has(office) || officeCountries.get(office) === record.country, 'native location UID has conflicting country geography')
          officeCountries.set(office, record.country)
        }
        rolePage(await get(config.listingURL + '/' + post.uid), config, post.uid)
        records.push(record)
      }
      return { departments: inventory.departments, facets: inventory.facets, records }
    }
    const initial = await snapshot(), closing = await snapshot()
    need(same(initial, closing), 'native inventory/location/full content changed during closing reconciliation')
    const india = initial.records.filter(record => record.country === 'IN')
    const jobs = (maxJobs ? india.slice(0, maxJobs) : india).map(record => {
      const value = record.fields, location = value.location, url = config.listingURL + '/' + record.uid
      return { source: config.source, company: config.companyName, jobId: record.uid, requisitionId: null, title: value.name,
        companyCareerPage: config.careersURL, companyDomain: config.companyDomain, country: 'India', city: location.city || null,
        state: location.state || null, location: location.name, sourceUrl: url, applyUrl: url, link: url,
        sourceDescription: value.details, jobDescription: value.details, nativeDescriptionHTML: value.details,
        nativeHostedUrl: value.url_comeet_hosted_page, nativePosition: value, nativeListing: record.listing, nativeLocation: location,
        postingDate: null, nativePublicationDate: null, nativeUpdatedAt: null, nativeEmployerBrand: config.companyName,
        nativeLegalEmployer: null, employmentType: value.employment_type, remoteStatus: value.workplace_type,
        sourceDetailComplete: true, sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
        sourcePostingStatusEvidence: 'current-public-primary-grouped-list-member+matching-primary-detail-API-UID+matching-current-public-role-component',
        applicationAccessVerified: false, applicationSubmitted: false, scrapedAt: checkedAt }
    })
    signal.throwIfAborted()
    Object.defineProperty(jobs, PROOF, { value: { source: config.source,
      binding: { officialURL: config.careersURL, currentListingURL: config.listingURL, nativeCompanyUid: config.nativeCompanyUid,
        nativeSlug: config.nativeSlug, currentPrimaryClientURL: config.primaryClientURL, currentPrimaryClientSHA256: config.primaryClientSHA256 },
      nativeInventory: { observedNativeRoles: initial.records.length, observedDepartmentGroups: initial.departments.length,
        fullContentRoles: initial.records.length, primaryRolePagesValidated: initial.records.length,
        unresolvedCountryPostings: initial.records.filter(record => !record.country).map(record => record.uid),
        selectedIndiaPostings: india.length, originalPublicationAndRevisionProvided: false, explicitNativeStatusFieldsProvided: false,
        snapshots: 2 } } })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: config.listingURL, firstParty: true, listingComplete: false,
      pagesFetched: 2, reportedTotal: null, indiaFacetCount: null, verifiedAt: checkedAt,
      reason: 'current-corporate-linked-primary-client-grouped-inventory-facets-all-API-details-public-role-components-and-closing-reconciled;original-publication-revision-and-native-status-fields-not-exposed;whole-company-scope-unverified' })
  },
})
