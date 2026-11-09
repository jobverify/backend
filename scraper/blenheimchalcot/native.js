import { runApiPortalScraper } from '../../scraper-support/apiPortal/engine.js'
import { expandApiPortalProviderTemplate } from '../../scraper-support/providers/apiPortalTemplates.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CAREERS_URL = 'https://blenheimchalcot.com/careers'
const API = 'https://boards-api.greenhouse.io/v1/boards/'
const BOARDS = [['blenheimchalcot', 'Blenheim Chalcot'], ['blenheimchalcotindia', 'Blenheim Chalcot India']]
const check = (ok, message) => { if (!ok) throw new Error(`Blenheim Chalcot native: ${message}`) }
const text = value => typeof value === 'string' && value.trim().length > 0
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b)
const upstream = value => {
  check(value && typeof value === 'object' && !Array.isArray(value), 'malformed upstream payload')
  check(!(value.success === false || value.ok === false || value.failed === true || value.hasError === true || value.error
    || (Array.isArray(value.errors) ? value.errors.length : value.errors)
    || /^(error|failed|failure|unavailable)$/i.test(String(value.status || ''))
    || Number(value.status) >= 400 || Number(value.statusCode) >= 400), 'upstream error response')
}
const instant = (value, field) => {
  if (value == null || value === '') return null
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value), `${field} date precision must be a native instant`)
  const [year,month,day] = value.slice(0,10).split('-').map(Number)
  const date = new Date(Date.UTC(year, month-1, day))
  check(date.getUTCFullYear() === year && date.getUTCMonth() === month-1 && date.getUTCDate() === day && Number.isFinite(Date.parse(value)), `${field} date invalid`)
  return value
}
const business = row => {
  check(Array.isArray(row.metadata), 'business metadata missing')
  const matches = row.metadata.filter(m => m?.name === 'Business')
  check(matches.length === 1 && text(matches[0].value), 'business identity missing or conflicting')
  return matches[0].value
}
const regions = new Intl.DisplayNames(['en'], { type: 'region' })
const foreignNames = new Set(['United States of America','USA','U.S.A.','UK','UAE','London','Austin','Toronto'])
for (let a=65;a<=90;a++) for(let b=65;b<=90;b++) {
  const code=String.fromCharCode(a,b),name=regions.of(code)
  if (name && name!==code && code!=='IN' && !['ZZ','EU','UN','XA','XB','QO'].includes(code)) foreignNames.add(name)
}
const foreign = new RegExp(`(?:^|[^\\p{L}])(?:${[...foreignNames].map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})(?=$|[^\\p{L}])`,'iu')
const india = /\bindia\b|\bmumbai\b|\bnavi mumbai\b|\bbengaluru\b|\bbangalore\b|\bhyderabad\b|\bpune\b|\bchennai\b|\bdelhi\b|\bnoida\b|\bgurugram\b|\bgurgaon\b/i
function scope(row) {
  check(row.location && text(row.location.name) && Array.isArray(row.offices), 'country/location contract missing')
  const labels=[row.location.name,...row.offices.map(o=>{check(o && typeof o==='object' && !Array.isArray(o) && (o.location==null || typeof o.location==='string'), 'office country/location malformed');return o.location}).filter(text)]
  const hasIndia=labels.some(l=>india.test(l)), hasForeign=labels.some(l=>foreign.test(l))
  const countries=[row.country,row.country_code,row.location.country,row.location.country_code,...row.offices.flatMap(o=>[o.country,o.country_code])].filter(v=>v!=null)
  check(countries.every(text), 'country type invalid')
  const nativeIndia=countries.some(v=>/^(IN|IND|India)$/i.test(v))
  const nativeForeign=countries.some(v=>!/^(IN|IND|India)$/i.test(v))
  if ((hasIndia||nativeIndia) && (hasForeign||nativeForeign)) return 'country-conflict'
  if (hasIndia||nativeIndia) return row.offices.some(o=>!text(o.location)) ? 'country-unknown' : 'india'
  return hasForeign||nativeForeign ? 'foreign' : 'country-unknown'
}
function identity(row, board) {
  check(!['active','published','is_published'].some(k=>row[k]===false)
    && !(row.visibility!=null && !/^(public|published)$/i.test(String(row.visibility)))
    && !(row.status!=null && !/^(open|active|published)$/i.test(String(row.status))), 'native public visibility/status conflict')
  check(row.company_name===BOARDS.find(([token])=>token===board)?.[1], 'listing/detail native company identity conflict')
  check(Number.isSafeInteger(row.id) && row.id>0 && text(row.title), 'posting identity/title invalid')
  check(Number.isSafeInteger(row.internal_job_id) && row.internal_job_id>0 && text(row.requisition_id), 'internal/requisition identity missing')
  check(text(row.absolute_url), 'URL identity missing')
  const url=new URL(row.absolute_url)
  check(url.protocol==='https:' && ['boards.greenhouse.io','job-boards.greenhouse.io'].includes(url.hostname)
    && !url.username && !url.password && !url.search && !url.hash
    && url.pathname===`/${board}/jobs/${row.id}`, 'URL board/posting identity mismatch')
  business(row)
}
function description(value) {
  check(text(value), 'role description missing')
  const plain=value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,' ').replace(/&(?:amp;)?nbsp;/g,' ').replace(/\s+/g,' ').trim()
  check(plain.length>=200 && /the role|key responsibilities|about you|what (?:are we|we.?re) looking for/i.test(plain)
    && !/^(?:machine learning placeholder|description unavailable|job description pending)/i.test(plain)
    && !/(?:\.\.\.|…|read more|view full description)\s*$/i.test(plain), 'role content missing, boilerplate or truncated')
}
function listing(value, board) {
  upstream(value)
  check(Array.isArray(value.jobs) && value.jobs.length<=500, 'listing inventory missing or exceeds bounded board limit')
  check(Number.isSafeInteger(value.meta?.total) && value.meta.total>=0 && value.meta.total===value.jobs.length, 'listing total/count incomplete')
  check(!['next','next_page','has_more','hasMore','pagination'].some(k=>value[k]!=null || value.meta[k]!=null)
    && !value.links?.next, 'unsupported pagination continuation')
  const ids=new Map()
  for(const row of value.jobs) {
    check(row && typeof row==='object' && !Array.isArray(row), 'malformed listing row')
    identity(row,board)
    check(!ids.has(row.id) || equal(ids.get(row.id),row), 'duplicate posting identity conflict')
    ids.set(row.id,row)
    scope(row)
  }
  return value
}
function detail(value,row,board,company) {
  upstream(value); identity(value,board)
  check(value.company_name===company, 'company identity conflict')
  for(const field of ['id','title','absolute_url','internal_job_id','requisition_id','location','offices','metadata']) check(equal(value[field],row[field]), `${field} identity/business/country conflict`)
  check(scope(value)==='india', 'detail country conflict')
  description(value.content)
  check(value.content===row.content, 'listing/detail role content changed')
  for(const field of ['first_published','updated_at','created_at','application_deadline']) instant(value[field],field)
  return value
}
function portfolioAssignments(row) {
  const assignments=[]
  const add=(name,evidence)=>{if(!assignments.some(a=>a.name===name))assignments.push({name,evidence,legalEmployerQualified:false})}
  const label=business(row)
  if (!BOARDS.some(([,name])=>name===label)) add(label, 'native metadata.Business')
  for(const [name,pattern] of [['Agilisys',/join our growing team at Agilisys/i],['Salary Finance',/As a Customer Service Associate at Salary Finance|One of our FinTech ventures, Salary Finance/i]]) {
    const match=row.content.match(pattern)
    if(match)add(name,match[0])
  }
  return assignments
}

