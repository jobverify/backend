import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchTextWithRetry, fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { extractCity, extractWorkdayStructuredDetail } from '../../scraper-support/myworkday/engine.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const HOMEPAGE_URL = 'https://www.kbr.com/en'
export const CAREERS_LANDING_URL = 'https://careers.kbr.com/us/en'
export const CURRENT_JOBS_URL = 'https://jobs.kbr.com/jobs.html'
export const SNAPSHOT_URL = 'https://jobs.kbr.com/data/kbr-jobs.json'
export const WORKABLE_WIDGET_URL = 'https://apply.workable.com/api/v1/widget/accounts/kbr'
export const WORKDAY_JOBS_API_URL = 'https://kbr.wd5.myworkdayjobs.com/wday/cxs/kbr/KBR_Careers/jobs'
const normalizeString = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const stripTags = html => normalizeString(String(html ?? '').replace(/<[^>]*>/g, ' '))
const parseJson = (text, label) => {
  try { return JSON.parse(text) } catch { throw new Error('KBR malformed ' + label) }
}
const assertHomepage = html => {
  if (!/\bKBR\b/i.test(html) || !/<a\b[^>]*href=["']https:\/\/careers\.kbr\.com\/(?:us\/en)?["'][^>]*>\s*Careers\s*<\/a>/i.test(html)) throw new Error('KBR homepage no longer links to the official careers site')
}
const assertOverview = html => {
  const kbrLink = Array.from(String(html).matchAll(/<a\b[^>]*href=["']https:\/\/jobs\.kbr\.com\/?["'][^>]*>([\s\S]*?)<\/a>/gi))
    .some(match => stripTags(match[1]) === 'Explore KBR Jobs')
  if (!/<title>\s*KBR and Trinzic - Overview\s*<\/title>/i.test(html) || !kbrLink) throw new Error('KBR verified KBR careers migration no longer identifies the KBR jobs handoff')
}
const getCountries = html => {
  if (!/<title>\s*Find a Job \| Careers at KBR\s*<\/title>/i.test(html) || !html.includes('data/kbr-jobs.json') || !html.includes(WORKABLE_WIDGET_URL)) throw new Error('KBR current jobs page no longer exposes the verified complete inventory sources')
  const mapping = html.match(/const\s+ISO3_TO_COUNTRY\s*=\s*\{([\s\S]*?)\}/)?.[1] || ''
  const countries = new Map(Array.from(mapping.matchAll(/([A-Z]{3})\s*:\s*["']([^"']+)["']/g)).map(match => [match[1], match[2]]))
  if (countries.get('IND') !== 'India') throw new Error('KBR current jobs page no longer exposes verified country metadata')
  return countries
}
const getSnapshotCountry = (job, countries) => {
  const names = new Map([...countries.values()].map(name => [name.toLowerCase(), name]))
  const explicit = new Set(normalizeString(job.location).split(',').map(part => part.trim())
    .map(part => countries.get(part) || names.get(part.toLowerCase())).filter(Boolean))
  return explicit.size === 1 ? [...explicit][0] : null
}
const getDetailApiUrl = applicationUrl => {
  const url = new URL(applicationUrl)
  if (url.origin !== 'https://kbr.wd5.myworkdayjobs.com' || !url.pathname.startsWith('/KBR_Careers/job/')) throw new Error('Job application URL no longer belongs to the verified KBR Workday tenant')
  return url.origin + '/wday/cxs/kbr' + url.pathname
}
const mapDetail = (job, payload) => {
  const info = payload?.jobPostingInfo
  if (info?.jobReqId !== job.id || !normalizeString(info.title) || info.canApply !== true || info.posted !== true
    || info.country?.descriptor !== 'India' || info.externalUrl !== job.application_url) throw new Error('KBR India job detail no longer matches its active public requisition')
  const detail = extractWorkdayStructuredDetail(payload)
  if (!detail?.jobDescription) throw new Error('KBR India job description is missing')
  const location = detail.indiaScopeLocations?.[0]
  if (!location) throw new Error('KBR India job detail no longer resolves its India location')
  const locationParts = location.split(',').map(part => part.trim())
  return {
    ...detail, title: normalizeString(info.title), company: 'KBR', department: normalizeString(job.department) || null,
    location, city: extractCity(location), state: locationParts.length > 2 ? locationParts[1] : null, country: 'India',
    jobId: job.id, requisitionId: job.id, sourceUrl: job.application_url, applyUrl: job.application_url,
    employmentType: normalizeString(info.timeType || job.employment_type) || null,
    postingDate: normalizeString(info.startDate) || null, closingDate: null,
    remoteStatus: job.is_remote === 'Yes' ? 'Remote' : 'On-site',
  }
}

export const createKbrScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run(options = {}) {
    const controller = new AbortController(), signal = AbortSignal.any([controller.signal, AbortSignal.timeout(600000), ...(options.signal ? [options.signal] : [])])
    const textTransport = options.fetchText || (url => fetchTextWithRetry(url, { label: 'kbr', timeoutMs: 15000, attempts: 1, signal }))
    const jsonTransport = options.fetchJson || ((url, init) => fetchJsonWithRetry(url, { ...init, label: 'kbr', timeoutMs: 15000, attempts: 1, signal }))
    const fetchText = async url => { signal.throwIfAborted(); try { const result = await textTransport(url); signal.throwIfAborted(); return result } catch (error) { controller.abort(error); throw error } }
    const fetchJson = async (url, init) => { signal.throwIfAborted(); try { const result = await jsonTransport(url, init); signal.throwIfAborted(); return result } catch (error) { controller.abort(error); throw error } }
    const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
    assertHomepage(await fetchText(HOMEPAGE_URL))
    assertOverview(await fetchText(CAREERS_LANDING_URL))
    const countries = getCountries(await fetchText(CURRENT_JOBS_URL))
    const snapshot = parseJson(await fetchText(SNAPSHOT_URL), 'snapshot')
    if (snapshot?.source !== 'workday_raas' || !Array.isArray(snapshot.jobs) || !Number.isInteger(snapshot.total_jobs)
      || snapshot.total_jobs < 0 || snapshot.jobs.length !== snapshot.total_jobs) throw new Error('incomplete KBR snapshot inventory')
    const generated = Date.parse(snapshot.generated_at), verified = Date.parse(now())
    if (!Number.isFinite(generated) || generated > verified || verified - generated > 72 * 60 * 60 * 1000) throw new Error('KBR snapshot freshness can no longer be verified')
    const ids = new Set(), india = [], resolvedDetails = new Map(), unresolvedCountryRows = []
    for (const job of snapshot.jobs) {
      if (!/^R\d+$/.test(job.id || '') || !normalizeString(job.title) || job.requisition_status !== 'Open'
        || !Object.hasOwn(job, 'application_url') || ids.has(job.id)) throw new Error('KBR malformed or repeated snapshot requisition')
      ids.add(job.id)
      if (job.application_url != null) getDetailApiUrl(job.application_url)
    }
    await mapWithConcurrency(snapshot.jobs, 3, async job => {
      let country = getSnapshotCountry(job, countries)
      if (!country) {
        // Snapshot locations can omit ISO codes entirely. Verify their country on the exact live requisition.
        if (!job.application_url) { unresolvedCountryRows.push(structuredClone(job)); return }
        const payload = parseJson(await fetchText(getDetailApiUrl(job.application_url)), 'Workday country detail')
        const info = payload?.jobPostingInfo
        if (info?.jobReqId !== job.id || !normalizeString(info.country?.descriptor) || info.canApply !== true || info.posted !== true) throw new Error('KBR unresolved snapshot country')
        country = info.country.descriptor
        resolvedDetails.set(job.id, payload)
      }
      if (country === 'India') india.push(job)
    })
    const widget = parseJson(await fetchText(WORKABLE_WIDGET_URL), 'Workable inventory')
    if (widget?.name !== 'KBR' || !Array.isArray(widget.jobs)) throw new Error('KBR malformed additional live Workable inventory')
    // The current official site merges this live source. Never silently discard newly published roles.
    if (widget.jobs.length) throw new Error('KBR live Workable inventory now contains public roles; its detail contract must be reverified')

    const searchRequisition = id => fetchJson(WORKDAY_JOBS_API_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ limit: 20, offset: 0, appliedFacets: {}, searchText: id }),
    })
    if (india.some(job => !job.application_url)) {
      const control = india.find(job => job.application_url) || snapshot.jobs.find(job => job.application_url)
      if (!control) throw new Error('KBR public requisition search control is unavailable')
      const result = await searchRequisition(control.id)
      if (!Number.isInteger(result?.total) || result.total < 1 || !Array.isArray(result.jobPostings)
        || !result.jobPostings.some(item => item.bulletFields?.includes(control.id))) throw new Error('KBR public requisition search control no longer matches an active linked posting')
    }

    let unpublished = 0
    const actionable = []
    for (const job of india) {
      if (job.application_url) { actionable.push(job); continue }
      // RaaS contains open internal requisitions too. Verify that every unlinked India row has no public posting.
      const search = await searchRequisition(job.id)
      if (search?.total !== 0 || !Array.isArray(search.jobPostings) || search.jobPostings.length !== 0) throw new Error('KBR unlinked India requisition has unresolved public posting coverage: ' + job.id)
      unpublished += 1
    }
    const nativeDetails = new Map()
    const jobs = await mapWithConcurrency(actionable, 3, async job => {
      const payload = resolvedDetails.get(job.id) || parseJson(await fetchText(getDetailApiUrl(job.application_url)), 'Workday job detail')
      nativeDetails.set(job.id, payload); return mapDetail(job, payload)
    })
    await mapWithConcurrency(actionable, 3, async job => {
      const closing = parseJson(await fetchText(getDetailApiUrl(job.application_url)), 'closing Workday job detail')
      mapDetail(job, closing)
      if (stable(nativeDetails.get(job.id)) !== stable(closing)) throw new Error('KBR closing full native role identity or criteria changed: ' + job.id)
    })
    const closingSnapshot = parseJson(await fetchText(SNAPSHOT_URL), 'closing snapshot')
    if (stable(snapshot) !== stable(closingSnapshot)) throw new Error('KBR closing full snapshot inventory changed')
    const closingWidget = parseJson(await fetchText(WORKABLE_WIDGET_URL), 'closing Workable inventory')
    if (stable(widget) !== stable(closingWidget)) throw new Error('KBR closing additional Workable inventory changed')
    const complete = unresolvedCountryRows.length === 0
    const audit = { source: 'kbr', nativeSnapshot: snapshot, closingNativeSnapshot: closingSnapshot, nativeDetails: Object.fromEntries(nativeDetails),
      unresolvedCountryRows, nativeIndiaRows: india, nativeUnpublishedIndiaCount: unpublished, closingFullCriteriaReconciled: true,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false }
    const result = jobs.map(job => ({ ...job, source: 'kbr', link: job.applyUrl, sourceDescription: job.jobDescription,
      sourceDetailComplete: true, sourceListingComplete: complete, sourceScopeComplete: false, lifecycleCleanupAllowed: false, scrapedAt: now() }))
    if (result.length) result[0].nativeCollectionEvidence = audit
    options.onAudit?.(audit)
    return attachInventoryEvidence(result, {
      status: complete ? jobs.length ? 'complete-inventory' : 'verified-empty' : 'coverage-gap', surface: SNAPSHOT_URL,
      firstParty: true, listingComplete: complete, pagesFetched: 2, reportedTotal: complete ? actionable.length : null, indiaFacetCount: complete ? actionable.length : null,
      verifiedAt: now(), reason: (complete ? 'complete-kbr-' : 'partial-kbr-unresolved-native-country-') + snapshot.total_jobs + '-snapshot-rows-' + india.length + '-india-' + unpublished + '-unpublished-workable-zero',
    })
  },
})
export const run = async (options = {}) => createKbrScraper().run(options)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'kbr')
}
