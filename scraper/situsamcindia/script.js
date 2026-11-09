import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SITUS_AMC_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SITUS_AMC_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const JOB_SEARCH_URL = PROVIDER_METADATA.companyCareerPage
export const CORPORATE_JOBS_URL = PROVIDER_METADATA.corporateJobsPageUrl
export const RESIDENTIAL_JOBS_URL = PROVIDER_METADATA.residentialJobsPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const htmlToLines = (value) => decodeHtmlEntities(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'situsamcindia-official',
  timeoutMs: 15000,
})

const makeAbsoluteUrl = (value, baseUrl = JOB_SEARCH_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const findValueAfterLabel = (lines, label) => {
  const labelIndex = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase())
  if (labelIndex < 0) return null

  for (let index = labelIndex + 1; index < lines.length; index += 1) {
    const value = lines[index]
    if (value && value.toLowerCase() !== label.toLowerCase()) return value
  }

  return null
}

const extractSectionAfterHeading = (lines, startHeading, endHeadings = []) => {
  const startIndex = lines.findIndex((line) => line.toLowerCase() === startHeading.toLowerCase())
  if (startIndex < 0) return null

  const values = []

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (endHeadings.some((heading) => line.toLowerCase() === heading.toLowerCase())) break
    values.push(line)
  }

  return normalizeWhitespace(values.join(' '))
}

const parseLocationCode = (value) => {
  const parts = normalizeWhitespace(value)?.split(/\s*-\s*/).map((part) => normalizeWhitespace(part)).filter(Boolean) || []
  if (parts.length < 3) {
    return {
      location: 'India',
      city: null,
      state: null,
      country: 'India',
    }
  }

  const state = parts[1] || null
  const city = parts[2] || null

  return {
    location: `${city}, ${state}, India`,
    city,
    state,
    country: 'India',
  }
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'On-site'
  if (/remote/i.test(normalized)) return 'Remote'
  if (/hybrid/i.test(normalized)) return 'Hybrid'
  return 'On-site'
}

export const hasOfficialJobSearchSignal = (html = '') => {
  const normalized = (normalizeWhitespace(html) || '').toLowerCase()

  return normalized.includes('search open jobs at situsamc and apply today!')
    && normalized.includes('work at situsamc')
    && (normalized.includes("how you'll work") || normalized.includes('how you’ll work'))
    && normalized.includes('career areas')
    && normalized.includes('locations')
    && normalized.includes('search jobs')
  }

export const hasCorporateJobsPageSignal = (html = '') => {
  const normalized = (normalizeWhitespace(html) || '').toLowerCase()

  return normalized.includes('corporate current job opportunities')
    && normalized.includes('showing')
    && extractIndiaJobCardsFromAreaPage(html).length > 0
  }

export const hasResidentialJobsPageSignal = (html = '') => {
  const normalized = (normalizeWhitespace(html) || '').toLowerCase()

  return normalized.includes('residential real estate current job opportunities')
    && normalized.includes('showing')
    && extractIndiaJobCardsFromAreaPage(html).length > 0
  }

export const hasOfficialJobDetailSignal = (html = '') => {
  const normalized = (normalizeWhitespace(html) || '').toLowerCase()

  return normalized.includes('situsamc')
    && (normalized.includes('job attributes') || normalized.includes('req id'))
    && normalized.includes('job location')
    && normalized.includes('overview')
    && normalized.includes('apply now')
  }

export const extractIndiaJobCardsFromAreaPage = (html = '') => {
  const cards = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const detailUrl = makeAbsoluteUrl(match[1], JOB_SEARCH_URL)
    const anchorText = normalizeWhitespace(match[2])

    if (!detailUrl || !anchorText || !anchorText.includes(' IN - ')) continue

    const normalizedText = anchorText.replace(/^Save Saved\s+/i, '').replace(/^Share\s+/i, '')
    const parsed = normalizedText.match(/^(.*?)\s+(IN - [A-Za-z]+(?: - [A-Za-z ]+)+)\s+(JR\d+)\s+(Onsite|Remote|Hybrid)$/i)
    if (!parsed) continue

    const [, title, locationCode, reqId, remoteStatus] = parsed
    if (seen.has(reqId)) continue
    seen.add(reqId)

    cards.push({
      title: normalizeWhitespace(title),
      locationCode: normalizeWhitespace(locationCode),
      reqId: normalizeWhitespace(reqId),
      remoteStatus: normalizeWhitespace(remoteStatus),
      detailUrl,
    })
  }

  return cards
}

