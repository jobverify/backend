export const SOURCE = 'workhall'
export const COMPANY = 'Workhall Pvt Ltd'
export const VERIFIED_AT = '2026-08-13'
export const HOMEPAGE_URL = 'https://workhall.co/'
export const CAREERS_ROUTE_URLS = [
  'https://workhall.co/careers',
  'https://workhall.co/careers/',
  'https://workhall.co/career',
  'https://workhall.co/career/',
  'https://workhall.co/jobs',
  'https://workhall.co/jobs/',
  'https://workhall.co/join-us',
  'https://workhall.co/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview jobs\b/i,
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

const NOT_FOUND_SIGNAL_PATTERNS = [
  /\b404\b/i,
  /\bpage not found\b/i,
  /\bnot found\b/i,
  /\bdoesn'?t exist\b/i,
  /\bcan't seem to find\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isSameOfficialDomain = (value) => {
  try {
    return new URL(value || HOMEPAGE_URL).hostname === 'workhall.co'
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return (normalized.includes('workhall') || normalized.includes('work hall'))
    && (
      normalized.includes('workhall.co')
      || normalized.includes('www.workhall.co')
      || normalized.includes('co-working space')
      || normalized.includes('co working space')
      || normalized.includes('private offices')
    )
    && (
      normalized.includes('book my space')
      || normalized.includes('book my tour')
      || normalized.includes('workspace')
      || normalized.includes('workhall.co')
    )
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasCloudflare522TimeoutSignal = (page = {}) => {
  if (!isSameOfficialDomain(page.url || HOMEPAGE_URL)) {
    return false
  }

  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  return Number(page.status) === 522
    && /522:\s*connection timed out/i.test(html)
    && normalized.includes('error code 522')
    && normalized.includes('cloudflare working')
    && normalized.includes('host error')
}

export const isVerifiedNoPublicJobsRoute = (page = {}) => {
  if (!isSameOfficialDomain(page.url || HOMEPAGE_URL)) {
    return false
  }

  if (hasCloudflare522TimeoutSignal(page)) {
    return true
  }

  if (hasPublicJobsSignal(page.html)) {
    return false
  }

  if (Number(page.status) === 404) {
    return true
  }

  const normalized = normalizeWhitespace(page.html).toLowerCase()
  return hasOfficialHomepageSignal(page.html)
    || NOT_FOUND_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const createWorkhallScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (!hasCloudflare522TimeoutSignal(homepage) && (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html))) {
      throw new Error('Workhall verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Workhall homepage now appears to expose a public jobs surface')
    }

    const careersRoutes = await Promise.all(
      CAREERS_ROUTE_URLS.map(async (careersRouteUrl) => ({
        careersRouteUrl,
        careersRoute: await fetchPage(careersRouteUrl),
      })),
    )

    for (const { careersRouteUrl, careersRoute } of careersRoutes) {
      if (!isVerifiedNoPublicJobsRoute(careersRoute)) {
        throw new Error('Workhall careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createWorkhallScraper().run(options)
