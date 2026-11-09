import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DIGIVERSAL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = DIGIVERSAL_CATALOG.source
export const COMPANY = DIGIVERSAL_CATALOG.companyName
export const ROOT_URL = DIGIVERSAL_CATALOG.rootUrl
export const HOMEPAGE_URL = DIGIVERSAL_CATALOG.homepageUrl
export const CAREERS_URL = DIGIVERSAL_CATALOG.companyCareerPage
export const VERIFIED_AT = DIGIVERSAL_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = DIGIVERSAL_CATALOG.verifiedSurfaceSummary
export const MISSING_JOB_ROUTE_URLS = [
  'https://www.digiversal.co/career',
  'https://www.digiversal.co/jobs',
  'https://www.digiversal.co/join-us',
  'https://www.digiversal.co/openings',
  'https://www.digiversal.co/current-openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bapply now\b/i,
  /\bjobs\.lever\.co\b/i,
  /\bboards\.greenhouse\.io\b/i,
  /\bmyworkdayjobs\b/i,
  /\bsmartrecruiters\b/i,
  /\bdarwinbox\b/i,
]

const MONTHS = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#x27;|&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&ldquo;|&rdquo;/gi, '"')
  .replace(/&ndash;|&#8211;/gi, '–')
  .replace(/&mdash;|&#8212;/gi, '—')
  .replace(/&copy;/gi, '©')
  .replace(/\u00a0/g, ' ')

const stripHtml = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<\/p>/gi, ' ')
  .replace(/<\/div>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const extractHtmlTitle = (html = '') =>
  decodeHtmlEntities(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/\s+/g, ' ')
    .trim()
const normalizeComparableTitle = (value) => decodeHtmlEntities(String(value ?? ''))
  .toLowerCase()
  .replace(/\bdigiversal\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
const hasComparableTitleCoverage = (actualTitle, expectedTitle) => {
  const actualTokens = new Set(
    normalizeComparableTitle(actualTitle)
      .split(' ')
      .filter(Boolean),
  )
  const expectedTokens = normalizeComparableTitle(expectedTitle)
    .split(' ')
    .filter((token) => token.length >= 3)

  return expectedTokens.length > 0 && expectedTokens.every((token) => actualTokens.has(token))
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

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Digiversal \| Business Growth & Innovation Services for Enterprises\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Digiversal empowers enterprises with cutting-edge business growth strategies, innovation-driven solutions, and expert consulting\.[^"']*["']/i.test(rawHtml)
    && /href=["']https:\/\/www\.digiversal\.co\/careers\/?["']/i.test(rawHtml)
}

export const extractCareerCards = (html) => {
  const rawHtml = String(html ?? '')
  const cards = []
  const pattern = /<div class="subCareer">[\s\S]*?<a href="([^"]+)">([^<]+)<br ?\/?>\s*<span><i class="far fa-calendar-alt"><\/i>\s*([^<]+)<\/span>\s*<span><i class="fas fa-map-marker-alt"><\/i>\s*([^<]+)<\/span>[\s\S]*?<a href="[^"]+" class="cta">View More<\/a>/gi

  for (const match of rawHtml.matchAll(pattern)) {
    const slug = match[1].trim().replace(/^\/+|\/+$/g, '')
    cards.push({
      slug,
      title: decodeHtmlEntities(match[2]).trim(),
      postingLabel: decodeHtmlEntities(match[3]).trim(),
      locationLabel: decodeHtmlEntities(match[4]).trim(),
      detailUrl: new URL(slug, CAREERS_URL).href,
    })
  }

  return cards
}

export const hasOfficialCareersSurface = (html) => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Careers at Digiversal - Join Our Team & Build Your Future\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Explore career opportunities at Digiversal\.[^"']*["']/i.test(rawHtml)
    && /career@digiversal\.co/i.test(rawHtml)
    && extractCareerCards(rawHtml).length > 0
}

export const hasPublicJobSignal = (html) =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isMissingJobRoute = (page = {}, requestedUrl) =>
  Number(page.status) === 404
  && getFinalUrl(page, requestedUrl) === requestedUrl
  && !hasPublicJobSignal(page.html)

export const hasJobDetailSignal = (html, expectedTitle) => {
  const rawHtml = String(html ?? '')
  const searchableTitleText = `${extractHtmlTitle(rawHtml)} ${stripHtml(rawHtml)}`

  return hasComparableTitleCoverage(searchableTitleText, expectedTitle)
    && /Apply Now/i.test(rawHtml)
    && /(Experience:|Project Location\(s\):|Responsibilities)/i.test(rawHtml)
}

export const extractJobDetail = (html, title) => {
  const text = stripHtml(html)
  const escapedTitle = escapeRegExp(title)
  const descriptionMatch = text.match(
    new RegExp(
      `Careers\\s+${escapedTitle}\\s+([\\s\\S]*?)(?:\\s+Department:|\\s+Project Location\\(s\\):|\\s+Education:|\\s+Experience:|\\s+Apply Now|$)`,
      'i',
    ),
  )
  const experienceMatch = text.match(
    /Experience:\s*(?:[•*-]\s*)?([0-9]+\s*(?:months?|years?)(?:\s*(?:to|-)\s*[0-9]+\s*years?)?|[0-9]+\s*-\s*[0-9]+\s*years?)/i,
  )
    || text.match(/([0-9]+\s*-\s*[0-9]+\s*years?)\s+of experience/i)
  const educationMatch = text.match(/Education:\s*(.+?)(?:\s+Experience:|$)/i)
  const departmentMatch = text.match(/Department:\s*(.+?)(?:\s+Project Location\(s\):|$)/i)

  return {
    jobDescription: descriptionMatch?.[1]?.trim() || null,
    experienceRequired: experienceMatch?.[1]?.trim() || null,
    minimumQualification: educationMatch?.[1]?.trim() || null,
    department: departmentMatch?.[1]?.trim() || null,
  }
}

export const parsePostingDate = (label) => {
  const match = String(label ?? '').trim().match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (!match) return null

  const month = MONTHS[match[1].toLowerCase()]
  if (!month) return null

  return `${match[2]}-${month}-01`
}

const normalizeLocation = (label) => {
  const cleanLabel = decodeHtmlEntities(label).trim()
  return {
    location: `${cleanLabel}, India`,
    city: /\bnoida\b/i.test(cleanLabel) ? 'Noida' : null,
    country: 'India',
  }
}

export const createDigiVersalScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(ROOT_URL)
    if (getFinalUrl(homepage, ROOT_URL) !== HOMEPAGE_URL) {
      throw new Error('DigiVersal verified root redirect no longer matches the known surface')
    }

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('DigiVersal verified official homepage no longer matches the known surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSurface(careersPage.html)) {
      throw new Error('DigiVersal verified official careers surface no longer matches the known surface')
    }

    const cards = extractCareerCards(careersPage.html)
    if (cards.length === 0) {
      throw new Error('DigiVersal verified first-party careers cards no longer match the known surface')
    }

    for (const routeUrl of MISSING_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isMissingJobRoute(routePage, routeUrl)) {
        throw new Error(`DigiVersal verified missing alternate jobs route changed: ${getFinalUrl(routePage, routeUrl)}`)
      }
    }

    const scrapedAt = now()
    const jobs = []

    for (const card of cards) {
      const detailPage = await fetchPage(card.detailUrl)
      if (detailPage.status !== 200 || !hasJobDetailSignal(detailPage.html, card.title)) {
        throw new Error(`DigiVersal verified first-party job detail page no longer matches the known surface: ${card.detailUrl}`)
      }

      const detail = extractJobDetail(detailPage.html, card.title)
      const normalizedLocation = normalizeLocation(card.locationLabel)

      jobs.push({
        title: card.title,
        company: COMPANY,
        location: normalizedLocation.location,
        city: normalizedLocation.city,
        country: normalizedLocation.country,
        link: card.detailUrl,
        applyUrl: card.detailUrl,
        sourceUrl: card.detailUrl,
        source: SOURCE,
        jobId: card.slug,
        requisitionId: card.slug,
        department: detail.department,
        employmentType: null,
        experienceRequired: detail.experienceRequired,
        jobDescription: detail.jobDescription,
        minimumQualification: detail.minimumQualification,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: parsePostingDate(card.postingLabel),
        remoteStatus: 'On-site',
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createDigiVersalScraper().run(options)

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
