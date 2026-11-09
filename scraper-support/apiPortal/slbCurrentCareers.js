import {createHash} from 'node:crypto'
import {setTimeout as sleep} from 'node:timers/promises'
import {readNativeDocument,decodeNativeEntities} from '../utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../utils/inventoryEvidence.js'

export const SLB_CURRENT_SURFACE='slb-current-public-coveo'
export const SLB_INDEX='https://careers.slb.com/job-listing'
export const SLB_CLIENT='https://careers.slb.com/static/js/js-atomic-job-listing-search.js'
export const SLB_CLIENT_SHA256='b883fef66869f8c96c18b5272a1b51f651b0f62e814f7e09d8bfe2d3157e9aa9'
export const SLB_COLLECTION=Symbol.for('jobverify.slb-current-collection-audit')
const OBSERVATIONS=Symbol.for('jobverify.verified-recruitment-observations')
const sha=value=>createHash('sha256').update(value).digest('hex')
const clean=value=>typeof value==='string'?value.normalize('NFKC').replace(/\s+/g,' ').trim():''
const check=(ok,message)=>{if(!ok)throw Error('SLB current native contract: '+message)}
const one=(rows,name)=>{check(rows.length===1,'missing or ambiguous '+name);return rows[0]}

export function slbRoleURL(value){
 const url=new URL(value)
 check(url.protocol==='https:'&&url.origin==='https://careers.slb.com'&&!url.username&&!url.password&&!url.hash
  &&url.pathname==='/jobdescription.aspx'&&url.searchParams.getAll('id').length===1
  &&[...url.searchParams.keys()].every(key=>key==='id'),'unbound own role URL')
 check(/^(?:EF[0-9]+-en_US [0-9]+|WD[A-Za-z0-9_-]+)$/.test(url.searchParams.get('id')),'unreviewed native role identifier')
 return url
}

export function readSlbSearchConfiguration(html,client){
 check(sha(client)===SLB_CLIENT_SHA256,'current published search client changed')
 const doc=readNativeDocument(html)
 check(doc.nodes(n=>n.tag==='title'&&/SLB Careers/.test(decodeNativeEntities(n.raw||''))).length>0,'current SLB publisher identity unavailable')
 check(doc.nodes(n=>n.tag==='script'&&n.attrs.src&&new URL(n.attrs.src,SLB_INDEX).href===SLB_CLIENT).length===1,'search client is not actively advertised')
 check(doc.nodes(n=>n.tag==='atomic-facet'&&n.attrs.field==='country').length===1,'native country facet unavailable')
 const field=id=>one(doc.nodes(n=>n.tag==='input'&&n.attrs.id===id),'public '+id).attrs.value
 const config={organizationId:field('organizationId'),accessToken:field('accessToken'),searchHub:field('searchHub'),source:field('searchsource')}
 check(/^[a-z0-9]{3,80}$/.test(config.organizationId)&&typeof config.accessToken==='string'&&config.accessToken.length>10
  &&/^[A-Za-z0-9_ -]{1,100}$/.test(config.source)&&/^[A-Za-z0-9_-]{1,100}$/.test(config.searchHub),'native anonymous search configuration changed')
 return config
}

export function slbSearchURL(config,offset){
 check(Number.isSafeInteger(offset)&&offset>=0&&offset<500,'native search offset bound')
 const url=new URL('https://'+config.organizationId+'.org.coveo.com/rest/search/v2')
 for(const [key,value]of Object.entries({organizationId:config.organizationId,searchHub:config.searchHub,cq:'@source==$"'+config.source+'"',
  q:'',aq:'@country=="India"',numberOfResults:'50',firstResult:String(offset)}))url.searchParams.set(key,value)
 return url.href
}

export function slbListingIdentity(row){
 check(row&&typeof row==='object'&&!Array.isArray(row)&&clean(row.title),'native listing identity unavailable')
 const url=slbRoleURL(row.uri)
 check(new URL(row.clickUri).href===url.href,'native listing/public URL conflict')
 check(Array.isArray(row.raw?.country)&&row.raw.country.length>0&&row.raw.country.every(value=>value==='India'),'native listing country missing or conflicting')
 return {id:url.searchParams.get('id'),url:url.href,title:clean(row.title),country:row.raw.country,city:row.raw.city||null,posted:row.raw.jobposteddate??null}
}

