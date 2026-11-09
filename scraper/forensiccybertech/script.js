import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'forensiccybertech'
export const COMPANY = 'Forensic CyberTech'
export const HOMEPAGE_URL = 'https://forensiccybertech.com/'
export const SITEMAP_URL = 'https://forensiccybertech.com/sitemap.xml'
export const CHECKED_ROUTE_URLS = [
  'https://forensiccybertech.com/careers',
  'https://forensiccybertech.com/careers/',
  'https://forensiccybertech.com/career',
  'https://forensiccybertech.com/career/',
  'https://forensiccybertech.com/jobs',
  'https://forensiccybertech.com/jobs/',
  'https://forensiccybertech.com/job',
  'https://forensiccybertech.com/job/',
  'https://forensiccybertech.com/openings',
  'https://forensiccybertech.com/openings/',
  'https://forensiccybertech.com/hiring',
  'https://forensiccybertech.com/hiring/',
]

const VERIFIED_SITEMAP_URLS = [
  'https://forensiccybertech.com/',
  'https://forensiccybertech.com/products/chitragupt',
  'https://forensiccybertech.com/products/eagleye',
  'https://forensiccybertech.com/services/protect/cyber-risk-management',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_PATH_PATTERN =
  /(?:^|\/)(career|careers|job|jobs|opening|openings|vacancy|vacancies|hiring|join-us|joinus|work-with-us)(?:\/|$)/i

const HOMEPAGE_TEXT_SIGNALS = [
  'Your Co-Pilot for a Cyber-Safe Ecosystem',
  'About Forensic CyberTech',
  'Forensic CyberTech Pvt. Ltd. is a leading cybersecurity and digital forensics company headquartered in Ahmedabad, India.',
  'Join Our Cybersecurity Newsletter for Exclusive Tips & News',
  '7th Floor, Shivarth The Ace, Sindhu Bhavan Road, Ahmedabad - 380054',
  'Request Demo',
  'Chitragupt',
  'EaglEye',
]

const BUNDLE_IDENTITY_PATTERNS = [
  /Forensic CyberTech/i,
  /Chitragupt/i,
  /EaglEye/i,
]

const VISIBLE_PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcareer(?:s)?\b/i,
  /\bjob(?:s)?\b/i,
  /\bopening(?:s)?\b/i,
  /\bhiring\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bsubmit (?:your )?resume\b/i,
  /\bupload your resume\b/i,
]

const RAW_PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workable\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /zohorecruit/i,
]

