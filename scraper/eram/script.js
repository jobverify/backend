import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const HOMEPAGE_URL = 'https://eramholdings.com/'
export const CAREER_PAGE_URL = 'https://eramholdings.com/career.php'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export const validateCareerHomepage = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Eram Holdings\s*<\/title>/i.test(page)
    && /href=["']career\.php["'][^>]*>\s*Careers\s*<\/a>/i.test(page)
    && /Al Khobar,\s*Saudi Arabia/i.test(page)
}

export const validateNoOpeningsPage = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Eram Holdings\s*<\/title>/i.test(page)
    && /href=["']career\.php["'][^>]*>\s*Careers\s*<\/a>/i.test(page)
    && /Reason To Join Eram Holdings/i.test(page)
    && /We Work Together/i.test(page)
    && /Guaranteed career progress/i.test(page)
    && /ajax_contact\(event\)/i.test(page)
    && /php_functionCarrier\.php/i.test(page)
    && /captcha/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'eram',
  timeoutMs: 15000,
})

export const createEramScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!validateCareerHomepage(homepageHtml)) {
      throw new Error('ERAM homepage no longer matches the verified official careers surface')
    }

    const careerPageHtml = await fetchText(CAREER_PAGE_URL)

    if (!validateNoOpeningsPage(careerPageHtml)) {
      throw new Error('ERAM careers page no longer exposes the expected no-openings page shape')
    }

    return []
  },
})

export const run = async () => createEramScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await run()
  console.log(`ERAM jobs scraped: ${jobs.length}`)
}
