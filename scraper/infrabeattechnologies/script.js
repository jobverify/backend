import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import INFRABEAT_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = INFRABEAT_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const shouldUseBrowserFallback = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')

const stripTags = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(div|p|li|ul|ol|h[1-6]|strong)>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => stripTags(value) || null

const slugify = (value) => normalizeText(value)?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title[^>]*>\s*Careers at InfraBeat: Join Our Global Digital Transformation Team\s*<\/title>/i.test(page)
    && normalized?.includes('Join our innovative team')
    && normalized?.includes('Open Positions')
    && normalized?.includes('Apply Now')
}

export const extractJobs = (html = '') => {
  const jobs = []
  const matches = String(html ?? '').matchAll(
    /<div class="accordion-item[^"]*">[\s\S]*?<div class="modal fade career-modal" id="([^"]+)"[\s\S]*?<div class="career-apply-modal">([\s\S]*?)<\/div>[\s\S]*?<h3 class="job_title">([\s\S]*?)<\/h3>[\s\S]*?<h6>\s*Location\s*<\/h6>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<h6>\s*Experience\s*<\/h6>[\s\S]*?<p>([\s\S]*?)<\/p>/gi,
  )

  for (const match of matches) {
    const modalId = normalizeText(match[1])
    const detailsHtml = match[2]
    const title = normalizeText(match[3])
    const location = normalizeText(match[4])
    const experienceRequired = normalizeText(match[5])
    const jobId = modalId || slugify(title)
    if (!jobId || !title || !location) continue

    const sourceUrl = `${CAREERS_URL}#${jobId}`
    const jobDescription = normalizeText(detailsHtml)

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: `${location}, India`,
      city: location,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
    })
  }

  return jobs
}

export const createInfrabeatTechnologiesScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchBrowserText, now: overrideNow } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({
          userAgent: USER_AGENT,
          settleTimeMs: 4000,
        })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      const page = await session.fetchPage(url)

      if (![200, 304].includes(page.status)) {
        throw new Error(`HTTP ${page.status} for ${url}`)
      }

      return page.html
    })

    const fetchTextWithBrowserFallback = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (!shouldUseBrowserFallback(error)) {
          throw error
        }

        return browserTextFetcher(url)
      }
    }

    try {
      const careersHtml = await fetchTextWithBrowserFallback(CAREERS_URL)
      if (!hasOfficialCareersSignal(careersHtml)) {
        throw new Error('The verified Infrabeat Technologies careers page no longer matches the trusted first-party surface')
      }

      const jobs = extractJobs(careersHtml)
      if (jobs.length === 0) {
        throw new Error('Infrabeat Technologies careers page no longer exposes the verified inline job cards')
      }

      const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

      return selectedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        companyCareerPage: CAREERS_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: (overrideNow || now)(),
      }))
    } finally {
      if (browserSession) {
        await browserSession.close().catch(() => {})
      }
    }
  },
})

export const run = async (options = {}) => createInfrabeatTechnologiesScraper().run(options)

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
