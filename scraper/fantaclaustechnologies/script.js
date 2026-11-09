import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'fantaclaustechnologies'
export const COMPANY = 'Fantaclaus Technologies'
export const LEGAL_HOME_URL = 'https://fantaclaus.com/'
export const HOMEPAGE_URL = 'https://inteligenai.com/'
export const SITEMAP_URL = 'https://inteligenai.com/page-sitemap.xml'
export const CAREERS_ALIAS_URLS = [
  'https://inteligenai.com/career',
  'https://inteligenai.com/careers',
]
export const CAREERS_URL = 'https://inteligenai.com/careers/'
export const MISSING_ROUTE_URLS = [
  'https://inteligenai.com/jobs',
  'https://inteligenai.com/join-us',
  'https://inteligenai.com/current-openings',
  'https://inteligenai.com/openings',
]

export const EXPECTED_OPENINGS = {
  'AI Development Engineer': {
    applyUrl: 'https://forms.gle/DUeAiQoUSxfhQAbf6',
    city: 'Gurugram',
    employmentType: 'Full-Time',
    experienceRequired: null,
    descriptionSnippets: ['smart, curious freshers', '8-12 LPA (Fixed)'],
  },
  'Campus Recruitment Drive 2027': {
    applyUrl: 'https://forms.gle/urWAQBkX49cXbiYu9',
    city: null,
    employmentType: null,
    experienceRequired: null,
    descriptionSnippets: ['4th Campus Recruitment Drive', 'placement cells'],
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
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => String(value ?? '')
  .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeVisibleText = (value) => normalizeWhitespace(stripTags(value)) || ''

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

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

const extractFirstMatch = (value, pattern) => {
  const match = String(value ?? '').match(pattern)
  return match?.[1] ?? null
}

export const hasLegalRedirectSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*Redirecting\s*<\/title>/i.test(page)
    && /http-equiv=["']refresh["'][^>]+content=["']0;\s*url=https:\/\/www\.inteligenai\.com["']/i.test(page)
    && /<a[^>]+href=["']https:\/\/www\.inteligenai\.com["']/i.test(page)
    && text.includes('redirecting')
  }

export const hasVerifiedCareersLink = (html) =>
  /href=["']https:\/\/inteligenai\.com\/careers\/["']/i.test(String(html ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*Custom AI Development for Enterprise \| InteligenAI\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/inteligenai\.com\/["']/i.test(page)
    && text.includes('enterprise-grade custom ai solutions')
    && text.includes('trusted by startups and enterprises')
    && text.includes('sukrit goel')
    && text.includes('swati jain goel')
    && text.includes('contact@inteligenai.com')
    && text.includes('fantaclaus technologies pvt. ltd.')
    && hasVerifiedCareersLink(page)
}

export const hasOfficialSitemapSignal = (xml) => {
  const sitemap = String(xml ?? '')

  return /<loc>https:\/\/inteligenai\.com\/about\/<\/loc>/i.test(sitemap)
    && /<loc>https:\/\/inteligenai\.com\/contact\/<\/loc>/i.test(sitemap)
    && /<loc>https:\/\/inteligenai\.com\/careers\/<\/loc>/i.test(sitemap)
    && /<loc>https:\/\/inteligenai\.com\/tools\/<\/loc>/i.test(sitemap)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*Careers - inteligenai\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/inteligenai\.com\/careers\/["']/i.test(page)
    && text.includes('know more about inteligenai')
    && text.includes('explore our current openings')
    && text.includes('partner with us')
    && text.includes('hr@inteligenai.com')
    && text.includes('fantaclaus technologies pvt. ltd.')
    && text.includes('ai development engineer')
    && text.includes('campus recruitment drive 2027')
}

export const hasVerifiedCareersAlias = ({ status, url, html }) =>
  status === 200
  && String(url ?? '').replace(/\/+$/, '/') === CAREERS_URL
  && hasOfficialCareersSignal(html)

export const isVerifiedMissingRoute = ({ status, html }) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return status === 404
    && /<title>\s*Page not found - inteligenai\s*<\/title>/i.test(page)
    && /meta[^>]+name=["']robots["'][^>]+noindex/i.test(page)
    && text.includes('page not found')
    && !text.includes('apply here')
  }

const parseMeta = (metaText) => {
  const parts = String(metaText ?? '')
    .split('|')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  if (parts.length === 0) {
    return {
      city: null,
      employmentType: null,
      experienceRequired: null,
    }
  }

  if (parts.length === 2) {
    return {
      city: parts[0],
      employmentType: parts[1],
      experienceRequired: null,
    }
  }

  return {
    city: parts[0],
    experienceRequired: parts[1],
    employmentType: parts.at(-1) ?? null,
  }
}

const getRoleSections = (html) => {
  const page = String(html ?? '')
  const headingMatches = [...page.matchAll(/<h3\b[^>]*>\s*([\s\S]*?)\s*<\/h3>/gi)]

  return headingMatches
    .map((match, index) => {
      const title = normalizeWhitespace(stripTags(match[1]))
      const start = match.index ?? 0
      const end = headingMatches[index + 1]?.index ?? page.length
      const chunk = page.slice(start, end)

      if (!title || !/elementor-button-text/i.test(chunk)) {
        return null
      }

      const status = normalizeWhitespace(
        extractFirstMatch(chunk, /<span\b[^>]*class=["'][^"']*elementor-button-text[^"']*["'][^>]*>\s*([\s\S]*?)\s*<\/span>/i),
      )
      const applyUrl = normalizeWhitespace(extractFirstMatch(chunk, /href=["'](https:\/\/forms\.gle\/[^"']+)["']/i))
      const meta = normalizeWhitespace(extractFirstMatch(chunk, /<h5>\s*<strong>([\s\S]*?)<\/strong>\s*<\/h5>/i))
      const descriptionHtml = chunk
        .replace(/^[\s\S]*?<\/h3>/i, '')
        .split(/<div\b[^>]*class=["'][^"']*elementor-button-wrapper[^"']*["'][^>]*>/i)[0]
      const jobDescription = normalizeVisibleText(descriptionHtml) || null

      return {
        title,
        status,
        applyUrl,
        meta,
        jobDescription,
      }
    })
    .filter(Boolean)
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Fantaclaus Technologies careers page no longer matches the verified official public surface')
  }

  const sections = getRoleSections(html)
  const activeSections = sections.filter((section) => section.status?.toLowerCase() === 'apply here')
  const expectedTitles = Object.keys(EXPECTED_OPENINGS)

  if (activeSections.length !== expectedTitles.length) {
    throw new Error('Fantaclaus Technologies public openings changed materially')
  }

  const seenTitles = new Set()

  const jobs = activeSections.map((section) => {
    const expectedOpening = EXPECTED_OPENINGS[section.title]

    if (!expectedOpening) {
      throw new Error(`Fantaclaus Technologies unexpected public opening "${section.title}"`)
    }

    if (seenTitles.has(section.title)) {
      throw new Error(`Fantaclaus Technologies duplicated public opening "${section.title}"`)
    }
    seenTitles.add(section.title)

    if (section.applyUrl !== expectedOpening.applyUrl) {
      throw new Error(`Fantaclaus Technologies apply link drifted for "${section.title}"`)
    }

    const parsedMeta = parseMeta(section.meta)
    if (parsedMeta.city !== expectedOpening.city) {
      throw new Error(`Fantaclaus Technologies location drifted for "${section.title}"`)
    }

    if (parsedMeta.employmentType !== expectedOpening.employmentType) {
      throw new Error(`Fantaclaus Technologies employment type drifted for "${section.title}"`)
    }

    if (parsedMeta.experienceRequired !== expectedOpening.experienceRequired) {
      throw new Error(`Fantaclaus Technologies experience drifted for "${section.title}"`)
    }

    if (!section.jobDescription) {
      throw new Error(`Fantaclaus Technologies job description missing for "${section.title}"`)
    }

    for (const snippet of expectedOpening.descriptionSnippets) {
      if (!section.jobDescription.includes(snippet)) {
        throw new Error(`Fantaclaus Technologies job description drifted for "${section.title}"`)
      }
    }

    const jobId = `${SOURCE}-${slugify(section.title)}`
    if (!jobId) {
      throw new Error(`Fantaclaus Technologies role could not be normalized: "${section.title}"`)
    }

    return {
      title: section.title,
      company: COMPANY,
      department: null,
      location: parsedMeta.city ? `${parsedMeta.city}, India` : 'India',
      city: parsedMeta.city,
      country: 'India',
      jobId,
      requisitionId: null,
      sourceUrl: CAREERS_URL,
      applyUrl: section.applyUrl,
      employmentType: parsedMeta.employmentType,
      experienceRequired: parsedMeta.experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: section.jobDescription,
    }
  })

  for (const expectedTitle of expectedTitles) {
    if (!seenTitles.has(expectedTitle)) {
      throw new Error(`Fantaclaus Technologies missing verified opening "${expectedTitle}"`)
    }
  }

  return jobs
}

export const createFantaclausTechnologiesScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow } = {}) {
    const legalRedirect = await fetchPage(LEGAL_HOME_URL)
    if (legalRedirect.status !== 200 || !hasLegalRedirectSignal(legalRedirect.html)) {
      throw new Error('Fantaclaus Technologies legal redirect no longer matches the verified first-party surface')
    }

    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Fantaclaus Technologies branded homepage no longer matches the verified first-party surface')
    }

    if (!hasVerifiedCareersLink(homepage.html)) {
      throw new Error('Fantaclaus Technologies homepage no longer links to the verified careers route')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !hasOfficialSitemapSignal(sitemap.html)) {
      throw new Error('Fantaclaus Technologies sitemap no longer advertises the verified careers surface')
    }

    for (const careersAliasUrl of CAREERS_ALIAS_URLS) {
      const careersAlias = await fetchPage(careersAliasUrl)
      if (!hasVerifiedCareersAlias(careersAlias)) {
        throw new Error('Fantaclaus Technologies careers alias no longer resolves to the verified careers page')
      }
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Fantaclaus Technologies careers page no longer matches the verified official public surface')
    }

    for (const missingRouteUrl of MISSING_ROUTE_URLS) {
      const missingRoute = await fetchPage(missingRouteUrl)

      if (!isVerifiedMissingRoute(missingRoute)) {
        throw new Error(`Fantaclaus Technologies missing-route validation failed for ${missingRouteUrl}`)
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
      companyDomain: 'inteligenai.com',
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createFantaclausTechnologiesScraper().run(options)

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
