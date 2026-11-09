import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'

export const SOURCE = 'technovert'
export const COMPANY = 'Technovert'
export const CAREERS_URL = 'https://technovert.com/careers/'
export const TEZO_ABOUT_URL = 'https://org.tezo.com/about-us/'
export const TEZO_CAREERS_URL = 'https://org.tezo.com/careers/'
export const TRUSTED_JOB_HOST = 'tezo.kekahire.com'
export const DISPOSITION = 'verified-tezo-rebrand-keka-handoff-fail-closed'

const VERIFIED_EXACT_NAME_CAREERS_PATTERNS = [
  /build what matters\.\s*grow where it counts\./i,
  /\bwhy tezo\b/i,
  /\bcurrent openings\b/i,
]

const VERIFIED_REBRAND_PATTERNS = [
  /\bwe are tezo\b/i,
  /\btezo doing business as technovert\b/i,
]

const VERIFIED_TEZO_HANDOFF_PATTERNS = [
  /life is too short to do mediocre work/i,
  /skills matter some\.?\s*attitude matters most/i,
  /\bcurrent openings\b/i,
]

const LIKELY_JOB_PATH_PATTERNS = [
  /^\/careers\/[^/?#]+$/i,
  /^\/jobs?(?:\/|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/roles?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
]

const decodeEntities = (value) =>
  String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const normalizeText = (value) =>
  decodeEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizePathname = (value) => {
  const normalized = String(value || '').trim().replace(/\/+$/, '')
  return normalized || '/'
}

const resolveUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(decodeEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const extractLinks = (html = '', pageUrl) => {
  const links = new Set()

  for (const match of String(html).matchAll(
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi,
  )) {
    const href = match[1] || match[2] || match[3] || null
    const resolved = resolveUrl(href, pageUrl)
    if (resolved) links.add(resolved)
  }

  return [...links]
}

const containsJobPostingMarkup = (html = '') => {
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    if (/\bJobPosting\b/i.test(block[1])) return true
  }

  return false
}

const isTrustedTezoUrl = (value) => {
  if (!value) return false

  try {
    const url = new URL(value)
    return ['www.tezo.com', 'org.tezo.com', TRUSTED_JOB_HOST].includes(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

const isTrustedJobUrl = (value) => {
  if (!value) return false

  try {
    const url = new URL(value)
    return url.hostname.toLowerCase() === TRUSTED_JOB_HOST
      && /\/jobdetails\/\d+/i.test(url.pathname)
  } catch {
    return false
  }
}

export const extractTrustedJobLinks = (html = '', pageUrl = TEZO_CAREERS_URL) =>
  extractLinks(html, pageUrl).filter(isTrustedJobUrl)

export const findUnexpectedFirstPartyListingLinks = (html = '', pageUrl = CAREERS_URL) => {
  const baseUrl = new URL(pageUrl)

  return extractLinks(html, pageUrl).filter((value) => {
    try {
      const url = new URL(value)
      if (url.origin !== baseUrl.origin) return false

      const targetPath = normalizePathname(url.pathname)
      const careersPath = normalizePathname(baseUrl.pathname)

      if (targetPath === careersPath && !url.search && !url.hash) return false

      return LIKELY_JOB_PATH_PATTERNS.some((pattern) => pattern.test(targetPath))
    } catch {
      return false
    }
  })
}

export const hasVerifiedExactNameCareersSignal = (html = '', pageUrl = CAREERS_URL) => {
  const text = normalizeText(html)
  const tezoLinks = extractLinks(html, pageUrl).filter(isTrustedTezoUrl)

  return VERIFIED_EXACT_NAME_CAREERS_PATTERNS.every((pattern) => pattern.test(text))
    && /\btezo\b/i.test(text)
    && tezoLinks.length > 0
}

export const hasVerifiedRebrandSignal = (html = '') => {
  const text = normalizeText(html)
  return VERIFIED_REBRAND_PATTERNS.every((pattern) => pattern.test(text))
}

export const hasVerifiedTezoCareersHandoff = (html = '', pageUrl = TEZO_CAREERS_URL) => {
  const text = normalizeText(html)
  return VERIFIED_TEZO_HANDOFF_PATTERNS.every((pattern) => pattern.test(text))
    && extractTrustedJobLinks(html, pageUrl).length > 0
}

const assertVerifiedContract = ({
  careersHtml = '',
  aboutHtml = '',
  tezoCareersHtml = '',
} = {}) => {
  if (!hasVerifiedExactNameCareersSignal(careersHtml, CAREERS_URL)) {
    throw new Error(
      'Technovert verified exact-name careers handoff no longer matches the trusted Tezo surface.',
    )
  }

  if (containsJobPostingMarkup(careersHtml)) {
    throw new Error(
      'Technovert exact-name careers surface now exposes JobPosting markup; promote a real parser.',
    )
  }

  const firstPartyListingLinks = findUnexpectedFirstPartyListingLinks(careersHtml, CAREERS_URL)
  if (firstPartyListingLinks.length > 0) {
    throw new Error(
      `Technovert exact-name careers surface now exposes first-party public jobs: ${firstPartyListingLinks.join(', ')}`,
    )
  }

  if (!hasVerifiedRebrandSignal(aboutHtml)) {
    throw new Error(
      'Technovert verified Tezo rebrand proof no longer matches the trusted public surface.',
    )
  }

  if (!hasVerifiedTezoCareersHandoff(tezoCareersHtml, TEZO_CAREERS_URL)) {
    throw new Error(
      'Technovert verified Tezo careers handoff no longer exposes the trusted Keka job host.',
    )
  }
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

const loadContract = async (fetchHtml) => {
  const [careersHtml, aboutHtml, tezoCareersHtml] = await Promise.all([
    fetchHtml(CAREERS_URL),
    fetchHtml(TEZO_ABOUT_URL),
    fetchHtml(TEZO_CAREERS_URL),
  ])

  return {
    careersHtml,
    aboutHtml,
    tezoCareersHtml,
  }
}

const defaultLoadBrowserContract = async () => {
  const session = await createBrowserFetchSession({
    waitUntil: 'domcontentloaded',
    settleTimeMs: 5000,
    timeoutMs: 90000,
    ignoreHTTPSErrors: false,
  })

  try {
    const loadBrowserHtml = async (url) => {
      const page = await session.fetchPage(url)
      if (page.status < 200 || page.status >= 400) {
        throw new Error(`HTTP ${page.status} for ${url}`)
      }

      return page.html
    }

    return {
      careersHtml: await loadBrowserHtml('https://www.tezo.com/careers'),
      aboutHtml: await loadBrowserHtml(TEZO_ABOUT_URL),
      tezoCareersHtml: await loadBrowserHtml(TEZO_CAREERS_URL),
    }
  } finally {
    await session.close()
  }
}

export const createTechnovertScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml, loadBrowserContract = defaultLoadBrowserContract } = {}) {
    try {
      assertVerifiedContract(await loadContract(fetchHtml))
    } catch {
      assertVerifiedContract(await loadBrowserContract())
    }

    return []
  },
})

export const run = async (options = {}) => createTechnovertScraper().run(options)
