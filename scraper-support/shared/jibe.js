import { fetchJsonWithRetry } from '../utils/fetch.js'

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

const employmentType = (value) => {
  const normalized = stripTags(value).replace(/[_-]+/g, ' ').toLowerCase()
  if (normalized === 'full time') return 'Full-time'
  if (normalized === 'part time') return 'Part-time'
  return normalized ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) : null
}

const categoryName = (categories) => {
  const first = Array.isArray(categories) ? categories[0] : categories
  return stripTags(first?.name ?? first) || null
}

const workModeFor = (...values) => {
  const evidence = values.map(stripTags).join(' ')
  if (/\bhybrid\b/i.test(evidence)) return 'Hybrid'
  if (/\bremote\b|\boffsite\b/i.test(evidence)) return 'Remote'
  if (/\bon-?site\b|\bin[ -]?office\b/i.test(evidence)) return 'On-site'
  return null
}

const joinLocation = (value = {}) => [value.city, value.state, value.country]
  .map(stripTags)
  .filter(Boolean)
  .join(', ')

const getLocations = (data = {}) => {
  const locations = [joinLocation(data)]
  for (const item of Array.isArray(data.multipleLocations) ? data.multipleLocations : []) {
    locations.push(
      typeof item === 'string'
        ? stripTags(item)
        : (joinLocation(item) || stripTags(item?.location || item?.name)),
    )
  }
  if (data.location) locations.push(stripTags(data.location))
  return [...new Set(locations.filter(Boolean))]
}

const getIndiaLocation = (data) => {
  const locations = getLocations(data)
  return locations.find((location) => /\bindia\b/i.test(location)) || null
}

const toJob = ({ data, source, companyName, baseUrl, now }) => {
  const location = getIndiaLocation(data)
  if (!location || !data?.title) return null

  const language = String(data.language || 'en-us').toLowerCase()
  const sourceUrl = new URL(`/jobs/${data.slug || data.req_id || data.id}?lang=${language}`, baseUrl).toString()
  const rawId = data.req_id ?? data.id ?? data.slug
  const id = rawId == null ? null : String(rawId).trim()
  if (!id) return null
  const remoteStatus = workModeFor(data.tags2, data.work_location_option, location)

  return {
    title: stripTags(data.title),
    company: companyName,
    location,
    city: location.split(',')[0]?.trim() || null,
    country: 'India',
    link: sourceUrl,
    sourceUrl,
    applyUrl: data.apply_url || sourceUrl,
    jobId: id,
    requisitionId: id,
    department: categoryName(data.categories || data.department),
    employmentType: employmentType(data.employment_type),
    remoteStatus,
    jobDescription: stripTags(data.description) || null,
    minimumQualification: stripTags(data.qualifications) || null,
    preferredQualification: stripTags(data.preferred_qualifications) || null,
    requiredSkills: Array.isArray(data.skills) ? data.skills.map(stripTags).filter(Boolean) : [],
    postingDate: data.posted_date || null,
    closingDate: data.posting_expiry_date || null,
    source,
    scrapedAt: now(),
  }
}

export const createJibeScraper = ({
  source,
  companyName,
  baseUrl,
  query = {},
  pageSize = 10,
  maxPages = 100,
  now = () => new Date().toISOString(),
}) => ({
  async run({
    fetchJson = (url, options) => fetchJsonWithRetry(url, {
      ...options,
      label: source,
      timeoutMs: 20000,
    }),
  } = {}) {
    const results = []
    const seen = new Set()
    const seenRaw = new Set()
    const seenPageSignatures = new Set()
    let page = 1
    let declaredTotal = null

    if (!Number.isInteger(pageSize) || pageSize <= 0) {
      throw new Error(`[${source}] pageSize must be a positive integer`)
    }
    if (!Number.isInteger(maxPages) || maxPages <= 0) {
      throw new Error(`[${source}] maxPages must be a positive integer`)
    }

    while (true) {
      const url = new URL('/api/jobs', baseUrl)
      Object.entries({ ...query, limit: pageSize, page }).forEach(([key, value]) => {
        if (value != null && value !== '') url.searchParams.set(key, String(value))
      })

      const payload = await fetchJson(url.toString(), {
        headers: { Accept: 'application/json' },
      })
      if (!Array.isArray(payload?.jobs)) {
        throw new Error(`[${source}] Jibe response no longer exposes the expected jobs array`)
      }
      const rawJobs = payload.jobs
      if (rawJobs.length > pageSize) {
        throw new Error(`[${source}] Jibe returned ${rawJobs.length} jobs for a ${pageSize}-job page`)
      }
      const reportedTotal = payload?.totalCount ?? payload?.total_count
      if (reportedTotal != null) {
        const parsedTotal = Number(reportedTotal)
        if (!Number.isInteger(parsedTotal) || parsedTotal < 0) {
          throw new Error(`[${source}] Jibe returned an invalid total count`)
        }
        if (declaredTotal != null && declaredTotal !== parsedTotal) {
          throw new Error(`[${source}] Jibe total count changed during pagination`)
        }
        declaredTotal = parsedTotal
      }

      const rawIdentities = rawJobs.map((item) => {
        const data = item?.data || item
        const identity = data?.req_id || data?.id || data?.slug
        if (!identity) throw new Error(`[${source}] Jibe job is missing a stable identity`)
        return String(identity)
      })
      if (new Set(rawIdentities).size !== rawIdentities.length) {
        throw new Error(`[${source}] Jibe page contains duplicate job identities`)
      }
      const pageSignature = rawIdentities.join('|')
      if (rawJobs.length > 0 && seenPageSignatures.has(pageSignature)) {
        throw new Error(`[${source}] Jibe pagination repeated a page without progress`)
      }
      if (rawJobs.length > 0) seenPageSignatures.add(pageSignature)
      const newRawCount = rawIdentities.filter((identity) => !seenRaw.has(identity)).length
      if (rawJobs.length > 0 && newRawCount === 0) {
        throw new Error(`[${source}] Jibe pagination made no progress`)
      }
      rawIdentities.forEach((identity) => seenRaw.add(identity))
      if (declaredTotal != null && seenRaw.size > declaredTotal) {
        throw new Error(`[${source}] Jibe returned more unique jobs than its declared total`)
      }

      for (const item of rawJobs) {
        const data = item?.data || item
        const job = toJob({ data, source, companyName, baseUrl, now })
        if (!job) {
          throw new Error(`[${source}] India-filtered Jibe page contains a malformed or foreign job`)
        }
        const identity = job?.jobId || job?.sourceUrl
        if (seen.has(identity)) continue
        seen.add(identity)
        results.push(job)
      }

      if (rawJobs.length === 0) {
        if (declaredTotal != null && seenRaw.size < declaredTotal) {
          throw new Error(`[${source}] Jibe pagination ended before the declared total was reached`)
        }
        break
      }
      if (declaredTotal != null) {
        if (seenRaw.size === declaredTotal) break
        if (rawJobs.length < pageSize) {
          throw new Error(`[${source}] Jibe returned a premature short page before its declared total`)
        }
      } else if (rawJobs.length < pageSize) {
        break
      }
      if (page >= maxPages) {
        throw new Error(`[${source}] Jibe pagination limit reached after ${maxPages} pages`)
      }
      page += 1
    }

    return results
  },
})