export const extractJobFromDetailHtml = (html = '', card = {}, { scrapedAt } = {}) => {
  const lines = htmlToLines(html)
  const title = normalizeWhitespace(card.title)
  const jobId = findValueAfterLabel(lines, 'Req ID') || card.reqId
  const department = findValueAfterLabel(lines, 'Job Category')
  const employmentType = findValueAfterLabel(lines, 'Job Type')
  const locationCode = findValueAfterLabel(lines, 'Job Location') || card.locationCode
  const remoteStatus = normalizeRemoteStatus(findValueAfterLabel(lines, 'Type') || card.remoteStatus)
  const applyUrl = makeAbsoluteUrl(String(html).match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i)?.[1] || '', JOB_SEARCH_URL)
  const overview = extractSectionAfterHeading(lines, 'Overview', [
    'Essential Job Functions:',
    'Qualifications/ Requirements:',
    'Our Benefits',
    'What it’s like to',
    'Part of a global team',
  ])
  const essentialFunctions = extractSectionAfterHeading(lines, 'Essential Job Functions:', [
    'Qualifications/ Requirements:',
    'Our Benefits',
    'What it’s like to',
    'Part of a global team',
  ])
  const parsedLocation = parseLocationCode(locationCode)

  if (!title || !jobId) return null

  return {
    title,
    company: COMPANY_NAME,
    department,
    location: parsedLocation.location,
    city: parsedLocation.city,
    state: parsedLocation.state,
    country: parsedLocation.country,
    jobId,
    requisitionId: jobId,
    sourceUrl: card.detailUrl,
    applyUrl: applyUrl || card.detailUrl,
    employmentType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace([overview, essentialFunctions].filter(Boolean).join(' ')),
    remoteStatus,
    source: SOURCE,
    link: card.detailUrl,
    scrapedAt,
  }
}

export const createSitusAmcIndiaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const jobSearchHtml = await fetchText(JOB_SEARCH_URL)
    if (!hasOfficialJobSearchSignal(jobSearchHtml)) {
      throw new Error('The official SitusAMC job-search page no longer matches the verified public surface')
    }

    const corporateJobsHtml = await fetchText(CORPORATE_JOBS_URL)
    if (!hasCorporateJobsPageSignal(corporateJobsHtml)) {
      throw new Error('The official SitusAMC corporate jobs page no longer matches the verified public surface')
    }

    const residentialJobsHtml = await fetchText(RESIDENTIAL_JOBS_URL)
    if (!hasResidentialJobsPageSignal(residentialJobsHtml)) {
      throw new Error('The official SitusAMC residential jobs page no longer matches the verified public surface')
    }

    const areaCards = [
      ...extractIndiaJobCardsFromAreaPage(corporateJobsHtml),
      ...extractIndiaJobCardsFromAreaPage(residentialJobsHtml),
    ]

    const uniqueCards = areaCards.filter((card, index, array) =>
      array.findIndex((candidate) => candidate.reqId === card.reqId) === index)

    const jobs = []

    for (const card of uniqueCards) {
      const detailHtml = await fetchText(card.detailUrl)
      if (!hasOfficialJobDetailSignal(detailHtml)) continue

      const job = extractJobFromDetailHtml(detailHtml, card, { scrapedAt: now() })
      if (job) jobs.push(job)
    }

    if (jobs.length === 0) {
      throw new Error('SitusAMC India public role detail pages no longer match the verified official careers surface')
    }

    return jobs
  },
})

export const run = async (options = {}) => createSitusAmcIndiaScraper().run(options)

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
