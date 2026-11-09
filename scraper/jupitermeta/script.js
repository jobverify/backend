import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'jupitermeta'
export const COMPANY = 'Jupiter Meta'
export const VERIFIED_AT = '2026-07-13'
export const HOMEPAGE_URL = 'https://jupitermeta.io/'
export const CONTACT_URL = 'https://jupitermeta.io/contact'
export const CAREER_PATHS = [
  'https://jupitermeta.io/careers',
  'https://jupitermeta.io/career',
  'https://jupitermeta.io/jobs',
  'https://jupitermeta.io/join-us',
  'https://jupitermeta.io/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_TITLE_PATTERN = /<title>\s*Jupiter Meta\s*<\/title>/i
const HOMEPAGE_OG_TITLE_PATTERN = /<meta[^>]+property=["']og:title["'][^>]+content=["']Jupiter Meta["']/i
const HOMEPAGE_DESCRIPTION_PATTERN =
  /<meta[^>]+name=["']description["'][^>]+content=["'][^"']*Data Monetisation[^"']*Data Security[^"']*DIDs[^"']*["']/i
const CONTACT_SIGNAL_PATTERN = /\bcontact us\b|\bour team will get back to you\b/i
const HOMEPAGE_CAREERS_PATTERN = /\b(career|careers|jobs|join us|join our team|openings|vacancies)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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
    url: response.url || url,
    html: await response.text(),
    errorMessage: '',
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const value = String(html ?? '')
  return HOMEPAGE_TITLE_PATTERN.test(value)
    && HOMEPAGE_OG_TITLE_PATTERN.test(value)
    && HOMEPAGE_DESCRIPTION_PATTERN.test(value)
}

export const hasHomepageCareersSignal = (html) =>
  HOMEPAGE_CAREERS_PATTERN.test(normalizeWhitespace(html).toLowerCase())

export const hasOfficialContactSignal = (html) =>
  HOMEPAGE_TITLE_PATTERN.test(String(html ?? ''))
  && CONTACT_SIGNAL_PATTERN.test(normalizeWhitespace(html).toLowerCase())

export const hasMissingCareersRouteSignal = ({ status, html }) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return Number(status) === 404
    && (
      normalized === ''
      || (
        normalized.includes('404')
        && normalized.includes('this page could not be found')
      )
    )
}

export const createJupiterMetaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Jupiter Meta homepage no longer matches the verified official public surface')
    }

    if (hasHomepageCareersSignal(homepage.html)) {
      throw new Error('Jupiter Meta homepage now shows a public careers signal')
    }

    const contactPage = await fetchPage(CONTACT_URL)

    if (!hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Jupiter Meta contact page no longer matches the verified first-party public surface')
    }

    for (const url of CAREER_PATHS) {
      const page = await fetchPage(url)

      if (!hasMissingCareersRouteSignal(page)) {
        throw new Error(`Jupiter Meta public careers surface changed: ${page.url || url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createJupiterMetaScraper().run(options)

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
