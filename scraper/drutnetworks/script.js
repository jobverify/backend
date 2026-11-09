import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const CAREER_PAGE_URL = 'https://drut.com/'

export const validateNoOpeningsPage = (html) => {
  const page = String(html ?? '')
  const normalized = page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  return /<title>\s*Drut\s*<\/title>/i.test(page)
    && /\bHOME\b/i.test(normalized)
    && /\bABOUT\s+DRUT\b/i.test(normalized)
    && /\bCONTACT\s+US\b/i.test(normalized)
    && /\bFIND\s+A\s+DRUT\b/i.test(normalized)
    && /\bRisk\s*\|\s*Automate\s*\|\s*Compliance\b/i.test(normalized)
    && /\bWHAT\s+IS\s+DRUT\b/i.test(normalized)
    && /robotics-based\s+automation\s+GRC\s+platform/i.test(normalized)
    && /Copyright\s*[©Â]*\s*2026\s*-\s*drut\s*\|\s*All\s+Rights\s+Reserved/i.test(normalized)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    Accept: 'text/html,application/xhtml+xml',
  },
  label: 'drutnetworks',
  timeoutMs: 15000,
})

export const createDrutNetworksScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(CAREER_PAGE_URL)

    if (!validateNoOpeningsPage(html)) {
      throw new Error('Drut Networks careers page no longer exposes the expected no-openings page shape')
    }

    return []
  },
})

export const run = async () => createDrutNetworksScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await run()
  console.log(`Drut Networks jobs scraped: ${jobs.length}`)
}
