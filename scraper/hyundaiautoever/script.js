import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const APPLY_PAGE_URL = 'https://career.hyundai-autoever.com/en/apply'

const SOURCE = 'hyundaiautoever'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export const buildDetailUrl = (openingId) =>
  `https://career.hyundai-autoever.com/en/o/${openingId}`

export const buildApplyUrl = (openingId) =>
  `https://career.hyundai-autoever.com/en/o/${openingId}/apply/new`

export const hasOfficialApplyPageSignal = (html) => {
  const page = String(html ?? '')
  return /__NEXT_DATA__/i.test(page)
    && /현대오토에버|Hyundai AutoEver/i.test(page)
    && />Apply</i.test(page)
}

export const extractNextData = (html) => {
  const match = String(html ?? '').match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i,
  )

  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export const extractOpenings = (nextData) => {
  const queries = nextData?.props?.pageProps?.dehydratedState?.queries
  if (!Array.isArray(queries)) return []

  const openingQuery = queries.find((query) => query?.queryKey?.[0] === 'openings')
  return Array.isArray(openingQuery?.state?.data) ? openingQuery.state.data : []
}

const extractOpeningLocationSignals = (opening = {}) => {
  const positions = opening?.openingJobPosition?.openingJobPositions
  if (!Array.isArray(positions)) return []

  return positions.flatMap((position) => [
    position?.workspacePlace?.location,
    position?.workspacePlace?.place,
  ].filter(Boolean))
}

export const openingHasIndiaLocation = (opening) =>
  extractOpeningLocationSignals(opening).some((value) => /\bIndia\b|인도/i.test(String(value)))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHyundaiAutoEverScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const applyPageHtml = await fetchText(APPLY_PAGE_URL)

    if (!hasOfficialApplyPageSignal(applyPageHtml)) {
      throw new Error('Hyundai AutoEver openings page no longer matches the verified official public surface')
    }

    const nextData = extractNextData(applyPageHtml)
    const openings = extractOpenings(nextData)

    if (!openings.length) {
      throw new Error('Hyundai AutoEver openings payload is missing from the verified public surface')
    }

    if (openings.some((opening) => openingHasIndiaLocation(opening))) {
      throw new Error('Hyundai AutoEver now exposes India-visible openings; scraper needs implementation update')
    }

    return []
  },
})

export const run = async (options = {}) => createHyundaiAutoEverScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Hyundai AutoEver scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
