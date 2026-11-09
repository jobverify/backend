import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY = 'Eclipse360'
export const SOURCE = 'eclipse360'
export const HOMEPAGE_URL = 'https://www.eclipse360.co.uk/'
export const CAREERS_CANDIDATE_PATHS = ['/careers', '/jobs', '/vacancies']

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const hasEclipse360BrandSignal = (html) => /\bEclipse360\b/i.test(String(html ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasLegacySurface =
    hasEclipse360BrandSignal(page)
    && (
      /microsoft dynamics 365 crm specialists/i.test(page)
      || /customer engagement and business process improvements/i.test(page)
      || /dynamics 365 solutions/i.test(page)
    )
  const hasCurrentSurface =
    /<title>\s*Freelance Web Development in Leeds, West Yorkshire\s*-\s*eclipse360\s*<\/title>/i.test(page)
    && /freelance web [&&] media developer based in leeds/i.test(normalized)
    && /freelance web design and web development business based in leeds, west yorkshire/i.test(normalized)
    && /nick@eclipse360/i.test(normalized)

  return hasLegacySurface || hasCurrentSurface
}

export const pageExposesPublicJobListings = (html) => {
  const page = String(html ?? '')
  return /\bcareers?\b/i.test(page)
    && (
      /\bjob-list(?:ing|ings)?\b/i.test(page)
      || /\bcurrent openings\b/i.test(page)
      || /\bopen positions\b/i.test(page)
      || /\bvacanc(?:y|ies)\b/i.test(page)
      || />\s*apply now\s*</i.test(page)
      || />\s*view jobs?\s*</i.test(page)
    )
}

const pageLooksLikeOfficialNoJobsSurface = (html) => {
  const page = String(html ?? '')
  return hasEclipse360BrandSignal(page)
    && (
      /page not found/i.test(page)
      || /404/i.test(page)
      || /return to eclipse360/i.test(page)
      || hasOfficialHomepageSignal(page)
    )
    && !pageExposesPublicJobListings(page)
}

const defaultFetchPage = async (url, attempt = 0) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      text: await response.text(),
    }
  } catch (error) {
    if (attempt >= ((config.retryAttempts || 1) - 1)) throw error
    const delayMs = (config.retryBaseDelayMs || 1000) * (attempt + 1)
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    return defaultFetchPage(url, attempt + 1)
  }
}

export const createEclipse360Scraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!homepage.ok || !hasOfficialHomepageSignal(homepage.text)) {
      throw new Error('The official Eclipse360 website no longer matches the verified public surface')
    }

    for (const candidatePath of CAREERS_CANDIDATE_PATHS) {
      const candidateUrl = new URL(candidatePath, HOMEPAGE_URL).toString()
      const page = await fetchPage(candidateUrl)

      if (pageExposesPublicJobListings(page.text)) {
        throw new Error(`Eclipse360 now appears to expose public job listings at ${candidateUrl}`)
      }

      if (page.status === 404) {
        continue
      }

      if (!pageLooksLikeOfficialNoJobsSurface(page.text)) {
        throw new Error(`Eclipse360 careers surface at ${candidateUrl} no longer matches the verified no-listings state`)
      }
    }

    return []
  },
})

export const run = async () => createEclipse360Scraper().run()

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
