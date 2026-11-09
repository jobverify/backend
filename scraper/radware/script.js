export const CAREERS_URL = 'https://www.radware.com/careers/'
export const RADWARE_TALEO_JOBLIST_URL = 'https://radware.taleo.net/careersection/ex/joblist.ftl'

const TALEO_ORIGIN = 'https://radware.taleo.net'
const COMPANY_NAME = 'Radware'
const SOURCE = 'radware'
const LISTING_FIELD_COUNT = 42
const DETAIL_FIELD_COUNT = 36

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#039;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeTaleoField = (value) => {
  const trimmed = String(value ?? '').replace(/^!\*!\s*/u, '')
  if (!trimmed) return ''

  try {
    return decodeURIComponent(trimmed)
  } catch {
    return trimmed
  }
}

const parseSingleQuotedArray = (html, interfaceName, listName) => {
  const pattern = new RegExp(
    `api\\.fillList\\('${interfaceName}', '${listName}', \\[(.*?)\\]\\);`,
    's',
  )
  const match = String(html ?? '').match(pattern)
  if (!match) {
    throw new Error(`Radware Taleo payload is missing ${interfaceName}/${listName}`)
  }

  return [...match[1].matchAll(/'((?:\\'|[^'])*)'/g)].map((entry) => entry[1])
}

const chunk = (items, size) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    const slice = items.slice(index, index + size)
    if (slice.length === size) chunks.push(slice)
  }
  return chunks
}

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (match) {
    const month = new Date(`${match[1]} 1, 2000 UTC`).getUTCMonth()
    if (!Number.isNaN(month)) {
      return new Date(Date.UTC(Number(match[3]), month, Number(match[2]))).toISOString().slice(0, 10)
    }
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

const isExplicitIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  return /^IN-/i.test(normalized) || /\bIndia\b/i.test(normalized)
}

export const buildJobDetailUrl = (jobId) =>
  new URL(`/careersection/ex/jobdetail.ftl?job=${encodeURIComponent(jobId)}&lang=en`, TALEO_ORIGIN).toString()

export const extractSearchResults = (html) => {
  const fields = parseSingleQuotedArray(html, 'requisitionListInterface', 'listRequisition')

  return chunk(fields, LISTING_FIELD_COUNT)
    .map((row) => ({
      title: normalizeWhitespace(row[4]),
      location: normalizeWhitespace(row[13]),
      jobId: normalizeWhitespace(row[12]),
      applyUrl: buildJobDetailUrl(normalizeWhitespace(row[12])),
      postingDate: toIsoDate(row[20]),
      employmentType: normalizeWhitespace(row[19]) || null,
    }))
    .filter((job) => job.title && job.jobId && isExplicitIndiaLocation(job.location))
}

const joinDescriptionSections = (...sections) => normalizeWhitespace(
  sections
    .map((section) => decodeTaleoField(section))
    .filter(Boolean)
    .join(' '),
)

export const extractJobDetail = (html, listing) => {
  const fields = parseSingleQuotedArray(html, 'requisitionDescriptionInterface', 'descRequisition')
  const [detail] = chunk(fields, DETAIL_FIELD_COUNT)

  if (!detail) {
    throw new Error(`Radware Taleo detail payload is missing for ${listing.jobId}`)
  }

  const detailUrl = listing.applyUrl || buildJobDetailUrl(listing.jobId)
  const city = normalizeWhitespace(detail[21]) || null

  return {
    title: normalizeWhitespace(detail[9]) || listing.title,
    company: COMPANY_NAME,
    department: normalizeWhitespace(detail[23]) || normalizeWhitespace(detail[24]) || null,
    location: normalizeWhitespace(detail[13]) || listing.location,
    city,
    country: 'India',
    jobId: normalizeWhitespace(detail[10]) || listing.jobId,
    requisitionId: normalizeWhitespace(detail[10]) || listing.jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeWhitespace(listing.employmentType) || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: listing.postingDate || null,
    closingDate: null,
    jobDescription: joinDescriptionSections(detail[11], detail[12]) || null,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createRadwareScraper = (options = {}) => ({
  async run() {
    const fetchText = options.fetchText || defaultFetchText
    const listings = extractSearchResults(await fetchText(RADWARE_TALEO_JOBLIST_URL))
    const maxJobs = Number.isInteger(options.maxJobs) ? options.maxJobs : null
    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const scrapedAt = (options.now || (() => new Date().toISOString()))()

    const jobs = []
    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.applyUrl)
      jobs.push({
        ...extractJobDetail(detailHtml, listing),
        source: SOURCE,
        link: listing.applyUrl,
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = async () => createRadwareScraper().run()
