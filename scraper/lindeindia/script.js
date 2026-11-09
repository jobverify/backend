import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { withRetry } from '../../scraper-support/utils/retry.js'
import { extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { loadCsodContext, loadCsodBranch } from './csod.js'

export const PORTAL_ORIGIN = 'https://leindiacareers.peoplestrong.com'
export const SOURCE = 'lindeindia'
export const COMPANY = 'Linde India'
export const COMPANY_DOMAIN = 'linde.in'
export const HOMEPAGE_URL = 'https://www.linde.in/'
export const JOB_LOCATIONS_URL = 'https://www.lindecareers.com/en/job-locations'
export const ENGINEERING_PORTAL_URL = 'https://leindiacareers.peoplestrong.com/home'
export const INDIA_GASES_URL =
  'https://linde.csod.com/ux/ats/careersite/25/home?c=linde&cfdd[0][id]=251&cfdd[0][options][0]=1375&cfdd[0][options][1]=1131&cfdd[0][options][2]=1132&country=in'
export const INDIA_ITSC_URL =
  'https://linde.csod.com/ux/ats/careersite/25/home?c=linde&cfdd[0][id]=251&cfdd[0][options][0]=2266&country=in'
export const DEFAULT_PAGE_SIZE = 20

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const JOBS_API_PATH = `${PORTAL_ORIGIN}/api/cp/rest/altone/cp/jobs/v1`
const API_BASE = `${PORTAL_ORIGIN}/api/cp/rest/altone/cp/`
const LEGAL_EMPLOYER = 'Linde Engineering India Pvt. Ltd.'
const DETAIL_PARTS = 'basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied'
const fail = message => { throw new Error(`Linde India ${message}`) }
const sameUrl = (actual, expected) => {
  try {
    const a = new URL(actual), b = new URL(expected)
    return a.protocol === 'https:' && !a.username && !a.password && a.origin === b.origin
      && a.pathname === b.pathname && a.search === b.search && a.hash === b.hash
  } catch { return false }
}
const countryNames = new Set()
const regionNames = new Intl.DisplayNames(['en'], {type:'region'})
for (let a = 65; a <= 90; a += 1) for (let b = 65; b <= 90; b += 1) {
  const code = String.fromCharCode(a, b), name = regionNames.of(code)
  if (name && name !== code && !['ZZ','EU','UN','XA','XB','QO'].includes(code)) countryNames.add(name.toLowerCase())
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (normalized) return normalized
  }

  return null
}

const locationParts = record => {
  if (typeof record?.locationHierarchyComplete !== 'string') fail('listing country/location hierarchy is missing')
  const parts = record.locationHierarchyComplete.split('>').map(normalizeWhitespace)
  if (parts.length < 3 || parts.some(part => !part) || !countryNames.has(parts[0].toLowerCase())) fail('listing country/location hierarchy is malformed')
  const explicitCountry = firstNonEmpty(record.country, record.countryName)
  if (explicitCountry && explicitCountry.toLowerCase() !== parts[0].toLowerCase()) fail('listing country conflicts with its location hierarchy')
  return parts
}

const flattenSkills = (skills = {}) => [...new Set(
  [skills.mustTohave, skills.goodtohave]
    .flatMap((group) => Array.isArray(group) ? group : [])
    .map((skill) => normalizeWhitespace(skill))
    .filter(Boolean),
)]

const assertIndiaEngineeringRecord = record => {
  const parts = locationParts(record)
  if (parts[0] !== 'India') return null
  if (!firstNonEmpty(record.jobTitle) || !/^LEI\/[^/]+\/\d+$/.test(record.jobCode || '')
    || String(record.organizationUnitComplete ?? '').split('>')[0] !== LEGAL_EMPLOYER
    || (record.jobDetailUrl && !sameUrl(record.jobDetailUrl, buildJobDetailUrl(record.jobCode)))) fail('listing employer or application identity does not match the verified tenant')
  return parts
}

