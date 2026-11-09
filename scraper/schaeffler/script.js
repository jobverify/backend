import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HOME, runNative } from './nativeCareers.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'schaeffler'
export const COMPANY = 'Schaeffler'
export const CAREERS_URL = HOME

// Retain the established public URL utility. The native reader follows actual
// published navigation; it never guesses an offset from a count or this helper.
export const buildIndiaSearchUrl = (startRow = null) => {
  const url = new URL(HOME)
  if (Number.isInteger(startRow) && startRow > 0) url.searchParams.set('startrow', String(startRow))
  return url.href
}
export const extractJobIdFromUrl = value => /\/(\d+)\/?(?:[#?].*)?$/.exec(String(value ?? ''))?.[1] ?? null
export const createSchaefflerScraper = () => ({ run: runNative, buildIndiaSearchUrl })
export const run = options => runNative(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  console.log('Native criterion-bearing discovery observations:', jobs.length)
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
