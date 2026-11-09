import { readNativeDocument, extractActiveDescription, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const CORPORATE = 'https://billease.ph/careers/'
const BOARD = 'https://billease.careers-page.com/'
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const descendants = (node, predicate) => node.inert ? [] : [ ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)) ]
const valid = (condition, message) => { if (!condition) throw new BillEaseIdentityError(message) }
class BillEaseIdentityError extends Error {
  constructor(message) { super('BillEase native identity: ' + message); this.name = 'BillEaseIdentityError' }
}
const one = (nodes, name) => { valid(nodes.length === 1, 'expected one ' + name); return nodes[0] }
const uuid = value => typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)
const absolute = (value, base) => {
  let url
  try { url = new URL(value, base) } catch { throw new BillEaseIdentityError('invalid native URL') }
  valid(!url.username && !url.password && !url.hash && !url.port, 'unexpected native URL credentials or fragment')
  return url
}
const roleUrl = (value, id, apply = false) => {
  const url = absolute(value, BOARD)
  valid(url.href === BOARD + 'jobs/' + id + (apply ? '/apply' : ''), 'role/application URL identity conflicts')
  return url.href
}
const additionalHiringScope = (html, base) => {
  const document = readNativeDocument(html)
  const frames = node => node.activeFrame ? [node] : node.inert ? []
    : node.children.filter(child => typeof child !== 'string').flatMap(frames)
  // iframe nodes are intentionally inert to nodes(); traverse activeFrame before
  // the inert check. Missing src and CSS-hidden handoffs retain unknown scope.
  if (document.nodes(n => n.tag === 'root').flatMap(frames).length) return true
  return document.nodes(n => n.tag === 'a' && Object.hasOwn(n.attrs, 'href')
    || n.tag === 'script' && n.attrs.src && (!n.attrs.type || /^(?:module|(?:application|text)\/(?:javascript|ecmascript))$/i.test(n.attrs.type))).some(node => {
    let target
    try { target = new URL(node.tag === 'script' ? node.attrs.src : node.attrs.href, base) } catch { return true }
    // This menu enters an authenticated employee profile. It is not another
    // public vacancy inventory or a condition for reading public criteria.
    if (target.origin === new URL(BOARD).origin && target.pathname === '/candidate/profile'
      && target.search === '?tab=internal_jobs' && !target.hash) return false
    const external = target.origin !== new URL(BOARD).origin
    const hiring = /\b(?:careers?|jobs?|open roles|positions|join our team|opportunities)\b/i.test(document.text(node))
      || external && /(?:^|\.)(?:jobs?|careers?|recruit(?:ment)?)\./i.test(target.hostname)
      || external && /(?:^|\.)(?:ashbyhq\.com|smartrecruiters\.com|lever\.co|greenhouse\.io|workable\.com|myworkdayjobs\.com|careers-page\.com|icims\.com|jobvite\.com|bamboohr\.com|freshteam\.com|zohorecruit\.com|teamtailor\.com|applytojob\.com|darwinbox\.(?:in|com))$/i.test(target.hostname)
      || /\/(?:careers?|jobs?|vacancies|openings|join-us|work-with-us)(?:\/|$)/i.test(target.pathname)
    if (!hiring) return false
    if (target.username || target.password || target.port) return true
    if (target.origin === 'https://billease.ph' && /^\/careers\/?$/.test(target.pathname) && !target.search) return false
    if (target.origin !== new URL(BOARD).origin || target.hash) return true
    return !(target.pathname === '/' && (!target.search || /^\?page=[1-9]\d*$/.test(target.search))
      || /^\/jobs\/[\da-f-]{36}(?:\/apply)?$/.test(target.pathname) && !target.search)
  })
}
const corporateReference = html => {
  const document = readVisibleNativeDocument(html)
  valid(one(document.nodes(n => n.tag === 'title'), 'corporate title').raw.trim() === 'Careers at Billease | Join our team', 'corporate title changed')
  valid(one(document.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'corporate canonical').attrs.href === CORPORATE, 'corporate canonical changed')
  const advertised = document.nodes(n => n.tag === 'a' && n.attrs.href?.startsWith(BOARD + 'jobs/'))
  valid(advertised.length > 0 && advertised.every(n => /^https:\/\/billease\.careers-page\.com\/jobs\/[\da-f-]{36}$/.test(n.attrs.href)), 'visible employer role handoff unavailable')
  const loader = one(document.nodes(n => n.tag === 'script' && n.attrs.id === '__NUXT_DATA__'), 'current payload loader')
  valid(loader.attrs.type === 'application/json' && loader.attrs['data-ssr'] === 'true' && loader.attrs['data-src'], 'payload loader contract changed')
  const url = absolute(loader.attrs['data-src'], CORPORATE)
  valid(url.origin === 'https://billease.ph' && url.pathname === '/careers/_payload.json'
    && [...url.searchParams.keys()].length === 1 && uuid(url.searchParams.get('_b')), 'payload URL changed')
  valid(document.nodes(n => n.tag === 'link' && n.attrs.rel === 'preload' && n.attrs.as === 'fetch'
    && absolute(n.attrs.href, CORPORATE).href === url.href).length === 1, 'payload preload does not match loader')
  const body = one(document.nodes(n => n.tag === 'body'), 'corporate body')
  const counts = [...document.text(body).matchAll(/\b(\d+) open roles\b/gi)].map(match => Number(match[1]))
  valid(counts.length > 0 && new Set(counts).size === 1 && Number.isSafeInteger(counts[0]) && counts[0] <= 5000, 'corporate inventory count unavailable')
  return { url: url.href, count: counts[0], additional: additionalHiringScope(html, CORPORATE),
    advertised: advertised.map(n => ({ id: n.attrs.href.split('/').at(-1), title: document.text(one(descendants(n, child => child.tag === 'h3'), 'advertised role title')) })) }
}
const corporateRoles = (body, count) => {
  let payload
  try { payload = JSON.parse(body) } catch { throw new BillEaseIdentityError('corporate payload is not JSON') }
  valid(Array.isArray(payload), 'corporate payload unavailable')
  const ref = index => Number.isInteger(index) && index >= 0 && index < payload.length ? payload[index] : undefined
  const reactive = ref(payload[0]?.data)
  valid(Array.isArray(reactive) && reactive[0] === 'ShallowReactive', 'corporate payload state changed')
  const data = ref(reactive[1]), state = ref(data?.['billease-career-jobs']), rows = ref(state?.jobs)
  valid(ref(state?.failed) === false && Array.isArray(rows) && rows.length === count, 'corporate payload inventory count or state incomplete')
  const roles = new Map()
  for (const index of rows) {
    const row = ref(index), id = ref(row?.id), title = ref(row?.title), location = ref(row?.location), url = ref(row?.url)
    valid(uuid(id) && typeof title === 'string' && clean(title) && typeof location === 'string' && clean(location) && !roles.has(id), 'corporate inventory role identity invalid or duplicate')
    roleUrl(url, id)
    // Corporate presentation locations are retained for comparison, never used
    // to fill absent native countries or promote a role to India.
    roles.set(id, { id, title: clean(title), location: clean(location), url })
  }
  return roles
}
const verifyTenant = document => {
  const scripts = document.nodes(n => n.tag === 'script' && n.attrs['data-domain_slug'])
  valid(scripts.length >= 1 && scripts.every(n => n.attrs['data-domain_slug'] === 'billease'), 'native employer tenant conflicts')
  valid(document.nodes(n => n.tag === 'a' && n.attrs.href === 'https://billease.ph/' && document.text(n) === 'Company website').length > 0,
    'native reciprocal employer website unavailable')
  valid(document.nodes(n => n.tag === 'meta' && n.attrs.property === 'og:site_name' && n.attrs.content === 'Manatal').length === 1, 'native platform identity changed')
}
const parseNativePage = (html, page) => {
  const document = readVisibleNativeDocument(html), broad = readNativeDocument(html)
  verifyTenant(document)
  const body = one(document.nodes(n => n.tag === 'body'), 'native body'), matches = [...document.text(body).matchAll(/\b(\d+) Open Positions\b/g)]
  valid(matches.length > 0 && new Set(matches.map(match => match[1])).size === 1, 'native inventory total unavailable')
  const total = Number(matches[0][1]), pagers = document.nodes(n => cls(n, 'pagination-wrapper'))
  const pager = pagers.length ? one(pagers, 'native pagination') : null
  const label = pager && document.text(pager).match(/\bPage (\d+) of (\d+)\b/)
  const pages = label ? Number(label[2]) : total === 0 ? 1 : null
  valid(Number.isSafeInteger(total) && total >= 0 && total <= 3000 && pages === Math.max(1, Math.ceil(total / 30))
    && (!label || Number(label[1]) === page), 'native pagination count conflicts')
  const cards = document.nodes(n => n.tag === 'article' && cls(n, 'job-card'))
  valid(cards.length === Math.max(0, Math.min(30, total - (page - 1) * 30))
    && broad.nodes(n => n.tag === 'article' && cls(n, 'job-card')).length === cards.length, 'native pagination card count incomplete')
  if (page < pages) valid(descendants(pager, n => n.tag === 'a' && n.attrs.href === BOARD + '?page=' + (page + 1)).length > 0, 'native next pagination link unavailable')
  if (pager) for (const anchor of descendants(pager, n => n.tag === 'a')) {
    const target = absolute(anchor.attrs.href, BOARD)
    valid(target.origin === new URL(BOARD).origin && target.pathname === '/' && /^\?page=[1-9]\d*$/.test(target.search)
      && Number(target.searchParams.get('page')) <= pages, 'native pagination URL identity conflicts')
  }
  const roles = cards.map(card => {
    const anchor = one(descendants(card, n => n.tag === 'a' && cls(n, 'job-title-link')), 'native role link')
    const id = anchor.attrs['data-job-id'], title = clean(anchor.attrs['data-job-title']), country = clean(anchor.attrs['data-job-country']) || null
    valid(uuid(id) && title && document.text(anchor) === title, 'native role title or identity conflicts')
    const url = roleUrl(anchor.attrs.href, id), apply = one(descendants(card, n => n.tag === 'a' && n.attrs['data-type'] === 'apply'), 'role application')
    valid(apply.attrs['data-job-id'] === id, 'native application identity conflicts')
    roleUrl(apply.attrs.href, id, true)
    const list = descendants(card, n => n.tag === 'ul')[0]
    const locations = list ? descendants(list, n => n.tag === 'li') : []
    valid(locations.length > 0, 'native role location list unavailable')
    const location = clean(document.text(locations[0]))
    valid(!(country === 'India' && /\bPhilippines\b/i.test(location)) && !(country === 'Philippines' && /\bIndia\b/i.test(location)), 'native country identity conflicts')
    return { id, title, country, city: clean(anchor.attrs['data-job-city']) || null, location: location === '-' ? null : location,
      url, applyUrl: BOARD + 'jobs/' + id + '/apply' }
  })
  return { total, pages, roles, additional: additionalHiringScope(html, BOARD) }
}
const state = row => JSON.stringify([row?.id, row?.title, row?.country, row?.city, row?.location, row?.url, row?.applyUrl])
const equalRoles = (first, second) => first.size === second.size && [...first].every(([id, row]) => state(row) === state(second.get(id)))
export const inspectBillEasePublicDetail = (html, row) => {
  const document = readVisibleNativeDocument(html)
  verifyTenant(document)
  valid(clean(decodeNativeEntities(one(document.nodes(n => n.tag === 'title'), 'native detail title').raw)) === row.title + ' | billease', 'native detail title identity conflicts')
  const container = one(document.nodes(n => cls(n, 'single-job-content')), 'native full role')
  valid(document.text(one(descendants(container, n => cls(n, 'single-job-title')), 'native role heading')) === row.title, 'native detail heading/title identity conflicts')
  const applications = descendants(container, n => n.tag === 'a' && n.attrs['data-type'] === 'apply')
  valid(applications.length > 0 && applications.every(n => n.attrs['data-job-id'] === row.id
    && roleUrl(n.attrs.href, row.id, true) === row.applyUrl), 'native detail application identity conflicts')
  const block = one(descendants(container, n => cls(n, 'job-location')), 'native role location')
  const list = one(descendants(block, n => n.tag === 'ul'), 'native role location list')
  const items = descendants(list, n => n.tag === 'li').map(n => document.text(n))
  const nativeLocation = clean(items[0]) === '-' ? null : clean(items[0])
  const descriptions = descendants(container, n => cls(n, 'job-post-description'))
  const description = descriptions.length === 1 ? extractActiveDescription(document.text(descriptions[0])) : null
  const metadataCountry = nativeLocation && !/[\/;|]/.test(nativeLocation) ? /(?:^|,\s*)(India|Philippines)$/i.exec(nativeLocation)?.[1] : null
  const labels = descriptions.flatMap(description => descendants(description, n => ['p', 'li'].includes(n.tag)))
    .map(n => clean(document.text(n))).filter(text => /^Location\s*:/i.test(text))
  const labelledCountries = [...new Set(labels.map(text => /^Location\s*:\s*(India|Philippines)(?:\s*\([^)]*\))?\s*[·.]?$/i.exec(text)?.[1]?.toLowerCase()).filter(Boolean))]
  const explicit = [metadataCountry?.toLowerCase(), ...(labelledCountries.length === 1 ? labelledCountries : [])].filter(Boolean)
  const labelCountryWords = [...new Set(labels.flatMap(text => [...text.matchAll(/\b(?:India|Philippines)\b/gi)].map(match => match[0].toLowerCase())))]
  const country = explicit.length && new Set([...explicit, ...labelCountryWords]).size === 1 ? explicit[0] === 'india' ? 'India' : 'Philippines' : null
  const locationConflict = row.location && nativeLocation && clean(row.location) !== nativeLocation
  const listingConflict = row.country && country && row.country !== country
  const closed = /\b(?:this (?:role|position) (?:is|has been) (?:closed|filled)|no longer accepting applications)\b/i.test(document.text(container))
  const qualifiedCountry = !locationConflict && !listingConflict && !closed ? country : null
  return { id: row.id, title: row.title, sourceUrl: row.url, country: qualifiedCountry,
    countryEvidence: qualifiedCountry && metadataCountry ? 'native public detail worksite' : qualifiedCountry ? 'native full-description Location label' : null,
    nativeLocation, location: nativeLocation || country, sourceDescription: description,
    employmentType: clean(items[1]) || null, remoteStatus: clean(items[2]) || null,
    sourceDetailComplete: Boolean(description) && !closed, nativeClosed: closed }
}
const parseDetail = (html, row, reasons) => {
  const document = readVisibleNativeDocument(html)
  verifyTenant(document)
  valid(clean(decodeNativeEntities(one(document.nodes(n => n.tag === 'title'), 'native detail title').raw)) === row.title + ' | billease', 'native detail title identity conflicts')
  const container = one(document.nodes(n => cls(n, 'single-job-content')), 'native full role')
  valid(document.text(one(descendants(container, n => cls(n, 'single-job-title')), 'native role heading')) === row.title, 'native detail heading/title identity conflicts')
  const applications = descendants(container, n => n.tag === 'a' && n.attrs['data-type'] === 'apply')
  valid(applications.length >= 1 && applications.every(n => n.attrs['data-job-id'] === row.id && roleUrl(n.attrs.href, row.id, true) === row.applyUrl), 'native detail application identity conflicts')
  const block = one(descendants(container, n => cls(n, 'job-location')), 'native role location')
  const list = one(descendants(block, n => n.tag === 'ul'), 'native role location list')
  const items = descendants(list, n => n.tag === 'li').map(n => document.text(n)), location = clean(items[0])
  if (!/(?:^|,\s*)India$/i.test(location) || /[\/;|]|\bPhilippines\b/i.test(location) || row.location && clean(row.location) !== location) {
    reasons.add('native-detail-country-or-location-unresolved:' + row.id); return null
  }
  const descriptions = descendants(container, n => cls(n, 'job-post-description'))
  const description = descriptions.length === 1 ? extractActiveDescription(document.text(descriptions[0])) : null
  if (!description) { reasons.add('native-description-unavailable:' + row.id); return null }
  if (/\b(?:this (?:role|position) (?:is|has been) (?:closed|filled)|no longer accepting applications)\b/i.test(document.text(container))) {
    reasons.add('native-role-closed:' + row.id); return null
  }
  return { source: 'billease', company: 'BillEase', nativeEmployerBrand: 'BillEase', jobId: row.id, requisitionId: null,
    title: row.title, sourceUrl: row.url, applyUrl: row.applyUrl, link: row.applyUrl,
    location, city: row.city && location.startsWith(row.city + ',') ? row.city : null,
    country: 'India', employmentType: clean(items[1]) || null, remoteStatus: clean(items[2]) || null,
    sourceDescription: description, jobDescription: description, sourceDetailComplete: true,
    postingDate: null, closingDate: null, sourcePublicationDateUnavailable: true,
    sourceNativeEmployerEvidence: { tenant: 'billease', reciprocalWebsite: 'https://billease.ph/', legalEmployer: null },
    sourceNativeCountryEvidence: { nativeListing: row.country, nativeDetail: location },
    companyCareerPage: CORPORATE, companyDomain: 'billease.ph', atsPlatform: 'manatal-careers-page' }
}
const defaultFetchPage = async (url, init) => {
  const response = await fetch(url, { ...init, redirect: 'error' })
  const length = Number(response.headers.get('content-length') || 0)
  valid(length <= 4 * 1024 * 1024, 'native response size exceeds limit')
  return { status: response.status, url: response.url, body: await response.text(), contentType: response.headers.get('content-type') }
}
export const createBillEaseNativeInventory = (defaults = {}) => ({
  async run(options = {}) {
    const settings = { ...defaults, ...options }, signal = AbortSignal.any([AbortSignal.timeout(180000), ...(settings.signal ? [settings.signal] : [])]), fetchPage = settings.fetchPage || defaultFetchPage
    const wait = promise => new Promise((resolve, reject) => {
      const finish = (fn, value) => { signal.removeEventListener('abort', abort); fn(value) }, abort = () => finish(reject, signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error))
      if (signal.aborted) abort()
    })
    const now = settings.now || (() => new Date().toISOString()), maxJobs = settings.maxJobs ?? 0, reasons = new Set()
    valid(Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'invalid job output limit')
    valid(!(settings.fetchText || settings.fetchJson) || settings.fetchPage, 'current native transport requires fetchPage')
    signal?.throwIfAborted()
    let requests = 0
    const pageAt = async (url, json = false) => {
      signal?.throwIfAborted()
      const response = await wait(fetchPage(url, { method: 'GET', signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
        headers: { Accept: json ? 'application/json' : 'text/html' } }))
      signal?.throwIfAborted(); requests++
      valid(response.url === url, 'native response redirected')
      if (response.status !== 200) throw Object.assign(Error('BillEase public native HTTP ' + response.status), { httpStatus: response.status })
      valid(typeof response.body === 'string' && Buffer.byteLength(response.body) <= 4 * 1024 * 1024
        && (json ? /^application\/json\b/i : /^text\/html\b/i).test(response.contentType || ''), 'native response format changed')
      return response.body
    }
    const collectCorporate = async () => {
      const reference = corporateReference(await pageAt(CORPORATE))
      if (reference.additional) reasons.add('additional-corporate-hiring-scope')
      const roles = corporateRoles(await pageAt(reference.url, true), reference.count)
      valid(reference.advertised.every(row => roles.get(row.id)?.title === row.title), 'corporate advertised role/payload identity conflicts')
      return { reference, roles }
    }
    const collectNative = async () => {
      const roles = new Map()
      let total, pages
      for (let page = 1; page <= (pages ?? 1); page++) {
        const result = parseNativePage(await pageAt(page === 1 ? BOARD : BOARD + '?page=' + page), page)
        if (result.additional) reasons.add('additional-native-hiring-scope')
        valid(total == null || result.total === total && result.pages === pages, 'native pagination inventory totals changed')
        total = result.total; pages = result.pages
        for (const row of result.roles) { valid(!roles.has(row.id), 'duplicate native role identity'); roles.set(row.id, row) }
      }
      valid(roles.size === total, 'native inventory total did not reconcile')
      return roles
    }
    const corporate = await collectCorporate(), initial = await collectNative(), jobs = new Map()
    const reconcile = (corporateRows, nativeRows) => {
      if (corporateRows.size !== nativeRows.size || [...corporateRows].some(([id, row]) => nativeRows.get(id)?.title !== row.title)) reasons.add('corporate-native-inventory-differs')
      for (const [id, row] of corporateRows) {
        const country = nativeRows.get(id)?.country
        if (['India', 'Philippines'].includes(country) && !new RegExp('\\b' + country + '\\b', 'i').test(row.location)) reasons.add('corporate-native-country-differs:' + id)
      }
    }
    reconcile(corporate.roles, initial)
    const publicDetailObservations = [], publicDetailFailures = [], qualifiedCountries = new Map()
    let detailRateLimited = false
    for (const row of initial.values()) {
      if (row.country !== 'India') {
        if (row.country !== 'Philippines') {
          if (detailRateLimited) {
            publicDetailFailures.push({ id: row.id, stage: 'public-native-detail', httpStatus: null,
              notAttemptedAfterRateLimit: true, message: 'Current native detail HTTP429 stopped further unresolved detail requests; country remains unknown' })
            reasons.add('native-country-unresolved:' + row.id)
            continue
          }
          try {
            // Read only public role pages. The employee profile and candidate
            // application session are deliberately outside this extraction.
            if (!settings.fetchPage) await wait(new Promise(resolve => setTimeout(resolve, 600)))
            const detail = inspectBillEasePublicDetail(await pageAt(row.url), row)
            publicDetailObservations.push(detail)
            if (detail.country && detail.sourceDetailComplete) qualifiedCountries.set(row.id, detail.country)
            if (detail.country === 'India' && detail.sourceDetailComplete) jobs.set(row.id, {
              source: 'billease', company: 'BillEase', jobId: row.id, requisitionId: null, title: row.title,
              sourceUrl: row.url, applyUrl: row.applyUrl, link: row.applyUrl, country: 'India', location: detail.location, city: null,
              employmentType: detail.employmentType, remoteStatus: detail.remoteStatus,
              sourceDescription: detail.sourceDescription, jobDescription: detail.sourceDescription, sourceDetailComplete: true,
              postingDate: null, closingDate: null, sourcePublicationDateUnavailable: true,
              sourceNativeCountryEvidence: { nativeListing: row.country, nativeDetail: detail.nativeLocation, method: detail.countryEvidence },
              companyCareerPage: CORPORATE, companyDomain: 'billease.ph', atsPlatform: 'manatal-careers-page',
            })
          } catch (error) {
            signal.throwIfAborted()
            publicDetailFailures.push({ id: row.id, stage: 'public-native-detail', message: error.message, httpStatus: error.httpStatus || null })
            if (error.httpStatus === 429) detailRateLimited = true
          }
          if (!qualifiedCountries.has(row.id)) reasons.add('native-country-unresolved:' + row.id)
        }
        continue
      }
      const job = parseDetail(await pageAt(row.url), row, reasons)
      if (job) jobs.set(row.id, job)
    }
    for (const [id, country] of qualifiedCountries) {
      const advertised = corporate.roles.get(id)
      if (advertised && !new RegExp('\\b' + country + '\\b', 'i').test(advertised.location)) reasons.add('corporate-native-country-differs:' + id)
    }
    let closingCorporate = null, closing = null, closingFailure = null
    try {
      closingCorporate = await collectCorporate(); closing = await collectNative()
      reconcile(closingCorporate.roles, closing)
      if (corporate.reference.url !== closingCorporate.reference.url || JSON.stringify([...corporate.roles]) !== JSON.stringify([...closingCorporate.roles])) reasons.add('closing-corporate-inventory-changed')
      if (!equalRoles(initial, closing)) reasons.add('closing-native-inventory-changed')
    } catch (error) {
      signal.throwIfAborted()
      if (error instanceof BillEaseIdentityError) throw error
      closingFailure = { message: error.message, httpStatus: error.httpStatus || null, transportCode: error.cause?.code || error.code || null }
      reasons.add('closing-public-inventory-unavailable:' + (error.httpStatus || error.cause?.code || error.name))
    }
    const healthy = [...jobs].filter(([id]) => !closing || state(initial.get(id)) === state(closing.get(id))).map(([, job]) => job)
    const selected = maxJobs ? healthy.slice(0, maxJobs) : healthy
    if (selected.length !== healthy.length) reasons.add('source-job-limit')
    const complete = reasons.size === 0, verifiedAt = new Date(now()).toISOString()
    for (const job of selected) Object.assign(job, { scrapedAt: verifiedAt, sourceListingComplete: complete, sourceScopeComplete: complete, lifecycleCleanupAllowed: complete })
    attachInventoryEvidence(selected, { status: complete ? initial.size ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
      firstParty: true, surface: BOARD, listingComplete: complete, reportedTotal: complete ? initial.size : null,
      indiaFacetCount: complete ? healthy.length : null, pagesFetched: requests, verifiedAt,
      reason: complete ? 'billease-current-native-inventory-reconciled' : 'billease-native-incomplete:' + [...reasons].join(';') })
    Object.defineProperty(selected, 'nativeInventorySummary', { value: { corporateRoleCount: corporate.roles.size, nativeRoleCount: initial.size,
      closingCorporateRoleCount: closingCorporate?.roles.size ?? null, closingNativeRoleCount: closing?.size ?? null,
      closingFailure, closingInventoryMatches: closing ? equalRoles(initial, closing) : false,
      unresolvedCountryCount: [...initial.values()].filter(row => !['India', 'Philippines'].includes(row.country) && !qualifiedCountries.has(row.id)).length,
      publicDetailObservations, publicDetailFailures,
      nativeRoleIds: [...initial.keys()], corporateRoleIds: [...corporate.roles.keys()], lifecycleCleanupAllowed: complete } })
    if (settings.onReport) await wait(settings.onReport({ source: 'billease', inventoryEvidence: selected[Symbol.for('jobverify.inventory-evidence')], ...selected.nativeInventorySummary }))
    return selected
  },
})
