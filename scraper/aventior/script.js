import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const SOURCE = 'aventior'
export const COMPANY = 'Aventior'
export const VERIFIED_ON = '2026-08-01'
export const CAREERS_URL = 'https://www.aventior.com/careers'
export const LINKEDIN_COMPANY_PAGE_URL = 'https://www.linkedin.com/company/aventior/'
export const LINKEDIN_COMPANY_JOBS_URL =
  'https://www.linkedin.com/jobs/aventior-jobs-worldwide?f_C=27234995'
export const DISPOSITION =
  'verified-first-party-careers-page-plus-linkedin-company-validation-and-public-jobs-search'
export const VERIFIED_SURFACE_SUMMARY =
  "Verified on Saturday, August 1, 2026 that https://www.aventior.com/careers was the live Aventior careers page, that its Follow Us link still handed applicants to the public LinkedIn company page at https://www.linkedin.com/company/aventior/, and that the public LinkedIn jobs search at https://www.linkedin.com/jobs/aventior-jobs-worldwide?f_C=27234995 remained the matching company search surface even though the company page no longer rendered the older See jobs button. The current public jobs search returned 0 Aventior jobs in Worldwide, so this scraper validates those verified surfaces and writes an empty result set when no India jobs are publicly exposed."

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify/1.0)'

const REQUIRED_CAREERS_SURFACE_PATTERNS = [
  /\bCareers At Aventior\b/i,
  /\bOpportunities to Engineer New Possibilities\./i,
  /\bOur Focus On Diversity & Equal Opportunity\b/i,
  /\bTeam Aventior\b/i,
  /\bFollow Us\b/i,
]

