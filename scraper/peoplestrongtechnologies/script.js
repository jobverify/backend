import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PEOPLESTRONG_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = PEOPLESTRONG_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_LIST_URL = PROVIDER_METADATA.jobListUrl
export const ALTERNATE_JOB_LIST_URL = PROVIDER_METADATA.alternateJobListUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const SAMPLE_JOB_DETAIL_URL = PROVIDER_METADATA.sampleJobDetailUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchApiText = async (url) => {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Origin: HOMEPAGE_URL.replace(/\/$/, ''),
      Referer: HOMEPAGE_URL,
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
    },
  })

  return {
    status: response.status,
    text: await response.text(),
  }
}

export const hasPublicPortalShell = (html = '') => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Candidate Portal\s*<\/title>/i.test(rawHtml)
    && /main-[A-Z0-9]+\.js/i.test(rawHtml)
    && /assets\/css\/styles_v2\.css/i.test(rawHtml)
}

export const hasBrokenJobsApiSignal = (text = '') => (
  /Could not find method getRequisitionListWithPaginationBySolrBundle/i.test(String(text ?? ''))
)

const normalizeWhitespace = (value = '') =>
  String(value ?? '').replace(/\s+/g, ' ').trim() || null

const unique = (values = []) => [...new Set(values.filter(Boolean))]

const normalizeExperience = (value = '') => normalizeWhitespace(value)

const buildJobDetailUrl = (job = {}) => {
  const explicitUrl = normalizeWhitespace(job.jobDetailUrl)
  if (explicitUrl) {
    try {
      return new URL(explicitUrl, HOMEPAGE_URL).toString()
    } catch {
      // Fall through to the verified code-based route.
    }
  }

  const jobCode = normalizeWhitespace(job.jobCode)
  if (!jobCode) return null
  return `${HOMEPAGE_URL.replace(/\/$/, '')}/job/detail/${jobCode.replaceAll('/', '_')}`
}

const parseLocation = (value = '') => {
  const segments = String(value ?? '')
    .split('>')
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean)
    .filter((segment) => !/region/i.test(segment))

  if (segments.length === 0) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const country = segments[0] || null
  const city = segments.length >= 2 ? segments[segments.length - 2] : null
  const location = [...segments].reverse().join(', ')

  return {
    location,
    city,
    country,
  }
}

const extractSkills = (skills = {}) => unique([
  ...(Array.isArray(skills?.mustTohave) ? skills.mustTohave : []),
  ...(Array.isArray(skills?.goodtohave) ? skills.goodtohave : []),
].map((skill) => normalizeWhitespace(skill)))

const buildJobDescription = (job = {}, locationLabel, skills) => [
  normalizeWhitespace(job.organizationUnitComplete)
    ? `Organization: ${normalizeWhitespace(job.organizationUnitComplete)}`
    : null,
  locationLabel ? `Location hierarchy: ${locationLabel}` : null,
  normalizeExperience(job.expRange) ? `Experience: ${normalizeExperience(job.expRange)}` : null,
  skills.length > 0 ? `Skills: ${skills.join(', ')}` : null,
].filter(Boolean).join(' ')

const parseRequisitionPayload = (text = '') => {
  if (hasBrokenJobsApiSignal(text)) {
    throw new Error('PeopleStrong public requisition API returned a broken method payload')
  }
  let payload
  try { payload = JSON.parse(String(text ?? '')) } catch {
    throw new Error('PeopleStrong public requisition API returned an invalid payload')
  }
  const total = payload?.totalRecords
  const records = payload?.response
  const status = payload?.messageCode
  const successfulEmpty = total === 0 && status?.code === 200 && status?.messages === 'success'
  if (!Number.isInteger(total) || total < 0
    || (status && status.code !== 200)
    || (total === 0 && (!successfulEmpty || (records !== null && (!Array.isArray(records) || records.length !== 0))))
    || (total > 0 && (!Array.isArray(records) || records.length === 0 || records.length > total))
    || (Array.isArray(records) && records.some(record => !normalizeWhitespace(record?.jobCode) || !normalizeWhitespace(record?.jobTitle) || !normalizeWhitespace(record?.locationHierarchyComplete || record?.locationHierarchy)))) {
    throw new Error('PeopleStrong public jobs API no longer returns the verified requisition payload')
  }
  return { total, records: records || [] }
}

