import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'panasonicindiadigital'
export const COMPANY = 'Panasonic India Digital'
export const OFFICIAL_BRAND = 'Panasonic India'
export const PUBLIC_SURFACE_URL = 'https://www.panasonic.com/in/'
export const CORPORATE_URL = 'https://www.panasonic.com/in/corporate.html'
export const INDIA_CAREERS_URL = 'https://www.panasoniccareersindia.in/'
export const GLOBAL_CAREERS_URL = 'https://holdings.panasonic/global/corporate/careers.html'
export const DISPOSITION = 'verified-panasonic-india-careers-handoff-expired-cert-fail-closed'
export const VERIFIED_ON = '2026-08-03'
export const VERIFIED_SURFACE_SUMMARY =
  "Verified on Monday, August 3, 2026 that https://www.panasonic.com/in/ and https://www.panasonic.com/in/corporate.html were the live Panasonic India public surfaces reviewed for Panasonic India Digital, that both pages handed off to Panasonic's India careers site at https://www.panasoniccareersindia.in/, and that the India careers handoff currently failed with CERT_HAS_EXPIRED. Local repo evidence still does not establish that the broader Panasonic India jobs inventory is attributable specifically to the exact workbook entity Panasonic India Digital, so this company-specific scraper remains fail-closed and returns no jobs until an exact-name public openings contract is verified."

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify/1.0)'

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
  /darwinbox/i,
  /zohorecruit\.in/i,
  /icims\.com/i,
]

const SAME_ORIGIN_JOB_PATH_PATTERNS = [
  /^\/careers?(?:\/|$)/i,
  /^\/jobs?(?:\/|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/roles?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
  /^\/join-us(?:\/|$)/i,
  /^\/work-with-us(?:\/|$)/i,
  /^\/hiring(?:\/|$)/i,
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

const extractTitle = (html = '') =>
  normalizeText(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')

const resolveUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(decodeEntities(value), baseUrl)
  } catch {
    return null
  }
}

const urlsMatch = (left, right) => {
  const leftUrl = resolveUrl(left, PUBLIC_SURFACE_URL)
  const rightUrl = resolveUrl(right, PUBLIC_SURFACE_URL)
  if (!leftUrl || !rightUrl) return false

  return leftUrl.origin === rightUrl.origin
    && normalizePathname(leftUrl.pathname) === normalizePathname(rightUrl.pathname)
}

const extractAnchors = (html = '', pageUrl) => {
  const anchors = []
  const matches = String(html).matchAll(
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
  )

  for (const match of matches) {
    const rawHref = match[1] || match[2] || match[3] || ''
    const url = resolveUrl(rawHref, pageUrl)
    if (!url) continue

    anchors.push({
      text: normalizeText(match[4] || ''),
      url,
    })
  }

  return anchors
}

const extractLinkedUrls = (html = '', pageUrl) => {
  const urls = []
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url|data-href|content)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )

  for (const match of matches) {
    const rawValue = match[1] || match[2] || match[3] || ''
    const url = resolveUrl(rawValue, pageUrl)
    if (url) urls.push(url)
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

export const defaultFetchPage = async (url, { fetchImpl = fetch } = {}) => {
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': USER_AGENT,
      },
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
      errorCode: null,
      errorMessage: null,
      errorReason: null,
    }
  } catch (error) {
    return {
      status: 0,
      url,
      html: '',
      errorCode: error?.cause?.code || error?.code || null,
      errorMessage: error?.message || String(error),
      errorReason: error?.cause?.reason || null,
    }
  }
}

export const isExpiredCertificateSurface = (page = {}) =>
  page.status === 0 && /CERT_HAS_EXPIRED/i.test(String(page.errorCode ?? ''))

export const findVerifiedIndiaCareersHandoff = (html = '', pageUrl = PUBLIC_SURFACE_URL) =>
  extractAnchors(html, pageUrl).find(
    ({ text, url }) =>
      /careers/i.test(text)
      && urlsMatch(url.toString(), INDIA_CAREERS_URL),
  ) || null

export const findVerifiedGlobalCareersHandoff = (html = '', pageUrl = CORPORATE_URL) =>
  extractAnchors(html, pageUrl).find(
    ({ text, url }) =>
      /careers/i.test(text)
      && urlsMatch(url.toString(), GLOBAL_CAREERS_URL),
  ) || null

export const hasVerifiedIndiaPublicSurface = (html = '') => {
  const text = normalizeText(html)
  const title = extractTitle(html)

  return /panasonic/i.test(title)
    && /india/i.test(title)
    && /panasonic/i.test(text)
    && Boolean(findVerifiedIndiaCareersHandoff(html, PUBLIC_SURFACE_URL))
}

