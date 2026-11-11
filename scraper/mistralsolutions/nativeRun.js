import {createHash} from 'node:crypto'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readMistralTable,readMistralOffice,bindMistralDocument,CAREERS,CONTACT} from './nativeModels.js'
import {readMistralDocx} from './nativeDocx.js'

const sha=b=>createHash('sha256').update(b).digest('hex'),need=(v,m)=>{if(!v)throw Error('Mistral native read: '+m)}
const cancelBody=body=>{try{Promise.resolve(body?.cancel()).catch(()=>{})}catch{}}
const quietly=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
const deadlineError=scope=>Object.assign(Error('Mistral native '+scope+' deadline exceeded'),{name:'TimeoutError',code:'MISTRAL_'+scope.toUpperCase()+'_TIMEOUT',softFailure:true,abortRetries:true})
const duration=(value,name,max)=>{if(!Number.isSafeInteger(value)||value<=0||value>max)throw new RangeError('Mistral invalid '+name);return value}
function boundedSession(options){
 const caller=options.signal,sourceMs=duration(options.sourceTimeoutMs??180000,'sourceTimeoutMs',180000)
 const requestMs=duration(options.requestTimeoutMs??20000,'requestTimeoutMs',30000)
 const source=new AbortController(),signal=caller?AbortSignal.any([caller,source.signal]):source.signal
 const sourceDeadline=performance.now()+sourceMs,sourceError=deadlineError('source')
 const sourceTimer=setTimeout(()=>source.abort(sourceError),sourceMs)
 const check=()=>{caller?.throwIfAborted();if(performance.now()>=sourceDeadline&&!source.signal.aborted)source.abort(sourceError);signal.throwIfAborted()}
 const race=(start,active=signal,guard=check,late)=>new Promise((resolve,reject)=>{
  let ended=false
  const finish=(fn,value)=>{if(ended)return;ended=true;active.removeEventListener('abort',aborted);fn(value)}
  const aborted=()=>finish(reject,caller?.aborted?caller.reason:active.reason)
  active.addEventListener('abort',aborted,{once:true})
  Promise.resolve().then(()=>{guard();active.throwIfAborted();return start()}).then(value=>{
   if(ended){quietly(()=>late?.(value));return}
   try{guard();active.throwIfAborted();finish(resolve,value)}catch(error){quietly(()=>late?.(value));finish(reject,error)}
  },error=>{
   if(ended)return
   if(caller?.aborted){finish(reject,caller.reason);return}
   try{guard();active.throwIfAborted()}catch(expired){finish(reject,expired);return}
   finish(reject,error)
  })
  if(active.aborted)aborted()
 })
 return{check,signal,race,async request(operation){
  check()
  const request=new AbortController(),active=AbortSignal.any([signal,request.signal]),error=deadlineError('request'),deadline=performance.now()+requestMs
  const timer=setTimeout(()=>request.abort(error),requestMs)
  const guard=()=>{check();if(performance.now()>=deadline&&!request.signal.aborted)request.abort(error);active.throwIfAborted()}
  const cleanups=new Set()
  try{return await race(()=>operation({signal:active,check:guard,race:(start,late)=>race(start,active,guard,late),onClose:cleanup=>cleanups.add(cleanup)}),active,guard,value=>cancelBody(value?.body))}
  finally{clearTimeout(timer);for(const cleanup of cleanups)quietly(cleanup);if(!request.signal.aborted)request.abort(Error('Mistral native request closed'))}
 },close(){clearTimeout(sourceTimer);if(!source.signal.aborted)source.abort(Error('Mistral native source closed'))}}
}
async function publicRead(url,{signal,check,race,onClose}){
 const startedAt=new Date().toISOString()
 let response,reader,iterator,done=false,closed=false;const chunks=[];let size=0
 const close=()=>{
  if(closed)return;closed=true
  if(reader){if(!done)quietly(()=>reader.cancel(signal.reason));quietly(()=>reader.releaseLock())}
  else{if(!done&&iterator)quietly(()=>iterator.return?.());cancelBody(response?.body)}
 }
 onClose(close)
 try{
  response=await race(()=>fetch(url,{method:'GET',headers:{Accept:url.endsWith('.docx')?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'text/html'},redirect:'manual',credentials:'omit',signal}),late=>cancelBody(late?.body))
  check()
  need(response.status===200&&response.url===url,'HTTP '+response.status+' or changed public URL for '+url)
  if(typeof response.body?.getReader==='function')reader=response.body.getReader()
  else if(typeof response.body?.[Symbol.asyncIterator]==='function')iterator=response.body[Symbol.asyncIterator]()
  need(reader||iterator,'original public response stream required')
  for(;;){
   const item=await race(()=>reader?reader.read():iterator.next());check()
   if(item.done){done=true;break}
   need(item.value instanceof Uint8Array,'original public byte chunk required')
   size+=item.value.byteLength;need(size<=4000000,'bounded public body required');chunks.push(Buffer.from(item.value))
  }
  check()
  return{bytes:Buffer.concat(chunks),status:response.status,finalURL:response.url,contentType:response.headers.get('content-type')||'',method:'GET',requestedURL:url,startedAt,completedAt:new Date().toISOString()}
 }finally{close()}
}
export function createNativeMistralScraper({maxJobs:factoryCap=Infinity,now:factoryNow=()=>new Date().toISOString()}={}){
 return{async run(options={}){
  const runStartedAt=Date.now(),{signal,fetchResponse,fetchText,fetchBytes}=options;signal?.throwIfAborted()
  const cap=Object.hasOwn(options,'maxJobs')?options.maxJobs??Infinity:factoryCap??Infinity
  if(!(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0))throw new RangeError('Mistral invalid result cap')
  const finish=jobs=>attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:false,listingComplete:false,reportedTotal:null,indiaFacetCount:null,reason:'Native document observations retain publisher title/experience conflicts; complete current work-country/employer/source inventory and cleanup remain unqualified'})
  if(cap===0)return finish([])
  const session=boundedSession(options)
  try{
  const receipts=[],read=async url=>{
    const value=await session.request(control=>fetchResponse?fetchResponse(url,{signal:control.signal}):fetchText||fetchBytes?(url.endsWith('.docx')?(need(typeof fetchBytes==='function','a binary document callback is required'),fetchBytes(url,{signal:control.signal})):fetchText(url,{signal:control.signal})):publicRead(url,control))
    session.check()
    const packet=typeof value==='string'||Buffer.isBuffer(value)||value instanceof Uint8Array?{bytes:Buffer.from(value)}:value
    need(packet&&Buffer.isBuffer(packet.bytes)&&packet.bytes.length>0&&packet.bytes.length<=4000000,'bounded original response bytes required')
    if(packet.status!==undefined)need(packet.status===200,'HTTP '+packet.status+' for '+url)
    if(packet.finalURL!==undefined)need(packet.finalURL===url,'native response URL changed')
    if(packet.requestedURL!==undefined)need(packet.requestedURL===url,'native request URL changed')
    if(packet.bodySHA256!==undefined)need(packet.bodySHA256===sha(packet.bytes),'native response digest differs')
    if(packet.contentType!==undefined)need(url.endsWith('.docx')?/^application\/(?:vnd\.openxmlformats-officedocument\.wordprocessingml\.document|octet-stream)\b/i.test(packet.contentType):/^text\/html\b/i.test(packet.contentType),'native response content type changed')
    receipts.push({url,requestedURL:packet.requestedURL??null,method:packet.method??null,status:packet.status??null,finalURL:packet.finalURL??null,contentType:packet.contentType??null,startedAt:packet.startedAt??null,completedAt:packet.completedAt??null,bodySHA256:sha(packet.bytes),bodyBytes:packet.bytes.length})
    session.check();return packet.bytes
  }
  const opening=readMistralTable((await read(CAREERS)).toString('utf8'))
  need(opening.contactURL===CONTACT,'own country context must be literally declared by current careers')
  const office=readMistralOffice((await read(CONTACT)).toString('utf8')),documents=new Map()
  for(const row of opening.jobs)if(!documents.has(row.sourceUrl)){const bytes=await read(row.sourceUrl);documents.set(row.sourceUrl,await session.race(()=>readMistralDocx(bytes)));session.check()}
  const closing=readMistralTable((await read(CAREERS)).toString('utf8'))
  need(JSON.stringify(opening.table)===JSON.stringify(closing.table)&&JSON.stringify(opening.containingContext)===JSON.stringify(closing.containingContext)&&opening.contactURL===closing.contactURL,'closing native table or containing context changed; reconcile before output')
  const closingOffice=readMistralOffice((await read(CONTACT)).toString('utf8'))
  need(JSON.stringify(office.reconciledWholeModel)===JSON.stringify(closingOffice.reconciledWholeModel)&&JSON.stringify(office.reconciledContainingContext)===JSON.stringify(closingOffice.reconciledContainingContext),'closing office country context changed')
  for(const[url,doc]of documents)need(sha(await read(url))===doc.bodySHA256,'closing full native document changed: '+url)
  session.check()
  const runCompletedAt=Date.now();let precedingEnd=runStartedAt
  const transportEvidenceWithinRun=receipts.every(r=>{const start=Date.parse(r.startedAt),end=Date.parse(r.completedAt),ok=r.method==='GET'&&r.requestedURL===r.url&&r.finalURL===r.url&&r.status===200&&r.contentType&&Number.isFinite(start)&&Number.isFinite(end)&&start>=precedingEnd&&end>=start&&end<=runCompletedAt;precedingEnd=end;return ok})
  const observations=opening.jobs.map(row=>{const job=bindMistralDocument(row,documents.get(row.sourceUrl),office);return transportEvidenceWithinRun&&job.nativeRoleCriteriaReconciled?{...job,sourceDetailComplete:true,sourceDetailStatus:'native-role-documents-reconciled',sourceDetailFailureKind:null}:job}),now=options.now||factoryNow
  const evidence={openingCareers:{table:opening.table,containingContext:opening.containingContext,originalHTML:opening.originalHTML,bodySHA256:opening.bodySHA256},closingCareers:{table:closing.table,containingContext:closing.containingContext,originalHTML:closing.originalHTML,bodySHA256:closing.bodySHA256},openingOffice:office,closingOffice,observedPublishedRows:opening.jobs.length,originalPublicResponses:receipts,wholeOpeningClosingDocumentsReconciled:true,transportEvidenceWithinRun,diagnosticBodyCallbacksUsed:!fetchResponse&&(!!fetchText||!!fetchBytes),individuallyQualifiedRoles:observations.filter(j=>j.sourceDetailComplete).length,newQualifiedSourceCredit:0,completeCompanyInventory:false}
  const jobs=observations.slice(0,cap).map(job=>{let scrapedAt;try{scrapedAt=now()}catch(error){signal?.throwIfAborted();throw error}return{...job,source:'mistralsolutions',link:job.sourceUrl,scrapedAt,companyCareerPage:CAREERS,companyDomain:'mistralsolutions.com',nativeRunEvidence:evidence,applicationVisited:false,applicationFormSubmitted:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false}})
  session.check();return finish(jobs)
  }finally{session.close()}
 }}
}
