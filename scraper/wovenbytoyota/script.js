import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchJsonWithRetry, composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { toPlainText } from '../../scraper-support/detailExtractors/shared.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { isReviewedWovenLeverClient } from './currentClientBinding.js'
import { clientScriptDeclarations } from '../../scraper-support/utils/reviewedClientProgram.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'wovenbytoyota'
export const COMPANY = 'Woven by Toyota'
export const OFFICIAL_CAREERS_URL = 'https://woven.toyota/en/careers/'
export const NATIVE_JOBS_URL = 'https://api.lever.co/v0/postings/woven-by-toyota'
const BOARD = 'woven-by-toyota'
const PAGE_SIZE = 100
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i
const text = value => typeof value === 'string' && value.trim().length > 0
const fail = reason => { throw new Error('Woven by Toyota native inventory: ' + reason) }
// Exact native location labels correspond to the official careers offices and
// the official client's separate English/Japanese locale filters.
const observedCountries = new Map([
  ['Tokyo', 'Japan'], ['\u6771\u4eac\u90fd\u4e2d\u592e\u533a', 'Japan'], ['Susono, Shizuoka', 'Japan'], ['\u9759\u5ca1\u770c\u88fe\u91ce\u5e02', 'Japan'],
  ['Nagoya, Aichi', 'Japan'], ['\u611b\u77e5\u770c\u540d\u53e4\u5c4b\u5e02', 'Japan'], ['Palo Alto, CA', 'United States'],
  ['Ann Arbor, MI', 'United States'], ['London', 'United Kingdom'],
])
const INDIA = /\bindia\b|\bbengaluru\b|\bbangalore\b|\bhyderabad\b|\bpune\b|\bgurugram\b|\bgurgaon\b|\bmumbai\b|\bchennai\b|\bnoida\b|\bdelhi\b/i
const FOREIGN = /\b(?:United States|USA|US|United Kingdom|UK|Canada|Japan|China|Singapore|Germany|France|Australia)\b/i
const locationCountry = value => {
  const country = observedCountries.get(value) || nativeLocationCountryName(value)
  const india = INDIA.test(value) && isIndiaJob({ location: value })
  if (india && (FOREIGN.test(value) || country && country !== 'India')) fail('contradictory India location')
  return india ? 'India' : country
}
const identityUrl = (value, id, suffix) => {
  let url
  try { url = new URL(value) } catch { fail('invalid role URL') }
  if (url.origin !== 'https://jobs.lever.co' || url.username || url.password || url.search || url.hash
    || url.pathname !== `/${BOARD}/${id}${suffix}`) fail('foreign or mismatched role identity')
  return url.href
}
const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, { signal, headers: { Accept: 'text/html,application/javascript', 'User-Agent': 'JobverifyScraper/1.0' } })
  return { status: response.status, url: response.url, html: await response.text() }
}

