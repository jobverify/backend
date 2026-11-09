import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'codeapt'
export const COMPANY = 'CodeApt'
export const HOMEPAGE_URL = 'https://www.codeapt.in/'
export const CAREERS_URL = 'https://www.codeapt.in/careers/'
export const CAREERS_API_URL = 'https://api.codeapt.in/api/careers'
export const VERIFIED_ON = '2026-08-07'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const CARD_MARKER = '<div class="card shadow-sm border-0 mb-4 hover-shadow transition-all">'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeStructuredText = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<p\b[^>]*>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\r/g, '')
  .split('\n')
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .join('\n')

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

export const extractBundleUrl = (html, pageUrl = HOMEPAGE_URL) =>
  toAbsoluteUrl(
    String(html ?? '').match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i)?.[1],
    pageUrl,
  )

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null

  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

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

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: '*/*',
    },
    signal: createTimeoutSignal(15000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchResource = async (url, { accept = '*/*' } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: accept,
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    text: await response.text(),
  }
}

const extractFirst = (pattern, value) => {
  const match = String(value ?? '').match(pattern)
  return match ? normalizeWhitespace(match[1]) : null
}

const extractLabeledValue = (label, text) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(text ?? '').match(new RegExp(`(?:^|\\n)${escaped}\\s*:\\s*([^\\n]+)`, 'i'))
  return match ? normalizeWhitespace(match[1]) : null
}

const inferRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase()
  if (normalized.includes('remote')) return 'Remote'
  if (normalized.includes('hybrid')) return 'Hybrid'
  return 'On-site'
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
    .replace(/^in office\s*\|\s*/i, '')
    .trim()

  if (!normalized) return null
  if (/pan india/i.test(normalized)) return 'Pan India, India'
  if (/india/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const toCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const extractApplyUrl = (cardHtml) => {
  const href = extractFirst(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*target=["']_blank["'][^>]*>\s*Apply on Company Site/i,
    cardHtml,
  )
  const absoluteUrl = toAbsoluteUrl(href)

  if (!absoluteUrl) return null

  try {
    const url = new URL(absoluteUrl)
    if (['codeapt.in', 'www.codeapt.in'].includes(url.hostname)) {
      return null
    }
  } catch {
    return null
  }

  return absoluteUrl
}

const extractJobId = (cardHtml, title) => {
  const internalId = extractFirst(/id=["']action-group-(\d+)["']/i, cardHtml)
  if (internalId) return `${SOURCE}-${internalId}`
  return `${SOURCE}-${slugify(title)}`
}

const extractRequisitionId = (description, applyUrl) => {
  const explicitJobId = extractLabeledValue('Job ID', description)
  if (explicitJobId) return explicitJobId

  try {
    const url = new URL(applyUrl)
    const fromPath = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean).at(-1)
    return normalizeWhitespace(fromPath)
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*CodeApt\s*\|\s*Home\s*-\s*CodeApt\s*<\/title>/i.test(page)
    && normalized.includes('redefining campus placement training')
    && normalized.includes('codeapt llp')
    && /href=["']\/placements\/["']/i.test(page)
    && /href=["']\/careers\/["']/i.test(page)
  }

export const hasOfficialShellSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*CodeApt\s*<\/title>/i.test(page)
    && /<div\s+id=["']root["']>\s*<\/div>/i.test(page)
    && /viewport-fit=cover/i.test(page)
    && Boolean(extractBundleUrl(page, HOMEPAGE_URL))
}

export const hasVerifiedCareersLink = (html) =>
  /href=["'](?:https:\/\/www\.codeapt\.in\/careers\/|\/careers\/)["']/i.test(String(html ?? ''))

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*CodeApt\s*\|\s*Careers\s*(?:&amp;|&)\s*Openings\s*-\s*CodeApt\s*<\/title>/i.test(page)
    && normalized.includes('career opportunities')
    && normalized.includes('exclusive job openings for codeapt students')
    && normalized.includes('apply on company site')
  }

export const hasVerifiedApiBackedCareersSignal = (bundleText) => {
  const page = String(bundleText ?? '')

  return /https:\/\/api\.codeapt\.in/i.test(page)
    && /CareersPage-[A-Za-z0-9_-]+\.js/i.test(page)
    && /PostingDetailPage-[A-Za-z0-9_-]+\.js/i.test(page)
    && /careers:\{list:async/i.test(page)
    && page.includes('careers/${e}/apply')
}

export const isAuthRequiredCareersApiResponse = (response) =>
  Number(response?.status) === 401
  && /Authentication required/i.test(String(response?.text ?? ''))

export const extractPublicJobs = (html) => String(html ?? '')
  .split(CARD_MARKER)
  .slice(1)
  .map((cardHtml) => {
    const title = extractFirst(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i, cardHtml)
    const cardCompany = extractFirst(/<h6\b[^>]*>([\s\S]*?)<\/h6>/i, cardHtml)
    const location = normalizeLocation(extractFirst(/<span\b[^>]*class=["'][^"']*badge[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, cardHtml))
    const descriptionHtml = String(cardHtml.match(/<p class="text-muted mb-0">([\s\S]*?)<small class="text-muted mt-2 d-block">/i)?.[1] ?? '')
    const jobDescription = normalizeStructuredText(descriptionHtml) || null
    const applyUrl = extractApplyUrl(cardHtml)
    const postingDate = toIsoDate(
      extractFirst(/<small\b[^>]*>\s*Posted:\s*([^<]+)<\/small>/i, cardHtml)
      || extractLabeledValue('Date posted', jobDescription),
    )

    if (!title || !applyUrl) return null

    const jobId = extractJobId(cardHtml, title)
    const remoteStatus = inferRemoteStatus(location || jobDescription)

    return {
      title,
      company: COMPANY,
      department: cardCompany,
      location,
      city: toCity(location),
      country: 'India',
      jobId,
      requisitionId: extractRequisitionId(jobDescription, applyUrl),
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: extractLabeledValue('Employment type', jobDescription),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription,
      remoteStatus,
    }
  })
  .filter(Boolean)

export const createCodeAptScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
    fetchResource = defaultFetchResource,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status === 200 && hasOfficialHomepageSignal(homepage.html)) {
      if (!hasVerifiedCareersLink(homepage.html)) {
        throw new Error('CodeApt homepage no longer links to the verified careers page')
      }

      const careersPage = await fetchPage(CAREERS_URL)

      if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
        throw new Error('CodeApt verified careers page no longer matches the known public surface')
      }

      const jobs = extractPublicJobs(careersPage.html)

      if (jobs.length === 0) {
        throw new Error('CodeApt careers page no longer exposes the verified public job-card structure')
      }

      return jobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }))
    }

    if (homepage.status !== 200 || !hasOfficialShellSignal(homepage.html)) {
      throw new Error('CodeApt official homepage no longer matches the verified first-party surface')
    }

    const bundleUrl = extractBundleUrl(homepage.html, homepage.url || HOMEPAGE_URL)
    const bundleText = await fetchText(bundleUrl)

    if (!hasVerifiedApiBackedCareersSignal(bundleText)) {
      throw new Error('CodeApt verified homepage shell changed; refusing to assume no public listings')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialShellSignal(careersPage.html)) {
      throw new Error('CodeApt verified careers shell changed; refusing to assume no public listings')
    }

    const apiResponse = await fetchResource(CAREERS_API_URL, {
      accept: 'application/json,text/plain,*/*',
    })

    if (apiResponse.status === 200) {
      throw new Error('CodeApt careers API is now publicly accessible and needs a structured scraper')
    }

    if (!isAuthRequiredCareersApiResponse(apiResponse)) {
      throw new Error('CodeApt verified careers API changed; refusing to assume no public listings')
    }

    return []
  },
})

export const run = async (options = {}) => createCodeAptScraper().run(options)

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
