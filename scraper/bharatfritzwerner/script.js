import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BHARAT_FRITZ_WERNER_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = BHARAT_FRITZ_WERNER_CATALOG.source
export const COMPANY = BHARAT_FRITZ_WERNER_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = BHARAT_FRITZ_WERNER_CATALOG.officialBrandName
export const VERIFIED_ON = BHARAT_FRITZ_WERNER_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = BHARAT_FRITZ_WERNER_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = BHARAT_FRITZ_WERNER_CATALOG
export const HOMEPAGE_URL = BHARAT_FRITZ_WERNER_CATALOG.homepageUrl
export const CAREERS_URL = BHARAT_FRITZ_WERNER_CATALOG.companyCareerPage
export const CAREER_ALIAS_URL = BHARAT_FRITZ_WERNER_CATALOG.careerAliasUrl
export const NO_PUBLIC_JOB_ROUTE_URLS = BHARAT_FRITZ_WERNER_CATALOG.noPublicJobRouteUrls

const COMPANY_DOMAIN = BHARAT_FRITZ_WERNER_CATALOG.companyDomain
const ATS_PLATFORM = BHARAT_FRITZ_WERNER_CATALOG.atsPlatform
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const stripTagsToLines = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|ul|ol|h[1-6]|section|main)>/gi, '\n')
  .replace(/<(p|div|li|ul|ol|h[1-6]|section|main)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\r/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{2,}/g, '\n')
  .split('\n')
  .map((line) => normalizeText(line))
  .filter(Boolean)

const extractMatch = (value, pattern) => String(value ?? '').match(pattern)?.[1] ?? null

