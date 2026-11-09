import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { IXIGO_CATALOG } from './catalog.js'
import {extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {normalizeEmployerDisclosures} from '../../src/utils/employerDisclosures.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = IXIGO_CATALOG.source
export const COMPANY = IXIGO_CATALOG.companyName
export const PROVIDER_METADATA = IXIGO_CATALOG
export const HOMEPAGE_URL = IXIGO_CATALOG.homepageUrl
export const LEGACY_CAREERS_URL = IXIGO_CATALOG.legacyCareersUrl
export const CURRENT_CAREERS_URL = IXIGO_CATALOG.currentCareersUrl
export const OPENINGS_API_URL = 'https://careers.ixigo.com/api/openings'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|section|article|a)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return String(value ?? '')
  }
}

const defaultFetchPage = async (url, {signal} = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'error', credentials: 'omit',
    signal: AbortSignal.any([signal,AbortSignal.timeout(20000)].filter(Boolean)),
  })

  const chunks=[];let size=0
  for await(const chunk of response.body){size+=chunk.byteLength;if(size>4e6)throw Error('ixigo native response body limit');chunks.push(chunk)}

  return {
    status: response.status,
    url: response.url,
    html: Buffer.concat(chunks).toString('utf8'),
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*ixigo careers\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Join our team of 250+ passionate folks')
    && normalized.includes('we are changing the way India travels.')
    && normalized.includes('Open roles')
}

export const hasVerifiedNoJobsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return normalized.includes('No Jobs Found')
    && normalized.includes('Could not find an open position that excites you ?')
    && normalized.includes('Apply for Another Position')
}

const verifyCurrentCareersPage = (page) => {
  if (page.status !== 200 || normalizeComparableUrl(page.url) !== normalizeComparableUrl(CURRENT_CAREERS_URL)) {
    throw new Error(`ixigo current careers page returned HTTP ${page.status} or an unexpected redirect`)
  }

  if (!hasOfficialCareersSignal(page.html)) {
    throw new Error('The official ixigo careers page no longer matches the verified first-party surface')
  }

}

const nativeText = value => typeof value === 'string' ? value.trim() || null : null
const regionNames = new Intl.DisplayNames(['en'], {type: 'region'})
const shortRegionNames = new Intl.DisplayNames(['en'], {type: 'region', style: 'short'})
const countryMatches = (code, name) => {
  if (!/^[a-z]{2}$/.test(code) || ['zz','eu','un','xa','xb','qo'].includes(code)) return false
  const upper = code.toUpperCase(), label = nativeText(name)?.toLowerCase()
  const longName = regionNames.of(upper)
  if (!label || !longName || longName === upper) return false
  return [longName, shortRegionNames.of(upper), ...(code === 'us' ? ['United States of America'] : [])]
    .some(value => value?.toLowerCase() === label)
}
const hasMaterialContent = value => {
  if (value == null) return false
  if (typeof value === 'string') return Boolean(value.trim())
  if (Array.isArray(value)) return value.some(hasMaterialContent)
  if (typeof value === 'object') return Object.values(value).some(hasMaterialContent)
  return true
}
const unretainedProperties = (record, retained) => record != null && (
  typeof record !== 'object' || Array.isArray(record) ? hasMaterialContent(record)
    : Object.entries(record).some(([key, value]) => !retained.includes(key) && hasMaterialContent(value))
)
const unhandledCustomFields = (fields, code, countryName) => fields != null && (!Array.isArray(fields)
  || fields.some(field => unretainedProperties(field, ['fieldId','fieldLabel','valueId','valueLabel'])
    || !['fieldId','fieldLabel','valueId','valueLabel'].every(key => typeof field?.[key] === 'string') || !(
    (field?.fieldId === 'COUNTRY' && field.fieldLabel === 'Country/Region'
      && nativeText(field.valueId)?.toLowerCase() === code
      && nativeText(field.valueLabel)?.toLowerCase() === nativeText(countryName)?.toLowerCase())
    || (field?.fieldLabel === 'Brands' && nativeText(field.valueLabel)?.toLowerCase() === 'ixigo')
  )))
