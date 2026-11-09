import { createHash } from 'node:crypto'
import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { extractPublishedApplexusClient } from './publishedClient.js'

export const CAREERS_URL = 'https://www.applexus.com/careers'
const SOURCE = 'applexus', ORIGIN = 'https://www.applexus.com', API_ORIGIN = 'https://admin.applexus.com'
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const hash = value => createHash('sha256').update(value).digest('hex')
const fail = message => { throw Error('Applexus native inventory: ' + message) }
const one = (nodes, label) => { if (nodes.length !== 1) fail('missing or ambiguous ' + label); return nodes[0] }
const head = doc => one(doc.nodes(node => node.tag === 'head'), 'document head')
const canonical = doc => one(doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical', head(doc)), 'canonical URL').attrs.href
const title = doc => norm(one(head(doc).children.filter(node => typeof node === 'object' && node.tag === 'title'), 'document title').raw)
const shape = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...keys].sort().join('|')
const integer = (value, label) => {
  if (!(Number.isSafeInteger(value) && value >= 0) && !(typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value))) fail('invalid native pagination ' + label)
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) fail('invalid native pagination ' + label)
  return number
}

function country(record) {
  const names = new Map([['India', 'India'], ['United States of America', 'United States'], ['Canada', 'Canada'], ['United Kingdom', 'United Kingdom']])
  const selected = names.get(record.location) || null
  const region = clean(record.region)
  const explicit = [
    ['United Kingdom', /\b(?:UK|United Kingdom)\b/i],
    ['United States', /\b(?:USA|United States)\b/i],
    ['Canada', /\bCanada\b/i], ['India', /\bIndia\b/i],
  ].filter(([_name, pattern]) => pattern.test(region)).map(([name]) => name)
  const conflict = Boolean(selected && explicit.some(name => name !== selected))
  return { country: conflict ? null : selected, sourceCountryScopeUnresolved: conflict || !selected,
    sourceCountryConflict: conflict, sourceNativeCountryLabel: record.location, sourceNativeWorksiteRegion: record.region }
}

export function readApplexusListing(payload, offset = 0) {
  const collection = payload?.career_list, pagination = collection?.pagination
  if (!shape(payload, ['career_list']) || !shape(collection, ['id', 'tabData', 'pagination'])
    || !shape(pagination, ['page', 'limit', 'total']) || !Array.isArray(collection.tabData)
    || String(collection.id) !== '0') fail('invalid native inventory envelope or unreviewed pagination')
  const total = integer(pagination.total, 'total'), page = integer(pagination.page, 'offset'), limit = integer(pagination.limit, 'limit')
  if (page !== offset || limit !== 9 || total > 1000 || collection.tabData.length !== Math.min(limit, Math.max(total - offset, 0))) fail('native pagination counts do not reconcile')
  const seen = new Set()
  const rows = collection.tabData.map(record => {
    if (!record || Object.keys(record).sort().join('|') !== 'link|location|region|title|type'
      || typeof record.title !== 'string' || !clean(record.title) || typeof record.link !== 'string'
      || typeof record.location !== 'string' || !clean(record.location) || typeof record.type !== 'string' || !clean(record.type)
      || record.region != null && typeof record.region !== 'string') fail('native role fields changed')
    const url = new URL(record.link, ORIGIN)
    if (url.origin !== ORIGIN || !/^\/careers\/[a-z0-9_-]+$/.test(url.pathname) || url.search || url.hash || url.username || url.password || seen.has(url.href)) fail('invalid or duplicate native role identity')
    seen.add(url.href)
    return { source: SOURCE, company: 'Applexus', title: clean(record.title), jobId: url.pathname.split('/').at(-1), requisitionId: null,
      sourceUrl: url.href, applyUrl: url.href, link: url.href, companyCareerPage: CAREERS_URL, companyDomain: 'applexus.com',
      ...country(record), city: null, state: null, location: [record.region, record.location].filter(Boolean).join(', '),
      employmentType: record.type, department: null, experienceRequired: null, minimumQualification: null,
      preferredQualification: null, requiredSkills: [], postingDate: null, closingDate: null, jobDescription: null,
      sourceNativeListingRecord: structuredClone(record), sourceDetailComplete: false,
      sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false }
  })
  return { total, offset, limit, rows }
}

