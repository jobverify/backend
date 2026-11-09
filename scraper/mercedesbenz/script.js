export const MERCEDES_BENZ_CAREERS_URL = 'https://jobs.mercedes-benz.com/en'
export const MERCEDES_BENZ_TALEO_SEARCH_URL = 'https://tas-daimler.taleo.net/careersection/ex/jobsearch.ftl?lang=en'
export const MERCEDES_BENZ_TALEO_SEARCH_API_URL = 'https://tas-daimler.taleo.net/careersection/rest/jobboard/searchjobs?lang=en&portal=101430233'

const TALEO_ORIGIN = 'https://tas-daimler.taleo.net'
const COMPANY_NAME = 'Mercedes-Benz'
const SOURCE = 'mercedesbenz'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#039;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
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

const safeDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(String(value ?? '').replace(/%(?![0-9a-f]{2})/gi, '%25'))
  } catch {
    return value
  }
}

const decodeTaleoField = (value) => safeDecodeURIComponent(String(value ?? '').replace(/^!\*!\s*/, ''))

const isExplicitIndiaLocation = (location) =>
  /(?:^|[\s,(;/-])india(?:$|[\s,).;/-])/i.test(normalizeWhitespace(location))

const parseLocationValues = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return []

  try {
    const parsed = JSON.parse(normalized)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => normalizeWhitespace(item)).filter(Boolean)
    }
  } catch {
    // Taleo returns JSON-encoded location arrays in the REST API and plain text in HTML fixtures.
  }

  return [normalized]
}

const getPrimaryIndiaLocation = (location) => {
  const locations = parseLocationValues(location)
  return locations.find(isExplicitIndiaLocation) || locations[0] || null
}

const toCity = (location) => {
  const primaryLocation = getPrimaryIndiaLocation(location)
  if (!primaryLocation) return null

  const hyphenParts = primaryLocation.split('-').map((part) => normalizeWhitespace(part)).filter(Boolean)
  if (/^india$/i.test(hyphenParts[0]) && hyphenParts.length >= 3) {
    return hyphenParts.slice(2).join('-')
  }

  return primaryLocation.split(',')[0]?.trim() || null
}

const getDetailUrl = (href) => {
  if (!href) return null

  try {
    const url = new URL(href.replace(/&amp;/gi, '&'), TALEO_ORIGIN)
    if (
      url.origin !== TALEO_ORIGIN ||
      url.pathname !== '/careersection/ex/jobdetail.ftl'
    ) return null
    return url.toString()
  } catch {
    return null
  }
}

const buildJobDetailUrl = (jobId) =>
  new URL(`/careersection/ex/jobdetail.ftl?job=${encodeURIComponent(jobId)}&lang=en`, TALEO_ORIGIN).toString()

const getCellText = (row, className) => {
  const cell = row.match(new RegExp(`<t[dh][^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)</t[dh]>`, 'i'))
  return normalizeWhitespace(cell?.[1]) || null
}

