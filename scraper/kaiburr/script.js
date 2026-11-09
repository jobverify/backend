import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kaiburr'
export const COMPANY = 'Kaiburr'
export const HOMEPAGE_URL = 'https://kaiburr.com/'
export const SITEMAP_URL = 'https://kaiburr.com/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://kaiburr.com/careers',
  'https://kaiburr.com/careers/',
  'https://kaiburr.com/jobs',
  'https://kaiburr.com/jobs/',
  'https://kaiburr.com/company/careers',
  'https://kaiburr.com/company/careers/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_SIGNAL_PATTERN =
  /\b(career|careers|job|jobs|opening|openings|vacancy|vacancies|join us|work with us)\b/i

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')

  return rawHtml.includes('Kaiburr | Continuous Improvement and Innovation')
    && rawHtml.includes('Kaiburr Empowers Enterprise Software Teams to Achieve High Performance in a Continuous Improvement and Innovation Model.')
    && rawHtml.includes('href="https://kaiburr.com/"')
    && rawHtml.includes('Continuous Improvement and Innovation')
    && rawHtml.includes('Supercharge Efficiency Gains Across All Technology Functions')
    && rawHtml.includes('Eliminate Gaps. Automate Tasks. Accelerate Delivery.')
    || (/<title>\s*Kaiburr \| Transform your Business with AI\s*<\/title>/i.test(rawHtml)
      && /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/kaiburr\.com\/["']/i.test(rawHtml)
      && /href=["']https:\/\/app\.kaiburr\.com\/?["']/i.test(rawHtml)
      && rawHtml.includes("Make your Business more competitive with Kaiburr's AI Platform")
      && rawHtml.includes('Supercharge your business at the speed of AI')
      && rawHtml.includes('Measure Performance, Automate Tasks and Transform Your Business with AI.')
      && rawHtml.includes('Continuous Improvement and Continuous Innovation'))
}

export const sitemapHasCareerLikeUrl = (xml) => {
  const matches = String(xml ?? '').match(/<loc>([^<]+)<\/loc>/gi) || []
  return matches.some((entry) => CAREERS_SIGNAL_PATTERN.test(entry))
}

export const isMissingCareerRoute = (page) => Number(page?.status) === 404

export const createKaiburrScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Kaiburr verified official homepage no longer matches the known public surface')
    }

    if (CAREERS_SIGNAL_PATTERN.test(homepage.html)) {
      throw new Error('Kaiburr homepage now appears to expose a public careers signal')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || sitemapHasCareerLikeUrl(sitemap.html)) {
      throw new Error('Kaiburr verified sitemap no longer matches the no-public-careers surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Kaiburr verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return attachInventoryEvidence([], {
      status: 'discovery-only', surface: HOMEPAGE_URL, firstParty: true, listingComplete: false,
      pagesFetched: 8, reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
      reason: "Kaiburr has no verified public careers board; complete company job inventory is unverified.",
    })
  },
})

export const run = async (options = {}) => createKaiburrScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  const evidence = readInventoryEvidence(jobs)
  if (evidence?.listingComplete === false) {
    if (isDryRun) {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(path.join(currentDir, 'inventory-evidence.json'), JSON.stringify(evidence, null, 2))
    }
    console.error(evidence.reason)
    process.exitCode = 1
  } else if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
