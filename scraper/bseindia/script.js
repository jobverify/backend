import path from 'node:path'
import http2 from 'node:http2'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const BUNDLE_DIRECTORY_URL = 'https://www.bseindia.com/assets/includenew/js/'

export const SOURCE = 'bseindia'
export const COMPANY = 'BSE India'
export const CAREERS_URL = 'https://www.bseindia.com/static/about/careers'
export const SITEMAP_URL = 'https://www.bseindia.com/sitemap.xml'
export const APPLICATION_URL = 'https://bsegenie.darwinbox.in/ms/candidatev2/main/careers/home'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_ROUTE_PATTERN = /\/(?:careers?|jobs?|openings?|vacancies?)(?:\/|$)/i
const ATS_SIGNAL_PATTERNS = [
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /ashbyhq\.com/i,
  /smartrecruiters/i,
  /darwinbox/i,
  /freshteam/i,
  /workable/i,
  /recruitee/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim()

const hasUnexpectedAtsSignal = (value) =>
  ATS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const extractBundleUrl = (html) => {
  const match = String(html ?? '').match(/<script[^>]+src=["']([^"']*assets\/includenew\/js\/main-[^"']+\.js)["']/i)
  if (!match?.[1]) return null

  try {
    return new URL(match[1], CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersShell = (html) => {
  const page = String(html ?? '')
  const canonical = normalizeWhitespace(page.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? '')
  const hasCurrentAngularShell =
    /<title[^>]*>[\s\S]*BSE(?:\s*SENSEX|\s*\(formerly Bombay Stock Exchange\))[\s\S]*<\/title>/i.test(page)
    && /<base\s+href=["']\/["']/i.test(page)

  return (canonical === CAREERS_URL || hasCurrentAngularShell)
    && /<app-root\b[^>]*>/i.test(page)
    && extractBundleUrl(page) != null
    && !hasUnexpectedAtsSignal(page)
}

export const hasVerifiedSitemapSignal = (xml) => {
  const text = normalizeWhitespace(xml)
  return /<urlset\b/i.test(text)
    && text.includes('<loc>https://www.bseindia.com/markets/jobprocessstatus</loc>')
}

export const sitemapExposesPublicJobsRoute = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .some((url) => {
      if (!url) return false
      if (url === CAREERS_URL) return false
      if (/\/markets\/jobprocessstatus\/?$/i.test(url)) return false
      return PUBLIC_JOBS_ROUTE_PATTERN.test(url)
    })

export const hasOfficialBundleSignal = (bundleJs) => {
  const script = String(bundleJs ?? '')
  const normalized = normalizeWhitespace(script)

  return normalized.includes('/static/about/careers')
    && normalized.includes('Careers')
    && !hasUnexpectedAtsSignal(script)
}

const extractImportedChunkUrl = (bundleJs, route, exportName) => {
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedExport = exportName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`path:["']${escapedRoute}["'],loadChildren:\\(\\)=>import\\(["']\\./(chunk-[A-Z0-9]+\\.js)["']\\)\\.then\\(\\w+=>\\w+\\.${escapedExport}\\)`)
  const chunkName = String(bundleJs ?? '').match(pattern)?.[1]
  return chunkName ? new URL(chunkName, BUNDLE_DIRECTORY_URL).toString() : null
}

export const extractStaticRoutesChunkUrl = (bundleJs) =>
  extractImportedChunkUrl(bundleJs, 'static', 'staticRoutesOnly')

export const extractAboutRoutesChunkUrl = (bundleJs) =>
  extractImportedChunkUrl(bundleJs, 'about', 'staticAboutRoutes')

export const hasVerifiedCareersRoute = (bundleJs) => {
  const script = String(bundleJs ?? '')
  return /path:["']careers["']/.test(script)
    && script.includes('Careers at BSE')
    && script.includes(APPLICATION_URL)
}

const decodeBundleText = (value) => String(value ?? '')
  .replace(/\\u([\da-f]{4})/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeOpeningTitle = (value) => {
  const normalized = decodeBundleText(value)
    .replace(/^Hiring\s+Post\s*-\s*/i, '')
    .replace(/^Hiring\s+Finance\s*:\s*/i, '')
    .trim()

  return normalized || null
}

const deriveDepartment = (title) => {
  if (/financial planning|finance/i.test(title)) return 'Others'
  if (/online surveillance|investigation|listing compliance/i.test(title)) return 'Regulatory'
  return null
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const extractCurrentOpeningsFromBundle = (bundleJs, {
  scrapedAt = new Date().toISOString(),
  applyUrl = 'mailto:careers@bseindia.com',
} = {}) => {
  const script = String(bundleJs ?? '')
  const seen = new Set()
  const titles = [
    ...script.matchAll(/["'`]((?:Hiring\s+Post\s*-\s*|Hiring\s+Finance\s*:\s*)[^"'`]+)["'`]/gi),
  ]
    .map((match) => normalizeOpeningTitle(match[1]))
    .filter(Boolean)

  return titles
    .map((title) => {
      const dedupeKey = title.toLowerCase()
      if (seen.has(dedupeKey)) return null
      seen.add(dedupeKey)

      const jobId = `${SOURCE}-${slugify(title)}`

      return {
        title,
        company: COMPANY,
        department: deriveDepartment(title),
        location: 'India',
        city: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: CAREERS_URL,
        applyUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: null,
        source: SOURCE,
        link: applyUrl,
        scrapedAt,
      }
    })
    .filter(Boolean)
}

export const fetchTextOverHttp2 = async (url, { timeoutMs = 20000, redirects = 5 } = {}) => {
  const target = new URL(url)
  const response = await new Promise((resolve, reject) => {
    const client = http2.connect(target.origin)
    let settled = false
    let status
    let location
    let size = 0
    const chunks = []
    const finish = (error, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      client.destroy()
      if (error) reject(error)
      else resolve(value)
    }
    const timer = setTimeout(() => finish(new Error(`BSE request timed out after ${timeoutMs}ms at ${url}`)), timeoutMs)
    client.on('error', (error) => finish(error))
    const request = client.request({
      ':path': `${target.pathname}${target.search}`,
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    })
    request.on('response', (headers) => {
      status = headers[':status']
      location = headers.location
    })
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > 16 * 1024 * 1024) return finish(new Error(`BSE response exceeded 16 MB at ${url}`))
      chunks.push(chunk)
    })
    request.on('error', (error) => finish(error))
    request.on('end', () => finish(null, { status, location, text: Buffer.concat(chunks).toString('utf8') }))
    request.on('close', () => {
      if (!settled) finish(new Error(`BSE response closed before completion at ${url}`))
    })
    request.end()
  })
  if ([301, 302, 303, 307, 308].includes(response.status) && response.location) {
    if (redirects <= 0) throw new Error(`BSE redirect limit exceeded at ${url}`)
    const nextUrl = new URL(response.location, target)
    if (target.protocol === 'https:' && nextUrl.protocol !== 'https:') throw new Error('BSE redirect would downgrade HTTPS')
    return fetchTextOverHttp2(nextUrl.href, { timeoutMs, redirects: redirects - 1 })
  }
  if (!(response.status >= 200 && response.status < 300)) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text
}

const defaultFetchText = (url) => fetchTextOverHttp2(url)

export const createBseIndiaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersShell(careersHtml)) {
      throw new Error('BSE India careers shell no longer matches the verified first-party public surface')
    }

    const sitemapXml = await fetchText(SITEMAP_URL)
    if (!hasVerifiedSitemapSignal(sitemapXml)) {
      throw new Error('BSE India sitemap no longer matches the verified first-party public careers surface')
    }

    if (sitemapExposesPublicJobsRoute(sitemapXml)) {
      throw new Error('BSE India sitemap now exposes a public jobs route; implement a real scraper after re-verifying the first-party jobs surface')
    }

    const bundleUrl = extractBundleUrl(careersHtml)
    const bundleJs = await fetchText(bundleUrl)
    if (!hasOfficialBundleSignal(bundleJs)) {
      throw new Error('BSE India frontend bundle no longer matches the verified first-party careers shell')
    }

    const inlineJobs = extractCurrentOpeningsFromBundle(bundleJs)
    if (inlineJobs.length > 0) return inlineJobs

    const staticChunkUrl = extractStaticRoutesChunkUrl(bundleJs)
    if (!staticChunkUrl) throw new Error('BSE India frontend no longer exposes the verified static careers route')
    const staticChunkJs = await fetchText(staticChunkUrl)
    const aboutChunkUrl = extractAboutRoutesChunkUrl(staticChunkJs)
    if (!aboutChunkUrl) throw new Error('BSE India frontend no longer exposes the verified about careers route')
    const aboutChunkJs = await fetchText(aboutChunkUrl)
    if (!hasVerifiedCareersRoute(aboutChunkJs)) {
      throw new Error('BSE India careers route or application portal no longer matches the verified public surface')
    }
    return extractCurrentOpeningsFromBundle(aboutChunkJs, { applyUrl: APPLICATION_URL })
  },
})

export const run = async (options = {}) => createBseIndiaScraper().run(options)

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
