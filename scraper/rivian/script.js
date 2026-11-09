import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'rivian'
export const COMPANY = 'Rivian'
export const OFFICIAL_CAREERS_URL = 'https://careers.rivian.com/work'
export const SEARCH_URL = 'https://careers.rivian.com/careers-home/jobs'
export const JOBS_URL = 'https://careers.rivian.com/api/jobs'
const PAGE_SIZE = 100
const text = value => typeof value === 'string' && value.trim().length > 0
const fail = reason => { throw new Error('Rivian native inventory: ' + reason) }
const regions = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
const countryName = code => {
  if (typeof code !== 'string' || !/^[A-Z]{2}$/.test(code) || ['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO', 'EZ'].includes(code)) fail('invalid native country code')
  const name = regions.of(code)
  if (!name) fail('unknown native country code')
  return name
}
const writtenCountries = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = regions.of(code)
  if (name) { const canonical = new Intl.Locale('und-' + code).region; writtenCountries.set(name.toLowerCase(), canonical); writtenCountries.set(code.toLowerCase(), canonical) }
}
for (const [label, code] of [['USA', 'US'], ['United States of America', 'US'], ['UK', 'GB']]) writtenCountries.set(label.toLowerCase(), code)
const publishedRegions = [
  ['US', /(?:^|[\s,(])(?:Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington(?: D\.?C\.?)?|West Virginia|Wisconsin|Wyoming|AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s*$/i],
  ['CA', /(?:^|[\s,(])(?:Ontario|Quebec|British Columbia|Alberta|Manitoba|New Brunswick|Newfoundland and Labrador|Nova Scotia|Prince Edward Island|Saskatchewan)\s*$/i],
]
const validatePublishedGeography = (value, allowedCountries) => {
  if (value == null || value === '') return
  if (typeof value !== 'string') fail('invalid published geography')
  for (const fragment of value.split(/[;,()]/).map(part => part.trim()).filter(Boolean)) {
    const tail = fragment
    const candidates = new Set()
    const declared = writtenCountries.get(tail.toLowerCase())
    if (declared) candidates.add(declared)
    for (const [code, pattern] of publishedRegions) if (pattern.test(tail)) candidates.add(code)
    // A single tail token can mean a state or country (Georgia, CA, IN).
    // The native postal country disambiguates that token; independent explicit
    // assertions such as India plus United States must still all agree.
    if (candidates.size > 1) {
      const matchingTail = [...candidates].filter(code => allowedCountries.has(code))
      if (matchingTail.length) { candidates.clear(); for (const code of matchingTail) candidates.add(code) }
    }
    if (/\bIndia\b/i.test(fragment)) candidates.add('IN')
    if (candidates.size && ![...candidates].every(code => allowedCountries.has(code))) fail('published geography contradicts native country/postal locations: ' + value + ' / ' + [...allowedCountries].join(','))
  }
}

const activeSource = value => typeof value !== 'string' ? value : value.replace(/<([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi, (tag, name, attrs) => {
  // The shared active-content reader handles hidden/template/style rules.
  // Mark the native inert attribute as hidden for the presence check only.
  const inert = [...attrs.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g)].some(match => match[1].toLowerCase() === 'inert')
  return inert ? tag.replace(new RegExp('^<' + name), '<' + name + ' hidden') : tag
})

const publication = value => {
  if (value == null || value === '') return null
  if (typeof value !== 'string') fail('invalid native publication')
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):?(\d{2}))$/.exec(value)
  if (!match) fail('invalid native publication schema')
  const [, year, month, day, hour, minute, second, , offsetHour = '0', offsetMinute = '0'] = match
  const leap = +year % 4 === 0 && (+year % 100 !== 0 || +year % 400 === 0)
  if (+month < 1 || +month > 12 || +day < 1 || +day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][+month - 1]
    || +hour > 23 || +minute > 59 || +second > 59 || +offsetHour > 23 || +offsetMinute > 59 || !Number.isFinite(Date.parse(value))) fail('invalid native calendar date')
  return value
}
const validateEnvelope = payload => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.error || payload.success === false || payload.ok === false || payload.failed === true || payload.hasError === true
    || (Array.isArray(payload.errors) ? payload.errors.length : payload.errors)
    || (payload.status != null && ![200, '200', 'ok', 'success'].includes(payload.status))
    || (payload.statusCode != null && payload.statusCode !== 200) || payload.hasMore === true || payload.nextPage || payload.nextCursor) fail('failed native response envelope')
  if (!Array.isArray(payload.jobs) || !Number.isSafeInteger(payload.totalCount) || payload.totalCount < 0 || payload.count !== payload.totalCount) fail('missing native count contract')
}
const validatePage = (page, url) => {
  if (page?.status !== 200 || page.url !== url || typeof page.html !== 'string' || page.html.length > 4 * 1024 * 1024) fail('first-party handoff HTTP failure or redirect')
  const doc = document(page.html)
  for (const tag of ['html', 'body']) {
    const nodes = doc.nodes(node => node.tag === tag)
    if (nodes.length !== 1) fail('first-party page identity changed')
    doc.outer(nodes[0])
  }
  const titles = [...page.html.matchAll(/<title\b[^>]*>([^<]*)<\/title>/gi)]
  const canonical = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
  if (titles.length !== 1 || titles[0][1].trim() !== 'Rivian Automotive' || canonical.length !== 1 || canonical[0].attrs.href !== url) fail('first-party page identity changed')
  if (url === OFFICIAL_CAREERS_URL) {
    const links = doc.nodes(node => node.tag === 'a' && /Search\s+Jobs/i.test(doc.text(node)))
    let exactSearch = false
    for (const node of links) {
      let target
      try { target = new URL(node.attrs.href, url) } catch { fail('invalid official jobs handoff') }
      if (target.origin !== 'https://careers.rivian.com' || target.username || target.password || target.search || target.hash
        || !['/careers-home/jobs', '/jobs'].includes(target.pathname)) fail('official jobs handoff changed')
      if (target.href === SEARCH_URL) exactSearch = true
    }
    if (!exactSearch) fail('official jobs handoff missing')
  } else {
    const scripts = doc.nodes(node => node.tag === 'script' && /^\s*window\.searchConfig\s*=/.test(node.raw))
    if (scripts.length !== 1) fail('current native search scope configuration missing')
    const match = /^\s*window\.searchConfig\s*=\s*([\s\S]*);\s*$/.exec(scripts[0].raw)
    let config
    try { config = JSON.parse(match?.[1]) } catch { fail('malformed native search scope configuration') }
    const override = config.searchOverride, query = config.query
    if (config.path !== '/careers-home/jobs' || config.searchListingOverride !== null
      || !override || Object.keys(override).length !== 1 || override.tags2 !== 'Rivian Automotive'
      || !query || Object.keys(query).length !== 1 || decodeURIComponent(query.tags2 || '') !== 'Rivian Automotive') fail('current native search scope differs from the verified employer filter')
  }
}

