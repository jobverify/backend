import path from 'path'
import { fileURLToPath } from 'url'
import {createCurrentCapillaryScraper} from './currentBoundary.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.capillarytech.com/careers/'

const PENDING_CAREERS_PATTERN = /hand-crafting a brand-new careers experience[\s\S]*?live soon/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const isCareersExperiencePending = (html) => PENDING_CAREERS_PATTERN.test(html || '')

export const hasCloudflareBlockSignal = (page = {}) => {
  const html = String(page.html ?? '')
  const text = normalizeWhitespace(html)

  return Number(page.status) === 403
    && String(page.url || '') === CAREER_PAGE_URL
    && /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html)
    && (
      text.includes('Enable JavaScript and cookies to continue')
      || text.includes('Checking your browser...')
    )
}

export const createCapillaryTechnologiesScraper = (defaults={}) => createCurrentCapillaryScraper(defaults)

export const run = async (options={}) => createCapillaryTechnologiesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Capillary Technologies scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'capillarytechnologies')
    console.log('DB result:', result)
    process.exit(0)
  }
}
