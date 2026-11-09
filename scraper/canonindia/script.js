import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://in.canon/en/consumer/web/career'
export const EXTERNAL_PORTAL_URL = 'https://career.asia.canon'
export const ORACLE_BOARD_URL = 'https://career.asia.canon/en/sites/CX_1'
export const ORACLE_API_ORIGIN = 'https://cmaonehr-iaeatj.fa.ocs.oraclecloud.com'
export const ORACLE_LISTING_URL = `${ORACLE_API_ORIGIN}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=5,offset=0`

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const countryNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
const isExplicitForeignCountry = value => typeof value === 'string' && /^[A-Z]{2}$/.test(value)
  && !['IN', 'ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO'].includes(value) && Boolean(countryNames.of(value))

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

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

export const hasCareerPageSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  return (
    normalized.includes('careers - canon india')
    && normalized.includes('come join us')
    && normalized.includes('canon is a global brand')
    && /href=["']https:\/\/career\.asia\.canon\/?["']/i.test(String(html ?? ''))
  )
}

export const hasOracleBoardSignal = ({ status, url, html } = {}) => {
  const page = String(html ?? '')
  return status === 200
    && url === ORACLE_BOARD_URL
    && /<title>\s*Canon Career Site\s*<\/title>/i.test(page)
    && /<base\b[^>]*href=["']\/en\/sites\/CX_1["']/i.test(page)
    && /data-sitenumber=["']CX_1["']/i.test(page)
    && page.includes(`data-apibaseurl="${ORACLE_API_ORIGIN}:443"`)
}

export const hasVerifiedEmptyOracleInventory = ({ status, url, html } = {}) => {
  if (status !== 200 || url !== ORACLE_LISTING_URL) return false

  try {
    const payload = JSON.parse(String(html ?? ''))
    const inventory = payload?.items?.[0]
    return payload.items.length === 1
      && inventory.SiteNumber === 'CX_1'
      && inventory.Location === null
      && inventory.TotalJobsCount === 0
      && Array.isArray(inventory.requisitionList)
      && inventory.requisitionList.length === 0
  } catch {
    return false
  }
}

// Canon's Asia board publishes roles across countries. A complete foreign
// inventory is valid evidence only after every native location is inspected.
// Verify every page before treating that foreign inventory as an empty India result.
const verifyNoIndiaInventory = async (fetchPage) => {
  const seenIds = new Set()
  let total = null
  let offset = 0
  let pagesFetched = 0

  do {
    const url = ORACLE_LISTING_URL.replace('offset=0', 'offset=' + offset)
    const page = await fetchPage(url)
    let payload
    try {
      payload = JSON.parse(String(page?.html ?? ''))
    } catch {
      throw new Error('Canon India Oracle career inventory changed or is unavailable')
    }
    const inventory = payload?.items?.[0]
    if (
      page?.status !== 200 || page?.url !== url
      || !Array.isArray(payload?.items) || payload.items.length !== 1
      || inventory?.SiteNumber !== 'CX_1' || inventory.Location !== null
      || !Number.isInteger(inventory.TotalJobsCount) || inventory.TotalJobsCount < 0 || inventory.TotalJobsCount > 10000
      || (total !== null && inventory.TotalJobsCount !== total)
      || (inventory.Offset != null && inventory.Offset !== offset)
      || (inventory.Limit != null && inventory.Limit !== 5)
      || !Array.isArray(inventory.requisitionList)
      || inventory.requisitionList.length !== Math.min(5, inventory.TotalJobsCount - offset)
    ) {
      throw new Error('Canon India Oracle career inventory changed or is unavailable')
    }
    total = inventory.TotalJobsCount
    for (const record of inventory.requisitionList) {
      const id = normalizeWhitespace(record?.Id)
      if (
        !id || seenIds.has(id) || !normalizeWhitespace(record.Title)
        || !isExplicitForeignCountry(record.PrimaryLocationCountry)
        || !normalizeWhitespace(record.PrimaryLocation)
        || !Array.isArray(record.secondaryLocations) || record.secondaryLocations.length !== 0
      ) {
        throw new Error('Canon India Oracle career inventory changed or is unavailable')
      }
      seenIds.add(id)
    }
    offset += inventory.requisitionList.length
    pagesFetched += 1
  } while (offset < total)
  return { total, pagesFetched }
}

export const extractOpenings = () => []

export const createCanonIndiaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchPage = options.fetchPage || defaultFetchPage
    const careerPage = await fetchPage(CAREER_PAGE_URL)

    if (careerPage.status !== 200 || !hasCareerPageSignal(careerPage.html)) {
      throw new Error('Canon India first-party careers handoff no longer matches the verified surface')
    }

    const portalPage = await fetchPage(EXTERNAL_PORTAL_URL)
    if (!hasOracleBoardSignal(portalPage)) {
      throw new Error('Canon India external careers handoff no longer resolves to the verified Oracle board')
    }

    const inventory = await verifyNoIndiaInventory(fetchPage)

    const jobs = extractOpenings()
    return attachInventoryEvidence(maxJobs ? jobs.slice(0, maxJobs) : jobs, {
      status: inventory.total ? 'complete-inventory' : 'verified-empty', surface: ORACLE_LISTING_URL,
      firstParty: true, listingComplete: true, pagesFetched: inventory.pagesFetched,
      reportedTotal: inventory.total, indiaFacetCount: 0, verifiedAt: new Date().toISOString(),
      reason: 'complete-corporate-published-oracle-board-with-explicit-foreign-countries-and-no-secondary-locations',
    })
  },
})

export const run = async (options = {}) => createCanonIndiaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Canon India scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'canonindia')
    console.log('DB result:', result)
    process.exit(0)
  }
}
