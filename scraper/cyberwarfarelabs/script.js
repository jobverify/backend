import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://cyberwarfare.live/careers/'
export const CAREERS_API_URL = 'https://cyberwarfare.live/api/careers'
const JD_BASE_URL = 'https://cwl-main-website.s3.us-east-1.amazonaws.com/files/'
const DEFAULT_EMAIL = 'careers@cyberwarfare.live'
const VERIFIED_INDIA_REMOTE_JDS = new Set([
  'Security-Intern.pdf',
  'AI-Offensive-Security-Intern.pdf',
])

const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

export const extractCareerJobs = (payload) => {
  if (payload?.success !== true || !Array.isArray(payload.data)) {
    throw new Error('CyberWarFare Labs careers API response changed')
  }
  const jobs = []
  const seenIds = new Set()
  for (const row of payload.data) {
    if (row?.isActive === false) continue
    const jobId = normalize(row?._id)
    const title = normalize(row?.title)
    const description = normalize(row?.description)
    const jd = normalize(row?.jd)
    const location = normalize(row?.location)
    if (!jobId || !title || !description || !/^[a-z0-9._-]+\.pdf$/i.test(jd) || seenIds.has(jobId)) {
      throw new Error('CyberWarFare Labs incomplete or duplicate active career record')
    }
    seenIds.add(jobId)
    if (location !== 'Remote' || !VERIFIED_INDIA_REMOTE_JDS.has(jd)) {
      throw new Error(`CyberWarFare Labs unverified India location for job ${jobId}`)
    }
    const email = normalize(row?.email) || DEFAULT_EMAIL
    if (!/^[^\s@]+@cyberwarfare\.live$/i.test(email)) {
      throw new Error(`CyberWarFare Labs unverified apply email for job ${jobId}`)
    }
    const applyUrl = `mailto:${email}?subject=${encodeURIComponent(`Application for ${title}`)}`
    const sourceUrl = new URL(encodeURIComponent(jd), JD_BASE_URL).toString()
    jobs.push({
      title,
      company: 'CyberWarFare Labs',
      department: normalize(row?.team) || null,
      location: 'Remote, India',
      city: null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl,
      employmentType: /intern/i.test(`${row?.position || ''} ${title}`) ? 'Internship' : null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: description,
      remoteStatus: 'Remote',
      compensation: null,
    })
  }
  return jobs
}

export const createCyberWarfareLabsScraper = () => ({
  async run({ fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const jobs = extractCareerJobs(await fetchJson(CAREERS_API_URL))
    if (jobs.length === 0) {
      return attachInventoryEvidence([], {
        status: 'verified-empty',
        surface: CAREERS_API_URL,
        firstParty: true,
        listingComplete: true,
        pagesFetched: 1,
        reportedTotal: 0,
        indiaFacetCount: 0,
        verifiedAt: now(),
        reason: 'cyberwarfarelabs-official-api-no-active-jobs',
      })
    }
    return jobs.map(job => ({ ...job, source: 'cyberwarfarelabs', link: job.applyUrl, scrapedAt: now() }))
  },
})

export const run = async (options = {}) => createCyberWarfareLabsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  console.log(`Total India jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'cyberwarfarelabs')
}
