import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY = 'EKLAVYA SOLUTION'
export const SOURCE = 'eklavyasolution'
export const HOMEPAGE_URL = 'https://eklavyasolution.com/'
export const CAREERS_CANDIDATE_PATHS = ['/careers', '/career', '/jobs', '/apply']

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const extractBundleUrl = (html) => {
  const match = String(html ?? '').match(/<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i)
  return match ? new URL(match[1], HOMEPAGE_URL).toString() : null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Drona\s*<\/title>/i.test(page)
    && /<div[^>]+id=["']root["'][^>]*><\/div>/i.test(page)
    && /\/assets\/index-[^"']+\.js/i.test(page)
}

export const hasOfficialBundleSignal = (jsSource) => {
  const source = String(jsSource ?? '')
  return /EklavyaSolution/i.test(source)
    && /Hsaka Technologies Pvt Ltd/i.test(source)
    && /support@eklavyasolution\.com/i.test(source)
    && /\/api\/demo/i.test(source)
    && /\/api\/subscribe/i.test(source)
}

export const pageExposesPublicJobListings = (html) => /\bjob openings\b|\bcurrent openings\b|\bopen positions\b|\bvacanc(?:y|ies)\b|>\s*Apply Now\s*</i.test(String(html ?? ''))

const pageLooksLikeOfficialNoJobsSurface = (html) => hasOfficialHomepageSignal(html) && !pageExposesPublicJobListings(html)

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

export const createEklavyaSolutionScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!homepage.ok || !hasOfficialHomepageSignal(homepage.text)) {
      throw new Error('The official Eklavya Solution website no longer matches the verified public surface')
    }

    const bundleUrl = extractBundleUrl(homepage.text)
    if (!bundleUrl) {
      throw new Error('The official Eklavya Solution bundle URL could not be resolved from the verified public surface')
    }

    const bundle = await fetchPage(bundleUrl)
    if (!bundle.ok || !hasOfficialBundleSignal(bundle.text)) {
      throw new Error('The official Eklavya Solution frontend bundle no longer matches the verified public brand signals')
    }

    for (const candidatePath of CAREERS_CANDIDATE_PATHS) {
      const candidateUrl = new URL(candidatePath, HOMEPAGE_URL).toString()
      const page = await fetchPage(candidateUrl)

      if (pageExposesPublicJobListings(page.text)) {
        throw new Error(`Eklavya Solution now appears to expose public job listings at ${candidateUrl}`)
      }

      if (!pageLooksLikeOfficialNoJobsSurface(page.text)) {
        throw new Error(`Eklavya Solution careers surface at ${candidateUrl} no longer matches the verified no-listings state`)
      }
    }

    return []
  },
})

export const run = async () => createEklavyaSolutionScraper().run()

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
