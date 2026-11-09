import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence,normalizeInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const SOURCE='volopay',COMPANY='Volopay',CLIENT_ID='ebed3959-fa8a-4719-b143-0730e1223ec8'
export const HOMEPAGE_URL='https://www.volopay.com/'
export const BOARD_IO_URL=`https://app.dover.io/dover/careers/${CLIENT_ID}`
export const BOARD_URL=BOARD_IO_URL.replace('.io/','.com/')
export const CURRENT_BOARD_URL=`https://jobs.dover.com/dover/careers/${CLIENT_ID}?src=app`
export const CLIENT_URL=`https://app.dover.com/api/v1/careers-page/${CLIENT_ID}?format=json`
export const LISTING_URL=`https://app.dover.com/api/v1/careers-page/${CLIENT_ID}/jobs?format=json`
export const buildDetailUrl=id=>`https://app.dover.com/api/v1/inbound/application-portal-job/${id}?format=json`
const DATE_CONTRACT='https://app.dover.com/static/search-builder2/static/js/types-j5GWHPOq.js'
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value)
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const sameUrl=(actual,expected)=>{try{const a=new URL(actual);return a.protocol==='https:'&&!a.username&&!a.password&&a.href===new URL(expected).href}catch{return false}}
const countryNames=new Intl.DisplayNames(['en'],{type:'region'})
const country=code=>typeof code==='string'&&/^[A-Z]{2}$/.test(code)&&!['ZZ','EU','UN','XA','XB','QO'].includes(code)&&countryNames.of(code)!==code
const countryLabels=new Map()
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b);if(country(code))countryLabels.set(countryNames.of(code).toLowerCase(),code)}

