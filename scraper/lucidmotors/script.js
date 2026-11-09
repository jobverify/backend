import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { document, decode } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lucidmotors'
export const COMPANY = 'Lucid Motors'
export const OFFICIAL_CAREERS_URL = 'https://lucidmotors.com/careers'
export const SEARCH_URL = OFFICIAL_CAREERS_URL + '/search'
export const JOBS_URL = 'https://boards-api.greenhouse.io/v1/boards/lucidmotors/jobs?content=true'
export const DEPARTMENTS_URL = 'https://boards-api.greenhouse.io/v1/boards/lucidmotors/departments?render_as=tree'
export const OFFICES_URL = 'https://boards-api.greenhouse.io/v1/boards/lucidmotors/offices?render_as=tree'
const fail = message => { throw new Error('Lucid Motors ' + message) }
const clean = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
const countries = new Map()
const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = names.of(code)
  if (name && !['ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO'].includes(code)) countries.set(name.toLowerCase(), code)
}
for (const [alias, code] of [['US','US'],['USA','US'],['UK','GB'],['UAE','AE'],['Taiwan, Republic Of China','TW']]) countries.set(alias.toLowerCase(), code)
const country = value => countries.get(clean(value).toLowerCase()) || null
const tailCountry = value => country(clean(value).split(',').at(-1))
const validateEnvelope = value => {
  if (!value || value.error != null || value.success === false || value.ok === false || value.hasError === true || value.failed === true
    || (value.errors != null && (!Array.isArray(value.errors) || value.errors.length))
    || (value.status !== undefined && ![200, '200', 'ok', 'success'].includes(value.status))
    || (value.statusCode !== undefined && value.statusCode !== 200) || value.hasMore || value.nextPage || value.nextCursor) fail('failed or paginated native envelope')
}
const validDate = value => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return false
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value)
  if (!m) return false
  const y = +m[1], month = +m[2], day = +m[3], leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
  return month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}
