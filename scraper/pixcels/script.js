import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'pixcels'
export const COMPANY = 'Pi-xcels'
export const HOMEPAGE_URL = 'https://www.pi-xcels.com/'
export const PAGES_SITEMAP_URL = 'https://www.pi-xcels.com/pages-sitemap.xml'
export const CAREERS_CANDIDATE_PATHS = [
  '/careers',
  '/career',
  '/jobs',
  '/job-openings',
  '/join-us',
  '/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REQUIRED_HOMEPAGE_SIGNALS = [
  '<title>Pi-xcels | E-Receipt Platform for Retail</title>',
  'Instant NFC powered digital receipts',
  'Customer Intelligence Platform for Retailers.',
  'No App. Just Tap.',
  'https://www.pi-xcels.com/about',
  'https://www.pi-xcels.com/contact-us',
  'https://www.pi-xcels.com/news',
]

const REQUIRED_SITEMAP_URLS = [
  'https://www.pi-xcels.com',
  'https://www.pi-xcels.com/about',
  'https://www.pi-xcels.com/contact-us',
  'https://www.pi-xcels.com/news',
]

const PUBLIC_JOB_PATTERNS = [
  /\bcareers?\b/i,
  /\bjobs?\b/i,
  /\bjoin us\b/i,
  /\bwork with us\b/i,
  /\bopen(?:ing|ings)?\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bhiring\b/i,
  /\bjob description\b/i,
  /greenhouse/i,
  /lever/i,
  /ashby/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const NOT_FOUND_PATTERNS = [
  /\b404\b/i,
  /page not found/i,
  /could not be found/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const buildUrl = (pathName) => new URL(pathName, HOMEPAGE_URL).toString()

const extractSitemapUrls = (xml) => [
  ...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi),
].map((match) => normalizeWhitespace(match[1]))

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)
  return /Pi-xcels \| E-Receipt Platform for Retail/i.test(normalized)
    && normalized.includes('Instant NFC powered digital receipts')
    && normalized.includes('Customer Intelligence Platform for Retailers.')
    && normalized.includes('No App. Just Tap.')
    && /About Us/i.test(normalized)
    && /Contact Us/i.test(normalized)
    && /\bNews\b/i.test(normalized)
}

export const pageExposesPublicJobListings = (html) =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(normalizeWhitespace(html)))
  || /"@type"\s*:\s*"JobPosting"|boards\.greenhouse\.io|jobs\.lever\.co|workdayjobs|smartrecruiters|darwinbox/i
    .test(String(html ?? ''))

const candidateRouteLooksAbsent = ({ status, html }) =>
  Number(status) === 404 && NOT_FOUND_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedNoJobsSurface = ({
  homepageHtml,
  sitemapXml,
  candidatePages = [],
}) => {
  if (!hasOfficialHomepageSignal(homepageHtml)) return false
  if (pageExposesPublicJobListings(homepageHtml)) return false

  const sitemapUrls = extractSitemapUrls(sitemapXml)
  if (REQUIRED_SITEMAP_URLS.some((url) => !sitemapUrls.includes(url))) return false
  if (sitemapUrls.some((url) => PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(url)))) return false

  return candidatePages.every((page) => candidateRouteLooksAbsent(page) && !pageExposesPublicJobListings(page.html))
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    text: await response.text(),
  }
}

export const createPixcelsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    const sitemap = await fetchPage(PAGES_SITEMAP_URL)
    const candidatePathsToVerify = ['/careers', '/jobs']
    const candidatePages = []

    for (const pathName of candidatePathsToVerify) {
      const url = buildUrl(pathName)
      const page = await fetchPage(url)
      candidatePages.push({
        path: pathName,
        status: page.status,
        html: page.text,
      })
    }

    const isVerified = homepage.ok && sitemap.ok && isVerifiedNoJobsSurface({
      homepageHtml: homepage.text,
      sitemapXml: sitemap.text,
      candidatePages,
    })

    if (!isVerified) {
      throw new Error('Pi-xcels verified no-jobs public surface drifted or now exposes jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createPixcelsScraper().run(options)

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
