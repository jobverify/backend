import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'madhujayantiinternationalpvtltd'
export const COMPANY = 'Madhu Jayanti International Pvt Ltd'
export const HOME_URL = 'https://jaytea.com/'
export const CAREERS_URL = 'https://jaytea.com/careers.php'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const VISIBLE_PUBLIC_LISTING_PATTERNS = [
  /\bcurrently hiring for:\b/i,
  /<label>\s*title\s*<\/label>/i,
  /<label>\s*location\s*<\/label>/i,
  /<label>\s*brief description\s*<\/label>/i,
  /value=["']Apply Now["']/i,
  /id=["']job_vacancies_\d+["']/i,
  /id=["']applyform_\d+["']/i,
]

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /title=["']Madhu Jayanti International Pvt Ltd["']/i.test(page)
    && /alt=["']Madhu Jayanti International Pvt Ltd["']/i.test(page)
    && normalized.includes('nobody knows tea better')
    && normalized.includes('selling tea since since 1942')
    && normalized.includes('15 million cups a day')
    && normalized.includes('info@jaytea.com')
    && /<a[^>]*href=["']careers\.php["'][^>]*>\s*(?:<sup>\s*08\s*<\/sup>\s*)?career\s*<\/a>/i.test(page)
    && /<a[^>]*href=["']contact\.php["']/i.test(page)
}

export const hasOfficialCareersShellSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /title=["']Madhu Jayanti International Pvt Ltd["']/i.test(page)
    && /alt=["']Madhu Jayanti International Pvt Ltd["']/i.test(page)
    && normalized.includes('join the world of tea innovation')
    && normalized.includes('stay tuned for exciting career opportunities')
    && normalized.includes('join the tea revolution')
    && normalized.includes('cannot find your domain? drop your resume here:')
    && /form id=["']secondary_job_vacancies["']/i.test(page)
    && /id=["']cvupload["']/i.test(page)
}

export const extractHiddenPlaceholderListingsBlock = (html) => {
  const page = String(html ?? '')
  const startMatch = /<div[^>]*class=["'][^"']*\bdisplay_hide_table\b[^"']*["'][^>]*style=["'][^"']*display\s*:\s*none\s*;?[^"']*["'][^>]*>/i.exec(page)

  if (!startMatch) return null

  const divTagPattern = /<\/?div\b[^>]*>/gi
  divTagPattern.lastIndex = startMatch.index

  let depth = 0
  let tagMatch = null

  while ((tagMatch = divTagPattern.exec(page))) {
    if (/^<div\b/i.test(tagMatch[0])) {
      depth += 1
    } else {
      depth -= 1
    }

    if (depth === 0) {
      return page.slice(startMatch.index, divTagPattern.lastIndex)
    }
  }

  return null
}

export const hasHiddenPlaceholderJobBlockSignal = (html) => {
  const hiddenBlock = extractHiddenPlaceholderListingsBlock(html)
  if (!hiddenBlock) return false

  const normalized = normalizeWhitespace(hiddenBlock).toLowerCase()

  return normalized.includes('currently hiring for:')
    && normalized.includes('marketing manager')
    && normalized.includes('new york, ny')
    && normalized.includes('software engineer')
    && normalized.includes('san francisco, ca')
    && normalized.includes('human resources specialist')
    && normalized.includes('chicago, il')
    && /id=["']job_vacancies_1["']/i.test(hiddenBlock)
    && /id=["']job_vacancies_2["']/i.test(hiddenBlock)
    && /id=["']job_vacancies_3["']/i.test(hiddenBlock)
    && /value=["']Apply Now["']/i.test(hiddenBlock)
}

export const hasNoPublicJobListingsSignal = (html) => {
  const page = String(html ?? '')
  const hiddenBlock = extractHiddenPlaceholderListingsBlock(page)

  if (!hiddenBlock || !hasHiddenPlaceholderJobBlockSignal(page)) {
    return false
  }

  const visiblePage = page.replace(hiddenBlock, '')
  const normalized = normalizeWhitespace(visiblePage).toLowerCase()

  return normalized.includes('stay tuned for exciting career opportunities')
    && normalized.includes('cannot find your domain? drop your resume here:')
    && /form id=["']secondary_job_vacancies["']/i.test(visiblePage)
    && /id=["']user_name["']/i.test(visiblePage)
    && /id=["']user_email["']/i.test(visiblePage)
    && /id=["']user_phone["']/i.test(visiblePage)
    && /id=["']user_designation["']/i.test(visiblePage)
    && /id=["']cvupload["']/i.test(visiblePage)
    && !VISIBLE_PUBLIC_LISTING_PATTERNS.some((pattern) => pattern.test(visiblePage))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createMadhuJayantiInternationalScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOME_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error(
        'Madhu Jayanti official homepage no longer matches the verified first-party company surface',
      )
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersShellSignal(careersHtml)) {
      throw new Error(
        'Madhu Jayanti official careers page no longer matches the verified first-party shell',
      )
    }

    if (!hasNoPublicJobListingsSignal(careersHtml)) {
      throw new Error('Madhu Jayanti public careers surface now exposes job listings or changed shape')
    }

    return []
  },
})

export const run = async (options = {}) => createMadhuJayantiInternationalScraper().run(options)

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
