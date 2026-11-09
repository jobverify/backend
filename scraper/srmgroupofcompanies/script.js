import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'srmgroupofcompanies'
export const COMPANY = 'SRM Group of Companies'
export const GROUP_SURFACE_URL = 'https://www.srmtech.com/who-we-are/'
export const CAREERS_PAGE_URL = 'https://www.srmtech.com/careers/'
export const CAREERS_HANDOFF_URL = 'https://careers.srmtech.com/jobs/Careers'
export const OFFICIAL_SURFACE_URLS = [
  GROUP_SURFACE_URL,
  CAREERS_PAGE_URL,
  CAREERS_HANDOFF_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000

const GROUP_SURFACE_SIGNALS = [
  'Founded in 1998 as part of the SRM Group',
  'About SRM Group',
  'A billion-dollar conglomerate with a formidable presence in the fields of education, transport, engineering, hospitality, infotainment and healthcare.',
  'SRM Group is known for its integrity, ethical practice and transparency',
  'Healthier Tomorrow',
]

const CAREERS_PAGE_SIGNALS = [
  'Become A Part Of Our Growth Journey',
  'Featured Roles',
  'Why SRM Tech?',
  'Join a Certified Great Place to Work!',
  'View Open Positions',
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const hasInputWithId = (html, id) =>
  new RegExp(`<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').test(String(html ?? ''))

const withTimeoutSignal = async (operation) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await operation(controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}

const defaultFetchText = async (url) => withTimeoutSignal(async (signal) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal,
  })

  return response.text()
})

export const hasOfficialGroupSurfaceSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*About Us\s*\|\s*Our Markets\s*\|\s*Our Partners\s*\|\s*SRM Technologies\s*<\/title>/i.test(page)
    && GROUP_SURFACE_SIGNALS.every((signal) => text.includes(signal))
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers\s*\|\s*Work Culture\s*\|\s*SRM Technologies\s*<\/title>/i.test(page)
    && page.includes(CAREERS_HANDOFF_URL)
    && CAREERS_PAGE_SIGNALS.every((signal) => text.includes(signal))
}

export const hasOfficialSrmTechnologiesBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*\|\s*Job Opportunities\s*\|\s*SRM Technologies\s*<\/title>/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
    && page.includes(CAREERS_HANDOFF_URL)
    && /SRM Technologies/i.test(page)
}

export const getRunnerMetadata = () => ({
  name: SOURCE,
  dryRunFile: 'jobs.json',
  provider: {
    source: SOURCE,
    companyName: COMPANY,
    companyCareerPage: CAREERS_PAGE_URL,
    alternateCareerPages: [GROUP_SURFACE_URL, CAREERS_HANDOFF_URL],
    adapter: 'script',
    atsPlatform: 'zoho-recruit-exact-brand-mismatch',
    countryFilter: 'India',
    parser: 'custom-script',
    paginationStrategy: 'group-surface-plus-public-srm-tech-board-validation',
    extractionStrategy: 'verified-srm-group-surface+verified-srm-tech-careers-page+public-srm-tech-board-return-empty',
    normalizationProfile: 'engineering-default',
    companyDomain: 'srmtech.com',
  },
})

export const createSrmGroupOfCompaniesScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const groupSurfaceHtml = await fetchText(GROUP_SURFACE_URL)
    if (!hasOfficialGroupSurfaceSignal(groupSurfaceHtml)) {
      throw new Error('SRM Group of Companies verified SRM Group surface no longer matches the known first-party page')
    }

    const careersPageHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersPageHtml)) {
      throw new Error('SRM Group of Companies verified SRM careers page no longer matches the official first-party handoff page')
    }

    const handoffBoardHtml = await fetchText(CAREERS_HANDOFF_URL)
    if (!hasOfficialSrmTechnologiesBoardSignal(handoffBoardHtml)) {
      throw new Error('SRM Group of Companies public SRM Technologies careers board changed or no longer matches the trusted brand-mismatch surface')
    }

    return []
  },
})

export const run = async (options = {}) => createSrmGroupOfCompaniesScraper().run(options)

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
