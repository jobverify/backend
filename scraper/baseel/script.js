import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'baseel'
export const COMPANY = 'BASEEL'
export const SHARED_CONTACT_EMAIL = 'contactus@baseel.com'

export const BASEEL_DOT_COM = {
  key: 'baseel.com',
  homepageUrl: 'https://baseel.com/',
  sitemapUrl: 'https://baseel.com/sitemap.xml',
  routeUrls: [
    'https://baseel.com/careers',
    'https://baseel.com/careers/',
    'https://baseel.com/career',
    'https://baseel.com/career/',
    'https://baseel.com/jobs',
    'https://baseel.com/jobs/',
    'https://baseel.com/join-us',
    'https://baseel.com/join-us/',
  ],
}

export const BASEEL_DOT_IN = {
  key: 'baseel.in',
  homepageUrl: 'https://baseel.in/',
  sitemapUrl: 'https://baseel.in/sitemap.xml',
  routeUrls: [
    'https://baseel.in/careers',
    'https://baseel.in/careers/',
    'https://baseel.in/career',
    'https://baseel.in/career/',
    'https://baseel.in/jobs',
    'https://baseel.in/jobs/',
    'https://baseel.in/join-us',
    'https://baseel.in/join-us/',
  ],
}

export const SITE_DEFINITIONS = [BASEEL_DOT_COM, BASEEL_DOT_IN]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const BASIC_ENTITY_MAP = new Map([
  ['&amp;', '&'],
  ['&nbsp;', ' '],
  ['&#x27;', "'"],
  ['&#39;', "'"],
  ['&rsquo;', "'"],
  ['&#8217;', "'"],
  ['&#x2019;', "'"],
])

const PUBLIC_JOBS_TEXT_PATTERNS = [
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bview jobs?\b/i,
  /\bsearch jobs?\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /freshteam/i,
  /zohorecruit/i,
]