const roleUrl = (value, id) => {
  let url; try { url = new URL(value) } catch { fail('invalid role URL') }
  if (url.origin !== 'https://lucidmotors.com' || url.username || url.password || url.hash
    || url.pathname !== '/careers/search/' + id || [...url.searchParams.keys()].length !== 1 || url.searchParams.get('gh_jid') !== id) fail('role URL identity mismatch')
  return url.href
}
export const parseNativeInventory = (payload, departments, offices) => {
  for (const value of [payload, departments, offices]) validateEnvelope(value)
  if (!Array.isArray(payload.jobs) || payload.meta?.total !== payload.jobs.length || !Number.isSafeInteger(payload.meta.total)
    || !Array.isArray(departments.departments) || !Array.isArray(offices.offices)) fail('incomplete native inventory')
  const officeById = new Map(), locationCountries = new Map()
  const walkOffices = (nodes, inherited = null, depth = 0) => {
    if (depth > 20 || !Array.isArray(nodes)) fail('invalid office tree')
    for (const office of nodes) {
      if (!Number.isSafeInteger(office.id) || officeById.has(office.id) || !Array.isArray(office.children)) fail('invalid or duplicate office identity')
      const declared = tailCountry(office.location)
      // A child label can also be a state name: Georgia, United States is
      // an observed US office, not a second country container. Its explicit
      // location disambiguates the label; unqualified country names do not.
      const ownCountry = inherited && declared ? null : country(office.name)
      if ((ownCountry && declared && ownCountry !== declared) || (inherited && ownCountry && inherited !== ownCountry)
        || (inherited && declared && inherited !== declared)) fail('contradictory office geography')
      const resolved = inherited || ownCountry || declared
      officeById.set(office.id, { country: resolved, location: clean(office.location) || clean(office.name) })
      if (resolved) for (const label of [office.name, office.location].map(clean).filter(Boolean)) {
        const previous = locationCountries.get(label)
        if (previous && previous !== resolved) fail('ambiguous office location')
        locationCountries.set(label, resolved)
      }
      walkOffices(office.children, resolved, depth + 1)
    }
  }
  walkOffices(offices.offices)
  const departmentJobs = new Map(), departmentIds = new Set()
  const walkDepartments = (nodes, depth = 0) => {
    if (!Array.isArray(nodes) || depth > 20) fail('invalid department tree')
    for (const node of nodes) {
      if (!Number.isSafeInteger(node.id) || node.id < 0 || departmentIds.has(node.id) || !Array.isArray(node.jobs) || !Array.isArray(node.children)) fail('invalid department identity')
      departmentIds.add(node.id)
      for (const job of node.jobs) { const id = String(job.id); if (departmentJobs.has(id)) fail('duplicate departmental role'); departmentJobs.set(id, job) }
      walkDepartments(node.children, depth + 1)
    }
  }
  walkDepartments(departments.departments)
  if (departmentJobs.size !== payload.jobs.length) fail('native department/job count mismatch')
  const ids = new Set(), jobs = []
  for (const native of payload.jobs) {
    const id = String(native?.id ?? ''), title = clean(native?.title), location = clean(native?.location?.name)
    if (!/^[1-9]\d*$/.test(id) || ids.has(id) || !title || !location || native.company_name !== COMPANY || !Array.isArray(native.offices)) fail('invalid native role identity')
    ids.add(id)
    const sourceUrl = roleUrl(native.absolute_url, id), listing = departmentJobs.get(id)
    if (!listing || clean(listing.title) !== title || clean(listing.location?.name) !== location || roleUrl(listing.absolute_url, id) !== sourceUrl) fail('native listing/role identity mismatch')
    const officeCountries = native.offices.map(office => {
      const resolved = officeById.get(office.id)
      if (!resolved?.country) fail('unresolved role office country')
      return resolved.country
    })
    const declared = tailCountry(location), mapped = locationCountries.get(location)
    if (mapped && declared && mapped !== declared) fail('contradictory published geography')
    const resolved = mapped || declared
    // Published Munich roles can retain a US administrative office. Both
    // native countries exclude India; an India/foreign disagreement cannot.
    if (!resolved || officeCountries.some(code => (code === 'IN') !== (resolved === 'IN'))
      || (isIndiaJob({ location }) && resolved !== 'IN') || (/\bIndia\b/i.test(location) && resolved !== 'IN')) fail('unresolved or contradictory role geography for ' + id + ': ' + location + ' / ' + resolved + ' / ' + officeCountries.join(','))
    for (const value of [native.first_published, native.application_deadline]) if (value && !validDate(value)) fail('invalid native calendar date')
    if (resolved !== 'IN') continue
    if (native.content != null && typeof native.content !== 'string') fail('invalid native source content')
    const description = native.content ? decode(native.content) : null, complete = hasSourceDescription({ sourceDescription: description })
    jobs.push({ source: SOURCE, company: COMPANY, companyCareerPage: OFFICIAL_CAREERS_URL, atsPlatform: 'greenhouse',
      title, jobId: id, requisitionId: native.requisition_id || id, location, locations: [location], country: 'India', city: location.split(',')[0],
      sourceUrl, applyUrl: sourceUrl, link: sourceUrl, jobDescription: description, sourceDescription: description,
      sourceDetailComplete: complete, sourceListingComplete: complete, postingDate: native.first_published || null,
      closingDate: native.application_deadline || null, ...(native.application_deadline ? { sourceClosingDateIsExact: /T/.test(native.application_deadline) } : {}),
      department: clean(native.departments?.[0]?.name) || null })
  }
  return { total: payload.meta.total, jobs }
}

