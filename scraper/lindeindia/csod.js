import { extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const ORIGIN = 'https://linde.csod.com'
const CLOUD = 'https://eu-fra.api.csod.com/rec-job-search/external/jobs'
const SITE = `${ORIGIN}/services/x/career-site/v1/careersites/25?cultureId=1`
const DICTIONARY = `${ORIGIN}/services/x/core-customfields-service/v1/CustomFields?fieldIds=140&fieldIds=139&fieldIds=251&respectAvailablity=false&cultureId=1`
const LEGAL = new Map([[1375,'Linde India Limited'],[1131,'Linde South Asia Services Pvt. Ltd.'],[1132,'Praxair India Private Limited'],[2266,'Linde Global Support Services Pvt. Ltd']])
const requireNative = (ok, message) => { if (!ok) throw new Error(`Linde India CSOD ${message}`) }
const norm = value => String(value ?? '').replace(/\s+/g,' ').trim()
const sameUrl = (actual, expected) => {
  try { const a = new URL(actual), b = new URL(expected); return a.href === b.href && a.protocol === 'https:' && !a.username && !a.password } catch { return false }
}
const calendar = (value, optional = false) => {
  if (optional && value === '-') return null
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value ?? '')
  requireNative(match, 'public calendar date is missing or malformed')
  const [,m,d,y] = match.map(Number), date = new Date(Date.UTC(y,m-1,d))
  requireNative(date.getUTCFullYear() === y && date.getUTCMonth() === m-1 && date.getUTCDate() === d, 'public calendar date is invalid')
  return date.toISOString()
}
const locations = rows => {
  requireNative(Array.isArray(rows) && rows.length > 0, 'India locations are missing')
  return rows.map(row => {
    requireNative(row?.country === 'IN', 'explicit India country is required')
    return `${norm(row.city)}|${norm(row.state)}|IN`
  }).sort()
}
const sameLocations = (a,b) => JSON.stringify(locations(a)) === JSON.stringify(locations(b))

// Read the active anonymous public bootstrap; never execute client JavaScript or
// retain a captured session token across runs.
export const loadCsodContext = async ({fetchPage,fetchJson,boardUrl,signal}) => {
  signal?.throwIfAborted()
  const response = await fetchPage(boardUrl,{signal})
  signal?.throwIfAborted()
  requireNative(response?.status === 200 && sameUrl(response.url,boardUrl), 'official board response identity changed')
  const document = readNativeDocument(response.html)
  const scripts = document.nodes(n => n.tag === 'script' && !n.attrs.src).map(n => n.raw || '')
  const contexts = scripts.flatMap(s => [...s.matchAll(/csod\.context\s*=\s*(\{[\s\S]*?\})\s*;/g)].map(m => JSON.parse(m[1])))
  const routes = scripts.flatMap(s => [...s.matchAll(/var\s+csodPlayerRouteInfo\s*=\s*(\{[\s\S]*?\})\s*;/g)].map(m => JSON.parse(m[1])))
  requireNative(contexts.length === 1 && routes.length === 1, 'anonymous client bootstrap is missing or ambiguous')
  const context = contexts[0], route = routes[0]
  requireNative(document.nodes(n=>n.tag === 'div' && n.attrs.id === 'cs-root').length === 1
    && context.corp === 'linde' && context.cultureID === 1 && context.cultureName === 'en-US'
    && context.package === 'career-site' && context.page === 'home'
    && /^\/player-career-site\/\d+\.\d+\.\d+\/$/.test(context.basePath)
    && context.endpoints?.cloud === 'https://eu-fra.api.csod.com/' && context.endpoints?.api === '/'
    && typeof context.token === 'string' && context.token.length > 0
    && route.package === 'career-site' && route.page === 'home' && route.cid === '25'
    && route.routeInfo?._rest_ === new URL(boardUrl).search
    && document.nodes(n=>n.tag === 'script' && n.attrs.src === context.basePath+'pages/home.controls.js').length === 1,
  'anonymous client tenant, culture or site identity changed')
  const headers = {Authorization:`Bearer ${context.token}`,Accept:'application/json','Content-Type':'application/json'}
  const get = async url => {signal?.throwIfAborted();const payload=await fetchJson(url,{method:'GET',headers,signal});signal?.throwIfAborted();return payload}
  const site = await get(SITE), dictionary = await get(DICTIONARY)
  const data = site?.data
  requireNative(site?.status === 0 && data?.id === 25 && data.active === true && data.defaultCultureId === 1
    && data.currentLanguage?.cultureId === 1 && data.currentLanguage?.cultureName === 'en-US'
    && data.allowedLanguages?.some(l=>l.cultureId === 1)
    && data.header?.imagePath?.startsWith('/clientimg/linde/logo/Careersite_Linde_plc_logo_')
    && data.customFields?.some(f=>f.fieldId === 251), 'active native career site identity changed')
  const fields = dictionary?.data?.filter(f=>f.id === 251) ?? []
  requireNative(dictionary?.status === 0 && fields.length === 1 && fields[0].name === 'Legal entity'
    && [...LEGAL].every(([id,title])=>fields[0].items?.filter(i=>i.id === id && i.title === title && i.selectable === true).length === 1),
  'native legal employer dictionary changed')
  return {headers,get}
}

