import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractSearchSummary } from '../altimetrik/script.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { CUELOGIC_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const TOKEN = 'xviyQvbnyYZdGtozXoNm'
const CAREER_SOURCE = 'CAREERSITE'
const PAGE_SIZE = 10

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const SEARCH_TERM = 'Cuelogic'
export const buildSearchUrl = () => 'https://ltimindtree.ripplehire.com/candidate/candidatejobsearch'
export const buildSearchRequestPayload = (search = SEARCH_TERM) => ({
  page: 0,
  search,
  token: TOKEN,
  source: CAREER_SOURCE,
  pagesize: PAGE_SIZE,
  geo: 'India',
})

const defaultFetchText = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/xml,text/xml,*/*',
      ...(options.headers || {}),
    },
    body: options.body,
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const readPage = (xml) => {
  if (!/^\s*<JobPageVO>/.test(xml)) throw new Error('Cuelogic parent board search response changed')
  const summary = extractSearchSummary(xml)
  if (summary.startJobIndex !== 0 || summary.pageSize !== PAGE_SIZE
    || !Number.isInteger(summary.totalJobCount) || summary.totalJobCount < 0) {
    throw new Error('Cuelogic parent board search response is incomplete')
  }
  const rows = [...xml.matchAll(/<jobVoList>\s*<jobSeq>/gi)].length
  if (rows !== Math.min(PAGE_SIZE, summary.totalJobCount)) {
    throw new Error('Cuelogic parent board search result count is incomplete')
  }
  return summary.totalJobCount
}

export const createCuelogicScraper = ({ now: defaultNow = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, signal, now = defaultNow } = {}) {
    const fetchSearch = async (search) => {
      const body = new URLSearchParams({
        careerSiteUrlParams: JSON.stringify(buildSearchRequestPayload(search)),
        lang: 'en',
      })
      const xml = await fetchText(buildSearchUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body,
        signal,
      })
      return readPage(xml)
    }
    const allIndiaCount = await fetchSearch('*:*')
    if (allIndiaCount === 0) throw new Error('Cuelogic parent board has no control results to validate search')
    const cuelogicCount = await fetchSearch(SEARCH_TERM)
    if (cuelogicCount !== 0) {
      throw new Error(`Cuelogic parent board now exposes ${cuelogicCount} matching jobs; implement source-specific extraction`)
    }
    return attachInventoryEvidence([], {
      status: 'verified-empty',
      surface: buildSearchUrl(),
      firstParty: true,
      listingComplete: true,
      pagesFetched: 2,
      reportedTotal: 0,
      indiaFacetCount: 0,
      verifiedAt: now(),
      reason: 'cuelogic-ltm-ripplehire-india-search-zero',
    })
  },
})

export const run = async (options = {}) => createCuelogicScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
