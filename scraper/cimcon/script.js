import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

export const SOURCE = 'cimcon'
export const COMPANY = 'CIMCON Software India Pvt. Ltd.'
export const CAREERS_PAGE_URL = 'https://cimcon.com/about-us/careers/'

const CURRENT_IDENTITY_SIGNAL_RE =
  /CIMCON is an expert in end to end AI, EUC and Model Risk management\./i
const LEGACY_IDENTITY_SIGNAL_RE =
  /CIMCON is a market leader in providing productivity and compliance solutions to regulated industries\./i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(value)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Careers(?:\s*-\s*CIMCON Software)?/i.test(page)
    && /Come Work With Us!/i.test(text)
    && (CURRENT_IDENTITY_SIGNAL_RE.test(text) || LEGACY_IDENTITY_SIGNAL_RE.test(text))
    && /Current Openings/i.test(text)
}

export const hasEmailOnlyOpeningsSignal = (html) => {
  const text = normalizeWhitespace(html)

  return /To apply for a position,\s*send us your CV at hr@cimcon\.com\./i.test(text)
    && /Please indicate your area of interest in the email subject line\./i.test(text)
}

const extractCurrentOpeningsSection = (html) => {
  const page = String(html ?? '')
  const sectionMatch = page.match(
    /<h3[^>]*>\s*Current Openings\s*<\/h3>([\s\S]*?)(?=<h[1-6][^>]*>\s*Quick Question\? Get in Touch\.?\s*<\/h[1-6]>|$)/i,
  )

  return sectionMatch?.[1] || ''
}

export const extractCurrentOpenings = (html) => {
  const sectionHtml = extractCurrentOpeningsSection(html)
  const openings = []

  for (const match of sectionHtml.matchAll(/<p[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*([\s\S]*?)<\/p>/gi)) {
    const title = stripTags(match[1])
    const trailingText = stripTags(match[2])
    const description = stripTags(match[0])
    const location = trailingText.match(/\(\s*work in\s+([^)]+)\)/i)?.[1]?.trim() || null

    if (!title || !location || !description) continue

    openings.push({
      title,
      location,
      description,
    })
  }

  return openings
}

const isIndiaOpening = (opening) => /\bIndia\b/i.test(String(opening?.location ?? ''))

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

export const createCimconScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const now = options.now || (() => new Date().toISOString())
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('CIMCON verified official careers page no longer matches the trusted first-party surface')
    }

    const openings = extractCurrentOpenings(careersHtml)
    if (openings.length === 0) {
      if (hasEmailOnlyOpeningsSignal(careersHtml)) {
        return []
      }

      throw new Error('CIMCON careers page no longer exposes the verified current openings section')
    }

    return openings
      .filter((opening) => isIndiaOpening(opening))
      .map((opening) => {
        const normalizedLocation = stripTags(opening.location)
        const city = normalizeCity(normalizedLocation.split(',')[0]?.trim() || normalizedLocation)
        const jobId = slugify(`${opening.title}-${normalizedLocation}`)

        return {
          title: opening.title,
          company: COMPANY,
          location: normalizedLocation,
          city,
          country: 'India',
          link: CAREERS_PAGE_URL,
          applyUrl: CAREERS_PAGE_URL,
          sourceUrl: CAREERS_PAGE_URL,
          source: SOURCE,
          jobId,
          requisitionId: jobId,
          department: null,
          employmentType: null,
          experienceRequired: null,
          postingDate: null,
          closingDate: null,
          jobDescription: opening.description,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          remoteStatus: 'On-site',
          scrapedAt: now(),
        }
      })
  },
})

export const run = async (options = {}) => createCimconScraper().run(options)
