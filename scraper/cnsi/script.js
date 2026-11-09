import path from 'node:path'
import { fileURLToPath } from 'node:url'

import CNSI_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CNSI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.companyCareerPage
export const LEGACY_HOMEPAGE_URL = PROVIDER_METADATA.legacyHomepageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const defaultProbe = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    })

    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      text: await response.text(),
    }
  } catch (error) {
    return {
      ok: false,
      url,
      error: error?.message || String(error),
    }
  }
}

export const isUnavailableProbeResult = (result = {}) => result?.ok !== true

export const createCNSIScraper = () => ({
  async run({
    probe = defaultProbe,
  } = {}) {
    const homepage = await probe(HOMEPAGE_URL)
    const legacyHomepage = await probe(LEGACY_HOMEPAGE_URL)

    if (isUnavailableProbeResult(homepage) && isUnavailableProbeResult(legacyHomepage)) {
      return []
    }

    throw new Error('The verified CNSI sentinel is stale and the official domains need re-verification')
  },
})

export const run = async (options = {}) => createCNSIScraper().run(options)

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
