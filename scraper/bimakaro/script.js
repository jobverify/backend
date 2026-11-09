import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'http://www.bimakaro.in/'
export const CAREERS_URL = 'http://www.bimakaro.in/careers'

const SOURCE = 'bimakaro'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const errorMessageChain = (value) => {
  const messages = []
  const seen = new Set()
  let current = value

  while (current && !seen.has(current)) {
    seen.add(current)
    if (typeof current === 'string') {
      messages.push(current)
      break
    }

    for (const field of ['message', 'code', 'name']) {
      if (current[field]) messages.push(String(current[field]))
    }

    current = current.cause
  }

  return messages.filter(Boolean)
}

export const hasBrokenOfficialSurfaceError = (error) =>
  errorMessageChain(error)
    .some((message) => /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout|connecttimeouterror/i.test(message))

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  ...options,
})

export const createBimaKaroScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    try {
      await fetchText(HOMEPAGE_URL, { attempts: 1 })
      throw new Error('BimaKaro official host no longer matches the verified broken public surface')
    } catch (error) {
      if (!hasBrokenOfficialSurfaceError(error)) {
        throw new Error('BimaKaro official host no longer matches the verified broken public surface')
      }
    }

    try {
      await fetchText(CAREERS_URL, { attempts: 1 })
      throw new Error('BimaKaro careers route no longer matches the verified broken public surface')
    } catch (error) {
      if (!hasBrokenOfficialSurfaceError(error)) {
        throw new Error('BimaKaro careers route no longer matches the verified broken public surface')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createBimaKaroScraper().run(options)

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
