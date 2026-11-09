import { extractKulaNativeJobs, resolveKulaJobDescriptions } from '../utils/kulaFlight.js'
import { attachInventoryEvidence } from '../utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

// These are existing, individually verified corporate handoffs and numeric public
// routes. The API path is the unauthenticated path used by Kula's public client.
const SOURCES = Object.freeze({
  acko: { accountId: 1339, company: 'ACKO', careersUrl: 'https://www.acko.com/careers/jobs/' },
  plumhq: { accountId: 1297, company: 'Plum HQ', careersUrl: 'https://www.plumhq.com/careers' },
  goodera: { accountId: 1480, company: 'Goodera', careersUrl: 'https://www.goodera.com/about/contact-us' },
  clevertap: { accountId: 1350, company: 'CleverTap', careersUrl: 'https://clevertap.com/current-openings/' },
  avoma: { accountId: 1278, company: 'Avoma', careersUrl: 'https://www.avoma.com/careers' },
  lionsbot: { accountId: 1443, company: 'Lionsbot', careersUrl: 'https://www.lionsbot.com/careers' },
})
const PAGE_SIZE = 99
const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const requireNative = (condition, message) => {
  if (condition) return
  const error = new Error(`Kula public API: ${message}`)
  error.abortRetries = true; error.failureKind = 'parser_or_contract_error'
  throw error
}
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const nativeFields = row => ({ id: row.id, account_id: row.account_id, title: row.title, listed: row.listed,
  kind: row.kind, is_confidential: row.is_confidential, launch_at: row.launch_at, end_at: row.end_at,
  description: row.ats_job?.job_description, offices: row.ats_job?.offices })

// Tokenize active HTML contexts without evaluating scripts. Raw-text elements,
// template contents, comments and attribute lookalikes never establish identity.
function activePage(html, base) {
  requireNative(typeof html === 'string' && html.length > 0, 'HTML unavailable')
  const links = [], scripts = [], inert = []
  const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'noscript', 'noembed', 'noframes', 'iframe', 'plaintext'])
  const tokens = /<!--[\s\S]*?-->|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  let tag
  while (tokens.lastIndex < html.length) {
    if (raw.has(inert.at(-1))) {
      if (inert.at(-1) === 'plaintext') break
      const close = new RegExp(`</${inert.at(-1)}\\s*>`, 'gi'); close.lastIndex = tokens.lastIndex
      if (!close.exec(html)) break
      inert.pop(); tokens.lastIndex = close.lastIndex; continue
    }
    tag = tokens.exec(html); if (!tag) break
    if (!tag[1]) continue
    const name = tag[1].toLowerCase()
    if (tag[0].startsWith('</')) { if (name === 'template' && inert.at(-1) === name) inert.pop(); continue }
    if (inert.length) { if (name === 'template' || raw.has(name)) inert.push(name); continue }
    const attrs = new Map()
    for (const attr of tag[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+)))?/g)) {
      const key = attr[1].toLowerCase(); if (!attrs.has(key)) attrs.set(key, attr[2] ?? attr[3] ?? attr[4] ?? '')
    }
    if (name === 'a' || name === 'iframe') {
      const target = attrs.get(name === 'a' ? 'href' : 'src')
      if (target) { try { links.push(new URL(target.replace(/&amp;/g, '&'), base)) } catch { /* not a navigation target */ } }
    }
    if (name === 'script') {
      const close = /<\/script\s*>/gi; close.lastIndex = tokens.lastIndex
      const end = close.exec(html); requireNative(end, 'unterminated script')
      if (!attrs.has('src') && ['', 'module', 'text/javascript', 'application/javascript'].includes(attrs.get('type') || '')) {
        scripts.push(`<script>${html.slice(tokens.lastIndex, end.index)}</script>`)
      }
      tokens.lastIndex = close.lastIndex
    } else if (name === 'template' || raw.has(name)) inert.push(name)
  }
  return { links, scripts: scripts.join('') }
}

