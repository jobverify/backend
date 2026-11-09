import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {ENTRY,PRIMARY,API,MODULE_PROFILES,profileModuleURL,profileForPublisher,sha,need,equal,publisher,program,loadingContract,inventory,detail} from './nativeModels.js'

const cancel=body=>{try{Promise.resolve(body?.cancel()).catch(()=>{})}catch{}}
async function abortable(start,signal){
 signal?.throwIfAborted();let listener
 const cancellation=new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal?.addEventListener('abort',listener,{once:true})})
 try{return await Promise.race([Promise.resolve().then(()=>{signal?.throwIfAborted();return start()}),cancellation])}finally{signal?.removeEventListener('abort',listener)}
}
async function publicRead(url,{signal}){
 const startedAt=new Date().toISOString(),response=await fetch(url,{method:'GET',headers:{Accept:url.startsWith(API)?'application/json':url.endsWith('.js')?'text/javascript,application/javascript':'text/html'},credentials:'omit',redirect:'manual',signal})
 try{
  need(response.status===200||url===ENTRY&&response.status===301,'HTTP '+response.status+' for '+url);need(response.url===url,'public response URL changed')
  const chunks=[];let size=0
  for await(const chunk of response.body){size+=chunk.byteLength;need(size<=4000000,'bounded original response required');chunks.push(Buffer.from(chunk))}
  return{bytes:Buffer.concat(chunks),requestedURL:url,finalURL:response.url,method:'GET',body:null,status:response.status,headers:Object.fromEntries(response.headers),contentType:response.headers.get('content-type')||'',startedAt,completedAt:new Date().toISOString()}
 }finally{cancel(response.body)}
}
export function createNativeGrouponScraper({maxJobs:factoryCap=Infinity,now:factoryNow=()=>new Date().toISOString()}={}){
 return{async run(options={}){
  const started=Date.now(),{signal}=options;signal?.throwIfAborted()
  const cap=Object.hasOwn(options,'maxJobs')&&options.maxJobs!==undefined?options.maxJobs??Infinity:factoryCap??Infinity
  if(!(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0))throw new RangeError('Groupon invalid result cap')
  if(options.maxPages!=null&&options.maxPages!==Infinity)throw new RangeError('Groupon finite native inventory truncation is unsupported')
  const finish=(jobs,reads=0)=>attachInventoryEvidence(jobs,{status:'coverage-gap',surface:ENTRY,firstParty:false,listingComplete:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,reason:'Current published cohort only; country conflicts, application availability, complete company inventory and cleanup remain unqualified'})
  if(cap===0)return finish([])
  const receipts=[],originals=[],allowed=new Set([ENTRY,PRIMARY,...MODULE_PROFILES.flatMap(modules=>Object.keys(modules).map(key=>profileModuleURL(key,modules)))])
  async function read(url){
   signal?.throwIfAborted();need(allowed.has(url),'undeclared native GET route')
   const timeout=AbortSignal.timeout(20000),attempt=signal?AbortSignal.any([signal,timeout]):timeout
   const value=await abortable(()=>options.fetchResponse?options.fetchResponse(url,{method:'GET',body:null,signal:attempt}):options.fetchPage?options.fetchPage(url,{method:'GET',body:null,signal:attempt}):options.fetchText?options.fetchText(url,{method:'GET',body:null,signal:attempt}):publicRead(url,{signal:attempt}),attempt)
   signal?.throwIfAborted();const packet=typeof value==='string'?{html:value}:value
   need(packet&&typeof packet==='object','original native response packet required')
   const bytes=Buffer.isBuffer(packet.bytes)?packet.bytes:typeof packet.bodyBase64==='string'?Buffer.from(packet.bodyBase64,'base64'):typeof packet.html==='string'?Buffer.from(packet.html):null
   need(bytes&&bytes.length<=4000000,'bounded original response bytes required')
   const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),status=packet.status??200,headers=packet.headers instanceof Headers?Object.fromEntries(packet.headers):packet.headers||{},contentType=packet.contentType??headers['content-type']??null
   need(status===200||url===ENTRY&&status===301,'HTTP '+status+' for '+url);need(status===301||bytes.length>0,'empty original response')
   for(const field of ['requestedURL','url','finalURL'])if(packet[field]!==undefined)need(packet[field]===url,'response URL metadata differs')
   if(packet.method!==undefined)need(packet.method==='GET','response method differs')
   if(packet.body!==undefined)need(packet.body===null,'native GET body differs')
   if(packet.bodySHA256!==undefined)need(packet.bodySHA256===sha(bytes),'original response digest differs')
   if(packet.html!==undefined)need(packet.html===text,'original response text/bytes disagree')
   if(contentType!==null)need((url.startsWith(API)?/^application\/json\b/:url.endsWith('.js')?/^(?:text|application)\/javascript\b/:/^text\/html\b/).test(contentType),'native response content type changed')
   const receipt={url,requestedURL:packet.requestedURL??packet.url??null,finalURL:packet.finalURL??packet.url??null,method:packet.method??null,body:packet.body??null,status:packet.status??null,contentType,startedAt:packet.startedAt??null,completedAt:packet.completedAt??null,bodySHA256:sha(bytes),bodyBytes:bytes.length}
   receipts.push(receipt);originals.push({...receipt,text});return{text,status,headers}
  }
  async function snapshot(expected){
   const entry=await read(ENTRY);need(entry.status===301&&entry.headers.location===PRIMARY,'current registered canonical redirect changed')
   const currentPublisher=publisher((await read(PRIMARY)).text),modules=profileForPublisher(currentPublisher),programs={}
   for(const key of ['main','origins','roles','detail','locations'])programs[key]=program((await read(profileModuleURL(key,modules))).text,key,modules)
   const contract=loadingContract(programs);allowed.add(API)
   const listed=inventory((await read(API)).text),model={publisher:currentPublisher,contract,inventory:listed}
   if(expected)need(equal(model,expected.model),'closing native publisher, declaration, office or inventory changed')
   for(const row of listed.jobs)allowed.add(API+'/'+encodeURIComponent(row.id))
   const details=[]
   for(const row of listed.jobs){const result=detail((await read(API+'/'+encodeURIComponent(row.id))).text,row,contract);if(expected){const before=expected.details.find(j=>j.jobId===result.jobId);need(before&&equal(before.nativeSourceRecord,result.nativeSourceRecord)&&equal(before.nativePublication,result.nativePublication),'closing whole role model changed')}details.push(result);signal?.throwIfAborted()}
   return{model,details,programs:Object.fromEntries(Object.entries(programs).map(([k,p])=>[k,{url:p.url,wholeProgram:p.wholeProgram,bodySHA256:p.bodySHA256}]))}
  }
  const opening=await snapshot(),closing=await snapshot(opening);signal?.throwIfAborted();const completed=Date.now();let prior=started
  const fresh=receipts.every(r=>{const a=Date.parse(r.startedAt),b=Date.parse(r.completedAt),valid=r.requestedURL===r.url&&r.finalURL===r.url&&r.method==='GET'&&r.status&&r.contentType&&Number.isFinite(a)&&Number.isFinite(b)&&a>=prior&&b>=a&&b<=completed;prior=b;return Boolean(valid)})
  const audit={source:'groupon',openingRows:opening.details.length,closingRows:closing.details.length,originalResponses:receipts,rawNativeOriginals:originals,openingPrograms:opening.programs,closingPrograms:closing.programs,wholeNativeModelsClosingReconciled:true,transportEvidenceWithinRun:Boolean(fresh),applicationInteractions:0,publisherProgramsExecuted:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false}
  const observations=opening.details.map(first=>{const last=closing.details.find(j=>j.jobId===first.jobId);return{...first,nativeClosingRecord:last.nativeSourceRecord,nativeClosingPublication:last.nativePublication,sourceRawClosingNativeResponse:last.sourceRawNativeResponse,sourceRawClosingNativeResponseSHA256:last.sourceRawNativeResponseSHA256,sourceDetailComplete:Boolean(fresh&&first.nativeRoleCriteriaReconciled&&last.nativeRoleCriteriaReconciled),nativeRoleClosingReconciled:true}})
  if(options.onAudit)await abortable(()=>options.onAudit(structuredClone({...audit,observations})),signal)
  const clock=options.now||factoryNow,jobs=observations.slice(0,cap).map(job=>{let scrapedAt;try{scrapedAt=clock()}catch(error){signal?.throwIfAborted();throw error}signal?.throwIfAborted();return{...job,source:'groupon',company:'Groupon',companyDomain:'grouponcareers.com',companyCareerPage:ENTRY,scrapedAt}})
  Object.defineProperty(jobs,'sourceAudit',{value:audit});signal?.throwIfAborted();return finish(jobs,receipts.length)
 }}
}
