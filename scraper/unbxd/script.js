export const SOURCE = 'unbxd'
export const COMPANY = 'Unbxd'
export const CAREERS_URL = 'https://try.unbxd.com/'
export const ABOUT_URL = 'https://netcoreunbxd.com/about/'
export const DISPOSITION = 'verified-exact-name-about-surface-fail-closed'

const VERIFIED_TRIAL_PATTERNS = [
  /deliver a relevant\s*&\s*unique shopping experience/i,
  /unbxd'?s search\s*&\s*navigation/i,
  /free 14 day trial/i,
]

const VERIFIED_ABOUT_PATTERNS = [
  /\bthe unbxd story\b/i,
  /connecting retailers and shoppers with sophisticated ai-based solutions/i,
  /\bnetcore unbxd\b/i,
]

const TRUSTED_ATS_HOST_PATTERNS = [
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /jobs\.ashbyhq\.com/i,
  /ashbyhq\.com/i,
  /myworkdayjobs\.com/i,
  /smartrecruiters\.com/i,
  /jobvite\.com/i,
  /workable\.com/i,
  /bamboohr\.com/i,
  /applytojob\.com/i,
  /recruitee\.com/i,
  /zohorecruit\.in/i,
  /darwinbox/i,
  /kekahire\.com/i,
  /teamtailor\.com/i,
]

const SAME_ORIGIN_JOB_PATH_PATTERNS = [
  /^\/careers?(?:\/|$)/i,
  /^\/jobs?(?:\/|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/roles?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/join-us(?:\/|$)/i,
  /^\/work-with-us(?:\/|$)/i,
  /^\/hiring(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
]

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const normalizeText = (value = '') =>
  decodeEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizePathname = (value = '') => {
  const normalized = String(value).trim().replace(/\/+$/, '')
  return normalized || '/'
}

const extractLinkedUrls = (html = '', pageUrl) => {
  const urls = []
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url|data-href|content)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )

  for (const match of matches) {
    const rawValue = match[1] || match[2] || match[3] || ''

    try {
      urls.push(new URL(decodeEntities(rawValue), pageUrl))
    } catch {
      // Ignore malformed URLs and keep the sentinel fail-closed.
    }
  }

  return urls
}

const hasJobPostingMarkup = (html = '') => {
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    if (/\bJobPosting\b/i.test(block[1])) return true
  }

  return false
}

export const hasVerifiedTrialSurface = (html = '') => {
  const text = normalizeText(html)
  return VERIFIED_TRIAL_PATTERNS.every((pattern) => pattern.test(text))
}

export const hasVerifiedAboutSurface = (html = '') => {
  const text = normalizeText(html)
  return VERIFIED_ABOUT_PATTERNS.every((pattern) => pattern.test(text))
}

export const detectPublicJobsSurface = (html = '', pageUrl) => {
  if (hasJobPostingMarkup(html)) return 'JobPosting markup'

  const page = new URL(pageUrl)
  const pagePath = normalizePathname(page.pathname)
  const linkedUrls = extractLinkedUrls(html, pageUrl)

  const atsUrl = linkedUrls.find((url) =>
    TRUSTED_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname)),
  )
  if (atsUrl) return atsUrl.toString()

  const sameOriginJobUrl = linkedUrls.find((url) => {
    if (url.origin !== page.origin) return false

    const pathname = normalizePathname(url.pathname)
    if (pathname === pagePath && !url.search && !url.hash) return false

    return SAME_ORIGIN_JOB_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
  })

  return sameOriginJobUrl ? sameOriginJobUrl.toString() : null
}

const assertVerifiedContract = ({ aboutHtml = '' } = {}) => {
  if (!hasVerifiedAboutSurface(aboutHtml)) {
    throw new Error(
      'Unbxd verified exact-name about surface no longer matches the trusted public contract.',
    )
  }

  const aboutJobsSurface = detectPublicJobsSurface(aboutHtml, ABOUT_URL)
  if (aboutJobsSurface) {
    throw new Error(
      `Unbxd verified about surface now exposes a public jobs surface: ${aboutJobsSurface}`,
    )
  }
}

export const createUnbxdScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const aboutHtml = await fetchHtml(ABOUT_URL)

    assertVerifiedContract({ aboutHtml })
    return []
  },
})

export const run = async (options = {}) => createUnbxdScraper().run(options)

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
