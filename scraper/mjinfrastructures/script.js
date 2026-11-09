import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mjinfrastructures'
export const COMPANY = 'M. J. Infrastructures'
export const HOMEPAGE_URL = 'https://mjinfrastructure.com/'
export const CONTACT_PAGE_URL = 'https://mjinfrastructure.com/contact'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://mjinfrastructure.com/careers',
  'https://mjinfrastructure.com/career',
  'https://mjinfrastructure.com/jobs',
  'https://mjinfrastructure.com/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

  return /<title[^>]*>\s*MJ Infrastructure\s*<\/title>/i.test(rawHtml)
    && /<!--[\s\S]*?careers[\s\S]*?-->/i.test(rawHtml)
    && normalized.includes('MJ Infrastructure')
    && normalized.includes('Completed Projects')
    && normalized.includes('Ongoing Projects')
    && normalized.includes('Upcoming Projects')
    && normalized.includes('+91 96863 00400')
}

export const hasContactPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*MJ Infrastructure\s*<\/title>/i.test(rawHtml)
    && /MJ INFRASTRUCTURE (?:&amp;|&) BUILDERS INDIA PVT\. LTD\./i.test(rawHtml)
    && normalized.includes('MJ INFRASTRUCTURE & BUILDERS INDIA PVT. LTD.')
    && normalized.includes('Corporate Office : Bangalore')
    && normalized.includes('Manipal County club Road Singasandra')
    && normalized.includes('Land Line : 080 40934338')
    && normalized.includes('+91 96863 00400')
}

export const isVerifiedMissingCareersRoute = (page = {}) =>
  Number(page?.status) === 404
  && /<title[^>]*>\s*404 Page Not Found\s*<\/title>/i.test(String(page?.html ?? ''))
  && normalizeWhitespace(page?.html) === '404 Page Not Found 404 Page Not Found The page you requested was not found.'

export const createMjInfrastructuresScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('M. J. Infrastructures verified official homepage no longer matches the known public surface')
    }

    const contactPage = await fetchPage(CONTACT_PAGE_URL)
    if (contactPage.status !== 200 || !hasContactPageSignal(contactPage.html)) {
      throw new Error('M. J. Infrastructures verified contact surface no longer matches the known legal-entity page')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareersRoute(routePage)) {
        throw new Error(`M. J. Infrastructures verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMjInfrastructuresScraper().run(options)

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
