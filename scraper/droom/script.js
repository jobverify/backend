import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { DROOM_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = DROOM_CATALOG.source
export const COMPANY = DROOM_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = DROOM_CATALOG.officialBrandName
export const VERIFIED_ON = DROOM_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = DROOM_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = DROOM_CATALOG
export const HOMEPAGE_URL = DROOM_CATALOG.homepageUrl
export const CAREERS_URL = DROOM_CATALOG.companyCareerPage
export const APPLICATION_FORM_URL = DROOM_CATALOG.applicationFormUrl
export const VERIFIED_404_ROUTE_URLS = DROOM_CATALOG.verified404RouteUrls

const COMPANY_DOMAIN = DROOM_CATALOG.companyDomain
const ATS_PLATFORM = DROOM_CATALOG.atsPlatform
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeHtmlFragment = (value) => String(value ?? '')
  .replace(/\r/g, '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .join('\n')
  .trim()

const stripTagsToText = (value) => normalizeHtmlFragment(String(value ?? ''))
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
  if (!normalizeWhitespace(value)) {
    return null
  }

  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === COMPANY_DOMAIN || hostname === `www.${COMPANY_DOMAIN}`
  } catch {
    return false
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

export const extractHomepageCareerUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<a\b[^>]*href=["']([^"']*\/career(?:\/?(?:[#?][^"']*)?)?)["'][^>]*>/i,
  )

  return match?.[1] ? toAbsoluteUrl(match[1]) : null
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Droom:\s*Automotive E-Commerce Platform to Buy and Sell Vehicles\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/droom\.in\/?["']/i.test(page)
    && extractHomepageCareerUrl(page) === CAREERS_URL
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Career\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/droom\.in\/career["']/i.test(page)
    && /href=["']#careerAtDroom["']/i.test(page)
    && /href=["']#jobsAtDroom["']/i.test(page)
    && /href=["']#campushiring["']/i.test(page)
    && /id=["']jobsAtDroom["']/i.test(page)
    && normalized.includes('Now Hiring')
}

export const hasSharedApplicationFormSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /id=["']career-form["']/i.test(page)
    && /<form[^>]+action=["']https:\/\/droom\.in\/career["'][^>]+class=["'][^"']*career_form[^"']*["'][^>]+id=["']careerForm["']/i.test(page)
    && /id=["']career_position["'][^>]+name=["']career_position["']/i.test(page)
    && normalized.includes('Apply at Droom')
  }

const extractJobsSection = (html = '') => {
  const match = String(html ?? '').match(
    /<div id=["']jobsAtDroom["'][^>]*>([\s\S]*?)<div class=["'][^"']*form-main[^"']*["'][^>]*id=["']career-form["']/i,
  )

  return match?.[1] ?? ''
}

export const extractJobCards = (html = '') => {
  const jobsSection = extractJobsSection(html)
  const cards = []

  for (const match of jobsSection.matchAll(
    /<div class=["'][^"']*card\b[^"']*["'][^>]*>[\s\S]*?<h3 class=["'][^"']*d-font-size-16[^"']*["']>\s*([\s\S]*?)\s*<\/h3>[\s\S]*?<i class=["']career-pin["']><\/i>\s*<span>([\s\S]*?)<\/span>[\s\S]*?<i class=["']career-xperience["']><\/i>\s*<span>([\s\S]*?)<\/span>[\s\S]*?<i class=["']career-time["']><\/i>\s*<span>([\s\S]*?)<\/span>[\s\S]*?href=["'](#[^"']+)["'][\s\S]*?<div id=["']([^"']+)["'][^>]*class=["'][^"']*panel-collapse collapse[^"']*["'][\s\S]*?<div class=["'][^"']*panel-body d-font-size-12[^"']*["']>\s*([\s\S]*?)\s*<\/div>[\s\S]*?Posted Date:\s*([^<]+)<\/p>/gi,
  )) {
    cards.push({
      title: normalizeWhitespace(match[1]),
      location: normalizeWhitespace(match[2]),
      experienceRequired: normalizeWhitespace(match[3]),
      employmentType: normalizeWhitespace(match[4]),
      detailAnchor: normalizeWhitespace(match[5]),
      detailId: normalizeWhitespace(match[6]),
      postingDate: normalizeWhitespace(match[8]),
      detailHtml: normalizeHtmlFragment(match[7]),
    })
  }

  return cards.filter((card) =>
    card.title
    && card.location
    && card.experienceRequired
    && card.employmentType
    && card.detailAnchor
    && card.detailId
    && card.postingDate
    && card.detailHtml,
  )
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)

  if (/^full time$/i.test(normalized)) return 'Full-time'
  if (/^part time$/i.test(normalized)) return 'Part-time'

  return normalized || null
}

export const normalizeJobCard = (card = {}, { now = () => new Date().toISOString() } = {}) => {
  const title = normalizeWhitespace(card.title)
  const location = normalizeWhitespace(card.location)
  const detailId = normalizeWhitespace(card.detailId)
  const detailAnchor = normalizeWhitespace(card.detailAnchor)

  if (!title || !location || !detailId || !detailAnchor) {
    return null
  }

  return {
    jobId: `${SOURCE}-${slugify(title)}`,
    requisitionId: detailId,
    title,
    company: COMPANY,
    department: null,
    location,
    city: normalizeCity(location),
    country: 'India',
    link: toAbsoluteUrl(detailAnchor),
    applyUrl: APPLICATION_FORM_URL,
    sourceUrl: toAbsoluteUrl(detailAnchor),
    source: SOURCE,
    employmentType: normalizeEmploymentType(card.employmentType),
    experienceRequired: normalizeWhitespace(card.experienceRequired),
    jobDescription: stripTagsToText(card.detailHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(card.postingDate),
    closingDate: null,
    scrapedAt: now(),
  }
}

const hasPublicJobsSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /"@type"\s*:\s*"JobPosting"/i.test(page)
    || normalized.includes('current openings')
    || normalized.includes('now hiring')
  }

export const isMissingCareerRoute = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page.status) === 404
    && isOfficialDomainUrl(page.url || '')
    && /<title>\s*Error 404\s*<\/title>/i.test(html)
    && normalized.includes('Error 404')
    && normalized.includes('Buy Automobile')
    && !hasPublicJobsSignal(html)
  }

export const createDroomScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Droom verified homepage no longer matches the trusted first-party surface')
    }

    if (extractHomepageCareerUrl(homepage.html) !== CAREERS_URL) {
      throw new Error('Droom homepage no longer links to the verified first-party careers page')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('Droom verified careers page no longer matches the trusted first-party public job surface')
    }

    if (!hasSharedApplicationFormSignal(careersPage.html)) {
      throw new Error('Droom shared first-party application form no longer matches the verified careers surface')
    }

    const cards = extractJobCards(careersPage.html)
    if (cards.length === 0) {
      throw new Error('Droom verified careers page no longer exposes inline public job cards')
    }

    for (const routeUrl of VERIFIED_404_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Droom verified alternate route changed materially or now exposes jobs: ${routeUrl}`)
      }
    }

    const jobs = cards
      .map((card) => normalizeJobCard(card, { now }))
      .filter(Boolean)

    if (jobs.length === 0) {
      throw new Error('Droom verified careers page no longer yields normalized jobs')
    }

    return jobs.map((job) => ({
      ...job,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: ATS_PLATFORM,
      companyCareerPage: CAREERS_URL,
    }))
  },
})

export const run = async (options = {}) => createDroomScraper().run(options)

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