export const extractJobsFromApiResponse = (text = '') => {
  const { records } = parseRequisitionPayload(text)

  return records.flatMap((record) => {
    const detailUrl = buildJobDetailUrl(record)
    if (!detailUrl) return []

    const locationLabel = normalizeWhitespace(record.locationHierarchyComplete || record.locationHierarchy)
    const { location, city, country } = parseLocation(locationLabel)
    if (country !== 'India') return []

    const skills = extractSkills(record.skills)
    const title = normalizeWhitespace(record.jobTitle)
    if (!title || !location) return []

    return [{
      title,
      company: COMPANY,
      department: normalizeWhitespace(record.organizationUnit) || null,
      location,
      city,
      country,
      jobId: normalizeWhitespace(record.jobCode) || detailUrl,
      requisitionId: normalizeWhitespace(record.requisitionId) || normalizeWhitespace(record.jobCode) || detailUrl,
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      employmentType: normalizeWhitespace(record.employmentTenureType) || null,
      experienceRequired: normalizeExperience(record.expRange),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: skills,
      postingDate: normalizeWhitespace(record.jobPostedDate),
      closingDate: normalizeWhitespace(record.jobClosureDate),
      jobDescription: buildJobDescription(record, locationLabel, skills),
      remoteStatus: 'On-site',
    }]
  })
}

export const createPeopleStrongTechnologiesScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchApiText = defaultFetchApiText,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasPublicPortalShell(homepage.html)) {
      throw new Error('PeopleStrong verified public portal shell no longer matches the known first-party surface')
    }

    const primaryListPage = await fetchPage(JOB_LIST_URL)
    if (primaryListPage.status !== 404 || !hasPublicPortalShell(primaryListPage.html)) {
      throw new Error('PeopleStrong primary public jobs list route no longer matches the verified broken shell state')
    }

    const alternateListPage = await fetchPage(ALTERNATE_JOB_LIST_URL)
    if (alternateListPage.status !== 404 || !hasPublicPortalShell(alternateListPage.html)) {
      throw new Error('PeopleStrong alternate public jobs list route no longer matches the verified broken shell state')
    }

    const sampleDetailPage = await fetchPage(SAMPLE_JOB_DETAIL_URL)
    if (sampleDetailPage.status !== 200 || !hasPublicPortalShell(sampleDetailPage.html)) {
      throw new Error('PeopleStrong sample public detail route no longer matches the verified first-party shell')
    }

    const jobs = []
    const seen = new Set()
    let offset = 0
    let pagesFetched = 0
    let expectedTotal = null
    do {
      const url = new URL(JOBS_API_URL)
      url.searchParams.set('offset', String(offset))
      const apiResponse = await fetchApiText(url.toString())
      if (apiResponse.status !== 200) {
        throw new Error('PeopleStrong public jobs API no longer matches the verified first-party surface')
      }
      const { total, records } = parseRequisitionPayload(apiResponse.text)
      pagesFetched += 1
      if (expectedTotal !== null && total !== expectedTotal) {
        throw new Error('PeopleStrong requisition payload total changed during pagination')
      }
      expectedTotal = total
      for (const record of records) {
        if (seen.has(record.jobCode)) throw new Error('PeopleStrong requisition pagination repeated a payload record')
        seen.add(record.jobCode)
      }
      jobs.push(...extractJobsFromApiResponse(apiResponse.text))
      offset += records.length
    } while (offset < expectedTotal)

    return attachInventoryEvidence(jobs, {
      status: expectedTotal === 0 ? 'verified-empty' : 'complete-inventory',
      surface: JOBS_API_URL, firstParty: true, listingComplete: true, pagesFetched,
      reportedTotal: expectedTotal, indiaFacetCount: jobs.length,
      verifiedAt: new Date().toISOString(), reason: 'schema-validated-first-party-requisition-pagination',
    })
  },
})

export const run = async (options = {}) => createPeopleStrongTechnologiesScraper().run(options)

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
