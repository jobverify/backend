export const SOURCE = 'smartsocsolutions'
export const COMPANY = 'SmartSoC Solutions'
export const CAREER_PAGE_URL = 'https://www.smartsocs.com/career/'
export const JOBS_AJAX_URL = 'https://www.smartsocs.com/wp-admin/admin-ajax.php'
export const COMPANY_DOMAIN = 'www.smartsocs.com'
export const ATS_PLATFORM = 'wp-job-openings'

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeUrl = (value) => {
  const url = new URL(String(value ?? ''), CAREER_PAGE_URL)
  url.hash = ''
  return url.toString()
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const getSpecificationValues = (cardHtml, specificationName) => {
  const match = cardHtml.match(
    new RegExp(
      `<div[^>]+class=["'][^"']*awsm-job-specification-${specificationName}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`,
      'i',
    ),
  )

  if (!match) return []

  return [...match[1].matchAll(/<span[^>]+class=["'][^"']*awsm-job-specification-term[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
    .map((entry) => stripTags(entry[1]))
    .filter(Boolean)
}

const normalizeLocations = (values) => {
  const cities = values
    .map((value) => {
      const normalized = normalizeWhitespace(value)
      if (!normalized) return null
      if (/^India:\s*/i.test(normalized)) return normalized.replace(/^India:\s*/i, '')
      if (/^(Bangalore|Bengaluru|Hyderabad|Noida|Chennai|Hubballi|Pune|Delhi|Gurgaon|Gurugram|Mumbai)$/i.test(normalized)) {
        return normalized
      }
      return null
    })
    .filter(Boolean)

  if (cities.length === 0) {
    return {
      location: null,
      city: null,
      country: 'India',
    }
  }

  return {
    location: `${cities.join('; ')}, India`,
    city: cities[0] ?? null,
    country: 'India',
  }
}

export const hasOfficialCareerPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Career\s*(?:&#8211;|&ndash;|-)\s*SmartSoC Solutions\s*<\/title>/i.test(page)
    && /href=["']https:\/\/www\.smartsocs\.com\/career\/["'][^>]*>\s*(?:<span[^>]*>)?\s*Career\s*/i.test(page)
    && /\b(?:Fresher Hiring|Experience Hiring)\b/i.test(page)
    && /We are ready for you\. Are you too\?/i.test(stripTags(page) || page)
}

export const extractLoadMoreRequestMetadata = (html) => {
  const page = String(html ?? '')
  const listingsPerPage = Number.parseInt(
    page.match(/class=["'][^"']*awsm-job-listings[^"']*["'][^>]*data-listings=["'](\d+)["']/i)?.[1] ?? '',
    10,
  )
  const paginationBase = normalizeWhitespace(
    page.match(/<input[^>]+name=["']awsm_pagination_base["'][^>]+value=["']([^"']+)["']/i)?.[1] ?? null,
  )

  if (!Number.isInteger(listingsPerPage) || listingsPerPage <= 0 || paginationBase !== CAREER_PAGE_URL) {
    if (hasOfficialCareerPageSignal(page)) {
      return {
        action: 'loadmore',
        listingsPerPage: 10,
        paginationBase: CAREER_PAGE_URL,
      }
    }

    throw new Error('SmartSoC career page no longer exposes the verified loadmore contract')
  }

  return {
    action: 'loadmore',
    listingsPerPage,
    paginationBase,
  }
}

const isRecognizedEmptyState = (html) =>
  (
    /awsm-b-jobs-none-container/i.test(String(html ?? ''))
    && /\bno jobs found\b/i.test(String(html ?? ''))
  )
  || (
    /awsm-no-more-jobs-container/i.test(String(html ?? ''))
    && /\bno more jobs to show\b/i.test(String(html ?? ''))
  )

export const extractJobsFromAjaxHtml = (html) => {
  const page = String(html ?? '')

  if (isRecognizedEmptyState(page)) {
    return []
  }

  const jobs = [...page.matchAll(
    /<div\b[^>]*class=["'][^"']*awsm-job-listing-item[^"']*["'][^>]*id=["']awsm-grid-item-(\d+)["'][^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*awsm-job-item[^"']*["'][^>]*>([\s\S]*?)<\/a>\s*<\/div>/gi,
  )]
    .map((match) => {
      const jobId = normalizeWhitespace(match[1])
      const sourceUrl = normalizeUrl(match[2])
      const cardHtml = match[3]
      const title = stripTags(cardHtml.match(/<h2\b[^>]*class=["'][^"']*awsm-job-post-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? null)
      const department = getSpecificationValues(cardHtml, 'job-category')[0] ?? null
      const employmentType = getSpecificationValues(cardHtml, 'job-type')[0] ?? null
      const locationData = normalizeLocations(getSpecificationValues(cardHtml, 'job-location'))

      if (!jobId || !title || !locationData.location || !sourceUrl.startsWith('https://www.smartsocs.com/jobs/')) {
        return null
      }

      return {
        title,
        company: COMPANY,
        department,
        location: locationData.location,
        city: locationData.city,
        country: locationData.country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('SmartSoC jobs ajax response no longer exposes trusted public job cards')
  }

  return jobs
}

const defaultFetchText = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createSmartSocSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careerPageHtml = await fetchText(CAREER_PAGE_URL, {})

    if (!hasOfficialCareerPageSignal(careerPageHtml)) {
      throw new Error('SmartSoC career page no longer matches the verified first-party public jobs surface')
    }

    const metadata = extractLoadMoreRequestMetadata(careerPageHtml)
    const jobs = []
    const seen = new Set()

    for (let page = 1; page <= 10; page += 1) {
      const body = new URLSearchParams({
        action: metadata.action,
        paged: String(page),
        listings_per_page: String(metadata.listingsPerPage),
      }).toString()

      const jobsHtml = await fetchText(JOBS_AJAX_URL, {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
      })
      const pageJobs = extractJobsFromAjaxHtml(jobsHtml)

      if (pageJobs.length === 0) break

      for (const job of pageJobs) {
        if (seen.has(job.jobId)) continue
        seen.add(job.jobId)
        jobs.push(job)
      }
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREER_PAGE_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: ATS_PLATFORM,
    }))
  },
})

export const run = async (options = {}) => createSmartSocSolutionsScraper().run(options)
