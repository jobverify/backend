import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lumo'
export const COMPANY = 'Lumo'
export const HOMEPAGE_URL = 'https://lumo.proton.me/'
export const CAREERS_URL = 'https://proton.me/careers'
export const GREENHOUSE_API_URL = 'https://boards-api.greenhouse.io/v1/boards/proton/jobs?content=true'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  /hey, i'm lumo/i,
  /the ai that respects your privacy/i,
  /built by the team that knows privacy/i,
]

const CAREERS_SIGNALS = [
  /<title>\s*Career opportunities \| Proton\s*<\/title>/i,
  /Working at Proton|Open positions/i,
  /JobsListSection(?:\.[a-z0-9_-]+)?\.js/i,
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bjob listing(s)?\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bjob description\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)
  return HOMEPAGE_SIGNALS.every((pattern) => pattern.test(normalized))
}

export const hasCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const haystack = `${rawHtml} ${normalized}`
  return CAREERS_SIGNALS.every((pattern) => pattern.test(haystack))
}

export const isVerifiedHomepage = (page = {}) =>
  Number(page?.status) === 200
  && hasHomepageSignal(page?.html)
  && !hasPublicJobsSignal(page?.html)

export const isVerifiedCareersLandingPage = (page = {}) =>
  Number(page?.status) === 200
  && hasCareersSignal(page?.html)

const metadataIncludesIndia = (metadata = []) =>
  (Array.isArray(metadata) ? metadata : []).some((entry) =>
    /country/i.test(String(entry?.name ?? ''))
    && /india/i.test(String(entry?.value ?? '')))

const getOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeWhitespace(office?.location || office?.name))
    .filter(Boolean)

const isIndiaJob = (job = {}) => {
  const locationText = [
    normalizeWhitespace(job?.location?.name),
    ...getOfficeLocations(job),
  ].filter(Boolean).join(' ')

  return /(?:^|,\s*|;\s*)India(?:$|[\s,);-])/i.test(locationText)
    || /\bBangalore\b|\bBengaluru\b|\bHyderabad\b|\bMumbai\b|\bPune\b|\bChennai\b|\bGurugram\b|\bGurgaon\b|\bNoida\b|\bDelhi\b/i.test(locationText)
    || metadataIncludesIndia(job?.metadata)
}

const inferLocation = (job = {}) =>
  [normalizeWhitespace(job?.location?.name), ...getOfficeLocations(job)]
    .find(Boolean) || null

const inferCity = (location) => normalizeWhitespace(String(location ?? '').split(',')[0]) || null

const getMetadataValue = (job = {}, name) => {
  const entry = (Array.isArray(job?.metadata) ? job.metadata : [])
    .find((item) => normalizeWhitespace(item?.name) === name)

  return normalizeWhitespace(entry?.value)
}

const normalizeGreenhouseUrl = (value = '', jobId = null) => {
  const normalizedJobId = normalizeWhitespace(jobId)

  try {
    const url = new URL(String(value ?? ''))
    const host = url.hostname.replace(/^www\./i, '').toLowerCase()
    if (host !== 'job-boards.greenhouse.io' && host !== 'boards.greenhouse.io') return null
    if (url.pathname !== `/proton/jobs/${normalizedJobId}` || !normalizedJobId) return null

    return normalizedJobId
      ? `https://job-boards.greenhouse.io/proton/jobs/${normalizedJobId}`
      : url.toString()
  } catch {
    return null
  }
}

export const extractIndiaJobsFromGreenhousePayload = (payload = {}) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Lumo/Proton Greenhouse payload no longer exposes a jobs array')
  }

  return jobs
    .filter(isIndiaJob)
    .map((job) => {
      const title = normalizeWhitespace(job?.title)
      const location = inferLocation(job)
      const jobId = normalizeWhitespace(job?.id)
      const sourceUrl = normalizeGreenhouseUrl(job?.absolute_url, jobId)

      if (!title || !location || !sourceUrl) throw new Error('Lumo/Proton incomplete snapshot: invalid India job')

      return {
        title,
        company: COMPANY,
        department: getMetadataValue(job, 'Job group')
          || normalizeWhitespace(job?.departments?.[0]?.name),
        location,
        city: inferCity(location),
        country: 'India',
        jobId,
        requisitionId: normalizeWhitespace(job?.requisition_id) || jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.first_published || job?.updated_at)?.slice(0, 10) || null,
        closingDate: null,
        jobDescription: normalizeWhitespace(job?.content),
      }
    })
    .filter(Boolean)
}

export const createLumoScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson, now = () => new Date().toISOString(), signal } = {}) {
    signal?.throwIfAborted()
    const homepage = await fetchPage(HOMEPAGE_URL, { signal })
    signal?.throwIfAborted()

    if (!isVerifiedHomepage(homepage)) {
      throw new Error('Lumo verified official homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL, { signal })
    signal?.throwIfAborted()

    if (!isVerifiedCareersLandingPage(careersPage)) {
      throw new Error('Lumo careers surface changed materially or now exposes public jobs')
    }

    const apiBinding = /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/proton\/jobs(?:\?content=true)?["'`]/
    if (!apiBinding.test(careersPage.html)) {
      const componentPath = careersPage.html.match(/component-url=["'](\/_astro\/JobsListSection(?:\.[a-z0-9_-]+)?\.js)["']/i)?.[1]
      if (!componentPath) throw new Error('Lumo Proton Greenhouse handoff module is missing')
      const componentUrl = new URL(componentPath, CAREERS_URL).toString()
      const component = await fetchPage(componentUrl, { signal })
      signal?.throwIfAborted()
      if (component.status !== 200 || component.url !== componentUrl || !apiBinding.test(component.html)) {
        throw new Error('Lumo Proton Greenhouse handoff is no longer verified by the public jobs module')
      }
    }
    const jobs = extractIndiaJobsFromGreenhousePayload(await fetchJson(GREENHOUSE_API_URL, { signal }))

    signal?.throwIfAborted()
    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createLumoScraper().run(options)

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
