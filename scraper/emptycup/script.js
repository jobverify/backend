import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://emptycup.in/'
export const CAREERS_ROUTE_URL = 'https://emptycup.in/careers'
export const JOBS_ROUTE_URL = 'https://emptycup.in/jobs'

const MISSING_ROUTE_PATTERN = /\b(?:404|page)\s+not\s+found\b|broken link|doesn’t exist on this site|doesn't exist on this site/i

export const hasOfficialSiteSignal = (html) =>
  /<title>\s*EmptyCup(?:\s*3D)?\b|\bWelcome to EmptyCup\b/i.test(html || '')

export const isMissingCareerRoute = (html) => MISSING_ROUTE_PATTERN.test(html || '')

export const extractAppBundleUrl = (html) => {
  const match = String(html ?? '').match(
    /(?:href|src)=["']([^"']*\/_app\/immutable\/entry\/app\.[a-z0-9]+\.js)["']/i,
  )

  if (!match?.[1]) return null

  try {
    return new URL(match[1], CAREER_PAGE_URL).toString()
  } catch {
    return null
  }
}

export const hasOfficialSpaShell = (html) => {
  const page = String(html ?? '')

  return hasOfficialSiteSignal(page)
    && /id=["']app-container["']/i.test(page)
    && /\/_app\/immutable\/entry\/start\.[a-z0-9]+\.js/i.test(page)
    && extractAppBundleUrl(page) !== null
}

const hasManifestRoute = (bundle, routeName) => new RegExp(
  `["']\\/(?:\\([^"']+\\)\\/)?${routeName}(?:\\/[^"']*)?["']`,
  'i',
).test(String(bundle ?? ''))

export const hasVerifiedNoPublicCareersRouteDictionary = (bundle) => {
  const source = String(bundle ?? '')
  const hasDictionaryExport = /\bas\s+dictionary\b|export\s*\{\s*dictionary\s*\}/i.test(source)
  const hasKnownPublicRoutes = ['about', 'contact-us', 'pricing', 'privacy']
    .every((routeName) => hasManifestRoute(source, routeName))
  const hasCareerRoute = ['career', 'careers', 'job', 'jobs', 'join-us', 'work-with-us', 'openings']
    .some((routeName) => hasManifestRoute(source, routeName))

  return hasDictionaryExport && hasKnownPublicRoutes && !hasCareerRoute
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return response.text()
}

export const createEmptyCupScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const homepageHtml = await fetchText(CAREER_PAGE_URL)
    const careersHtml = await fetchText(CAREERS_ROUTE_URL)
    const jobsHtml = await fetchText(JOBS_ROUTE_URL)

    const hasOfficialSite = hasOfficialSiteSignal(homepageHtml)
    const careersRouteMissing = isMissingCareerRoute(careersHtml)
    const jobsRouteMissing = isMissingCareerRoute(jobsHtml)

    if (!hasOfficialSite) {
      throw new Error('EmptyCup official site no longer matches the verified public surface')
    }

    if (careersRouteMissing && jobsRouteMissing) {
      return []
    }

    const appBundleUrl = extractAppBundleUrl(homepageHtml)
    const careersUseFallbackShell = hasOfficialSpaShell(careersHtml)
      && extractAppBundleUrl(careersHtml) === appBundleUrl
    const jobsUseFallbackShell = hasOfficialSpaShell(jobsHtml)
      && extractAppBundleUrl(jobsHtml) === appBundleUrl

    if (!appBundleUrl || !careersUseFallbackShell || !jobsUseFallbackShell) {
      throw new Error('EmptyCup careers routes no longer match the verified no-public-listings surface')
    }

    const appBundle = await fetchText(appBundleUrl)
    if (!hasVerifiedNoPublicCareersRouteDictionary(appBundle)) {
      throw new Error('EmptyCup route dictionary changed or exposes careers/jobs')
    }

    return []
  },
})

export const run = async () => createEmptyCupScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running EmptyCup scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'emptycup')
    console.log('DB result:', result)
    process.exit(0)
  }
}
