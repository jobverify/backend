import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://jobs.dana.com/go/View-All-Jobs/9152900/'
const JOB_URL_PATTERN = /<a\b[^>]*href\s*=\s*["']([^"']*\/job\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

const decodeHtml = (value = '') => value
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&nbsp;/gi, ' ')

const textContent = (value = '') => decodeHtml(value.replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim()

const absoluteUrl = (value) => new URL(value, CAREER_PAGE_URL).toString()

const extractLocation = (fragment) => {
  const locationMatch = fragment.match(/(?:job-location|jobLocation|location)[^>]*>([\s\S]*?)(?:<\/(?:span|div|li|td)>)/i)
  return locationMatch ? textContent(locationMatch[1]) : ''
}

const extractPostedDate = (fragment) => {
  const datetimeMatch = fragment.match(/<time[^>]+datetime\s*=\s*["']([^"']+)["']/i)
  if (datetimeMatch) return datetimeMatch[1]

  const text = textContent(fragment)
  const dateMatch = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/i)
  return dateMatch ? new Date(dateMatch[0]).toISOString().slice(0, 10) : null
}

export const buildSearchUrl = () => CAREER_PAGE_URL

export const extractSearchResults = (html = '') => {
  const jobs = []
  const matches = [...html.matchAll(JOB_URL_PATTERN)]

  matches.forEach((match, index) => {
    const href = match[1]
    const start = match.index + match[0].length
    const end = matches[index + 1]?.index ?? html.length
    const fragment = html.slice(start, end)
    const title = textContent(match[2])
    const location = extractLocation(fragment)

    if (!title || !/\bIN\b/i.test(location)) return

    jobs.push({
      title,
      company: 'Dana Incorporated',
      location,
      applyUrl: absoluteUrl(href),
      sourceUrl: CAREER_PAGE_URL,
      postedDate: extractPostedDate(fragment),
    })
  })

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'danaincorporated',
  timeoutMs: 15000,
})

export const createDanaIncorporatedScraper = ({ maxJobs = null } = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const jobs = extractSearchResults(await fetchText(buildSearchUrl()))
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'danaincorporated',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createDanaIncorporatedScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Dana Incorporated scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'danaincorporated')
    console.log('DB result:', result)
    process.exit(0)
  }
}