const LINKEDIN_COMPANY_PAGE_PATTERN =
  /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/company\/aventior\/?(?:[?#].*)?$/i

const LINKEDIN_COMPANY_JOBS_PATTERN =
  /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/jobs\/aventior-jobs-worldwide(?:\/)?\?(?:[^#]*&)?f_C=27234995(?:&[^#]*)?(?:#.*)?$/i

const NON_LINKEDIN_ATS_HOST_PATTERNS = [
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /jobs\.ashbyhq\.com/i,
  /ashbyhq\.com/i,
  /myworkdayjobs\.com/i,
  /workdayjobs\.com/i,
  /smartrecruiters\.com/i,
  /jobvite\.com/i,
  /workable\.com/i,
  /bamboohr\.com/i,
  /applytojob\.com/i,
  /recruitee\.com/i,
  /zohorecruit\.in/i,
  /darwinbox/i,
  /kekahire\.com/i,
  /freshteam\.com/i,
  /teamtailor\.com/i,
]

const SAME_ORIGIN_JOB_PATH_PATTERNS = [
  /^\/career(?:\/|$)/i,
  /^\/careers?(?:\/|$)/i,
  /^\/jobs?(?:\/|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/roles?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
  /^\/join-us(?:\/|$)/i,
]

const decodeHtml = (value = '') =>
  String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) =>
  normalizeWhitespace(
    decodeHtml(String(value ?? ''))
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const normalizePageText = (value = '') =>
  normalizeWhitespace(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full_time' || normalized === 'full time' || normalized === 'full-time') {
    return 'Full-time'
  }
  if (normalized === 'part_time' || normalized === 'part time' || normalized === 'part-time') {
    return 'Part-time'
  }
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const normalizePathname = (value = '') => {
  const normalized = String(value).trim().replace(/\/+$/, '')
  return normalized || '/'
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''

    if (/linkedin\.com$/i.test(url.hostname) || /\.linkedin\.com$/i.test(url.hostname)) {
      url.searchParams.delete('trk')
      url.searchParams.delete('refId')
      url.searchParams.delete('trackingId')
      url.searchParams.delete('pageNum')
      url.searchParams.delete('position')
    }

    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = parts[0] || null
  const country = parts.at(-1) === 'India' ? 'India' : parts.at(-1) || null

  return {
    location: normalized,
    city,
    country,
  }
}

const detailLocationFromJsonLd = (jobPosting = {}) => {
  const address = jobPosting?.jobLocation?.address || {}
  const country = address.addressCountry === 'IN'
    ? 'India'
    : normalizeWhitespace(address.addressCountry)
  const parts = [
    normalizeWhitespace(address.addressLocality),
    normalizeWhitespace(address.addressRegion),
    country,
  ].filter(Boolean)

  return {
    location: parts.join(', ') || null,
    city: normalizeWhitespace(address.addressLocality),
    country,
  }
}

const parseJobPostingJsonLd = (html = '') => {
  const scripts = [...String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>\s*([\s\S]*?)\s*<\/script>/gi,
  )]

  for (const [, rawJson] of scripts) {
    try {
      const parsed = JSON.parse(rawJson)
      if (parsed?.['@type'] === 'JobPosting') return parsed
    } catch {
      // Ignore malformed JSON-LD blocks until the public JobPosting payload is found.
    }
  }

  return null
}

const extractAnchors = (html = '', pageUrl = CAREERS_URL) => {
  const anchors = []
  const matches = String(html).matchAll(
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
  )

  for (const match of matches) {
    const rawHref = match[1] || match[2] || match[3] || ''
    const text = normalizePageText(match[4] || '')

    try {
      anchors.push({
        url: new URL(decodeHtml(rawHref), pageUrl),
        text,
      })
    } catch {
      // Ignore malformed anchors and keep the scraper fail-closed.
    }
  }

  return anchors
}

const extractLinkedUrls = (html = '', pageUrl = CAREERS_URL) => {
  const urls = []
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )

  for (const match of matches) {
    const rawValue = match[1] || match[2] || match[3] || ''

    try {
      urls.push(new URL(decodeHtml(rawValue), pageUrl))
    } catch {
      // Ignore malformed URLs and keep the scraper fail-closed.
    }
  }

  return urls
}

const hasJobPostingMarkup = (html = '') => {
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    if (/\bJobPosting\b/i.test(block[1])) return true
  }

  return false
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const text = normalizePageText(html) || ''
  return REQUIRED_CAREERS_SURFACE_PATTERNS.every((pattern) => pattern.test(text))
}

export const extractLinkedInCompanyUrl = (html = '', pageUrl = CAREERS_URL) => {
  const handoff = extractAnchors(html, pageUrl).find(
    ({ url, text }) =>
      /\bfollow us\b/i.test(text || '')
      && LINKEDIN_COMPANY_PAGE_PATTERN.test(url.toString()),
  )

  if (!handoff?.url) return null
  if (
    normalizeComparableUrl(handoff.url.toString()) === normalizeComparableUrl(LINKEDIN_COMPANY_PAGE_URL)
  ) {
    return LINKEDIN_COMPANY_PAGE_URL
  }

  return handoff.url.toString()
}

export const pageIndicatesAventiorLinkedInCompany = (html = '') => {
  const page = String(html)
  const text = normalizePageText(page) || ''

  return /\bAventior\s*\|\s*LinkedIn\b/i.test(page)
    && /\bIT Services and IT Consulting\b/i.test(text)
    && /\bCambridge,\s*MA\b/i.test(text)
    && /\bDriving AI and Digital Transformation\b/i.test(text)
    && /https?:\/\/(?:www\.)?aventior\.com\b/i.test(page)
}

export const extractCompanyJobsUrl = (html = '', pageUrl = LINKEDIN_COMPANY_PAGE_URL) => {
  const handoff = extractAnchors(html, pageUrl).find(
    ({ url, text }) =>
      /\bsee jobs\b/i.test(text || '')
      && LINKEDIN_COMPANY_JOBS_PATTERN.test(url.toString()),
  )

  return handoff?.url?.toString() || null
}

export const hasVerifiedCompanySearchUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && /(^|\.)linkedin\.com$/i.test(url.hostname)
      && normalizePathname(url.pathname) === '/jobs/aventior-jobs-worldwide'
      && url.searchParams.getAll('f_C').length === 1 && url.searchParams.get('f_C') === '27234995'
  } catch { return false }
}