const validateRecord = wrapper => {
  const data = wrapper?.data, meta = data?.meta_data, icims = meta?.icims, site = icims?.primary_posted_site_object
  if (!data || !/^[1-9]\d*$/.test(data.req_id) || data.slug !== data.req_id || !text(data.title)
    || (data.hiring_organization != null && data.hiring_organization !== COMPANY)
    || data.ats_code !== 'icims' || data.internal !== false || data.searchable !== true || data.applyable !== true
    || !Array.isArray(data.tags2) || data.tags2.length !== 1 || data.tags2[0] !== 'Rivian Automotive'
    || meta?.client_code !== 'rivian' || icims?.jps_is_public !== true || icims?.config_keys?.['ccc.attract.portal.url'] !== 'https://careers.rivian.com'
    || !/^[a-z]{2}-careers-rivian$/.test(site?.site) || (site.tenantId != null && site.tenantId !== '13315')) fail('unverified employer, account, public status or identity')
  let apply, canonical
  try { apply = new URL(data.apply_url); canonical = new URL(meta.canonical_url) } catch { fail('missing native role URL') }
  if (apply.origin !== `https://${site.site}.icims.com` || apply.username || apply.password || apply.hash || apply.search || apply.pathname !== `/jobs/${data.req_id}/login`
    || canonical.origin !== 'https://careers.rivian.com' || canonical.username || canonical.password || canonical.hash
    || canonical.pathname !== '/jobs/' + data.req_id || [...canonical.searchParams.keys()].some(key => key !== 'lang')
    || canonical.searchParams.getAll('lang').length !== 1 || canonical.searchParams.get('lang') !== data.language) fail('native application or canonical identity mismatch')
  const primaryCountry = countryName(data.country_code)
  if (data.country !== primaryCountry) fail('contradictory primary country')
  const locations = meta.googlejobs?.derivedInfo?.locations
  if (!Array.isArray(locations) || !locations.length || typeof data.multipleLocations !== 'boolean'
    || data.multipleLocations !== (locations.length > 1)) fail('missing or truncated native location inventory')
  const located = locations.map(location => {
    const address = location?.postalAddress
    if (!address || typeof address !== 'object' || Array.isArray(address)) fail('missing postal location')
    const country = countryName(address.regionCode)
    for (const field of ['locality', 'administrativeArea']) if (address[field] != null && typeof address[field] !== 'string') fail('malformed native location')
    return { city: address.locality?.trim() || null, state: address.administrativeArea?.trim() || null, country, code: address.regionCode }
  })
  if (!located.some(location => location.code === data.country_code)) fail('primary country missing from full native location inventory')
  const primaryCodes = new Set([data.country_code])
  validatePublishedGeography(data.location_name, primaryCodes)
  validatePublishedGeography(data.short_location, data.multipleLocations ? new Set(located.map(location => location.code)) : primaryCodes)
  validatePublishedGeography(data.full_location, new Set(located.map(location => location.code)))
  if (data.description != null && typeof data.description !== 'string') fail('invalid native employer content')
  if (data.categories != null && (!Array.isArray(data.categories) || data.categories.some(item => !item || !text(item.name)))) fail('invalid native department schema')
  publication(data.posted_date)
  return { data, locations: located }
}
const pageUrl = page => `${JOBS_URL}?page=${page}&limit=${PAGE_SIZE}&sortBy=relevance&descending=false&internal=false&tags2=Rivian%20Automotive&domain=rivian.jibeapply.com`

