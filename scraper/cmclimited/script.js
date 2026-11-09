import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cmclimited'
export const COMPANY = 'CMC Limited'
export const VERIFIED_AT = '2026-07-14'
export const CMC_INFO_URL = 'https://www.cmcltd.com/'
export const TCS_CAREERS_URL = 'https://www.tcs.com/careers'
export const TCS_INDIA_CAREERS_URL = 'https://www.tcs.com/careers/india'

export const CATALOG_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  adapter: 'script',
  modulePath: '../../scraper/cmclimited/script.js',
  companyCareerPage: CMC_INFO_URL,
  atsPlatform: 'historical-company-domain-plus-parent-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-post-merger-company-domain-plus-parent-careers-validation',
  extractionStrategy: 'verified-cmcltd-post-merger-shell+verified-parent-tcs-careers-without-cmc-specific-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cmcltd.com',
  workspaceDomain: 'tcs.com',
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\s+/g, ' ')
  .trim()

const normalizeVisibleText = (value) => normalizeWhitespace(
  String(value ?? '').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

export const hasHistoricalInfoSurfaceSignal = (html) => {
  const rawHtml = String(html ?? '')
  const visibleText = normalizeVisibleText(rawHtml)

  return /<title[^>]*>\s*Information on CMC Business Solutions\s*<\/title>/i.test(rawHtml)
    && visibleText.includes('CMC Limited is now Tata Consultancy Services')
    && visibleText.includes('The Former Home of CMC Limited')
    && visibleText.includes('CMC Ltd. was amalgamated into Tata Consultancy Services on October 1, 2015.')
    && visibleText.includes('CMC is no longer a separate business entity.')
    && /href=["']https?:\/\/www\.tcs\.com\/?["']/i.test(rawHtml)
}

export const hasHistoricalDomainJobSignal = (html) => {
  const rawHtml = decodeHtmlEntities(String(html ?? ''))
  const visibleText = normalizeVisibleText(rawHtml)
  const normalizedLinks = rawHtml.replace(/https:\/\/www\.tcs\.com\/?/gi, '')

  return /href=["'][^"']*(?:jobs?|careers?|openings?|apply|vacanc(?:y|ies)|positions?)[^"']*["'][^>]*>/i.test(normalizedLinks)
    || /\b(?:job openings|open positions|current openings|search jobs|apply now|join our team|vacancies)\b/i.test(visibleText)
    || /\b(?:greenhouse|lever|workday|taleo|smartrecruiters|ashby|darwinbox|bamboohr|jobvite|icims)\b/i.test(rawHtml)
}

export const hasTcsCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const visibleText = normalizeVisibleText(rawHtml)

  return /<title[^>]*>\s*TCS Careers\s*<\/title>/i.test(rawHtml)
    && visibleText.includes('Want to be a global change-maker? Join our team.')
    && visibleText.includes('At TCS, we believe exceptional work begins with hiring, celebrating and nurturing the best people.')
    && /href=["'][^"']*\/careers\/india["']/i.test(rawHtml)
}

export const hasTcsIndiaCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const visibleText = normalizeVisibleText(rawHtml)

  return /<title[^>]*>\s*TCS India Careers\s*<\/title>/i.test(rawHtml)
    && visibleText.includes('Want to be a global change-maker? Join our team.')
    && visibleText.includes('India')
    && visibleText.includes('TCS India')
}

export const hasCmcSpecificJobsSignal = (html) => {
  const rawHtml = decodeHtmlEntities(String(html ?? ''))

  return /<(?:h1|h2|h3|h4|title|a)[^>]*>[^<]*(?:CMC Limited|CMC)[^<]*(?:Jobs?|Careers?|Openings?|Roles?|Positions?|Vacancies?)[^<]*<\/(?:h1|h2|h3|h4|title|a)>/i.test(rawHtml)
    || /<(?:h1|h2|h3|h4|title|a)[^>]*>[^<]*(?:Jobs?|Careers?|Openings?|Roles?|Positions?|Vacancies?)[^<]*(?:CMC Limited|CMC)[^<]*<\/(?:h1|h2|h3|h4|title|a)>/i.test(rawHtml)
    || /href=["'][^"']*(?:cmc|cmclimited)[^"']*(?:jobs?|careers?|openings?|roles?|positions?|vacanc(?:y|ies))[^"']*["']/i.test(rawHtml)
}

export const createCMCLimitedScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const historicalPage = await fetchPage(CMC_INFO_URL)

    if (historicalPage.status !== 200 || !hasHistoricalInfoSurfaceSignal(historicalPage.html)) {
      throw new Error('CMC Limited verified post-merger CMC Limited surface no longer matches the known historical shell')
    }

    if (hasHistoricalDomainJobSignal(historicalPage.html) || hasCmcSpecificJobsSignal(historicalPage.html)) {
      throw new Error('CMC Limited historical company domain now appears to expose a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createCMCLimitedScraper().run(options)

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

