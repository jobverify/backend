import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'http://esypos.in/'
export const CAREERS_URL = 'http://esypos.in/careers'

const SOURCE = 'esypos'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const LOOPBACK_REFUSED_PATTERN = /connect ECONNREFUSED 127\.0\.0\.1:(?:80|443)/i

export const hasBrokenOfficialSurfaceSignal = (html) => {
  const normalized = String(html ?? '').replace(/\s+/g, ' ').trim()
  return normalized === ''
    || /Cannot connect to database/i.test(normalized)
    || /HugeDomains/i.test(normalized)
    || /<frameset\b/i.test(String(html ?? ''))
}

const collectErrorText = (error) => {
  const queue = [error]
  const seen = new Set()
  const fragments = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (current == null) continue

    if (typeof current === 'object' || typeof current === 'function') {
      if (seen.has(current)) continue
      seen.add(current)
    }

    if (typeof current === 'string') {
      fragments.push(current)
      continue
    }

    if (current?.message) fragments.push(String(current.message))
    if (current?.stack) fragments.push(String(current.stack))
    if (current?.cause) queue.push(current.cause)
  }

  return fragments.join('\n')
}

export const isBrokenOfficialSurfaceError = (error) =>
  LOOPBACK_REFUSED_PATTERN.test(collectErrorText(error))

const verifyBrokenOfficialSurface = async (url, errorMessage, fetchText) => {
  try {
    const html = await fetchText(url)
    if (!hasBrokenOfficialSurfaceSignal(html)) {
      throw new Error(errorMessage)
    }
  } catch (error) {
    if (isBrokenOfficialSurfaceError(error)) {
      return
    }
    throw error
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createEsyposScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    await verifyBrokenOfficialSurface(
      HOMEPAGE_URL,
      'ESYPOS official host no longer matches the verified broken exact-match public surface',
      fetchText,
    )
    await verifyBrokenOfficialSurface(
      CAREERS_URL,
      'ESYPOS careers route no longer matches the verified broken exact-match public surface',
      fetchText,
    )

    return []
  },
})

export const run = async (options = {}) => createEsyposScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ESYPOS scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
