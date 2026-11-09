import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createVerifiedRecruitmentScraper} from '../../scraper-support/utils/verifiedRecruitment.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const JOBS_PAGE_URL = 'https://careers.eagleview.com/jobs'
export const INDIA_LOCATION_QUERY = 'India'

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

  const city = normalizeWhitespace(match[1]?.split(',')[0])
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

const buildJobUrl = (href) => {
  if (!href) return null

  const url = new URL(href, `${JOBS_PAGE_URL}/`)
  if (!/^\/jobs\/\d+\/?$/i.test(url.pathname)) return null

  url.searchParams.set('lang', 'en-us')
  return url.toString()
}

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const url = new URL(JOBS_PAGE_URL)
  url.searchParams.set('location', INDIA_LOCATION_QUERY)
  url.searchParams.set('page', String(Math.max(1, Number(page) || 1)))
  url.searchParams.set('sortBy', 'distance_from')
  url.searchParams.set('stretch', '10')
  url.searchParams.set('stretchUnit', 'MILES')
  url.searchParams.set('woe', '12')
  url.searchParams.set('lang', 'en-us')
  return url.toString()
}

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')
  return /<title[^>]*>[\s\S]*?(search jobs|jobs)[\s\S]*?eagleview[\s\S]*?<\/title>/i.test(page)
    || (/\bsearch jobs\b/i.test(page) && /\bEagleview\b/i.test(page) && /\biCIMS(?:_JobsTable|_JobsTableRow)?\b/i.test(page))
}

export const extractJobListings = (html) => getRows(String(html ?? ''))
  .map((row) => {
    const linkMatch = row.match(/<a[^>]+href=["']([^"']*\/jobs\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i)
    const title = normalizeWhitespace(linkMatch?.[2])
    const jobId = getField(row, 'Job ID')
    const formattedLocation = formatLocation(getField(row, 'Location'))
    const sourceUrl = buildJobUrl(linkMatch?.[1])

    if (!title || !jobId || !formattedLocation || !sourceUrl) return null

    return {
      title,
      company: 'Eagleview',
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

export const hasNextPage = (html) => /<a[^>]+(?:rel=["']next["']|href=["'][^"']*[?&]page=\d+[^"']*)[^>]*>\s*next\s*<\/a>/i
  .test(String(html ?? ''))

export const createEagleviewScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({fetchText,...options} = {}) {
    return createVerifiedRecruitmentScraper({source:'eagleview',companyName:'Eagleview',companyDomain:'eagleview.com',
      companyCareerPage:JOBS_PAGE_URL,officialHomepageUrl:'https://www.eagleview.com/',requireCorporateIdentityMatch:true,
      requireNativeEmployerName:true,discoverJibeRecruitmentData:true,prioritizeRecruitmentSearch:true,
      stopAfterNativeIndiaLimit:true}).run({now,...options,...(fetchText&&!options.fetchPage?{
        fetchPage:async url=>({url,status:200,html:await fetchText(url)})}: {})})
  },
})

export const run = options => createEagleviewScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'eagleview')
  }
}
