import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'centralboardofirrigationandpower'
export const COMPANY = 'Central Board of Irrigation and Power'
export const HOMEPAGE_URL = 'https://cbip.org/'
export const HRMS_LOGIN_URL = 'https://hrms.cbip.org/login'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: HOMEPAGE_URL,
  companyDomain: 'cbip.org',
  adapter: 'script',
  atsPlatform: 'official-company-homepage',
  modulePath: '../../scraper/centralboardofirrigationandpower/script.js',
  dryRunFile: 'centralboardofirrigationandpower/jobs.json',
  countryFilter: 'India',
  paginationStrategy: 'homepage-recruitment-placeholder',
  extractionStrategy: 'verified-homepage-empty-recruitment-notice+employee-login-only-hrms-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Verified https://cbip.org/ shows an empty Recruitment Notice block and an Employee Login link to HRMS. Verified https://hrms.cbip.org/login is an employee login form, not a public jobs surface.',
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_TITLE_PATTERN = /<title>\s*Central Board Of Irrigation And Power\s*<\/title>/i
const ABOUT_CBIP_PATTERN = /\bABOUT\s+CBIP\b|\bCentral Board of Irrigation and Power\s*\(CBIP\)\s+is\s+a\s+premier institution\b/i
const EMPLOYEE_LOGIN_PATTERN = /<a\b[^>]*href=["']https:\/\/hrms\.cbip\.org\/login["'][^>]*>\s*Employee Login\s*<\/a>/i
const RECRUITMENT_NOTICE_PATTERN = /<h3[^>]*>\s*Recruitment Notice\s*<\/h3>/i
const EXPERT_REGISTRATION_PATTERN = /<h3[^>]*>\s*Expert Registration\s*<\/h3>|Invitation for Empanelment of Experts/i

const HRMS_TITLE_PATTERN = /<title>\s*Sharaj360\s*-\s*Login\s*<\/title>/i
const HRMS_FORM_PATTERN = /<form\b[^>]*action=["']https:\/\/hrms\.cbip\.org\/login["'][^>]*>/i
const HRMS_MODULE_PATTERN = />\s*HRMS\s*<\/button>[\s\S]*?>\s*E-Office\s*<\/button>/i
const PASSWORD_INPUT_PATTERN = /<input\b[^>]*type=["']password["'][^>]*>/i

const PUBLIC_LISTING_PATTERN =
  /\b(?:vacanc(?:y|ies)|open(?:ing|ings)|position(?:s)?|job(?:s)?|post(?:s|ed)?|apply now|view vacancy|recruitment of)\b/i

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const extractSectionBetweenHeadings = (html, heading, nextHeading) => {
  const page = String(html ?? '')

  if (nextHeading) {
    const pattern = new RegExp(
      `<h3[^>]*>\\s*${heading}\\s*<\\/h3>([\\s\\S]*?)(?=<h3[^>]*>\\s*${nextHeading}\\s*<\\/h3>)`,
      'i',
    )
    const matched = page.match(pattern)?.[1]
    if (matched != null) return matched
  }

  return page.match(new RegExp(`<h3[^>]*>\\s*${heading}\\s*<\\/h3>([\\s\\S]*?)(?=<h3\\b|$)`, 'i'))?.[1] ?? null
}

const extractMeaningfulHrefs = (html) => Array.from(
  String(html ?? '').matchAll(/href=["']([^"'#][^"']*)["']/gi),
  (match) => normalizeWhitespace(match[1]),
).filter((href) => href && !/^(javascript:|mailto:)/i.test(href))

export const extractEmployeeLoginUrl = (html) => {
  const match = String(html ?? '').match(
    /<a\b[^>]*href=["'](https:\/\/hrms\.cbip\.org\/login)["'][^>]*>\s*Employee Login\s*<\/a>/i,
  )

  return match?.[1] ?? null
}

export const extractRecruitmentNoticeSection = (html) => extractSectionBetweenHeadings(
  html,
  'Recruitment Notice',
  'CEA Certification',
)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return OFFICIAL_TITLE_PATTERN.test(page)
    && ABOUT_CBIP_PATTERN.test(page)
    && EMPLOYEE_LOGIN_PATTERN.test(page)
    && RECRUITMENT_NOTICE_PATTERN.test(page)
    && EXPERT_REGISTRATION_PATTERN.test(page)
}

export const hasEmptyRecruitmentNoticeSignal = (html) => {
  const section = extractRecruitmentNoticeSection(html)
  if (!section) return false

  return stripTags(section) === ''
    && extractMeaningfulHrefs(section).length === 0
}

export const pageExposesPublicJobListings = (html) => {
  const section = extractRecruitmentNoticeSection(html)
  if (!section) return false

  const text = stripTags(section)
  const hrefs = extractMeaningfulHrefs(section)

  return hrefs.length > 0 || PUBLIC_LISTING_PATTERN.test(text)
}

export const hasHrmsLoginSignal = (html) => {
  const page = String(html ?? '')

  return HRMS_TITLE_PATTERN.test(page)
    && HRMS_FORM_PATTERN.test(page)
    && HRMS_MODULE_PATTERN.test(page)
    && PASSWORD_INPUT_PATTERN.test(page)
}

export const extractSearchResults = () => []

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCentralBoardOfIrrigationAndPowerScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Central Board of Irrigation and Power official homepage surface changed; refusing to assume no public listings')
    }

    if (extractEmployeeLoginUrl(homepageHtml) !== HRMS_LOGIN_URL) {
      throw new Error('Central Board of Irrigation and Power employee login link changed; refusing to assume no public listings')
    }

    if (!hasEmptyRecruitmentNoticeSignal(homepageHtml)) {
      if (pageExposesPublicJobListings(homepageHtml)) {
        throw new Error('Central Board of Irrigation and Power homepage now exposes public job listings and needs a structured scraper')
      }

      throw new Error('Central Board of Irrigation and Power homepage recruitment placeholder changed; refusing to assume no public listings')
    }

    const hrmsLoginHtml = await fetchText(HRMS_LOGIN_URL)
    if (!hasHrmsLoginSignal(hrmsLoginHtml)) {
      throw new Error('Central Board of Irrigation and Power employee login surface changed; refusing to assume no public listings')
    }

    return extractSearchResults(homepageHtml)
  },
})

export const run = async (options = {}) => createCentralBoardOfIrrigationAndPowerScraper().run(options)

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

