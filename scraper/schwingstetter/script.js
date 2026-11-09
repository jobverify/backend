import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'schwingstetter'
export const COMPANY = 'Schwing Stetter'
export const CAREERS_URL = 'https://schwing-stetter.com/de_de/unternehmen/ausbildung-karriere.html'
export const STETTER_BOARD_URL =
  'https://schwing-stetter.com/de_de/unternehmen/ausbildung-karriere/stetter/stellenboerse.html'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeGermanComparable = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/ä/g, 'ae')
  .replace(/ö/g, 'oe')
  .replace(/ü/g, 'ue')
  .replace(/ß/g, 'ss')

const includesAll = (value, fragments) => {
  const normalized = normalizeGermanComparable(value)
  return fragments.every((fragment) => normalized.includes(normalizeGermanComparable(fragment)))
}

export const hasOfficialCareersSignal = (html) =>
  (() => {
    const normalized = normalizeGermanComparable(html)

    return normalized.includes(normalizeGermanComparable('ausbildung & karriere'))
      && normalized.includes(normalizeGermanComparable('weltweit beschaeftigen wir mehr als 3.000 mitarbeiter'))
      && normalized.includes(normalizeGermanComparable('finden sie ihren job auf unserer stellenboerse'))
      && normalized.includes('bewerbung@schwing.de')
      && normalized.includes(normalizeGermanComparable('stetter'))
      && normalized.includes(normalizeGermanComparable('stellenboerse'))
  })()

export const hasOfficialStetterBoardSignal = (html) =>
  includesAll(html, [
    'stetter gmbh',
    'dr.-karl-lenz-strasse 70',
    '87700 memmingen / germany',
    'info@stetter.de',
    'copyright © 2024 schwing gmbh / stetter gmbh',
  ])

const PUBLIC_JOB_LISTING_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workable\.com/i,
  /smartrecruiters/i,
  /workdayjobs/i,
  /\/jobs\/[a-z0-9-]+/i,
  /\/karriere\/[a-z0-9-]+/i,
  /\/stellenboerse\/[a-z0-9-]+/i,
  /\bapply now\b/i,
  /\bjetzt bewerben\b/i,
  /\bstellenangebot\b/i,
  /\bstellenangebote\b/i,
  /\boffene stellen\b/i,
  /\bjob openings\b/i,
  /\bopen positions\b/i,
]

export const pageExposesPublicJobListings = (html) =>
  PUBLIC_JOB_LISTING_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const extractStetterRoleUrls = (html) => {
  const page = String(html ?? '')
  const hrefs = [...page.matchAll(/<td\s+class=["']title["']>\s*<a\b[^>]*href=["']([^"']+)["']/gi)]
    .map((match) => match[1].replace(/&amp;/g, '&'))
  const urls = [...new Set(hrefs)]
  const expectedPrefix = new URL(STETTER_BOARD_URL).pathname.replace(/\.html$/, '/')
  if (hrefs.length !== urls.length || urls.some((href) => {
    const url = new URL(href, STETTER_BOARD_URL)
    return url.origin !== new URL(STETTER_BOARD_URL).origin
      || !url.pathname.startsWith(expectedPrefix)
      || !url.pathname.endsWith('.html')
  })) {
    throw new Error('Schwing Stetter board contains unexpected or duplicate job links')
  }
  return urls.map((href) => new URL(href, STETTER_BOARD_URL).toString())
}

const isVerifiedMemmingenRole = (html) => {
  const page = String(html ?? '')
  return /<title>[^<]+<\/title>/i.test(page)
    && normalizeWhitespace(page).includes('Erste Tätigkeitsstätte ist der Firmensitz der Stetter GmbH in Memmingen.')
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSchwingStetterScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Schwing Stetter verified official careers surface changed')
    }

    const stetterBoardHtml = await fetchText(STETTER_BOARD_URL)
    if (!hasOfficialStetterBoardSignal(stetterBoardHtml)) {
      throw new Error('Schwing Stetter verified official Stetter board changed')
    }

    const roleUrls = extractStetterRoleUrls(stetterBoardHtml)
    if (pageExposesPublicJobListings(stetterBoardHtml) && roleUrls.length === 0) {
      throw new Error('Schwing Stetter board exposes unrecognized public job listings')
    }

    for (const roleUrl of roleUrls) {
      const detailHtml = await fetchText(roleUrl)
      if (!isVerifiedMemmingenRole(detailHtml)) {
        throw new Error('Schwing Stetter role location is no longer verified as Memmingen, Germany')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSchwingStetterScraper().run(options)

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