const hasCurrentScopedNoMatchShell = (page, text) => {
  const scopedMeta = page.match(/<meta[^>]+property=["']lnkd:url["'][^>]+content=["']([^"']+)["']/i)?.[1]
  return /<title[^>]*>\s*Aventior Jobs at Aventior in Worldwide \| LinkedIn\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']pageKey["'][^>]+content=["']d_jobs_guest_search["']/i.test(page)
    && hasVerifiedCompanySearchUrl(decodeHtml(scopedMeta || ''))
    && /<input\b(?=[^>]*\bname=["']f_C["'])(?=[^>]*\bvalue=["']27234995["'])(?=[^>]*\bchecked(?:\s|=|\/?>))[^>]*>/i.test(page)
    && /We couldn['’]t find a match for Aventior jobs in Worldwide/i.test(text)
    && /class=["']no-results__main-title-keywords["']/i.test(page)
    && !/base-card__full-link|job-search-card"/i.test(page)
}

export const hasVerifiedLinkedInJobsPageSignal = (html = '') => {
  const page = String(html)
  const text = normalizePageText(page) || ''
  const scopedMeta = page.match(/<meta[^>]+property=["']lnkd:url["'][^>]+content=["']([^"']+)["']/i)?.[1]
  if (scopedMeta && !hasVerifiedCompanySearchUrl(decodeHtml(scopedMeta))) return false
  if (hasCurrentScopedNoMatchShell(page, text)) return true
  const hasZeroJobsTitle = /\b0\s+Aventior jobs in Worldwide\b/i.test(page)
    || /\b0\s+Aventior jobs in Worldwide\b/i.test(text)

  return (
    /\baventior jobs\b/i.test(text)
    || /\baventior jobs in worldwide\b/i.test(text)
    || hasZeroJobsTitle
  )
    && (
      /pageKey["']?\s+content=["']d_jobs_guest_search["']/i.test(page)
      || /base-card__full-link/i.test(page)
      || /\byou've viewed all jobs for this search\b/i.test(text)
      || /\bno matching jobs found\b/i.test(text)
      || hasZeroJobsTitle
    )
    && (
      /base-card__full-link/i.test(page)
      || /\bno matching jobs found\b/i.test(text)
      || /\bAventior\s*\(\d+\)/i.test(text)
      || /\bTechnical Project Manager\b/i.test(text)
      || hasZeroJobsTitle
    )
}

export const extractSearchResults = (html = '') => {
  const page = String(html)
  const cards = [...page.matchAll(/<div class="base-card[^"<]*\bjob-search-card"[^>]*>/gi)]
  const jobs = cards.map((card, index) => {
    // Each field belongs to this card; incomplete rows cannot borrow another employer's data.
    const section = page.slice(card.index, cards[index + 1]?.index ?? page.length)
    const jobId = card[0].match(/data-entity-urn="urn:li:jobPosting:([0-9]+)"/i)?.[1]
    const title = stripTags(section.match(/<h3 class="base-search-card__title">\s*([\s\S]*?)\s*<\/h3>/i)?.[1])
    const companyBlock = section.match(/<h4 class="base-search-card__subtitle">([\s\S]*?)<\/h4>/i)?.[1]
    const company = stripTags(companyBlock?.match(/<a[^>]*>\s*([\s\S]*?)\s*<\/a>/i)?.[1])
    const sourceUrl = normalizeWhitespace(section.match(/<a class="base-card__full-link[^"<]*" href="([^"]+)"/i)?.[1])
    const locationData = parseLocation(stripTags(section.match(/<span class="job-search-card__location">\s*([\s\S]*?)\s*<\/span>/i)?.[1]))
    const postingDate = section.match(/<time class="job-search-card__listdate(?:--new)?" datetime="([^"]+)"/i)?.[1]
    let verifiedSourceUrl = false
    try {
      const url = new URL(sourceUrl)
      verifiedSourceUrl = url.protocol === 'https:' && /(^|\.)linkedin\.com$/i.test(url.hostname) && /^\/jobs\/view\//i.test(url.pathname)
    } catch { /* Missing or unrelated URLs are discarded below. */ }
    if (!jobId || !title || !postingDate || !verifiedSourceUrl || company !== COMPANY || locationData.country !== 'India') return null
    return {
      title, company, department: null, location: locationData.location, city: locationData.city,
      country: locationData.country, jobId, requisitionId: jobId, sourceUrl, applyUrl: sourceUrl,
      employmentType: null, experienceRequired: null, minimumQualification: null,
      preferredQualification: null, requiredSkills: [], postingDate: normalizeWhitespace(postingDate),
      closingDate: null, jobDescription: null,
    }
  }).filter(Boolean)
  return jobs.filter((job, index) => jobs.findIndex(candidate => candidate.jobId === job.jobId) === index)
}

export const extractJobDetail = (html = '', listing = {}) => {
  const jobPosting = parseJobPostingJsonLd(html)
  if (!jobPosting) return {}

  const title = normalizeWhitespace(jobPosting?.title)
  const company = normalizeWhitespace(jobPosting?.hiringOrganization?.name)
  const expectedTitle = normalizeWhitespace(listing?.title)

  if (company && company !== COMPANY) {
    throw new Error(
      `Aventior LinkedIn detail page no longer matches the expected company identity: ${listing?.sourceUrl || 'unknown'}`,
    )
  }

  if (title && expectedTitle && title !== expectedTitle) {
    throw new Error(
      `Aventior LinkedIn detail page no longer matches the expected job title: ${listing?.sourceUrl || 'unknown'}`,
    )
  }

  const locationData = detailLocationFromJsonLd(jobPosting)

  return {
    company: company || null,
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    employmentType: normalizeEmploymentType(jobPosting?.employmentType),
    postingDate: normalizeWhitespace(jobPosting?.datePosted)?.slice(0, 10) || null,
    jobDescription: stripTags(jobPosting?.description) || null,
  }
}

const assertVerifiedOfficialCareersSurface = (html = '') => {
  if (hasOfficialCareersPageSignal(html)) return

  throw new Error(
    'Aventior verified official careers surface changed; review the public contract before promoting parser changes.',
  )
}

const assertVerifiedLinkedInCompanyHandoff = (html = '', pageUrl = CAREERS_URL) => {
  const handoffUrl = extractLinkedInCompanyUrl(html, pageUrl)

  if (
    handoffUrl
    && normalizeComparableUrl(handoffUrl) === normalizeComparableUrl(LINKEDIN_COMPANY_PAGE_URL)
  ) {
    return
  }

  throw new Error(
    'Aventior verified LinkedIn company handoff changed; review the first-party careers contract.',
  )
}

const assertNoUnexpectedFirstPartyJobsSurface = (html = '', careersUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'Aventior public careers surface now exposes JobPosting markup; review whether a first-party parser should replace the LinkedIn flow.',
    )
  }

  const careersPage = new URL(careersUrl)
  const careersPath = normalizePathname(careersPage.pathname)
  const linkedUrls = extractLinkedUrls(html, careersUrl)

  const atsBoardUrl = linkedUrls.find((url) =>
    NON_LINKEDIN_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname)),
  )
  if (atsBoardUrl) {
    throw new Error(
      `Aventior public careers surface now exposes a different public jobs surface via ${atsBoardUrl.toString()}.`,
    )
  }

  const sameOriginJobUrl = linkedUrls.find((url) => {
    if (url.origin !== careersPage.origin) return false

    const pathname = normalizePathname(url.pathname)
    if (pathname === careersPath && !url.search && !url.hash) return false

    return SAME_ORIGIN_JOB_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
  })
  if (sameOriginJobUrl) {
    throw new Error(
      `Aventior public careers surface now exposes a first-party public jobs surface via ${sameOriginJobUrl.toString()}.`,
    )
  }
}

const assertVerifiedLinkedInCompanyPage = (html = '') => {
  if (pageIndicatesAventiorLinkedInCompany(html)) return

  throw new Error(
    'Aventior LinkedIn company page no longer matches the expected public organization page.',
  )
}

const assertVerifiedCompanyJobsHandoff = (html = '', pageUrl = LINKEDIN_COMPANY_PAGE_URL) => {
  const jobsUrl = extractCompanyJobsUrl(html, pageUrl)

  if (
    jobsUrl
    && normalizeComparableUrl(jobsUrl) === normalizeComparableUrl(LINKEDIN_COMPANY_JOBS_URL)
  ) {
    return LINKEDIN_COMPANY_JOBS_URL
  }

  if (pageIndicatesAventiorLinkedInCompany(html)) return LINKEDIN_COMPANY_JOBS_URL

  throw new Error('Aventior LinkedIn company page no longer matches the expected public jobs contract.')
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  if (url === LINKEDIN_COMPANY_JOBS_URL && !hasVerifiedCompanySearchUrl(response.url)) {
    throw new Error('Aventior public LinkedIn search left its verified employer-filtered URL: ' + response.url)
  }
  return response.text()
}

const mergeListingWithDetail = (listing, detail = {}) => ({
  ...listing,
  ...Object.fromEntries(
    Object.entries(detail).filter(([, value]) => value != null),
  ),
})

export const createAventiorScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    assertVerifiedOfficialCareersSurface(careersHtml)
    assertVerifiedLinkedInCompanyHandoff(careersHtml, CAREERS_URL)
    assertNoUnexpectedFirstPartyJobsSurface(careersHtml, CAREERS_URL)

    const companyHtml = await fetchText(LINKEDIN_COMPANY_PAGE_URL)
    assertVerifiedLinkedInCompanyPage(companyHtml)
    const jobsUrl = assertVerifiedCompanyJobsHandoff(companyHtml, LINKEDIN_COMPANY_PAGE_URL)
    const jobsHtml = await fetchText(jobsUrl)
    if (!hasVerifiedLinkedInJobsPageSignal(jobsHtml)) {
      throw new Error(
        'Aventior LinkedIn jobs page no longer matches the verified public search shell.',
      )
    }

    const listings = extractSearchResults(jobsHtml)
    const selectedJobs = Number.isInteger(maxJobs) ? listings.slice(0, maxJobs) : listings
    const enrichedJobs = []

    for (const listing of selectedJobs) {
      try {
        const detailHtml = await fetchText(listing.sourceUrl)
        enrichedJobs.push(mergeListingWithDetail(listing, extractJobDetail(detailHtml, listing)))
      } catch (error) {
        console.warn(
          `  [${SOURCE}] Failed to enrich LinkedIn detail for ${listing.sourceUrl}: ${error.message}`,
        )
        enrichedJobs.push(listing)
      }
    }

    const jobs = enrichedJobs.filter(job => job.company === COMPANY && job.country === 'India').map((job) => ({
      ...job,
      source: SOURCE,
      sourceListingComplete: false,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
    return attachInventoryEvidence(jobs, {
      status: jobs.length ? 'coverage-gap' : 'discovery-only',
      surface: jobsUrl, firstParty: false, listingComplete: false,
      pagesFetched: 3 + selectedJobs.length, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: now(),
      reason: jobs.length ? 'Aventior company-scoped LinkedIn guest search yields verified India rows without exhaustive employer inventory.'
        : 'Aventior company-scoped LinkedIn guest search reports no matching query results; complete employer inventory is unverified.',
    })
  },
})

export const run = async (options = {}) => createAventiorScraper().run(options)
