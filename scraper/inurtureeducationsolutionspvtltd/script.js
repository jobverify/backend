import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'inurtureeducationsolutionspvtltd'
export const COMPANY = 'iNurture Education Solutions Pvt ltd'
export const HOMEPAGE_URL = 'https://www.inurture.co.in/'
export const LINKED_CAREERS_URL = 'https://www.inurture.co.in/careers-inurture/'
export const EMBEDDED_CAREERS_URL = 'https://www.inurture.co.in/careers/'
export const EMBEDDED_CAREERS_IFRAME_URL = 'https://careers.inurture.co.in/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_HOST_PATTERN =
  /(greenhouse|job-boards\.greenhouse|lever|workday|myworkdayjobs|smartrecruiters|ashby|workable|darwinbox|jobvite|teamtailor|recruitcrm|keka|bamboohr|oraclecloud|icims|phenompeople|successfactors|taleo|ceipal|rippling|jobs\.)/i

const PUBLIC_JOBS_TEXT_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview job\b/i,
  /\bjob description\b/i,
  /\bjob title\b/i,
  /\bjob location\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#039;|&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const fetchPageWithStrictTls = (url, redirectCount = 0) =>
  new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const client = parsedUrl.protocol === 'https:' ? https : http
    const request = client.request(parsedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      rejectUnauthorized: true,
    }, (response) => {
      const chunks = []

      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', async () => {
        const html = Buffer.concat(chunks).toString('utf8')
        const location = response.headers.location

        if (
          location
          && Number(response.statusCode) >= 300
          && Number(response.statusCode) < 400
          && redirectCount < 5
        ) {
          try {
            const redirectedUrl = new URL(location, url).toString()
            resolve(await fetchPageWithStrictTls(redirectedUrl, redirectCount + 1))
            return
          } catch (error) {
            reject(error)
            return
          }
        }

        resolve({
          status: Number(response.statusCode) || 0,
          url,
          html,
        })
      })
    })

    request.setTimeout(15000, () => {
      request.destroy(new Error(`Timed out fetching ${url}`))
    })

    request.on('error', reject)
    request.end()
  })

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('India\'s Leading Edtech Company Offering New-Age Programs in New-Age Domains')
    && (
      normalized.includes('iNurture is a pioneering edtech company making waves in the higher education space by offering new-age programs for tomorrow\'s industries.')
      || (
        normalized.includes('Careers @ iNurture')
        && normalized.includes('Managed Classroom')
        && normalized.includes('Global Education')
      )
    )
    && /href=["'](?:https:\/\/(?:www\.)?inurture\.co\.in)?\/careers-inurture\/["']/i.test(String(html ?? ''))
}

export const hasLinkedCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Careers @ iNurture')
    && normalized.includes('Jobs :')
    && normalized.includes('Interested persons may kindly share your resume to this Email Address')
    && /mailto:jobs@inurture\.co\.in/i.test(String(html ?? ''))
    && /9663139827/i.test(String(html ?? ''))
}

export const hasEmbeddedCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return normalized.includes('Careers')
    && new RegExp(`iframe[^>]+src=["']${EMBEDDED_CAREERS_IFRAME_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(rawHtml)
}

export const extractSuspiciousPublicJobLinks = (html, baseUrl = LINKED_CAREERS_URL) => {
  const suspiciousLinks = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const rawTarget = match[1]

    if (/^(mailto:|tel:|javascript:|#)/i.test(rawTarget)) {
      continue
    }

    const absoluteUrl = toAbsoluteUrl(rawTarget, baseUrl)
    if (!absoluteUrl || seen.has(absoluteUrl)) continue

    const parsedUrl = new URL(absoluteUrl)
    const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '').toLowerCase() || '/'
    const isApprovedFirstPartyRoute = [
      '/careers-inurture',
      '/careers',
    ].includes(normalizedPath)

    if (
      PUBLIC_JOBS_HOST_PATTERN.test(parsedUrl.hostname)
      || (
        parsedUrl.hostname === 'www.inurture.co.in'
        && !isApprovedFirstPartyRoute
        && /\/(jobs?|openings?|positions?|vacanc(?:y|ies)|apply)(\/|$)/i.test(normalizedPath)
      )
    ) {
      seen.add(absoluteUrl)
      suspiciousLinks.push(absoluteUrl)
    }
  }

  return suspiciousLinks
}

export const hasSuspiciousPublicJobsText = (html) =>
  PUBLIC_JOBS_TEXT_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isExpectedIframeHostFailure = (error) =>
  /(enotfound|getaddrinfo|could not resolve host|fetch failed|timed out)/i.test(String(error?.message ?? error ?? ''))

export const createInurtureEducationSolutionsScraper = () => ({
  async run({ fetchPage = fetchPageWithStrictTls } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('iNurture verified official homepage no longer matches the known public surface')
    }

    const linkedCareersPage = await fetchPage(LINKED_CAREERS_URL)
    if (linkedCareersPage.status !== 200 || !hasLinkedCareersSignal(linkedCareersPage.html)) {
      throw new Error('iNurture linked careers page no longer matches the verified email-only shell')
    }

    const suspiciousLinkedCareersLinks = extractSuspiciousPublicJobLinks(
      linkedCareersPage.html,
      LINKED_CAREERS_URL,
    )
    if (
      suspiciousLinkedCareersLinks.length > 0
      || hasSuspiciousPublicJobsText(linkedCareersPage.html)
    ) {
      throw new Error('iNurture linked careers page now exposes public job links')
    }

    const embeddedCareersPage = await fetchPage(EMBEDDED_CAREERS_URL)
    if (
      extractSuspiciousPublicJobLinks(embeddedCareersPage.html, EMBEDDED_CAREERS_URL).length > 0
      || hasSuspiciousPublicJobsText(embeddedCareersPage.html)
    ) {
      throw new Error('iNurture embedded careers page changed materially or now exposes public jobs')
    }

    if (embeddedCareersPage.status !== 200 || !hasEmbeddedCareersSignal(embeddedCareersPage.html)) {
      throw new Error('iNurture embedded careers page changed materially or no longer exposes the verified first-party iframe handoff')
    }

    try {
      const iframeHandoffPage = await fetchPage(EMBEDDED_CAREERS_IFRAME_URL)

      throw new Error(
        `iNurture iframe handoff host now resolves or changed materially (status ${iframeHandoffPage.status})`,
      )
    } catch (error) {
      if (!isExpectedIframeHostFailure(error)) {
        throw error
      }
    }

    return []
  },
})

export const run = async (options = {}) => createInurtureEducationSolutionsScraper().run(options)

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
