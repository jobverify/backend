import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'intevaproducts'
export const COMPANY = 'Inteva Products'
export const CAREERS_URL = 'https://www.intevaproducts.com/careers/apply-online/'
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERNS = [
  /\bindia\b/i,
  /\bpune\b/i,
  /\bbangalore\b/i,
  /\bbengaluru\b/i,
  /\bmaharashtra\b/i,
  /\bkarnataka\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

export const extractEmbeddedJobsUrl = (html) => {
  const match = String(html ?? '').match(
    /<iframe[^>]+(?:data-src|src)=["'](https:\/\/www\.appone\.com\/branding\/reqtemplate\/default\.asp\?servervar=IntevaProducts\.appone\.com)["']/i,
  )

  return match?.[1] ?? null
}

export const hasOfficialCareersPage = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Search Open Positions\s*-\s*Inteva Products\s*<\/title>/i.test(page)
    && /Use our search engine below to view current opportunities and apply online\./i.test(page)
    && extractEmbeddedJobsUrl(page) !== null
}

export const extractLocationOptions = (html) => {
  const selectMatch = String(html ?? '').match(
    /<select[^>]+name=["']LocationID["'][^>]*>([\s\S]*?)<\/select>/i,
  )

  if (!selectMatch) return []

  return [...selectMatch[1].matchAll(/<option[^>]*value=["']?([^"'>\s]+)[^>]*>([\s\S]*?)<\/option>/gi)]
    .map(([, value, label]) => ({
      value: normalizeWhitespace(value),
      label: normalizeWhitespace(label.replace(/<[^>]+>/g, ' ')),
    }))
    .filter((option) => option.value && option.value !== '0' && option.label)
}

export const hasIndiaLocationOptions = (options = []) => options.some((option) =>
  INDIA_LOCATION_PATTERNS.some((pattern) => pattern.test(option?.label ?? '')))

export const hasVerifiedApponeLandingPage = (html) => {
  const page = String(html ?? '')
  const locationOptions = extractLocationOptions(page)

  return /<title>\s*Inteva Products,\s*LLC Career Site\s*<\/title>/i.test(page)
    && /name=["']ServerVar["']\s*\/?>/i.test(page)
    && /value=["']IntevaProducts\.appone\.com["']/i.test(page)
    && /BrowseAllJobsbyLocation\.asp\?ServerVar=IntevaProducts\.appone\.com/i.test(page)
    && locationOptions.length > 0
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createIntevaProductsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersPage = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersPage(careersPage)) {
      throw new Error('Inteva Products verified official careers page no longer matches the known public surface')
    }

    const embeddedJobsUrl = extractEmbeddedJobsUrl(careersPage)
    if (!embeddedJobsUrl) {
      throw new Error('Inteva Products official careers page no longer exposes the verified embedded jobs board')
    }

    const apponeLandingPage = await fetchText(embeddedJobsUrl)

    if (!hasVerifiedApponeLandingPage(apponeLandingPage)) {
      throw new Error('Inteva Products verified public AppOne board no longer matches the known public surface')
    }

    const locationOptions = extractLocationOptions(apponeLandingPage)
    if (hasIndiaLocationOptions(locationOptions)) {
      throw new Error('Inteva Products public AppOne board now exposes India locations')
    }

    return []
  },
})

export const run = async (options = {}) => createIntevaProductsScraper().run(options)

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
