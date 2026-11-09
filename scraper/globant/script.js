import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'

const API_URL = 'https://career.globant.com/api/sap/job-requisition-v1'
const TARGET_URL = 'https://career.globant.com/job/Pune-Senior-Node_js-Developer-India-Maha-411057/571978017'
const BASE_URL = 'https://career.globant.com'
const CITY_ALIASES = Object.entries(CANONICAL_CITIES)
  .filter(([alias, canonical]) => !/^(?:remote|none)$/i.test(alias) && !/^(?:Remote|None)$/i.test(canonical))
  .sort(([left], [right]) => right.length - left.length)
const INDIA_REGION_PATTERN = /\b(?:Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana|Himachal Pradesh|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Delhi|Chandigarh|Puducherry|Ladakh|Jammu and Kashmir)\b/i

const decodeEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripTags = (value) => decodeEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const firstMatch = (value, pattern) => String(value).match(pattern)?.[1] || null
const slugify = (value) => stripTags(value).toLowerCase()
  .replace(/[^a-z0-9 -]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')

const dateValue = (value) => {
  const legacyMs = String(value || '').match(/\/Date\((\d+)/)?.[1]
  return legacyMs ? new Date(Number(legacyMs)).toISOString() : (value || null)
}

const deriveRecognizedCity = (...values) => {
  const normalized = values.map(stripTags).join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  for (const [alias, canonical] of CITY_ALIASES) {
    const candidate = alias.replace(/[^a-z0-9]+/g, ' ')
    if (` ${normalized} `.includes(` ${candidate} `)) return canonical
  }
  return null
}

const deriveWorkMode = (...values) => {
  const evidence = values.map(stripTags).join(' ')
  if (/\bhybrid\b|#LI-Hybrid/i.test(evidence)) return 'Hybrid'
  if (/\bremote\b|#LI-Remote/i.test(evidence)) return 'Remote'
  if (/\bon-?site\b|#LI-Onsite/i.test(evidence)) return 'On-site'
  return null
}

const hasIndiaApiLocationEvidence = (raw = {}) => {
  const country = stripTags(raw.country)
  const location = stripTags(raw.location || raw.country)
  if (!/^(?:India|IN|IND)$/i.test(country)) return false
  if (/\bindia\b/i.test(location) || /^IND-/i.test(location)) return true
  if (/\bremote\b|\boffsite\b/i.test(location)) return true
  if (location.includes(',')) {
    return INDIA_REGION_PATTERN.test(location.split(',').slice(1).join(','))
  }
  return Boolean(deriveRecognizedCity(location) || INDIA_REGION_PATTERN.test(location))
}

const mapApiJob = (raw, now) => {
  const id = String(raw.jobReqId || '')
  const title = stripTags(raw.jobTitle)
  const location = stripTags(raw.location || raw.country)
  if (!id || !title || !hasIndiaApiLocationEvidence(raw)) return null
  const sourceUrl = `${BASE_URL}/job/${slugify(title)}/${encodeURIComponent(id)}`
  const description = stripTags(raw.jobDescription) || null
  return {
    title,
    company: 'Globant',
    location,
    city: deriveRecognizedCity(location, title),
    country: 'India',
    link: sourceUrl,
    sourceUrl,
    applyUrl: sourceUrl,
    jobId: id,
    requisitionId: id,
    department: stripTags(raw.area?.[0]?.label) || null,
    employmentType: null,
    remoteStatus: deriveWorkMode(raw.jobDescription, location),
    jobDescription: description,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: dateValue(raw.createdDateTime),
    closingDate: null,
    source: 'globant',
    scrapedAt: now(),
  }
}

export const extractGlobantJobDetail = (html = '', sourceUrl = TARGET_URL) => {
  const source = String(html)
  const hasClosedEvidence = /\b(?:no longer available|job (?:is )?closed|position (?:has been )?filled|applications? (?:are )?closed|job unavailable)\b/i.test(stripTags(source))
    || /(?:"status"|\\"status\\")\s*:\s*(?:"(?:Closed|Inactive)"|\\"(?:Closed|Inactive)\\")/i.test(source)
  const hasActiveEvidence = /<(?:a|button)\b[^>]*>[\s\S]{0,250}\bApply(?:\s+now)?\b/i.test(source)
    || /"status"\s*:\s*"Approved"|\\"status\\"\s*:\s*\\"Approved\\"/i.test(source)
  const pageTitle = stripTags(firstMatch(source, /<title\b[^>]*>([\s\S]*?)<\/title>/i))
  const headingTitle = stripTags(firstMatch(source, /<h[13]\b[^>]*>([\s\S]*?)<\/h[13]>/i))
  const title = pageTitle || headingTitle
  const renderedLocation = firstMatch(
    source,
    /<h3\b[^>]*>[\s\S]*?<\/h3>[\s\S]{0,5000}?<span\b[^>]*class=["'][^"']*bodySm[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  )
  const location = stripTags(
    firstMatch(source, /<span\b[^>]*class=["'][^"']*jobLocation[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
      || renderedLocation
      || firstMatch(source, /\\"location\\":\\"([^"\\]*India)\\"/i),
  )
  const description = stripTags(
    firstMatch(source, /<div\b[^>]*class=["'][^"']*jobDescription[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
      || firstMatch(source, /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i),
  )
  const pathId = (() => {
    try { return new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1) }
    catch { return null }
  })()
  const jobId = stripTags(
    firstMatch(source, /<span\b[^>]*class=["'][^"']*jobId[^"']*["'][^>]*>([\s\S]*?)<\/span>/i),
  ) || pathId

  if (hasClosedEvidence || !hasActiveEvidence || !title || !location || !/\bindia\b/i.test(location)) return null
  return { title, location, description: description || null, jobId }
}

export const createGlobantScraper = ({
  targetUrl = TARGET_URL,
  maxPages = 50,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchJson = (url, options) => fetchJsonWithRetry(url, {
      ...options,
      label: 'globant',
      timeoutMs: 25000,
    }),
    fetchText = (url) => fetchTextWithRetry(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)' },
      label: 'globant-target',
      timeoutMs: 25000,
    }),
  } = {}) {
    if (!Number.isInteger(maxPages) || maxPages <= 0) {
      throw new Error('[globant] maxPages must be a positive integer')
    }
    const jobs = []
    const seen = new Set()
    const seenApiIds = new Set()
    const seenPageSignatures = new Set()
    let declaredTotal = null
    let page = 1

    while (page <= maxPages) {
      const payload = await fetchJson(API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Origin: BASE_URL,
          Referer: `${BASE_URL}/`,
        },
        body: JSON.stringify({ page, q: [], country: ['IN'], deparment: [] }),
      })
      if (!Array.isArray(payload?.jobRequisition)) {
        throw new Error('[globant] API contract no longer exposes jobRequisition')
      }
      if (typeof payload.showMore !== 'boolean') {
        throw new Error('[globant] API contract no longer exposes boolean showMore')
      }
      const pageTotal = Number(payload.total)
      if (!Number.isInteger(pageTotal) || pageTotal < 0) {
        throw new Error('[globant] API contract no longer exposes a valid total')
      }
      if (declaredTotal != null && declaredTotal !== pageTotal) {
        throw new Error('[globant] API total changed during pagination')
      }
      declaredTotal = pageTotal
      const rawJobs = payload.jobRequisition
      const rawIds = rawJobs.map((raw) => String(raw?.jobReqId || '')).filter(Boolean)
      if (rawIds.length !== rawJobs.length || new Set(rawIds).size !== rawIds.length) {
        throw new Error('[globant] API page contains missing or duplicate requisition identities')
      }
      const signature = rawIds.join('|')
      if (rawJobs.length > 0 && seenPageSignatures.has(signature)) {
        throw new Error('[globant] API pagination repeated a page')
      }
      if (rawJobs.length > 0) seenPageSignatures.add(signature)
      const newRawCount = rawIds.filter((id) => !seenApiIds.has(id)).length
      rawIds.forEach((id) => seenApiIds.add(id))
      if (seenApiIds.size > declaredTotal) {
        throw new Error('[globant] API returned more unique requisitions than its declared total')
      }
      for (const raw of rawJobs) {
        if (
          !stripTags(raw?.jobTitle)
          || !stripTags(raw?.location || raw?.country)
          || !hasIndiaApiLocationEvidence(raw)
        ) {
          throw new Error('[globant] India-filtered API returned a malformed or foreign requisition')
        }
        const job = mapApiJob(raw, now)
        if (!job) throw new Error('[globant] failed to normalize a validated API requisition')
        if (seen.has(job.jobId)) continue
        seen.add(job.jobId)
        jobs.push(job)
      }
      if (rawJobs.length === 0) {
        if (payload.showMore || seenApiIds.size < declaredTotal) {
          throw new Error('[globant] API pagination ended before its declared total')
        }
        break
      }
      if (!payload.showMore) {
        if (seenApiIds.size !== declaredTotal) {
          throw new Error('[globant] API returned an incomplete result below its declared total')
        }
        break
      }
      if (seenApiIds.size >= declaredTotal) {
        throw new Error('[globant] API showMore metadata contradicts its declared total')
      }
      if (newRawCount === 0) throw new Error('[globant] API pagination made no progress')
      if (page >= maxPages) {
        throw new Error(`[globant] API pagination limit reached after ${maxPages} pages; refusing truncated results`)
      }
      page += 1
    }

    try {
      const legacy = extractGlobantJobDetail(await fetchText(targetUrl), targetUrl)
      if (legacy && !seen.has(legacy.jobId)) {
        jobs.push({
          title: legacy.title,
          company: 'Globant',
          location: legacy.location,
          city: deriveRecognizedCity(legacy.location, legacy.title),
          country: 'India',
          link: targetUrl,
          sourceUrl: targetUrl,
          applyUrl: targetUrl,
          jobId: legacy.jobId,
          requisitionId: legacy.jobId,
          department: null,
          employmentType: null,
          remoteStatus: deriveWorkMode(legacy.location, legacy.description),
          jobDescription: legacy.description,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          postingDate: null,
          closingDate: null,
          source: 'globant',
          scrapedAt: now(),
        })
      }
    } catch {
      // The enumerated first-party API remains authoritative if the transitional legacy URL closes.
    }

    return jobs
  },
})

export const run = (options = {}) => createGlobantScraper().run(options)