const unhandledCriteriaKey = (record, retained = []) => Object.entries(record || {}).some(([key, value]) =>
  /requirement|eligib|attachment|salary|benefit|education|skill|qualification|condition|experience/i.test(key)
    && !retained.includes(key) && hasMaterialContent(value))

const unresolvedPagination = record => {
  const flags = ['hasMore','hasNextPage','hasNext']
  const pointers = ['next','nextPage','nextPageUrl','nextCursor','nextPageToken','continuationToken']
  const containers = [record, record?.pagination, record?.paging, record?.pageInfo]
  return containers.some((page, index) => page != null && (
    (index > 0 && unretainedProperties(page, [...flags, ...pointers]))
    || flags.some(key => page[key] != null && page[key] !== false)
    || pointers.some(key => page[key] !== false && hasMaterialContent(page[key]))
  ))
}

const extractOpenings = (payload) => {
  const data = payload?.data
  if (!Array.isArray(data?.results) || !Number.isInteger(data.numFound)
    || data.numFound < 0 || data.results.length !== data.numFound) {
    throw new Error('ixigo openings API returned an incomplete listing')
  }
  const seen = new Set()
  const jobs = []
  // A matching results/numFound pair cannot override an explicit continuation.
  let criteriaComplete = !unresolvedPagination(payload) && !unresolvedPagination(data)
  for (const record of data.results) {
    const jobId = String(record?.jobVacancyId || '')
    const title = normalizeWhitespace(record?.vacancyName)
    const location = normalizeWhitespace(record?.location)
    const countryCode = nativeText(record?.countryAbbreviation)?.toLowerCase() || ''
    if (!/^\d+$/.test(jobId) || !title || !location || !/^[a-z]{2}$/.test(countryCode)
      || record?.companyIdentifier?.toLowerCase() !== 'ixigo'
      || record?.companyName?.toLowerCase() !== 'ixigo' || seen.has(jobId)) {
      throw new Error('ixigo openings API returned an invalid or duplicate company job record')
    }
    seen.add(jobId)
    if (!countryMatches(countryCode, record.countryName)) {
      throw new Error('ixigo openings API returned inconsistent country evidence')
    }
    const listingCriteriaComplete = !unhandledCustomFields(record.customFieldValues, countryCode, record.countryName)
      && !hasMaterialContent(record.locationHybridDescription) && !unhandledCriteriaKey(record)
      && (record.typeOfEmployment == null || Boolean(nativeText(record.typeOfEmployment)))
      && (record.department == null || typeof record.department === 'string')
      && ['locationRemote','locationHybrid'].every(key => record[key] == null || typeof record[key] === 'boolean')
    if (!listingCriteriaComplete) criteriaComplete = false
    if (countryCode !== 'in') continue
    // This is the SmartRecruiters handoff used by the official careers app,
    // with the canonical host verified after its www.smartrecruiters.com redirect.
    const link = `https://jobs.smartrecruiters.com/ixigo/${jobId}`
    const postingDate = new Date(record.releasedDate)
    jobs.push({
      title, company: COMPANY, location, city: location.split(',')[0].trim(), country: 'India',
      link, applyUrl: link, sourceUrl: link, source: SOURCE, jobId,
      requisitionId: record.refNumber || jobId, department: nativeText(record.department),
      employmentType: nativeText(record.typeOfEmployment), jobDescription: null,
      postingDate: record.releasedDate && Number.isFinite(postingDate.getTime()) ? postingDate.toISOString() : null,
      remoteStatus: record.locationRemote ? 'Remote' : record.locationHybrid ? 'Hybrid' : 'On-site',
      atsPlatform: 'smartrecruiters',
      nativeListingRecord: record,
      nativeListingCriteriaComplete: listingCriteriaComplete,
    })
  }
  return {jobs, criteriaComplete}
}

const canonicalValue = (value, depth = 0) => {
  if (depth > 64) throw Error('ixigo listing structure exceeds reconciliation depth')
  if (Array.isArray(value)) return value.map(item => canonicalValue(item, depth + 1))
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .map(key => [key, canonicalValue(value[key], depth + 1)]))
  return value
}
const canonicalInventory = payload => JSON.stringify(payload.data.results
  .map(record => [String(record.jobVacancyId), canonicalValue(record)])
  .sort(([left], [right]) => left.localeCompare(right)))

