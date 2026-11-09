export const LISTING_API_URL = 'https://apic2.zwayam.com/jobs/search'
export const DETAIL_API_URL = 'https://apic2.zwayam.com/jobs-service/v1/jobs/careersite'

const PORTAL_DOMAIN = 'rakuten.openings.co'
const COMPANY_ID = 'MTUxMjQ='
const PORTAL_ORIGIN = `https://${PORTAL_DOMAIN}`
const COMPANY_NUMBER = 15124
const DEFAULT_MAX_PAGES = 5
const DEFAULT_MAX_JOBS = 100
const DEFAULT_PAGE_SIZE = 10

const normalizeText = (value) => {
  if (value == null) return null
  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const buildJobUrl = (record) => {
  const jobId = normalizeText(record?.id ?? record?.jobId)
  const jobUrl = normalizeText(record?.jobUrl)
  if (!jobId || !jobUrl) return null

  return `${PORTAL_ORIGIN}/#!/job-view/${encodeURIComponent(jobUrl)}?id=${encodeURIComponent(jobId)}`
}

const isIndiaLocation = (record) => /\bindia\b/i.test([
  record?.location,
  record?.country,
  record?.city,
].filter(Boolean).join(' '))

const extractCity = (location) => normalizeText(location)?.split(',')[0]?.trim() || null

export const buildListingRequest = (paginationStartNo = 0) => ({
  filterCri: {
    paginationStartNo: Math.max(0, Number(paginationStartNo) || 0),
    selectedCall: 'sort',
    sortCriteria: {
      name: 'modifiedDate',
      isAscending: false,
    },
    anyOfTheseWords: '',
  },
  domain: PORTAL_DOMAIN,
  companyId: COMPANY_ID,
})

export const extractSearchResults = (payload = {}) => {
  const records = payload?.data?.data ?? payload?.data ?? []
  if (!Array.isArray(records)) return []

  return records
    .filter(isIndiaLocation)
    .map((record) => {
      const jobId = normalizeText(record.id ?? record.jobId)
      const location = normalizeText(record.location)
      const sourceUrl = buildJobUrl(record)

      if (!jobId || !location || !sourceUrl) return null

      return {
        title: normalizeText(record.jobTitle ?? record.title),
        company: 'Rakuten',
        department: normalizeText(record.department?.departmentName ?? record.department),
        location,
        city: extractCity(location),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeText(record.employmentType),
        experienceRequired: normalizeText(record.experienceRequired),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeText(record.createdDate),
        closingDate: null,
        jobDescription: normalizeText(record.jobConfigurationData?.Description),
      }
    })
    .filter((job) => job?.title)
}

export const buildDetailRequest = (record = {}) => ({
  jobUrl: normalizeText(record.jobUrl),
  externalSource: 'CAREERSITE',
  campusUrl: 'empty',
  companyId: COMPANY_NUMBER,
  jobId: record.id ?? record.jobId,
})

const fetchListingPageFromPortal = async (request) => {
  const form = new FormData()
  for (const [key, value] of Object.entries(request)) {
    form.append(key, typeof value === 'object' ? JSON.stringify(value) : value)
  }

  const response = await fetch(LISTING_API_URL, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${LISTING_API_URL}`)
  return response.json()
}

const fetchJobDetailFromPortal = async (request) => {
  const response = await fetch(DETAIL_API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${DETAIL_API_URL}`)
  return response.json()
}

const getPageSize = (payload, fallback) => {
  const pageSize = Number(payload?.data?.facetedSearchConfig?.paginationHowMuch)
  return Number.isInteger(pageSize) && pageSize > 0 ? pageSize : fallback
}

const getTotalCount = (payload) => Number(payload?.data?.totalCount)

export const createRakutenScraper = ({
  maxPages = DEFAULT_MAX_PAGES,
  maxJobs = DEFAULT_MAX_JOBS,
  pageSize = DEFAULT_PAGE_SIZE,
} = {}) => {
  const boundedMaxPages = Math.min(DEFAULT_MAX_PAGES, Math.max(1, Number(maxPages) || 1))
  const boundedMaxJobs = Math.min(DEFAULT_MAX_JOBS, Math.max(1, Number(maxJobs) || 1))
  const boundedPageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE)

  return {
    async run({
      fetchListingPage = fetchListingPageFromPortal,
      fetchJobDetail = fetchJobDetailFromPortal,
    } = {}) {
      const jobs = []
      const seenJobIds = new Set()

      for (let page = 0; page < boundedMaxPages && jobs.length < boundedMaxJobs; page += 1) {
        const request = buildListingRequest(page * boundedPageSize)
        const payload = await fetchListingPage(request)
        const records = payload?.data?.data ?? payload?.data ?? []
        const listings = extractSearchResults(payload)

        for (const listing of listings) {
          if (seenJobIds.has(listing.jobId) || jobs.length >= boundedMaxJobs) continue
          seenJobIds.add(listing.jobId)

          const listingRecord = Array.isArray(records)
            ? records.find((record) => normalizeText(record.id ?? record.jobId) === listing.jobId)
            : null
          let job = listing

          if (listingRecord) {
            try {
              const detailPayload = await fetchJobDetail(buildDetailRequest(listingRecord))
              const detail = detailPayload?.reponseObject ?? detailPayload?.data ?? detailPayload
              const detailedJob = extractSearchResults({
                data: { data: [{ ...listingRecord, ...detail }] },
              })[0]
              job = detailedJob || listing
            } catch {
              job = listing
            }
          }

          jobs.push({
            ...job,
            source: 'rakuten',
            link: job.applyUrl || job.sourceUrl,
            scrapedAt: new Date().toISOString(),
          })
        }

        const totalCount = getTotalCount(payload)
        const currentPageSize = getPageSize(payload, boundedPageSize)
        if (!Number.isFinite(totalCount) || (page + 1) * currentPageSize >= totalCount) break
      }

      return jobs
    },
  }
}

export const run = (options) => createRakutenScraper().run(options)