export const hasVerifiedCorporateSurface = (html = '') => {
  const text = normalizeText(html)
  const title = extractTitle(html)

  return /about us/i.test(title)
    && /panasonic/i.test(title)
    && /india/i.test(title)
    && /panasonic india/i.test(text)
    && Boolean(findVerifiedIndiaCareersHandoff(html, CORPORATE_URL))
    && Boolean(findVerifiedGlobalCareersHandoff(html, CORPORATE_URL))
}

const assertVerifiedIndiaPublicSurface = (page = {}) => {
  if (page.status === 200 && hasVerifiedIndiaPublicSurface(page.html)) return

  throw new Error(
    'Panasonic India Digital verified Panasonic India public surface changed; review the public contract before promoting a real parser.',
  )
}

const assertVerifiedCorporateHandoff = (page = {}) => {
  if (page.status === 200 && hasVerifiedCorporateSurface(page.html)) return

  throw new Error(
    'Panasonic India Digital verified Panasonic careers handoff changed; review the corporate surface before promoting a real parser.',
  )
}

const assertVerifiedIndiaCareersBlocked = (page = {}) => {
  if (isExpiredCertificateSurface(page)) return

  throw new Error(
    'Panasonic India Digital verified India careers handoff changed; review the exact-entity openings contract before promoting a real parser.',
  )
}

const assertNoUnexpectedPublicJobsSurface = (
  html = '',
  pageUrl,
  { allowUrls = [] } = {},
) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'Panasonic India public surface now exposes JobPosting markup; promote a real parser.',
    )
  }

  const page = new URL(pageUrl)
  const pagePath = normalizePathname(page.pathname)

  const linkedUrls = extractLinkedUrls(html, pageUrl)

  const atsUrl = linkedUrls.find((url) => {
    if (allowUrls.some((allowedUrl) => urlsMatch(url.toString(), allowedUrl))) {
      return false
    }

    return TRUSTED_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))
  })

  if (atsUrl) {
    throw new Error(
      `Panasonic India public surface now exposes a public jobs surface via ${atsUrl.toString()}.`,
    )
  }

  const sameOriginJobUrl = linkedUrls.find((url) => {
    if (allowUrls.some((allowedUrl) => urlsMatch(url.toString(), allowedUrl))) {
      return false
    }

    if (url.origin !== page.origin) return false

    const pathname = normalizePathname(url.pathname)
    if (pathname === pagePath && !url.search && !url.hash) return false

    return SAME_ORIGIN_JOB_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
  })

  if (sameOriginJobUrl) {
    throw new Error(
      `Panasonic India public surface now exposes a public jobs surface via ${sameOriginJobUrl.toString()}.`,
    )
  }
}

export const createPanasonicIndiaDigitalScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const [publicSurfacePage, corporatePage, indiaCareersPage] = await Promise.all([
      fetchPage(PUBLIC_SURFACE_URL),
      fetchPage(CORPORATE_URL),
      fetchPage(INDIA_CAREERS_URL),
    ])

    assertVerifiedIndiaPublicSurface(publicSurfacePage)
    assertNoUnexpectedPublicJobsSurface(publicSurfacePage.html, PUBLIC_SURFACE_URL, {
      allowUrls: [INDIA_CAREERS_URL],
    })

    assertVerifiedCorporateHandoff(corporatePage)
    assertNoUnexpectedPublicJobsSurface(corporatePage.html, CORPORATE_URL, {
      allowUrls: [INDIA_CAREERS_URL, GLOBAL_CAREERS_URL],
    })

    assertVerifiedIndiaCareersBlocked(indiaCareersPage)

    return []
  },
})

export const run = async (options = {}) => createPanasonicIndiaDigitalScraper().run(options)

export const persistScrapeResults = async ({
  argv = process.argv,
  runImpl = run,
  saveToFileImpl,
  saveToDBImpl,
  outputFile = path.join(currentDir, 'jobs.json'),
} = {}) => {
  const jobs = await runImpl()

  if (!saveToFileImpl || !saveToDBImpl) {
    const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
    saveToFileImpl ??= saveToFile
    saveToDBImpl ??= saveToDB
  }

  if (argv.includes('--dry-run')) {
    await saveToFileImpl(jobs, outputFile)
    return jobs
  }

  await saveToDBImpl(jobs, SOURCE)
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await persistScrapeResults()
}
