export const SOURCE = 'tricog'
export const COMPANY = 'Tricog'
export const CAREERS_URL = 'https://tricog.com/careers/'
export const VERIFIED_RESUME_INTAKE_CONTRACT =
  'Verified first-party resume-intake-only careers surface with no confirmed public openings inventory.'

const REQUIRED_RESUME_ONLY_SIGNALS = [
  /\bcareers\b/i,
  /share your resume!/i,
  /if you don't see a role that matches your interests,\s*feel free to share your details/i,
  /job application form/i,
  /\bname\b/i,
  /\bemail\b/i,
  /\bphone number\b/i,
  /position interested in/i,
  /upload your resume/i,
]

const LISTING_HEADLINE_SIGNALS = [
  /current openings/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview opportunities\b/i,
  /\bsearch jobs\b/i,
]

const LIKELY_JOB_PATHS = [
  /^\/careers\/[^/?#]+$/i,
  /^\/jobs?\/[^/?#]+/i,
  /^\/positions?\/[^/?#]+/i,
  /^\/openings?\/[^/?#]+/i,
  /^\/apply\/[^/?#]+/i,
]

const normalizeText = (html = '') =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u2019/g, "'")
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

const normalizePath = (value = '') => {
  const path = String(value).trim()
  const withoutTrailingSlash = path.replace(/\/+$/, '')
  return withoutTrailingSlash || '/'
}

const extractSameOriginLinks = (html = '', pageUrl) => {
  const baseUrl = new URL(pageUrl)
  const matches = html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)
  const links = new Set()

  for (const match of matches) {
    try {
      const url = new URL(match[1], baseUrl)
      if (url.origin !== baseUrl.origin) continue
      links.add(url.toString())
    } catch {
      // Ignore malformed links and keep the contract fail-closed.
    }
  }

  return [...links]
}

const findPublicListingSignals = (html, careersUrl) => {
  const text = normalizeText(html)
  const careersPath = normalizePath(new URL(careersUrl).pathname)
  const jobLinks = extractSameOriginLinks(html, careersUrl).filter((link) => {
    const path = normalizePath(new URL(link).pathname)
    return path !== careersPath && LIKELY_JOB_PATHS.some((pattern) => pattern.test(path))
  })

  return {
    hasListingHeadline: LISTING_HEADLINE_SIGNALS.some((pattern) => pattern.test(text)),
    jobLinks,
  }
}

const assertResumeOnlyContract = (html) => {
  const text = normalizeText(html)

  if (REQUIRED_RESUME_ONLY_SIGNALS.every((pattern) => pattern.test(text))) return

  throw new Error(
    'Tricog careers page no longer matches the verified resume-intake-only contract.',
  )
}

const assertNoPublicListings = (html, careersUrl) => {
  const listingSignals = findPublicListingSignals(html, careersUrl)

  if (!listingSignals.hasListingHeadline && listingSignals.jobLinks.length === 0) return

  throw new Error(
    `Tricog careers page appears to expose public first-party job listings: ${listingSignals.jobLinks.join(', ') || 'listing headline detected'}`,
  )
}

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createTricogScraper = ({ careersUrl = CAREERS_URL } = {}) => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(careersUrl)

    assertNoPublicListings(html, careersUrl)
    assertResumeOnlyContract(html)

    return []
  },
})

export const run = async (options = {}) => createTricogScraper().run(options)
