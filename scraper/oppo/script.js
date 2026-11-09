import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { OPPO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = OPPO_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const SOCIAL_HOME_URL = 'https://career.oppo.com/official/oppo'
export const CAMPUS_HOME_URL = 'https://careers.oppo.com/university/oppo'
export const SOCIAL_API_URL = PROVIDER_METADATA.socialApiUrl
export const CAMPUS_API_URL = PROVIDER_METADATA.campusApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const INDIA_LOCATION_RE =
  /\b(india|bengaluru|bangalore|gurugram|gurgaon|noida|new delhi|delhi|mumbai|navi mumbai|pune|chennai|hyderabad|kolkata|ahmedabad|coimbatore|kochi|ernakulam|trivandrum|thiruvananthapuram|mysuru|mysore)\b/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeMultilineText = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return normalized || null
}

const buildHeaders = () => ({
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
})

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: buildHeaders(),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const defaultFetchJson = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json,text/plain,*/*',
      'user-agent': USER_AGENT,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

export const hasOfficialSocialShellSignal = (html) => {
  const page = String(html ?? '')

  return /OPPO招聘\s*-\s*加入我们 join us/i.test(page)
    && /\/assets\/js\/oppo-[^"']+\.js/i.test(page)
    && /id="app"/i.test(page)
}

export const hasOfficialCampusShellSignal = (html) => {
  const page = String(html ?? '')

  return /OPPO招聘\s*-\s*加入我们 join us/i.test(page)
    && /\/assets\/js\/campus_oppo-[^"']+\.js/i.test(page)
    && /id="app"/i.test(page)
}

const isIndiaLocation = (location) => INDIA_LOCATION_RE.test(normalizeWhitespace(location) || '')

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const city = normalizeWhitespace(normalized.split(',')[0])
  return city && INDIA_LOCATION_RE.test(city) ? city : null
}

const formatExperience = (minYears, maxYears) => {
  if (!Number.isFinite(minYears) || !Number.isFinite(maxYears)) return null
  if (minYears === 999 && maxYears === 999) return null
  if (maxYears === 999) return `${minYears}+ years`
  if (minYears === 999) return `Up to ${maxYears} years`
  if (minYears === maxYears) return `${minYears} years`
  return `${minYears}-${maxYears} years`
}

const joinDescription = (...parts) =>
  normalizeMultilineText(
    parts
      .map(normalizeWhitespace)
      .filter(Boolean)
      .join('\n\n'),
  )

const normalizeEmploymentTypeSocial = (recruitType) => {
  if (/OFFEN-RECRUITMENT/i.test(recruitType || '')) return 'Internship'
  if (/SOCIAL-RECRUITMENT/i.test(recruitType || '')) return 'Full-time'
  return null
}

const normalizeEmploymentTypeCampus = (recruitmentType) => {
  if (/intern/i.test(recruitmentType || '')) return 'Internship'
  return 'Full-time'
}

const createSocialDetailUrl = (record) =>
  `https://career.oppo.com/official/oppo/recruitment/post/${record.positionId}?recruitType=${record.recruitType}`

const createCampusDetailUrl = (record) =>
  `https://careers.oppo.com/university/oppo/campus/post/${record.idProjPosition}?recruitType=${record.recruitmentType}`

const isValidSocialPayload = (payload) =>
  payload?.code === '0' && Array.isArray(payload?.data?.list)

const isValidCampusPayload = (payload) =>
  payload?.code === 0 && Array.isArray(payload?.data?.records)

export const extractIndiaSocialJobs = (payload) =>
  (Array.isArray(payload?.data?.list) ? payload.data.list : [])
    .filter((record) => isIndiaLocation(record.workCityName))
    .map((record) => {
      const sourceUrl = createSocialDetailUrl(record)

      return {
        title: normalizeWhitespace(record.jobName || record.publishName),
        company: COMPANY,
        department: normalizeWhitespace(record.jobType),
        location: normalizeWhitespace(record.workCityName),
        city: extractCity(record.workCityName),
        state: null,
        country: 'India',
        jobId: normalizeWhitespace(record.positionId),
        requisitionId: normalizeWhitespace(record.jobCode),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentTypeSocial(record.recruitType),
        experienceRequired: formatExperience(record.minWorkYears, record.maxWorkYears),
        minimumQualification: normalizeWhitespace(record.educationRequire),
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(record.publishDate),
        closingDate: null,
        jobDescription: joinDescription(record.jobDuty, record.workRequire),
        publicExperienceChecked: true,
        remoteStatus: null,
      }
    })
    .filter((job) => job.title && job.jobId && job.location)

export const extractIndiaCampusJobs = (payload) =>
  (Array.isArray(payload?.data?.records) ? payload.data.records : [])
    .filter((record) => isIndiaLocation(record.workCityName))
    .map((record) => {
      const sourceUrl = createCampusDetailUrl(record)

      return {
        title: normalizeWhitespace(record.positionName || record.projectPositionName),
        company: COMPANY,
        department: normalizeWhitespace(record.positionTypeName),
        location: normalizeWhitespace(record.workCityName),
        city: extractCity(record.workCityName),
        state: null,
        country: 'India',
        jobId: normalizeWhitespace(String(record.idProjPosition)),
        requisitionId: normalizeWhitespace(String(record.projectPositionId ?? record.atsProjectPositionId ?? record.idProjPosition)),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentTypeCampus(record.recruitmentType),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(record.releaseTime),
        closingDate: null,
        jobDescription: joinDescription(record.positionDesc, record.positionRequire),
        publicExperienceChecked: true,
        remoteStatus: null,
      }
    })
    .filter((job) => job.title && job.jobId && job.location)

const socialRequestBody = (pageNum, pageSize) => ({
  pageNum,
  pageSize,
  publishName: '',
  workCityCodeList: [],
  jobTypeList: [],
  recruitTypeList: [],
  shareId: '',
})

const campusRequestBody = (pageNum, pageSize) => ({
  pageNum,
  pageSize,
  positionName: '',
  projectList: [],
  positionTypeList: [],
  workCityCodeList: [],
  shareId: '',
})

const collectPaginatedJobs = async ({
  url,
  pageSize,
  buildBody,
  fetchJson,
  isValidPayload,
  errorLabel,
  extractor,
}) => {
  const jobs = []
  let pageNum = 1
  let totalPages = 1

  do {
    const body = buildBody(pageNum, pageSize)
    const payload = await fetchJson(url, body)

    if (!isValidPayload(payload)) {
      throw new Error(`OPPO ${errorLabel} no longer returns the verified payload shape`)
    }

    jobs.push(...extractor(payload))
    totalPages = Math.max(1, Number(payload?.data?.pages ?? 1))
    pageNum += 1
  } while (pageNum <= totalPages)

  return jobs
}

export const createOppoScraper = ({ pageSize = 100 } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const socialShellHtml = await fetchText(SOCIAL_HOME_URL)
    if (!hasOfficialSocialShellSignal(socialShellHtml)) {
      throw new Error('Response is not the verified official OPPO social careers shell')
    }

    const campusShellHtml = await fetchText(CAMPUS_HOME_URL)
    if (!hasOfficialCampusShellSignal(campusShellHtml)) {
      throw new Error('Response is not the verified official OPPO campus careers shell')
    }

    const socialJobs = await collectPaginatedJobs({
      url: SOCIAL_API_URL,
      pageSize,
      buildBody: socialRequestBody,
      fetchJson,
      isValidPayload: isValidSocialPayload,
      errorLabel: 'public social jobs API',
      extractor: extractIndiaSocialJobs,
    })

    const campusJobs = await collectPaginatedJobs({
      url: CAMPUS_API_URL,
      pageSize,
      buildBody: campusRequestBody,
      fetchJson,
      isValidPayload: isValidCampusPayload,
      errorLabel: 'public campus jobs API',
      extractor: extractIndiaCampusJobs,
    })

    return [...socialJobs, ...campusJobs].map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async () => createOppoScraper().run()

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
