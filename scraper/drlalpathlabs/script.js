import { fileURLToPath } from 'node:url'

export const CAREER_PAGE_URL = 'https://www.lalpathlabs.com/career/submit-your-cv'

export const validateNoOpeningsPage = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Submit Your CV to Dr Lal PathLabs\s*<\/title>/i.test(page)
    && /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.lalpathlabs\.com\/career\/submit-your-cv["'][^>]*>/i.test(page)
    && /Find a Job\s*&amp;\s*Grow Your Career/i.test(page)
    && /Attach your Updated Resume,?\s*Max size 2MB/i.test(page)
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createDrLalPathlabsScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(CAREER_PAGE_URL)

    if (!validateNoOpeningsPage(html)) {
      throw new Error('Dr Lal PathLabs careers page no longer exposes the expected no-openings page shape')
    }

    return []
  },
})

export const run = async () => createDrLalPathlabsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await run()
  console.log(`Dr Lal PathLabs jobs scraped: ${jobs.length}`)
}