const nativeCriteriaComplete = (detail, candidate, salary, disclosures) => {
  const sectionTitles = {companyDescription:'Company Description',jobDescription:'Job Description',
    qualifications:'Qualifications',additionalInformation:'Additional Information'}
  const sectionKeys = Object.keys(sectionTitles)
  const sections = detail.jobAd.sections
  const employment = nativeText(detail.typeOfEmployment?.label)
  if (!candidate.nativeListingCriteriaComplete
    || unretainedProperties(detail.compensation, ['min','max','currency','period'])
    || ['experienceLevel','typeOfEmployment'].some(key => unretainedProperties(detail[key], ['id','label'])
      || (detail[key]?.id != null && !['string','number'].includes(typeof detail[key].id)))
    || unretainedProperties(detail.location, ['city','region','country','address','remote','hybrid','fullLocation'])
    || ['city','region','fullLocation'].some(key => detail.location[key] != null && typeof detail.location[key] !== 'string')
    || (detail.experienceLevel != null && !disclosures.employerExperienceLevel)
    || (detail.location.address != null && !disclosures.employerStreetAddress)
    || (detail.typeOfEmployment != null && !employment)
    || (employment && candidate.employmentType && employment.toLowerCase() !== candidate.employmentType.toLowerCase())
    || (hasMaterialContent(detail.compensation) && !salary)
    || unhandledCustomFields(detail.customField, 'in', 'India')
    || unhandledCriteriaKey(detail, ['compensation','experienceLevel','typeOfEmployment'])
    || Object.entries(detail.jobAd).some(([key, value]) => key !== 'sections' && hasMaterialContent(value))
    || Object.entries(sections).some(([key, value]) => !sectionKeys.includes(key) && hasMaterialContent(value))
    || sectionKeys.some(key => sections[key] != null && typeof sections[key]?.text !== 'string')
    || sectionKeys.some(key => unretainedProperties(sections[key], ['title','text'])
      || (hasMaterialContent(sections[key]?.title)
        && normalizeWhitespace(sections[key].title)?.toLowerCase() !== sectionTitles[key].toLowerCase()))
    || sectionKeys.some(key => /\b(?:href|src)\s*=\s*["']?[^\s"'<>]*\.(?:pdf|docx?|xlsx?)(?:[?#"'\s>]|$)/i.test(sections[key]?.text || ''))
    || sectionKeys.some(key => /\b(?:href|src)\s*=/i.test(sections[key]?.text || '')
      && (key === 'qualifications' || /\b(?:criteria|eligibility|requirements?|qualifications?|mandatory)\b/i.test(normalizeWhitespace(sections[key]?.text) || '')))
  ) return false
  for (const [nativeKey, listingKey] of [['remote','locationRemote'],['hybrid','locationHybrid']]) {
    const native = detail.location[nativeKey], listing = candidate.nativeListingRecord[listingKey]
    if ((native != null && typeof native !== 'boolean')
      || (typeof native === 'boolean' && typeof listing === 'boolean' && native !== listing)) return false
  }
  return true
}

const formatNativeCompensation = compensation => {
  if (!compensation || typeof compensation !== 'object' || Array.isArray(compensation)) return null
  const { min, max, currency, period } = compensation
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)
    || typeof period !== 'string' || !/^[A-Z][A-Z_]{0,39}$/.test(period)) return null
  const hasMin = min !== null && min !== undefined
  const hasMax = max !== null && max !== undefined
  if ((!hasMin && !hasMax)
    || (hasMin && (typeof min !== 'number' || !Number.isFinite(min) || min < 0))
    || (hasMax && (typeof max !== 'number' || !Number.isFinite(max) || max < 0))
    || (hasMin && hasMax && min > max)) return null
  const amount = hasMin && hasMax ? min === max ? String(min) : `${min} - ${max}`
    : hasMin ? `from ${min}` : `up to ${max}`
  // Preserve the publisher's unit and bounds without conversion or annualization.
  const interval = period === 'MONTHLY' ? 'per month' : `(${period})`
  return `${currency} ${amount} ${interval}`
}

