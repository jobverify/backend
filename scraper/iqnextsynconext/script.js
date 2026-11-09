import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'iqnextsynconext'
export const COMPANY = 'IQnext (Synconext)'
export const HOMEPAGE_URL = 'https://www.iqnext.io/'
export const CAREERS_URL = 'https://www.iqnext.io/careers'
export const WELLFOUND_JOBS_URL = 'https://wellfound.com/company/iqnext/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toTitleFromJobUrl = (value) => {
  const slug = String(value ?? '').match(/\/jobs\/\d+-([a-z0-9-]+)/i)?.[1]
  if (!slug) return null

  return slug
    .split('-')
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(' ')
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

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(timeoutMs),
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    headers: {
      location: response.headers.get('location'),
      server: response.headers.get('server'),
      'cf-mitigated': response.headers.get('cf-mitigated'),
    },
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return rawHtml.includes('data-wf-domain="www.iqnext.io"')
    && /<title>\s*IoT Based Platform for Smart Building Management - IQnext\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+(?:href=["']https:\/\/www\.iqnext\.io\/?["'][^>]+rel=["']canonical["']|rel=["']canonical["'][^>]+href=["']https:\/\/www\.iqnext\.io\/?["'])/i.test(rawHtml)
    && normalized.includes('IQnext is a centralised platform that is redefining building operations')
    && normalized.includes('Building operations efficiency energy maintenance made exceptionally easy')
    && normalized.includes('Trusted by forward thinking buildings')
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return rawHtml.includes('data-wf-domain="www.iqnext.io"')
    && /<title>\s*Careers \| IQnext\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+(?:href=["']https:\/\/www\.iqnext\.io\/careers\/?["'][^>]+rel=["']canonical["']|rel=["']canonical["'][^>]+href=["']https:\/\/www\.iqnext\.io\/careers\/?["'])/i.test(rawHtml)
    && normalized.includes('Your ideas can power the future of sustainable spaces')
    && normalized.includes('Take ownership, grow faster, and make an impact that matters')
    && normalized.includes('See Open Positions')
    && normalized.includes('Why Join IQnext')
    && normalized.includes('Transforming an Industry')
}

export const extractWellfoundJobsUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
    try {
      const url = new URL(match[1], CAREERS_URL)
      const hostname = url.hostname.toLowerCase()
      const pathname = url.pathname.replace(/\/+$/, '')

      if (
        hostname === 'angel.co'
        && pathname === '/company/iqnext/jobs'
      ) {
        return WELLFOUND_JOBS_URL
      }

      if (
        hostname === 'wellfound.com'
        && pathname === '/company/iqnext/jobs'
      ) {
        return WELLFOUND_JOBS_URL
      }
    } catch {
      continue
    }
  }

  return null
}

export const isVerifiedWellfoundChallenge = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()
  const responseUrl = String(page?.url ?? '')
  const challengeHeader = String(page?.headers?.['cf-mitigated'] ?? '').toLowerCase()
  const serverHeader = String(page?.headers?.server ?? '').toLowerCase()
  const isVerifiedWellfoundUrl =
    responseUrl === WELLFOUND_JOBS_URL
    || responseUrl.startsWith('https://wellfound.com/')
  const hasLegacyChallengeSignal =
    normalized.includes('please enable js and disable any ad blocker')
    && rawHtml.toLowerCase().includes('captcha-delivery.com')
  const hasCurrentCloudflareChallengeSignal =
    /<title>\s*Security Check\s*\|\s*Wellfound\s*<\/title>/i.test(rawHtml)
    && normalized.includes('security check')
    && normalized.includes('enable javascript and cookies to continue')
    && rawHtml.toLowerCase().includes('window._cf_chl_opt')
    && rawHtml.toLowerCase().includes('challenge-platform')
    && normalized.includes('ray id')
    && normalized.includes('wellfound')
  const hasLegacyCloudflareChallengeSignal =
    /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(rawHtml)
    && /noindex,nofollow/i.test(rawHtml)
    && normalized.includes('enable javascript and cookies to continue')
    && (
      rawHtml.toLowerCase().includes('window._cf_chl_opt')
      || rawHtml.toLowerCase().includes('cf_chl_opt')
    )
    && rawHtml.toLowerCase().includes('challenge-platform')
    && normalized.includes('ray id')
  const hasCloudflareHeaders =
    challengeHeader === 'challenge'
    && serverHeader.includes('cloudflare')

  return Number(page?.status) === 403
    && isVerifiedWellfoundUrl
    && (
      hasLegacyChallengeSignal
      || ((hasCurrentCloudflareChallengeSignal || hasLegacyCloudflareChallengeSignal) && hasCloudflareHeaders)
    )
}

