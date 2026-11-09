export const SOURCE = 'urneeds'
export const COMPANY = 'Urneeds'
export const HOMEPAGE_URL = 'https://www.urneeds.in/'
export const LANDER_URL = 'https://www.urneeds.in/lander'
export const CHECKED_ROUTE_URLS = [
  'https://www.urneeds.in/careers',
  'https://www.urneeds.in/career',
  'https://www.urneeds.in/jobs',
  'https://www.urneeds.in/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
]

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

export const extractRedirectTarget = (html) => {
  const match = /window\.location\.href\s*=\s*["']([^"']+)["']/i.exec(String(html ?? ''))
  return match?.[1] ?? null
}

export const hasRedirectShellSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /window\.onload\s*=\s*function\s*\(\)\s*\{\s*window\.location\.href\s*=\s*["']\/lander["']\s*\}/i.test(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const hasParkedLanderSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /window\.LANDER_SYSTEM\s*=\s*["']PW["']/i.test(rawHtml)
    && /window\._trfd\s*=\s*window\._trfd\s*\|\|\s*\[\]/i.test(rawHtml)
    && /window\._signalsDataLayer\s*=\s*window\._signalsDataLayer\s*\|\|\s*\[\]/i.test(rawHtml)
    && /parking-lander\/static\/js\//i.test(rawHtml)
    && /parking-lander\/static\/css\//i.test(rawHtml)
    && /<div id=["']root["']><\/div>/i.test(rawHtml)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createUrneedsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasRedirectShellSignal(homepage.html) || extractRedirectTarget(homepage.html) !== '/lander') {
      throw new Error('Urneeds verified redirect shell no longer matches the known first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Urneeds homepage now exposes a public jobs surface')
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (
        routePage.status !== 200
        || !hasRedirectShellSignal(routePage.html)
        || extractRedirectTarget(routePage.html) !== '/lander'
      ) {
        throw new Error(`Urneeds checked first-party route changed: ${routePage.url || routeUrl}`)
      }

      if (hasPublicJobsSignal(routePage.html)) {
        throw new Error(`Urneeds checked first-party route now exposes jobs: ${routePage.url || routeUrl}`)
      }
    }

    const lander = await fetchPage(LANDER_URL)
    if (lander.status !== 200 || !hasParkedLanderSignal(lander.html) || hasPublicJobsSignal(lander.html)) {
      throw new Error('Urneeds verified parked lander surface changed or now exposes public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createUrneedsScraper().run(options)
