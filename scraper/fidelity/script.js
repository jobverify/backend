import path from 'path'
import { fileURLToPath } from 'url'

import { runNativeFidelity } from './nativeRun.js'
import FIDELITY_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA=FIDELITY_CATALOG

export const JOBS_XML_URL = 'https://jobs.fidelity.com/in/jobs/xml/?rss=true'

const FIDELITY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  Accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const removeDiacritics = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/\p{Mark}+/gu, '')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = removeDiacritics(decodeHtmlEntities(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractTagValue = (tagName, value) => extractFirst(
  new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i'),
  value,
)

const extractJobBlocks = (xml) => [...String(xml ?? '').matchAll(/<job>\s*[\s\S]*?<\/job>/gi)]
  .map((match) => match[0])

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const uniqueValues = (values) => [...new Set(values.filter(Boolean))]

const titleCase = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .split(/\s+/)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ')
  || null

const normalizeCountry = (value) => {
  const normalized = normalizeWhitespace(value)?.toUpperCase()
  if (!normalized) return null
  if (normalized === 'IN' || normalized === 'IND' || normalized === 'INDIA') return 'India'
  return titleCase(normalized)
}

const normalizeState = (value) => titleCase(value)

export const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern|internship|apprentice/.test(normalized)) return 'Internship'
  if (/contract|temporary|fixed term/.test(normalized)) return 'Contract'
  if (/regular|full[\s-]*time|permanent/.test(normalized)) return 'Full-time'
  if (/part[\s-]*time/.test(normalized)) return 'Part-time'
  return titleCase(normalized)
}

const buildLocation = ({ city, state, country }) => [city, state, country]
  .filter(Boolean)
  .join(', ') || null

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  return parsed.toISOString()
}

const parseFeedEntry = (block) => {
  const sourceUrl = normalizeWhitespace(extractTagValue('url', block))
  const title = normalizeWhitespace(extractTagValue('title', block))
  const jobId = normalizeWhitespace(extractTagValue('apijobid', block))
    || normalizeWhitespace(extractTagValue('requisitionid', block))
  const requisitionId = normalizeWhitespace(extractTagValue('requisitionid', block)) || jobId
  const city = normalizeWhitespace(extractTagValue('city', block))
  const state = normalizeState(extractTagValue('state', block))
  const country = normalizeCountry(extractTagValue('country', block))
  const descriptionHtml = extractTagValue('description', block)

  if (!title || !jobId || !sourceUrl || !city || !country) {
    return null
  }

  return {
    title,
    company: normalizeWhitespace(extractTagValue('company', block)) || 'Fidelity Investments',
    department: normalizeWhitespace(extractTagValue('category', block)),
    location: buildLocation({ city, state, country }),
    city,
    state,
    country,
    jobId,
    requisitionId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeEmploymentType(extractTagValue('jobtype', block)),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: uniqueValues(extractListItems(descriptionHtml)),
    postingDate: normalizeDate(extractTagValue('date', block)),
    closingDate: null,
    jobDescription: stripTags(descriptionHtml),
  }
}

const mergeLocations = (left, right) => uniqueValues([
  ...String(left || '').split(/\s*;\s*/),
  ...String(right || '').split(/\s*;\s*/),
]).join('; ') || null

const mergeFeedEntries = (existing, incoming) => ({
  ...existing,
  company: existing.company || incoming.company,
  department: existing.department || incoming.department,
  location: mergeLocations(existing.location, incoming.location),
  city: existing.city || incoming.city,
  state: existing.state || incoming.state,
  country: existing.country || incoming.country,
  applyUrl: existing.applyUrl || incoming.applyUrl,
  employmentType: existing.employmentType || incoming.employmentType,
  requiredSkills: uniqueValues([
    ...(existing.requiredSkills || []),
    ...(incoming.requiredSkills || []),
  ]),
  postingDate: existing.postingDate || incoming.postingDate,
  jobDescription: existing.jobDescription?.length >= (incoming.jobDescription?.length || 0)
    ? existing.jobDescription
    : incoming.jobDescription,
})

export const extractJobsFromFeed = (xml) => {
  const jobsByKey = new Map()

  for (const block of extractJobBlocks(xml)) {
    const job = parseFeedEntry(block)
    if (!job) continue

    const key = job.sourceUrl || job.jobId
    const existing = jobsByKey.get(key)

    jobsByKey.set(key, existing ? mergeFeedEntries(existing, job) : job)
  }

  return [...jobsByKey.values()]
}

export const createDefaultFetchText=({fetchImpl=fetch}={})=>async url=>{const signal=AbortSignal.timeout(15000),r=await fetchImpl(url,{headers:FIDELITY_HEADERS,signal});signal.throwIfAborted();if(r.status!==200)throw Error('Fidelity native public HTTP unavailable: '+r.status);const body=await r.text();signal.throwIfAborted();if(typeof body!=='string'||!body.trim())throw Error('Fidelity native body unavailable');return body}

const defaultFetchText = createDefaultFetchText()

export const createFidelityScraper = ({
  maxJobs = null,
  now,
} = {}) => ({
  async run(options = {}) {
    return runNativeFidelity({now,...options,maxJobs:options.maxJobs??maxJobs})
  },
})

export const run = async (options={}) => createFidelityScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Fidelity scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'fidelity')
    console.log('DB result:', result)
    process.exit(0)
  }
}
