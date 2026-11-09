import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sipaltechnologiesindiaprivatelimited'
export const COMPANY = 'SIPAL Technologies India Private Limited'
export const COMPANY_DOMAIN = 'sipal.it'
export const ATS_PLATFORM = 'official-company-careers'
export const HOMEPAGE_URL = 'https://sipal.it/'
export const CAREERS_URL = 'https://sipal.it/en/careers/'
export const FALLBACK_CAREERS_URLS = [
  'https://sipal.it/lavora-con-noi/',
  'https://sipal.it/careers/',
]
export const LEGACY_ROUTE_URLS = [
  'https://sipal.it/sipal-india-en/',
  'https://sipal.it/sipal-india/',
  'https://sipal.it/jobs/',
  'https://sipal.it/candidature/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const LOCATION_BY_SLUG = {
  bangalore: { city: 'Bangalore', country: 'India', location: 'Bangalore, India' },
  bologna: { city: 'Bologna', country: 'Italy', location: 'Bologna, Italy' },
  'bassano-del-grappa': { city: 'Bassano del Grappa', country: 'Italy', location: 'Bassano del Grappa, Italy' },
  grottaglie: { city: 'Grottaglie', country: 'Italy', location: 'Grottaglie, Italy' },
  naples: { city: 'Naples', country: 'Italy', location: 'Naples, Italy' },
  oradea: { city: 'Oradea', country: 'Romania', location: 'Oradea, Romania' },
  rome: { city: 'Rome', country: 'Italy', location: 'Rome, Italy' },
  turin: { city: 'Turin', country: 'Italy', location: 'Turin, Italy' },
  washington: { city: 'Washington', country: 'USA', location: 'Washington, USA' },
}

