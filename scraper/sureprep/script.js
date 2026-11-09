import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SUREPREP_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SUREPREP_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const COMPANY_CAREER_PAGE = PROVIDER_METADATA.companyCareerPage
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const LOGIN_URL = PROVIDER_METADATA.loginUrl
export const PARENT_CAREERS_URL = PROVIDER_METADATA.parentCareersUrl
export const OFFICIAL_PRODUCT_TITLE = PROVIDER_METADATA.officialProductTitle
export const OFFICIAL_LOGIN_TITLE = PROVIDER_METADATA.officialLoginTitle
export const OFFICIAL_LOGIN_PROVIDER = PROVIDER_METADATA.officialLoginProvider

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

const JOB_TEXT_PATTERN =
  /\b(current openings|open roles|job openings|view open roles|view all jobs|apply now|join our team|work with us|careers? at sureprep)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const normalizePathname = (value = '') => {
  const normalized = String(value).trim().replace(/\/+$/, '')
  return normalized || '/'
}

const extractAnchors = (html = '', pageUrl) => {
  const anchors = []
  const matches = String(html).matchAll(
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
  )

  for (const match of matches) {
    const rawHref = match[1] || match[2] || match[3] || ''
    const text = normalizeWhitespace(decodeEntities(match[4] || ''))

    try {
      anchors.push({
        url: new URL(decodeEntities(rawHref), pageUrl),
        text,
      })
    } catch {
      // Ignore malformed anchors and keep the sentinel fail-closed.
    }
  }

  return anchors
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

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const sameUrl = (left, right) => String(left ?? '').replace(/\/$/, '') === String(right ?? '').replace(/\/$/, '')

export const hasOfficialPublicSurfaceSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  const title = (extractTitle(html) || '').toLowerCase()

  return title === OFFICIAL_PRODUCT_TITLE.toLowerCase()
    && normalized.includes('simplify tax workflows and expedite 1040 preparation with sureprep')
    && normalized.includes('now part of the thomson reuters suite of comprehensive products')
    && normalized.includes('taxcaddy')
    && normalized.includes('spbinder')
    && normalized.includes('1040scan')
    && normalized.includes('contact sales')
}

export const hasOfficialLoginSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  const title = (extractTitle(html) || '').toLowerCase()

  return title.includes('sureprep fileroom login')
    && normalized.includes('welcome')
    && normalized.includes('sign in with thomson reuters account')
    && normalized.includes('sureprep')
  }

export const detectPublicJobsSurface = (html = '', pageUrl = HOMEPAGE_URL) => {
  if (hasJobPostingMarkup(html)) return 'JobPosting markup'

  const normalizedText = normalizeWhitespace(html)
  if (JOB_TEXT_PATTERN.test(normalizedText)) return 'job-related page copy'

  const page = new URL(pageUrl)
  const currentPath = normalizePathname(page.pathname)
  const anchors = extractAnchors(html, pageUrl)

  const atsBoardUrl = anchors.find(({ url }) =>
    TRUSTED_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname)),
  )
  if (atsBoardUrl) return atsBoardUrl.url.toString()

  const sameOriginJobUrl = anchors.find(({ url, text }) => {
    if (url.origin !== page.origin) return false

    const pathname = normalizePathname(url.pathname)
    if (pathname === currentPath && !url.search && !url.hash) return false

    return SAME_ORIGIN_JOB_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
      || JOB_TEXT_PATTERN.test(text)
  })
  if (sameOriginJobUrl) return sameOriginJobUrl.url.toString()

  const externalJobUrl = anchors.find(({ url, text }) => {
    if (sameUrl(url.toString(), PARENT_CAREERS_URL)) return false

    return JOB_TEXT_PATTERN.test(text)
      || /\/(?:careers?|jobs?|positions?|roles?|openings?|join-us|work-with-us|hiring|apply)(?:\/|$)/i.test(url.pathname)
  })

  return externalJobUrl ? externalJobUrl.url.toString() : null
}

export const hasPublicJobsSignal = (html = '', pageUrl = HOMEPAGE_URL) =>
  detectPublicJobsSurface(html, pageUrl) !== null

export const createSurePrepScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const [publicPage, loginPage] = await Promise.all([
      fetchPage(COMPANY_CAREER_PAGE),
      fetchPage(LOGIN_URL),
    ])

    if (
      publicPage.status !== 200
      || !sameUrl(publicPage.url, HOMEPAGE_URL)
      || !hasOfficialPublicSurfaceSignal(publicPage.html)
    ) {
      throw new Error('SurePrep verified public brand surface no longer matches the trusted Thomson Reuters product contract')
    }

    const publicJobsSurface = detectPublicJobsSurface(publicPage.html, publicPage.url)
    if (publicJobsSurface) {
      throw new Error(`SurePrep public brand surface now exposes public jobs content via ${publicJobsSurface} and needs a real scraper`)
    }

    if (
      loginPage.status !== 200
      || !sameUrl(loginPage.url, LOGIN_URL)
      || !hasOfficialLoginSignal(loginPage.html)
    ) {
      throw new Error('SurePrep verified login surface no longer matches the trusted Thomson Reuters sign-in contract')
    }

    const loginJobsSurface = detectPublicJobsSurface(loginPage.html, loginPage.url)
    if (loginJobsSurface) {
      throw new Error(`SurePrep login surface now exposes public jobs content via ${loginJobsSurface} and needs a real scraper`)
    }

    return []
  },
})

export const run = async (options = {}) => createSurePrepScraper().run(options)

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
