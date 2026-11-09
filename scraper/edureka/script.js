import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { EDUREKA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = EDUREKA_CATALOG.source
export const COMPANY = EDUREKA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = EDUREKA_CATALOG.officialBrandName
export const VERIFIED_ON = EDUREKA_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = EDUREKA_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = EDUREKA_CATALOG
export const ROOT_URL = EDUREKA_CATALOG.rootUrl
export const CAREERS_URL = EDUREKA_CATALOG.companyCareerPage
export const BROKEN_OPENINGS_ROUTE_URL = EDUREKA_CATALOG.brokenOpeningsRouteUrl
export const APPLICATION_EMAIL = EDUREKA_CATALOG.applicationEmail
export const VERIFIED_OPENINGS_COUNT = 5
export const SAMPLE_JOB_URL = EDUREKA_CATALOG.sampleJobUrl

const COMPANY_DOMAIN = EDUREKA_CATALOG.companyDomain
const ATS_PLATFORM = EDUREKA_CATALOG.atsPlatform
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTagsToText = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|ol|ul|h[1-6])>/gi, '\n')
  .replace(/<(p|div|li|ol|ul|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)
  .join('\n')

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, ROOT_URL).toString()
  } catch {
    return null
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
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

  return /<title>\s*Edureka\s*\|\s*Online Courses,\s*PGP\s*(?:&amp;|&)\s*Degree Programs for Upskilling\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.edureka\.co\/?["']/i.test(page)
    && /<a[^>]+href=["'](?:https:\/\/www\.edureka\.co)?\/careers\/?["'][^>]*>\s*(?:JOIN US|Careers)\s*<\/a>/i.test(page)
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const openings = extractOpeningLinks(page)

  return /<title>\s*Careers\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.edureka\.co\/careers["']/i.test(page)
    && /href=["']\/careers\/job_details["']/i.test(page)
    && /mailto:career@edureka\.co/i.test(page)
    && normalized.includes('OPEN POSITIONS')
    && openings.length >= VERIFIED_OPENINGS_COUNT
    && openings.some((opening) => opening.url === SAMPLE_JOB_URL)
}

export const hasBrokenOpeningsRouteSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Internal Server Error\s*<\/title>/i.test(page)
    && normalized.includes("Sorry, We're unable to serve your request.")
    && /href=["']https:\/\/www\.edureka\.co\/["']/i.test(page)
}

export const extractOpeningLinks = (html = '') => {
  const links = []

  for (const match of String(html ?? '').matchAll(
    /<a href=["'](\/openpositions\/\d+\/\d+)["'][^>]*>([^<]+)<\/a>/gi,
  )) {
    const url = toAbsoluteUrl(match[1])
    const title = normalizeWhitespace(match[2])

    if (!url || !title) continue
    links.push({ title, url })
  }

  return links
}

export const hasOfficialDetailSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*[^<]+,\s*Edureka\s*<\/title>/i.test(page)
    && /id=["']jobapplyform["']/i.test(page)
    && normalized.includes('SUBMIT APPLICATION')
    && /mailto:career@edureka\.co/i.test(page)
  }

const extractMetaDescription = (html = '') =>
  normalizeWhitespace(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(String(html ?? ''))?.[1],
  )

const extractLocation = (html = '') => {
  const description = extractMetaDescription(html)
  const cityMatch = description?.match(/\bin\s+([A-Za-z ]+?)(?:\.|,|You get|and )/i)
  const rawCity = normalizeWhitespace(cityMatch?.[1] ?? null)
  const city = normalizeCity(rawCity)

  if (!city) return { location: null, city: null, country: 'India' }

  return {
    location: `${city}, India`,
    city,
    country: 'India',
  }
}

const extractListItemsUnderHeading = (html = '', heading) => {
  const pattern = new RegExp(
    `<h4[^>]*>\\s*${heading}\\s*<\\/h4>\\s*<ul[^>]*>([\\s\\S]*?)<\\/ul>`,
    'i',
  )
  const section = pattern.exec(String(html ?? ''))?.[1] ?? ''

  return [...section.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => normalizeWhitespace(match[1]).replace(/^[•*-]\s*/, ''))
    .filter(Boolean)
}

const extractExperienceRequired = (html = '') => {
  const text = stripTagsToText(html)
  const monthsMatch = text.match(/\bminimum of (\d+)\s+months\b/i)
  if (monthsMatch) return `${monthsMatch[1]} months`

  const yearsMatch = text.match(/\b(\d+\s*-\s*\d+|\d+\+?)\s+years\b/i)
  if (yearsMatch) return `${normalizeWhitespace(yearsMatch[1])} years`

  return null
}

export const extractJobFromDetailPage = (html = '', { title, url, scrapedAt }) => {
  if (!hasOfficialDetailSignal(html)) {
    throw new Error('Edureka verified detail page no longer matches the trusted first-party surface')
  }

  const normalizedTitle = normalizeWhitespace(title)
  const descriptionLines = [normalizedTitle]
  const roleItems = extractListItemsUnderHeading(html, 'Roles and Responsibilities:')
  const requirementItems = extractListItemsUnderHeading(html, 'Requirements:')

  if (roleItems.length > 0) {
    descriptionLines.push('Roles and Responsibilities:')
    descriptionLines.push(...roleItems)
  }

  if (requirementItems.length > 0) {
    descriptionLines.push('Requirements:')
    descriptionLines.push(...requirementItems)
  }

  const { location, city, country } = extractLocation(html)
  const pathMatch = new URL(url).pathname.match(/\/openpositions\/(\d+)\/(\d+)/i)

  return {
    jobId: `${SOURCE}-${slugify(normalizedTitle)}`,
    requisitionId: pathMatch ? `${pathMatch[1]}-${pathMatch[2]}` : null,
    title: normalizedTitle,
    company: COMPANY,
    department: null,
    location,
    city,
    country,
    link: url,
    applyUrl: `${url}#jobapplyform`,
    sourceUrl: url,
    source: SOURCE,
    employmentType: null,
    experienceRequired: extractExperienceRequired(html),
    jobDescription: descriptionLines.join('\n'),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    scrapedAt,
  }
}

export const createEdurekaScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(ROOT_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Edureka verified homepage no longer matches the trusted first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Edureka verified careers page no longer matches the trusted first-party jobs surface')
    }

    const brokenHandoffPage = await fetchPage(BROKEN_OPENINGS_ROUTE_URL)
    if (brokenHandoffPage.status !== 200 || !hasBrokenOpeningsRouteSignal(brokenHandoffPage.html)) {
      throw new Error('Edureka broken job_details handoff changed materially from the verified first-party error shell')
    }

    const openings = extractOpeningLinks(careersPage.html)
    if (openings.length === 0) {
      throw new Error('Edureka verified careers page no longer exposes inline first-party opening links')
    }

    const jobs = []
    const limit = Number.isFinite(maxJobs) ? maxJobs : openings.length

    for (const opening of openings.slice(0, limit)) {
      const detailPage = await fetchPage(opening.url)
      if (detailPage.status !== 200) {
        throw new Error(`Edureka detail page failed to load: ${opening.url}`)
      }

      const job = extractJobFromDetailPage(detailPage.html, {
        title: opening.title,
        url: opening.url,
        scrapedAt: now(),
      })

      jobs.push({
        ...job,
        companyCareerPage: CAREERS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: ATS_PLATFORM,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createEdurekaScraper(options).run(options)

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
