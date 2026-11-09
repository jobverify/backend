import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SOURCE = 'piramalpharmadigital'
export const COMPANY = 'Piramal Pharma Digital'
export const PUBLIC_SURFACE_URL = 'https://www.piramalpharma.com/'
export const CAREERS_URL = 'https://www.piramalpharma.com/careers'
export const WORKDAY_BOARD_URL =
  'https://piramalpharma.wd102.myworkdayjobs.com/PIRAMAL_EXTERNAL_CAREERS'
export const DISPOSITION = 'verified-piramal-pharma-workday-handoff-fail-closed'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Tuesday, August 4, 2026 that https://www.piramalpharma.com/ and https://www.piramalpharma.com/careers were the live Piramal Pharma public surfaces reviewed for the exact workbook entity Piramal Pharma Digital, and that the careers page handed applicants to the public Workday board at https://piramalpharma.wd102.myworkdayjobs.com/PIRAMAL_EXTERNAL_CAREERS. Local repo evidence does not safely attribute the broader Piramal Pharma careers inventory to the exact workbook entity Piramal Pharma Digital, so this company-specific scraper remains fail-closed and returns no jobs until an exact-name public openings contract is verified.'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

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

const hasExpectedUrlMetadata = (html = '', expectedUrl) => {
  const escapedUrl = expectedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return new RegExp(
    `<(?:link|meta)\\b[^>]+(?:href|content)=["']${escapedUrl}["'][^>]*>`,
    'i',
  ).test(String(html))
}

const resolveUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(decodeEntities(value), baseUrl)
  } catch {
    return null
  }
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

export const findVerifiedCareersHandoff = (html = '', pageUrl = PUBLIC_SURFACE_URL) =>
  extractAnchors(html, pageUrl).find(
    ({ text, url }) =>
      /\bcareers\b/i.test(text)
      && url.origin === new URL(CAREERS_URL).origin
      && normalizePathname(url.pathname) === normalizePathname(new URL(CAREERS_URL).pathname),
  ) || null

export const hasVerifiedPublicSurface = (html = '') => {
  const text = normalizeText(html)
  const title = extractTitle(html)

  return /\bpiramal pharma\b/i.test(title || text)
    && /\bpiramal pharma\b/i.test(text)
    && Boolean(findVerifiedCareersHandoff(html, PUBLIC_SURFACE_URL))
}

export const findVerifiedWorkdayBoardHandoff = (html = '', pageUrl = CAREERS_URL) => {
  const handoff = extractAnchors(html, pageUrl).find(
    ({ url }) => url.toString() === WORKDAY_BOARD_URL,
  )

  return handoff ? handoff.url.toString() : null
}

export const hasVerifiedCareersSurface = (html = '') => {
  const text = normalizeText(html)
  const title = extractTitle(html)

  return /\bpiramal pharma limited careers\b/i.test(title || text)
    && /\bexplore opportunities\b/i.test(text)
    && hasExpectedUrlMetadata(html, CAREERS_URL)
    && findVerifiedWorkdayBoardHandoff(html, CAREERS_URL) === WORKDAY_BOARD_URL
}

export const hasVerifiedWorkdayBoardSignal = (page = {}) => {
  const html = String(page?.html || '')

  return Number(page?.status) === 200
    && String(page?.url || '') === WORKDAY_BOARD_URL
    && hasExpectedUrlMetadata(html, WORKDAY_BOARD_URL)
    && /\bcareers\b/i.test(html)
    && /\bpiramal pharma limited\b/i.test(html)
    && /\bPIRAMAL_EXTERNAL_CAREERS\b/i.test(html)
    && /\bIntroduce yourself to our recruiters\b/i.test(html)
    && /\bIndia\b/i.test(html)
}

const assertVerifiedPublicSurface = (html = '') => {
  if (hasVerifiedPublicSurface(html)) return

  throw new Error(
    'Piramal Pharma Digital verified public surface changed; review the exact-name contract before promoting a real parser.',
  )
}

const assertVerifiedCareersSurface = (html = '') => {
  if (hasVerifiedCareersSurface(html)) return

  throw new Error(
    'Piramal Pharma Digital verified careers handoff changed; review the exact-name contract before promoting a real parser.',
  )
}

const assertVerifiedWorkdayBoard = (page = {}) => {
  if (hasVerifiedWorkdayBoardSignal(page)) return

  throw new Error(
    'Piramal Pharma Digital verified Workday board changed; review the exact-name contract before promoting a real parser.',
  )
}

const assertNoUnexpectedPublicJobsSurface = (
  html = '',
  pageUrl,
  { allowUrl = null } = {},
) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'Piramal Pharma Digital public surface now exposes JobPosting markup; promote a real parser.',
    )
  }

  const page = new URL(pageUrl)
  const pagePath = normalizePathname(page.pathname)
  const allowedUrl = allowUrl ? new URL(allowUrl) : null
  const linkedUrls = extractLinkedUrls(html, pageUrl)

  const atsUrl = linkedUrls.find((url) => {
    if (
      allowedUrl
      && url.origin === allowedUrl.origin
      && normalizePathname(url.pathname) === normalizePathname(allowedUrl.pathname)
    ) {
      return false
    }

    return TRUSTED_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))
  })

  if (atsUrl) {
    throw new Error(
      `Piramal Pharma Digital public surface now exposes a public jobs surface via ${atsUrl.toString()}.`,
    )
  }

  const sameOriginJobUrl = linkedUrls.find((url) => {
    if (
      allowedUrl
      && url.origin === allowedUrl.origin
      && normalizePathname(url.pathname) === normalizePathname(allowedUrl.pathname)
    ) {
      return false
    }

    if (url.origin !== page.origin) return false

    const pathname = normalizePathname(url.pathname)
    if (pathname === pagePath && !url.search) return false

    return SAME_ORIGIN_JOB_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
  })

  if (sameOriginJobUrl) {
    throw new Error(
      `Piramal Pharma Digital public surface now exposes a public jobs surface via ${sameOriginJobUrl.toString()}.`,
    )
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createPiramalPharmaDigitalScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const publicSurfacePage = await fetchPage(PUBLIC_SURFACE_URL)

    assertVerifiedPublicSurface(publicSurfacePage.html)

    const careersPage = await fetchPage(CAREERS_URL)

    assertVerifiedCareersSurface(careersPage.html)
    assertNoUnexpectedPublicJobsSurface(careersPage.html, CAREERS_URL, {
      allowUrl: WORKDAY_BOARD_URL,
    })

    const workdayBoardPage = await fetchPage(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable(workdayBoardPage, { source: SOURCE, url: WORKDAY_BOARD_URL })

    assertVerifiedWorkdayBoard(workdayBoardPage)

    return []
  },
})

export const run = async (options = {}) => createPiramalPharmaDigitalScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