const BUNDLE_PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /['"`]\/career(?:s)?(?:\/|['"`])/i,
  /['"`]\/job(?:s)?(?:\/|['"`])/i,
  /['"`]\/opening(?:s)?(?:\/|['"`])/i,
  /['"`]\/hiring(?:\/|['"`])/i,
  ...VISIBLE_PUBLIC_JOBS_SIGNAL_PATTERNS,
  ...RAW_PUBLIC_JOBS_SIGNAL_PATTERNS,
]

const decodeEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;|\u2019/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&ndash;|&mdash;|&#8211;|&#8212;|\u2013|\u2014/gi, '-')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeEntities(value)
  .replace(/\s+/g, ' ')
  .trim()

export const normalizeVisibleText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitleText = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')

const extractPrimaryHeadingText = (html = '') =>
  normalizeVisibleText(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')

const toAbsoluteUrl = (value, pageUrl = HOMEPAGE_URL) => {
  try {
    return new URL(value, pageUrl)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (value) => {
  try {
    const url = value instanceof URL ? value : new URL(value)
    const hostname = String(url.hostname ?? '').toLowerCase()
    return hostname === 'forensiccybertech.com'
      || hostname === 'www.forensiccybertech.com'
      || hostname.endsWith('.forensiccybertech.com')
  } catch {
    return false
  }
}

const normalizeComparableUrl = (value) => {
  const url = toAbsoluteUrl(value, HOMEPAGE_URL)
  if (!url) return null

  const pathname = url.pathname.replace(/\/+$/, '') || '/'
  return `${url.origin.toLowerCase()}${pathname}`
}

const uniqueSorted = (values) => [...new Set(values)].sort()

export const extractFirstPartyScriptUrls = (html = '', pageUrl = HOMEPAGE_URL) =>
  uniqueSorted(
    Array.from(
      String(html ?? '').matchAll(/<script[^>]+src=["']([^"']+\.(?:js|mjs)(?:\?[^"']*)?)["']/gi),
      (match) => toAbsoluteUrl(match[1], pageUrl)?.toString() ?? null,
    ).filter((url) => url && isFirstPartyUrl(url)),
  )

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const visibleText = normalizeVisibleText(rawHtml)

  return /<title>\s*Forensic CyberTech\s*[–-]\s*Cybersecurity\s*&amp;\s*Digital Forensics Company\s*<\/title>/i.test(rawHtml)
    && HOMEPAGE_TEXT_SIGNALS.every((signal) => visibleText.includes(signal))
    && extractFirstPartyScriptUrls(rawHtml).length > 0
}

export const hasPublicJobsSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const visibleText = normalizeVisibleText(rawHtml)

  return RAW_PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(rawHtml))
    || VISIBLE_PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(visibleText))
}

const extractSitemapLocs = (xml = '') =>
  Array.from(String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi), (match) => match[1].trim())

export const hasVerifiedSitemap = (xml = '') => {
  const locs = extractSitemapLocs(xml)
  const comparableLocs = locs.map((loc) => normalizeComparableUrl(loc)).filter(Boolean)

  if (locs.length !== VERIFIED_SITEMAP_URLS.length) {
    return false
  }

  if (comparableLocs.length !== VERIFIED_SITEMAP_URLS.length) {
    return false
  }

  if (!VERIFIED_SITEMAP_URLS.every((url) => comparableLocs.includes(normalizeComparableUrl(url)))) {
    return false
  }

  return locs.every((loc) => {
    const absoluteUrl = toAbsoluteUrl(loc, HOMEPAGE_URL)
    return absoluteUrl
      && isFirstPartyUrl(absoluteUrl)
      && !CAREER_PATH_PATTERN.test(absoluteUrl.pathname)
  })
}

export const hasVerifiedBundleSignal = (bundleText = '') =>
  BUNDLE_IDENTITY_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const hasBundlePublicJobsSignal = (bundleText = '') =>
  BUNDLE_PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

const bundleSetHasVerifiedIdentity = (bundleTexts = []) => {
  const joinedText = bundleTexts.join('\n')
  return BUNDLE_IDENTITY_PATTERNS.every((pattern) => pattern.test(joinedText))
}

export const buildRouteShellSignature = (html = '') => JSON.stringify({
  title: extractTitleText(html),
  heading: extractPrimaryHeadingText(html),
  visibleText: normalizeVisibleText(html),
})

const arraysEqual = (left = [], right = []) =>
  JSON.stringify(uniqueSorted(left)) === JSON.stringify(uniqueSorted(right))

export const routeMatchesVerifiedShell = (
  page = {},
  homepageSignature,
  homepageScriptUrls = [],
) =>
  Number(page?.status) === 200
  && isFirstPartyUrl(page?.url || HOMEPAGE_URL)
  && hasOfficialHomepageSignal(page?.html)
  && !hasPublicJobsSignal(page?.html)
  && buildRouteShellSignature(page?.html) === homepageSignature
  && arraysEqual(
    extractFirstPartyScriptUrls(page?.html, page?.url || HOMEPAGE_URL),
    homepageScriptUrls,
  )

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
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

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
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

export const createForensicCyberTechScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (
      homepage.status !== 200
      || !isFirstPartyUrl(homepage.url || HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Forensic CyberTech verified official homepage no longer matches the known first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Forensic CyberTech homepage now appears to expose public jobs')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (
      sitemap.status !== 200
      || !isFirstPartyUrl(sitemap.url || SITEMAP_URL)
      || !hasVerifiedSitemap(sitemap.html)
    ) {
      throw new Error('Forensic CyberTech verified sitemap no longer matches the no-public-careers surface')
    }

    const homepageScriptUrls = extractFirstPartyScriptUrls(homepage.html, homepage.url || HOMEPAGE_URL)
    if (homepageScriptUrls.length === 0) {
      throw new Error('Forensic CyberTech homepage no longer exposes the verified first-party bundle set')
    }

    const bundleTexts = []
    for (const scriptUrl of homepageScriptUrls) {
      bundleTexts.push(await fetchText(scriptUrl))
    }

    if (
      !bundleSetHasVerifiedIdentity(bundleTexts)
      || bundleTexts.some((bundleText) => hasBundlePublicJobsSignal(bundleText))
    ) {
      throw new Error('Forensic CyberTech bundle set changed materially or now exposes public jobs')
    }

    const homepageSignature = buildRouteShellSignature(homepage.html)
    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!routeMatchesVerifiedShell(routePage, homepageSignature, homepageScriptUrls)) {
        throw new Error('Forensic CyberTech checked first-party route changed materially or now exposes public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createForensicCyberTechScraper().run(options)

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