export function readSlbCurrentRole(html,row,{now=new Date().toISOString()}={}){
 const identity=slbListingIdentity(row),doc=readNativeDocument(html)
 check(doc.nodes(n=>n.tag==='title'&&/SLB Careers/.test(decodeNativeEntities(n.raw||''))).length>0,'own role publisher changed')
 const canonical=doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical')).map(n=>new URL(n.attrs.href,identity.url))
 check(canonical.some(url=>url.href===identity.url)&&canonical.every(url=>url.origin==='https://careers.slb.com'
  &&(url.pathname==='/jobdescription'&&!url.search||url.href===identity.url)),'own native canonical identity changed')
 const hero=one(doc.nodes(n=>n.tag==='section'&&doc.hasClass(n,'hero-primary')),'own role header')
 check(clean(doc.text(one(doc.nodes(n=>n.tag==='h1',hero),'visible role title')))===identity.title,'native listing/visible title conflict')
 const location=clean(doc.text(one(doc.nodes(n=>n.tag==='h2'&&doc.nodes(c=>c.tag==='span'&&doc.hasClass(c,'icon-font-location-base'),n).length>0,hero),'own workplace')))
 check(/^India(?:,\s*.+)?$/.test(location),'own visible role country unavailable or conflicting')
 const city=location.includes(',')?location.slice(location.indexOf(',')+1).trim():null
 const indexedCity=Array.isArray(identity.city)?identity.city.join(', '):identity.city
 check(!indexedCity||clean(indexedCity).toLowerCase()===clean(city).toLowerCase(),'native listing/visible workplace conflict')
 const section=one(doc.nodes(n=>n.tag==='section'&&doc.hasClass(n,'job-description-redesign')),'full native role criteria')
 const parts=section.children.filter(n=>typeof n!=='string'&&!n.inert&&!doc.hasClass(n,'button-block'))
 check(parts.length>0&&parts.every(n=>['p','h2','h3','h4','h5','h6','ul','ol'].includes(n.tag)),'native role criteria structure changed')
 const description=parts.map(n=>doc.text(n)).filter(Boolean).join('\n')
 check(description.length>=100&&!/^(?:apply now|coming soon|sample|placeholder)[\s.!]*$/i.test(description),'full visible native role criteria unavailable')
 const applyURLs=doc.nodes(n=>n.tag==='a'&&clean(doc.text(n))==='Apply Now'&&n.attrs.href,hero).map(n=>new URL(decodeNativeEntities(n.attrs.href),identity.url))
 const uniqueApply=[...new Set(applyURLs.map(url=>url.href))]
 check(uniqueApply.length===1,'native role application anchor missing or ambiguous')
 const apply=applyURLs[0]
 check(apply.protocol==='https:'&&!apply.username&&!apply.password&&!apply.hash&&!apply.port
  &&(apply.origin==='https://apply.slb.com'&&apply.pathname==='/careers/apply'&&/^\d+$/.test(apply.searchParams.get('pid')||'')&&apply.searchParams.get('domain')==='slb.com'
   ||/^[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com$/i.test(apply.hostname)&&/\/job\/.+\/apply$/.test(apply.pathname)),'native application URL changed')
 const posted=identity.posted
 check(posted==null||Number.isSafeInteger(posted)&&posted>0&&posted<=Date.parse(now),'native publication timestamp unavailable or in the future')
 const departments=doc.nodes(n=>n.tag==='h2'&&!doc.nodes(c=>c.tag==='span'&&doc.hasClass(c,'icon-font-location-base'),n).length,hero).map(n=>clean(doc.text(n))).filter(Boolean)
 return {identity,location,city:/^multi[- ]location$/i.test(city||'')?null:city,description,applyURL:apply.href,
  backendJobId:apply.origin==='https://apply.slb.com'?apply.searchParams.get('pid'):null,
  department:departments.length===1?departments[0]:null,posted:posted==null?null:new Date(posted).toISOString(),
  documentSHA256:sha(html),unqualifiedStructuredData:doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>{
   try{JSON.parse(n.raw);return {sha256:sha(n.raw),parseable:true,usedForPublication:false}}catch{return {sha256:sha(n.raw||''),parseable:false,usedForPublication:false}}
  })}
}

