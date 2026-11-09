import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { isIndiaJob as isIndiaJobInScope } from '../../scraper-support/utils/indiaLocationFilter.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'netcontechnologies'
export const COMPANY = 'Netcon Technologies'
export const HOME_URL = 'https://arche.global/'
export const CAREERS_URL = 'https://arche.global/careers'
export const JOBS_URL = 'https://arche.global/jobs'
export const SITEMAP_URL = 'https://arche.global/sitemap.xml'
export const APPLY_URL = 'https://arche.global/fill-application'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DETAIL_URL_REGEX = /^https:\/\/arche\.global\/jobs\/([^/?#]+)\/?$/i
const OFFICIAL_NETCON_PATTERNS = [
  /"name"\s*:\s*"Netcon Technologies"/i,
  /"alternateName"\s*:\s*"Netcon Global"/i,
  /"url"\s*:\s*"https:\/\/www\.netconglobal\.com\/"/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/[�]+/g, ' ')
    .replace(/\?{2,}/g, ' ')
    .replace(/\s\?+\s/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const absolutizeUrl = (value, base = HOME_URL) => {
  try {
    return new URL(value, base).href
  } catch {
    return null
  }
}

const deriveJobIdFromUrl = (value) => {
  try {
    const url = new URL(value)
    return normalizeWhitespace(url.pathname.split('/').filter(Boolean).at(-1))
      ?.toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || null
  } catch {
    return null
  }
}

const deriveCityFromLocation = (value) => {
  const primaryToken = normalizeWhitespace(value)
    ?.split(/\/|,|\||&/)
    .map((part) => normalizeWhitespace(part))
    .find(Boolean)

  return normalizeCity(primaryToken || null)
}

const cleanExperience = (value) =>
  normalizeWhitespace(value?.replace(/^Experience\s*:\s*/i, ''))

const hasOfficialNetconStructuredData = (html) =>
  OFFICIAL_NETCON_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

const extractFieldValue = (html, fieldName, tagName) =>
  normalizeWhitespace(
    String(html ?? '').match(
      new RegExp(
        `data-framer-name="${fieldName}"[\\s\\S]*?<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
        'i',
      ),
    )?.[1],
  )

const extractDetailContentSlice = (html) => {
  const page = String(html ?? '')
  const startIndex = page.search(/data-framer-name="Content"/i)
  if (startIndex < 0) return null

  const openingTagEnd = page.indexOf('>', startIndex)
  if (openingTagEnd < 0) return null

  const tail = page.slice(openingTagEnd + 1)
  const endCandidates = [
    tail.search(/<div class="framer-17soqr0"/i),
    tail.search(/<div id="svg-templates"/i),
    tail.search(/<div id="overlay"/i),
  ].filter((index) => index >= 0)

  const endIndex = endCandidates.length > 0 ? Math.min(...endCandidates) : tail.length
  return tail.slice(0, endIndex)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return hasOfficialNetconStructuredData(page)
    && /<title>\s*Careers \| Arche\s*<\/title>/i.test(page)
    && /Work at Arche/i.test(page)
    && /Search jobs/i.test(page)
}

export const hasOfficialJobsSignal = (html) => {
  const page = String(html ?? '')

  return hasOfficialNetconStructuredData(page)
    && /<title>\s*Jobs \| Arche\s*<\/title>/i.test(page)
    && /Explore career opportunities at Arche AI\./i.test(page)
    && /future of enterprise technology and AI transformation/i.test(page)
}

export const hasOfficialDetailSignal = (html) => {
  const page = String(html ?? '')

  return hasOfficialNetconStructuredData(page)
    && /data-framer-name="Job Title"/i.test(page)
    && /data-framer-name="Job Location"/i.test(page)
    && /Submit application/i.test(page)
}

export const extractJobDetailUrlsFromSitemap = (xml) => {
  const urls = []
  const seen = new Set()

  for (const match of String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)) {
    const url = normalizeWhitespace(match[1])
    if (!url || url === JOBS_URL || !DETAIL_URL_REGEX.test(url) || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }

  return urls
}

export const extractJobDetail = (html, sourceUrl) => {
  const page = String(html ?? '')

  if (!hasOfficialDetailSignal(page)) {
    throw new Error(`Verified Netcon Technologies detail page changed materially: ${sourceUrl}`)
  }

  const title = extractFieldValue(page, 'Job Title', 'h1')
  const location = extractFieldValue(page, 'Job Location', 'p')
  const experienceRequired = cleanExperience(extractFieldValue(page, 'Job Description', 'p'))
  const applyUrl = absolutizeUrl(
    String(page.match(/href="([^"]*fill-application[^"]*)"/i)?.[1] ?? '') || APPLY_URL,
    sourceUrl,
  ) || APPLY_URL
  const jobDescription = stripTags(extractDetailContentSlice(page))
  const canonicalSourceUrl = absolutizeUrl(sourceUrl) || sourceUrl
  const jobId = deriveJobIdFromUrl(canonicalSourceUrl)
  const city = deriveCityFromLocation(location)

  if (!title || !location || !jobId) {
    throw new Error(`Unable to extract required fields from verified Netcon Technologies detail page: ${sourceUrl}`)
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: city || null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: canonicalSourceUrl,
    applyUrl,
    employmentType: null,
    experienceRequired: experienceRequired || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription:
      jobDescription || `Official ${COMPANY} opening listed on the verified Arche jobs detail page.`,
    remoteStatus: 'On-site',
  }
}

export const createNetconTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Response is not the verified official Netcon Technologies careers page')
    }

    const jobsHtml = await fetchText(JOBS_URL)
    if (!hasOfficialJobsSignal(jobsHtml)) {
      throw new Error('Response is not the verified official Netcon Technologies jobs page')
    }

    const sitemapXml = await fetchText(SITEMAP_URL)
    const detailUrls = extractJobDetailUrlsFromSitemap(sitemapXml)
    if (detailUrls.length === 0) {
      throw new Error('Verified Netcon Technologies Arche sitemap no longer exposes public job detail URLs')
    }

    const selectedUrls = maxJobs ? detailUrls.slice(0, maxJobs) : detailUrls
    const jobs = []

    for (const detailUrl of selectedUrls) {
      const detailHtml = await fetchText(detailUrl)
      const job = extractJobDetail(detailHtml, detailUrl)
      if (!isIndiaJobInScope(job)) continue

      jobs.push({
        ...job,
        source: SOURCE,
        link: job.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createNetconTechnologiesScraper().run(options)

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
