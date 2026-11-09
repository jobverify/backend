import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cfi'
export const COMPANY = 'CFI'
export const CAREERS_URL = 'https://corporatefinanceinstitute.com/about-cfi/careers-at-cfi/'
export const BAMBOOHR_EMBED_URL =
  'https://corporatefinanceinstituteinc.bamboohr.com/jobs/embed2.php?version=1.0.0'

export const hasOfficialCareersSignal = (html) =>
  /Careers at CFI \| Corporate Finance Institute|Build your career with CFI|id="BambooHR"/i.test(html || '')

export const hasBambooHrHandoff = (html) =>
  /id="BambooHR"[^>]+data-domain="corporatefinanceinstituteinc\.bamboohr\.com"|https:\/\/corporatefinanceinstituteinc\.bamboohr\.com\/js\/embed\.js/i.test(html || '')

export const hasEmptyOpeningsSignal = (html) =>
  /We currently have no open positions\./i.test(String(html ?? ''))

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return response.text()
}

export const createCfiScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const now = options.now || defaultNow
    const careersHtml = await fetchText(CAREERS_URL)
    const bambooHrEmbedHtml = await fetchText(BAMBOOHR_EMBED_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('CFI careers page no longer matches the verified official public surface')
    }

    if (!hasBambooHrHandoff(careersHtml)) {
      throw new Error('CFI careers page no longer exposes the verified BambooHR handoff')
    }

    if (!hasEmptyOpeningsSignal(bambooHrEmbedHtml)) {
      throw new Error('CFI BambooHR embed no longer matches the verified no-openings state')
    }

    return attachInventoryEvidence([], {
      status: 'verified-empty',
      surface: CAREERS_URL,
      firstParty: true,
      listingComplete: true,
      pagesFetched: 2,
      reportedTotal: 0,
      indiaFacetCount: 0,
      verifiedAt: now(),
      reason: 'cfi-bamboohr-official-empty-openings',
    })
  },
})

export const run = async (options = {}) => createCfiScraper().run(options)

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
