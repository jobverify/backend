import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cyberarkindia'
export const COMPANY = 'CyberArk India'
export const CYBERARK_CAREERS_URL = 'https://www.cyberark.com/careers/'
export const PALO_ALTO_JOBS_HOME_URL = 'https://jobs.paloaltonetworks.com/en/'
export const PALO_ALTO_INDIA_URL = 'https://jobs.paloaltonetworks.com/en/india'
export const PALO_ALTO_INDIA_SEARCH_URL = 'https://jobs.paloaltonetworks.com/en/search-jobs/?alcpm=1269750&orgIds=47263'
export const PALO_ALTO_IDIRA_URL = 'https://www.paloaltonetworks.com/idira'

export const CATALOG_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  adapter: 'script',
  modulePath: '../../scraper/cyberarkindia/script.js',
  companyCareerPage: CYBERARK_CAREERS_URL,
  atsPlatform: 'official-company-careers-handoff-to-shared-parent-jobs',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-handoff-plus-parent-india-page-and-filtered-search-validation',
  extractionStrategy: 'verified-cyberark-careers-handoff+verified-pan-india-pages-without-cyberark-specific-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cyberark.com',
  workspaceDomain: 'jobs.paloaltonetworks.com',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary: 'Verified on Saturday, August 15, 2026 that https://www.cyberark.com/careers/ redirects to https://www.paloaltonetworks.com/idira, whose footer still links to https://jobs.paloaltonetworks.com/en/. Verified on the same date that the India-filtered shared Palo Alto Networks search shell at https://jobs.paloaltonetworks.com/en/search-jobs/?alcpm=1269750&orgIds=47263 remains live, while the older India location landing route at https://jobs.paloaltonetworks.com/en/india currently falls through to the first-party /en/error page rather than a distinct location story page. The shared parent surfaces still do not expose a CyberArk-specific public jobs board.',
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\s+/g, ' ')
  .trim()

const normalizeVisibleText = (value) => normalizeWhitespace(
  String(value ?? '').replace(/<[^>]+>/g, ' '),
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

export const hasCyberArkCareersHandoffSignal = (html) => {
  const rawHtml = String(html ?? '')
  const visibleText = normalizeVisibleText(rawHtml)

  return /<title[^>]*>\s*Careers\s*\|\s*CyberArk\s*<\/title>/i.test(rawHtml)
    && visibleText.includes('Find your opportunity')
    && visibleText.includes('CyberArk is now a Palo Alto Networks company. Check the Palo Alto Networks career site for all opportunities!')
    && rawHtml.includes(PALO_ALTO_JOBS_HOME_URL)
}

export const hasCyberArkRedirectedCareersHandoffSignal = ({ html, finalUrl }) => {
  const rawHtml = String(html ?? '')

  return String(finalUrl ?? '').replace(/\/+$/, '') === PALO_ALTO_IDIRA_URL
    && /<title[^>]*>\s*Idira\s*\|\s*The Identity Security Platform\s*-\s*Palo Alto Networks\s*<\/title>/i.test(rawHtml)
    && /Protect your organization with Idira/i.test(rawHtml)
    && rawHtml.includes(PALO_ALTO_JOBS_HOME_URL)
}

export const hasExpectedIndiaSearchHandoff = (html) =>
  decodeHtmlEntities(String(html ?? '')).includes(PALO_ALTO_INDIA_SEARCH_URL)

export const hasPaloAltoIndiaLocationSignal = (html) => {
  const rawHtml = String(html ?? '')
  const visibleText = normalizeVisibleText(rawHtml)

  return /<title[^>]*>\s*Explore Cybersecurity Careers and Jobs at Palo Alto Networks India\s*<\/title>/i.test(rawHtml)
    && visibleText.includes('India Location')
    && visibleText.includes('Center of Excellence')
    && visibleText.includes('Palo Alto Networks India boasts state-of-the-art technology centers located in Bengaluru, Gurgaon, and Pune.')
    && visibleText.includes('Latest Jobs in India')
}

export const hasPaloAltoIndiaErrorFallbackSignal = ({ html, finalUrl }) => {
  const rawHtml = String(html ?? '')
  const visibleText = normalizeVisibleText(rawHtml)
  const normalizedFinalUrl = String(finalUrl ?? '').replace(/\/+$/, '')

  return normalizedFinalUrl === 'https://jobs.paloaltonetworks.com/en/error'
    && /<title[^>]*>\s*Error\s*<\/title>/i.test(rawHtml)
    && visibleText.includes('Locations')
    && visibleText.includes('India')
    && visibleText.includes('An error has occurred.')
    && visibleText.includes('Featured Jobs')
    && visibleText.includes('Recently Viewed Jobs')
}

export const hasPaloAltoIndiaSearchSignal = (html) => {
  const rawHtml = String(html ?? '')
  const visibleText = normalizeVisibleText(rawHtml)

  return /<title[^>]*>\s*Search our Job Opportunities at Palo Alto Networks\s*<\/title>/i.test(rawHtml)
    && visibleText.includes('Job Search Results')
    && visibleText.includes('Filtered by Country: India')
    && visibleText.includes('Bengaluru')
    && visibleText.includes('Mumbai')
    && visibleText.includes('New Delhi')
    && visibleText.includes('Pune')
    && visibleText.includes('Clear All Filters')
}

export const hasCyberArkSpecificJobsSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<(?:h1|h2|h3|h4|title)[^>]*>[^<]*CyberArk[^<]*(?:Jobs?|Careers?|Roles?|Openings?)[^<]*<\/(?:h1|h2|h3|h4|title)>/i.test(rawHtml)
    || /href=["'][^"']*cyberark[^"']*(?:jobs?|careers?|roles?|openings?)[^"']*["']/i.test(rawHtml)
}

export const createCyberArkIndiaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CYBERARK_CAREERS_URL)

    if (
      careersPage.status !== 200
      || (
        !hasCyberArkCareersHandoffSignal(careersPage.html)
        && !hasCyberArkRedirectedCareersHandoffSignal({
          html: careersPage.html,
          finalUrl: careersPage.url,
        })
      )
    ) {
      throw new Error('CyberArk verified official CyberArk careers surface no longer matches the known Palo Alto Networks handoff')
    }

    const paloAltoIndiaPage = await fetchPage(PALO_ALTO_INDIA_URL)

    if (
      paloAltoIndiaPage.status !== 200
      || (
        !hasPaloAltoIndiaLocationSignal(paloAltoIndiaPage.html)
        && !hasPaloAltoIndiaErrorFallbackSignal({
          html: paloAltoIndiaPage.html,
          finalUrl: paloAltoIndiaPage.url,
        })
      )
    ) {
      throw new Error('CyberArk verified Palo Alto Networks India location page no longer matches the known shared-parent handoff')
    }

    const paloAltoIndiaSearchPage = await fetchPage(PALO_ALTO_INDIA_SEARCH_URL)

    if (
      paloAltoIndiaSearchPage.status !== 200
      || !hasPaloAltoIndiaSearchSignal(paloAltoIndiaSearchPage.html)
    ) {
      throw new Error('CyberArk verified Palo Alto Networks India jobs surface no longer matches the known shared search shell')
    }

    if (
      hasCyberArkSpecificJobsSignal(paloAltoIndiaPage.html)
      || hasCyberArkSpecificJobsSignal(paloAltoIndiaSearchPage.html)
    ) {
      throw new Error('CyberArk parent India jobs surface changed materially or now exposes a CyberArk-specific public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createCyberArkIndiaScraper().run(options)

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

