export const SOURCE = 'datagrokranalytics'
export const COMPANY = 'Datagrokr Analytics'
export const HOMEPAGE_URL = 'https://datagrokr.com/'
export const CAREERS_ROUTE_URLS = [
  'https://datagrokr.com/careers',
  'https://datagrokr.com/careers/',
  'https://datagrokr.com/jobs',
  'https://datagrokr.com/jobs/',
]
export const UNRESOLVED_CANDIDATE_URLS = [
  'https://datagrokranalytics.com/',
  'https://www.datagrokranalytics.com/',
  'https://datagrokranalytics.in/',
  'https://www.datagrokranalytics.in/',
  'https://datagrokr.ai/',
  'https://www.datagrokr.ai/',
  'https://datagrokranalytics.co.in/',
  'https://www.datagrokranalytics.co.in/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
  /recruitcrm/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isDatagrokrDomain = (value) => {
  try {
    return new URL(value || HOMEPAGE_URL).hostname === 'datagrokr.com'
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  try {
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
      error: null,
    }
  } catch (error) {
    return {
      status: null,
      url,
      html: '',
      error,
    }
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedUnrelatedHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('chicken road')
    && normalized.includes('support@chickenroad.com')
    && (normalized.includes('casino') || normalized.includes('crash jatek') || normalized.includes('curacao'))
    && !normalized.includes('datagrokr analytics')
    && !hasPublicJobsSignal(html)
}

export const isVerifiedUnrelatedCareers404 = (page = {}) => {
  if (!isDatagrokrDomain(page.url || HOMEPAGE_URL)) {
    return false
  }

  if (Number(page.status) !== 404 || hasPublicJobsSignal(page.html)) {
    return false
  }

  const normalized = normalizeWhitespace(page.html).toLowerCase()
  return normalized.includes('404 - page not found - chicken road')
    && normalized.includes('support@chickenroad.com')
    && normalized.includes('chicken road')
    && !normalized.includes('datagrokr analytics')
}

export const isUnresolvedCandidateDomainError = (error) => {
  if (!error) return false

  const code = String(error?.code || error?.cause?.code || '').toUpperCase()
  const message = String(error?.message || '').toLowerCase()
  const causeMessage = String(error?.cause?.message || '').toLowerCase()
  const combined = `${message} ${causeMessage}`

  return code === 'ENOTFOUND'
    || code === 'EAI_AGAIN'
    || combined.includes('enotfound')
    || combined.includes('name could not be resolved')
    || combined.includes('getaddrinfo')
}

export const createDatagrokrAnalyticsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasVerifiedUnrelatedHomepageSignal(homepage.html)) {
      throw new Error(
        'Datagrokr Analytics homepage no longer matches the verified unrelated July 13, 2026 surface',
      )
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)

      if (!isVerifiedUnrelatedCareers404(careersRoute)) {
        throw new Error(
          'Datagrokr Analytics careers-like routes changed materially or now expose public jobs',
        )
      }
    }

    for (const candidateUrl of UNRESOLVED_CANDIDATE_URLS) {
      const candidatePage = await fetchPage(candidateUrl)

      if (!isUnresolvedCandidateDomainError(candidatePage.error)) {
        throw new Error(
          `Datagrokr Analytics candidate first-party domain now resolves or is no longer unresolved: ${candidateUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createDatagrokrAnalyticsScraper().run(options)
