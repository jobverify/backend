import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'daffodilsoftware'
export const COMPANY = 'Daffodil Software'
export const VERIFIED_AT = '2026-07-14'
export const HOMEPAGE_URL = 'https://www.daffodilsw.com/'
export const CAREER_URL = 'https://www.daffodilsw.com/career/'
export const CAREERS_REDIRECT_URL = 'https://www.daffodilsw.com/careers/'
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://www.daffodilsw.com/jobs/',
  'https://www.daffodilsw.com/join-us/',
  'https://www.daffodilsw.com/work-with-us/',
  'https://www.daffodilsw.com/open-vacancies/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => String(value ?? '')
  .replace(/\/+$/, '')
  .toLowerCase()

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Software Development Company \| Daffodil Software\s*<\/title>/i.test(page)
    && /Career\s*&(?:amp;)?\s*Culture/i.test(page)
    && /href=["']https:\/\/www\.daffodilsw\.com\/career\/?["']/i.test(page)
}

export const hasOfficialCareerPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const title = normalizeWhitespace((page.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1])

  return title === 'Careers & Culture at Daffodil Software'
    && normalized.includes('Open Vacancies')
    && (
      normalized.includes('Lorem Ipsum is simply dummy text of the printing and typesetting industry.')
      || normalized.includes('No career opportunities available at this time.')
      || normalized.includes('Unable to retrieve career opportunities. Please try again later.')
    )
    && normalized.includes("Submit your CV, we will contact you as soon as we have relevant openings")
    && normalized.includes('Sales')
    && normalized.includes('Marketing')
    && normalized.includes('Developer')
    && normalized.includes('Attach your CV')
}

export const hasPublicJobBoardSignal = (html) => {
  const page = String(html ?? '')

  return /<a[^>]+href=["'][^"']*\/(?:jobs?|careers?)\/[^"']+["'][^>]*>[\s\S]*?(?:Apply now|Apply Now|View Details)/i.test(page)
    || /<article\b/i.test(page)
    || /\bCurrent Openings\b/i.test(page)
    || /\bOpen Positions\b/i.test(page)
    || /<a[^>]*>\s*Apply now\s*<\/a>/i.test(page)
}

export const isVerifiedMissingPublicJobRoute = (page = {}) =>
  Number(page.status) === 404 && !hasPublicJobBoardSignal(page.html)

export const isVerifiedCareerRedirect = (page = {}) =>
  Number(page.status) === 200
  && normalizeUrl(page.url) === normalizeUrl(CAREER_URL)
  && hasOfficialCareerPageSignal(page.html)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createDaffodilSoftwareScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Daffodil Software verified official homepage no longer matches the trusted first-party surface')
    }

    const careerPage = await fetchPage(CAREER_URL)
    if (careerPage.status !== 200 || !hasOfficialCareerPageSignal(careerPage.html)) {
      throw new Error('Daffodil Software verified career page no longer matches the trusted first-party placeholder surface')
    }

    if (hasPublicJobBoardSignal(careerPage.html)) {
      throw new Error('Daffodil Software career page now exposes a public jobs surface')
    }

    const careersRedirectPage = await fetchPage(CAREERS_REDIRECT_URL)
    if (!isVerifiedCareerRedirect(careersRedirectPage)) {
      throw new Error('Daffodil Software careers redirect no longer resolves to the verified official placeholder careers page')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingPublicJobRoute(routePage)) {
        throw new Error(`Daffodil Software common job route changed materially or now exposes public jobs: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createDaffodilSoftwareScraper().run(options)

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