const BUNDLE_JOBS_SIGNAL_PATTERNS = [
  /["'`]\/careers?(?:\/|["'`])/i,
  /["'`]\/jobs?(?:\/|["'`])/i,
  /["'`]\/join-us(?:\/|["'`])/i,
  ...PUBLIC_JOBS_TEXT_PATTERNS,
]

const decodeBasicEntities = (value) => {
  let result = String(value ?? '')

  for (const [entity, replacement] of BASIC_ENTITY_MAP.entries()) {
    result = result.replace(new RegExp(entity, 'gi'), replacement)
  }

  return result
}

const normalizeWhitespace = (value) => decodeBasicEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripHtmlToText = (html) => normalizeWhitespace(
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitle = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '')

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(value)
    const pathname = url.pathname.replace(/\/+$/g, '') || '/'
    return `${url.origin}${pathname}`.toLowerCase()
  } catch {
    return null
  }
}

const getAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractAnchorUrls = (html, baseUrl) =>
  [...String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
    .map((match) => getAbsoluteUrl(match[1], baseUrl))
    .filter(Boolean)

const isSameOrigin = (value, baseUrl) => {
  try {
    return new URL(value).origin === new URL(baseUrl).origin
  } catch {
    return false
  }
}

const isCareerLikePath = (value) => {
  try {
    const pathname = new URL(value).pathname.toLowerCase()
    return /^\/(careers?|jobs?|join-us)(\/|$)/.test(pathname)
  } catch {
    return false
  }
}

const getVerifiedHomepageSignal = (site) => {
  if (site.key === BASEEL_DOT_COM.key) return hasBaseelDotComHomepageSignal
  return hasBaseelDotInHomepageSignal
}

export const hasSharedContactSignal = (html) =>
  new RegExp(SHARED_CONTACT_EMAIL.replace('.', '\\.'), 'i').test(String(html ?? ''))

export const hasPublicJobsTextSignal = (html) =>
  PUBLIC_JOBS_TEXT_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasUnexpectedCareerOrAtsLink = (html, baseUrl) => {
  return extractAnchorUrls(html, baseUrl).some((absoluteUrl) => {
    if (!isSameOrigin(absoluteUrl, baseUrl)) {
      return /(lever|greenhouse|ashbyhq|workdayjobs|myworkdayjobs|smartrecruiters|jobvite|breezy\.hr|freshteam|zohorecruit)/i.test(absoluteUrl)
    }

    return isCareerLikePath(absoluteUrl)
  })
}

export const extractFirstPartyScriptUrls = (html, baseUrl) => {
  const matches = [...String(html ?? '').matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
  const scriptUrls = matches
    .map((match) => getAbsoluteUrl(match[1], baseUrl))
    .filter(Boolean)
    .filter((scriptUrl) => isSameOrigin(scriptUrl, baseUrl) && /\.js(?:[?#].*)?$/i.test(scriptUrl))

  return [...new Set(scriptUrls)]
}

export const hasBundleJobsSignal = (bundleText) =>
  BUNDLE_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const sitemapHasHomepageEntry = (xml, homepageUrl) => {
  const normalizedHomepage = normalizeComparableUrl(homepageUrl)
  const matches = [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]

  return matches.some((match) => normalizeComparableUrl(match[1]) === normalizedHomepage)
}

export const sitemapHasCareerLikeUrl = (xml) => {
  const matches = [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]

  return matches.some((match) => isCareerLikePath(match[1]))
}

export const isVerifiedRouteFallbackShell = (pageHtml, homepageHtml, baseUrl) =>
  extractTitle(pageHtml) === extractTitle(homepageHtml)
  && stripHtmlToText(pageHtml) === stripHtmlToText(homepageHtml)
  && !hasPublicJobsTextSignal(pageHtml)
  && !hasUnexpectedCareerOrAtsLink(pageHtml, baseUrl)

export const hasBaseelDotComHomepageSignal = (html) => {
  const title = extractTitle(html)
  const visibleText = stripHtmlToText(html)
  const links = extractAnchorUrls(html, BASEEL_DOT_COM.homepageUrl)
  const sitemapLink = getAbsoluteUrl('/sitemap.xml', BASEEL_DOT_COM.homepageUrl)

  return title === 'Professional IT Consultant for Your Business - Baseel Partners LLP.'
    && visibleText.includes('OUR NEWSLETTER')
    && visibleText.includes('GET TO KNOW US')
    && visibleText.includes('OUR POLICIES')
    && visibleText.includes('167-169 Great Portland Street, London, W1W 5PF')
    && hasSharedContactSignal(html)
    && links.includes(sitemapLink)
}

export const hasBaseelDotInHomepageSignal = (html) => {
  const title = extractTitle(html)
  const visibleText = stripHtmlToText(html)
  const links = extractAnchorUrls(html, BASEEL_DOT_IN.homepageUrl)
  const sitemapLink = getAbsoluteUrl('/sitemap.xml', BASEEL_DOT_IN.homepageUrl)

  return title === 'Data Privacy & Compliance Automation Platform | Baseel'
    && visibleText.includes("India's DPDP Act Compliance Platform")
    && visibleText.includes('DPDP Compliance Made Simple')
    && visibleText.includes('Why Baseel Group?')
    && visibleText.includes('Get Demo')
    && hasSharedContactSignal(html)
    && links.includes(sitemapLink)
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    redirect: 'follow',
    signal,
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

const defaultFetchText = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    redirect: 'follow',
    signal,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/javascript,text/javascript,text/plain;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const verifySiteSurface = async (site, { fetchPage, fetchText }) => {
  const homepage = await fetchPage(site.homepageUrl)
  const hasVerifiedHomepageSignal = getVerifiedHomepageSignal(site)

  if (homepage.status !== 200 || !hasVerifiedHomepageSignal(homepage.html)) {
    throw new Error(`${site.key} verified official homepage no longer matches the known public surface`)
  }

  if (hasPublicJobsTextSignal(homepage.html) || hasUnexpectedCareerOrAtsLink(homepage.html, site.homepageUrl)) {
    throw new Error(`${site.key} homepage now appears to expose a public jobs surface`)
  }

  const bundleUrls = extractFirstPartyScriptUrls(homepage.html, site.homepageUrl)
  if (!bundleUrls.length) {
    throw new Error(`${site.key} homepage no longer exposes the verified first-party client bundles`)
  }

  for (const bundleUrl of bundleUrls) {
    const bundleText = await fetchText(bundleUrl)
    if (hasBundleJobsSignal(bundleText)) {
      throw new Error(`${site.key} first-party client bundle now appears to expose a public jobs surface`)
    }
  }

  const sitemap = await fetchPage(site.sitemapUrl)
  if (
    sitemap.status !== 200
    || !sitemapHasHomepageEntry(sitemap.html, site.homepageUrl)
    || sitemapHasCareerLikeUrl(sitemap.html)
  ) {
    throw new Error(`${site.key} sitemap no longer matches the verified no-public-careers surface`)
  }

  for (const routeUrl of site.routeUrls) {
    const routePage = await fetchPage(routeUrl)
    const finalUrl = routePage.url || routeUrl

    if (
      routePage.status !== 200
      || !isSameOrigin(finalUrl, site.homepageUrl)
      || !isVerifiedRouteFallbackShell(routePage.html, homepage.html, site.homepageUrl)
    ) {
      throw new Error(`${site.key} checked first-party route changed materially or now exposes public jobs: ${finalUrl}`)
    }
  }
}

export const createBaseelScraper = () => ({
  async run({
    fetchPage: providedFetchPage = defaultFetchPage,
    fetchText: providedFetchText = defaultFetchText,
    signal,
    timeoutMs = 120000,
    requestTimeoutMs = 15000,
  } = {}) {
    for (const budget of [timeoutMs, requestTimeoutMs]) {
      if (!Number.isSafeInteger(budget) || budget < 1 || budget > 300000) throw new RangeError('Baseel request and source budgets must be within five minutes')
    }
    const sourceSignal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])])
    const read = async (fetcher, url) => {
      const requestSignal = AbortSignal.any([sourceSignal, AbortSignal.timeout(requestTimeoutMs)])
      requestSignal.throwIfAborted()
      let onAbort
      const aborted = new Promise((_, reject) => {
        onAbort = () => reject(requestSignal.reason)
        requestSignal.addEventListener('abort', onAbort, { once: true })
      })
      try {
        const response = await Promise.race([Promise.resolve().then(() => {
          requestSignal.throwIfAborted()
          return fetcher(url, { signal: requestSignal })
        }), aborted])
        requestSignal.throwIfAborted()
        return response
      } finally { requestSignal.removeEventListener('abort', onAbort) }
    }
    const fetchPage = url => read(providedFetchPage, url)
    const fetchText = url => read(providedFetchText, url)
    for (const site of SITE_DEFINITIONS) {
      sourceSignal.throwIfAborted()
      await verifySiteSurface(site, { fetchPage, fetchText })
    }

    return []
  },
})

export const run = async (options = {}) => createBaseelScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
