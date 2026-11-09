export const CAREER_PAGE_URL = 'https://www.bsesdelhi.com/'

const BRPL_LINK_PATTERN = /href=["'][^"']*\/web\/brpl\/?["'][^>]*>\s*BSES Rajdhani Power (?:Ltd|Limited)/i
const BYPL_LINK_PATTERN = /href=["'][^"']*\/web\/bypl\/?["'][^>]*>\s*BSES Yamuna Power (?:Ltd|Limited)/i

const normalizeWhitespace = (value) => String(value || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const PUBLIC_JOBS_SIGNAL_PATTERN =
  /\b(current openings|open positions?|job openings?|careers?|apply now|vacanc(?:y|ies))\b/i

export const hasOfficialBsesPageShape = (html) => {
  const page = String(html || '')
  const normalized = normalizeWhitespace(page)
  const hasBrplSurface =
    BRPL_LINK_PATTERN.test(page)
    || /BSES Rajdhani Power (?:Ltd|Limited)/i.test(normalized)
  const hasByplSurface =
    BYPL_LINK_PATTERN.test(page)
    || /BSES Yamuna Power (?:Ltd|Limited)/i.test(normalized)

  return /<title>\s*BSES\s*<\/title>/i.test(page)
    && /Home\s*-\s*BSES/i.test(page)
    && hasBrplSurface
    && hasByplSurface
    && !PUBLIC_JOBS_SIGNAL_PATTERN.test(normalized)
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createBsesScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const pageHtml = await fetchText(CAREER_PAGE_URL)

    if (!hasOfficialBsesPageShape(pageHtml)) {
      throw new Error('BSES official landing page shape changed; refusing to assume no public openings')
    }

    return []
  },
})

export const run = async () => createBsesScraper().run()