export const createLucidMotorsScraper = () => ({
  async run({ fetchImpl = fetch, signal, requestTimeoutMs = 15000, now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    const runTimeout = AbortSignal.timeout(120000)
    const runSignal = signal ? AbortSignal.any([signal, runTimeout]) : runTimeout
    let pagesFetched = 0
    const request = async (url, json = false) => {
      runSignal.throwIfAborted()
      const deadline = new AbortController()
      const requestSignal = AbortSignal.any([runSignal, deadline.signal])
      const timer = setTimeout(() => deadline.abort(new Error('Lucid Motors request deadline timeout')),
        Math.max(1, Math.min(30000, Number(requestTimeoutMs) || 15000)))
      let onAbort
      const aborted = new Promise((_, reject) => {
        onAbort = () => reject(requestSignal.reason)
        requestSignal.addEventListener('abort', onAbort, { once: true })
      })
      try {
        // Bound both fetch and body consumption even for injected transports
        // that do not implement AbortSignal themselves.
        return await Promise.race([aborted, (async () => {
          requestSignal.throwIfAborted()
          const response = await fetchImpl(url, { signal: requestSignal,
            headers: { Accept: json ? 'application/json' : 'text/html,application/javascript', 'User-Agent': 'JobverifyScraper/1.0' } })
          requestSignal.throwIfAborted()
          if (response.status !== 200) throw new Error(`Lucid Motors HTTP ${response.status} for ${url}`)
          if (response.url !== url) throw new Error('Lucid Motors native request redirected outside the verified identity')
          const body = json ? await response.json() : await response.text()
          requestSignal.throwIfAborted()
          pagesFetched++
          return body
        })()])
      } finally {
        clearTimeout(timer)
        requestSignal.removeEventListener('abort', onAbort)
      }
    }

    const html = await request(SEARCH_URL), doc = document(html)
    const page = doc.nodes(node => node.tag === 'html'), body = doc.nodes(node => node.tag === 'body')
    if (page.length !== 1 || body.length !== 1 || !doc.nodes(node => node.tag === 'h1' && doc.text(node) === 'Open Roles').length
      || !doc.text(body[0]).includes('Lucid Motors')) fail('official careers identity changed')
    doc.outer(page[0]); doc.outer(body[0])
    const scripts = [...new Set(doc.nodes(node => node.tag === 'script').flatMap(node => {
      try { const url = new URL(node.attrs.src, SEARCH_URL); return url.origin === 'https://lucidmotors.com' && url.pathname.startsWith('/_next/static/chunks/') && url.pathname.endsWith('.js') && !url.search && !url.hash ? [url.href] : [] } catch { return [] }
    }))]
    if (!scripts.length || scripts.length > 32) fail('official client schema changed')
    scripts.sort((a,b) => Number(b.includes('/4339-')) - Number(a.includes('/4339-')))
    let bound = false
    for (let i = 0; i < scripts.length && !bound; i += 4) {
      const results = await Promise.allSettled(scripts.slice(i, i + 4).map(url => request(url)))
      bound = results.some(result => result.status === 'fulfilled' && result.value.includes('JOBS_BY_DEPATMENT:"' + DEPARTMENTS_URL + '"'))
    }
    runSignal.throwIfAborted()
    if (!bound) fail('official native API handoff changed or unavailable')
    const inventory = parseNativeInventory(...await Promise.all([JOBS_URL, DEPARTMENTS_URL, OFFICES_URL].map(url => request(url, true))))
    const checkedAt = now(), incomplete = inventory.jobs.some(job => !job.sourceDetailComplete)
    return attachInventoryEvidence(inventory.jobs.map(job => ({ ...job, scrapedAt: checkedAt })), {
      status: incomplete ? 'discovery-only' : inventory.total ? 'complete-inventory' : 'verified-empty', firstParty: true,
      listingComplete: !incomplete, surface: JOBS_URL, pagesFetched, reportedTotal: inventory.total,
      indiaFacetCount: inventory.jobs.length, verifiedAt: checkedAt,
      reason: incomplete ? 'native-india-roles-missing-source-details' : 'complete-native-department-role-parity-and-office-country-tree',
    })
  },
})

export const run = async (options = {}) => createLucidMotorsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
