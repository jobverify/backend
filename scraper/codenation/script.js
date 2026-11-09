import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'codenation'
export const COMPANY = 'Code Nation'
export const VERIFIED_ON = '2026-07-14'
export const VERIFIED_SURFACE_SUMMARY =
  'No trustworthy public jobs surface was discoverable on July 14, 2026; the verified first-party Code Nation homepage was a NationBuilder marketing site, the sitemap exposed no jobs URLs, and the /careers and /jobs routes returned stable 404 shells.'
export const HOMEPAGE_URL = 'https://www.codenation.com/'
export const SITEMAP_URL = 'https://www.codenation.com/sitemap.xml'
export const CAREERS_URLS = [
  'https://www.codenation.com/careers',
  'https://www.codenation.com/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_REQUIRED_SIGNALS = [
  'technology for changemakers',
  'get expert advice',
  'newsletter',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bcareer opportunities\b/i,
  /\bjoin our team\b/i,
  /\bwork with us\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'manual',
  })

  return {
    status: response.status,
    url,
    location: response.headers.get('location') ?? '',
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return HOMEPAGE_REQUIRED_SIGNALS.every((signal) => normalized.includes(signal))
    && /codenation\.nationbuilder\.com/i.test(rawHtml)
    && /<title>\s*Code Nation - the award winning digital agency for progressive causes and organisations\s*<\/title>/i.test(rawHtml)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedSitemapSignal = (xml) => {
  const rawXml = String(xml ?? '')
  const normalized = normalizeText(rawXml)

  return /<urlset\b/i.test(rawXml)
    && normalized.includes('https://www.codenation.com/')
    && !hasPublicJobsSignal(rawXml)
    && !/\bhttps:\/\/www\.codenation\.com\/(careers|jobs)\b/i.test(rawXml)
}

export const isVerifiedMissingCareersRoute = (status, html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return status === 404
    && /404\.png/i.test(rawHtml)
    && normalized.includes('code nation')
    && normalized.includes('need expert support for your next campaign')
    && normalized.includes('get expert advice')
}

export const createCodenationScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Code Nation verified official homepage no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Code Nation homepage now appears to expose a public jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)

    if (sitemap.status !== 200 || !hasVerifiedSitemapSignal(sitemap.html)) {
      throw new Error('Code Nation verified sitemap no longer matches the trusted no-public-jobs surface')
    }

    for (const careersUrl of CAREERS_URLS) {
      const careersPage = await fetchPage(careersUrl)

      if (hasPublicJobsSignal(careersPage.html) || hasPublicJobsSignal(careersPage.location)) {
        throw new Error(`Code Nation careers route ${careersUrl} now appears to expose a public jobs surface`)
      }

      if (!isVerifiedMissingCareersRoute(careersPage.status, careersPage.html)) {
        throw new Error(`Code Nation verified missing careers route changed materially: ${careersUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createCodenationScraper().run(options)

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