const ENTITY_REPLACEMENTS = new Map([
  ['&nbsp;', ' '],
  ['&amp;', '&'],
  ['&quot;', '"'],
  ['&#34;', '"'],
  ['&#39;', "'"],
  ['&apos;', "'"],
  ['&#8211;', '-'],
  ['&#8212;', '-'],
  ['&ndash;', '-'],
  ['&mdash;', '-'],
  ['&#8216;', "'"],
  ['&#8217;', "'"],
  ['&lsquo;', "'"],
  ['&rsquo;', "'"],
  ['&#8220;', '"'],
  ['&#8221;', '"'],
  ['&ldquo;', '"'],
  ['&rdquo;', '"'],
])

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
  .replace(/&[a-z0-9#]+;/gi, (entity) => ENTITY_REPLACEMENTS.get(entity) ?? entity)

const stripHtml = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/li>/gi, '\n')
  .replace(/<li[^>]*>/gi, '- ')
  .replace(/<\/p>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => stripHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/[ \t\f\v]+/g, ' ')
  .replace(/ *\n */g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/\s+\n/g, '\n')
  .replace(/\n\s+/g, '\n')
  .trim()

const normalizeInlineText = (value) => normalizeWhitespace(value).replace(/\s*\n\s*/g, ' ').trim()

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
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const getAbsoluteUrl = (value, pageUrl) => {
  try {
    return new URL(String(value ?? '').trim(), pageUrl || CAREERS_URL).toString()
  } catch {
    return null
  }
}

const dedupe = (values = []) => [...new Set(values.filter(Boolean))]

const slugifyLocation = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const extractLocationSlugs = (value) => dedupe(
  [...String(value ?? '').matchAll(/(?:^|\s)category-([a-z0-9-]+)/gi)]
    .map((match) => slugifyLocation(match[1]))
    .filter((slug) => Object.prototype.hasOwnProperty.call(LOCATION_BY_SLUG, slug)),
)

const buildLocationFields = (slugs = []) => {
  const records = slugs
    .map((slug) => LOCATION_BY_SLUG[slug] || null)
    .filter(Boolean)

  const locations = dedupe(records.map((record) => record.location))
  const cities = dedupe(records.map((record) => record.city))
  const countries = dedupe(records.map((record) => record.country))

  return {
    locations,
    city: cities.length === 1 ? cities[0] : null,
    country: countries.length === 1 ? countries[0] : null,
    location: locations.length > 0 ? locations.join(' | ') : null,
  }
}

const extractArticleCards = (html = '') => [
  ...String(html ?? '').matchAll(/<article\b[\s\S]*?<\/article>/gi),
].map((match) => match[0]).filter((article) => /\bjob_offer\b/i.test(article))

const extractTitle = (articleHtml = '') => normalizeInlineText(
  articleHtml.match(/<h3[^>]*class="elementor-post__title"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
    || articleHtml.match(/<a[^>]*href="[^"]*job_offer[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1]
    || '',
)

const extractJobUrl = (articleHtml = '', pageUrl) => getAbsoluteUrl(
  articleHtml.match(/<h3[^>]*class="elementor-post__title"[^>]*>[\s\S]*?<a href="([^"]+)"/i)?.[1]
    || articleHtml.match(/<a[^>]*href="([^"]*job_offer[^"]*)"/i)?.[1]
    || '',
  pageUrl,
)

const extractExcerpt = (articleHtml = '') => normalizeWhitespace(
  articleHtml.match(/<div[^>]*class="elementor-post__excerpt"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '',
)

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeInlineText(page)

  return /<title[^>]*>\s*Sipal\s*<\/title>/i.test(page)
    && normalized.includes('We protect what truly matters')
    && normalized.includes('SIPAL integra engineering, manufacturing avanzato e tecnologie proprietarie')
    && normalized.includes('Il nostro network globale')
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeInlineText(page)

  return /<title[^>]*>\s*(?:Careers|Lavora con noi)\s*(?:&#8211;|-)\s*Sipal/i.test(page)
    && (
      normalized.includes('Available job opportunities')
      || normalized.includes('Offerte lavorative disponibili')
      || /\bjob_offer\b/i.test(page)
    )
}

export const pageShowsPublicJobs = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeInlineText(page)

  return /\bjob_offer\b/i.test(page)
    || /\/(?:en\/)?job_offer\//i.test(page)
    || normalized.includes('Available job opportunities')
    || normalized.includes('Offerte lavorative disponibili')
    || normalized.includes('Go to the job posting')
    || normalized.includes("Vai all'annuncio")
    || normalized.includes('There are currently no open positions')
    || normalized.includes('Al momento non ci sono posizioni aperte')
}

export const extractJobsFromCareersHtml = async (html = '', {
  pageUrl = CAREERS_URL,
  fetchPage = defaultFetchPage,
} = {}) => {
  const jobsByUrl = new Map()

  for (const articleHtml of extractArticleCards(html)) {
    const title = extractTitle(articleHtml)
    const jobUrl = extractJobUrl(articleHtml, pageUrl)
    if (!title || !jobUrl) {
      continue
    }

    const existing = jobsByUrl.get(jobUrl)
    const nextLocationSlugs = dedupe([
      ...(existing?.locationSlugs || []),
      ...extractLocationSlugs(articleHtml),
    ])
    const excerpt = extractExcerpt(articleHtml)

    jobsByUrl.set(jobUrl, {
      title,
      sourceUrl: jobUrl,
      applyUrl: jobUrl,
      excerpt: excerpt || existing?.excerpt || null,
      locationSlugs: nextLocationSlugs,
    })
  }

  const jobs = []

  for (const job of jobsByUrl.values()) {
    let locationSlugs = [...job.locationSlugs]
    if (locationSlugs.length === 0) {
      const detailPage = await fetchPage(job.sourceUrl)
      locationSlugs = extractLocationSlugs(detailPage.html)
    }

    const locationFields = buildLocationFields(locationSlugs)
    jobs.push({
      title: job.title,
      company: COMPANY,
      source: SOURCE,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: ATS_PLATFORM,
      location: locationFields.location,
      locations: locationFields.locations,
      city: locationFields.city,
      country: locationFields.country,
      jobDescription: job.excerpt,
    })
  }

  return jobs
}

const getVerifiedCareersPage = async (fetchPage) => {
  const candidateUrls = [CAREERS_URL, ...FALLBACK_CAREERS_URLS]

  for (const candidateUrl of candidateUrls) {
    const page = await fetchPage(candidateUrl)
    if (page.status === 200 && hasOfficialCareersPageSignal(page.html)) {
      return page
    }
  }

  return null
}

export const createSipalTechnologiesIndiaPrivateLimitedScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('SIPAL official homepage no longer matches the verified first-party surface')
    }

    const careersPage = await getVerifiedCareersPage(fetchPage)
    if (!careersPage || !pageShowsPublicJobs(careersPage.html)) {
      throw new Error('SIPAL official careers page no longer matches the verified public jobs surface')
    }

    return extractJobsFromCareersHtml(careersPage.html, {
      pageUrl: careersPage.url || CAREERS_URL,
      fetchPage,
    })
  },
})

export const run = async (options = {}) => createSipalTechnologiesIndiaPrivateLimitedScraper().run(options)

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
