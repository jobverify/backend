import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lucidledger'
export const COMPANY = 'Lucid Ledger'
export const VERIFIED_AT = '2026-07-13'
export const HOMEPAGE_URLS = [
  'https://lucidledger.com/',
  'https://www.lucidledger.com/',
]
export const SITEMAP_URLS = [
  'https://lucidledger.com/sitemap.xml',
  'https://www.lucidledger.com/sitemap.xml',
]
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://lucidledger.com/careers',
  'https://www.lucidledger.com/careers',
  'https://lucidledger.com/jobs',
  'https://www.lucidledger.com/jobs',
  'https://lucidledger.com/join-us',
  'https://www.lucidledger.com/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bjob description\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /freshteam/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
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
    redirect: 'follow',
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

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasConnectYourDomainSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*ConnectYourDomain Error \| Wix\.com\s*<\/title>/i.test(page)
    && /<meta\s+name=["']robots["']\s+content=["']noindex["']/i.test(page)
    && /errorCode:\s*['"]ConnectYourDomain['"]/i.test(page)
    && /serverErrorCode:\s*['"]404['"]/i.test(page)
    && /brand:\s*['"]wix['"]/i.test(page)
    && /window\.__ERROR_DATA__\s*=\s*{/i.test(page)
    && /static\.parastorage\.com\/services\/classic-error-pages-statics/i.test(page)
    && normalized.includes('ConnectYourDomain Error | Wix.com')
  }

export const isVerifiedConnectYourDomainPage = (page = {}) =>
  Number(page?.status) === 404
  && hasConnectYourDomainSignal(page?.html)
  && !hasPublicJobsSignal(page?.html)

export const createLucidLedgerScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of HOMEPAGE_URLS) {
      const page = await fetchPage(url)

      if (!isVerifiedConnectYourDomainPage(page)) {
        throw new Error(`Lucid Ledger verified homepage shell changed: ${page.url || url}`)
      }
    }

    for (const url of SITEMAP_URLS) {
      const page = await fetchPage(url)

      if (!isVerifiedConnectYourDomainPage(page)) {
        throw new Error(`Lucid Ledger verified sitemap shell changed: ${page.url || url}`)
      }
    }

    for (const url of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const page = await fetchPage(url)

      if (!isVerifiedConnectYourDomainPage(page)) {
        throw new Error(`Lucid Ledger verified no-public-careers route changed: ${page.url || url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createLucidLedgerScraper().run(options)

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
