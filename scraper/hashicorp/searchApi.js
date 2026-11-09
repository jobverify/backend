const SEARCH_API_URL = 'https://www-api.ibm.com/search/api/v2'
const SEARCH_FIELDS = [
  'keywords^1',
  'body^1',
  'url^2',
  'description^2',
  'h1s_content^2',
  'title^3',
  'field_text_01',
]
const SOURCE_FIELDS = [
  '_id',
  'title',
  'url',
  'description',
  'body',
  'language',
  'entitled',
  'field_keyword_05',
  'field_keyword_08',
  'field_keyword_17',
  'field_keyword_18',
  'field_keyword_19',
]
const DEFAULT_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://www.ibm.com',
  Referer: 'https://www.ibm.com/careers/search',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const normalizeCountry = (value) => normalizeWhitespace(value) || 'India'

const normalizeLocation = (rawLocation, country) => {
  const normalizedLocation = normalizeWhitespace(rawLocation)
  const normalizedCountry = normalizeCountry(country)

  if (!normalizedLocation || /^multiple cities$/i.test(normalizedLocation)) {
    return normalizedCountry
  }

  if (/,\s*IN$/i.test(normalizedLocation)) {
    return normalizedLocation.replace(/,\s*IN$/i, ', India')
  }

  return normalizedLocation
}

const deriveCity = (rawLocation, country) => {
  const normalizedLocation = normalizeWhitespace(rawLocation)
  const normalizedCountry = normalizeCountry(country)

  if (!normalizedLocation) return null
  if (/^multiple cities$/i.test(normalizedLocation)) return 'Multiple Cities'
  if (normalizedLocation === normalizedCountry) return null

  return normalizeWhitespace(
    normalizedLocation
      .replace(/,\s*IN$/i, '')
      .split(',')[0],
  )
}

const extractJobId = (jobUrl) => {
  const normalizedUrl = normalizeWhitespace(jobUrl)
  if (!normalizedUrl) return null

  try {
    const parsed = new URL(normalizedUrl)
    return normalizeWhitespace(
      parsed.searchParams.get('jobId')
      || parsed.searchParams.get('jobid')
      || parsed.pathname.split('/').filter(Boolean).at(-1),
    )
  } catch {
    return null
  }
}

export const buildSearchRequestBody = ({
  query = '',
  country = 'India',
  size = 100,
  from = 0,
} = {}) => {
  const normalizedQuery = normalizeWhitespace(query) || ''
  const must = normalizedQuery
    ? [
      {
        simple_query_string: {
          query: normalizedQuery,
          fields: SEARCH_FIELDS,
        },
      },
    ]
    : []

  return {
    appId: 'careers',
    scopes: ['careers2'],
    query: { bool: { must } },
    post_filter: {
      term: {
        field_keyword_05: normalizeCountry(country),
      },
    },
    size,
    from,
    sort: [
      { _score: 'desc' },
      { pageviews: 'desc' },
    ],
    lang: 'zz',
    localeSelector: {},
    sm: {
      query: normalizedQuery,
      lang: 'zz',
    },
    _source: SOURCE_FIELDS,
  }
}

export const extractSearchResults = (payload, { companyName = 'HashiCorp' } = {}) => {
  const hits = Array.isArray(payload?.hits?.hits) ? payload.hits.hits : []

  return hits
    .map((hit) => {
      const source = hit?._source || {}
      const sourceUrl = normalizeWhitespace(source.url)
      const title = normalizeWhitespace(source.title)
      const fullBody = normalizeWhitespace(source.body)
      const hasCompleteBody = Boolean(fullBody && !/(?:\.\.\.|\u2026)\s*$/.test(fullBody))
      const jobId = extractJobId(sourceUrl)
      const country = normalizeCountry(source.field_keyword_05)
      const location = normalizeLocation(source.field_keyword_19 || source.field_keyword_05, country)
      const city = deriveCity(source.field_keyword_19, country)

      if (!sourceUrl || !title || !jobId || !location) return null

      return {
        title,
        company: companyName,
        department: normalizeWhitespace(source.field_keyword_08),
        location,
        city,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: fullBody || normalizeWhitespace(source.description),
        ...(hasCompleteBody ? { publicExperienceChecked: true } : {}),
      }
    })
    .filter(Boolean)
}

export const getTotalCount = (payload) => {
  const total = payload?.hits?.total
  if (typeof total === 'number') return total
  if (Number.isFinite(total?.value)) return total.value
  return null
}

const fetchSearchResults = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      ...options.headers,
    },
    body: options.body,
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const runSearch = async ({
  companyName = 'HashiCorp',
  source = 'hashicorp',
  query = 'hashicorp',
  country = 'India',
  pageSize = 100,
  maxJobs = null,
  maxPages = Number.POSITIVE_INFINITY,
  signal = null,
  fetchJson = fetchSearchResults,
} = {}) => {
  const jobs = []
  const seenJobIds = new Set()
  let totalCount = null
  let from = 0
  let page = 0

  while (page < maxPages) {
    signal?.throwIfAborted()
    page += 1
    const body = buildSearchRequestBody({
      query,
      country,
      size: pageSize,
      from,
    })
    const payload = await fetchJson(SEARCH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: normalizedQueryReferrer(query),
      },
      body: JSON.stringify(body),
      signal,
    })
    const listings = extractSearchResults(payload, { companyName })
    totalCount = getTotalCount(payload)

    for (const job of listings) {
      if (seenJobIds.has(job.jobId)) continue
      seenJobIds.add(job.jobId)
      jobs.push({
        ...job,
        source,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })

      if (Number.isInteger(maxJobs) && jobs.length >= maxJobs) {
        return jobs
      }
    }

    from += pageSize

    if (!listings.length) break
    if (totalCount != null && from >= totalCount) break
    if (totalCount == null && listings.length < pageSize) break
  }

  return jobs
}

const normalizedQueryReferrer = (query) => {
  const normalizedQuery = normalizeWhitespace(query)
  if (!normalizedQuery) return 'https://www.ibm.com/careers/search'

  const url = new URL('https://www.ibm.com/careers/search')
  url.searchParams.set('q', normalizedQuery)
  return url.toString()
}