export const buildApiUrl = ({ offset = 0, limit = DEFAULT_PAGE_SIZE } = {}) => (
  `${JOBS_API_PATH}?offset=${offset}&limit=${limit}`
)

export const buildJobDetailUrl = (jobCode) => (
  jobCode ? `${PORTAL_ORIGIN}/job/detail/${encodeURIComponent(jobCode.replaceAll('/', '_'))}` : null
)

export const buildJobDetailsApiUrl = jobCode => `${API_BASE}job/${encodeURIComponent(jobCode.replaceAll('/', '_'))}/v2?part=${DETAIL_PARTS}&isReqId=false`

const assertTenantIdentity = (urlinfo, layout) => {
  const info = urlinfo?.response
  let logoMatches = false
  try {
    const logo = new URL(info?.leftLogo)
    logoMatches = logo.protocol === 'https:' && logo.hostname === 'static.peoplestrong.com'
      && logo.pathname.startsWith('/talentpact/server/appdata/system/tenant_1134/org_1207/logo/')
  } catch {}
  const brand = JSON.stringify(layout?.response ?? '')
  if (urlinfo?.messageCode?.code !== 200 || info?.url !== 'leindiacareers.peoplestrong.com' || info.realm !== 1207 || !logoMatches
    || layout?.messageCode?.code !== 200 || !Array.isArray(layout.response)
    || !brand.includes('About Linde Engineering India') || !brand.includes(LEGAL_EMPLOYER)) fail('native tenant identity or employer branding changed')
}

const assertDetail = (listing, payload) => {
  const detail = payload?.response
  if (payload?.messageCode?.code !== 200 || !detail || detail.requisitionCode !== listing.jobCode
    || String(detail.requisitionId) !== listing.jobCode.split('/').at(-1) || String(detail.entityID) !== '1475'
    || detail.jobTitle !== listing.jobTitle || (detail.organizationUnitComplete != null && detail.organizationUnitComplete !== listing.organizationUnitComplete)
    || detail.locationHierarchyComplete !== listing.locationHierarchyComplete || detail.requisitionStatus !== 'OPEN') fail('detail identity, employer, open status or location conflicts with the listing')
  for (const [detailKey, listingKey] of [['CandidatePortalStartDate','jobPostedDate'],['CandidatePortalEndDate','jobClosureDate']]) {
    if (detail[detailKey] && listing[listingKey] && String(detail[detailKey]).slice(0,10) !== listing[listingKey]) fail('detail lifecycle dates conflict with the listing')
  }
  if (!extractActiveDescription(detail.jobDescription)) fail('native detail published description is missing')
  return detail
}

const mapConcurrent = async (records, concurrency, action) => {
  const results = new Array(records.length)
  let cursor = 0, failure = null
  await Promise.allSettled(Array.from({length:Math.min(concurrency,records.length)}, async () => {
    while (cursor < records.length && !failure) {
      const index = cursor++
      try { results[index] = await action(records[index]) } catch (error) { failure ??= error }
    }
  }))
  if (failure) throw failure
  return results
}

export const buildPublicHeaders = () => ({
  Origin: PORTAL_ORIGIN,
  Referer: ENGINEERING_PORTAL_URL,
  'User-Agent': USER_AGENT,
  Accept: 'application/json,text/plain,*/*',
  'Content-Type': 'application/json',
})

const request = (url, options = {}) => withRetry(async () => {
  options.signal?.throwIfAborted()
  const response = await fetch(url, {
    method: options.method || 'GET', body: options.body,
    headers: {'User-Agent':USER_AGENT,...options.headers},
    signal: composeAbortSignals(options.signal, AbortSignal.timeout(20000)), redirect:'follow',
  })
  options.signal?.throwIfAborted()
  if (!sameUrl(response.url, url)) fail('native request redirected away from its verified identity')
  if (!response.ok && !options.allowHttpError) {
    const error = new Error(`HTTP ${response.status} for ${url}`)
    error.status = error.statusCode = response.status
    error.code = 'UPSTREAM_HTTP_ERROR'
    throw error
  }
  return {status:response.status,url:response.url,html:await response.text()}
}, {attempts:2,baseDelayMs:500,label:SOURCE,signal:options.signal})

