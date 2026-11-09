import https from 'node:https'

export const CAREER_PAGE_URL = 'https://cbre.dejobs.org/locations/ind/jobs/'
export const API_ENDPOINT = 'https://prod-search-api.jobsyn.org/api/v1/solr/search'
export const PAGE_SIZE = 10
export const REQUEST_HEADERS = {
  Accept: 'application/json',
  'X-Origin': 'cbre.dejobs.org',
  Referer: CAREER_PAGE_URL,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
}

const COMPANY = 'CBRE'
const SOURCE = 'cbre'

const slugifySegment = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const deriveCity = (location) => String(location || '').split(',')[0]?.trim() || null

const normalizeEmploymentType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'full-time') return 'Full-time'
  if (normalized === 'part-time') return 'Part-time'
  if (normalized === 'contract') return 'Contract'
  return String(value).trim() || null
}

const isIndiaJob = (job) => {
  const location = String(job?.location_exact || '').toLowerCase()
  const country = String(job?.country_exact || '').toLowerCase()
  return country === 'india' || /\bind\b/.test(location) || /\bindia\b/.test(location)
}

const buildJobUrl = (job) => {
  const locationSlug = slugifySegment(job.location_exact)
  const titleSlug = slugifySegment(job.title_slug)
  const guid = String(job.guid || '').trim()

  if (!locationSlug || !titleSlug || !guid) return null
  return `https://cbre.dejobs.org/${locationSlug}/${titleSlug}/${guid}/job/`
}

const fetchJsonWithHttps = (url, { headers = {} } = {}) =>
  new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          ...REQUEST_HEADERS,
          ...headers,
        },
      },
      (response) => {
        const chunks = []

        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')

          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode} for ${url}`))
            return
          }

          try {
            resolve(JSON.parse(body))
          } catch (error) {
            reject(new Error(`Invalid JSON from ${url}: ${error.message}`))
          }
        })
      },
    )

    request.on('error', reject)
  })

export const mapCbreJob = (job) => {
  if (!isIndiaJob(job)) return null

  const jobUrl = buildJobUrl(job)
  if (!jobUrl) return null

  return {
    title: job.title_exact || null,
    company: COMPANY,
    department: job.job_category || null,
    location: job.location_exact || null,
    city: deriveCity(job.location_exact),
    country: job.country_exact || 'India',
    jobId: job.guid || null,
    requisitionId: job.reqid || null,
    sourceUrl: jobUrl,
    applyUrl: jobUrl,
    employmentType: normalizeEmploymentType(job.job_shift),
    experienceRequired: job.job_type || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: job.date_new || job.date_updated || null,
    closingDate: null,
    jobDescription: job.description || null,
    remoteStatus: Array.isArray(job.on_sites) && job.on_sites.includes(0) ? 'On-site' : null,
  }
}

export const createCbreScraper = () => ({
  async run({ fetchJson = fetchJsonWithHttps } = {}) {
    const jobs = []
    let page = 1

    while (true) {
      const url = `${API_ENDPOINT}?page=${page}&location=ind&num_items=${PAGE_SIZE}`
      const payload = await fetchJson(url, { headers: REQUEST_HEADERS })
      const pageJobs = Array.isArray(payload?.jobs) ? payload.jobs : []

      for (const rawJob of pageJobs) {
        const mapped = mapCbreJob(rawJob)
        if (!mapped) continue

        jobs.push({
          ...mapped,
          source: SOURCE,
          link: mapped.applyUrl,
          scrapedAt: new Date().toISOString(),
        })
      }

      if (!payload?.pagination?.has_more_pages || pageJobs.length === 0) break
      page += 1
    }

    return jobs
  },
})

export const run = async () => createCbreScraper().run()