const recover = async (record, ids, get, now, signal) => {
  const id = record?.requisitionId, title = norm(record?.displayJobTitle)
  requireNative(Number.isSafeInteger(id) && id > 0 && title, 'listing role identity is missing')
  locations(record.locations)
  const postingDate = calendar(record.postingEffectiveDate), closingDate = calendar(record.postingExpirationDate,true)
  requireNative(!closingDate || closingDate >= postingDate, 'public closing date precedes publication')
  const payload = await get(`${ORIGIN}/services/x/job-requisition/v2/requisitions/${id}/jobDetails?cultureId=1`)
  const detail = payload?.data, applyUrl = `${ORIGIN}/ux/ats/careersite/25/home/requisition/${id}?c=linde`
  requireNative(payload?.status === 0 && detail?.ref === `req${id}` && norm(detail.displayTitle) === title
    && detail.requisitionStatusId === 2 && detail.allowApply === true && sameUrl(detail.companyApplyUrl,applyUrl)
    && Array.isArray(detail.additionalLocations) && sameLocations(record.locations,[detail.primaryLocation,...detail.additionalLocations]),
  'detail role, open status, application or India location conflicts with listing')
  const responsibilities = extractActiveDescription(detail.externalDescription)
  requireNative(responsibilities, 'native responsibilities are missing')
  const ad = await get(`${ORIGIN}/Services/API/ATS/CareerSite/25/JobRequisitions/${id}?useMobileAd=false&cultureId=1`)
  requireNative(ad?.status === 200 && ad.totalRecords === 1 && ad.data?.length === 1 && ad.data[0].items?.length === 1, 'public ad envelope is malformed')
  const fields = ad.data[0].items[0].fields
  requireNative(fields?.id === id && fields.reqId === `req${id}` && norm(fields.title) === title && fields.location === detail.primaryLocation.title,
    'public ad role identity conflicts with detail')
  const document = readNativeDocument(fields.ad)
  const headers = document.nodes(n=>n.tag === 'p' && document.hasClass(n,'header_job_title'))
  const legacy = ['above-job-title','job-title','below-job-title'].map(cls=>document.nodes(n=>n.tag === 'p' && document.hasClass(n,cls)))
  let employers
  if (headers.length === 1 && legacy.every(nodes=>nodes.length === 0)) {
    const header = document.text(headers[0])
    const roles = headers[0].children.filter(node=>typeof node !== 'string' && node.tag === 'span' && !node.inert)
    requireNative(roles.length === 1 && document.text(roles[0]) === title && header.includes('India |')
      && new RegExp(`Reference Code: req${id}(?:\\s|$)`).test(header), 'public ad reference or content header conflicts with detail')
    employers = ids.filter(key=>header.startsWith(LEGAL.get(key)+' | Business Area:'))
  } else {
    requireNative(headers.length === 0 && legacy.every(nodes=>nodes.length === 1), 'public ad identity header is missing or ambiguous')
    const [employer,role,location] = legacy.map(nodes=>document.text(nodes[0]))
    requireNative(role === title && new RegExp(`(?:^|[ ,])India\\s*\\|\\s*req${id}$`).test(location), 'public ad reference or content header conflicts with detail')
    employers = ids.filter(key=>employer === LEGAL.get(key))
  }
  const description = extractActiveDescription(fields.ad)
  requireNative(employers.length === 1 && description && description.includes(responsibilities), 'public ad employer, reference or role content conflicts with detail')
  signal?.throwIfAborted()
  return {title,company:'Linde India',companyDomain:'linde.in',companyCareerPage:'https://www.lindecareers.com/en/job-locations',
    source:'lindeindia',atsPlatform:'csod',jobId:String(id),requisitionId:`req${id}`,sourceUrl:applyUrl,applyUrl,link:applyUrl,
    city:norm(detail.primaryLocation.city)||null,state:norm(detail.primaryLocation.state)||null,country:'India',
    location:record.locations.map(l=>[norm(l.city),norm(l.state),'India'].filter(Boolean).join(', ')).join('; '),
    postingDate,closingDate,sourceClosingDateIsExact:false,scrapedAt:now(),sourceLegalEmployer:LEGAL.get(employers[0]),
    jobDescription:description,sourceDescription:description,jobDescriptionHtml:fields.ad}
}

