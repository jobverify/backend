export const SOURCE = 'mobiculetechnologies'
export const COMPANY = 'Mobicule Technologies'
export const HOMEPAGE_URL = 'https://mobicule.com/'
export const CAREERS_URL = 'https://mobicule.com/careers/'
export const CAREERS_PORTAL_URL = 'https://mobiculetechnologies.greythr.com/hire/jobs/'
export const CAREERS_API_URL = 'https://mobiculetechnologies.greythr.com/hire/api/career/published_jobs/'
export const COMPANY_API_URL = 'https://mobiculetechnologies.greythr.com/hire/api/career/get_company_details/'
export const FILTERS_API_URL = 'https://mobiculetechnologies.greythr.com/hire/api/sourcing/filters/'
export const DETAIL_API_ROOT = 'https://mobiculetechnologies.greythr.com/hire/api/career/get_job/'
const LEGACY_PORTAL_URL = 'https://mobicule.zohorecruit.com/jobs/Careers'
const LEGACY_API_URL = 'https://mobicule.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Mobicule',
  adapter: 'script',
  modulePath: '../../scraper/mobiculetechnologies/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  careersPortalUrl: CAREERS_PORTAL_URL,
  careersApiUrl: CAREERS_API_URL,
  atsPlatform: 'greythr',
  countryFilter: 'India',
  paginationStrategy: 'first-party-greythr-handoff-plus-published-jobs-feed',
  extractionStrategy: 'verified-first-party-handoff+greythr-company-identity+published-feed+filters+job-details',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'mobicule.com',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://mobicule.com/careers/ now hands applicants to https://mobiculetechnologies.greythr.com/hire/jobs/. The branded greytHR company endpoint and published jobs feed listed three roles, with location IDs mapped to Mumbai and Pune by the same public portal filters. All three job detail endpoints were published and matched the feed.',
  dryRunFile: 'mobiculetechnologies/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/contract|consult/.test(normalized)) return 'Contract'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Join Us \| Careers At Mobicule Technologies\s*<\/title>/i.test(page)
    && /Where Innovation Meets/i.test(page)
    && /Explore opportunities/i.test(page)
    && page.includes(LEGACY_PORTAL_URL)
}

export const hasCurrentCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Join Us \| Careers At Mobicule Technologies\s*<\/title>/i.test(page)
    && /Where Innovation Meets/i.test(page)
    && /Explore opportunities/i.test(page)
    && page.includes(CAREERS_PORTAL_URL)
}

const cleanDescription = (html) => String(html ?? '')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim()

const runCurrentPortal = async ({ fetchText, fetchJson, now }) => {
  const shell = await fetchText(CAREERS_PORTAL_URL)
  if (!/<title>Jobs at MOBICULE TECHNOLOGIES PRIVATE LIMITED<\/title>/i.test(shell)) {
    throw new Error('Mobicule greytHR portal identity changed')
  }
  const company = await fetchJson(COMPANY_API_URL)
  if (company?.company_name !== 'MOBICULE TECHNOLOGIES PRIVATE LIMITED') {
    throw new Error('Mobicule greytHR company identity changed')
  }
  const [filters, inventory] = await Promise.all([
    fetchJson(FILTERS_API_URL),
    fetchJson(CAREERS_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
  ])
  const locations = filters?.category?.find(item => item?.name === 'Location')?.values
  if (!Array.isArray(locations) || !Array.isArray(inventory?.data)) {
    throw new Error('Mobicule greytHR inventory contract changed')
  }
  const cityById = new Map(locations.map(item => [String(item.id), item.name]))
  const ids = new Set(), slugs = new Set()
  const jobs = []
  for (const row of inventory.data) {
    const id = String(row?.id ?? ''), slug = String(row?.slug ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[a-z0-9-]+$/.test(slug)
      || !normalizeWhitespace(row?.title) || !Array.isArray(row?.locations)
      || !row.locations.length || ids.has(id) || slugs.has(slug)) {
      throw new Error('Mobicule greytHR inventory contains an invalid or duplicate job')
    }
    ids.add(id); slugs.add(slug)
    const cities = [...new Set(row.locations.map(locationId => cityById.get(String(locationId))))]
    if (cities.some(city => !['Mumbai', 'Pune'].includes(city))) {
      throw new Error('Mobicule greytHR job geography is unverified')
    }
    const sourceUrl = `${CAREERS_PORTAL_URL}${slug}`
    const detail = await fetchJson(`${DETAIL_API_ROOT}${slug}/`)
    if (detail?.job_status !== 'published' || detail?.job?.id !== id
      || detail.job.title !== row.title || detail.job.slug !== slug
      || detail.job.apply_url !== sourceUrl
      || !cleanDescription(detail.job.description)
      || JSON.stringify(detail.job.locations) !== JSON.stringify(row.locations)) {
      throw new Error(`Mobicule greytHR detail changed: ${slug}`)
    }
    const published = new Date(detail.job.published_on_career_page)
    if (!Number.isFinite(published.getTime())) throw new Error('Mobicule greytHR posting date is invalid')
    jobs.push({
      title: row.title, company: COMPANY, location: [...cities, 'India'].join(', '),
      city: cities[0], country: 'India', jobId: id, requisitionId: normalizeWhitespace(row.req_id) || id,
      sourceUrl, applyUrl: sourceUrl, employmentType: normalizeEmploymentType(row.job_type),
      experienceRequired: null, jobDescription: cleanDescription(detail.job.description),
      postingDate: published.toISOString().slice(0, 10),
      link: sourceUrl, source: SOURCE, scrapedAt: now(),
    })
  }
  return jobs
}

export const extractIndiaJobs = (payload) => (Array.isArray(payload?.data) ? payload.data : [])
  .filter((record) => /india/i.test(normalizeWhitespace(record.Country)))
  .map((record) => {
    const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
    const location = normalizeWhitespace(
      [record.City, record.State, record.Country].filter(Boolean).join(', '),
    )
    const sourceUrl = normalizeWhitespace(record.$url)
    const jobId = normalizeWhitespace(record.id)

    if (!title || !location || !sourceUrl || !jobId) return null

    return {
      title,
      company: COMPANY,
      location,
      city: normalizeWhitespace(record.City) || null,
      state: normalizeWhitespace(record.State) || null,
      country: normalizeWhitespace(record.Country),
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(record.Job_Type),
      experienceRequired: normalizeWhitespace(record.Work_Experience) || null,
      description: normalizeWhitespace(record.Job_Description) || null,
    }
  })
  .filter(Boolean)

export const run = async ({
  fetchText = async (url) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
    return response.text()
  },
  fetchJson = async (url, options) => {
    const response = await fetch(url, options)
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
    return response.json()
  },
  now = () => new Date().toISOString(),
} = {}) => {
  const careersHtml = await fetchText(CAREERS_URL)
  if (hasCurrentCareersSignal(careersHtml)) return runCurrentPortal({ fetchText, fetchJson, now })
  if (!hasOfficialCareersSignal(careersHtml)) {
    throw new Error('Mobicule Technologies verified first-party careers page changed materially')
  }

  const payload = await fetchJson(LEGACY_API_URL)
  if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
    throw new Error('Mobicule Technologies public Zoho Recruit payload changed materially')
  }

  const jobs = extractIndiaJobs(payload)
  if (!jobs.length) {
    throw new Error('Mobicule Technologies public Zoho Recruit payload no longer exposes India jobs')
  }

  return jobs.map((job) => ({
    ...job,
    link: job.applyUrl || job.sourceUrl,
    source: SOURCE,
    scrapedAt: now(),
  }))
}

