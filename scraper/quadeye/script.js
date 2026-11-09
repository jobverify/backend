import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { QUADEYE_CATALOG } from './catalog.js'
import { hasRecognizedWorkdayCountry, explicitWorkdayCountryScope } from '../../scraper-support/myworkday/countryInventoryProof.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = QUADEYE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_PORTAL_URL = PROVIDER_METADATA.careersPortalUrl
export const CAREERS_API_URL = PROVIDER_METADATA.careersApiUrl
export const CAREERS_DETAIL_HOST = PROVIDER_METADATA.careersDetailHost

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
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

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return normalized

  const [, month, day, year] = match
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString()
}

const normalizeLocation = (record = {}) => {
  // Preserve uncertain native workplaces without relabelling the vacancy India.
  const unknown = () => ({
    location: null, city: null, state: null, country: null,
    nativeGeographyQualified: false,
    rawNativeWorkplaceEvidence: Object.fromEntries(['Country', 'Job_Location', 'City', 'State']
      .filter(key => Object.hasOwn(record, key)).map(key => [key, structuredClone(record[key])])),
  })
  const plain = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : null
  const country = plain(record.Country)
  const providedCountry = record.Country != null && country !== ''
  if (providedCountry && (!country || !hasRecognizedWorkdayCountry(country))) return unknown()
  const countryScope = country ? explicitWorkdayCountryScope(country) : null
  const city = plain(record.City) || null
  const state = plain(record.State) || null
  if (record.City != null && typeof record.City !== 'string' || record.State != null && typeof record.State !== 'string') return unknown()
  // These are existing native formats, including the captured Gurgaon Kty.
  // City value. They check consistency; they never supply a missing country.
  const indiaCity = /^(?:Gurugram|Gurgaon|Gurgaon Kty\.)$/i
  const indiaState = /^(?:Haryana|Hariyana)$/i
  const indiaComponentsAgree = (!city || indiaCity.test(city)) && (!state || indiaState.test(state))
  const foreignComponentsConflict = [city, state].some(value => value && (
    /\b(?:Gurugram|Gurgaon|Haryana|Hariyana)\b/i.test(value) || explicitWorkdayCountryScope(value) === 'india'
  ))
  const sameCountry = (left, right) => hasRecognizedWorkdayCountry({ descriptor: left, alpha2Code: right })
  const indiaPlace = /^(Gurugram|Gurgaon)(,\s*(?:Haryana,\s*)?India)?$/i
  const foreignPlace = /^(?:New York|Chicago|Hong Kong|Singapore|South Korea|Romania)$/i
  const nativeLocations = record.Job_Location
  const rawLocations = Array.isArray(nativeLocations) ? nativeLocations
    : nativeLocations == null ? [] : [nativeLocations]
  if (rawLocations.length) {
    const places = rawLocations.map(plain)
    if (places.some(place => !place)) return unknown()
    const indiaMatches = places.map(place => place.match(indiaPlace))
    if (indiaMatches.every(Boolean)) {
      if (countryScope === 'foreign' || !country && !indiaMatches.every(match => match[2]) || !indiaComponentsAgree) return unknown()
      const cities = [...new Set(indiaMatches.map(match => match[1]))]
      return { city: cities.join(', '), state: null, country: 'India', location: cities.join(', ') + ', India' }
    }
    if (indiaMatches.some(Boolean) || places.some(place => !foreignPlace.test(place)) || countryScope === 'india' || foreignComponentsConflict) return unknown()
    // The legacy New York/Chicago formats need the provided native US country;
    // these bare city labels do not independently prove any country.
    if (countryScope === 'foreign') {
      if (!places.every(place => hasRecognizedWorkdayCountry(place)
        ? sameCountry(country, place)
        : /^(?:New York|Chicago)$/i.test(place) && sameCountry(country, 'United States'))) return unknown()
      return null
    }
    // With no Country field, every foreign place must name the same country.
    if (places.every(place => hasRecognizedWorkdayCountry(place))
      && places.every(place => sameCountry(places[0], place))) return null
    return unknown()
  }
  if (countryScope === 'india') {
    if (!indiaComponentsAgree) return unknown()
    return { city, state, country: 'India', location: [city, state, 'India'].filter(Boolean).join(', ') }
  }
  if (countryScope === 'foreign') {
    if (foreignComponentsConflict) return unknown()
    return null
  }
  return unknown()
}