export const run=async({fetchImpl=globalThis.fetch,signal,maxJobs=null,detailConcurrency=3,timeoutMs=120000,detailSettleMs=1000,now=()=>new Date().toISOString()}={})=>{
 signal?.throwIfAborted()
 let firstParty=false,pagesFetched=0,surface=HOMEPAGE_URL,timer,drainTimer,onAbort,onCallerAbort,firstDetailFailure,detailFailed=false,activeDetails=0
 const controller=new AbortController(),detailController=new AbortController(),detailSignal=AbortSignal.any([controller.signal,detailController.signal])
 const gap=(reason,cause,metadata={})=>Object.assign(new Error('Volopay coverage gap: '+reason,{cause}),{
  code:'VOLOPAY_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,sourceListingComplete:false,lifecycleCleanupAllowed:false,...metadata,
  inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface,firstParty,listingComplete:false,pagesFetched,
    reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason}),
 })
 const requireProof=(ok,reason)=>{if(!ok)throw gap(reason)}
 requireProof(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000&&Number.isSafeInteger(detailConcurrency)&&detailConcurrency>0&&detailConcurrency<=8
  &&Number.isSafeInteger(detailSettleMs)&&detailSettleMs>0&&detailSettleMs<=5000
  &&(maxJobs===null||Number.isSafeInteger(maxJobs)&&maxJobs>0),'Invalid native deadline or detail limit')
 const interrupted=new Promise((_,reject)=>{
  onAbort=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',onAbort,{once:true})
  onCallerAbort=()=>controller.abort(signal.reason);signal?.addEventListener('abort',onCallerAbort,{once:true})
  timer=setTimeout(()=>controller.abort(gap('Aggregate native request/body deadline exceeded')),timeoutMs)
 })
 const read=async(url,{json=false,redirectTo=null,requestSignal=controller.signal}={})=>{
  requestSignal.throwIfAborted();surface=url
  const response=await fetchImpl(url,{method:'GET',redirect:'manual',signal:requestSignal,
    headers:{Accept:json?'application/json':'text/html','User-Agent':'Mozilla/5.0'}})
  requestSignal.throwIfAborted()
  const metadata={status:response.status,statusCode:response.status,requestUrl:url,finalUrl:response.url}
  if(redirectTo){
    const location=response.headers?.get('location')
    requireProof([301,302].includes(response.status)&&sameUrl(response.url,url)
      &&[redirectTo,CURRENT_BOARD_URL].some(target=>sameUrl(location,target)),'Official Dover board redirect identity changed')
    void response.body?.cancel?.().catch(()=>{})
    return location
  }
  if(response.status!==200||!sameUrl(response.url,url))throw gap('Native HTTP response or final URL changed',null,metadata)
  const mime=response.headers?.get('content-type')||''
  if(json&&!/^application\/json\b/i.test(mime))throw gap('Native JSON response has an unexpected content type',null,metadata)
    let body
    if(response.body?.getReader){
      const reader=response.body.getReader(),chunks=[];let bytes=0
      const cancel=()=>{void Promise.resolve(reader.cancel(requestSignal.reason)).catch(()=>{})}
      requestSignal.addEventListener('abort',cancel,{once:true})
      try{
        while(true){requestSignal.throwIfAborted();const part=await reader.read();requestSignal.throwIfAborted();if(part.done)break
          bytes+=part.value.byteLength;if(bytes>3000000){cancel();throw gap('Native response body exceeds reviewed byte bound')}
          chunks.push(Buffer.from(part.value))}
        body=Buffer.concat(chunks).toString('utf8')
      }finally{requestSignal.removeEventListener('abort',cancel);reader.releaseLock?.()}
    }else body=await response.text()
    requestSignal.throwIfAborted()
  requireProof(typeof body==='string'&&body.trim()&&Buffer.byteLength(body)<=3000000,'Native response body missing or oversized')
  if(!json)return body
  try{return JSON.parse(body)}catch(error){throw gap('Native JSON response is malformed',error,metadata)}
 }
 const locationSignature=locations=>{
  requireProof(Array.isArray(locations)&&locations.length>0,'Listing or detail country/location inventory missing')
  const signatures=locations.map(location=>{
    const option=location?.location_option
    requireProof(uuid(option?.id)&&country(option.country)&&typeof location.name==='string'&&norm(location.name)&&typeof location.is_primary==='boolean'
      &&typeof location.location_type==='string'&&typeof option.display_name==='string'&&norm(option.display_name)
      &&[option.city,option.state].every(value=>value==null||typeof value==='string'),'Explicit native country/location identity missing')
    for(const label of [location.name,option.display_name]){
      const explicitCountry=(option.location_type==='COUNTRY'||label.includes(','))
        &&countryLabels.get(norm(label).split(',').at(-1).trim().toLowerCase())
      requireProof(!explicitCountry||explicitCountry===option.country,'Native country code contradicts explicit location country label')
    }
    return JSON.stringify({id:option.id,country:option.country,city:norm(option.city),state:norm(option.state),name:norm(location.name),
      display:norm(option.display_name),type:option.location_type,workplace:location.location_type,primary:location.is_primary})
  }).sort()
  requireProof(new Set(signatures).size===signatures.length&&locations.filter(l=>l.is_primary).length<=1,'Native location inventory repeats or primary identity is ambiguous')
  return signatures
 }
 const inventory=payload=>{
  requireProof(Number.isSafeInteger(payload?.count)&&payload.count>=0&&payload.count<=300&&payload.next===null&&payload.previous===null
    &&Array.isArray(payload.results)&&payload.results.length===payload.count,'Native listing inventory count or pagination does not reconcile')
  const seen=new Set()
  const signatures=payload.results.map(row=>{
    requireProof(uuid(row?.id)&&!seen.has(row.id)&&typeof row.title==='string'&&norm(row.title),'Native listing inventory role identity missing or duplicate')
    seen.add(row.id)
    requireProof(row.is_published===true&&row.is_sample===false,'Native listing contains an unpublished or sample role')
    requireProof(typeof row.workplace_type==='string','Native listing workplace identity missing')
    return JSON.stringify({id:row.id,title:norm(row.title),locations:locationSignature(row.locations),published:row.is_published,sample:row.is_sample,workplace:row.workplace_type})
  }).sort()
  pagesFetched+=1
  return signatures
 }
 const publicationDay=value=>{
  const m=typeof value==='string'&&/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?Z$/.exec(value)
  requireProof(m,'Native created timestamp is missing or malformed')
  const parsed=new Date(value)
  requireProof(Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value.slice(0,10)
    &&parsed.getUTCHours()===Number(m[4])&&parsed.getUTCMinutes()===Number(m[5])&&parsed.getUTCSeconds()===Number(m[6]),'Native created timestamp calendar date is invalid')
  // The observed native JobPosting client explicitly publishes the UTC day of
  // created. Preserve that day, and retain the original microsecond clock below.
  return parsed.toISOString().slice(0,10)
 }
 const collect=async()=>{
  const official=readNativeDocument(await read(HOMEPAGE_URL))
  requireProof(official.nodes(n=>n.tag==='title'&&/\bVolopay\b/i.test(n.raw||'')).length===1
    &&official.nodes(n=>n.tag==='a'&&sameUrl(n.attrs.href,BOARD_IO_URL)&&official.text(n)==='Careers').length>0,'Current official publisher Careers handoff missing')
  firstParty=true
  const canonicalBoard=await read(BOARD_IO_URL,{redirectTo:BOARD_URL}),currentBoard=canonicalBoard===CURRENT_BOARD_URL
  const board=readNativeDocument(await read(canonicalBoard))
  requireProof(board.nodes(n=>n.tag==='div'&&n.attrs.id==='root').length===1
    &&board.nodes(n=>n.tag==='script'&&/^\/static\/search-builder2\/static\/js\/index-[\w-]+\.js$/.test(n.attrs.src||'')).length===1,'Native Dover board client identity changed')
  const client=await read(CLIENT_URL,{json:true})
  requireProof(client?.id===CLIENT_ID&&client.name===COMPANY&&client.slug==='volopay'&&client.primary_domain==='volopay.co','Native employer client identity changed')
  const initial=await read(LISTING_URL,{json:true}),initialSignature=inventory(initial)
  const india=initial.results.filter(row=>row.locations.some(l=>l.location_option.country==='IN'))
  const selected=maxJobs===null?india:india.slice(0,maxJobs),jobs=new Array(selected.length),nativeDetails=new Map()
  let cursor=0,resolveDrain
  const drainExpired=new Promise(resolve=>{resolveDrain=resolve})
  const workers=Promise.allSettled(Array.from({length:Math.min(detailConcurrency,selected.length)},async()=>{
   while(cursor<selected.length&&!detailFailed){
    const index=cursor++,row=selected[index]
    activeDetails++
    try{
      detailSignal.throwIfAborted()
      const detail=await read(buildDetailUrl(row.id),{json:true,requestSignal:detailSignal})
      nativeDetails.set(row.id,detail)
      requireProof(detail?.id===row.id&&detail.client_id===CLIENT_ID&&detail.client_name===COMPANY&&detail.client_domain==='volopay.co'
        &&typeof detail.title==='string'&&norm(detail.title)===norm(row.title)&&detail.active===true&&detail.is_private===false&&detail.workplace_type===row.workplace_type,
      'Native detail role/client identity or active public status conflicts with listing')
      requireProof(JSON.stringify(locationSignature(detail.locations))===JSON.stringify(locationSignature(row.locations)),'Native detail country/location identity conflicts with listing')
      requireProof(extractActiveDescription(detail.user_provided_description),'Native employer description content is missing or inactive')
      const postingDate=publicationDay(detail.created),description=detail.user_provided_description,locations=row.locations.filter(l=>l.location_option.country==='IN')
      const primary=(locations.find(l=>l.is_primary)||locations[0]).location_option,applyUrl=currentBoard?`https://jobs.dover.com/volopay/${row.id}`:`https://app.dover.com/apply/volopay/${row.id}`
      detailSignal.throwIfAborted()
      jobs[index]={source:SOURCE,company:COMPANY,companyDomain:'volopay.com',companyCareerPage:BOARD_IO_URL,atsPlatform:'dover',jobId:row.id,requisitionId:row.id,
        title:norm(detail.title),sourceUrl:applyUrl,applyUrl,link:applyUrl,country:'India',city:norm(primary.city)||null,state:norm(primary.state)||null,
        location:locations.map(l=>norm(l.name)).join('; '),remoteStatus:({REMOTE:'Remote',ONSITE:'On-site',HYBRID:'Hybrid'})[row.workplace_type]||null,
        postingDate:currentBoard?null:postingDate,closingDate:null,sourceClosingDateIsExact:false,scrapedAt:now(),
        ...(currentBoard?{sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceNativeDetailRecord:detail}:{}),
        sourceDateEvidence:{nativeCreated:detail.created,nativeField:'created',publishedJobPostingDate:currentBoard?null:postingDate,
          precision:currentBoard?'native-created-instant;current-publication-date-unqualified':'UTC-calendar-day',clientContract:currentBoard?null:DATE_CONTRACT},
        jobDescription:description,sourceDescription:description,jobDescriptionHtml:description}
    }catch(error){
      if(!detailFailed){
        detailFailed=true;firstDetailFailure=error
        detailController.abort(error)
        drainTimer=setTimeout(()=>resolveDrain(false),detailSettleMs)
      }
    }finally{activeDetails--}
   }
  }))
  await Promise.race([workers,drainExpired])
  if(detailFailed)throw firstDetailFailure
  if(currentBoard){
    const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)
    for(const row of selected){const closing=await read(buildDetailUrl(row.id),{json:true})
      requireProof(stable(nativeDetails.get(row.id))===stable(closing),'Closing full native role identity or criteria changed')}
  }
  const final=await read(LISTING_URL,{json:true}),finalSignature=inventory(final)
  requireProof(JSON.stringify(finalSignature)===JSON.stringify(initialSignature),'Final native listing inventory changed during detail recovery')
  controller.signal.throwIfAborted()
  const complete=selected.length===india.length
  for(const job of jobs)job.sourceListingComplete=complete
  return attachInventoryEvidence(jobs,{status:complete?(initial.count?'complete-inventory':'verified-empty'):'discovery-only',surface:LISTING_URL,firstParty:true,
    listingComplete:complete,pagesFetched,reportedTotal:complete?initial.count:null,indiaFacetCount:complete?india.length:null,verifiedAt:now(),
    reason:`Native initial/final listing reports ${initial.count} public roles; ${india.length} have explicit India locations. ${complete?'Every India role detail reconciled.':'Caller limited native detail recovery; whole-source cleanup remains disabled.'}`})
 }
 try{return await Promise.race([collect(),interrupted])}
 catch(error){
  if(signal?.aborted)throw signal.reason
  const primary=detailFailed?firstDetailFailure:error,settlement=detailFailed?{detailRequestsSettled:activeDetails===0,unsettledDetailRequests:activeDetails,detailCancellationRequested:detailController.signal.aborted}:{}
  if(primary?.code==='VOLOPAY_COVERAGE_GAP')throw Object.assign(primary,settlement)
  throw gap('Native inventory or transport unavailable',primary,settlement)
 }
 finally{clearTimeout(timer);clearTimeout(drainTimer);signal?.removeEventListener('abort',onCallerAbort);controller.signal.removeEventListener('abort',onAbort);controller.abort()}
}