export const loadCsodBranch = async ({context,ids,fetchJson,pageSize,maxPages,maxJobs,detailConcurrency,now,signal}) => {
  const jobs = [], seen = new Set()
  let total = null, pagesFetched = 0, complete = false
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    signal?.throwIfAborted()
    const body = {careerSiteId:25,careerSitePageId:25,pageNumber,pageSize,cultureId:1,searchText:'',cultureName:'en-US',
      states:[],countryCodes:['in'],cities:[],placeID:'',radius:null,postingsWithinDays:null,customFieldCheckboxKeys:[],
      customFieldDropdowns:[{id:251,options:ids}],customFieldRadios:[]}
    const payload = await fetchJson(CLOUD,{method:'POST',headers:context.headers,body:JSON.stringify(body),signal})
    signal?.throwIfAborted()
    const data = payload?.data, offset = (pageNumber-1)*pageSize
    requireNative(payload?.status === 'Success' && Number.isSafeInteger(data?.totalCount) && data.totalCount >= 0
      && (total === null || total === data.totalCount) && Array.isArray(data.requisitions)
      && data.requisitions.length === Math.min(pageSize,Math.max(0,data.totalCount-offset)), 'listing page does not reconcile with its stable total')
    total = data.totalCount; pagesFetched += 1
    for (const row of data.requisitions) {requireNative(Number.isSafeInteger(row.requisitionId) && !seen.has(row.requisitionId),'listing identity is missing or repeated');seen.add(row.requisitionId)}
    const selected = Number.isFinite(maxJobs) ? data.requisitions.slice(0,Math.max(0,maxJobs-jobs.length)) : data.requisitions
    let cursor = 0, failure = null
    const recovered = new Array(selected.length)
    await Promise.allSettled(Array.from({length:Math.min(detailConcurrency,selected.length)},async()=>{
      while (cursor < selected.length && !failure) {const index=cursor++;try{recovered[index]=await recover(selected[index],ids,context.get,now,signal)}catch(error){failure ??= error}}
    }))
    if (failure) throw failure
    jobs.push(...recovered)
    if (seen.size === total && selected.length === data.requisitions.length) {complete = true;break}
    if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) break
  }
  return {jobs,total,pagesFetched,complete}
}