const normalizeQualification = (value) => {
  if (Array.isArray(value)) {
    return normalizeWhitespace(value.map((item) => normalizeWhitespace(item)).filter(Boolean).join('; '))
  }

  return normalizeWhitespace(value)
}

const isPublishedRecord = (record = {}) => record.Publish !== false

const isUnlockedRecord = (record = {}) => record.Is_Locked !== true && record.Locked !== true

const isExpectedDetailHost = (value) => {
  try {
    return new URL(String(value ?? '')).hostname === CAREERS_DETAIL_HOST
  } catch {
    return false
  }
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  if (
    /<title>\s*Jobs\s*\|\s*quadeye\s*<\/title>/i.test(page)
    && /rel=["']canonical["'][^>]+href=["']https:\/\/(?:www\.quadeye\.com\/jobs|quadeye\.cyralix\.com\/\/jobs)["']/i.test(page)
    && text.includes('Open Roles')
    && text.includes('Loading roles')
    && /href=["']\/career["']/i.test(page)
    && /href=["']\/contact-us["']/i.test(page)
  ) return true

  return /<title>\s*Careers\s*-\s*Quadeye\s*<\/title>/i.test(page)
    && /meta[^>]+name=["']description["'][^>]+Careers at Quadeye Securities\. Join our Team!/i.test(page)
    && text.includes('Become part of our Team')
    && text.includes('Our people make us exceptional')
    && text.includes("If you have any questions or don't see a role that fits your profile, write to us at")
    && text.includes('career@quadeye.com')
    && text.includes('We are looking for enthusiastic candidates for below profiles!')
    && /href=["']https:\/\/www\.quadeye\.com\/careers\/["'][^>]*>\s*(?:<span>\s*)?Check All The Openings(?:\s*<\/span>)?\s*<\/a>/i.test(page)
    && /site:"https:\/\/quadeye\.zohorecruit\.in"/i.test(page)
    && /source:"CareerSite"/i.test(page)
    && /empty_job_msg:"No current Openings"/i.test(page)
  }

export const hasOfficialPortalSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Jobs at (?:Careers|PeoplePlus)\s*<\/title>/i.test(page)
    && /meta\s+property=["']og:url["']\s+content=["']https:\/\/quadeye\.zohorecruit\.in\/jobs\/Careers\/?["']/i.test(page)
    && /meta\s+property=["']og:site_name["']\s+content=["']Quadeye["']/i.test(page)
    && /<input\b(?=[^>]*\bid=["']pageJson["'])[^>]*>/i.test(page)
    && /<input\b(?=[^>]*\bid=["']moduleMeta["'])[^>]*>/i.test(page)
    && /<input\b(?=[^>]*\bid=["']jobs["'])[^>]*>/i.test(page)
  }

export const hasVerifiedJobDetailPage = (html = '', job = {}) => {
  if (!isExpectedDetailHost(job.sourceUrl)) {
    return false
  }

  const page = String(html ?? '')
  const text = stripTags(page)?.toLowerCase() || ''
  const title = normalizeWhitespace(job.title)?.toLowerCase() || ''

  return text.includes('quadeye')
    && text.includes(title)
    && !/position filled|joblist has been removed|sign in to your zoho account/i.test(page)
}

export const extractIndiaJobs = (payload = {}) => {
  if (!Array.isArray(payload?.data)) throw new Error('QuadEye incomplete API inventory')
  const seen = new Set()
  return payload.data
    .filter((record) => isPublishedRecord(record) && isUnlockedRecord(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = normalizeWhitespace(record.$url)
      const department = normalizeWhitespace(record.Department || record.Industry || record?.Client_Name?.name)
      if (!title || !jobId || !sourceUrl || !isExpectedDetailHost(sourceUrl) || seen.has(jobId)) throw new Error('QuadEye incomplete or invalid role identity/application')
      const url = new URL(sourceUrl)
      if (url.protocol !== 'https:' || !url.pathname.startsWith('/jobs/Careers/' + jobId + '/') || url.username || url.password) throw new Error('QuadEye invalid application URL')
      seen.add(jobId)
      const scope = normalizeLocation(record)
      if (!scope) return null

      return {
        title,
        company: COMPANY,
        department,
        ...scope,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.Job_Type),
        experienceRequired: normalizeWhitespace(record.Work_Experience || record.Experience),
        minimumQualification: normalizeQualification(record.Required_Qualification),
        preferredQualification: normalizeQualification(record.Preferred_Qualification),
        requiredSkills: [],
        postingDate: normalizeDate(record.Date_Opened),
        closingDate: normalizeDate(record.Target_Date_to_Fill || record.Closing_Date),
        jobDescription: normalizeWhitespace(record.Job_Description),
        remoteStatus: record.Remote_Job ? 'Remote' : 'On-site',
      }
    })
    .filter(Boolean)
}

const assertCompletePortalInventory = (html, payload) => {
  const tag = [...String(html).matchAll(/<input\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)]
    .map(match => match[0]).find(tag => /\bid=["']jobs["']/i.test(tag))
  const raw = tag?.match(/\bvalue=(["'])([\s\S]*?)\1/i)?.[2]
  let embedded
  try { embedded = JSON.parse(decodeHtml(raw)) } catch {}
  if (!Array.isArray(embedded)) throw new Error('QuadEye incomplete portal inventory')
  const ids = records => records.map(record => normalizeWhitespace(record?.id))
  const expected = ids(embedded)
  const actual = ids(payload.data)
  if (expected.some(id => !id) || actual.some(id => !id)
    || new Set(expected).size !== expected.length || new Set(actual).size !== actual.length
    || expected.length !== actual.length || actual.some(id => !expected.includes(id))) throw new Error('QuadEye incomplete API/portal inventory')
}

const defaultFetchText = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createQuadEyeScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now: overrideNow,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const careersPageHtml = await fetchText(CAREERS_PAGE_URL, { signal })
    if (!hasOfficialCareersPageSignal(careersPageHtml)) {
      throw new Error('Response is not the verified official QuadEye careers page')
    }

    const portalHtml = await fetchText(CAREERS_PORTAL_URL, { signal })
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('Response is not the verified QuadEye careers portal')
    }

    const payload = await fetchJson(CAREERS_API_URL, { signal })
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('QuadEye public jobs API no longer returns the verified success payload')
    }

    signal?.throwIfAborted()
    assertCompletePortalInventory(portalHtml, payload)
    const jobs = extractIndiaJobs(payload)
    const selectedJobs = Number.isInteger(maxJobs) && maxJobs > 0 ? jobs.slice(0, maxJobs) : jobs

    if (selectedJobs.length > 0) {
      const detailHtml = await fetchText(selectedJobs[0].sourceUrl, { signal })
      if (!hasVerifiedJobDetailPage(detailHtml, selectedJobs[0])) {
        throw new Error('QuadEye public job detail pages no longer match the verified contract')
      }
    }

    signal?.throwIfAborted()
    if (selectedJobs.length < jobs.length) for (const job of selectedJobs) job.sourceListingComplete = false
    const getNow = overrideNow || now

    return attachInventoryEvidence(selectedJobs.map((job) => ({
      ...job,
      sourceScopeComplete: false,
      sourceListingComplete: false,
      sourceGlobalJobCount: null,
      sourceIndiaJobCount: null,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: getNow(),
    })), {
      status: 'coverage-gap', surface: CAREERS_API_URL, firstParty: false,
      listingComplete: false, pagesFetched: 1, reportedTotal: null,
      indiaFacetCount: null, verifiedAt: null,
      reason: 'QuadEye portal/API IDs were reconciled; company scope and complete role geography/details remain unverified',
    })
  },
})

export const run = async (options = {}) => createQuadEyeScraper().run(options)

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