const canonicalizeCareerUrl = (value) => {
  try {
    const url = new URL(value, HOMEPAGE_URL)
    url.hash = ''
    if (url.pathname !== '/' && !url.pathname.endsWith('/')) {
      url.pathname = `${url.pathname}/`
    }
    return url.toString()
  } catch {
    return null
  }
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const isSectionHeading = (line) => {
  const normalized = normalizeText(line)
  if (!normalized) return false

  return [
    'Primary objective:',
    'Job responsibilities/description:',
    'Customer Engagement:',
    'Solution Development:',
    'Team Leadership:',
    'Technical Support:',
    'Product Development Support:',
    'Market and Industry Insights:',
    'Job prerequisites:',
    'Education:',
    'Experience:',
    'Key skill required:',
    'Quality Management System (QMS):',
    'Product Quality Assurance:',
    'Supplier Quality Management:',
    'Customer Satisfaction:',
    'Continuous Improvement:',
    'Regulatory Compliance:',
    'Cross-Functional Collaboration:',
    'Production Planning:',
    'Scheduling and Coordination:',
    'Inventory and Material Management:',
    'Process Optimization:',
    'Data Analysis and Reporting:',
    'Risk Management:',
    'Strategic Planning and Execution:',
    'Procurement Management:',
    'Inventory and Warehouse Management:',
    'Logistics and Distribution:',
    'Vendor Management:',
    'Process Improvement and Technology Adoption:',
    'Reporting and Analytics:',
  ].includes(normalized)
}

const extractSectionLines = (lines, heading) => {
  const startIndex = lines.findIndex((line) => normalizeText(line) === heading)
  if (startIndex === -1) return []

  const collected = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (isSectionHeading(lines[index])) break
    collected.push(lines[index])
  }
  return collected
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*CNC Machining Centers\s*-\s*Vertical\s*&amp;\s*Horizontal Machining Centres\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/bfwindia\.com\/["']/i.test(page)
    && /href=["']https:\/\/bfwindia\.com\/careers\/["']/i.test(page)
    && normalized.includes('Our mission is to contribute to the advancement of humanity through technology. But we can’t achieve that without you.')
    && normalized.includes('Visit career section')
}

const parseDepartmentAndLocation = (listHtml = '') => {
  const items = [...String(listHtml ?? '').matchAll(
    /<span class=["']elementor-icon-list-text["']>([\s\S]*?)<\/span>/gi,
  )]
    .map((match) => normalizeText(match[1]))
    .filter(Boolean)

  const department = normalizeText(items.find((item) => /^Department\s*:/i.test(item))?.replace(/^Department\s*:\s*/i, ''))
  const rawLocation = normalizeText(items.find((item) => /^Location\s*:/i.test(item))?.replace(/^Location\s*:\s*/i, ''))
  const city = normalizeText(rawLocation?.split(',')[0] ?? null)
  const location = rawLocation ? `${rawLocation}, India` : null

  return {
    department,
    location,
    city,
  }
}

export const extractVisibleListings = (html = '') => {
  const listings = [...String(html ?? '').matchAll(
    /<h5 class=["']elementor-heading-title elementor-size-default["']>([\s\S]*?)<\/h5>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?More details[\s\S]*?<\/a>[\s\S]*?<ul class=["']elementor-icon-list-items elementor-inline-items["']>([\s\S]*?)<\/ul>/gi,
  )]
    .map((match) => {
      const title = normalizeText(match[1])
      const sourceUrl = canonicalizeCareerUrl(match[2])
      const { department, location, city } = parseDepartmentAndLocation(match[3])

      if (!title || !sourceUrl || !department || !location) return null

      return {
        title,
        department,
        location,
        city,
        sourceUrl,
      }
    })
    .filter(Boolean)

  const deduped = []
  const seen = new Set()
  for (const listing of listings) {
    const key = listing.sourceUrl
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(listing)
  }

  return deduped
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers\s*-\s*BFW\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/bfwindia\.com\/careers\/["']/i.test(page)
    && normalized.includes("Notice to Applicants: BFW's Commitment to a No Recruitment Fees Policy")
    && normalized.includes('Positions open')
    && extractVisibleListings(page).length > 0
  }

export const hasOfficialDetailPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*[^<]+-\s*Bharat Fritz Werner \(BFW\) India\s*<\/title>/i.test(page)
    && normalized.includes('Apply for this position')
    && /<form\b[^>]*class=["'][^"']*elementor-form[^"']*["'][^>]*>/i.test(page)
    && /type=["']file["']/i.test(page)
    && /Apply now/i.test(page)
  }

export const isMissingNoPublicJobRoute = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page.status) === 404
    && NO_PUBLIC_JOB_ROUTE_URLS.includes(String(page.url ?? ''))
    && /<title>\s*Page not found\s*-\s*BFW\s*<\/title>/i.test(html)
    && normalized.includes('Page not found')
    && /href=["']https:\/\/bfwindia\.com\/careers\/["']/i.test(html)
  }

const extractDetailContentHtml = (html = '') => {
  const mainHtml = extractMatch(html, /<main[^>]*>([\s\S]*?)<\/main>/i) ?? String(html ?? '')
  const beforeApply = mainHtml.split(/<section[^>]+id=["']apply["'][^>]*>/i)[0]
  const beforeContact = beforeApply.split(/<h3[^>]*>\s*Didn['’]t you find your position\?\s*<\/h3>/i)[0]
  return beforeContact
}

const buildJobDescription = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) return null

  return lines.map((line, index) => {
    if (index < 2) return line
    if (isSectionHeading(line)) return line
    return `- ${line}`
  }).join('\n')
}

export const extractJobDetail = (html, listing) => {
  if (!hasOfficialDetailPageSignal(html)) {
    throw new Error('Bharat Fritz Werner detail page no longer matches the verified first-party surface')
  }

  const contentHtml = extractDetailContentHtml(html)
  const lines = stripTagsToLines(contentHtml)
  const title = normalizeText(
    extractMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      || lines[0]
      || listing?.title,
  )
  const slug = decodeURIComponent(new URL(listing.sourceUrl).pathname.split('/').filter(Boolean).at(-1) ?? '')
  const educationLines = extractSectionLines(lines, 'Education:')
  const experienceLines = extractSectionLines(lines, 'Experience:')
  const skillLines = extractSectionLines(lines, 'Key skill required:')

  return {
    title,
    company: COMPANY,
    department: listing.department,
    location: listing.location,
    city: listing.city,
    country: 'India',
    jobId: `${SOURCE}-${slugify(slug)}`,
    requisitionId: `${SOURCE}-${slugify(slug)}`,
    sourceUrl: listing.sourceUrl,
    applyUrl: `${listing.sourceUrl}#apply`,
    employmentType: null,
    experienceRequired: experienceLines.length > 0 ? experienceLines.join(' | ') : null,
    minimumQualification: educationLines.length > 0 ? educationLines.join(' | ') : null,
    preferredQualification: null,
    requiredSkills: skillLines,
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(lines),
  }
}

export const createBharatFritzWernerScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Bharat Fritz Werner verified homepage no longer matches the trusted first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('Bharat Fritz Werner verified careers page no longer matches the trusted first-party surface')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isMissingNoPublicJobRoute(routePage)) {
        throw new Error(`Bharat Fritz Werner no-public job route changed materially or now exposes jobs: ${routeUrl}`)
      }
    }

    const listings = extractVisibleListings(careersPage.html)
    if (listings.length === 0) {
      throw new Error('Bharat Fritz Werner careers page no longer exposes verified visible openings')
    }

    const jobs = (await Promise.all(listings.map(async (listing) => {
      const detailPage = await fetchPage(listing.sourceUrl)
      return extractJobDetail(detailPage.html, listing)
    })))
      .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
      .map((job) => ({
        ...job,
        source: SOURCE,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: ATS_PLATFORM,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: (overrideNow || now)(),
      }))

    if (jobs.length === 0) {
      throw new Error('Bharat Fritz Werner first-party careers surface no longer yields normalized jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createBharatFritzWernerScraper().run(options)

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
