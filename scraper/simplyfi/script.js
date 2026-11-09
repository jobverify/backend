export const SOURCE = 'simplyfi'
export const COMPANY = 'SimplyFI Softech Pvt. Ltd.'
export const HOMEPAGE_URL = 'https://www.simplyfi.tech/'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.simplyfi.tech/careers',
  'https://www.simplyfi.tech/careers/',
  'https://www.simplyfi.tech/career',
  'https://www.simplyfi.tech/career/',
  'https://www.simplyfi.tech/jobs',
  'https://www.simplyfi.tech/jobs/',
  'https://www.simplyfi.tech/join-us',
  'https://www.simplyfi.tech/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_PATH_PATTERN =
  /(?:^|\/)(career|careers|job|jobs|opening|openings|vacancy|vacancies|join-us|joinus|work-with-us)(?:\/|$)/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bapply now\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /zohorecruit/i,
]

const NOT_FOUND_SIGNAL_PATTERNS = [
  /\b404\b/i,
  /\bpage not found\b/i,
  /\bnot found\b/i,
  /\bdoesn'?t exist\b/i,
  /\bcan't seem to find\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'www.simplyfi.tech' || hostname === 'simplyfi.tech'
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
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('transact with precision. streamline costs. reduce risk. seize opportunity.')
    && normalized.includes('for enterprise organizations seeking to optimize their global trade and supply chain operations')
    && normalized.includes('let us know how we can help')
    && normalized.includes('trade finance')
    && normalized.includes('simplyfi baas')
}

export const hasFirstPartyCareerLikeLink = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl.href)) {
      continue
    }

    if (CAREER_PATH_PATTERN.test(absoluteUrl.pathname)) {
      return true
    }
  }

  return false
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedNoPublicJobsRoute = (page = {}) => {
  if (!isFirstPartyUrl(page.url || HOMEPAGE_URL)) {
    return false
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

export const createSimplyFiScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('SimplyFI verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('SimplyFI homepage now exposes public jobs')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('SimplyFI homepage now exposes a first-party careers or jobs link')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedNoPublicJobsRoute(routePage)) {
        throw new Error('SimplyFI careers routes changed materially or now expose a public careers surface')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSimplyFiScraper().run(options)
