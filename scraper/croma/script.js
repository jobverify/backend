import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'croma'
export const COMPANY = 'Croma'
export const CAREERS_URL = 'https://www.croma.com/careers-at-croma/'
export const CURRENT_OPENINGS_URL = 'https://www.croma.com/current-opening/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_LINK_PATTERNS = [
  /href=["'][^"']*(?:greenhouse|lever|ashbyhq|workdayjobs|myworkdayjobs|smartrecruiters|jobvite|darwinbox|linkedin\.com\/jobs)[^"']*["']/i,
  /href=["'][^"']*\/(?:jobs?|careers\/jobs|positions?)\/[^"']+["']/i,
  /href=["'][^"']*\/current-opening\/[^"']+["']/i,
  /"@type"\s*:\s*"JobPosting"/i,
  /\b(?:req|requisition)\s*id\b/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/\\u002f/gi, '/')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeFirstPartyUrl = (value, baseUrl) => {
  try {
    const url = new URL(decodeHtmlEntities(String(value ?? '')).replace(/\\\//g, '/'), baseUrl)
    if (!url.pathname.endsWith('/')) {
      url.pathname = `${url.pathname}/`
    }
    return url.toString()
  } catch {
    return null
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const extractCurrentOpeningsUrl = (html) => {
  const page = String(html ?? '')
  const cmsMatch = page.match(
    /"uid"\s*:\s*"PWACurrentOpeningsLink"[\s\S]*?"url"\s*:\s*"((?:\\\/|[^"])*)"/i,
  )
  if (cmsMatch) {
    return normalizeFirstPartyUrl(cmsMatch[1], CAREERS_URL)
  }

  const hrefMatch = page.match(/href=["']([^"']*\/current-opening\/?)["']/i)
  if (hrefMatch) {
    return normalizeFirstPartyUrl(hrefMatch[1], CAREERS_URL)
  }

  return null
}

export const extractRecruiterEmails = (html) =>
  Array.from(
    new Set(
      (String(html ?? '').match(/\b[a-z0-9._%+-]+@croma\.com\b/gi) || [])
        .map((value) => value.replace(/^20(?=[a-z0-9._%+-]+@croma\.com$)/i, '').toLowerCase()),
    ),
  )

export const hasOfficialCareersLandingSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Career Opportunities at Croma \| Buy Electronic Appliances online \| Croma\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.croma\.com\/careers-at-croma\/["']/i.test(page)
    && normalized.includes('croma careers at croma')
    && normalized.includes('embodying tata culture & values')
    && normalized.includes('why join croma?')
    && normalized.includes('current openings')
    && normalized.includes('croma (infiniti retail limited) would like to inform all persons seeking employment')
    && normalized.includes('it never seeks nor solicits any payment for the purposes of recruitment')
    && extractCurrentOpeningsUrl(page) !== null
}

export const hasOfficialCurrentOpeningsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()
  const recruiterEmails = extractRecruiterEmails(page)

  return /<title>\s*Join Croma \| Job Openings at Croma\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.croma\.com\/current-opening\/["']/i.test(page)
    && normalized.includes('croma current openings')
    && normalized.includes('current openings/career opportunities')
    && normalized.includes('about croma')
    && normalized.includes('apply now')
    && normalized.includes('talent acquisition team')
    && normalized.includes('north')
    && normalized.includes('west')
    && normalized.includes('south')
    && recruiterEmails.length >= 5
    && recruiterEmails.includes('virendra.singh@croma.com')
    && recruiterEmails.includes('amit.parihar@croma.com')
    && recruiterEmails.includes('bhoomika.laniya@croma.com')
    && recruiterEmails.includes('priya.nair@croma.com')
    && recruiterEmails.includes('gayatri.g@croma.com')
}

export const hasPublicJobBoardSignal = (html) =>
  PUBLIC_JOB_LINK_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createCromaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersLandingHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersLandingSignal(careersLandingHtml)) {
      throw new Error('Croma verified Croma careers surface no longer matches the trusted first-party shell')
    }

    const currentOpeningsUrl = extractCurrentOpeningsUrl(careersLandingHtml)
    if (currentOpeningsUrl !== CURRENT_OPENINGS_URL) {
      throw new Error('Croma verified current openings handoff no longer matches the trusted first-party route')
    }

    const currentOpeningsHtml = await fetchText(currentOpeningsUrl)
    if (!hasOfficialCurrentOpeningsSignal(currentOpeningsHtml)) {
      throw new Error('Croma verified current openings handoff no longer matches the trusted recruiter-contact surface')
    }

    if (hasPublicJobBoardSignal(currentOpeningsHtml)) {
      throw new Error('Croma current openings page now appears to expose a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createCromaScraper().run(options)

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
