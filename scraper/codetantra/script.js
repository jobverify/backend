export const CAREER_PAGE_URL = 'https://codetantra.com/'
export const CAREERS_ROUTE_URL = 'https://codetantra.com/careers/'
export const JOBS_ROUTE_URL = 'https://codetantra.com/jobs/'

const OFFICIAL_TITLE_PATTERN = /<title>\s*Teach\s*&\s*Learn\s*Anywhere\s*-\s*CodeTantra\s*<\/title>/i
const OFFICIAL_SUPPORT_PATTERN = /support@codetantra\.com|\+91\s*799\s*541\s*7777/i
const OFFICIAL_NAV_PATTERN = /about-us\.jsp|contact-us\.jsp|learn\.codetantra\.com\/login\.jsp/i
const CAREERS_SIGNAL_PATTERN = /\b(career|careers|job|jobs|hiring|opening|openings|join us)\b/i
const MISSING_ROUTE_PATTERN = /\b(page not found|requested resource not found|error 404)\b/i

export const buildSearchUrl = () => CAREER_PAGE_URL

export const hasOfficialSiteSignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_TITLE_PATTERN.test(page)
    && OFFICIAL_SUPPORT_PATTERN.test(page)
    && OFFICIAL_NAV_PATTERN.test(page)
}

export const hasCareersSignal = (html) => CAREERS_SIGNAL_PATTERN.test(String(html ?? ''))

export const isMissingCareerRoute = (html) => MISSING_ROUTE_PATTERN.test(String(html ?? ''))

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return response.text()
}

export const createCodetantraScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(CAREER_PAGE_URL)

    if (!hasOfficialSiteSignal(homepageHtml)) {
      throw new Error('CodeTantra official homepage signal missing; refusing to assume no public listings')
    }

    const careersHtml = await fetchText(CAREERS_ROUTE_URL)
    const jobsHtml = await fetchText(JOBS_ROUTE_URL)

    if (isMissingCareerRoute(careersHtml) && isMissingCareerRoute(jobsHtml)) {
      return []
    }

    if (
      !hasCareersSignal(homepageHtml)
      && !hasCareersSignal(careersHtml)
      && !hasCareersSignal(jobsHtml)
    ) {
      return []
    }

    throw new Error('CodeTantra public careers surface changed; minimal no-listings scraper needs review')
  },
})

export const run = async () => createCodetantraScraper().run()
