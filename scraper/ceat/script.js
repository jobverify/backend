import {activeHead,extractActiveDescription,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const ORIGIN = 'https://ceat.turbohire.co'
export const CAREER_PAGE_ID = '4ae530fb-afba-4926-bdf9-9040b0e8774c'
export const API_BASE_URL = 'https://thapi.azurewebsites.net'
export const NOAUTH_TOKEN_URL = `${API_BASE_URL}/api/token/noauth`
export const FILTERED_JOBS_URL = `${API_BASE_URL}/api/careerpagev2/filteredjobs?orgId=${CAREER_PAGE_ID}&pageType=0`
export const CAREER_PAGE_URL = `${ORIGIN}/careerpage/${CAREER_PAGE_ID}`
export const CORPORATE_CAREERS_URL = 'https://www.ceat.com/career-landing.html'

export const LIVE_FILTER_BODY = {
  BunitIds: { Value: null, FilterType: 0 },
  Experience: { Value: null, FilterType: 0 },
  JobTypes: { Value: null, FilterType: 0 },
  Locations: { Value: null, FilterType: 0 },
  CreatedDate: { Value: null, FilterType: 0 },
  Compensation: { Value: null, FilterType: 0 },
  Skills: { Value: null, FilterType: 0 },
  Keyword: '',
  ClientIds: { Value: null, FilterType: 0 },
  Department: '',
  SortByV2: { Key: 'AtoZ', Order: 2 },
}

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const formatExperience = (experience = {}) => {
  const min = Number.isFinite(experience?.MinExp) ? experience.MinExp : null
  const max = Number.isFinite(experience?.MaxExp) ? experience.MaxExp : null

  if (min != null && max != null) {
    if (min === max) return `${min} year${min === 1 ? '' : 's'}`
    return `${min}-${max} years`
  }

  if (min != null) return `${min}+ years`
  if (max != null) return `Up to ${max} years`
  return null
}

const parseLocations = (value) => {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const extractPrimaryLocation = (value) => {
  const locations = parseLocations(value)
  return normalizeWhitespace(locations[0]?.Address) || null
}

const extractCity = (location) => normalizeWhitespace(String(location ?? '').split(',')[0]) || null

const buildPublicJobUrl = (jobIdObfuscated) => (
  jobIdObfuscated
    ? `${ORIGIN}/job/publicjobs/${jobIdObfuscated}`
    : null
)

const buildPublicHeaders = (accessToken = null) => {
  const headers = {
    Origin: ORIGIN,
    Referer: CAREER_PAGE_URL,
    'User-Agent': 'Mozilla/5.0',
    Accept: 'application/json, text/plain, */*',
  }

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  return headers
}

const defaultFetchJson = async (url, options = {}) => {
  options.signal?.throwIfAborted()
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
    signal: options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
    redirect: 'error',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const checkNative = (condition,message) => {
  if(!condition)throw Object.assign(new Error('CEAT native: '+message),{abortRetries:true})
}
const defaultFetchText = async(url,{signal}={})=>{
  signal?.throwIfAborted()
  const response=await fetch(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000),redirect:'error'})
  checkNative(response.status===200&&response.url===url,'public role response status or URL changed')
  return response.text()
}
const detailApiUrl=jobId=>{
  checkNative(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(jobId),'invalid public job ID')
  return `${API_BASE_URL}/api/publicjobs/${jobId}?fieldVisibility=CareerPage`
}
const verifyCorporateHandoff=html=>{
  const head=activeHead(html.slice(0,html.indexOf('</head>')+7)),doc=readNativeDocument(html)
  checkNative(head.titles.length===1&&head.titles[0]==='CEAT Career | Learning at CEAT | Grow at CEAT'
    &&head.metas.some(meta=>meta.property==='og:url'&&meta.content===CORPORATE_CAREERS_URL)
    &&doc.nodes(node=>node.tag==='a'&&node.attrs.href===CAREER_PAGE_URL).length===1,
    'current official corporate handoff to the declared native board is unavailable')
}
const verifyBoardIdentity=html=>{
  const head=activeHead(html)
  checkNative(head.titles.length===1&&head.titles[0]==='CEAT Limited'
    &&head.metas.some(meta=>meta.property==='og:site_name'&&meta.content==='CEAT Limited')
    &&head.metas.some(meta=>meta.property==='og:image'&&meta.content?.startsWith(`https://hiringsolutions.blob.core.windows.net/company/${CAREER_PAGE_ID}/`)),
    'current declared native board employer or organization identity changed')
}

export const extractJobDetail=(record,listing)=>{
  checkNative(record?.JobId===listing.jobId&&normalizeWhitespace(record.JobTitle)===listing.title
    &&record.OrgDetails?.OrgID===CAREER_PAGE_ID&&record.OrgDetails?.OrgName==='CEAT Limited'
    &&record.JobCode===listing.requisitionId&&buildPublicJobUrl(record.JobIdObfuscated)===listing.sourceUrl
    &&extractPrimaryLocation(record.Location)===listing.location,'public detail identity, employer or workplace contradicts listing')
  checkNative(record.IsPublic===true&&record.JobStatus==='Active'&&record.PublishedJobBoards?.includes('CAREERPAGE'),
    'role is not an active public career-page vacancy')
  const description=extractActiveDescription(record.JobDescriptionV2||record.JobDescription)
  checkNative(description&&description.length>=150,'full public role description unavailable; listing preview cannot replace it')
  const sections=[description,...[record.RolesAndResponsibilitiesV2,record.EligibilityV2].map(value=>extractActiveDescription(value)).filter(Boolean)]
  return {...listing,jobDescription:sections.join('\n\n'),sourceDescription:sections.join('\n\n'),sourceDetailComplete:true,
    sourceDescriptionApiUrl:detailApiUrl(listing.jobId)}
}

const readPublicCountry=(html,listing)=>{
  const doc=readNativeDocument(html)
  const models=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').flatMap(node=>{
    const model=JSON.parse(node.raw)
    return Array.isArray(model['@graph'])?model['@graph']:[model]
  }).filter(model=>model['@type']==='JobPosting')
  checkNative(models.length===1,'exact public role model unavailable')
  const model=models[0],places=Array.isArray(model.jobLocation)?model.jobLocation:[model.jobLocation]
  checkNative(model.title===listing.title&&model.hiringOrganization?.name==='CEAT Limited'
    &&model.hiringOrganization?.sameAs==='https://ceat.com'&&model.datePosted===listing.postingDate?.slice(0,10),
    'public role model identity, employer or publication date contradicts listing')
  checkNative(places.length===1&&places[0]?.address?.addressLocality===listing.location
    &&typeof places[0].address.addressCountry==='string'&&places[0].address.addressCountry.trim(),
    'public role model workplace contradicts listing')
  const country=places[0].address.addressCountry.trim()
  checkNative(country==='India'||country==='IN','public role native country changed; India inventory scope requires review')
  return 'India'
}

