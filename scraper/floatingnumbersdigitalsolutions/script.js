import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import PROVIDER_METADATA from './provider.json' with { type: 'json' }

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const HOMEPAGE_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Floating Numbers/i.test(page)
    && /best content moderation company in india/i.test(page)
    && /Committed to team excellence/i.test(page)
  }

export const pageExposesPublicJobSignals = (html = '') =>
  /\b(careers|current openings|job openings|apply now|join our team)\b/i.test(String(html ?? ''))
  || /jobs\.lever\.co|boards\.greenhouse\.io|smartrecruiters|workdayjobs/i.test(String(html ?? ''))

export const createFloatingNumbersDigitalSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Floating Numbers Digital Solutions official homepage changed; refusing to assume no public listings')
    }

    if (pageExposesPublicJobSignals(homepageHtml)) {
      throw new Error('Floating Numbers Digital Solutions homepage now exposes public job signals and needs a dedicated scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createFloatingNumbersDigitalSolutionsScraper().run(options)

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
