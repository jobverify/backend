import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createOptimizedPage as defaultCreateOptimizedPage,
  launchBrowser as defaultLaunchBrowser,
} from '../../scraper-support/utils/browser.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import SAPPHIRE_FOODS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = SAPPHIRE_FOODS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const CAREERS_LANDING_URL = PROVIDER_METADATA.companyCareerPage
export const STORE_CAREERS_URL = PROVIDER_METADATA.storeCareersPageUrl
export const CORPORATE_CAREERS_URL = PROVIDER_METADATA.corporateCareersPageUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const unique = (values) => [...new Set(values.filter(Boolean))]

export const normalizeBrand = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^shared$/i.test(normalized)) return 'Shared'
  return normalized
}

export const normalizeLocationToCountry = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const country = parts.at(-1) && /india/i.test(parts.at(-1)) ? 'India' : 'India'
  const location = /india/i.test(normalized) ? normalized : `${normalized}, India`

  return {
    location,
    city: parts[0] || normalized,
    state: parts.length > 2 ? parts[1] : null,
    country,
  }
}

const getJobIdFromHref = (href, title, location) => {
  try {
    const segments = new URL(href).pathname.split('/').filter(Boolean)
    return segments.at(-1) || `${title}-${location}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  } catch {
    return `${title}-${location}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  }
}

export const hasCareersLandingSignal = (html) => {
  const source = String(html ?? '')

  return /Careers/i.test(source)
    && /store-careers/i.test(source)
    && /corporate-careers/i.test(source)
    && /Sapphire Foods India Ltd\./i.test(source)
}

export const hasStoreCareersSignal = (html) => {
  const source = String(html ?? '')

  return /store careers/i.test(source)
    && /Working at a Sapphire Foods store/i.test(source)
    && /careers@sapphirefoods\.in/i.test(source)
    && /Sapphire Foods India Ltd\./i.test(source)
}

export const hasCorporateCareersSignal = (html) => {
  const source = String(html ?? '')

  return /corporate careers/i.test(source)
    && /(Restaurant Support Centre|RSC)/i.test(source)
    && /Sapphire Foods India Ltd\./i.test(source)
}

export const hasVerifiedNotFoundShell = (html) => {
  const source = String(html ?? '')

  return /Page not found/i.test(source)
    && /We'?re sorry, but the page you requested cannot be found\./i.test(source)
    && /Sapphire Foods India Ltd\./i.test(source)
    && /Store Careers/i.test(source)
    && /Corporate Careers/i.test(source)
}

const sanitizeRoleCards = (cards) => (Array.isArray(cards) ? cards : [])
  .map((card) => ({
    title: normalizeWhitespace(card?.title),
    summary: normalizeWhitespace(card?.summary),
    brand: normalizeBrand(card?.brand),
    location: normalizeWhitespace(card?.location),
    vacancies: normalizeWhitespace(card?.vacancies),
    href: normalizeWhitespace(card?.href),
  }))
  .filter((card) => card.title && card.location && card.href)

export const buildJobsFromRoleCards = (cards, _categoryLabel = null) => sanitizeRoleCards(cards)
  .map((card) => {
    const normalizedLocation = normalizeLocationToCountry(card.location)
    const jobId = getJobIdFromHref(card.href, card.title, card.location)

    return {
      title: card.title,
      company: COMPANY,
      department: card.brand,
      location: normalizedLocation.location,
      city: normalizedLocation.city,
      state: normalizedLocation.state,
      country: normalizedLocation.country,
      jobId,
      requisitionId: jobId,
      sourceUrl: card.href,
      applyUrl: card.href,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: card.summary,
      remoteStatus: 'On-site',
    }
  })

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

