export const HOMEPAGE_URL = 'https://www.tvsholdings.com/'
export const CAREERS_PAGE_URL = 'https://www.tvsholdings.com/careers/'
export const CAREER_PAGE_URL = 'https://www.tvsholdings.com/career/'
export const JOBS_PAGE_URL = 'https://www.tvsholdings.com/jobs/'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialSiteSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('tvs holdings limited')
    && normalized.includes('formerly sundaram-clayton limited')
    && normalized.includes('contact us')
}

export const hasMissingCareersRouteSignal = ({ status }) => status === 404

export const createSundaramClaytonScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (!hasOfficialSiteSignal(homepage.html)) {
      throw new Error(
        'TVS Holdings homepage no longer matches the verified Sundaram Clayton official site signal',
      )
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    const careerPage = await fetchPage(CAREER_PAGE_URL)
    const jobsPage = await fetchPage(JOBS_PAGE_URL)

    if (
      !hasMissingCareersRouteSignal(careersPage)
      || !hasMissingCareersRouteSignal(careerPage)
      || !hasMissingCareersRouteSignal(jobsPage)
    ) {
      throw new Error(
        'TVS Holdings now exposes a public careers route for Sundaram Clayton; scraper needs an update',
      )
    }

    return []
  },
})

export const run = async () => createSundaramClaytonScraper().run()