const regions = new Intl.DisplayNames(['en'], { type: 'region' })
function indiaOffice(office, source) {
  requireNative(office && typeof office === 'object' && !Array.isArray(office), 'office unavailable')
  for (const key of ['country', 'country_code', 'city', 'location', 'name', 'state', 'location_key']) {
    requireNative(office[key] == null || typeof office[key] === 'string', 'malformed office text')
  }
  // Historical, explicitly observed ACKO office binding. No other missing
  // country, remote label or city is inferred as India.
  if (source === 'acko' && office.id === 2011 && office.country === null && office.country_code === null
    && office.location === null && office.city === null && office.state === null && office.name === 'New Delhi'
    && office.location_key === 'remote(new delhi)' && office.remote === true && office.workplace === 'remote') return true
  const code = text(office.country_code).toUpperCase(), country = text(office.country)
  requireNative(/^[A-Z]{2}$/.test(code) && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)
    && regions.of(code) !== code && regions.of(code).toLowerCase() === country.toLowerCase(), 'unknown or conflicting native country')
  const location = text(office.location), city = text(office.city), state = text(office.state)
  const countryLabel = location.toLowerCase() === country.toLowerCase() || location.toLowerCase().endsWith(`, ${country.toLowerCase()}`)
  // Native Singapore office uses city-country followed by its region. Preserve
  // that observed shape without accepting a missing country for other offices.
  const singapore = code === 'SG' && city === 'Singapore' && state === 'Central Singapore' && location === 'Singapore, Central Singapore'
  requireNative(location && (countryLabel || singapore), 'full location conflicts with native country')
  requireNative(!city || location.split(',')[0].toLowerCase() === city.toLowerCase(), 'city conflicts with full location')
  return code === 'IN'
}

function nativeDate(value, label) {
  if (value == null) return null
  const parts = typeof value === 'string' && value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/)
  requireNative(parts && Number.isFinite(Date.parse(value)), `invalid ${label} date`)
  const [, year, month, day, hour, minute, second] = parts.map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  // Date.parse normalizes February 30 and 24:00 into a different date. Native
  // publication/closing instants must be valid before any UTC normalization.
  requireNative(month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    && hour < 24 && minute < 60 && second < 60, `invalid ${label} date`)
  return new Date(value).toISOString()
}

function validateRow(row, source, currentTime) {
  requireNative(Number.isSafeInteger(row?.id) && row.id > 0, 'numeric native identity required')
  requireNative(row.account_id === SOURCES[source].accountId && row.listed === true && row.is_confidential === false
    && ['external', 'internal_and_external'].includes(row.kind) && text(row.title), 'public account or role mismatch')
  const postingDate = nativeDate(row.launch_at, 'publication'), closingDate = nativeDate(row.end_at, 'closing')
  requireNative(!postingDate || Date.parse(postingDate) <= currentTime, 'future publication date')
  requireNative(Array.isArray(row.ats_job?.offices) && row.ats_job.offices.length > 0, 'native office scope unavailable')
  const indiaOffices = row.ats_job.offices.filter(office => indiaOffice(office, source))
  const raw = row.ats_job.job_description
  requireNative(raw == null || typeof raw === 'string', 'malformed description')
  requireNative(typeof raw !== 'string' || !/^\$[a-z\d]+$/i.test(raw.trim()), 'unresolved description reference')
  const detailComplete = hasSourceDescription({ jobDescription: raw })
  return { row, indiaOffices, postingDate, closingDate, detailComplete }
}

async function defaultFetch(url, { signal, json = false } = {}) {
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000)
  const response = await fetch(url, { signal: requestSignal, headers: { Accept: json ? 'application/json' : 'text/html' } })
  requireNative(response.ok && response.url === url, `HTTP failure or unexpected redirect at ${url}`)
  return json ? response.json() : response.text()
}