const getDetailHref = (row) => row.match(/<a[^>]+href=["']([^"']*\/careersection\/ex\/jobdetail\.ftl[^"']*)["'][^>]*>/i)?.[1] || null

const parseApiSearchResults = (payload) => {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload
  if (!data || !Array.isArray(data.requisitionList)) return null

  return data.requisitionList
    .map((item) => {
      const columns = Array.isArray(item.column) ? item.column : []
      const locations = parseLocationValues(columns[1])
      const indiaLocations = locations.filter(isExplicitIndiaLocation)
      const jobId = normalizeWhitespace(item.contestNo || item.jobId)

      return {
        title: normalizeWhitespace(columns[0]),
        location: (indiaLocations.length ? indiaLocations : locations).join('; '),
        jobId,
        applyUrl: jobId ? buildJobDetailUrl(jobId) : null,
        postingDate: toIsoDate(columns[2]),
      }
    })
    .filter((job) => job.title && job.location && job.jobId && job.applyUrl && isExplicitIndiaLocation(job.location))
}

export const extractSearchResults = (html) => {
  try {
    const apiResults = parseApiSearchResults(html)
    if (apiResults) return apiResults
  } catch {
    // Fall through to the legacy Taleo table parser used by older fixtures.
  }

  const jobs = []
  const rows = String(html ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)

  for (const match of rows) {
    const row = match[1]
    const href = getDetailHref(row)
    const applyUrl = getDetailUrl(href)
    const title = getCellText(row, 'requisitionTitle') || normalizeWhitespace(
      row.match(/<a[^>]+href=["'][^"']*\/careersection\/ex\/jobdetail\.ftl[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1],
    )
    const location = getCellText(row, 'requisitionLocation')
    const jobId = getCellText(row, 'requisitionId') || new URL(applyUrl || TALEO_ORIGIN).searchParams.get('job')

    if (!title || !location || !jobId || !applyUrl || !isExplicitIndiaLocation(location)) continue

    jobs.push({
      title,
      location,
      jobId,
      applyUrl,
      postingDate: toIsoDate(getCellText(row, 'requisitionPostingDate')),
    })
  }

  return jobs
}

export const extractJobDescription = (html) => {
  const fields = [...String(html ?? '').matchAll(/api\.fillList\('requisitionDescriptionInterface', 'descRequisition', \[([\s\S]*?)\]\);/g)]
    .flatMap((match) => [...match[1].matchAll(/'((?:\\'|[^'])*)'/g)].map((entry) => entry[1].replace(/\\'/g, "'")))

  const encodedHistory = String(html ?? '').match(/<input[^>]+name=["']initialHistory["'][^>]+value=["']([^"']*)["'][^>]*>/i)?.[1]
  if (encodedHistory) {
    fields.push(...decodeHtmlEntities(encodedHistory).split('!|!'))
  }

  const taleoDescription = fields
    .map(decodeTaleoField)
    .find((field) => /<(?:p|div|ul|ol|li|h\d)\b/i.test(field))

  if (taleoDescription) return normalizeWhitespace(taleoDescription) || null

  const section = String(html ?? '').match(/<(?:div|section)[^>]+(?:id|class)=["'][^"']*(?:requisitionDescription|jobdescription)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i)
  return normalizeWhitespace(section?.[1]) || null
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const buildSearchRequest = () => ({
  method: 'POST',
  headers: {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Content-Type': 'application/json',
    Referer: MERCEDES_BENZ_TALEO_SEARCH_URL,
    tz: '-330',
    tzname: 'Asia/Calcutta',
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
  },
  body: JSON.stringify({
    fieldData: { fields: { LOCATION: '', KEYWORD: '' }, valid: true },
    filterSelectionParam: { searchFilterSelections: [] },
    advancedSearchFiltersSelectionParam: { searchFilterSelections: [] },
    sortingSelection: { sortBySelectionParam: '1', ascendingSortingOrder: 'false' },
    multilineEnabled: false,
    pageNo: 1,
  }),
})

const defaultFetchJson = async (url, request) => {
  const response = await fetch(url, request)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

const getDirectListings = async ({ fetchJson, fetchText }) => {
  if (fetchJson) {
    return extractSearchResults(await fetchJson(MERCEDES_BENZ_TALEO_SEARCH_API_URL, buildSearchRequest()))
  }

  if (fetchText) {
    return extractSearchResults(await fetchText(MERCEDES_BENZ_TALEO_SEARCH_URL))
  }

  return extractSearchResults(await defaultFetchJson(MERCEDES_BENZ_TALEO_SEARCH_API_URL, buildSearchRequest()))
}

const toJob = async (listing, fetchText, scrapedAt) => {
  const detailHtml = await fetchText(listing.applyUrl)
  const city = toCity(listing.location)
  return {
    title: listing.title,
    company: COMPANY_NAME,
    department: null,
    location: listing.location,
    city,
    country: 'India',
    jobId: listing.jobId,
    requisitionId: listing.jobId,
    sourceUrl: MERCEDES_BENZ_TALEO_SEARCH_URL,
    applyUrl: listing.applyUrl,
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: listing.postingDate,
    closingDate: null,
    jobDescription: extractJobDescription(detailHtml),
    source: SOURCE,
    link: listing.applyUrl,
    scrapedAt,
  }
}

export const createMercedesBenzScraper = (options = {}) => ({
  async run() {
    const fetchText = options.fetchText || defaultFetchText
    const listings = await getDirectListings({
      fetchJson: options.fetchJson,
      fetchText: options.fetchText,
    })
    const maxJobs = Number.isInteger(options.maxJobs) ? options.maxJobs : 50
    const scrapedAt = (options.now || (() => new Date().toISOString()))()

    return Promise.all(listings.slice(0, maxJobs).map((listing) => toJob(listing, fetchText, scrapedAt)))
  },
})

export const run = async () => createMercedesBenzScraper().run()
