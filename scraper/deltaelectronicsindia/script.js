import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const CAREER_PAGE_URL = 'https://www.deltaelectronicsindia.com/en-IN/career/Jobs-Application'

export const validateNoOpeningsPage = (html) => {
  const page = String(html ?? '')

  return /Let's Create a Better Tomorrow to Careers/i.test(page)
    && /(?:href=["'][^"']*\/career\/Jobs[^"']*["'][^>]*>\s*Jobs\s*<|>\s*Jobs\s*<)/i.test(page)
    && /please read and accept Privacy/i.test(page)
    && /<form\b/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    Accept: 'text/html,application/xhtml+xml',
  },
  label: 'deltaelectronicsindia',
  timeoutMs: 15000,
})

export const createDeltaElectronicsIndiaScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(CAREER_PAGE_URL)

    if (!validateNoOpeningsPage(html)) {
      throw new Error('Delta Electronics India careers page no longer exposes the expected no-openings page shape')
    }

    return []
  },
})

export const run = async () => createDeltaElectronicsIndiaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await run()
  console.log(`Delta Electronics India jobs scraped: ${jobs.length}`)
}
