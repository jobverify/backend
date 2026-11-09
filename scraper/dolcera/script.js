export const CAREER_PAGE_URL = 'https://web.dolcera.com/'

const hasPublicCareersLink = (html) => /href\s*=\s*["'][^"']*(?:careers?|jobs?)[^"']*["']/i.test(html)

export const validateNoOpeningsPage = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Dolcera\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/dolcera\.com\/?["']/i.test(page)
    && /<meta[^>]+name=["']author["'][^>]+content=["']Dolcera["']/i.test(page)
    && /aria-label=["']Primary["']/i.test(page)
    && /AI-native IP services firm/i.test(page)
    && /href=["']#services["']/i.test(page)
    && /href=["']#leadership["']/i.test(page)
    && /href=["']#contact["']/i.test(page)
    && !hasPublicCareersLink(page)
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

export const createDolceraScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(CAREER_PAGE_URL)

    if (!validateNoOpeningsPage(html)) {
      throw new Error('Dolcera careers page no longer exposes the expected no-openings page shape')
    }

    return []
  },
})

export const run = async (options = {}) => createDolceraScraper().run(options)
