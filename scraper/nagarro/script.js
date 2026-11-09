import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runApiPortalScraper } from '../../scraper-support/apiPortal/engine.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

import NAGARRO_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = NAGARRO_CATALOG
export const SOURCE = NAGARRO_CATALOG.source
export const COMPANY = NAGARRO_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = NAGARRO_CATALOG.officialBrandName
export const VERIFIED_ON = NAGARRO_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = NAGARRO_CATALOG.verifiedSurfaceSummary
export const CAREERS_LANDING_URL = NAGARRO_CATALOG.careersLandingPageUrl
export const JOB_SEARCH_URL = NAGARRO_CATALOG.companyCareerPage
export const SMARTRECRUITERS_COMPANY_IDENTIFIER = 'Nagarro1'
export const SMARTRECRUITERS_BOARD_URL = NAGARRO_CATALOG.smartRecruitersBoardUrl
export const SMARTRECRUITERS_LISTING_API_URL = NAGARRO_CATALOG.smartRecruitersListingApiUrl
export const SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE =
  NAGARRO_CATALOG.smartRecruitersDetailApiUrlTemplate
export const SMARTRECRUITERS_APPLY_URL =
  'https://join.smartrecruiters.com/Nagarro1/338a6454-a0d3-4121-a6c2-51696acb91a3-website-applications'
export const DETAIL_FETCH_CONCURRENCY = 8

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

export const extractSmartRecruitersCompanyIdentifier = (value) => {
  try {
    const url = new URL(value)
    if (!['https://jobs.smartrecruiters.com', 'https://careers.smartrecruiters.com', 'https://join.smartrecruiters.com'].includes(url.origin)
      || url.username || url.password) return null
    return url.pathname.split('/').filter(Boolean)[0] || null
  } catch {
    return null
  }
}

const hasNativeRoleUrl = (value, jobId) => {
  if (extractSmartRecruitersCompanyIdentifier(value) !== SMARTRECRUITERS_COMPANY_IDENTIFIER) return false
  const url = new URL(value), parts = url.pathname.split('/').filter(Boolean), id = String(jobId ?? '')
  return url.origin === 'https://jobs.smartrecruiters.com' && parts.length === 2 && Boolean(id)
    && (parts[1] === id || parts[1].startsWith(id + '-'))
}

const nativeIdentityError = message => Object.assign(new Error(message), { incompleteScope: true })

export const hasOfficialCareersLandingSignal = (html = '') => {
  const page = normalizeWhitespace(html) || ''

  return /Careers \| Nagarro/i.test(page)
    && /Thinking about becoming a Nagarrian\?/i.test(page)
    && /Find more details and open positions on these locations/i.test(page)
    && /\bIndia\b/i.test(page)
}

export const hasOfficialJobSearchSignal = (html = '') => {
  const page = normalizeWhitespace(html) || ''

  return /Job Search \| Career opportunities with Nagarro \| Explore now/i.test(page)
    && /Your future starts here/i.test(page)
    && /Didn't find any open position\?/i.test(page)
    && page.includes(SMARTRECRUITERS_APPLY_URL)
}

export const hasVerifiedSmartRecruitersBoardSignal = (html = '') => {
  const page = normalizeWhitespace(html) || ''
  const hasLegacyIndiaBuckets =
    /Bengaluru,\s*,?\s*India/i.test(page)
    && /Remote,\s*,?\s*India/i.test(page)
  const hasCurrentBoardChrome =
    /\bHome Page\b/i.test(page)
    && /\bSearch job openings\b/i.test(page)
    && /\bClear search results\b/i.test(page)

  return /Careers at Nagarro/i.test(page)
    && /Jobs at Nagarro/i.test(page)
    && (hasLegacyIndiaBuckets || hasCurrentBoardChrome)
}

const NAGARRO_MOTIVATIONAL_SHELL_PHRASES = [
  'by this point in your career, it is not just about the tech you know or how well you can code',
  'it is about what more you want to do with that knowledge',
  'were you given the tools to go beyond solving for x',
  "we're you given the tools to go beyond solving for x",
  'can you help your teammates proceed in the right direction',
  'you have begun to prove your worth in our industry',
  'at nagarro, we love breaking new ground and doing unprecedented stuff',
]

