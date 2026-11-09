import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nexusmalls'
export const COMPANY = 'Nexus Select Trust'
export const HOMEPAGE_URL = 'https://www.nexusselecttrust.com/'
export const CAREERS_URL = 'https://www.nexusselecttrust.com/careers'
export const JOBS_URL = 'https://www.nexusselecttrust.com/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_TITLE_PATTERN =
  /<title>\s*Nexus Select Trust\s*\|\s*Listed Real Estate Investment Trust\s*\(REIT\)\s*<\/title>/i
const HOMEPAGE_REIT_PATTERN =
  /India[^A-Za-z0-9]{0,4}s first publicly listed retail Real Estate Investment Trust(?:\s*\(REIT\))?/i
const HOMEPAGE_ABOUT_PATTERN =
  /Nexus has emerged to be biggest retail real estate platform in India/i
const CAREER_LINK_PATTERN = /href=["']([^"']*(?:career|job|work-with-us|workwithus)[^"']*)["']/gi
const MISSING_ROUTE_PATTERN = /\b404\b|\bnot found\b|\bdoes not exist\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, '-')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return HOMEPAGE_TITLE_PATTERN.test(page)
    && HOMEPAGE_REIT_PATTERN.test(normalized)
    && HOMEPAGE_ABOUT_PATTERN.test(normalized)
}

export const extractCareerLikeLinks = (html) => {
  const matches = String(html ?? '').matchAll(CAREER_LINK_PATTERN)
  return [...matches].map((match) => match[1])
}

const extractFirst = (pattern, html) => normalizeWhitespace(String(html ?? '').match(pattern)?.[1]) || null

export const hasOfficialCareerPageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Career at nexus\s*<\/title>/i.test(page)
    && text.includes('Our Featured Jobs')
    && text.includes('Be a part of Nexus')
    && (
      text.includes('Your dream job starts here.')
      || (
        text.includes('Where Your Potential Meets Purpose')
        && text.includes('Join our Team')
        && text.includes('Find Jobs')
      )
    )
    && /mailto:careers@nexusmalls\.com/i.test(page)
}

export const extractCareerJobs = (html, { scrapedAt = new Date().toISOString() } = {}) =>
  String(html ?? '').split('<div class="job-card">').slice(1).map((card) => {
    const title = extractFirst(/<h2\b[^>]*class=["'][^"']*job-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i, card)
    const jobDescription = extractFirst(/<p\b[^>]*class=["'][^"']*job-desc[^"']*["'][^>]*>([\s\S]*?)<\/p>/i, card)
    const detailUrl = extractFirst(/<a\b[^>]*href=["']([^"']*\/career\/job-details\/[^"']+)["'][^>]*class=["'][^"']*btn-view-details/i, card)
    const tags = [...card.matchAll(/<span\b[^>]*class=["'][^"']*tag[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
      .map((match) => normalizeWhitespace(match[1]))
      .filter(Boolean)
    const [location, employmentType, department, experienceRequired] = tags

    if (!title || !detailUrl || !location) return null

    const jobId = detailUrl.split('/').filter(Boolean).at(-1)
    return {
      title,
      company: COMPANY,
      department: department || null,
      location: `${location}, India`,
      city: location.split(',').at(-1)?.trim() || location,
      country: 'India',
      jobId: `${SOURCE}-${jobId}`,
      requisitionId: jobId,
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      employmentType: employmentType || null,
      experienceRequired: experienceRequired || null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
      remoteStatus: 'On-site',
      source: SOURCE,
      link: detailUrl,
      scrapedAt,
      companyCareerPage: CAREERS_URL,
      companyDomain: 'nexusselecttrust.com',
      atsPlatform: 'official-company-careers',
    }
  }).filter(Boolean)

export const hasMissingRouteSignal = ({ status, html }) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return status === 404 && MISSING_ROUTE_PATTERN.test(normalized)
}

export const createNexusMallsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Nexus Malls homepage no longer matches the verified official public surface')
    }

    const careerUrl = extractCareerLikeLinks(homepage.html)
      .find((href) => new URL(href, HOMEPAGE_URL).pathname === '/career')
    if (careerUrl) {
      const careersPage = await fetchPage(careerUrl)
      if (careersPage.status !== 200 || !hasOfficialCareerPageSignal(careersPage.html)) {
        throw new Error('Nexus Malls careers page no longer matches the verified first-party jobs surface')
      }

      const jobs = extractCareerJobs(careersPage.html)
      if (jobs.length === 0) {
        throw new Error('Nexus Malls careers page no longer exposes verified public job cards')
      }

      return jobs
    }

    if (extractCareerLikeLinks(homepage.html).length > 0) {
      throw new Error('Nexus Malls homepage now exposes an unverified public careers surface')
    }

    const routes = await Promise.all([
      fetchPage(CAREERS_URL),
      fetchPage(JOBS_URL),
    ])

    if (!routes.every(hasMissingRouteSignal)) {
      throw new Error('Nexus Malls verified missing careers routes changed')
    }

    return []
  },
})

export const run = async (options = {}) => createNexusMallsScraper().run(options)

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
