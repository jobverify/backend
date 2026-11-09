import path from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'node:crypto'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.verteil.com/career'

const COMPANY = 'Verteil Technologies'
const SOURCE = 'verteiltechnologies'

const normalizeText = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const slugify = (value) => normalizeText(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const getLocationData = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  if (/kochi\s*-\s*kerala/i.test(normalized)) {
    return {
      location: 'Kochi, Kerala, India',
      city: 'Kochi',
      country: 'India',
    }
  }

  if (/india/i.test(normalized)) {
    return {
      location: 'India',
      city: null,
      country: 'India',
    }
  }

  return {
    location: normalized,
    city: null,
    country: null,
  }
}

const getEmploymentType = (value) => (/hybrid/i.test(String(value ?? '')) ? 'Hybrid' : null)

const getDepartment = (value) => (/non[-\s]*engineering/i.test(String(value ?? '')) ? 'Non Engineering' : null)

const getTitle = (value) => normalizeText(String(value ?? '')
  .replace(/\bNon[-\s]*Engineering\b/gi, ' ')
  .replace(/\bHybrid\s*-\s*India\b/gi, ' ')
  .replace(/\bHybrid\b/gi, ' ')
  .replace(/\bKochi\s*-\s*Kerala\b/gi, ' ')
  .replace(/\s*-\s*India\b/gi, ' ')
  .replace(/\s+/g, ' ')
  .replace(/\s+-\s+$/g, ' ')
)

const getJobId = (applyUrl, title) => {
  try {
    const jobId = new URL(applyUrl).searchParams.get('job')
    if (jobId) return jobId
  } catch {
    // Fall back to a stable slug when the public apply URL shape changes.
  }

  return `${SOURCE}-${slugify(title)}`
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return (
    /we'?re hiring/i.test(page)
      && /open positions/i.test(page)
      && /ta@verteil\.com/i.test(page)
      && /recruitcareers\.zappyhire\.com\/en\/Verteil\/apply\?job=/i.test(page)
  ) || (
    /<title>\s*careers\s*\|\s*verteil\s*<\/title>/i.test(page)
      && /Join our movement to revolutionize the Airline retailing domain/i.test(page)
      && /recruitcareers\.zappyhire\.com\/en\/Verteil\/apply\?job=/i.test(page)
  )
}

