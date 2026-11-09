import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AJNALENS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AJNALENS_CATALOG.source
export const COMPANY = AJNALENS_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = AJNALENS_CATALOG.officialBrandName
export const VERIFIED_ON = AJNALENS_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AJNALENS_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AJNALENS_CATALOG
export const HOMEPAGE_URL = AJNALENS_CATALOG.homepageUrl
export const CAREERS_URL = AJNALENS_CATALOG.companyCareerPage
export const APPLICATION_URL = AJNALENS_CATALOG.applicationUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const EMBEDDED_ROLE_PATTERN =
  /\\"id\\":(\d+),\\"documentId\\":\\"[^"]+\\",\\"ttile\\":\\"([^"]+)\\",\\"slug\\":\\"([^"]+)\\",\\"experience\\":\\"([^"]*)\\",\\"createdAt\\":\\"([^"]+)\\"/gi

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeTextContent = (html) => normalizeWhitespace(
  String(html ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeExperience = (value) => normalizeWhitespace(value)
  ?.match(/\d+/g)
  ?.slice(0, 2)
  ?.join('-') || null

const mapRoleToJob = (role) => ({
  title: role.title,
  company: COMPANY,
  department: null,
  location: 'India',
  city: null,
  state: null,
  country: 'India',
  jobId: role.id,
  requisitionId: role.id,
  sourceUrl: CAREERS_URL,
  applyUrl: APPLICATION_URL,
  employmentType: null,
  experienceRequired: role.experience,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: role.postingDate,
  closingDate: null,
  jobDescription: `Apply via the shared first-party careers page on ${CAREERS_URL}. AjnaLens currently states its teams work from the office.`,
  remoteStatus: 'On-site',
})

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

const markUpstreamOutage = (error) => {
  error.softFailure = true
  error.upstreamOutage = true
  return error
}

export const buildRoleDetailUrl = (slug) => `${CAREERS_URL}/${normalizeWhitespace(slug) || ''}`

export const isOriginUnreachableSurface = (page = {}) => {
  const html = String(page?.html ?? '')
  const text = normalizeTextContent(html) || ''

  return Number(page?.status) === 523
    && /<title>\s*ajnalens\.com\s*\|\s*523:\s*Origin is unreachable\s*<\/title>/i.test(html)
    && /origin is unreachable/i.test(text)
}

export const hasOfficialCareersSurface = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers at AjnaLens \|\s*Join the Future of XR\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+Build a transformative career at AjnaLens/i.test(page)
    && /href=["']\/careers["']/i.test(page)
    && /openings_list/i.test(page)
    && /Start Your Journey With Us/i.test(page)
    && /Submit your resume and explore opportunities to work on meaningful and impactful projects/i.test(page)
    && /What does your hiring process look like\?/i.test(page)
    && /How can I apply for a job at AjnaLens\?/i.test(page)
    && /Our teams currently work from the office/i.test(page)
    && /Subscribe to job alert/i.test(page)
}

export const extractEmbeddedRoles = (html) => {
  const page = String(html ?? '')
  const roles = []
  const seenIds = new Set()

  for (const match of page.matchAll(EMBEDDED_ROLE_PATTERN)) {
    const id = normalizeWhitespace(match[1])
    const title = normalizeWhitespace(match[2])
    const slug = normalizeWhitespace(match[3])
    const experience = normalizeExperience(match[4])
    const postingDate = normalizeWhitespace(match[5])

    if (!id || !title || !slug || !experience || !postingDate || seenIds.has(id)) {
      continue
    }

    seenIds.add(id)
    roles.push({
      id,
      title,
      slug,
      experience,
      postingDate,
    })
  }

  return roles
}

export const isVerifiedMissingDetailRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const text = normalizeTextContent(html) || ''
  const finalUrl = normalizeWhitespace(page?.url) || ''

  return Number(page?.status) === 404
    && /^https:\/\/ajnalens\.com\/careers\/[^/?#]+$/i.test(finalUrl)
    && /<meta[^>]+name=["']robots["'][^>]+content=["']noindex["']/i.test(html)
    && /<title>\s*404:\s*This page could not be found\.\s*<\/title>/i.test(html)
    && text.includes('This page could not be found.')
}

export const extractOpenPositions = (html) => {
  if (!hasOfficialCareersSurface(html)) {
    throw new Error('AjnaLens careers page no longer matches the verified AjnaLens careers surface')
  }

  const roles = extractEmbeddedRoles(html)
  if (roles.length === 0) {
    throw new Error('AjnaLens careers page no longer exposes the verified embedded openings payload')
  }

  return roles.map(mapRoleToJob)
}

export const createAjnaLensScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (isOriginUnreachableSurface(careersPage)) {
      throw markUpstreamOutage(new Error('AjnaLens careers page is currently upstream unavailable: Origin is unreachable'))
    }

    if (Number(careersPage?.status) !== 200 || !hasOfficialCareersSurface(careersPage?.html)) {
      throw new Error('AjnaLens careers page no longer matches the verified AjnaLens careers surface')
    }

    const roles = extractEmbeddedRoles(careersPage.html)
    if (roles.length === 0) {
      throw new Error('AjnaLens careers page no longer exposes the verified embedded openings payload')
    }

    for (const role of roles) {
      const detailPage = await fetchPage(buildRoleDetailUrl(role.slug))

      if (!isVerifiedMissingDetailRoute(detailPage)) {
        throw new Error(`AjnaLens verified missing role detail route changed: ${detailPage?.url || buildRoleDetailUrl(role.slug)}`)
      }
    }

    return roles.map((role) => ({
      ...mapRoleToJob(role),
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: APPLICATION_URL,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createAjnaLensScraper().run(options)

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