export const createWovenByToyotaScraper = () => ({
  async run({ fetchJson = fetchJsonWithRetry, fetchPage = defaultFetchPage, signal, timeoutMs = 60000, maxPages = 100, now = () => new Date().toISOString() } = {}) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000 || !Number.isSafeInteger(maxPages) || maxPages < 1) fail('invalid request budget')
    signal?.throwIfAborted()
    const deadline = new AbortController()
    const combined = composeAbortSignals(signal, deadline.signal)
    const timer = setTimeout(() => deadline.abort(Error('Woven by Toyota source timed out')), timeoutMs)
    let onAbort
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(combined.reason)
      combined.addEventListener('abort', onAbort, { once: true })
    })
    try {
      const collect = async () => {
        let proofRequests = 0
        const requestPage = async url => {
          combined.throwIfAborted()
          const page = await fetchPage(url, { signal: combined })
          combined.throwIfAborted()
          if (page?.status !== 200 || page.url !== url || typeof page.html !== 'string') fail('official handoff HTTP or redirect failure')
          proofRequests++
          return page.html
        }
        const html = await requestPage(OFFICIAL_CAREERS_URL), doc = document(html)
        const roots = doc.nodes(node => node.tag === 'html'), bodies = doc.nodes(node => node.tag === 'body')
        if (roots.length !== 1 || bodies.length !== 1 || !doc.nodes(node => node.tag === 'meta'
          && node.attrs.property === 'og:title' && node.attrs.content?.startsWith('Careers') && node.attrs.content.endsWith(COMPANY)).length) fail('official careers identity changed')
        doc.outer(roots[0]); doc.outer(bodies[0])
        const scripts = [...new Set(clientScriptDeclarations(html).filter(node => node.attrs.src).flatMap(node => {
          try { const url = new URL(node.attrs.src, OFFICIAL_CAREERS_URL); return url.origin === 'https://woven.toyota'
            && /^\/_next\/static\/chunks\/[a-z0-9_-]+\.js$/.test(url.pathname) && !url.search && !url.hash ? [url.href] : [] } catch { return [] }
        }))]
        if (!scripts.length || scripts.length > 32) fail('official client inventory changed')
        scripts.sort((a,b) => Number(b.endsWith('/285jitvux73--.js')) - Number(a.endsWith('/285jitvux73--.js')))
        let bound = false
        for (let index = 0; index < scripts.length && !bound; index += 4) {
          const results = await Promise.allSettled(scripts.slice(index, index + 4).map(url => requestPage(url)))
          bound = results.some((result, offset) => result.status === 'fulfilled'
            && isReviewedWovenLeverClient(result.value, { careersHTML: html, scriptURL: scripts[index + offset] }))
        }
        combined.throwIfAborted()
        if (!bound) fail('official native board binding changed or unavailable')
        const records = [], ids = new Set()
        let pagesFetched = 0, page
        do {
          combined.throwIfAborted()
          if (pagesFetched >= maxPages) fail('page limit leaves incomplete inventory')
          const url = `${NATIVE_JOBS_URL}?mode=json&skip=${pagesFetched * PAGE_SIZE}&limit=${PAGE_SIZE}`
          page = await fetchJson(url, { signal: combined, timeoutMs: Math.min(timeoutMs, 20000), attempts: 1 })
          combined.throwIfAborted()
          // Lever JSON mode has a native array contract. Error envelopes are
          // objects; accepting an empty .jobs projection would manufacture zero.
          if (!Array.isArray(page) || page.length > PAGE_SIZE) fail('invalid native array or failed response envelope')
          for (const row of page) {
            if (!row || !UUID.test(row.id) || ids.has(row.id) || !text(row.text)) fail('missing or duplicate native identity/title')
            ids.add(row.id)
            identityUrl(row.hostedUrl, row.id, '')
            identityUrl(row.applyUrl, row.id, '/apply')
            if (!text(row.categories?.location) || !Array.isArray(row.categories.allLocations) || !row.categories.allLocations.length
              || row.categories.allLocations.some(value => !text(value)) || !row.categories.allLocations.includes(row.categories.location)) fail('invalid native location inventory')
            if (row.country != null && (typeof row.country !== 'string' || !/^[A-Z]{2}$/.test(row.country)
              || ['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(row.country) || !nativeCountryName(row.country))) fail('invalid native country')
            for (const field of ['descriptionPlain', 'description', 'openingPlain', 'opening', 'descriptionBodyPlain', 'descriptionBody', 'additionalPlain', 'additional']) {
              if (row[field] != null && typeof row[field] !== 'string') fail('malformed source content')
            }
            if (row.lists != null && (!Array.isArray(row.lists) || row.lists.some(section => !section || typeof section.text !== 'string' || typeof section.content !== 'string'))) fail('invalid native content sections')
            if (row.createdAt != null && (!Number.isSafeInteger(row.createdAt) || row.createdAt < 0 || !Number.isFinite(new Date(row.createdAt).getTime()))) fail('invalid native creation timestamp')
            records.push(row)
          }
          pagesFetched++
        } while (page.length === PAGE_SIZE)
        let scopeComplete = true
        const jobs = []
        const checkedAt = now()
        if (typeof checkedAt !== 'string' || !Number.isFinite(Date.parse(checkedAt))) fail('invalid check time')
        for (const row of records) {
          const primaryCountry = row.country ? nativeCountryName(row.country) : null
          const labelCountry = locationCountry(row.categories.location)
          if (primaryCountry && labelCountry && primaryCountry !== labelCountry) fail('country and primary location disagree')
          const india = []
          for (const location of row.categories.allLocations) {
            const country = locationCountry(location) || (location === row.categories.location ? primaryCountry : null)
            if (!country) scopeComplete = false
            if (country === 'India') india.push(location)
          }
          if (!india.length) continue
          const body = [row.openingPlain || row.opening, row.descriptionBodyPlain || row.descriptionBody || row.descriptionPlain || row.description,
            ...(row.lists || []).filter(section => hasSourceDescription({ jobDescription: section.content })).map(section => `${section.text}\n${section.content}`), row.additionalPlain || row.additional].filter(text).map(value => toPlainText(value)).join('\n\n')
          const description = hasSourceDescription({ jobDescription: body }) ? body : null
          jobs.push({ source: SOURCE, company: COMPANY, companyCareerPage: OFFICIAL_CAREERS_URL, atsPlatform: 'lever',
            jobId: row.id, requisitionId: row.id, title: row.text.trim(), location: india[0], locations: india, country: 'India',
            sourceUrl: row.hostedUrl, applyUrl: row.applyUrl, link: row.applyUrl,
            department: row.categories.department || row.categories.team || null, employmentType: row.categories.commitment || null,
            // Lever creation time does not establish public publication time.
            nativeCreatedAt: row.createdAt ?? null, postingDate: null, closingDate: null,
            jobDescription: description, sourceDescription: description, scrapedAt: checkedAt })
        }
        const complete = scopeComplete && jobs.every(hasSourceDescription)
        if (!complete) for (const job of jobs) job.sourceListingComplete = false
        return attachInventoryEvidence(jobs, { status: complete ? records.length ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
          surface: NATIVE_JOBS_URL, firstParty: true, listingComplete: complete, pagesFetched: pagesFetched + proofRequests, reportedTotal: records.length,
          indiaFacetCount: scopeComplete ? jobs.length : null, verifiedAt: checkedAt, reason: complete ? 'unfiltered-native-lever-skip-limit-inventory-terminal-short-page'
            : !scopeComplete ? 'native-location-scope-unresolved' : 'selected-role-description-unavailable' })
      }
      return await Promise.race([collect(), aborted])
    } finally {
      clearTimeout(timer)
      combined.removeEventListener('abort', onAbort)
    }
  },
})
export const run = async (options = {}) => createWovenByToyotaScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
