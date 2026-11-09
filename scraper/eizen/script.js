import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'eizen'
export const COMPANY = 'eizen'
export const HOMEPAGE_URL = 'https://eizen.ai/'
export const CAREERS_URL = 'https://eizen.ai/careers.html'
export const MISSING_ROUTE_URLS = [
  'https://eizen.ai/career',
  'https://eizen.ai/careers',
  'https://eizen.ai/jobs',
  'https://eizen.ai/join-us',
  'https://eizen.ai/current-openings',
  'https://eizen.ai/openings',
]

export const EXPECTED_OPENINGS = {
  'Machine Learning Engineer': {
    city: 'Bengaluru',
    applyUrl: 'https://optimhire.com/company/eizen/job/162016',
    requisitionId: '162016',
  },
  'Full Stack Engineer': {
    city: 'Hyderabad',
    applyUrl: 'https://www.linkedin.com/jobs/view/3572547388/',
    requisitionId: '3572547388',
  },
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')
  .replace(/&copy;/gi, '©')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => String(value ?? '')
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

const canonicalizeApplyUrl = (href) => {
  const url = new URL(href, CAREERS_URL)
  url.hash = ''

  if (/linkedin\.com$/i.test(url.hostname)) {
    url.search = ''
  }

  return url.toString()
}

const extractRequisitionId = (applyUrl) => {
  const normalizedUrl = String(applyUrl ?? '')

  const optimhireMatch = normalizedUrl.match(/\/job\/(\d+)\/?$/i)
  if (optimhireMatch) {
    return optimhireMatch[1]
  }

  const linkedInMatch = normalizedUrl.match(/\/jobs\/view\/(\d+)\/?$/i)
  if (linkedInMatch) {
    return linkedInMatch[1]
  }

  return null
}

export const hasVerifiedCareersLink = (html) =>
  /href=["']careers\.html["']/i.test(String(html ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*Eizen AI\s*<\/title>/i.test(page)
    && /property=["']og:url["'][^>]+content=["']https:\/\/eizen\.ai["']/i.test(page)
    && /property=["']og:site_name["'][^>]+content=["']Eizen AI["']/i.test(page)
    && /"@type"\s*:\s*"Organization"/i.test(page)
    && /"name"\s*:\s*"Eizen AI"/i.test(page)
    && text.includes('see + do = action intelligence')
    && text.includes('action intelligence at scale - powered by agentic ai workflows')
    && text.includes('copyright')
    && text.includes('2025 eizen - all rights reserved')
    && hasVerifiedCareersLink(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*Eizen AI\s*<\/title>/i.test(page)
    && text.includes('welcome to eizen careers!')
    && text.includes("join our dynamic and inclusive team, where creativity and curiosity are encouraged.")
    && text.includes("we're committed to investing in your professional development and well-being.")
    && text.includes('current openings :')
    && /mailto:madhu@eigenmaps\.ai\?/i.test(page)
    && text.includes('copyright')
    && text.includes('2025 eizen - all rights reserved')
    && hasVerifiedCareersLink(page)
}

export const isVerifiedMissingRoute = ({ status, html, url }) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()
  const routeKey = url ? new URL(url).pathname.replace(/^\/+/, '') : null

  return status === 404
    && /<title>\s*404 Not Found\s*<\/title>/i.test(page)
    && text.includes('404 not found')
    && text.includes('code: nosuchkey')
    && text.includes('message: the specified key does not exist.')
    && (!routeKey || text.includes(`key: ${routeKey.toLowerCase()}`))
}

const extractOpeningCards = (html) => [
  ...String(html ?? '').matchAll(
    /<h5>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*([\s\S]*?)\s*<\/a\s*>\s*<\/h5>\s*<p\b[^>]*>\s*Location:\s*([^<]+?)\s*<\/p>/gi,
  ),
].map((match) => ({
  applyUrl: canonicalizeApplyUrl(match[1]),
  title: normalizeWhitespace(match[2]),
  city: normalizeWhitespace(match[3]),
}))

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('eizen careers page no longer matches the verified official public surface')
  }

  const openings = extractOpeningCards(html)
  const expectedTitles = Object.keys(EXPECTED_OPENINGS)

  if (openings.length !== expectedTitles.length) {
    throw new Error('eizen public openings changed materially')
  }

  const seenTitles = new Set()

  const jobs = openings.map((opening) => {
    if (!opening.title || !opening.city || !opening.applyUrl) {
      throw new Error('eizen public openings changed materially')
    }

    const expectedOpening = EXPECTED_OPENINGS[opening.title]
    if (!expectedOpening) {
      throw new Error(`eizen unexpected public opening "${opening.title}"`)
    }

    if (seenTitles.has(opening.title)) {
      throw new Error(`eizen duplicated public opening "${opening.title}"`)
    }
    seenTitles.add(opening.title)

    if (opening.city !== expectedOpening.city) {
      throw new Error(`eizen location drifted for "${opening.title}"`)
    }

    if (opening.applyUrl !== expectedOpening.applyUrl) {
      throw new Error(`eizen apply link drifted for "${opening.title}"`)
    }

    const requisitionId = extractRequisitionId(opening.applyUrl)
    if (!requisitionId || requisitionId !== expectedOpening.requisitionId) {
      throw new Error(`eizen requisition id drifted for "${opening.title}"`)
    }

    return {
      title: opening.title,
      company: COMPANY,
      department: null,
      location: `${opening.city}, India`,
      city: opening.city,
      country: 'India',
      jobId: `${SOURCE}-${requisitionId}`,
      requisitionId,
      sourceUrl: CAREERS_URL,
      applyUrl: opening.applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })

  for (const expectedTitle of expectedTitles) {
    if (!seenTitles.has(expectedTitle)) {
      throw new Error(`eizen missing verified opening "${expectedTitle}"`)
    }
  }

  return jobs
}

export const createEizenScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('eizen official homepage no longer matches the verified public surface')
    }

    if (!hasVerifiedCareersLink(homepage.html)) {
      throw new Error('eizen homepage no longer links to the verified careers page')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('eizen careers page no longer matches the verified official public surface')
    }

    for (const missingRouteUrl of MISSING_ROUTE_URLS) {
      const missingRoute = await fetchPage(missingRouteUrl)

      if (!isVerifiedMissingRoute(missingRoute)) {
        throw new Error('eizen missing jobs routes changed materially')
      }
    }

    const jobs = extractPublicJobs(careersPage.html)
    const scrapedAt = (overrideNow || now)()

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt,
      companyCareerPage: CAREERS_URL,
      companyDomain: 'eizen.ai',
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createEizenScraper().run(options)

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
