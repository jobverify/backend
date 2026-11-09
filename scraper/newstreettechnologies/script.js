import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'newstreettechnologies'
export const COMPANY = 'New Street Technologies'
export const HOMEPAGE_URL = 'https://newstreettech.com/'
export const CONTACT_URL = 'https://newstreettech.com/contact'
export const PUBLIC_JOB_ROUTE_URLS = [
  'https://newstreettech.com/careers',
  'https://newstreettech.com/careers/',
  'https://newstreettech.com/career',
  'https://newstreettech.com/career/',
  'https://newstreettech.com/jobs',
  'https://newstreettech.com/jobs/',
  'https://newstreettech.com/join-us',
  'https://newstreettech.com/join-us/',
  'https://newstreettech.com/work-with-us',
  'https://newstreettech.com/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_BODY_TEXT_SIGNALS = [
  'Leveraging blockchain, AI, and new age technologies to create Hi-tech Ecosystems for powerful re-imagination of your Products, Processes & Partnerships.',
  'Explore MiFiX.ai',
]

const CONTACT_BODY_TEXT_SIGNALS = [
  'New Street Technologies Pvt Ltd',
  'Bengaluru, Karnataka - 560017',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview jobs\b/i,
  /\bjob description\b/i,
  /\bapply now\b/i,
  /\bvacanc(?:y|ies)\b/i,
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
]

const TLS_CERTIFICATE_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'ERR_CERT_DATE_INVALID',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
])

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

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&#x27;|\u2019/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const hasTlsCertificateError = (error) => {
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)

    const code = normalizeWhitespace(current?.code)?.toUpperCase()
    if (code && TLS_CERTIFICATE_ERROR_CODES.has(code)) {
      return true
    }

    const message = normalizeWhitespace(current?.message || current)
    if (
      message
      && /unable to verify the first certificate|certificate has expired|self signed certificate|unable to get local issuer certificate/i.test(message)
    ) {
      return true
    }

    current = current?.cause
  }

  return false
}

export const fetchPageIgnoringTlsErrors = (url, redirectCount = 0) => new Promise((resolve, reject) => {
  if (redirectCount > 5) {
    reject(new Error(`Too many redirects while loading ${url}`))
    return
  }

  const target = new URL(url)
  const request = https.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || 443,
    path: `${target.pathname}${target.search}`,
    method: 'GET',
    rejectUnauthorized: true,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  }, (response) => {
    const status = Number(response.statusCode) || 0
    const location = normalizeWhitespace(response.headers?.location)
    if (location && status >= 300 && status < 400) {
      response.resume()
      const redirectedUrl = new URL(location, url).toString()
      fetchPageIgnoringTlsErrors(redirectedUrl, redirectCount + 1).then(resolve, reject)
      return
    }

    let html = ''
    response.setEncoding('utf8')
    response.on('data', (chunk) => {
      html += chunk
    })
    response.on('end', () => {
      resolve({
        status,
        url,
        html,
      })
    })
    response.on('error', reject)
  })

  request.setTimeout(15000, () => {
    request.destroy(new Error(`TLS fallback timed out for ${url}`))
  })
  request.on('error', reject)
  request.end()
})

export const createDefaultFetchPage = ({
  fetchImpl = fetch,
  fetchInsecurePageImpl = fetchPageIgnoringTlsErrors,
} = {}) => async (url) => {
  try {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: createTimeoutSignal(15000),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  } catch (error) {
    if (!hasTlsCertificateError(error)) {
      throw error
    }

    return fetchInsecurePageImpl(url)
  }
}