export const hasAccessibleWellfoundJobsSignal = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page?.status) === 200
    && String(page?.url ?? '').replace(/\/+$/, '') === WELLFOUND_JOBS_URL
    && /<title>\s*Jobs at IQnext:\s*Explore current Opportunities\s*<\/title>/i.test(rawHtml)
    && /Jobs at IQnext/i.test(normalized)
    && /View\s+\d+\s+job/i.test(normalized)
}

export const extractAccessibleWellfoundJobs = (page = {}) => {
  if (!hasAccessibleWellfoundJobsSignal(page)) {
    throw new Error('IQnext (Synconext) verified public jobs board no longer matches the known Wellfound surface')
  }

  const rawHtml = String(page?.html ?? '')
  const matches = Array.from(
    rawHtml.matchAll(/<a[^>]+href=["'](https:\/\/wellfound\.com\/jobs\/\d+-[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  )

  return matches.map((match, index) => {
    const nextIndex = matches[index + 1]?.index ?? rawHtml.length
    const chunk = rawHtml.slice(match.index, nextIndex)
    const paragraphs = Array.from(
      chunk.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi),
      (paragraphMatch) => normalizeWhitespace(paragraphMatch[1]),
    ).filter(Boolean)
    const sourceUrl = match[1]
    const title = normalizeWhitespace(match[2]) || toTitleFromJobUrl(sourceUrl)
    const department = paragraphs.find((value) =>
      /^(Sales|Engineering|Product|Marketing|Operations|Design|People|Finance|Customer Success|Business Development)$/i.test(value),
    ) || null
    const locationLine = paragraphs.find((value) => /^(In office|On-site|Onsite|Remote only|Hybrid)\s+[•|]\s+/i.test(value)) || null
    const city = normalizeWhitespace(locationLine?.replace(/^(In office|On-site|Onsite|Remote only|Hybrid)\s+[•|]\s+/i, '')) || null
    const remoteStatus = locationLine?.toLowerCase().startsWith('remote')
      ? 'Remote'
      : locationLine?.toLowerCase().startsWith('hybrid')
        ? 'Hybrid'
        : 'On-site'
    const employmentType = paragraphs.find((value) => /^(Full Time|Part Time|Contract|Internship|Freelance)$/i.test(value)) || null
    const summaryParagraphs = paragraphs.filter((value) =>
      value !== department
      && value !== locationLine
      && value !== employmentType,
    )
    const jobId = String(sourceUrl.match(/\/jobs\/(\d+)-/i)?.[1] ?? '').trim() || null

    if (!title || !city || !jobId) {
      throw new Error('IQnext (Synconext) verified public jobs board no longer exposes the expected job fields')
    }

    return {
      title,
      company: COMPANY,
      location: `${city}, India`,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      department,
      employmentType,
      experienceRequired: null,
      jobDescription: summaryParagraphs.join(' ') || null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      remoteStatus,
      sourceUrl,
      applyUrl: sourceUrl,
      link: sourceUrl,
    }
  })
}

export const createIqnextSynconextScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('IQnext (Synconext) verified official homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('IQnext (Synconext) verified careers page no longer matches the known public surface')
    }

    const wellfoundJobsUrl = extractWellfoundJobsUrl(careersPage.html)
    if (wellfoundJobsUrl !== WELLFOUND_JOBS_URL) {
      throw new Error('IQnext (Synconext) careers page no longer exposes the verified Wellfound jobs handoff')
    }

    const wellfoundBoard = await fetchPage(WELLFOUND_JOBS_URL)
    if (isVerifiedWellfoundChallenge(wellfoundBoard)) {
      return []
    }

    if (hasAccessibleWellfoundJobsSignal(wellfoundBoard)) {
      return extractAccessibleWellfoundJobs(wellfoundBoard).map((job) => ({
        ...job,
        source: SOURCE,
        scrapedAt: now(),
      }))
    }

    throw new Error('IQnext (Synconext) verified public jobs board no longer matches the known Wellfound surface')
  },
})

export const run = async (options = {}) => createIqnextSynconextScraper().run(options)

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