export function readApplexusDetail(html, row) {
  const doc = document(html)
  if (canonical(doc) !== row.sourceUrl) fail('role canonical identity changed')
  const heading = one(doc.nodes(node => node.tag === 'h1'), 'role heading')
  if (doc.text(heading) !== row.title) fail('role heading identity changed')
  const content = one(doc.nodes(node => doc.hasClass(node, 'AdminTextEditor')
    && (node.attrs.class || '').split(/\s+/).some(value => /^CareerDetails_contentarea__[A-Za-z0-9_-]+$/.test(value))), 'full native role criteria')
  const section = one(doc.nodes(node => node.tag === 'section' && node.start < heading.start && node.end > content.end), 'native role section')
  const prefix = document(html.slice(section.openEnd, content.start))
  for (const value of [row.sourceNativeListingRecord.location, row.sourceNativeListingRecord.region, row.employmentType].filter(Boolean)) {
    if (!prefix.nodes(node => node.tag !== 'root' && prefix.text(node) === clean(value)).length) fail('native labelled role fields disagree')
  }
  const raw = doc.inner(content), description = extractActiveDescription(raw)
  if (!description || description.replace(/\s/g, '') !== doc.text(content).replace(/\s/g, '')) fail('full visible native criteria unavailable')
  return { ...row, jobDescription: raw, sourceNativeDescriptionHTML: raw, sourceNativeDescriptionSha256: hash(raw),
    sourceNativeVisibleDescription: description, sourceDetailComplete: true, sourceNativeDetailQualified: true,
    sourceNativeEmployerEvidence: { brand: 'Applexus', careerPage: CAREERS_URL, canonicalRole: row.sourceUrl, legalEmployer: null } }
}

const listModel = row => {
  const native = row.sourceNativeListingRecord
  return JSON.stringify([native.title, native.link, native.location, native.region, native.type])
}
const detailModel = row => JSON.stringify([listModel(row), row.sourceNativeDescriptionHTML ?? null, row.sourceDetailComplete])