export const extractJobCards = (html) => [...String(html ?? '').matchAll(
  /<a\b[^>]*\bhref=["'](https:\/\/recruitcareers\.zappyhire\.com\/en\/Verteil\/apply\?job=\d+)["'][^>]*>\s*([\s\S]*?)\s*<\/a>/gi,
)]
  .map((match) => {
    const [, applyUrl, rawLabel] = match
    const label = normalizeText(rawLabel)
    const title = getTitle(label)
    const locationData = getLocationData(label)

    if (!label || !title) return null

    return {
      title,
      company: COMPANY,
      department: getDepartment(label),
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId: getJobId(applyUrl, title),
      requisitionId: getJobId(applyUrl, title),
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: getEmploymentType(label),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const NATIVE_API = 'https://verteil.zappyhire-multitenant-be-prod.zappyhire.com/api/'

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal, attempts: 1, timeoutMs: 15000, headers: { 'User-Agent': USER_AGENT },
})

const defaultFetchNative = (url, { signal }) => fetchJsonWithRetry(url, {
  signal, attempts: 1, timeoutMs: 10000, redirect: 'manual', includeResponseMetadata: true,
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
})

const envelope = payload => payload?.status === 1 && payload.errors === ''
  && payload.results && typeof payload.results === 'object' && !Array.isArray(payload.results) ? payload.results : null

const verifiedConfig = payload => {
  const config = envelope(payload)
  return config?.name === 'Verteil' && config.website === 'https://www.verteil.com/' ? config : null
}

const nativeUrls = job => /^\d+$/.test(job.jobId) && job.requisitionId === job.jobId
  && job.applyUrl === `https://recruitcareers.zappyhire.com/en/Verteil/apply?job=${job.jobId}`
  ? { config: `${NATIVE_API}careers/configurations/?job=${job.jobId}`, detail: `${NATIVE_API}careers/jobs/${job.jobId}/` } : null

// The public apply client renders job_publish_date under "Posted on" and reads
// careers/jobs/{id}/. Its unrelated similar_jobs and creation fields are excluded.
export const extractVerifiedNativeDetail = (payload, configPayload, job) => {
  const native = envelope(payload), urls = nativeUrls(job)
  if (!verifiedConfig(configPayload) || !native || !urls || String(native.id) !== job.jobId
    || normalizeText(native.title) !== job.title || !Array.isArray(native.location) || !native.location.length
    || !Array.isArray(native.job_board_urls)) return null
  const locations = native.location.map(location => getLocationData(location?.city))
  if (locations.some((location, index) => location.country !== 'India'
    || !/^(?:Kochi\s*-\s*Kerala|(?:Hybrid\s*-\s*)?India)$/i.test(normalizeText(native.location[index]?.city) || '')
    || (native.location[index].country_code != null && native.location[index].country_code !== 'IN')
    || (job.city && location.city !== job.city)) || job.country !== 'India') return null
  const careerPages = native.job_board_urls.filter(board => board?.name === 'Career Page')
  if (careerPages.length !== 1 || careerPages[0].feature?.name !== 'career_page'
    || careerPages[0].feature.is_active !== true || careerPages[0].feature.is_enabled !== true) return null
  try {
    const url = new URL(careerPages[0].url)
    if (url.origin !== 'https://recruitcareers.zappyhire.com' || url.pathname !== '/verteil/apply'
      || url.username || url.password || url.hash || url.searchParams.get('job') !== job.jobId
      || url.searchParams.get('source') !== '1' || url.searchParams.get('company') !== '1') return null
  } catch { return null }
  if (typeof native.description !== 'string' || native.description.length > 500000) return null
  const description = native.description.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(?:p|div|li|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .split(/\r?\n/).map(normalizeText).filter(Boolean).join('\n\n')
  if (description.length < 100) return null
  const nativeDate = typeof native.job_publish_date === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(native.job_publish_date)
    && Number.isFinite(Date.parse(native.job_publish_date))
    && new Date(native.job_publish_date).toISOString().slice(0, 10) === native.job_publish_date.slice(0, 10)
    ? native.job_publish_date : null
  return {
    jobDescription: description, sourceDescription: description,
    nativeDescriptionSHA256: createHash('sha256').update(native.description).digest('hex'),
    sourceDetailComplete: true, sourceDetailUrl: urls.detail, sourceUrl: job.applyUrl,
    nativeLocationEvidence: native.location,
    ...(nativeDate ? { postingDate: nativeDate.slice(0, 10), nativeJobPublishDate: nativeDate,
      sourceDateEvidence: 'verteil-native-job-posting-v1' } : {}),
    employmentType: normalizeText(native.job_type) || job.employmentType,
    department: normalizeText(native.department) || job.department,
    requiredSkills: Array.isArray(native.skills) ? native.skills.map(normalizeText).filter(Boolean) : [],
  }
}

export const createVerteilTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchNative = defaultFetchNative, signal,
    now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    const html = await fetchText(CAREERS_URL, { signal })

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('Verteil Technologies official careers surface changed; refusing to scrape')
    }

    const jobs = extractJobCards(html), enriched = new Array(jobs.length)
    const budget = AbortSignal.timeout(45000), detailSignal = signal ? AbortSignal.any([signal, budget]) : budget
    let cursor = 0
    // Enrich only roles advertised by the first-party company page. This does
    // not enumerate or claim complete inventory of the wider Zappyhire tenant.
    await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, async () => {
      while (cursor < jobs.length) {
        const index = cursor++, job = jobs[index], urls = nativeUrls(job)
        let detail = null, failureKind = 'missing-authoritative-jobposting'
        if (urls && !detailSignal.aborted) {
          try {
            const request = async url => {
              const requestSignal = AbortSignal.any([detailSignal, AbortSignal.timeout(10000)])
              const response = await fetchNative(url, { signal: requestSignal })
              requestSignal.throwIfAborted()
              if (response?.status !== 200 || response.url !== url) throw new Error('Native detail access failed')
              return response.payload
            }
            const config = await request(urls.config)
            if (verifiedConfig(config)) detail = extractVerifiedNativeDetail(await request(urls.detail), config, job)
          } catch {
            signal?.throwIfAborted()
            failureKind = 'source-detail-access-failed'
          }
        }
        enriched[index] = detail ? { ...job, ...detail, sourceDetailVerifiedAt: now() }
          : { ...job, sourceDescription: null, sourceDetailComplete: false, sourceDetailUrl: urls?.detail || null,
            sourceDetailFailureKind: failureKind }
      }
    }))
    signal?.throwIfAborted()
    return enriched.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createVerteilTechnologiesScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Verteil Technologies scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
