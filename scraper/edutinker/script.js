import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readEdutinkerRole } from './roleContent20261121.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://edutinker.com'
export const CAREERS_URL = `${BASE_URL}/careers-at-edutinker/`

const SOURCE = 'edutinker'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const toAbsoluteUrl = (value) => {
  if (!value) return null
  try {
    const url = new URL(value, BASE_URL)
    if (url.origin !== BASE_URL || url.username || url.password || url.search || url.hash
      || !/^\/jobs\/[^/]+\/$/.test(url.pathname)) return null
    return url.href
  } catch {
    return null
  }
}

const slugFromUrl = (url) => {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || null
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html) => {
  try {
    const d = readNativeDocument(String(html ?? ''))
    const text = d.text(d.nodes(n => n.tag === 'root')[0])
    return activeHead(html).titles.some(title => /Careers\s*-\s*eduTinker/i.test(title))
      && /Open Positions/i.test(text)
      && /Technodemics Smart Solutions Private Limited/i.test(text)
  } catch {
    return false
  }
}

export const extractListings = (html) => {
  const jobs = []
  const seen = new Set()

  const d = readNativeDocument(String(html ?? ''))
  for (const anchor of d.nodes(n => n.tag === 'a' && n.attrs.href)) {
    const sourceUrl = toAbsoluteUrl(anchor.attrs.href)
    const title = d.text(anchor)
    const jobId = slugFromUrl(sourceUrl)

    if (!sourceUrl || !title || !jobId || seen.has(sourceUrl)) continue
    seen.add(sourceUrl)

    jobs.push({
      title,
      company: 'Edutinker',
      jobId,
      requisitionId: null,
      sourceUrl,
      applyUrl: sourceUrl,
    })
  }

  return jobs
}

export const extractJobDetail = readEdutinkerRole

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createEdutinkerScraper = () => ({
  async run({ fetchText = defaultFetchText, signal } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_URL)
    signal?.throwIfAborted()
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Edutinker careers page no longer matches the verified official public jobs surface')
    }

    const listings = extractListings(careersHtml)

    const observations = await Promise.all(listings.map(async (listing) => {
      signal?.throwIfAborted()
      const detailHtml = await fetchText(listing.sourceUrl)
      signal?.throwIfAborted()
      return {
        ...extractJobDetail(detailHtml, listing),
        link: listing.sourceUrl,
        source: SOURCE,
        scrapedAt: new Date().toISOString(),
      }
    }))

    const heldRoles = observations.filter(job => job.sourceEmployerConflict || job.sourceCompanyScopeUnresolved || job.sourceIdentityConflict || job.sourceCountryConflict)
      .map(job => ({sourceUrl: job.sourceUrl, reason: job.sourceEmployerConflict || job.sourceCompanyScopeUnresolved ? 'native-employer-unqualified' : 'native-role-identity-or-country-conflict', job}))
    const held = new Set(heldRoles.map(role => role.sourceUrl))
    const jobs = observations.filter(job => !held.has(job.sourceUrl))
    const audit = {source: SOURCE, purpose: 'unverified-source-text-observations', heldRoles, observedRoles: observations,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false, openingClosingQualified: false,
      companyIndiaTotal: null, companyGlobalTotal: null, legalEmployer: null, applicationsSubmitted: false}
    if (!jobs.length && heldRoles.length) {
      throw Object.assign(new Error('Edutinker roles held: native employer or role identity is unqualified'), {nativeCollectionEvidence: audit, abortRetries: true})
    }
    Object.defineProperty(jobs, 'nativeCollectionEvidence', {value: audit, enumerable: false})
    return attachInventoryEvidence(jobs, {status: 'coverage-gap', listingComplete: false, reportedTotal: null, indiaFacetCount: null,
      lifecycleCleanupAllowed: false, notes: 'Source text observations only; employer conflicts are held and complete current company inventory is unverified.'})
  },
})

export const run = async (options = {}) => createEdutinkerScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Edutinker scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