export function createCurrentApplexusScraper(defaults = {}) {
  return { async run(provided = {}) {
    const options = { ...defaults, ...provided }
    const timeout = options.timeoutMs ?? 120000
    if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 180000) fail('invalid source deadline')
    const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(timeout)])
    signal.throwIfAborted()
    if (options.maxJobs != null && (!Number.isSafeInteger(options.maxJobs) || options.maxJobs < 0)) fail('invalid output limit')
    const observedAt = new Date((options.now || (() => new Date()))())
    if (!Number.isFinite(observedAt.getTime())) fail('invalid observation time')
    const wait = (promise, active = signal) => new Promise((resolve, reject) => {
      const finish = (callback, value) => { active.removeEventListener('abort', abort); callback(value) }
      const abort = () => finish(reject, active.reason)
      active.addEventListener('abort', abort, { once: true })
      Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error))
      if (active.aborted) abort()
    })
    if (options.fetchText && !options.fetchImpl) fail('legacy HTML-only input cannot prove the current public client inventory')
    const fetchImpl = options.fetchImpl || fetch
    let pagesFetched = 0
    const read = async (url, authorization) => {
      signal.throwIfAborted()
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20000)])
      let response
      try {
        response = await wait(fetchImpl(url, { method: 'GET', redirect: 'manual', signal: requestSignal,
          headers: { Accept: authorization ? 'application/json' : 'text/html,application/javascript',
            'User-Agent': 'Mozilla/5.0', ...(authorization ? { Authorization: authorization } : {}) } }), requestSignal)
      } catch {
        signal.throwIfAborted(); requestSignal.throwIfAborted()
        // Native HTTP/client failures must not expose the request configuration.
        fail('public GET transport unavailable')
      }
      pagesFetched++
      let status, finalUrl
      try { status = response?.status; finalUrl = response?.url } catch { fail('invalid public HTTP response') }
      if (!Number.isInteger(status) || status < 100 || status > 599) fail('invalid public HTTP response')
      if (status !== 200 || finalUrl !== url) {
        await wait(Promise.resolve().then(() => response.body?.cancel?.()), requestSignal).catch(() => {})
        fail('public GET unavailable or redirected (HTTP' + status + ')')
      }
      let body
      try { body = await wait(Promise.resolve().then(() => response.text()), requestSignal) }
      catch { signal.throwIfAborted(); requestSignal.throwIfAborted(); fail('public entity read unavailable') }
      requestSignal.throwIfAborted()
      if (typeof body !== 'string' || body.length > 3000000) fail('public entity exceeds source budget')
      return body
    }
    const snapshot = async (finalize = false) => {
      const page = await read(CAREERS_URL), doc = document(page)
      if (canonical(doc) !== CAREERS_URL || !/\bApplexus\b/i.test(title(doc))) fail('current employer careers identity changed')
      const script = one(doc.nodes(node => node.tag === 'script' && typeof node.attrs.src === 'string'
        && /^\/_next\/static\/chunks\/3836-[a-f0-9]+\.js$/.test(node.attrs.src)
        && !Object.hasOwn(node.attrs, 'nomodule')
        && /^(?:|module|text\/javascript|application\/javascript)$/.test(node.attrs.type || '')), 'active careers client script')
      const scriptUrl = new URL(script.attrs.src, ORIGIN).href
      const javascript = await read(scriptUrl)
      const config = extractPublishedApplexusClient(javascript)
      if (config.apiOrigin !== API_ORIGIN || config.listingPath !== '/api/careers_list' || config.pageSize !== 9 || config.method !== 'GET') fail('published read-only client contract changed')
      const clientEvidence = { scriptUrl, scriptSha256: hash(javascript), apiOrigin: config.apiOrigin,
        listingPath: config.listingPath, method: 'GET', authorizationRetained: false }
      const listing = async () => {
        const rows = [], ids = new Set()
        let total = null
        for (let offset = 0; total === null || offset < total; offset += 9) {
          signal.throwIfAborted()
          const url = new URL(config.listingPath, config.apiOrigin)
          url.searchParams.set('limit', '9'); url.searchParams.set('location', '0'); url.searchParams.set('offset', String(offset))
          const nativeBody = await read(url.href, config.authorization)
          let payload
          try { payload = JSON.parse(nativeBody) } catch { fail('native inventory JSON unavailable') }
          const page = readApplexusListing(payload, offset)
          if (total !== null && total !== page.total) fail('native total changed while enumerating')
          total = page.total
          for (const row of page.rows) { if (ids.has(row.jobId)) fail('duplicate native identity across pages'); ids.add(row.jobId); rows.push(row) }
        }
        if (rows.length !== total) fail('native total and unique identities disagree')
        return { total, rows }
      }
      const { total, rows } = await listing()
      const observations = new Array(rows.length), failures = []
      let index = 0
      await Promise.all(Array.from({ length: Math.min(4, rows.length) }, async () => {
        while (index < rows.length) {
          const current = index++, row = rows[current]
          try { observations[current] = readApplexusDetail(await read(row.sourceUrl), row) }
          catch (error) {
            signal.throwIfAborted()
            observations[current] = { ...row, sourceDetailFailureKind: 'public-role-detail-unavailable-or-inconsistent' }
            failures.push({ jobId: row.jobId, reason: String(error.message) })
          }
        }
      }))
      const endListing = finalize ? await listing() : null
      return { total, observations, failures, clientEvidence, endListing }
    }
    const opening = await snapshot(), closing = await snapshot(true)
    const first = new Map(opening.observations.map(row => [row.jobId, row]))
    const finalRows = new Map(closing.endListing.rows.map(row => [row.jobId, row]))
    const listingStable = opening.total === closing.total && closing.total === closing.endListing.total
      && closing.observations.every(row => first.has(row.jobId) && finalRows.has(row.jobId)
        && listModel(row) === listModel(first.get(row.jobId)) && listModel(row) === listModel(finalRows.get(row.jobId)))
    for (const row of closing.observations) {
      row.sourceCurrentPostingStable = first.has(row.jobId) && finalRows.has(row.jobId)
        && detailModel(row) === detailModel(first.get(row.jobId)) && listModel(row) === listModel(finalRows.get(row.jobId))
      row.scrapedAt = observedAt.toISOString()
    }
    const countryConflicts = closing.observations.filter(row => row.sourceCountryConflict).map(row => row.jobId)
    const candidates = closing.observations.filter(row => row.country === 'India' && row.sourceDetailComplete && row.sourceCurrentPostingStable)
    const jobs = options.maxJobs ? candidates.slice(0, options.maxJobs) : candidates
    const complete = listingStable && !opening.failures.length && !closing.failures.length
      && closing.observations.every(row => !row.sourceCountryScopeUnresolved && row.sourceCurrentPostingStable)
      && jobs.length === candidates.length
    for (const row of jobs) { row.sourceListingComplete = complete; row.sourceScopeComplete = complete }
    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: closing.total,
      observedVacancyCount: closing.total, sourceScopeComplete: false })
    const evidence = { status: complete ? closing.total ? 'complete-inventory' : 'verified-empty' : 'coverage-gap',
      surface: API_ORIGIN + '/api/careers_list', firstParty: true, listingComplete: complete, pagesFetched,
      reportedTotal: listingStable ? closing.endListing.total : null, indiaFacetCount: complete ? candidates.length : null, verifiedAt: new Date().toISOString(),
      reason: complete ? 'Current declared Applexus public client, native totals, full role criteria and closing models reconcile'
        : `Applexus public inventory incomplete: country conflicts=${countryConflicts.length}; native role detail failures=${opening.failures.length + closing.failures.length}; listing stable=${listingStable}; current stable India roles retained` }
    attachInventoryEvidence(jobs, evidence)
    if (options.onRecords) await wait(options.onRecords(structuredClone(closing.observations)))
    if (options.onAudit) await wait(options.onAudit({ source: SOURCE, opening, closing, countryConflicts,
      listingStable, inventoryEvidence: evidence, productionWrites: false }))
    signal.throwIfAborted()
    return jobs
  } }
}
