import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import MODEL_N_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = MODEL_N_CATALOG.source
export const COMPANY = MODEL_N_CATALOG.companyName
export const CAREERS_URL = MODEL_N_CATALOG.companyCareerPage
export const LEVER_API_URL = MODEL_N_CATALOG.leverApiUrl

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const html = await fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

  return {
    status: 200,
    url,
    html,
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  label: SOURCE,
  timeoutMs: 15000,
})

const trustedLeverUrl = (value, id) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.protocol === 'https:'
      && url.hostname === 'jobs.lever.co'
      && url.pathname.replace(/\/$/, '') === `/modeln/${id}`
  } catch {
    return false
  }
}

const isIndiaPosting = (posting) => [
  posting?.categories?.location,
  ...(Array.isArray(posting?.categories?.allLocations) ? posting.categories.allLocations : []),
].some((location) => /\bIndia\b/i.test(String(location ?? '')))

export const extractIndiaJobs = (payload, now = () => new Date().toISOString()) => {
  if (!Array.isArray(payload)) {
    throw new Error('Model N Lever postings payload is not an array')
  }

  return payload.filter(isIndiaPosting).map((posting) => {
    const id = String(posting?.id ?? '').trim()
    const title = String(posting?.text ?? '').trim()
    const location = String(posting?.categories?.location ?? '').trim()
    if (!id || !title || !location || !trustedLeverUrl(posting?.hostedUrl, id)) {
      throw new Error('Model N India posting lacks a trusted Lever job URL or required fields')
    }
    const sourceUrl = posting.hostedUrl
    const applyUrl = posting?.applyUrl || `${sourceUrl}/apply`
    if (applyUrl !== `${sourceUrl}/apply`) {
      throw new Error('Model N India posting lacks a trusted Lever apply URL')
    }
    const createdAt = Number(posting?.createdAt)
    return {
      title,
      company: COMPANY,
      location,
      city: location.replace(/\s*,?\s*India\b.*$/i, '').trim() || null,
      country: 'India',
      source: SOURCE,
      sourceUrl,
      applyUrl,
      link: sourceUrl,
      jobId: id,
      requisitionId: id,
      department: String(posting?.categories?.team || posting?.categories?.department || '').trim() || null,
      employmentType: String(posting?.categories?.commitment || '').trim() || null,
      jobDescription: String(posting?.descriptionPlain || '').trim() || null,
      remoteStatus: posting?.workplaceType === 'hybrid' ? 'Hybrid' : posting?.workplaceType === 'remote' ? 'Remote' : null,
      postingDate: Number.isFinite(createdAt) && createdAt > 0 ? new Date(createdAt).toISOString() : null,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: MODEL_N_CATALOG.companyDomain,
      atsPlatform: MODEL_N_CATALOG.atsPlatform,
    }
  })
}

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Careers\s*\|\s*Model N\s*<\/title>/i.test(rawHtml)
    && /Open positions/i.test(normalized)
    && /id=["']lever-jobs-container["']/i.test(rawHtml)
    && /jobs\.lever\.co\/embed\/index\.js/i.test(rawHtml)
    && /accountName\s*:\s*["']modeln["']/i.test(rawHtml)
  }

export const createModelNScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const page = await fetchPage(CAREERS_URL)

    if (
      Number(page?.status) !== 200
      || page?.url !== CAREERS_URL
      || !hasOfficialCareersSignal(page.html)
    ) {
      throw new Error('Model N careers page no longer exposes the verified Lever embed')
    }

    const postings = await fetchJson(LEVER_API_URL)
    const jobs = extractIndiaJobs(postings, now)
    return attachInventoryEvidence(jobs, {
      status: postings.length === 0 ? 'verified-empty' : 'complete-inventory',
      surface: LEVER_API_URL,
      firstParty: true,
      listingComplete: true,
      pagesFetched: 1,
      reportedTotal: postings.length,
      indiaFacetCount: jobs.length,
      verifiedAt: now(),
      reason: 'Public Lever postings API embedded by the official Model N careers page.',
    })
  },
})

export const run = async (options = {}) => createModelNScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
