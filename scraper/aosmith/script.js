import {createCurrentAoSmithScraper} from './currentInventory.js'
import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INDIA_SEARCH_URL = 'https://jobs.aosmith.com/search/?createNewAlert=false&q=&locationsearch=India'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractJobLinks = (html) => [...String(html ?? '').matchAll(/href="([^"]*\/job\/[^"]+)"/gi)]
  .map((match) => match[1])

export const buildSearchUrl = () => INDIA_SEARCH_URL

export const pageIndicatesIndiaFalsePositive = (html) => {
  const normalized = normalizeWhitespace(html)
  const jobLinks = extractJobLinks(html)
  const hasExactIndiaLocation = /,\s*india(?:\s*<\/|\s*<|\s*$|\s*,)/i.test(String(html ?? ''))
  const hasIndiaJobSlug = jobLinks.some((link) => /-india(?:[/?-]|$)/i.test(link))

  return (
    normalized.includes('India - A. O. Smith Corporation Jobs')
    && normalized.includes('Showing 1 to 10 of 10 Jobs')
    && jobLinks.length > 0
    && !hasExactIndiaLocation
    && !hasIndiaJobSlug
  )
}

export const createAoSmithScraper = (defaults = {}) => createCurrentAoSmithScraper(defaults)

export const run = options => createAoSmithScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running A. O. Smith scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'aosmith')
    console.log('DB result:', result)
    process.exit(0)
  }
}
