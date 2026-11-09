import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'in22labs'
export const COMPANY = 'in22Labs'
export const HOMEPAGE_URL = 'https://in22labs.com/'
export const SITEMAP_URL = 'https://in22labs.com/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://in22labs.com/careers',
  'https://in22labs.com/careers/',
  'https://in22labs.com/career',
  'https://in22labs.com/career/',
  'https://in22labs.com/jobs',
  'https://in22labs.com/jobs/',
  'https://in22labs.com/join-us',
  'https://in22labs.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_SIGNAL_PATTERN = /\b(career|careers|job|jobs|opening|openings|vacancy|vacancies|join us|join-us|work with us)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Leading GovTech AI Company in India \| In22 Labs \(Unit of Unwind Learning Labs Pvt Ltd\)\s*<\/title>/i.test(rawHtml)
    && /<meta\s+name="description"\s+content="Get growth insights for your business using In22 Labs \[GovTech AI Company\] Agentic AI solutions, Business Intelligence solutions, Data Analytics solutions and E-Governance Solutions\.">/i.test(rawHtml)
    && /<link\s+rel="canonical"\s+href="https:\/\/in22labs\.com"\s*\/?>/i.test(rawHtml)
    && /<meta\s+property="og:site_name"\s+content="In22 Labs">/i.test(rawHtml)
    && /"legalName":\s*"Unwind Learning Labs Private Limited"/i.test(rawHtml)
    && /info@in22labs\.com/i.test(rawHtml)
    && /linkedin\.com\/company\/in22-labs/i.test(rawHtml)
    && normalized.includes('The future of Data Analytics')
    && normalized.includes('Leading the future of Business Intelligence')
}

export const sitemapHasCareerLikeUrl = (xml) => {
  const matches = String(xml ?? '').match(/<loc>([^<]+)<\/loc>/gi) || []
  return matches.some((entry) => CAREERS_SIGNAL_PATTERN.test(entry))
}

export const isMissingCareerRoute = (page) => Number(page?.status) === 404

export const createIn22LabsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('in22Labs verified official homepage no longer matches the known public surface')
    }

    if (CAREERS_SIGNAL_PATTERN.test(homepage.html)) {
      throw new Error('in22Labs homepage now appears to expose a public careers signal')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || sitemapHasCareerLikeUrl(sitemap.html)) {
      throw new Error('in22Labs verified sitemap no longer matches the no-public-careers surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`in22Labs verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createIn22LabsScraper().run(options)

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