export const createBrowserRoleCardsLoader = ({
  launchBrowserImpl = defaultLaunchBrowser,
  createOptimizedPageImpl = defaultCreateOptimizedPage,
} = {}) => ({
  async load(url) {
    let browser

    try {
      browser = await launchBrowserImpl()
      const page = await createOptimizedPageImpl(browser)
      await page.goto(url, { waitUntil: 'networkidle2' })

      if (typeof page.waitForSelector === 'function') {
        await page.waitForSelector('a[href]', {
          timeout: config.jobListingTimeoutMs || 30000,
        })
      }

      const roleCards = await page.evaluate(() => {
        const normalize = (value) => String(value ?? '')
          .replace(/\u00a0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        const readLines = (element) => normalize(element?.innerText || '')
          .split('\n')
          .map((line) => normalize(line))
          .filter(Boolean)

        const getLineAfter = (lines, label) => {
          const index = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase())
          return index >= 0 ? lines[index + 1] || null : null
        }

        const cards = Array.from(document.querySelectorAll('a[href]'))
          .filter((link) => /know more/i.test(normalize(link.textContent)))
          .map((link) => {
            let card = link.closest('article, li, section, [class*="card" i], [class*="job" i], [class*="career" i], div')

            while (card) {
              const lines = readLines(card)
              if (lines.includes('Role') || lines.includes('Location') || lines.includes('Vacancies')) {
                const roleIndex = lines.findIndex((line) => line === 'Role')
                const title = roleIndex >= 0 ? lines[roleIndex + 1] || null : null
                const brand = getLineAfter(lines, 'Brand')
                const location = getLineAfter(lines, 'Location')
                const vacancies = getLineAfter(lines, 'Vacancies')
                const brandIndex = lines.findIndex((line) => line === 'Brand')
                const summary = roleIndex >= 0 && brandIndex > roleIndex
                  ? lines.slice(roleIndex + 2, brandIndex).join(' ')
                  : null

                return {
                  title,
                  summary,
                  brand,
                  location,
                  vacancies,
                  href: link.href,
                }
              }

              card = card.parentElement
            }

            return null
          })
          .filter(Boolean)

        return cards
      })

      return sanitizeRoleCards(roleCards)
    } finally {
      if (browser) await browser.close()
    }
  },
})

export const createSapphireFoodsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    loadRoleCards = createBrowserRoleCardsLoader().load,
    now = defaultNow,
  } = {}) {
    const landingPage = await fetchPage(CAREERS_LANDING_URL)
    const storePage = await fetchPage(STORE_CAREERS_URL)
    const corporatePage = await fetchPage(CORPORATE_CAREERS_URL)

    if (
      landingPage.status === 404
      && storePage.status === 404
      && corporatePage.status === 404
      && hasVerifiedNotFoundShell(landingPage.html)
      && hasVerifiedNotFoundShell(storePage.html)
      && hasVerifiedNotFoundShell(corporatePage.html)
    ) {
      return []
    }

    if (landingPage.status !== 200 || !hasCareersLandingSignal(landingPage.html)) {
      throw new Error('Response is not the verified official Sapphire Foods careers landing page')
    }

    if (storePage.status !== 200 || !hasStoreCareersSignal(storePage.html)) {
      throw new Error('Response is not the verified official Sapphire Foods store careers page')
    }

    if (corporatePage.status !== 200 || !hasCorporateCareersSignal(corporatePage.html)) {
      throw new Error('Response is not the verified official Sapphire Foods corporate careers page')
    }

    const storeJobs = buildJobsFromRoleCards(await loadRoleCards(STORE_CAREERS_URL), 'Store Careers')
    const corporateJobs = buildJobsFromRoleCards(
      await loadRoleCards(CORPORATE_CAREERS_URL),
      'Corporate Careers',
    )

    const jobs = [...storeJobs, ...corporateJobs]
    const dedupedJobs = jobs.filter((job, index) =>
      jobs.findIndex((candidate) => candidate.applyUrl === job.applyUrl) === index)
    const selectedJobs = maxJobs ? dedupedJobs.slice(0, maxJobs) : dedupedJobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_LANDING_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createSapphireFoodsScraper(options).run(options)

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