export async function runCurrentSlbCareers({provider,fetchImpl=globalThis.fetch,signal:callerSignal,now=()=>new Date().toISOString(),maxJobs=Infinity}={}){
 check(provider?.source==='slb'&&provider.companyName==='SLB'&&provider.countryFilter==='India'&&provider.companyCareerPage===SLB_INDEX,'source registration identity changed')
 check(maxJobs===Infinity||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'invalid caller cap')
 const signal=AbortSignal.any([...(callerSignal?[callerSignal]:[]),AbortSignal.timeout(180000)])
 signal.throwIfAborted()
 const observedAt=typeof now==='function'?now():now
 check(Number.isFinite(Date.parse(observedAt)),'invalid observation time')
 const minimumIntervalMs=provider.config?.rateLimit?.minimumIntervalMs??1000
 check(Number.isSafeInteger(minimumIntervalMs)&&minimumIntervalMs>=0&&minimumIntervalMs<=10000,'invalid native pacing')
 const denied=new Map(),requests=[],failures=[],held=[],jobs=[];let lastStarted=0,requestCount=0
 async function read(url,format='html',headers={}){
  signal.throwIfAborted();const origin=new URL(url).origin;if(denied.has(origin))throw denied.get(origin)
  const delay=lastStarted+minimumIntervalMs-Date.now();if(delay>0)await sleep(delay,undefined,{signal})
  signal.throwIfAborted();check(requestCount<220,'native source request bound');requestCount++;lastStarted=Date.now()
  let response
  try{response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'manual',headers:{Accept:format==='json'?'application/json':format==='script'?'application/javascript':'text/html',...headers},
   signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])})}catch(error){signal.throwIfAborted();error.nativeTransportFailure=true;throw error}
  if(response.status!==200){const error=Object.assign(Error('SLB current native HTTP '+response.status),{status:response.status,abortRetries:true,nativeTransportFailure:true})
   if([401,403,429,451].includes(response.status))denied.set(origin,error);throw error}
  check(response.url===url,'native response authority changed')
  check((format==='json'?/json/i:format==='script'?/javascript/i:/html/i).test(response.headers.get('content-type')||''),'native response type changed')
  const reader=response.body?.getReader(),chunks=[];let size=0;check(reader,'native body unavailable')
  try{for(;;){const next=await reader.read();signal.throwIfAborted();if(next.done)break;size+=next.value.byteLength;check(size<=4e6,'native response body bound');chunks.push(Buffer.from(next.value))}
  }catch(error){await reader.cancel().catch(()=>{});if(['AbortError','TimeoutError'].includes(error.name)&&!signal.aborted)error.nativeTransportFailure=true;throw error}finally{reader.releaseLock()}
  const text=Buffer.concat(chunks).toString('utf8');requests.push({url,sha256:sha(text),bytes:size});return format==='json'?JSON.parse(text):text
 }
 async function currentAccount(){const html=await read(SLB_INDEX),client=await read(SLB_CLIENT,'script');return readSlbSearchConfiguration(html,client)}
 async function inventory(account){
  const rows=[],identities=new Set();let total=null
  for(let offset=0;offset<500;offset+=50){
   const model=await read(slbSearchURL(account,offset),'json',{Authorization:'Bearer '+account.accessToken})
   const count=model.totalCountFiltered??model.totalCount
   check(Number.isSafeInteger(count)&&count>=0&&Array.isArray(model.results),'native search envelope changed')
   if(total==null)total=count;check(count===total&&rows.length+model.results.length<=total,'native search count changed')
   for(const row of model.results){const identity=slbListingIdentity(row);check(!identities.has(identity.id),'native search repeated role identity');identities.add(identity.id);rows.push(row)}
   if(rows.length===total)return {rows,total}
   check(model.results.length>0,'native search pagination made no progress')
  }
  throw Error('SLB current native pagination bound')
 }
 const openingAccount=await currentAccount(),opening=await inventory(openingAccount)
 const accountProof={organizationId:openingAccount.organizationId,searchHub:openingAccount.searchHub,source:openingAccount.source,
  publisherURL:SLB_INDEX,clientURL:SLB_CLIENT,clientSHA256:SLB_CLIENT_SHA256,publicSearchKeySHA256:sha(openingAccount.accessToken)}
 for(const row of opening.rows.slice(0,maxJobs)){
  const identity=slbListingIdentity(row)
  try{
   const html=await read(identity.url),role=readSlbCurrentRole(html,row,{now:observedAt})
   const employerBinding={method:'current-native-visible-role-publisher',publisher:'SLB',surface:identity.url,primarySurface:SLB_INDEX,legalEmployer:null}
   const jobId=role.backendJobId||identity.id
   check(!jobs.some(job=>job.jobId===jobId),'duplicate native backend requisition identity')
   jobs.push({source:'slb',company:'SLB',companyDomain:'slb.com',jobId,nativeCurrentPostingId:identity.id,requisitionId:null,title:identity.title,
    country:'India',city:role.city,location:role.location,locations:[role.location],department:role.department,
    sourceUrl:identity.url,link:identity.url,applyUrl:role.applyURL,applicationVisited:false,
    jobDescription:role.description,sourceDescription:role.description,sourceDetailComplete:true,
    postingDate:role.posted,postedAt:role.posted,sourcePostedDateRaw:identity.posted,firstEverPostedAt:null,
    postingDatePrecision:role.posted?'native-epoch-milliseconds':null,sourcePostingDateIsExact:Boolean(role.posted),
    sourceDateProvenance:'current-company-native-search-jobposteddate',closingDate:null,
    nativeHiringOrganization:null,nativeEmployerBinding:employerBinding,
    nativeSourceRecord:{nativeAccount:accountProof,nativeListing:row,nativeVisibleRole:role},
    sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:observedAt})
  }catch(error){signal.throwIfAborted();held.push({id:identity.id,title:identity.title,url:identity.url,reason:error.message,nativeListing:row});failures.push({stage:'current-native-role',message:error.message});if(denied.has(new URL(identity.url).origin))break}
 }
 let closing=null,closingTransportUnavailable=false
 try{
  const closingAccount=await currentAccount()
  check(['organizationId','searchHub','source'].every(field=>closingAccount[field]===openingAccount[field]),'current company account changed at closing')
  closing=await inventory(closingAccount)
 }catch(error){signal.throwIfAborted();closingTransportUnavailable=error.nativeTransportFailure===true;failures.push({stage:'current-native-closing-inventory',message:error.message})}
 const closingById=new Map((closing?.rows||[]).map(row=>[slbListingIdentity(row).id,row])),accepted=[]
 for(const job of jobs){const current=closingById.get(job.nativeCurrentPostingId)
  if(!closing&&closingTransportUnavailable){job.nativeRoleClosingReconciled=false;job.nativeClosingInventoryUnavailable=true;accepted.push(job)
  }else if(current&&JSON.stringify(slbListingIdentity(current))===JSON.stringify(slbListingIdentity(job.nativeSourceRecord.nativeListing))){
   job.nativeSourceRecord.nativeClosingListing=current;job.nativeRoleClosingReconciled=true;accepted.push(job)
  }else held.push({id:job.jobId,url:job.sourceUrl,reason:'native-closing-role-unreconciled',nativeSourceRecord:job.nativeSourceRecord})
 }
 const audit={openingNativeCount:opening.total,closingNativeCount:closing?.total??null,returnedRecords:accepted.length,
  nativeListingEnumerationComplete:Boolean(closing&&opening.total===closing.total&&opening.rows.every(row=>closingById.has(slbListingIdentity(row).id))),heldNativeRoles:held,failures,
  sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false}
 for(const job of accepted)job.sourceNativeCollectionAudit=audit
 Object.defineProperty(accepted,SLB_COLLECTION,{value:audit})
 Object.defineProperty(accepted,OBSERVATIONS,{value:{source:'slb',observedAt,requestCount,nativeRecords:opening.rows.length,returnedIndiaJobs:accepted.length,
  nativeInventoryReads:[{kind:'current-company-native-coveo',surface:SLB_INDEX,reportedTotal:opening.total}],unresolved:held.length?['current-native-role-holds']:[],failures,
  sourceScopeComplete:false,lifecycleCleanupAllowed:false}})
 return attachInventoryEvidence(accepted,{status:'coverage-gap',surface:SLB_INDEX,firstParty:true,listingComplete:false,
  reportedTotal:opening.total,indiaFacetCount:null,pagesFetched:requests.length,verifiedAt:observedAt,
  reason:'current-company-search-and-own-visible-role-evidence;company-inventory-unverified;cleanup-forbidden'})
}
