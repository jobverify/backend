import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const HOMEPAGE_URL = 'https://www.optym.com/'
export const CAREERS_URL = 'https://www.optym.com/careers'

const PUBLIC_LISTING_PATTERN = /<(?:article|li|div|section)[^>]+(?:job[-\s_]?(?:card|listing|result)|career[-\s_]?(?:listing|opening)|opening[-\s_]?(?:card|item)|position[-\s_]?(?:card|item))[^>]*>|<a[^>]+href=["'][^"']*(?:jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|\/(?:jobs|careers)\/[^"']+)["'][^>]*>[^<]*(?:apply|view|details|role|opening)|\b(?:current openings?|job openings?|requisition id|job id)\b/i

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Transportation\s+Optimization\s+Software\s*\|\s*Optym\s*<\/title>/i.test(page)
    && /The best move,\s*out of billions\./i.test(page)
    && /We help transportation companies across road and rail make better decisions about their freight/i.test(page)
    && /drivers routed daily/i.test(page)
    && /Roadrunner/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers at Optym\s*\|\s*Join Our Team\s*<\/title>/i.test(page)
    && /Build your career in logistics technology\. Explore open roles and see how you can help optimize global transportation at Optym\./i.test(page)
    && /Optym is where amazing people \(like you\) do their best work\./i.test(page)
    && /Optymers around the world/i.test(page)
    && /See open roles/i.test(page)
}

export const pageExposesPublicJobListings = (html) => (
  PUBLIC_LISTING_PATTERN.test(String(html ?? ''))
)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'optym',
  timeoutMs: 15000,
})

export const createOptymScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Optym homepage no longer matches the verified official public site')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Optym careers page no longer matches the verified official public site shape')
    }

    if (pageExposesPublicJobListings(careersHtml)) {
      throw new Error('Optym careers page now appears to expose public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createOptymScraper().run(options)
