import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mywaysai'
export const COMPANY = 'MyWays.ai'
export const HOMEPAGE_URL = 'https://myways.ai/'
export const OPPORTUNITY_URL = 'https://myways.ai/opportunity'
export const TECHNOLOGY_JOBS_URL = 'https://myways.ai/technology-jobs'
export const OPPORTUNITY_JOBS_URL = 'https://myways.ai/opportunity/jobs'
export const OPPORTUNITY_INTERNSHIPS_URL = 'https://myways.ai/opportunity/internships'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const parseNextData = (html) => {
  const match = String(html ?? '').match(
    /<script id=["']__NEXT_DATA__["'] type=["']application\/json["']>([\s\S]*?)<\/script>/i,
  )

  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
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

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/javascript,text/javascript,text/plain;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Become an Experienced Fresher with MyWays\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']description["'][^>]+content=["']MyWays\.ai is an AI career navigation solution to identify your gaps, help you learn, grow and experience your career before it starts!["']/i.test(rawHtml)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/myways\.ai\/["']/i.test(rawHtml)
    && /href=["']\/opportunity["']/i.test(rawHtml)
    && /\bJob Finder\b/i.test(normalized)
    && /We are currently hiring for/i.test(normalized)
    && /student\.connect@myways\.ai/i.test(rawHtml)
  }

export const extractOpportunityBundleAssetPath = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*\/_next\/static\/chunks\/pages\/opportunity-[^"']+\.js)["']/i,
  )

  return match?.[1] ?? null
}

export const hasOfficialOpportunityShellSignal = (html) => {
  const rawHtml = String(html ?? '')
  const nextData = parseNextData(rawHtml)

  return /<title>\s*Apply for Tech Jobs Across Platforms For Free\s*<\/title>/i.test(rawHtml)
    && extractOpportunityBundleAssetPath(rawHtml) !== null
    && nextData?.page === '/opportunity'
    && nextData?.query != null
    && Object.keys(nextData.query).length === 0
}

export const hasOpportunityBundleRedirectSignal = (bundleText) => {
  const rawText = String(bundleText ?? '')

  return rawText.includes('replace("/technology-jobs")')
    && rawText.includes('To access this feature, please log in with your credentials.')
}

export const extractTechnologyJobsData = (html) => {
  const nextData = parseNextData(html)
  const opportunities = nextData?.props?.pageProps?.opportunities
  const latest = nextData?.props?.pageProps?.latest

  if (nextData?.page !== '/technology-jobs') {
    return null
  }

  if (!Array.isArray(opportunities) || !Array.isArray(latest)) {
    return null
  }

  return { opportunities, latest }
}

export const hasOfficialTechnologyJobsSignal = (html) =>
  /<title>\s*Apply for Tech Jobs Across Platforms For Free\s*<\/title>/i.test(String(html ?? ''))
  && extractTechnologyJobsData(html) !== null

export const hasTechnologyJobsZeroState = (html) => {
  const data = extractTechnologyJobsData(html)

  return data !== null
    && data.opportunities.length === 0
    && data.latest.length === 0
}

const extractTypeRouteData = (html) => {
  const nextData = parseNextData(html)
  const opportunities = nextData?.props?.pageProps?.opportunities
  const type = nextData?.query?.type

  if (nextData?.page !== '/opportunity/[type]' || !Array.isArray(opportunities)) {
    return null
  }

  return {
    opportunities,
    type,
  }
}

export const hasZeroJobsTypeRouteSignal = (html, expectedType) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()
  const data = extractTypeRouteData(rawHtml)

  if (!data || data.type !== expectedType || data.opportunities.length !== 0) {
    return false
  }

  if (!/<title>\s*Become an Experienced Fresher with MyWays\.ai\s*<\/title>/i.test(rawHtml)) {
    return false
  }

  if (!normalized.includes('no data')) {
    return false
  }

  if (expectedType === 'internships' && !normalized.includes('trending internship')) {
    return false
  }

  return true
}

const typeRouteExposesOpenings = (html, expectedType) => {
  const data = extractTypeRouteData(html)
  return data?.type === expectedType && Array.isArray(data.opportunities) && data.opportunities.length > 0
}

export const createMyWaysScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('MyWays.ai verified official homepage no longer matches the known public surface')
    }

    const opportunityPage = await fetchPage(OPPORTUNITY_URL)
    if (opportunityPage.status !== 200 || !hasOfficialOpportunityShellSignal(opportunityPage.html)) {
      throw new Error('MyWays.ai opportunity handoff shell no longer matches the verified first-party surface')
    }

    const bundleAssetPath = extractOpportunityBundleAssetPath(opportunityPage.html)
    if (!bundleAssetPath) {
      throw new Error('MyWays.ai opportunity handoff shell no longer exposes the verified first-party bundle')
    }

    const bundleUrl = new URL(bundleAssetPath, HOMEPAGE_URL).toString()
    const bundleText = await fetchText(bundleUrl)
    if (!hasOpportunityBundleRedirectSignal(bundleText)) {
      throw new Error('MyWays.ai opportunity handoff bundle changed materially or no longer redirects to the public technology jobs surface')
    }

    const technologyJobsPage = await fetchPage(TECHNOLOGY_JOBS_URL)
    if (technologyJobsPage.status !== 200 || !hasOfficialTechnologyJobsSignal(technologyJobsPage.html)) {
      throw new Error('MyWays.ai technology jobs surface no longer matches the verified first-party public jobs page')
    }

    if (!hasTechnologyJobsZeroState(technologyJobsPage.html)) {
      throw new Error('MyWays.ai technology jobs surface now exposes public openings')
    }

    const opportunityJobsPage = await fetchPage(OPPORTUNITY_JOBS_URL)
    if (opportunityJobsPage.status !== 200 || !hasZeroJobsTypeRouteSignal(opportunityJobsPage.html, 'jobs')) {
      if (typeRouteExposesOpenings(opportunityJobsPage.html, 'jobs')) {
        throw new Error('MyWays.ai jobs route now exposes public openings')
      }

      throw new Error('MyWays.ai jobs route no longer matches the verified zero-job state')
    }

    const opportunityInternshipsPage = await fetchPage(OPPORTUNITY_INTERNSHIPS_URL)
    if (
      opportunityInternshipsPage.status !== 200
      || !hasZeroJobsTypeRouteSignal(opportunityInternshipsPage.html, 'internships')
    ) {
      if (typeRouteExposesOpenings(opportunityInternshipsPage.html, 'internships')) {
        throw new Error('MyWays.ai internships route now exposes public openings')
      }

      throw new Error('MyWays.ai internships route no longer matches the verified zero-job state')
    }

    return []
  },
})

export const run = async (options = {}) => createMyWaysScraper().run(options)

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