const defaultFetchPage = createDefaultFetchPage()

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*New Street Technologies Pvt Ltd\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']New Street Technologies leverages blockchain, AI, and new age technologies to create Hi-tech Ecosystems for powerful re-imagination of your Products, Processes &amp; Partnerships\.[^"']*["']/i.test(page)
    && HOMEPAGE_BODY_TEXT_SIGNALS.every((signal) => normalized.includes(signal))
    && /href=["']\/contact["']/i.test(page)
    && /https:\/\/www\.linkedin\.com\/company\/newstreettech/i.test(page)
    && /https:\/\/mifix\.ai\/?/i.test(page)
}

export const hasInlineHiringSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /href=["']mailto:hr@newstreettech\.com["']/i.test(page)
    && />\s*Hiring\s*</i.test(page)
    && normalized.includes('Get in Touch')
}

export const hasOfficialContactSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Contact\s*[—-]\s*New Street Technologies\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Get in touch with New Street Technologies\. Our offices in Bengaluru and Dubai, plus social channels and a direct message form\.[^"']*["']/i.test(page)
    && CONTACT_BODY_TEXT_SIGNALS.every((signal) => normalized.includes(signal))
    && /href=["']mailto:hr@newstreettech\.com["']/i.test(page)
    && /href=["']mailto:info@newstreettech\.com["']/i.test(page)
  }

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const extractCareerRoleUrls = (html) => {
  const page = String(html ?? '')
  if (!/<title>\s*Careers\s*—\s*New Street Technologies\s*<\/title>/i.test(page)
    || !/<h1[^>]*>\s*Open Roles\s*<\/h1>/i.test(page)) {
    throw new Error('New Street Technologies official careers page no longer matches the verified listing')
  }

  const advertisedCount = normalizeWhitespace(page).match(/\bAll roles\s*·\s*(\d+)\b/i)
  const paths = [...page.matchAll(/<a\b[^>]*href=["'](\/careers\/[a-z0-9-]+)["']/gi)]
    .map((match) => match[1])
  const uniquePaths = [...new Set(paths)]
  if (!advertisedCount || paths.length !== uniquePaths.length
    || Number(advertisedCount[1]) !== uniquePaths.length) {
    throw new Error('New Street Technologies careers role count does not match the first-party listing')
  }

  return uniquePaths.map((rolePath) => new URL(rolePath, PUBLIC_JOB_ROUTE_URLS[0]).toString())
}

const extractRoleField = (html, label) => {
  const match = String(html ?? '').match(
    new RegExp('<p[^>]*>\\s*' + label + '\\s*<\\/p>[\\s\\S]{0,500}?<p[^>]*>([^<]+)<\\/p>', 'i'),
  )
  return normalizeWhitespace(match?.[1])
}

const extractCareerRole = (html, sourceUrl, scrapedAt) => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title>\s*([\s\S]*?)\s*—\s*Careers at New Street Technologies\s*<\/title>/i)?.[1])
  const heading = normalizeWhitespace(page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const description = normalizeWhitespace(page.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1])
  const experience = extractRoleField(page, 'Experience')
  const location = extractRoleField(page, 'Location')
  if (!title || !heading || heading.replace(/[·—]/g, '-') !== title.replace(/[·—]/g, '-')
    || !description || !experience || !location
    || !/<button[^>]*aria-haspopup=["']dialog["'][^>]*>\s*Apply for this role/i.test(page)) {
    throw new Error('New Street Technologies verified role or application surface has changed')
  }

  const slug = new URL(sourceUrl).pathname.split('/').at(-1)
  return {
    company: COMPANY,
    title: heading,
    location: /bengaluru|bangalore/i.test(location) ? 'Bengaluru, Karnataka, India' : location,
    city: /bengaluru|bangalore/i.test(location) ? 'Bengaluru' : null,
    country: 'India',
    link: sourceUrl,
    applyUrl: sourceUrl,
    sourceUrl,
    source: SOURCE,
    jobId: slug,
    department: null,
    employmentType: null,
    experienceRequired: experience,
    jobDescription: description,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    remoteStatus: 'On-site',
    scrapedAt,
  }
}

export const createNewStreetTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage, now = () => new Date().toISOString() } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('New Street Technologies verified official homepage no longer matches the known public surface')
    }

    if (!hasInlineHiringSignal(homepage.html)) {
      throw new Error('New Street Technologies verified inline hiring surface no longer matches the trusted zero-job state')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('New Street Technologies homepage now appears to expose public openings')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('New Street Technologies verified contact page no longer matches the trusted hiring contact surface')
    }

    if (hasPublicJobsSignal(contactPage.html)) {
      throw new Error('New Street Technologies contact page now appears to expose public openings')
    }

    const careersPage = await fetchPage(PUBLIC_JOB_ROUTE_URLS[0])
    if (careersPage.status === 200) {
      const roleUrls = extractCareerRoleUrls(careersPage.html)
      const scrapedAt = now()
      const jobs = []
      for (const roleUrl of roleUrls) {
        const rolePage = await fetchPage(roleUrl)
        if (rolePage.status !== 200 || new URL(rolePage.url).origin !== new URL(roleUrl).origin) {
          throw new Error('New Street Technologies verified role page is unavailable or redirected away')
        }
        const job = extractCareerRole(rolePage.html, roleUrl, scrapedAt)
        if (/bengaluru|bangalore|\bindia\b/i.test(job.location)) {
          jobs.push(job)
        }
      }
      return jobs
    }

    if (careersPage.status !== 404) {
      throw new Error('New Street Technologies official careers page is unavailable')
    }

    for (const routeUrl of PUBLIC_JOB_ROUTE_URLS.slice(1)) {
      const routePage = await fetchPage(routeUrl)
      if (routePage.status !== 404) {
        throw new Error(`New Street Technologies public jobs route ${routeUrl} no longer matches the verified 404 zero-job state`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createNewStreetTechnologiesScraper().run(options)

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
