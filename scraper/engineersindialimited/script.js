import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publicPostingDescription } from '../../rewriting/publicPostingDescription.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'engineersindialimited'
export const COMPANY = 'Engineers India Limited'
export const LEGACY_CURRENT_OPENINGS_URL = 'https://recruitment.eil.co.in/'
export const CURRENT_OPENINGS_URL = LEGACY_CURRENT_OPENINGS_URL
export const HOMEPAGE_URL = 'https://www.engineersindia.com/'
export const CAREERS_URL = 'https://www.engineersindia.com/careers'
export const APPLYING_URL = 'https://www.engineersindia.com/applying-to-eil'
export const VERIFIED_ON = '2026-08-15'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000
const TIMEOUT_ERROR_PATTERN = /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? ''))

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeAdvNumber = (value) => normalizeWhitespace(value)?.replace(/\s+/g, '') || null

const isTimeoutError = (error) => {
  if (error?.name === 'AbortError') return true

  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const message = String(error?.message ?? error ?? '')

  return /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT/i.test(causeCode)
    || TIMEOUT_ERROR_PATTERN.test(causeMessage)
    || TIMEOUT_ERROR_PATTERN.test(message)
}

const buildMaterialSurfaceChangeError = (message) => {
  const error = new Error(message)
  error.abortRetries = true
  return error
}

const buildPrintApplicationUrl = (advNumber) => {
  const normalized = normalizeAdvNumber(advNumber)
  if (!normalized) return null
  const encoded = encodeURIComponent(normalized)
  return `https://recruitment.eil.co.in/applicnExpRecruitment/Printout_regno.aspx?adv=${encoded}`
}

export const isExpectedLegacyPortalTimeout = (page = {}) =>
  page?.errorKind === 'timeout'
  && !Number.isInteger(page?.status)
  && page?.html == null

export const isExpectedMainSiteTimeout = (page = {}) =>
  page?.errorKind === 'timeout'
  && !Number.isInteger(page?.status)
  && page?.html == null

