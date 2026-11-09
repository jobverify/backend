import { runWorkdayScraper, buildWorkdayAppliedFacets, buildWorkdayDetailApiUrl, extractWorkdayStructuredDetail, resolveWorkdayDetailFetchConcurrency } from '../myworkday/engine.js'
import { workdayRequestScheduler } from '../myworkday/requestScheduler.js'
import { loadConfig } from '../utils/loadConfig.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { toPlainText } from '../detailExtractors/shared.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { isJobInPublicLocationScope } from '../../src/utils/publicJobLocationScope.js'
import { extractActiveDescription, decodeNativeEntities } from '../utils/activeNativeHtml.js'
import { WORKDAY_COUNTRY_INVENTORY_PROOF, hasRecognizedWorkdayCountry } from '../myworkday/countryInventoryProof.js'

const INDIA = 'c4f78be1a8f14da0ab49ce1162348a5e'
const FOREIGN_COUNTRY_CODES=new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '))
// Codes that are also Indian state/territory abbreviations are ambiguous in
// an India address. Do not invent a foreign country from those abbreviations.
const INDIA_STATE_CODES=new Set('AN AP AR AS BR CG CH DD DL DN GA GJ HP HR JH JK KA KL LA LD MH ML MN MP MZ NL OD OR PB PY RJ SK TN TR TS UK UP UT WB'.split(' '))
const explicitForeignCode=label=>{
  // "No. 2" identifies a building number. Keep a real country suffix
  // authoritative, even when the address starts with that abbreviation.
  const buildingNumber=/^no\s*[.:]\s*#?\s*\d/i.test(label)
  const prefix=buildingNumber?'':label.match(/^([a-z]{2})\s*[-,.:]\s*/i)?.[1]
  const code=(label.match(/(?:,\s*|\(\s*)([a-z]{2})\)?\s*$/i)?.[1]||prefix||'').toUpperCase()
  return FOREIGN_COUNTRY_CODES.has(code)&&!INDIA_STATE_CODES.has(code)
}
const proof = (condition, message) => { if (!condition) throw new Error('Verified Workday board union: '+message) }
const hasFailureEnvelope = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return true
  return Object.entries(value).some(([key, field]) => {
    const name = key.toLowerCase().replace(/[_\s-]/g,'')
    if (['error','errors','errorcode','errormessage','exception','fault'].includes(name)) return true
    if (name === 'success' && field !== true) return true
    if (['status','statuscode','httpstatus','httpstatuscode'].includes(name) && typeof field !== 'object')
      return !['200','ok','success','successful'].includes(String(field).toLowerCase())
    return ['meta','metadata','response','result'].includes(name) && field != null && hasFailureEnvelope(field)
  })
}
const locationKey = value => String(value).toLowerCase().replace(/\b(?:india|ind|in)\b/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim()
const normalizeSpace = value => String(value).replace(/\s+/g,' ').trim()
const date = (value, now, publication=false) => {
  proof(typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value),'native date unavailable')
  const parsed=new Date(value+'T00:00:00.000Z')
  proof(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value,'invalid native calendar date')
  proof(!publication || parsed.getTime()<=new Date(now).getTime(),'future native publication')
  return parsed.toISOString()
}
const canonical = (value, board) => {
  proof(typeof value==='string','native canonical unavailable')
  const url=new URL(value),base=new URL(board.baseUrl)
  const pathname=url.pathname.replace(/^\/[a-z]{2}-[A-Z]{2}\//,'/')
  proof(url.origin===base.origin && !url.search && !url.hash && !url.username && !url.password
    && pathname.startsWith('/'+board.site+'/job/'),'native canonical board mismatch')
  return url.origin+pathname
}
const defaultJson = async (url,init,options) => {
  options.signal?.throwIfAborted()
  const release=await (options.requestScheduler||workdayRequestScheduler).acquire(url,{signal:options.signal,kind:'listing'})
  try {
    const signal=options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(options.requestTimeoutMs||25000)]) : AbortSignal.timeout(options.requestTimeoutMs||25000)
    const request={...init,headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':'Mozilla/5.0'},signal,redirect:'error'}
    let payload
    if (options.nativeFetchJson) payload=await options.nativeFetchJson(url,request)
    else {
      const response=await fetch(url,request)
      signal.throwIfAborted()
      proof(response.status===200,`native HTTP ${response.status}`)
      payload=await response.json()
    }
    signal.throwIfAborted()
    if (hasFailureEnvelope(payload)) throw Object.assign(new Error('Verified Workday board union: native error envelope'), {
      abortRetries: true, failureKind: 'parser_or_contract_error', softFailure: true, upstreamOutage: false,
    })
    return payload
  } finally { release() }
}

