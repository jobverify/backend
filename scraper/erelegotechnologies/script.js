import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'erelegotechnologies'
export const COMPANY = 'eReleGo Technologies'
export const HOMEPAGE_URL = 'https://erelego.com/'
export const CAREERS_URL = 'https://erelego.com/career/'
export const CAREERS_ALIAS_URLS = [
  'https://erelego.com/careers',
  'https://erelego.com/careers/',
]
export const MISSING_ROUTE_URLS = [
  'https://erelego.com/jobs',
  'https://erelego.com/jobs/',
  'https://erelego.com/join-us',
  'https://erelego.com/join-us/',
  'https://erelego.com/current-openings/',
  'https://erelego.com/openings/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bposition title\b/i,
  /\bjob description\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /zohorecruit/i,
  /recruitcrm/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    url.search = ''
    return url.toString()
  } catch {
    return null
  }
}

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const decodeCloudflareEmail = (encodedValue) => {
  const hex = String(encodedValue ?? '').trim()
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 4 || hex.length % 2 !== 0) {
    return null
  }

  const key = Number.parseInt(hex.slice(0, 2), 16)
  let decoded = ''

  for (let index = 2; index < hex.length; index += 2) {
    const byte = Number.parseInt(hex.slice(index, index + 2), 16)
    decoded += String.fromCharCode(byte ^ key)
  }

  return decoded || null
}

export const extractApplyEmail = (html) => {
  const page = String(html ?? '')
  const protectedMatch = page.match(/data-cfemail=["']([0-9a-f]+)["']/i)
  if (protectedMatch) {
    return decodeCloudflareEmail(protectedMatch[1])?.toLowerCase() ?? null
  }

  const plainMatch = page.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)
  return plainMatch ? plainMatch[0].toLowerCase() : null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*ETPL\s*[-–]\s*Virtual Flair - Redefined for Digital Growth\.\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/erelego\.com\/["']/i.test(page)
    && normalized.includes('etpl provides smart solutions in adtech, biztech, and edtech')
    && normalized.includes('"name":"etpl"')
    && normalized.includes('erelego-technologies-pvt-ltd')
  }

export const hasVerifiedCareersLink = (html) =>
  /href=["'](?:https:\/\/erelego\.com\/career\/|\/career\/)["']/i.test(String(html ?? ''))

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Careers at ETPL\s*\|\s*Jobs\s*&amp;\s*Growth Opportunities\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/erelego\.com\/career\/["']/i.test(page)
    && normalized.includes('work with us: find your place in our family')
    && normalized.includes('joining erelego means becoming part of a dynamic, collaborative, and innovative community')
    && normalized.includes('to apply, please send your cv to')
    && normalized.includes('india : erelego technologies pvt ltd')
  }

const extractSuspiciousPublicJobLinks = (html) => {
  const suspiciousLinks = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1]
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) {
      continue
    }

    let absoluteUrl
    try {
      absoluteUrl = new URL(href, CAREERS_URL).toString()
    } catch {
      continue
    }

    if (seen.has(absoluteUrl)) {
      continue
    }

    const url = new URL(absoluteUrl)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    const isSameHost = ['erelego.com', 'www.erelego.com'].includes(url.hostname)
    const isVerifiedCareersPath = pathname === '/career'
    const isAliasPath = pathname === '/careers'
    const isSuspiciousSameHostPath = isSameHost && (
      /^\/career\/.+/i.test(pathname)
      || /\/(jobs?|join-us|current-openings|openings)(\/|$)/i.test(pathname)
      || (/\/careers(\/|$)/i.test(pathname) && !isAliasPath)
    )

    if (
      PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(absoluteUrl))
      || (isSuspiciousSameHostPath && !isVerifiedCareersPath)
    ) {
      seen.add(absoluteUrl)
      suspiciousLinks.push(absoluteUrl)
    }
  }

  return suspiciousLinks
}

export const hasEmailOnlyCareersSignal = (html) => {
  const normalized = normalizeText(html)

  return extractApplyEmail(html) === 'hr@erelego.com'
    && normalized.includes('to apply, please send your cv to')
    && normalized.includes('with the respective job id')
  }

export const hasUnexpectedPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))
  || extractSuspiciousPublicJobLinks(html).length > 0

export const isVerifiedCareersAlias = ({ status, url, html }) =>
  status === 200
  && normalizeUrl(url) === CAREERS_URL
  && hasOfficialCareersSignal(html)
  && hasEmailOnlyCareersSignal(html)
  && !hasUnexpectedPublicJobsSignal(html)

export const isVerifiedMissingRoute = ({ status, html }) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return status === 404
    && /<title>\s*Page not found - ETPL - Virtual Flair - Redefined\s*<\/title>/i.test(page)
    && normalized.includes('page not found - etpl - virtual flair - redefined')
    && (page.includes('class="error404 ') || page.includes('data-elementor-type="error-404"'))
    && hasVerifiedCareersLink(page)
    && !hasUnexpectedPublicJobsSignal(page)
  }

export const createErelegoTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('eReleGo Technologies verified official homepage no longer matches the known first-party surface')
    }

    if (!hasVerifiedCareersLink(homepage.html)) {
      throw new Error('eReleGo Technologies homepage no longer links to the verified first-party careers page')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('eReleGo Technologies verified first-party careers surface no longer matches the known public page')
    }

    if (!hasEmailOnlyCareersSignal(careersPage.html)) {
      throw new Error('eReleGo Technologies verified email-only careers surface changed')
    }

    if (hasUnexpectedPublicJobsSignal(careersPage.html)) {
      throw new Error('eReleGo Technologies verified email-only careers surface drifted to a public jobs surface')
    }

    for (const aliasUrl of CAREERS_ALIAS_URLS) {
      const aliasPage = await fetchPage(aliasUrl)

      if (!isVerifiedCareersAlias(aliasPage)) {
        throw new Error('eReleGo Technologies careers aliases changed materially')
      }
    }

    for (const missingRouteUrl of MISSING_ROUTE_URLS) {
      const missingRoute = await fetchPage(missingRouteUrl)

      if (!isVerifiedMissingRoute(missingRoute)) {
        throw new Error('eReleGo Technologies missing jobs routes changed materially')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createErelegoTechnologiesScraper().run(options)

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
