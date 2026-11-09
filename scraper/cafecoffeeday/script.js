import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'

export const OPENINGS_URL = 'https://www.cafecoffeeday.com/careers/openings'
export const APPLY_URL = 'https://www.cafecoffeeday.com/careers/apply-now'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractListItem = (html, className) => {
  const match = String(html ?? '').match(
    new RegExp(`<li[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/li>`, 'i'),
  )
  return match?.[1] || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(/<ul\b[^>]*class="[^"]*animated[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi)]
  .flatMap((match) => {
    const openingHtml = match[1]
    const serialNumber = normalizeWhitespace(extractListItem(openingHtml, 'list-region'))
    const location = normalizeWhitespace(extractListItem(openingHtml, 'list-person'))
    const experienceRequired = normalizeWhitespace(extractListItem(openingHtml, 'list-email'))
    const rolesHtml = extractListItem(openingHtml, 'list-number')

    if (!/^\d+$/.test(serialNumber || '') || !location || !rolesHtml) return []

    return String(rolesHtml)
      .split(/<br\s*\/?>/gi)
      .map((role) => normalizeWhitespace(role))
      .filter(Boolean)
      .map((title) => {
        const roleSlug = slugify(title)
        const jobId = roleSlug ? `ccd-${serialNumber}-${roleSlug}` : null
        if (!jobId) return null

        return {
          title,
          company: 'Cafe Coffee Day',
          department: null,
          location: `${location}, India`,
          city: location,
          country: 'India',
          jobId,
          requisitionId: jobId,
          sourceUrl: `${OPENINGS_URL}#opening-${serialNumber}`,
          applyUrl: APPLY_URL,
          employmentType: null,
          experienceRequired,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          postingDate: null,
          closingDate: null,
          jobDescription: null,
          remoteStatus: 'On-site',
        }
      })
      .filter(Boolean)
  })

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'cafecoffeeday',
  timeoutMs: 15000,
})

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to verify the first certificate|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const createCafeCoffeeDayScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchBrowserText } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchText(url)
    })

    const fetchOpeningsText = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (!isBrowserFallbackError(error)) {
          throw error
        }

        return browserTextFetcher(url)
      }
    }

    try {
      const openingsHtml = await fetchOpeningsText(OPENINGS_URL)

      return extractSearchResults(openingsHtml).map((job) => ({
        ...job,
        source: 'cafecoffeeday',
        link: job.applyUrl,
        scrapedAt: new Date().toISOString(),
      }))
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async () => createCafeCoffeeDayScraper().run()
