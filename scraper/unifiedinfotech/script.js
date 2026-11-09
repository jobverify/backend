import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'unifiedinfotech'
export const COMPANY = 'Unified Infotech'
export const CAREERS_URL = 'https://www.unifiedinfotech.net/careers/'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Unified Infotech',
  adapter: 'script',
  modulePath: '../../scraper/unifiedinfotech/script.js',
  homepageUrl: 'https://www.unifiedinfotech.net/',
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-page-load-more-cards',
  extractionStrategy: 'verified-first-party-careers-page+public-opening-cards+same-page-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'unifiedinfotech.net',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.unifiedinfotech.net/careers/ was the live first-party Unified Infotech careers page, that it exposed public opening cards behind a Load More interface, and that the page included a first-party Apply For A Position form.',
  dryRunFile: 'unifiedinfotech/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const htmlToLines = (html) => decodeHtmlEntities(String(html ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(?:h[1-6]|p|div|section|article|li|ul|ol)\b[^>]*>/gi, '\n')
  .replace(/<\/(?:h[1-6]|p|div|section|article|li|ul|ol)>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\r\n?/g, '\n')
  .split(/\n+/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

export const defaultFetchText = (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => fetchTextWithRetry(url, {
  fetchImpl,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs,
})

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /Maximize Your Career &amp; Job Opportunities/i.test(page)
    && /Load More/i.test(page)
    && /Apply For A Position/i.test(page)
    && /read more/i.test(page)
}

export const extractJobCards = (html) => {
  const page = String(html ?? '')
  const lines = htmlToLines(page)
  const jobs = []
  const detailUrls = [...page.matchAll(/href=["'](https:\/\/www\.unifiedinfotech\.net\/career\/[^"']+)["']/gi)]
    .map((match) => match[1])
  const openingsIndex = lines.findIndex((line) => /^Explore Open Positions at Unified Infotech$/i.test(line))
  const endIndex = lines.findIndex((line) => /^No jobs are posted right now/i.test(line) || /^Ready to Embrace Digital Change\?$/i.test(line))

  if (openingsIndex === -1 || endIndex === -1 || endIndex <= openingsIndex) {
    return jobs
  }

  let detailUrlIndex = 0

  for (let index = openingsIndex + 1; index < endIndex; index += 1) {
    const remoteType = lines[index]
    const employmentType = lines[index + 1] || null
    const title = lines[index + 2] || null
    const description = lines[index + 3] || null
    const experienceLine = lines[index + 4] || null
    const location = lines[index + 5] || null

    if (!/^Remote\/Hybrid$/i.test(remoteType || '')) continue
    if (!/^Full Time$/i.test(employmentType || '')) continue
    if (!title || !description || !experienceLine || !location) continue
    if (!/^Exp\s*\(/i.test(experienceLine)) continue

    const sourceUrl = detailUrls[detailUrlIndex] || CAREERS_URL
    detailUrlIndex += 1

    jobs.push({
      title,
      remoteType,
      employmentType,
      location,
      sourceUrl,
      applyUrl: sourceUrl,
      experienceRequired: normalizeWhitespace(
        experienceLine.replace(/^Exp\s*\(/i, '').replace(/\)\s*$/i, ''),
      ),
      jobDescription: description,
    })

    index += 5
  }

  return jobs
}

export const run = async ({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) => {
  const page = await fetchText(CAREERS_URL)

  if (!hasOfficialCareersSignal(page)) {
    throw new Error('Unified Infotech verified first-party careers page changed materially')
  }

  const jobs = extractJobCards(page)
  if (!jobs.length) {
    throw new Error('Unified Infotech verified first-party careers page no longer exposes trusted job cards')
  }

  return jobs.map((job) => ({
    ...job,
    company: COMPANY,
    city: normalizeWhitespace(job.location.split('/')[0]),
    country: 'India',
    link: job.applyUrl || job.sourceUrl,
    source: SOURCE,
    scrapedAt: now(),
  }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}

