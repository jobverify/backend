import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { IRIS_BUSINESS_SERVICES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = IRIS_BUSINESS_SERVICES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const KEKA_BOARD_URL = PROVIDER_METADATA.kekaBoardUrl
export const KEKA_IDENTIFIER = PROVIDER_METADATA.kekaIdentifier
export const KEKA_INFO_URL = `${KEKA_BOARD_URL}api/organization/default/careerportalinfo`
export const KEKA_JOBS_URL = `${KEKA_BOARD_URL}api/embedjobs/default/active/${KEKA_IDENTIFIER}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})
const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Current Openings\s*\|\s*IRIS RegTech Solutions Limited\s*<\/title>/i.test(page)
    && normalizeWhitespace(page).includes('formerly known as IRIS Business Services Limited')
    && page.includes(`identifier: '${KEKA_IDENTIFIER}'`)
    && page.includes(`domain: '${KEKA_BOARD_URL}'`)
    && page.includes(`${KEKA_BOARD_URL}api/embedjobs/js/${KEKA_IDENTIFIER}`)
}

export const extractKekaJobs = (payload) => {
  if (!Array.isArray(payload)) throw new Error('IRIS Keka inventory is not an array')
  const ids = new Set()
  let unknownGeography = false
  const jobs = []
  for (const row of payload) {
    const id = String(row?.id ?? '').trim()
    const title = normalizeWhitespace(row?.title)
    const description = normalizeWhitespace(row?.description)
    if (!/^\d+$/.test(id) || !title || !description || !Array.isArray(row?.jobLocations)) {
      throw new Error('IRIS Keka inventory contains an incomplete posting')
    }
    if (ids.has(id)) throw new Error('IRIS Keka inventory contains a duplicate posting ID')
    ids.add(id)
    const locations = row.jobLocations
    if (!locations.length || locations.some(location => !location?.countryCode && !location?.countryName)) unknownGeography = true
    const indiaLocations = locations.filter(location => location?.countryCode === 'IN' || location?.countryName === 'India')
    if (!indiaLocations.length) continue
    const cities = [...new Set(indiaLocations.map(location => normalizeWhitespace(location.city || location.name)).filter(Boolean))]
    const posted = row.publishedOn ? new Date(row.publishedOn) : null
    if (posted && !Number.isFinite(posted.getTime())) throw new Error('IRIS Keka inventory contains an invalid date')
    const sourceUrl = `${KEKA_BOARD_URL}jobdetails/${id}`
    const applyUrl = `${KEKA_BOARD_URL}applyjob/${id}`
    jobs.push({
      title, company: COMPANY, source: SOURCE, jobId: id, requisitionId: id,
      location: [...cities, 'India'].join(', '), city: cities[0] || null, country: 'India',
      department: normalizeWhitespace(row.departmentName) || null,
      sourceUrl, applyUrl, link: sourceUrl,
      postingDate: posted?.toISOString().slice(0, 10) || null,
      employmentType: row.jobType === 2 ? 'Full-time' : null,
      experienceRequired: normalizeWhitespace(row.experience) || null,
      requiredSkills: Array.isArray(row.skillNames) ? row.skillNames.map(normalizeWhitespace).filter(Boolean) : [],
      jobDescription: description, companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain, atsPlatform: 'keka',
    })
  }
  if (unknownGeography && !jobs.length) throw new Error('IRIS Keka inventory has no confirmed India roles and unknown geography')
  return jobs.map(job => ({ ...job, ...(unknownGeography ? { sourceListingComplete: false } : {}) }))
}

export const createIrisBusinessServicesScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('IRIS first-party Keka handoff no longer matches the trusted careers page')
    }
    const info = await fetchJson(KEKA_INFO_URL)
    if (info?.name !== 'IRIS RegTech Solutions Limited' || info?.careersPortalDomain !== 'irsl.keka.com') {
      throw new Error('IRIS Keka tenant identity changed')
    }
    return extractKekaJobs(await fetchJson(KEKA_JOBS_URL)).map(job => ({ ...job, scrapedAt: now() }))
  },
})

export const run = async (options = {}) => createIrisBusinessServicesScraper().run(options)

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
