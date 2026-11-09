import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import PURPLE_STYLE_LABS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = PURPLE_STYLE_LABS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_EMAIL = PROVIDER_METADATA.officialCareersEmail
export const LINKEDIN_JOBS_HOST = PROVIDER_METADATA.officialLinkedInJobsHost
export const LINKEDIN_COMPANY_ID = PROVIDER_METADATA.officialLinkedInCompanyId
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8217;|&rsquo;|&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')

  return (title === 'Purple Style Labs' || /^Careers\b/i.test(title))
    && text.includes('Purple Style Labs')
    && text.includes('Love the business of Luxury?')
    && text.includes('Join Us!')
    && text.includes('BROWSE OPPORTUNITIES')
    && text.includes(CAREERS_EMAIL)
}

export const extractLinkedInJobsUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<a\b[^>]*href="(https:\/\/www\.linkedin\.com\/jobs\/search\/[^"]+)"[^>]*>\s*BROWSE OPPORTUNITIES\s*<\/a>/i,
  )

  if (!match?.[1]) return null

  try {
    return new URL(decodeHtmlEntities(match[1])).toString()
  } catch {
    return null
  }
}

export const isVerifiedLinkedInJobsUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://www.linkedin.com'
      && url.pathname === '/jobs/search/'
      && (url.searchParams.get('f_C') ?? '').split(',').includes(LINKEDIN_COMPANY_ID)
  } catch {
    return false
  }
}

export const hasVisiblePublicJobsContract = (html = '') => {
  const visiblePage = String(html ?? '')

  return /https?:\/\/(?:jobs\.lever\.co|boards(?:-api)?\.[^"' ]*greenhouse|[^"' ]*myworkdayjobs\.com|[^"' ]*workdayjobs\.com|[^"' ]*smartrecruiters\.com|[^"' ]*jobvite\.com|[^"' ]*ashbyhq\.com)/i.test(visiblePage)
    || /\bjob-card\b/i.test(visiblePage)
    || /\bopening-card\b/i.test(visiblePage)
    || /\bcurrent openings\b/i.test(visiblePage)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'purplestylelabs-html',
  timeoutMs: 15000,
})

export const createPurpleStyleLabsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Purple Style Labs verified official careers page changed materially')
    }

    const linkedInJobsUrl = extractLinkedInJobsUrl(careersHtml)
    if (!isVerifiedLinkedInJobsUrl(linkedInJobsUrl)) {
      throw new Error('Purple Style Labs verified LinkedIn jobs handoff changed materially')
    }

    if (hasVisiblePublicJobsContract(careersHtml)) {
      throw new Error('Purple Style Labs public jobs surface detected on the official careers page')
    }

    return []
  },
})

export const run = async (options = {}) => createPurpleStyleLabsScraper(options).run(options)

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
