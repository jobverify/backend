import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { CLOUDSTRATS_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const extractFirst = (pattern, value) => pattern.exec(String(value ?? ''))?.[1] || null

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  ...options,
})

const isExpectedCareersConnectTimeout = (error) => {
  const code = `${error?.code ?? ''} ${error?.cause?.code ?? ''}`
  const message = `${error?.message ?? error ?? ''} ${error?.cause?.message ?? ''}`

  return /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT/i.test(code)
    || /Connect Timeout Error|timed out|timeout/i.test(message)
}

const buildVerifiedCareersTimeoutError = (error) => {
  const outageError = new Error(
    'Cloudstrats verified careers page timed out before the first-party board could be checked',
    { cause: error },
  )
  outageError.softFailure = true
  outageError.upstreamOutage = true
  outageError.failureKind = 'network_or_timeout'
  outageError.abortRetries = true
  return outageError
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Employment Application')
    && normalized.includes('Unlock your potential with cloudstrats')
    && normalized.includes('Current Opportunities')
    && normalized.includes('Cloud Engineer')
}

export const extractOpenRoles = (html = '') => Array.from(
  String(html ?? '').matchAll(
    /<article>[\s\S]*?<a href="(https:\/\/cloudstrats\.ai\/job\/\d+\/)">\s*([^<]+?)\s*<\/a>[\s\S]*?<p>\s*Type:\s*([^<]+?)\s*<\/p>[\s\S]*?<p>\s*([^<]+?)\s*<\/p>[\s\S]*?<a href="https:\/\/cloudstrats\.ai\/job\/\d+\/">Browse<\/a>\s*<a href="(https:\/\/cloudstrats\.ai\/apply\/\d+\/)">Apply<\/a>[\s\S]*?<\/article>/gi,
  ),
  (match) => ({
    detailUrl: match[1],
    title: normalizeWhitespace(match[2]),
    employmentType: normalizeWhitespace(match[3]),
    summary: normalizeWhitespace(match[4]),
    applyUrl: match[5],
  }),
).filter((item) => item.title && item.detailUrl && item.applyUrl)

const extractDetail = (html = '', listing = {}) => ({
  title: normalizeWhitespace(extractFirst(/<h2>\s*([^<]+?)\s*<\/h2>/i, html)) || listing.title,
  employmentType:
    normalizeWhitespace(extractFirst(/<p>\s*Type:\s*([^<]+?)\s*<\/p>/i, html))
    || listing.employmentType,
  postingDate: normalizeWhitespace(extractFirst(/<p>\s*Posted:\s*([^<]+?)\s*<\/p>/i, html)) || null,
  jobDescription:
    normalizeWhitespace(extractFirst(/<h5>\s*Job Description\s*<\/h5>\s*<p>\s*([\s\S]*?)\s*<\/p>/i, html))
    || listing.summary
    || null,
  applyUrl:
    extractFirst(/<a href="(https:\/\/cloudstrats\.ai\/apply\/\d+\/)">\s*Apply Now\s*<\/a>/i, html)
    || listing.applyUrl,
})

export const createCloudstratsTechnologiesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    let careersHtml
    try {
      careersHtml = await fetchText(CAREERS_URL, { attempts: 1 })
    } catch (error) {
      if (isExpectedCareersConnectTimeout(error)) {
        throw buildVerifiedCareersTimeoutError(error)
      }
      throw error
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Cloudstrats careers page no longer matches the trusted first-party surface')
    }

    const listings = extractOpenRoles(careersHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.detailUrl)
      const detail = extractDetail(detailHtml, listing)
      const jobId = slugify(detail.title)

      jobs.push({
        title: detail.title,
        company: COMPANY,
        department: null,
        location: 'India',
        city: null,
        country: 'India',
        sourceUrl: listing.detailUrl,
        applyUrl: detail.applyUrl,
        jobId,
        requisitionId: jobId,
        employmentType: detail.employmentType,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: detail.postingDate,
        closingDate: null,
        jobDescription: detail.jobDescription,
        remoteStatus: null,
        source: SOURCE,
        link: detail.applyUrl,
        scrapedAt: now(),
        companyCareerPage: CAREERS_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createCloudstratsTechnologiesScraper(options).run(options)

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