const defaultFetchPage = (url, options = {}) => request(url, {
  ...options,allowHttpError:true,headers:{Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'},
})
const defaultFetchJson = async (url, options = {}) => {
  const response = await request(url, options)
  try { return JSON.parse(response.html) } catch { return fail('native API returned malformed JSON') }
}

export const hasOfficialHomepageSignal = (html) => {
  const document = readNativeDocument(String(html ?? ''))
  const anchors = document.nodes(node=>node.tag==='a')
  return document.nodes(node=>node.tag==='title').some(node=>/^linde in india \| a linde company$/i.test(normalizeWhitespace(node.raw)))
    && anchors.some(node=>sameUrl(node.attrs.href,'https://www.lindecareers.com/') && /\bcareers\b/i.test(document.text(node)))
    && anchors.some(node=>sameUrl(node.attrs.href,'https://www.linde.com/'))
}

const hasIndiaEmployerLinks = document => {
  const anchors = document.nodes(node=>node.tag==='a')
  return [INDIA_GASES_URL,ENGINEERING_PORTAL_URL,INDIA_ITSC_URL].every(url=>anchors.some(node=>sameUrl(node.attrs.href,url)))
}

export const hasOfficialJobLocationsSignal = (html) => {
  const document = readNativeDocument(String(html ?? ''))
  const normalized = normalizeWhitespace(document.text(document.nodes(node=>node.tag==='root')[0])).toLowerCase()
  if (!normalized.includes('job location information, related details and applications')
    || !normalized.includes('india') || !normalized.includes('asia')) return false
  if (hasIndiaEmployerLinks(document)) return true
  // The observed official UI renders its India popup from this active country
  // anchor's JSON attribute. Only that component can activate its Content HTML.
  const contents = new Set()
  for (const node of document.nodes(node=>node.tag==='a' && node.attrs.href==='#' && node.attrs['data-modal-target'])) {
    if (!/^India$/i.test(document.text(node))) continue
    try {
      const model = JSON.parse(node.attrs['data-modal-target'])
      if (model.headline === 'India' && typeof model.Content === 'string') contents.add(model.Content)
    } catch {}
  }
  return contents.size === 1 && hasIndiaEmployerLinks(readNativeDocument([...contents][0]))
}

export const hasEngineeringPortalShell = (html) => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Candidate Portal\s*<\/title>/i.test(rawHtml)
    && /<app-root\b[^>]*data-testid=["']src-index-app-root-page-1["']/i.test(rawHtml)
    && /candidate-portal/i.test(rawHtml)
    && /main-[A-Z0-9]+\.js/i.test(rawHtml)
}

export const extractEngineeringJobs = (payload = {}) => {
  if (!Array.isArray(payload?.response)) fail('listing inventory is unavailable or malformed')
  return payload.response.map((record) => {
    const parts = assertIndiaEngineeringRecord(record)
    if (!parts) return null
    const title = firstNonEmpty(record.jobTitle, record.title, record.designation, record.name)
    const jobCode = firstNonEmpty(record.jobCode, record.reqCode, record.requisitionId, record.jobId)
    const location = [parts[2],parts[1],'India'].join(', ')
    const sourceUrl = buildJobDetailUrl(jobCode)

    if (!title || !jobCode || !sourceUrl) return null

    return {
      title,
      company: COMPANY,
      department: firstNonEmpty(record.organizationUnit, record.department, record.departmentName),
      location,
      city: parts[2],
      state: parts[1],
      country: 'India',
      jobId: jobCode,
      requisitionId: firstNonEmpty(record.requisitionId, jobCode) || jobCode,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: firstNonEmpty(
        record.employmentTenureType,
        record.employmentType,
        record.jobType,
      ),
      experienceRequired: firstNonEmpty(record.expRange, record.experience, record.experienceRange),
      minimumQualification: firstNonEmpty(record.minimumQualification, record.minQualification),
      preferredQualification: firstNonEmpty(record.preferredQualification, record.prefQualification),
      requiredSkills: flattenSkills(record.skills),
      postingDate: firstNonEmpty(record.jobPostedDate, record.postingDate, record.postedOn),
      closingDate: firstNonEmpty(record.jobClosureDate, record.closingDate, record.expiryDate),
      jobDescription: extractActiveDescription(record.jobDescription || record.description),
      companyCareerPage: JOB_LOCATIONS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'peoplestrong',
    }
  }).filter(Boolean)
}

export const createLindeIndiaScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    pageSize = DEFAULT_PAGE_SIZE,
    maxPages = Number.POSITIVE_INFINITY,
    maxJobs = null,
    detailConcurrency = 4,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    signal?.throwIfAborted()
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100
      || !Number.isSafeInteger(detailConcurrency) || detailConcurrency < 1 || detailConcurrency > 12
      || !(maxPages === Number.POSITIVE_INFINITY || (Number.isSafeInteger(maxPages) && maxPages > 0))
      || (maxJobs != null && (!Number.isSafeInteger(maxJobs) || maxJobs < 1))) fail('inventory pagination or concurrency options are invalid')
    const homepage = await fetchPage(HOMEPAGE_URL, {signal})
    signal?.throwIfAborted()

    if (homepage.status !== 200 || !sameUrl(homepage.url,HOMEPAGE_URL) || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Linde India verified official homepage no longer matches the known public surface')
    }

    const jobLocations = await fetchPage(JOB_LOCATIONS_URL, {signal})
    signal?.throwIfAborted()

    if (jobLocations.status !== 200 || !sameUrl(jobLocations.url,JOB_LOCATIONS_URL) || !hasOfficialJobLocationsSignal(jobLocations.html)) {
      throw new Error('Linde India verified official job locations page no longer matches the known public surface')
    }

    const loadEngineering = async () => {
    const engineeringPortal = await fetchPage(ENGINEERING_PORTAL_URL, {signal})
    signal?.throwIfAborted()

    if (![200, 404].includes(engineeringPortal.status) || !sameUrl(engineeringPortal.url,ENGINEERING_PORTAL_URL) || !hasEngineeringPortalShell(engineeringPortal.html)) {
      throw new Error('Linde India verified public engineering portal no longer matches the known public surface')
    }

    const headers = buildPublicHeaders()
    const urlinfo = await fetchJson(API_BASE+'urlinfo', {method:'GET',headers,signal})
    signal?.throwIfAborted()
    const layout = await fetchJson(API_BASE+'layout?isPreview=false', {method:'GET',headers,signal})
    signal?.throwIfAborted()
    assertTenantIdentity(urlinfo,layout)
    const jobs = [], seen = new Set()
    let total = null, pagesFetched = 0, complete = false

    for (let page = 0; page < maxPages; page += 1) {
      signal?.throwIfAborted()
      const offset = page * pageSize
      const payload = await fetchJson(buildApiUrl({ offset, limit: pageSize }), {
        method: 'POST',
        headers: buildPublicHeaders(),
        body: JSON.stringify({}),
        signal,
      })
      signal?.throwIfAborted()
      if (payload?.messageCode?.code !== 200 || !Array.isArray(payload.response)
        || !Number.isSafeInteger(payload.totalRecords) || payload.totalRecords < 0
        || (total != null && total !== payload.totalRecords)) fail('listing inventory or reported total is unavailable, malformed or changed')
      total = payload.totalRecords
      if (payload.response.length !== Math.min(pageSize,Math.max(total-offset,0))) fail('listing inventory page count does not reconcile with its total')
      const pageJobs = extractEngineeringJobs(payload)
      for (const record of payload.response) {
        if (!firstNonEmpty(record.jobCode) || seen.has(record.jobCode)) fail('listing inventory identity repeats a requisition or is missing')
        seen.add(record.jobCode)
      }
      pagesFetched += 1
      const selected = Number.isFinite(maxJobs) ? pageJobs.slice(0,Math.max(0,maxJobs-jobs.length)) : pageJobs
      const scrapedAt = now()
      jobs.push(...await mapConcurrent(selected,detailConcurrency,async job => {
        signal?.throwIfAborted()
        const record = payload.response.find(row=>row.jobCode===job.jobId)
        const detail = assertDetail(record,await fetchJson(buildJobDetailsApiUrl(job.jobId), {method:'GET',headers,signal}))
        signal?.throwIfAborted()
        const description = extractActiveDescription(detail.jobDescription)
        return {...job,source:SOURCE,link:job.applyUrl,scrapedAt,requisitionId:String(detail.requisitionId),
          sourceClosingDateIsExact:false,
          ...(detail.organizationUnitComplete == null ? {sourceNativeOrganizationEvidence:{
            listingPath:record.organizationUnitComplete,detailPath:detail.organizationUnitComplete??null,
            legalEmployer:LEGAL_EMPLOYER,entityID:String(detail.entityID),
          }} : {}),
          employmentType:firstNonEmpty(detail.employmentType,job.employmentType),
          jobDescription:description,sourceDescription:description,jobDescriptionHtml:detail.jobDescription}
      }))
      if (seen.size === total && selected.length === pageJobs.length) { complete = true; break }
      if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) break
    }
    return {jobs,total,pagesFetched,complete}
    }

    const branches = [], errors = []
    const collect = async (name, action) => {
      try { const result = await action(); signal?.throwIfAborted(); branches.push({name,...result}) }
      catch (error) { signal?.throwIfAborted(); errors.push({name,error}) }
    }
    await collect('Engineering',loadEngineering)
    let jobs = branches.flatMap(branch=>branch.jobs)
    let context
    if (!Number.isFinite(maxJobs) || jobs.length < maxJobs) {
      try { context = await loadCsodContext({fetchPage,fetchJson,boardUrl:INDIA_GASES_URL,signal}) }
      catch (error) { signal?.throwIfAborted(); errors.push({name:'Gases and ITSC',error}) }
      if (context) for (const [name,ids] of [['Gases',[1375,1131,1132]],['ITSC',[2266]]]) {
        if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) break
        await collect(name,()=>loadCsodBranch({context,ids,fetchJson,pageSize,maxPages,
          maxJobs:Number.isFinite(maxJobs)?maxJobs-jobs.length:null,detailConcurrency,now,signal}))
        jobs = branches.flatMap(branch=>branch.jobs)
      }
    }
    signal?.throwIfAborted()
    if (!branches.length && errors.length) throw errors[0].error
    const identities = new Set(jobs.map(job=>job.applyUrl))
    if (identities.size !== jobs.length) fail('umbrella scopes returned duplicate application identities')
    const complete = branches.length === 3 && branches.every(branch=>branch.complete)
    const limited = branches.some(branch=>!branch.complete) || (Number.isFinite(maxJobs) && branches.length < 3)
    for (const job of jobs) job.sourceListingComplete = complete
    const summary = branches.map(branch=>`${branch.name}: ${branch.complete?'reconciled':'limited read'}, native listing reports ${branch.total} roles`).join('; ')
    return attachInventoryEvidence(jobs, {
      status:complete?(jobs.length?'complete-inventory':'verified-empty'):limited?'discovery-only':'coverage-gap',
      surface:JOB_LOCATIONS_URL,firstParty:true,listingComplete:complete,pagesFetched:branches.reduce((sum,b)=>sum+b.pagesFetched,0),
      reportedTotal:complete?jobs.length:null,indiaFacetCount:complete?jobs.length:null,verifiedAt:now(),
      reason:complete?`All official India scopes reconciled. ${summary}`:
        `${summary}. Whole-company India scope remains open; Gases and ITSC require independent reconciliation. ${errors.map(({name,error})=>`${name}: ${error.message}`).join('; ')}`,
    })
  },
})

export const run = async (options = {}) => createLindeIndiaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