export const hasCurrentOpeningsSignal = (html) => {
  const page = String(html ?? '')
  return /EIL Recruitment Portal|<title>\s*EIL\s*\|\s*Recruitment\s*<\/title>/i.test(page)
    && /Current Openings/i.test(page)
    && (
      /Recruitment of Fresher \/ Experienced Candidates/i.test(page)
      || /Live Advertisements \/ Print Outs/i.test(page)
      || /\(Adv No:/i.test(page)
    )
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*EIL[\s\S]*Global Engineering Consultancy Offering Total Energy Solutions/i.test(page)
    && text.includes('Global Engineering Consultancy Offering Total Energy Solutions')
    && text.includes('Why Work at EIL')
    && text.includes('Applying to EIL')
    && /href=["']\/careers["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Careers at EIL[\s\S]*Leading Engineering Consultancy/i.test(page)
    && text.includes('Explore our career opportunities')
    && text.includes('Why Work at EIL')
    && text.includes('Applying to EIL')
    && /mailto:Opportunities@EIL/i.test(page)
}

export const hasOfficialApplyingSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Applying to EIL[\s\S]*Premier Engineering Consultancy Company/i.test(page)
    && text.includes('No Fee is Payable')
    && text.includes('BEWARE OF FRAUDULENT WEBSITES / EMAILS')
    && text.includes('Recruitment of candidates with work experience through open competition')
    && text.includes('Management Trainees')
}

export const hasPublicOpeningsOnMainSite = (html) => {
  const text = stripTags(html) || ''

  return /\bCurrent Openings\b/i.test(text)
    || /\bLive Advertisements\b/i.test(text)
    || /\bAdvt No\b/i.test(text)
    || /\bApply now\b/i.test(text)
    || /Printout_regno\.aspx/i.test(String(html ?? ''))
}

export const extractOpenings = (html) => {
  const page = String(html ?? '')
  const jobs = [...page.matchAll(
    /(\d+)\.\s*([^<\n]+?)\s*\(Adv No:\s*([^)]+)\)/gi,
  )]
    .map((match) => {
      const title = stripTags(match[2])
      const advNumber = normalizeAdvNumber(match[3])
      const requisitionId = advNumber ? `eil-${slugify(advNumber)}` : null

      if (!title || !advNumber || !requisitionId) return null

      return {
        title,
        company: COMPANY,
        department: null,
        location: 'India',
        city: null,
        state: null,
        country: 'India',
        jobId: requisitionId,
        requisitionId,
        sourceUrl: CURRENT_OPENINGS_URL,
        applyUrl: buildPrintApplicationUrl(advNumber),
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
    .filter(Boolean)

  if (jobs.length === 0) {
    throw buildMaterialSurfaceChangeError('Engineers India Limited recruitment portal no longer exposes the expected current openings list')
  }

  return jobs
}

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) => {
  try {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: typeof AbortSignal?.timeout === 'function'
        ? AbortSignal.timeout(timeoutMs)
        : undefined,
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    if (isTimeoutError(error)) {
      return {
        status: null,
        url,
        html: null,
        errorKind: 'timeout',
      }
    }

    return {
      status: null,
      url,
      html: null,
      errorKind: 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

export const createEngineersIndiaLimitedScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const legacyPortal = await fetchPage(CURRENT_OPENINGS_URL)

    if (!legacyPortal.errorKind && legacyPortal.status === 200 && hasCurrentOpeningsSignal(legacyPortal.html)) {
      return extractOpenings(legacyPortal.html).map((job) => {
        const posting = publicPostingDescription({ ...job, source: SOURCE }, legacyPortal.html,
          legacyPortal.url || CURRENT_OPENINGS_URL)
        return { ...job, sourceDescription: posting?.description ?? null,
          jobDescription: posting?.description ?? null, source: SOURCE,
          link: job.applyUrl || job.sourceUrl, scrapedAt: new Date().toISOString() }
      })
    }

    if (!isExpectedLegacyPortalTimeout(legacyPortal)) {
      throw buildMaterialSurfaceChangeError('Engineers India Limited legacy recruitment portal no longer matches the verified reachable-or-timeout contract')
    }

    const homepage = await fetchPage(HOMEPAGE_URL)
    const careersPage = await fetchPage(CAREERS_URL)
    const applyingPage = await fetchPage(APPLYING_URL)

    if ([homepage, careersPage, applyingPage].every(isExpectedMainSiteTimeout)) {
      return []
    }

    if (
      !isExpectedMainSiteTimeout(homepage)
      && (
        homepage.status !== 200
        || !hasOfficialHomepageSignal(homepage.html)
        || hasPublicOpeningsOnMainSite(homepage.html)
      )
    ) {
      throw buildMaterialSurfaceChangeError('Engineers India Limited homepage no longer matches the verified main-domain no-public-openings surface')
    }

    if (
      !isExpectedMainSiteTimeout(careersPage)
      && (
        careersPage.status !== 200
        || !hasOfficialCareersSignal(careersPage.html)
        || hasPublicOpeningsOnMainSite(careersPage.html)
      )
    ) {
      throw buildMaterialSurfaceChangeError('Engineers India Limited careers page no longer matches the verified main-domain no-public-openings surface')
    }

    if (
      !isExpectedMainSiteTimeout(applyingPage)
      && (
        applyingPage.status !== 200
        || !hasOfficialApplyingSignal(applyingPage.html)
        || hasPublicOpeningsOnMainSite(applyingPage.html)
      )
    ) {
      throw buildMaterialSurfaceChangeError('Engineers India Limited applying page no longer matches the verified main-domain no-public-openings surface')
    }

    return []
  },
})

export const run = async (options = {}) => createEngineersIndiaLimitedScraper().run(options)

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
