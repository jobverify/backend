import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const HOMEPAGE_URL = 'https://greennetspark.in/'
export const CAREERS_PAGE_URL = 'https://greennetspark.in/careers'

const COMPANY = 'GreenNetSpark'
const SOURCE = 'greennetspark'
const APPLY_EMAIL = 'careers@greennetspark.in'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim() || null

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const buildApplyUrl = (title) =>
  `mailto:${APPLY_EMAIL}?subject=Application for ${title}&body=Hi GreenNetSpark Team,%0D%0A%0D%0AI am interested in the ${title} position.%0D%0A%0D%0APlease find my resume attached.%0D%0A%0D%0ARegards`

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const normalizeLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
      remoteStatus: null,
    }
  }

  const normalized = location.toLowerCase()
  const hasRemote = /remote/.test(normalized)
  const hasBangalore = /bangalore|bengaluru/.test(normalized)

  return {
    location,
    city: hasBangalore ? 'Bangalore' : null,
    state: hasBangalore ? 'Karnataka' : null,
    country: 'India',
    remoteStatus: hasRemote ? 'Remote' : 'On-site',
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*GreenNetspark\s*[—-]\s*Innovative Business Solutions\s*<\/title>/i.test(page)
    && /href=["']\/GN\.svg["']/i.test(page)
    && /src=["']\/assets\/index-[A-Za-z0-9_-]+\.js["']/i.test(page)
    && /<div[^>]+id=["']root["']/i.test(page)
}

export const extractMainBundleUrl = (html) => {
  const match = String(html ?? '').match(/<script[^>]+src=["'](\/assets\/index-[A-Za-z0-9_-]+\.js)["']/i)
  if (!match) return null
  return new URL(match[1], HOMEPAGE_URL).toString()
}

export const hasOfficialMainBundleSignal = (bundleText) => {
  const page = String(bundleText ?? '')

  return /href\s*:\s*"\/careers"/i.test(page)
    && /import\("\.\/Careers-[A-Za-z0-9_-]+\.js"\)/i.test(page)
    && /info@greennetspark\.in/i.test(page)
    && /linkedin\.com\/company\/greennetspark/i.test(page)
}

export const extractCareersChunkUrl = (bundleText) => {
  const match = String(bundleText ?? '').match(/import\("\.\/(Careers-[A-Za-z0-9_-]+\.js)"\)/i)
  if (!match) return null
  return new URL(`/assets/${match[1]}`, HOMEPAGE_URL).toString()
}

export const hasOfficialCareersChunkSignal = (chunkText) => {
  const page = String(chunkText ?? '')

  return /Software Jobs\s*&\s*Engineering Careers\s*\|\s*GreenNetspark Bangalore/i.test(page)
    && /Careers at GreenNetspark/i.test(page)
    && /Current Openings/i.test(page)
    && /mailto:careers@greennetspark\.in/i.test(page)
}

export const extractJobsFromCareersChunk = (chunkText) => {
  const page = String(chunkText ?? '')
  const jobs = []
  const jobPattern = /\{title:"([^"]+)",type:"([^"]+)",location:"([^"]+)",department:"([^"]+)",description:"([^"]+)"\}/g

  for (const match of page.matchAll(jobPattern)) {
    const [, rawTitle, rawType, rawLocation, rawDepartment, rawDescription] = match
    const title = normalizeWhitespace(rawTitle)
    const employmentType = normalizeEmploymentType(rawType)
    const department = normalizeWhitespace(rawDepartment)
    const jobDescription = normalizeWhitespace(rawDescription)
    const {
      location,
      city,
      state,
      country,
      remoteStatus,
    } = normalizeLocation(rawLocation)
    const slug = slugify(title)

    if (!title || !employmentType || !location || !country || !slug || !jobDescription) continue

    const jobId = `${SOURCE}-${slug}`
    const applyUrl = buildApplyUrl(title)

    jobs.push({
      title,
      company: COMPANY,
      department,
      location,
      city,
      state,
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl,
      employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
      remoteStatus,
    })
  }

  return jobs
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/javascript,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createGreenNetSparkScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Response is not the verified official GreenNetSpark homepage shell')
    }

    const mainBundleUrl = extractMainBundleUrl(homepageHtml)
    if (!mainBundleUrl) {
      throw new Error('GreenNetSpark homepage shell no longer exposes the verified main bundle')
    }

    const mainBundleText = await fetchText(mainBundleUrl)
    if (!hasOfficialMainBundleSignal(mainBundleText)) {
      throw new Error('Response is not the verified official GreenNetSpark main bundle')
    }

    const careersChunkUrl = extractCareersChunkUrl(mainBundleText)
    if (!careersChunkUrl) {
      throw new Error('GreenNetSpark main bundle no longer exposes the verified careers chunk')
    }

    const careersChunkText = await fetchText(careersChunkUrl)
    if (!hasOfficialCareersChunkSignal(careersChunkText)) {
      throw new Error('Response is not the verified official GreenNetSpark careers chunk')
    }

    const jobs = extractJobsFromCareersChunk(careersChunkText)
    if (!jobs.length) {
      throw new Error('GreenNetSpark careers chunk no longer exposes the verified inline job cards')
    }

    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async () => createGreenNetSparkScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running GreenNetSpark scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