export const createRivianScraper = () => ({
  async run({ fetchJson, fetchPage, fetchImpl = fetch, signal, timeoutMs = 120000, maxPages = 100, now = () => new Date().toISOString() } = {}) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000 || !Number.isSafeInteger(maxPages) || maxPages < 1) fail('invalid source budget')
    signal?.throwIfAborted()
    const deadline = new AbortController()
    const combined = composeAbortSignals(signal, deadline.signal)
    const timer = setTimeout(() => deadline.abort(Error('Rivian source timed out')), timeoutMs)
    let onAbort
    const aborted = new Promise((_, reject) => { onAbort = () => reject(combined.reason); combined.addEventListener('abort', onAbort, { once: true }) })
    const transport = fetchJson || (async (url, options) => {
      const response = await fetchImpl(url, { signal: options.signal, headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)' } })
      if (response.status !== 200 || response.url !== url) fail('HTTP failure or unverified redirect')
      return response.json()
    })
    const pageTransport = fetchPage || (async (url, options) => {
      const response = await fetchImpl(url, { signal: options.signal, headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' } })
      return { status: response.status, url: response.url, html: await response.text() }
    })
    try {
      const collect = async () => {
        for (const url of [OFFICIAL_CAREERS_URL, SEARCH_URL]) {
          combined.throwIfAborted()
          const page = await pageTransport(url, { signal: combined })
          combined.throwIfAborted()
          validatePage(page, url)
        }
        const records = [], ids = new Set()
        let total, pagesFetched = 0
        do {
          combined.throwIfAborted()
          if (pagesFetched >= maxPages) fail('page limit leaves incomplete inventory')
          const payload = await transport(pageUrl(pagesFetched + 1), { signal: combined })
          combined.throwIfAborted()
          validateEnvelope(payload)
          if (total != null && total !== payload.totalCount) fail('native total changed during enumeration')
          total = payload.totalCount
          if (payload.jobs.length !== Math.min(PAGE_SIZE, total - records.length)) fail('truncated or oversized native page')
          for (const wrapper of payload.jobs) {
            const record = validateRecord(wrapper)
            if (ids.has(record.data.req_id)) fail('duplicate native job identity')
            ids.add(record.data.req_id); records.push(record)
          }
          pagesFetched++
        } while (records.length < total)
        const checkedAt = now()
        if (typeof checkedAt !== 'string' || !Number.isFinite(Date.parse(checkedAt))) fail('invalid check time')
        const jobs = records.flatMap(({ data, locations }) => {
          const india = locations.filter(location => location.code === 'IN')
          if (!india.length) return []
          const labels = india.map(location => [...new Set([location.city, location.state, location.country].filter(Boolean))].join(', '))
          const activeDescription = extractActiveDescription(activeSource(data.description))
          const description = activeDescription && hasSourceDescription({ sourceDescription: activeDescription }) ? data.description : null
          return [{ source: SOURCE, company: COMPANY, companyCareerPage: OFFICIAL_CAREERS_URL, atsPlatform: 'icims-jibe',
            jobId: data.req_id, requisitionId: data.req_id, title: data.title, location: labels[0], locations: labels,
            city: india[0].city, state: india[0].state, country: 'India',
            sourceUrl: data.meta_data.canonical_url, applyUrl: data.apply_url, link: data.apply_url,
            department: Array.isArray(data.categories) ? data.categories.map(item => item.name).join(' / ') || null : null, employmentType: data.employment_type || null,
            jobDescription: description, sourceDescription: description, postingDate: publication(data.posted_date), closingDate: null, scrapedAt: checkedAt }]
        })
        const complete = jobs.every(hasSourceDescription)
        if (!complete) for (const job of jobs) job.sourceListingComplete = false
        return attachInventoryEvidence(jobs, { status: complete ? total ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
          surface: JOBS_URL, firstParty: true, listingComplete: complete, pagesFetched, reportedTotal: total,
          indiaFacetCount: jobs.length, verifiedAt: checkedAt,
          reason: complete ? 'all-public-rivian-automotive-pages-native-totals-and-primary-secondary-countries-reconciled' : 'selected-role-description-unavailable' })
      }
      return await Promise.race([collect(), aborted])
    } finally { clearTimeout(timer); combined.removeEventListener('abort', onAbort) }
  },
})
export const run = async (options = {}) => createRivianScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