const visibleNativeRoleDescription = value => {
  const document = readVisibleNativeDocument(String(value ?? ''), { strict: true })
  const neutralHeading = /^(?:(?:job|role)\s+(?:description|responsibilities)|(?:minimum|preferred)\s+qualifications|description|responsibilities|qualifications|requirements|additional\s+information)\s*[:.\-–—]*$/i
  // Only the assessment tree changes. The returned JD remains the exact native
  // HTML, while hidden content and neutral field labels supply no role criteria.
  for (const node of document.nodes(node => node.tag !== 'root' && neutralHeading.test(document.text(node)))) node.children = []
  return normalizeWhitespace(document.text(document.nodes(node => node.tag === 'root')[0])) || ''
}

const hasMotivationalShellDetailPayload = visibleDescription => {
  const description = visibleDescription.toLowerCase().replace(/[’‘]/g, "'")
  const residual = NAGARRO_MOTIVATIONAL_SHELL_PHRASES.reduce((text, phrase) => text.replaceAll(phrase, ''), description)
  return Boolean(description) && residual !== description && !/[\p{L}\p{N}]/u.test(residual)
}

const createApiProvider = () => ({
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: JOB_SEARCH_URL,
  countryFilter: 'India',
  config: {
    request: {
      method: 'GET',
      query: {
        limit: '100',
        country: 'in',
      },
    },
    pagination: {
      strategy: 'offset-limit',
      pageSize: 100,
      offsetParam: 'offset',
      limitParam: 'limit',
      resultsPath: 'content',
      totalCountPath: 'totalFound',
    },
    mapping: {
      title: 'name',
      location: 'location.fullLocation',
      jobId: 'id',
      requisitionId: 'refNumber',
      sourceUrl: 'postingUrl',
      applyUrl: 'applyUrl',
      // A successful native response with an empty JD still owns its URLs and
      // other fields. The engine's post-map missing-description check marks it
      // incomplete without discarding that received payload as a fetch error.
      jobDescription: 'jobAd.sections.jobDescription.text',
      department: 'department.label',
      employmentType: 'typeOfEmployment.label',
      experienceLevel: 'experienceLevel.label',
      postingDate: 'releasedDate',
    },
    detail: {
      enabled: true,
      concurrency: DETAIL_FETCH_CONCURRENCY,
      urlTemplate: SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE,
      method: 'GET',
      mapping: {
        minimumQualification: 'jobAd.sections.qualifications.text',
        preferredQualification: 'jobAd.sections.additionalInformation.text',
      },
    },
    discovery: {
      listingApiUrl: SMARTRECRUITERS_LISTING_API_URL,
    },
  },
})

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: JOB_SEARCH_URL,
    ...(options.headers || {}),
  },
  body: options.body,
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNagarroScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersLandingHtml = await fetchText(CAREERS_LANDING_URL)
    if (!hasOfficialCareersLandingSignal(careersLandingHtml)) {
      throw new Error('Nagarro official careers landing page changed materially')
    }

    const jobSearchHtml = await fetchText(JOB_SEARCH_URL)
    if (!hasOfficialJobSearchSignal(jobSearchHtml)) {
      throw new Error('Nagarro official job-search page changed materially')
    }

    const smartRecruitersBoardHtml = await fetchText(SMARTRECRUITERS_BOARD_URL)
    if (!hasVerifiedSmartRecruitersBoardSignal(smartRecruitersBoardHtml)) {
      throw new Error('Nagarro verified SmartRecruiters board changed materially')
    }

    const listingsById = new Map()
    const fetchNativeJson = async (url, options) => {
      const payload = await fetchJson(url, options)
      const request = new URL(url), listingPath = new URL(SMARTRECRUITERS_LISTING_API_URL).pathname
      if (request.pathname === listingPath) {
        for (const record of payload?.content || []) {
          if (record.company?.identifier != null && record.company.identifier !== SMARTRECRUITERS_COMPANY_IDENTIFIER) {
            throw nativeIdentityError('Nagarro SmartRecruiters company identifier changed on the public ATS jobs payload')
          }
          for (const value of [record.postingUrl, record.applyUrl].filter(value => value != null)) {
            if (extractSmartRecruitersCompanyIdentifier(value) !== SMARTRECRUITERS_COMPANY_IDENTIFIER) {
              throw nativeIdentityError('Nagarro SmartRecruiters company identifier changed on the public ATS jobs payload')
            }
            if (!hasNativeRoleUrl(value, record.id)) throw nativeIdentityError('Nagarro native listing application identity disagrees with its role')
          }
          listingsById.set(String(record.id), record)
        }
      } else if (request.pathname.startsWith(listingPath + '/') && payload && typeof payload === 'object'
        && payload.success !== false && !payload.error && !payload.errors?.length) {
        const requestedId = request.pathname.slice(listingPath.length + 1), listing = listingsById.get(requestedId)
        if (!listing || String(payload.id ?? '') !== requestedId
          || payload.refNumber != null && listing.refNumber != null && payload.refNumber !== listing.refNumber) {
          throw nativeIdentityError('Nagarro native detail identity disagrees with the requested listing')
        }
        if (payload.company?.identifier != null && payload.company.identifier !== SMARTRECRUITERS_COMPANY_IDENTIFIER) {
          throw nativeIdentityError('Nagarro SmartRecruiters company identifier changed on the public ATS jobs payload')
        }
        for (const value of [payload.postingUrl, payload.applyUrl].filter(value => value != null)) {
          if (extractSmartRecruitersCompanyIdentifier(value) !== SMARTRECRUITERS_COMPANY_IDENTIFIER) {
            throw nativeIdentityError('Nagarro SmartRecruiters company identifier changed on the public ATS jobs payload')
          }
          if (!hasNativeRoleUrl(value, payload.id)) throw nativeIdentityError('Nagarro native application identity disagrees with the requested role')
        }
      }
      return payload
    }
    const jobs = await runApiPortalScraper({
      provider: createApiProvider(),
      fetchJson: fetchNativeJson,
    })

    const verifiedJobs = jobs.map((job) => {
      const visibleDescription = visibleNativeRoleDescription(job.jobDescription)
      const complete = job.sourceDetailComplete !== false && hasSourceDescription(job) && Boolean(extractActiveDescription(visibleDescription))
        && !hasMotivationalShellDetailPayload(visibleDescription)
      return {
        ...job,
        department: typeof job.department === 'string' ? job.department : null,
        publicExperienceChecked: complete,
        sourceDetailComplete: complete,
        ...(!complete ? { sourceDetailFailureKind: job.sourceDetailFailureKind || 'missing-content' } : {}),
      }
    })

    for (const job of verifiedJobs) {
      for (const value of new Set([job.applyUrl, job.sourceUrl, job.link].filter(Boolean))) {
        if (extractSmartRecruitersCompanyIdentifier(value) !== SMARTRECRUITERS_COMPANY_IDENTIFIER) {
          throw new Error('Nagarro SmartRecruiters company identifier changed on the public ATS jobs payload')
        }
        if (!hasNativeRoleUrl(value, job.jobId)) throw new Error('Nagarro native application identity disagrees with the requested role')
      }
    }

    const output = Number.isFinite(maxJobs) ? verifiedJobs.slice(0, maxJobs) : verifiedJobs
    const evidence = readInventoryEvidence(jobs)
    if (evidence) {
      const capped = output.length < verifiedJobs.length
      const incomplete = verifiedJobs.some(job => job.sourceDetailComplete === false)
      attachInventoryEvidence(output, evidence.listingComplete && (capped || incomplete) ? {
        ...evidence, status: 'discovery-only', listingComplete: false,
        reason: capped ? 'nagarro-output-capped' : 'nagarro-native-role-description-incomplete',
      } : evidence)
    }
    return output
  },
})

export const run = async (options = {}) => createNagarroScraper(options).run(options)

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
