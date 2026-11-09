import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'maxed'
export const COMPANY = 'MaxEd'
export const HOMEPAGE_URL = 'https://maxed.in/'
export const PAGE_SITEMAP_URL = 'https://maxed.in/page-sitemap.xml'
export const INTERNSHIP_URL = 'https://maxed.in/internship/'
export const COMPANY_DOMAIN = 'maxed.in'
export const SHARED_APPLY_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdxey-T9eLNQxKTxrORZ7A4kOSRa1kls0rZQIyXlV8KDXUUfw/viewform'
export const MISSING_ROUTE_URLS = [
  'https://maxed.in/careers/',
  'https://maxed.in/jobs/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const JOB_TITLE = 'Internship Program'
const JOB_DESCRIPTION =
  'Launch your career with the MaxEd Internship Program across market research, data analytics, and HR operations. The verified public program highlights hands-on learning, mentorship, diverse exposure, networking opportunities, and career development.'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeVisibleText = (value) => normalizeWhitespace(stripTags(value)) || ''

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasVerifiedInternshipLink = (html) =>
  /href=["'](?:https:\/\/maxed\.in\/internship\/|\/internship\/)["']/i.test(String(html ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*Research and Consulting\s*\|\s*MaxEd\s*<\/title>/i.test(page)
    && text.includes('cochin, kerala')
    && text.includes('maxed, an initiative from i-mira knowledge solutions offers data analytics and curated market intelligence solutions')
    && text.includes('conducted the largest opinion survey in kerala')
    && text.includes('90+ research projects across kerala, karnataka, tamil nadu, telangana, and andhra pradesh')
    && text.includes('first company to publish kerala-specific industry sector reports')
    && hasVerifiedInternshipLink(page)
}

export const hasVerifiedPageSitemapSignal = (xml) => {
  const page = String(xml ?? '')

  return /<urlset\b/i.test(page)
    && /<loc>\s*https:\/\/maxed\.in\/\s*<\/loc>/i.test(page)
    && /<loc>\s*https:\/\/maxed\.in\/internship\/\s*<\/loc>/i.test(page)
    && /<loc>\s*https:\/\/maxed\.in\/internship-dashboard\/\s*<\/loc>/i.test(page)
}

export const extractApplyUrl = (html) =>
  normalizeWhitespace(
    String(html ?? '').match(
      /href=["'](https:\/\/docs\.google\.com\/forms\/d\/e\/1FAIpQLSdxey-T9eLNQxKTxrORZ7A4kOSRa1kls0rZQIyXlV8KDXUUfw\/viewform)["']/i,
    )?.[1],
  )

export const hasOfficialInternshipSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*Internship(?:2025)?\s*-\s*MaxEd\s*-\s*Best Market Research Agency\s*<\/title>/i.test(page)
    && text.includes('launch your career with the maxed internship program')
    && text.includes('market research, data analytics, and hr operations')
    && text.includes('key benefits of the program')
    && text.includes('hands-on learning')
    && text.includes('mentorship')
    && text.includes('diverse exposure')
    && text.includes('networking opportunities')
    && text.includes('career development')
    && text.includes('your future starts here')
    && extractApplyUrl(page) === SHARED_APPLY_URL
}

export const isVerifiedMissingRoute = ({ status, html } = {}) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return status === 404
    && /<title>\s*Page not found\s*-\s*MaxEd\s*-\s*Best Market Research Agency\s*<\/title>/i.test(page)
    && text.includes("the page can't be found")
    && text.includes('explore business events services about')
}

const buildInternshipJob = () => ({
  title: JOB_TITLE,
  company: COMPANY,
  department: 'Internship',
  location: 'India',
  city: null,
  country: 'India',
  jobId: 'maxed-internship-program',
  requisitionId: 'maxed-internship',
  sourceUrl: INTERNSHIP_URL,
  applyUrl: SHARED_APPLY_URL,
  employmentType: 'Internship',
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: JOB_DESCRIPTION,
  remoteStatus: null,
})

export const extractPublicJobs = (html) => {
  if (!hasOfficialInternshipSignal(html)) {
    throw new Error('MaxEd internship page no longer matches the verified official public opportunity surface')
  }

  const applyUrl = extractApplyUrl(html)
  if (applyUrl !== SHARED_APPLY_URL) {
    throw new Error('MaxEd internship page no longer exposes the verified shared Google Form apply route')
  }

  return [buildInternshipJob()]
}

export const createMaxEdScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('MaxEd homepage no longer matches the verified official public site')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (pageSitemap.status !== 200 || !hasVerifiedPageSitemapSignal(pageSitemap.html)) {
      throw new Error('MaxEd page sitemap no longer matches the verified official public structure')
    }

    const internshipPage = await fetchPage(INTERNSHIP_URL)
    if (internshipPage.status !== 200) {
      throw new Error(`MaxEd internship page returned HTTP ${internshipPage.status}`)
    }

    const jobs = extractPublicJobs(internshipPage.html)

    for (const url of MISSING_ROUTE_URLS) {
      const missingRoute = await fetchPage(url)
      if (!isVerifiedMissingRoute(missingRoute)) {
        throw new Error(`MaxEd missing-route behavior changed materially for ${url}`)
      }
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createMaxEdScraper().run(options)

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