export async function runNative({ fetchJson=(url,options)=>fetchJsonWithRetry(url,{...options,timeoutMs:20000,label:'blenheimchalcot'}),
  fetchText=async url=>{const response=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000)});check(response.ok,`official handoff HTTP ${response.status}`);return response.text()}, now=new Date().toISOString(), signal }={}) {
  instant(now,'observation')
  const get=async (url,type='json')=>{signal?.throwIfAborted();const result=await (type==='text'?fetchText:fetchJson)(url,{method:'GET',signal});signal?.throwIfAborted();return result}
  const html=await get(CAREERS_URL,'text')
  check(typeof html==='string','official corporate HTML missing')
  const moduleURL=html.match(/https:\/\/blenheimchalcot\.com\/hubfs\/hub_generated\/module_assets\/[^"'\s]+module_Job_Listings\.min\.js/)?.[0]
  check(moduleURL,'official module handoff missing')
  const module=await get(moduleURL,'text')
  const endpoints=[...new Set(module.match(/https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/[a-z0-9]+\/jobs\?content=true/g))]
  check(endpoints.length===2 && BOARDS.every(([b])=>endpoints.includes(`${API}${b}/jobs?content=true`)) && /combinedJobs=\[\.\.\.ukData\.jobs,\.\.\.indiaData\.jobs\]/.test(module), 'official module board handoff changed')
  const jobs=[], reasons=[], boardEvidence=[], observed=new Map()
  for(const [board,company] of BOARDS) {
    const boardMeta=await get(`${API}${board}`);upstream(boardMeta);check(boardMeta.name===company,'board company identity conflict')
    let rawList
    const details=new Map()
    const provider=expandApiPortalProviderTemplate({source:'blenheimchalcot',companyName:company,companyCareerPage:CAREERS_URL,countryFilter:'India',atsPlatform:'greenhouse',template:'greenhouse',templateOptions:{boardToken:board},config:{
      pagination:{maxPages:1},mapping:{postingDate:'first_published'},recordFilter:{include:[{field:'_selected',pattern:'^true$'}]},
      detail:{enabled:true,required:true,concurrency:1,urlTemplate:`${API}${board}/jobs/{{jobId}}?questions=false`,mapping:{jobDescription:'content'}}
    }})
    const boardJobs=await runApiPortalScraper({provider,fetchJson:async url=>{
      if(url===`${API}${board}/jobs?content=true`) {
        rawList=listing(await get(url),board)
        return {...rawList,jobs:rawList.jobs.map(row=>{const country=scope(row);if(!['india','foreign'].includes(country))reasons.push(`${board}:${row.id}:${country}`);return {...row,_selected:country==='india'}})}
      }
      const id=Number(new URL(url).pathname.split('/').at(-1)),row=rawList.jobs.find(r=>r.id===id)
      check(row && url===`${API}${board}/jobs/${id}?questions=false`,'unexpected role URL')
      const value=detail(await get(url),row,board,company);details.set(id,value);return value
    }})
    const evidence=readInventoryEvidence(boardJobs)
    if(!evidence?.listingComplete)reasons.push(`${board}:shared-inventory-incomplete`)
    check(equal(rawList,listing(await get(`${API}${board}/jobs?content=true`),board)), 'listing changed during closure')
    for(const [id,value] of details) check(equal(value,detail(await get(`${API}${board}/jobs/${id}?questions=false`),rawList.jobs.find(r=>r.id===id),board,company)), 'role detail changed during closure')
    boardEvidence.push({board,company,reportedTotal:rawList.meta.total,publicPostingIDs:rawList.jobs.map(r=>r.id),selectedPublicPostingIDs:[...details.keys()]})
    for(const job of boardJobs) {
      const value=details.get(job.jobId)
      if(observed.has(job.jobId)){check(equal(observed.get(job.jobId),value),'cross-board duplicate posting identity conflict');continue}
      observed.set(job.jobId,value)
      const published=instant(value.first_published,'first_published'),closing=instant(value.application_deadline,'application_deadline')
      jobs.push({...job,postingDate:published??undefined,company:value.company_name,sourceDescription:value.content,jobDescription:value.content,scrapedAt:now,
        nativeBoard:board,nativeCompanyName:value.company_name,nativeBusiness:business(value),nativePortfolioAssignments:portfolioAssignments(value),nativeLegalEmployer:null,
        nativeInternalJobId:value.internal_job_id,nativeRequisitionId:value.requisition_id,nativeLocationOriginal:value.location,nativeOfficesOriginal:value.offices,nativeListingOriginal:rawList.jobs.find(r=>r.id===job.jobId),
        nativeFirstPublicationDate:published,nativePublicationDate:published,nativePublicationDateSource:published?'Greenhouse.first_published':null,nativePublicationDatePrecision:published?'instant':null,
        nativeCreatedAt:value.created_at??null,nativeUpdatedAt:value.updated_at??null,nativeClosingDate:closing,nativeClosingDatePrecision:closing?'instant':null,closingDate:closing,
        ...(published?{postedAt:published}:{}),publicationDateQualified:Boolean(published),nativeDateUnknown:!published,nativePostingStatus:'listed-public-Job-Board-API',
        sourceDetailComplete:true,sourceDetailStatus:'public-native-full-JD',sourceListingComplete:false,sourceScopeComplete:false,
        applicationAccessValidated:false,applicationEligibilityQualified:false,applicationSubmitted:false,applicationAccess:'configured-native-URL-only',
      })
    }
  }
  const reportedTotal=boardEvidence.reduce((n,b)=>n+b.reportedTotal,0)
  for(const job of jobs)Object.assign(job,{sourceObservedNativeRecords:reportedTotal,sourceObservedNativeIndiaRecords:jobs.length,sourceCheckedNativeEnumerationComplete:reasons.length===0,sourceNativeBoardEvidence:boardEvidence,sourceNativeScopeConflicts:reasons})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched:4,reportedTotal,indiaFacetCount:jobs.length,verifiedAt:now,
    reason:`advertised-two-board-union-rechecked-whole-company-employer-coverage-unknown${reasons.length?':'+[...new Set(reasons)].join(','):''}`})
}