export async function runKulaPublicApi({ source, mapKulaJobs }, {
  fetchText = defaultFetch, fetchJson = (url, options) => defaultFetch(url, { ...options, json: true }),
  signal, maxPages = 1000, maxJobs = null, now = () => new Date().toISOString(),
} = {}) {
  requireNative(Object.hasOwn(SOURCES, source) && typeof mapKulaJobs === 'function', 'unsupported fixed source or mapper')
  requireNative(Number.isInteger(maxPages) && maxPages > 0 && maxPages <= 1000, 'invalid page cap')
  requireNative(maxJobs == null || (Number.isSafeInteger(maxJobs) && maxJobs >= 0), 'invalid job cap')
  signal?.throwIfAborted()
  const contract = SOURCES[source], boardUrl = `https://careers.kula.ai/${source}?jobs=true`
  const at = typeof now === 'function' ? now() : now, currentTime = Date.parse(at)
  requireNative(Number.isFinite(currentTime), 'invalid check time')
  const official = activePage(await fetchText(contract.careersUrl, { signal }), contract.careersUrl)
  requireNative(official.links.some(url => url.origin === 'https://careers.kula.ai' && url.pathname.replace(/\/$/, '') === `/${source}`
    && !url.username && !url.password && [...url.searchParams].every(([key, value]) => key === 'jobs' && value === 'true')), 'official handoff unavailable')
  signal?.throwIfAborted()
  const board = activePage(await fetchText(boardUrl, { signal }), boardUrl)
  const observed = resolveKulaJobDescriptions(board.scripts, extractKulaNativeJobs(board.scripts, { accountName: source }))
  observed.forEach(row => validateRow(row, source, currentTime))
  const byId = new Map(), validated = []
  let firstMeta, pagesFetched = 0
  for (let page = 1; page <= Math.min(firstMeta?.pages || 1, maxPages); page += 1) {
    signal?.throwIfAborted()
    const url = `https://careers.kula.ai/api/internal/ats_job_posts?accountName=${source}&page=${page}&type=ats_job_post.index&items=${PAGE_SIZE}`
    const payload = await fetchJson(url, { signal })
    requireNative(payload && Array.isArray(payload.data) && Array.isArray(payload.errors) && payload.errors.length === 0
      && payload.error == null && payload.success !== false
      && (payload.status == null || [200, 'ok', 'success'].includes(payload.status)), 'native error or invalid response')
    const m = payload.meta
    requireNative(m && Number.isSafeInteger(m.count) && m.count >= 0 && m.page === page && m.items === PAGE_SIZE
      && Number.isSafeInteger(m.pages) && m.pages >= 0 && m.pages <= 1000
      && (m.count === 0 ? m.pages <= 1 : m.pages === Math.ceil(m.count / PAGE_SIZE)), 'invalid pagination metadata')
    requireNative(!firstMeta || (firstMeta.count === m.count && firstMeta.pages === m.pages), 'pagination total changed')
    requireNative(payload.data.length === Math.min(PAGE_SIZE, Math.max(0, m.count - (page - 1) * PAGE_SIZE)), 'native page truncated')
    firstMeta ||= { ...m }; pagesFetched += 1
    for (const row of payload.data) {
      const entry = validateRow(row, source, currentTime)
      requireNative(!byId.has(row.id), 'duplicate native identity across pages')
      byId.set(row.id, row); validated.push(entry)
    }
  }
  signal?.throwIfAborted()
  const enumerated = pagesFetched >= Math.max(1, firstMeta.pages)
  requireNative(!enumerated || byId.size === firstMeta.count, 'native unique count does not reconcile')
  for (const row of observed) {
    const api = byId.get(row.id)
    requireNative((!enumerated && !api) || (api && canonical(nativeFields(row)) === canonical(nativeFields(api))), 'observed board role conflicts with API inventory')
  }
  const india = validated.filter(entry => entry.indiaOffices.length)
  const selected = maxJobs == null ? india : india.slice(0, maxJobs)
  const complete = enumerated && selected.length === india.length
  const jobs = selected.map(entry => {
    const { row, indiaOffices, detailComplete, postingDate, closingDate } = entry
    const result = mapKulaJobs([{ ...row, ats_job: { ...row.ats_job, offices: indiaOffices } }])
    requireNative(Array.isArray(result) && result.length === 1 && String(result[0].jobId) === String(row.id), 'mapper lost native India identity')
    const job = result[0], expectedUrl = `https://careers.kula.ai/${source}/${row.id}/?jobs=true`
    requireNative(job.applyUrl === expectedUrl && job.sourceUrl === expectedUrl, 'mapper changed canonical public identity')
    return { ...job, source, company: contract.company, title: text(row.title), country: 'India',
      location: [...new Set(indiaOffices.map(office => text(office.location) || office.name))].join('; '),
      city: text(indiaOffices[0].city) || (source === 'acko' && indiaOffices[0].id === 2011 ? 'New Delhi' : null),
      postingDate, closingDate, ...(closingDate ? { sourceClosingDateIsExact: true } : {}),
      jobDescription: detailComplete ? row.ats_job.job_description : null,
      sourceListingComplete: complete, sourceDetailComplete: detailComplete,
      ...(!detailComplete ? { sourceDetailFailureKind: 'missing-content' } : {}), link: expectedUrl, scrapedAt: new Date(currentTime).toISOString() }
  })
  return attachInventoryEvidence(jobs, { status: complete ? (firstMeta.count === 0 ? 'verified-empty' : 'complete-inventory') : 'discovery-only',
    surface: boardUrl, firstParty: true, listingComplete: complete, pagesFetched,
    reportedTotal: firstMeta.count, indiaFacetCount: enumerated ? india.length : null, verifiedAt: new Date(currentTime).toISOString(),
    reason: complete ? 'official-handoff-and-native-public-api-all-pages-reconciled' : 'native-public-api-capped-inventory' })
}
