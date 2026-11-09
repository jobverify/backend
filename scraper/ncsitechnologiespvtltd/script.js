import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { NCSI_TECHNOLOGIES_PVT_LTD_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NCSI_TECHNOLOGIES_PVT_LTD_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '').toLowerCase()
  return rawHtml.includes('<title>ncsi careers</title>')
    && rawHtml.includes('join our renowned team')
    && rawHtml.includes('your career. our commitment.')
    && rawHtml.includes('culture at ncsi')
  }

export const hasIncapsulaIncidentSignal = (html = '') =>
  /Request unsuccessful\.\s*Incapsula incident ID:/i.test(String(html ?? ''))
  || /\/_Incapsula_Resource\b/i.test(String(html ?? ''))

export const createNcsitechnologiespvtltdScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (hasIncapsulaIncidentSignal(careersHtml)) {
      return attachInventoryEvidence([], {
        status: 'discovery-only',
        surface: CAREERS_URL,
        firstParty: true,
        listingComplete: false,
        pagesFetched: 1,
        reportedTotal: null,
        indiaFacetCount: null,
        verifiedAt: now(),
        reason: 'NCSI careers page is blocked by Incapsula; preserving the existing job snapshot',
      })
    }

    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('NCSI verified generic careers landing no longer matches the known fail-closed contract')
    }

    return []
  },
})

export const run = async (options = {}) => createNcsitechnologiespvtltdScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
