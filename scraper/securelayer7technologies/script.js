import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const SOURCE = 'securelayer7technologies'
const COMPANY = 'SecureLayer7 Technologies Pvt. Ltd'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export const CAREERS_URL = 'https://securelayer7.net/careers'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toTitleCase = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .split(/[\s-]+/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(normalized.includes('-') ? '-' : ' ')
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full-time' || normalized === 'full time' || normalized === 'full_time') {
    return 'Full-time'
  }
  if (normalized === 'part-time' || normalized === 'part time' || normalized === 'part_time') {
    return 'Part-time'
  }
  return toTitleCase(normalized)
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return 'On-site'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'remote') return 'Remote'
  return 'On-site'
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const toCountryName = (value) => {
  const normalized = normalizeWhitespace(value)?.toUpperCase()
  if (!normalized) return null
  if (normalized === 'IN' || normalized === 'INDIA') return 'India'
  if (normalized === 'US' || normalized === 'USA' || normalized === 'UNITED STATES') return 'United States'
  return normalizeWhitespace(value)
}

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
    }
  }

  if (/,\s*india$/i.test(normalized)) {
    return {
      location: normalized,
      city: normalizeWhitespace(normalized.replace(/,\s*india$/i, '')),
    }
  }

  return {
    location: /india/i.test(normalized) ? normalized : `${normalized}, India`,
    city: normalized,
  }
}

const locationIncludesCity = (location, city) => {
  const normalizedLocation = normalizeWhitespace(location)?.toLowerCase()
  const normalizedCity = normalizeWhitespace(city)?.toLowerCase()

  if (!normalizedLocation || !normalizedCity) return false
  return normalizedLocation.includes(normalizedCity)
}

const isConfidentialLocation = (location) =>
  /\bconfidential\b/i.test(normalizeWhitespace(location) || '')

const resolveCity = ({ visibleLocation, schema }) => {
  if (isConfidentialLocation(visibleLocation.location)) {
    return schema?.city || visibleLocation.city
  }

  if (!visibleLocation.city) return schema?.city || null
  if (!schema?.city) return visibleLocation.city

  return locationIncludesCity(visibleLocation.location, schema.city)
    ? schema.city
    : visibleLocation.city
}

export const hasOfficialCareersSurface = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*\|\s*SecureLayer7\s*<\/title>/i.test(page)
    && /Open roles for pentesters, researchers, engagement leads, and engineers at SecureLayer7/i.test(page)
    && /https:\/\/sechire\.net\/jobs\//i.test(page)
    && hasPositionsPayload(page)
}

const findPositionsPayloadMatch = (page) =>
  page.match(/\\"positions\\":(\[[\s\S]*?\]),\\"emptyStateMessage\\"/)
  || page.match(/"positions":(\[[\s\S]*?\]),"emptyStateMessage"/)

const hasPositionsPayload = (page) => Boolean(findPositionsPayloadMatch(page))

const extractPositionsJson = (html) => {
  const page = String(html ?? '')
  const payloadMatch = findPositionsPayloadMatch(page)

  if (!payloadMatch) {
    throw new Error('SecureLayer7 careers page no longer exposes the verified embedded positions payload')
  }

  if (payloadMatch[0].startsWith('\\"positions\\"')) {
    const normalizedPayload = payloadMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')

    return JSON.parse(normalizedPayload)
  }

  return JSON.parse(payloadMatch[1])
}

const extractJobPostingMetadata = (html) => {
  const metadata = new Map()

  for (const match of String(html ?? '').matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
  )) {
    let payload
    try {
      payload = JSON.parse(match[1])
    } catch {
      continue
    }

    const nodes = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.['@graph'])
        ? payload['@graph']
        : [payload]

    for (const node of nodes) {
      if (node?.['@type'] !== 'JobPosting') continue

      const url = normalizeWhitespace(node.url)
      if (!url) continue

      const address = node?.jobLocation?.address || {}
      metadata.set(url, {
        country: toCountryName(address.addressCountry),
        city: normalizeWhitespace(address.addressLocality),
        state: normalizeWhitespace(address.addressRegion),
        postingDate: normalizeDate(node.datePosted),
        closingDate: normalizeDate(node.validThrough),
        employmentType: normalizeEmploymentType(node.employmentType),
        description: normalizeWhitespace(node.description),
        requisitionId: normalizeWhitespace(node?.identifier?.value),
      })
    }
  }

  return metadata
}

export const extractOpenPositions = (html) => {
  if (!hasOfficialCareersSurface(html)) {
    throw new Error('SecureLayer7 careers page no longer matches the verified official public careers surface')
  }

  const positions = extractPositionsJson(html)
  const jobPostingMetadata = extractJobPostingMetadata(html)
  const jobs = []

  for (const position of positions) {
    const applyUrl = normalizeWhitespace(position?.applyUrl)
    const schema = applyUrl ? jobPostingMetadata.get(applyUrl) : null

    if (!applyUrl || schema?.country !== 'India') continue

    const visibleLocation = parseLocation(position?.location)
    const requisitionId = schema?.requisitionId || normalizeWhitespace(position?.slug)
    const jobId = normalizeWhitespace(position?.slug)
    const title = normalizeWhitespace(position?.title)

    if (!title || !jobId || !requisitionId || !visibleLocation.location) continue

    jobs.push({
      title,
      company: COMPANY,
      department: normalizeWhitespace(position?.department),
      location: visibleLocation.location,
      city: resolveCity({ visibleLocation, schema }),
      state: schema?.state || null,
      country: 'India',
      jobId,
      requisitionId,
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: schema?.employmentType || normalizeEmploymentType(position?.employmentType),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: schema?.postingDate || null,
      closingDate: schema?.closingDate || null,
      jobDescription: schema?.description || normalizeWhitespace(position?.summary),
      remoteStatus: normalizeRemoteStatus(position?.workMode),
    })
  }

  if (jobs.length === 0) {
    throw new Error('SecureLayer7 careers page no longer exposes verified India public openings')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSecureLayer7TechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    return extractOpenPositions(html).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createSecureLayer7TechnologiesScraper().run(options)

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
