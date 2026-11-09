import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const JOBS_PAGE_URL = 'https://jobs.echostar.com/jobs'
export const INDIA_LOCATION_QUERY = 'India'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const [, month, day, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const formatLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized?.match(/^IN[-,\s]+(.+)$/i)
  if (!match) return null

  const city = normalizeWhitespace(match[1])
  return city ? { city, location: `${city}, India` } : null
}

const getField = (html, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(new RegExp(
    `<dt[^>]*>\\s*${escapedLabel}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`,
    'i',
  ))

  return normalizeWhitespace(match?.[1])
}

const getRows = (html) => {
  const rows = []
  const rowPattern = /<div[^>]*class=["'][^"']*iCIMS_JobsTableRow[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]*class=["'][^"']*iCIMS_JobsTableRow|<\/main>|<\/body>|$)/gi
  let match

  while ((match = rowPattern.exec(html)) !== null) {
    rows.push(match[1])
  }

  return rows
}

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const url = new URL(JOBS_PAGE_URL)
  url.searchParams.set('location', INDIA_LOCATION_QUERY)
  url.searchParams.set('page', String(Math.max(1, Number(page) || 1)))
  url.searchParams.set('sortBy', 'distance_from')
  url.searchParams.set('stretch', '10')
  url.searchParams.set('stretchUnit', 'MILES')
  url.searchParams.set('woe', '12')
  return url.toString()
}

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')
  return /<title[^>]*>[\s\S]*?(search jobs|jobs)[\s\S]*?(echostar|dish)[\s\S]*?<\/title>/i.test(page)
    || (/\bsearch jobs\b/i.test(page) && /\b(iCIMS|EchoStar|DISH Network Technologies)\b/i.test(page))
}

export const extractJobListings = (html) => getRows(String(html ?? ''))
  .map((row) => {
    const linkMatch = row.match(/<a[^>]+href=["']([^"']*\/jobs\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    const title = normalizeWhitespace(linkMatch?.[2])
    const jobId = getField(row, 'Job ID')
    const formattedLocation = formatLocation(getField(row, 'Location'))

    if (!title || !jobId || !formattedLocation || !linkMatch?.[1]) return null

    const sourceUrl = new URL(linkMatch[1], `${JOBS_PAGE_URL}/`).toString()

    return {
      title,
      company: 'DISH Network Technologies',
      department: getField(row, 'Department'),
      location: formattedLocation.location,
      city: formattedLocation.city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: toIsoDate(getField(row, 'Posted Date')),
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const hasNextPage = (html) => /<a[^>]+(?:rel=["']next["']|href=["'][^"']*[?&]page=\d+[^"']*["'])[^>]*>\s*next\s*<\/a>/i
  .test(String(html ?? ''))

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createDishNetworkTechnologiesScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, maxPages = Number.POSITIVE_INFINITY } = {}) {
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const html = await fetchText(buildSearchUrl({ page }))
      if (!hasOfficialJobsPageSignal(html)) {
        throw new Error('EchoStar jobs page no longer matches the official DISH Network Technologies careers surface')
      }

      const listings = extractJobListings(html)
      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)
        jobs.push({
          ...listing,
          source: 'dishnetworktechnologies',
          link: listing.applyUrl,
          scrapedAt: now(),
        })
      }

      if (!hasNextPage(html)) break
    }

    return jobs
  },
})

export const run = async () => createDishNetworkTechnologiesScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'dishnetworktechnologies')
  }
}