export const createIxigoScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal } = {}) {
    signal?.throwIfAborted()
    let fetchAttempts = 0, receivedPages = 0
    const readPage = async url => {
      signal?.throwIfAborted()
      fetchAttempts++
      const page = await fetchPage(url,{signal})
      receivedPages++
      return page
    }
    const currentCareersPage = await readPage(CURRENT_CAREERS_URL)
    verifyCurrentCareersPage(currentCareersPage)
    // The exported HTML says No Jobs Found before its client request completes,
    // and even after request errors. Only the API establishes the vacancy set.
    const response = await readPage(OPENINGS_API_URL)
    if (response.status !== 200 || normalizeComparableUrl(response.url) !== OPENINGS_API_URL) {
      throw new Error(`ixigo openings API returned HTTP ${response.status} or an unexpected redirect`)
    }
    let payload
    try { payload = JSON.parse(response.html) } catch {
      throw new Error('Could not parse ixigo openings API response')
    }
    const opening = extractOpenings(payload), candidates = opening.jobs, jobs = []
    const observed={source:SOURCE,observedAt:new Date().toISOString(),
      returnedIndiaJobs:0,nativeRecords:payload.data.numFound,candidateIndiaJobs:candidates.length,
      nonIndiaRecords:payload.data.numFound-candidates.length,unresolved:[],exclusions:[],failures:[],
      nativeInventoryReads:[{kind:'ixigo-first-party-openings',surface:OPENINGS_API_URL,reportedTotal:payload.data.numFound}],
      closingInventoryMatches:false,accountedIndiaJobs:0,companyGlobalTotal:null,companyIndiaTotal:null,
      sourceScopeComplete:false,lifecycleCleanupAllowed:false}
    if (!opening.criteriaComplete) observed.unresolved.push('unretained-listing-criteria')
    for(const candidate of candidates.slice(0,50)){
      signal?.throwIfAborted()
      const endpoint='https://api.smartrecruiters.com/v1/companies/ixigo/postings/'+candidate.jobId
      try{
        const page=await readPage(endpoint)
        if(page.status!==200||page.url!==endpoint)throw Error('ixigo native detail HTTP '+page.status+' or changed response URL')
        const detail=JSON.parse(page.html)
        if(detail.id!==candidate.jobId||normalizeWhitespace(detail.name)!==candidate.title||detail.refNumber!==candidate.requisitionId
          ||detail.company?.name?.toLowerCase()!=='ixigo'||detail.company?.identifier?.toLowerCase()!=='ixigo')throw Error('ixigo native detail role or company identity changed')
        if(detail.active===false||detail.visibility==='PRIVATE'){
          observed.exclusions.push({reason:'native-role-not-active-public',id:candidate.jobId});continue
        }
        if(detail.active!==true||detail.visibility!=='PUBLIC')throw Error('ixigo native role availability metadata unavailable')
        if(detail.location?.country?.toLowerCase()!=='in')throw Error('ixigo native detail country is unavailable or conflicts with its listing')
        const sections=detail.jobAd?.sections,ownDescription=extractActiveDescription(sections?.jobDescription?.text)
        if(!ownDescription||ownDescription.length<100)throw Error('ixigo native full role description unavailable')
        const description=['companyDescription','jobDescription','qualifications','additionalInformation'].map(key=>sections[key]?.text).filter(text=>typeof text==='string'&&text.trim()).join('\n')
        const role=new URL(detail.postingUrl),application=new URL(detail.applyUrl)
        const publicRole=url=>url.protocol==='https:'&&url.hostname==='jobs.smartrecruiters.com'&&!url.username&&!url.password&&!url.port&&!url.hash
          &&/^\/ixigo\/\d+(?:-[^/]+)?$/.test(url.pathname)
        if(!publicRole(role)||role.search||!publicRole(application)||role.pathname!==application.pathname)throw Error('ixigo native public role URL changed publisher or identity')
        const salary = formatNativeCompensation(detail.compensation)
        const disclosures = normalizeEmployerDisclosures({employerExperienceLevel:detail.experienceLevel?.label,
          employerStreetAddress:detail.location.address})
        const detailComplete = nativeCriteriaComplete(detail,candidate,salary,disclosures)
        if (!detailComplete) observed.unresolved.push('native-role-criteria-unretained-or-conflicting')
        const employment = nativeText(detail.typeOfEmployment?.label) || candidate.employmentType
        jobs.push({...candidate,link:role.href,sourceUrl:role.href,applyUrl:application.href,jobDescription:description,sourceDescription:description,
          salary,...disclosures,employmentType:employment,sourceEmploymentType:employment,
          remoteStatus:(detail.location.remote ?? candidate.nativeListingRecord.locationRemote) ? 'Remote'
            : (detail.location.hybrid ?? candidate.nativeListingRecord.locationHybrid) ? 'Hybrid' : 'On-site',
          nativeHiringOrganization:detail.company,nativeSourceRecord:{listing:candidate.nativeListingRecord,detail},
          sourceDetailComplete:detailComplete,...(!detailComplete && {sourceDetailFailureKind:'unretained-or-conflicting-native-criteria'}),
          sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false})
      }catch(error){
        signal?.throwIfAborted()
        observed.unresolved.push('native-role-detail-unverified')
        observed.failures.push({stage:'native-ixigo-role-detail',id:candidate.jobId,message:error.message})
        if(/\bHTTP (?:401|403|429|451)\b/.test(error.message))break
      }
    }
    if(candidates.length>50)observed.unresolved.push('native-detail-budget-reached')
    observed.returnedIndiaJobs=jobs.length
    observed.accountedIndiaJobs=jobs.length+observed.exclusions.length
    if (!observed.unresolved.length && !observed.failures.length && observed.accountedIndiaJobs === candidates.length) {
      try {
        const closing = await readPage(OPENINGS_API_URL)
        if (closing.status !== 200 || normalizeComparableUrl(closing.url) !== OPENINGS_API_URL)
          throw Error('ixigo closing inventory HTTP '+closing.status+' or changed response URL')
        const closingPayload = JSON.parse(closing.html)
        const closingListing = extractOpenings(closingPayload)
        observed.nativeInventoryReads.push({kind:'ixigo-first-party-openings-closing',surface:OPENINGS_API_URL,reportedTotal:closingPayload.data.numFound})
        if (!closingListing.criteriaComplete || closingPayload.data.numFound !== payload.data.numFound
          || canonicalInventory(closingPayload) !== canonicalInventory(payload)) throw Error('ixigo opening and closing listing records changed')
        observed.closingInventoryMatches=true
      } catch (error) {
        signal?.throwIfAborted()
        observed.unresolved.push('native-closing-inventory-unverified')
        observed.failures.push({stage:'native-ixigo-closing-inventory',message:error.message})
      }
    }
    observed.fetchAttempts=fetchAttempts
    observed.receivedPages=receivedPages
    observed.completedAt=new Date().toISOString()
    const listingComplete=observed.closingInventoryMatches && !observed.unresolved.length && !observed.failures.length
      && observed.accountedIndiaJobs === candidates.length
    for (const job of jobs) job.sourceListingComplete=listingComplete
    if(candidates.length&&!jobs.length&&observed.failures.length){
      const error=Object.assign(Error('ixigo native role details unavailable'),{failureKind:'coverage_gap',softFailure:true,recruitmentObservations:observed})
      throw error
    }
    Object.defineProperty(jobs,Symbol.for('jobverify.verified-recruitment-observations'),{value:observed})
    return attachInventoryEvidence(jobs,{status:listingComplete ? payload.data.numFound === 0 ? 'verified-empty' : 'complete-inventory' : 'coverage-gap',
      surface:CURRENT_CAREERS_URL,firstParty:true,listingComplete,lifecycleCleanupAllowed:false,
      pagesFetched:receivedPages,reportedTotal:payload.data.numFound,indiaFacetCount:candidates.length,
      verifiedAt:observed.completedAt,reason:listingComplete
        ? 'configured-first-party-openings-native-details-and-matching-close;company-scope-unverified;cleanup-forbidden'
        : 'configured-inventory-or-details-unverified;company-scope-unverified;cleanup-forbidden'})
  },
})

export const run = async (options = {}) => createIxigoScraper().run(options)

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
