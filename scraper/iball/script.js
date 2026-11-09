import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { IBALL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = IBALL_CATALOG.source
export const COMPANY = IBALL_CATALOG.companyName
export const PROVIDER_METADATA = IBALL_CATALOG
export const HOMEPAGE_URL = IBALL_CATALOG.officialHomepageUrl
export const ABOUT_URL = IBALL_CATALOG.officialAboutUrl
export const NEWS_CENTER_URL = IBALL_CATALOG.officialNewsCenterUrl
export const COMMON_CAREERS_ROUTES = IBALL_CATALOG.commonCareerRoutes

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob listings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bview all positions\b/i,
  /\bjob description\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /darwinbox/i,
  /peoplestrong/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
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
  })

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    text: await response.text(),
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title>\s*iBall\s*(?:-|&ndash;|&#8211;|\u2013)\s*Electronics\s*&(?:amp;)?\s*Peripherals\s*<\/title>/i.test(rawHtml)
    && normalized.includes('our range')
    && normalized.includes('upgrade your digital lifestyle')
    && normalized.includes('about iball')
    && normalized.includes('news center')
    && normalized.includes('service centers')
}

export const hasOfficialAboutSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title>\s*About Us\s*(?:-|&ndash;|&#8211;|\u2013)\s*iBall\s*<\/title>/i.test(rawHtml)
    && normalized.includes('about iball')
    && normalized.includes('commitment to india')
    && normalized.includes('corporate office')
    && normalized.includes('enquiry@iball.co.in')
}

export const hasOfficialNewsCenterSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('press release')
    && normalized.includes('cinebar 560')
    && normalized.includes('glidr ai1')
    && normalized.includes('zebronics')
}

export const createIBallScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!homepage.ok || !hasOfficialHomepageSignal(homepage.text) || hasPublicJobsSignal(homepage.text)) {
      throw new Error('The official iBall homepage no longer matches the verified public surface')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (!aboutPage.ok || !hasOfficialAboutSignal(aboutPage.text) || hasPublicJobsSignal(aboutPage.text)) {
      throw new Error('The official iBall about page no longer matches the verified public surface')
    }

    const newsCenterPage = await fetchPage(NEWS_CENTER_URL)
    if (
      !newsCenterPage.ok
      || !hasOfficialNewsCenterSignal(newsCenterPage.text)
      || hasPublicJobsSignal(newsCenterPage.text)
    ) {
      throw new Error('The official iBall news center no longer matches the verified public surface')
    }

    for (const route of COMMON_CAREERS_ROUTES) {
      const page = await fetchPage(route)
      if (!page.ok) continue

      if (hasPublicJobsSignal(page.text)) {
        throw new Error('An iBall careers route now exposes a public jobs surface')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createIBallScraper().run(options)

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