const fetchClosingDetails = async (jobs,config,options) => {
  const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
  const payloads=new Array(jobs.length)
  let next=0
  const workers=Array.from({length:Math.min(jobs.length,resolveWorkdayDetailFetchConcurrency(process.env.WORKDAY_DETAIL_FETCH_CONCURRENCY,config.detailFetchConcurrency))},async()=>{
    try {
      while(next<jobs.length){
        signal.throwIfAborted()
        const index=next++,url=buildWorkdayDetailApiUrl(jobs[index].link,config.jobsApiUrl)
        proof(url,'native detail URL unavailable')
        payloads[index]=await defaultJson(url,{}, {...options,signal})
      }
    } catch(error) { controller.abort(error); throw error }
  })
  const settled=await Promise.allSettled(workers),failed=settled.find(result=>result.status==='rejected')
  if(failed)throw failed.reason
  return payloads
}

// Listing and geography stay in the existing Workday engine. This layer only
// reconciles explicitly supplied official boards and checks their live details
// before joining requisitions. It never discovers or guesses an employer site.
export async function runVerifiedWorkdayBoardUnion({source,company,boards,employerPattern,requireEmployer=true,completeSourceScope=true,scopeReason,allowUnresolvedCountryScope=false},options={}) {
  const now=options.now ? options.now() : new Date().toISOString()
  proof(Number.isFinite(new Date(now).getTime()),'invalid current time')
  const nativeJson=(url,init={})=>defaultJson(url,init,options)
  const unique=new Map(),requisitions=new Map(),inventories=[],boardPostings=[]
  let duplicateCount=0
  for(const board of boards){
    options.signal?.throwIfAborted()
    const config=loadConfig(board.scraperDir)
    proof(config.listingStrategy==='jobs-api' && typeof config.jobsApiUrl==='string','explicit native listing config missing')
    const api=new URL(config.jobsApiUrl),base=new URL(board.baseUrl)
    proof(api.origin===base.origin && api.pathname===`/wday/cxs/${board.tenant}/${board.site}/jobs` && !api.search,'native API board mismatch')
    const jobs=await runWorkdayScraper({...options,source,company,baseUrl:board.baseUrl,scraperDir:board.scraperDir,boardIdentityVerified:true})
    const evidence=readInventoryEvidence(jobs)
    const countryProof=jobs[WORKDAY_COUNTRY_INVENTORY_PROOF]
    const partialCountryProof=allowUnresolvedCountryScope===true && completeSourceScope===false
      && config.retainProvenIndiaOnUnresolvedLocations===true && config.locationCountry==null
      && config.inventoryScope==='complete-board-country-proof'
      && evidence?.status==='coverage-gap' && evidence.listingComplete===false
      && countryProof?.boardReceipt?.board && countryProof.initial.count===evidence.reportedTotal
      && countryProof.closing.count===evidence.reportedTotal && countryProof.initial.sha256===countryProof.closing.sha256
      && Array.isArray(countryProof.unresolvedRoles) && countryProof.unresolvedRoles.length>0
    proof(evidence?.firstParty===true && (evidence.listingComplete===true || partialCountryProof) && evidence.pagesFetched>=1
      && Number.isSafeInteger(evidence.reportedTotal) && evidence.reportedTotal>=0,'incomplete native board inventory')
    proof(config.locationCountry==null || config.locationCountry===INDIA,'unverified configured country facet')
    proof(!config.locationCountry || jobs.length===evidence.reportedTotal,'selected India facet and native India details disagree')
    const listingRoles=countryProof?.listingRoles || (jobs.length===evidence.reportedTotal
      ? jobs.map(job=>({url:job.link,bulletFields:[job.requisitionId]})) : null)
    proof(boards.length===1 || Array.isArray(listingRoles),'cross-board complete listing identities unavailable')
    boardPostings.push({board,listingRoles:listingRoles||[],indiaUrls:new Set(jobs.map(job=>canonical(job.link,board)))})
    const facets=buildWorkdayAppliedFacets(board.baseUrl,config.locationCountry,config.countryFacetParameter)
    const recheck=await nativeJson(config.jobsApiUrl,{method:'POST',body:JSON.stringify({appliedFacets:facets,limit:20,offset:0,searchText:config.searchText||''})})
    proof(recheck.total===evidence.reportedTotal && Array.isArray(recheck.jobPostings)
      && recheck.jobPostings.length===Math.min(20,recheck.total),'native total changed or incomplete first page')
    for (const row of recheck.jobPostings) {
      proof(typeof row.externalPath === 'string' && /^\/job\/[^?#]+$/.test(row.externalPath), 'invalid native recheck identity')
      const url = new URL('/'+board.site+row.externalPath,board.baseUrl).href
      const job = jobs.find(job => canonical(job.link,board) === url)
      // Global boards also contain foreign rows omitted from the India output.
      if (!job) { proof(!config.locationCountry && jobs.length < recheck.total,'native listing identities changed'); continue }
      proof(row.title === job.title && (row.bulletFields == null || Array.isArray(row.bulletFields)), 'native listing title changed')
      const ids = (row.bulletFields || []).filter(value => typeof value === 'string'
        && /^(?:[A-Z]{1,6}[A-Z0-9_-]*\d[A-Z0-9_-]*|\d{5,})$/i.test(value))
      proof(!ids.length || ids.includes(job.requisitionId),'native listing requisition changed')
    }
    if(!recheck.total)proof(jobs.length===0 && recheck.jobPostings.length===0,'native empty board disagrees')
    inventories.push({site:board.site,tenant:board.tenant,scope:config.locationCountry?'india-country-facet':Object.keys(facets).length?'configured-native-location-subset':'global-unfiltered',appliedFacets:facets,reportedTotal:evidence.reportedTotal,
      observedIndia:jobs.length,pagesFetched:evidence.pagesFetched,stableReportedTotal:true,
      countryScopeComplete:evidence.listingComplete===true,unresolvedCountryRoles:partialCountryProof?countryProof.unresolvedRoles:[],
      reconciliation:countryProof?{initial:countryProof.initial,closing:countryProof.closing}:null,
      explicitGlobalEmpty:Object.keys(facets).length===0&&recheck.total===0})
    for(const job of jobs)proof(job.sourceDetailComplete===true && typeof job.requisitionId==='string','native detail incomplete')
    // Keep the independent closing HTTP reads. Bounded workers share the same
    // shard pacing and capacity as enumeration and required country checks.
    const closingDetails=await fetchClosingDetails(jobs,config,options)
    for(const [index,job] of jobs.entries()){
      const payload=closingDetails[index],info=payload.jobPostingInfo,employer=payload.hiringOrganization?.name
      proof(info && info.jobPostingSiteId===board.site && typeof info.id==='string' && /^[a-f0-9]{32}$/.test(info.id)
        && info.jobReqId===job.requisitionId && info.title===job.title,'native title/requisition/board mismatch')
      proof(info.canApply===true && info.posted===true,'native application status unavailable')
      proof(canonical(info.externalUrl,board)===canonical(job.link,board)
        && info.jobPostingId===new URL(info.externalUrl).pathname.split('/').at(-1),'native canonical identity mismatch')
      const primaryCountry=info.jobRequisitionLocation?.country
      const suppliedCountries=[info.country,primaryCountry].filter(country=>country!=null)
      proof(suppliedCountries.length>0 && suppliedCountries.every(hasRecognizedWorkdayCountry),'native country fields unavailable or conflicting')
      const foreignPrimaryWithIndia=primaryCountry && primaryCountry.descriptor!=='India' && primaryCountry.id!==INDIA
        && FOREIGN_COUNTRY_CODES.has(primaryCountry.alpha2Code)
        && info.country?.descriptor===primaryCountry.descriptor && info.country.id===primaryCountry.id
        && Array.isArray(info.additionalLocations) && info.additionalLocations.some(location=>typeof location==='string'
          && isJobInPublicLocationScope({location}))
      const indiaPrimary=info.country?.descriptor==='India' && info.country.id===INDIA && hasRecognizedWorkdayCountry(info.country)
        && (primaryCountry==null || primaryCountry.descriptor==='India' && primaryCountry.id===INDIA
          && primaryCountry.alpha2Code==='IN' && hasRecognizedWorkdayCountry(primaryCountry))
      proof(foreignPrimaryWithIndia || indiaPrimary,'native India country unavailable or conflicting')
      const indiaPrimaryLabels=[info.location,...(primaryCountry==null?[]:[info.jobRequisitionLocation.descriptor])]
      proof(foreignPrimaryWithIndia || indiaPrimaryLabels.every(label=>typeof label==='string' && label.trim() && !explicitForeignCode(label)
        && isJobInPublicLocationScope({country:'India',location:label.replace(/\b(?:India|IND|IN)\b/gi,' ')})),
        'explicit foreign native primary location contradicts India country')
      proof(typeof employer==='string' && (employer.trim() ? employerPattern.test(employer) : !requireEmployer),'native employer unavailable or mismatched')
      proof(typeof info.jobDescription==='string' && hasSourceDescription({sourceDescription:info.jobDescription})
        && toPlainText(info.jobDescription)===job.sourceDescription,'native full description mismatch or missing')
      const activeDescription=extractActiveDescription(info.jobDescription)
      proof(activeDescription && normalizeSpace(activeDescription)===normalizeSpace(decodeNativeEntities(toPlainText(info.jobDescription))),
        'native description is hidden, inert or placeholder content')
      const allDetailLocations=extractWorkdayStructuredDetail(payload)?.locations
      const detailLocations=foreignPrimaryWithIndia ? allDetailLocations?.filter(location=>isJobInPublicLocationScope({location})) : allDetailLocations
      proof(Array.isArray(detailLocations) && detailLocations.length>0
        && detailLocations.every(label=>job.locations?.some(existing=>locationKey(existing)===locationKey(label))),
        'native detail locations changed or were not represented in extraction')
      const postedAt=date(info.startDate,now,true),closingDate=info.endDate==null ? null : date(info.endDate,now)
      const provenance={site:board.site,tenant:board.tenant,nativePostingUid:info.id,requisitionId:info.jobReqId,canonicalUrl:info.externalUrl,nativeEmployer:employer.trim()||null}
      const mapped={...job,jobId:info.jobReqId,country:'India',sourceUrl:info.externalUrl,applyUrl:info.externalUrl,link:info.externalUrl,postedAt,closingDate,sourceClosingDateIsExact:false,
        sourceDescription:info.jobDescription,jobDescription:toPlainText(info.jobDescription),nativeEmployer:employer.trim()||null,nativeBoardProvenance:[provenance]}
      // Opt-in audit records retain the full authoritative public native model
      // and its date precision, after the same closing identity/content checks.
      if(options.retainNativeProof===true)Object.assign(mapped,{
        nativeSourceRecord:structuredClone(payload),nativeHiringOrganization:structuredClone(payload.hiringOrganization),
        postingDate:info.startDate,postedAt:info.startDate,postingDatePrecision:'calendar-date',
        sourcePostedDateRaw:info.startDate,firstEverPostedAt:null,
        closingDate:info.endDate??null,closingDatePrecision:info.endDate?'calendar-date':null,
        applicationVisited:false,
      })
      const signature=JSON.stringify([mapped.title,mapped.sourceDescription,mapped.locations,postedAt,closingDate])
      const key=board.tenant+'|'+info.jobReqId+'|'+(employer.trim()||'')
      const existing=requisitions.get(info.jobReqId)
      proof(!existing || existing===key,'cross-board requisition has conflicting employer')
      requisitions.set(info.jobReqId,key)
      if(unique.has(key)){
        proof(employer.trim() && unique.get(key).signature===signature,'cross-board duplicate content or geography conflict')
        unique.get(key).job.nativeBoardProvenance.push(provenance)
        duplicateCount++
      }else unique.set(key,{job:mapped,signature})
    }
  }
  // A duplicate excluded as foreign or unresolved still conflicts with a
  // verified India copy. Check every reconciled listing, in either board order.
  for(const requisitionId of requisitions.keys())for(const {board,listingRoles,indiaUrls} of boardPostings){
    for(const row of listingRoles){
      const posting=new URL(row.url).pathname.split('/').at(-1),marker='_'+requisitionId,index=posting.lastIndexOf(marker)
      const suffix=index<0?null:posting.slice(index+marker.length)
      const matches=row.bulletFields?.includes(requisitionId) || suffix==='' || suffix!=null && /^-\d+$/.test(suffix)
      if(matches)proof(indiaUrls.has(canonical(row.url,board)),'cross-board duplicate country scope unavailable or conflicting')
    }
  }
  const jobs=[...unique.values()].map(({job})=>({...job,sourceListingComplete:completeSourceScope,sourceGlobalJobCount:null,
    ...(completeSourceScope?{}:{sourceScopeComplete:false,lifecycleCleanupAllowed:false}),
    sourceBoardInventories:inventories,sourceBoardDuplicateCount:duplicateCount,sourceObservedIndiaJobCount:unique.size}))
  options.signal?.throwIfAborted()
  // Keep diagnostics even when no India role was proven. The catalog decorator
  // already preserves this non-enumerable country-proof symbol.
  Object.defineProperty(jobs,WORKDAY_COUNTRY_INVENTORY_PROOF,{value:{scope:'workday-board-union-country-proof',
    boards:inventories,duplicateCount,observedIndiaJobCount:unique.size,completeSourceScope}})
  return attachInventoryEvidence(jobs,{status:completeSourceScope ? jobs.length ? 'complete-inventory':'verified-empty':'coverage-gap',surface:boards[0].baseUrl,
    firstParty:true,listingComplete:completeSourceScope,pagesFetched:inventories.reduce((sum,b)=>sum+b.pagesFetched,0),
    reportedTotal:completeSourceScope?jobs.length:null,indiaFacetCount:completeSourceScope?jobs.length:null,verifiedAt:new Date().toISOString(),
    reason:scopeReason||(completeSourceScope?'all-official-workday-boards-india-union':'additional-official-recruitment-surface-unresolved')})
}

export async function runWorkdayWithPartialFallback(settings,fallback,options={}) {
  try{return await runVerifiedWorkdayBoardUnion(settings,options)}
  catch(error){
    options.signal?.throwIfAborted()
    if(error?.failureKind!=='incomplete_location_scope')throw error
    let jobs
    try{jobs=await runVerifiedWorkdayBoardUnion({...fallback,completeSourceScope:false,
      scopeReason:'unresolved-global-native-geography-verified-india-location-subset'},options)}
    catch(fallbackError){
      fallbackError.sourceFullScopeFailure={name:error.name,message:error.message,failureKind:error.failureKind}
      throw fallbackError
    }
    for(const job of jobs)job.sourceFullScopeFailure={name:error.name,message:error.message,failureKind:error.failureKind}
    return jobs
  }
}