export const extractSearchResults = (payload, { companyName = 'CEAT Limited' } = {}) =>
  (Array.isArray(payload?.Result) ? payload.Result : [])
    .map((record) => {
      const title = normalizeWhitespace(record?.JobTitle)
      const location = extractPrimaryLocation(record?.Location)
      const sourceUrl = buildPublicJobUrl(normalizeWhitespace(record?.JobIdObfuscated))

      if (!title || !location || !sourceUrl) return null

      return {
        title,
        company: companyName,
        department: normalizeWhitespace(record?.Department),
        location,
        city: extractCity(location),
        jobId: normalizeWhitespace(record?.JobId),
        requisitionId: normalizeWhitespace(record?.JobCode) || normalizeWhitespace(record?.JobId),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeWhitespace(record?.JobTypeV2) || null,
        experienceRequired: formatExperience(record?.Experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: Array.isArray(record?.Skills)
          ? record.Skills.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
          : [],
        postingDate: normalizeWhitespace(record?.PublishedDate),
        closingDate: normalizeWhitespace(record?.ExpiryDates?.CAREERPAGE),
        jobDescription: stripTags(record?.JobDescV2),
      }
    })
    .filter(Boolean)

const readListingSnapshot=payload=>{
  checkNative(Array.isArray(payload?.Result)&&Number.isSafeInteger(payload.Total)&&payload.Total>=0
    &&payload.Total===payload.Result.length,'native listing total is unavailable or truncated')
  const jobs=extractSearchResults(payload,{companyName:'CEAT Limited'})
  checkNative(jobs.length===payload.Result.length&&new Set(jobs.map(job=>job.jobId)).size===jobs.length,
    'native listing identities are missing or duplicated')
  const nativeById=new Map(payload.Result.map(row=>[row.JobId,row]))
  const signature=JSON.stringify([...jobs].sort((a,b)=>a.jobId.localeCompare(b.jobId)).map(job=>({
    ...job,nativeUpdatedDate:nativeById.get(job.jobId)?.UpdatedDate??null,
  })))
  return {total:payload.Total,jobs,signature}
}

export const createCeatScraper = () => ({
  async run(options = {}) {
    const fetchJson = options.fetchJson || defaultFetchJson
    const fetchText = options.fetchText || defaultFetchText
    const {signal}=options
    signal?.throwIfAborted()
    verifyCorporateHandoff(await fetchText(CORPORATE_CAREERS_URL,{signal}))
    signal?.throwIfAborted()
    verifyBoardIdentity(await fetchText(CAREER_PAGE_URL,{signal}))
    signal?.throwIfAborted()

    const tokenPayload = await fetchJson(NOAUTH_TOKEN_URL, {
      method: 'GET',
      headers: buildPublicHeaders(),
      signal,
    })
    signal?.throwIfAborted()
    checkNative(typeof tokenPayload?.access_token==='string'&&tokenPayload.access_token,'anonymous public token unavailable')

    const listingRequest = {
      method: 'POST',
      headers: {
        ...buildPublicHeaders(tokenPayload?.access_token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(LIVE_FILTER_BODY),
      signal,
    }
    const listingsPayload = await fetchJson(FILTERED_JOBS_URL,listingRequest)
    signal?.throwIfAborted()
    const opening=readListingSnapshot(listingsPayload),listings=opening.jobs,jobs=[]
    for(const listing of listings){
      signal?.throwIfAborted()
      const detail=await fetchJson(detailApiUrl(listing.jobId),{method:'GET',headers:buildPublicHeaders(tokenPayload.access_token),signal})
      signal?.throwIfAborted()
      const job=extractJobDetail(detail,listing)
      const html=await fetchText(listing.sourceUrl,{signal})
      signal?.throwIfAborted()
      job.country=readPublicCountry(html,listing)
      jobs.push(job)
    }
    const closing=readListingSnapshot(await fetchJson(FILTERED_JOBS_URL,listingRequest))
    signal?.throwIfAborted()
    checkNative(closing.total===opening.total&&closing.signature===opening.signature,
      'declared native board closing total, role identities or listing metadata changed')
    return attachInventoryEvidence(jobs.map((job) => ({
      ...job,
      source: 'ceat',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
      sourceListingComplete:true,
      lifecycleCleanupAllowed:true,
      sourceInventoryScope:'declared-first-party-CEAT-TurboHire-careers-board',
    })),{status:jobs.length?'complete-inventory':'verified-empty',surface:CAREER_PAGE_URL,firstParty:true,listingComplete:true,pagesFetched:5+jobs.length*2,
      reportedTotal:opening.total,indiaFacetCount:jobs.length,verifiedAt:new Date().toISOString(),
      reason:'Declared first-party CEAT TurboHire careers board: current corporate handoff, board identity, opening/closing Total and unique role identities, full native details and India workplaces verified'})
  },
})

export const run = async (options={}) => createCeatScraper().run(options)
