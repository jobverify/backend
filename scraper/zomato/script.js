import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.eternal.com/careers/'
export const LEGACY_CAREER_PAGE_URL = 'https://www.zomato.com/careers'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const buildSearchUrl = () => CAREER_PAGE_URL

export const pageIndicatesReferralOnlyHiring = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return (
    normalized.includes('only accept applications through employee referrals')
    || (
      normalized.includes('only accept applications through')
      && normalized.includes('employee referrals')
    )
  )
}

const extractCareersBundleUrl = (html) => {
  const match = String(html ?? '').match(/\/_astro\/careers\.[^"' ]+\.js|\/_astro\/careers[^"' ]*\.js/)
  if (!match) return null

  return new URL(match[0], CAREER_PAGE_URL).toString()
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createZomatoScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(buildSearchUrl())

    if (pageIndicatesReferralOnlyHiring(html)) {
      return []
    }

    const bundleUrl = extractCareersBundleUrl(html)
    if (bundleUrl) {
      const bundle = await fetchText(bundleUrl)

      if (pageIndicatesReferralOnlyHiring(bundle)) {
        return []
      }
    }

    throw new Error('Eternal careers page no longer exposes the expected referrals-only signal')
  },
})

export const run = async () => createZomatoScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Zomato scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'zomato')
    console.log('DB result:', result)
    process.exit(0)
  }
}
