import {createHash} from 'node:crypto'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readMistralTable,readMistralOffice,bindMistralDocument,CAREERS,CONTACT} from './nativeModels.js'
import {readMistralDocx} from './nativeDocx.js'

const sha=b=>createHash('sha256').update(b).digest('hex'),need=(v,m)=>{if(!v)throw Error('Mistral native read: '+m)}
const cancelBody=body=>{try{Promise.resolve(body?.cancel()).catch(()=>{})}catch{}}
async function publicRead(url,{signal}={}){
 const startedAt=new Date().toISOString()
 const combined=signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)
 const response=await fetch(url,{method:'GET',headers:{Accept:url.endsWith('.docx')?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'text/html'},redirect:'manual',credentials:'omit',signal:combined})
 if(response.status!==200||response.url!==url){cancelBody(response.body);throw Error('Mistral native read: HTTP '+response.status+' or changed public URL for '+url)}
 const chunks=[];let size=0
 try{for await(const chunk of response.body){size+=chunk.byteLength;need(size<=4000000,'bounded public body required');chunks.push(Buffer.from(chunk))}}finally{cancelBody(response.body)}
 return{bytes:Buffer.concat(chunks),status:response.status,finalURL:response.url,contentType:response.headers.get('content-type')||'',method:'GET',requestedURL:url,startedAt,completedAt:new Date().toISOString()}
}
export function createNativeMistralScraper({maxJobs:factoryCap=Infinity,now:factoryNow=()=>new Date().toISOString()}={}){
 return{async run(options={}){
  const runStartedAt=Date.now(),{signal,fetchResponse,fetchText,fetchBytes}=options;signal?.throwIfAborted()
  const cap=Object.hasOwn(options,'maxJobs')?options.maxJobs??Infinity:factoryCap??Infinity
  if(!(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0))throw new RangeError('Mistral invalid result cap')
  const finish=jobs=>attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:false,listingComplete:false,reportedTotal:null,indiaFacetCount:null,reason:'Native document observations retain publisher title/experience conflicts; complete current work-country/employer/source inventory and cleanup remain unqualified'})
  if(cap===0)return finish([])
  const receipts=[],read=async url=>{
   signal?.throwIfAborted();let listener
   const aborted=new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal?.addEventListener('abort',listener,{once:true})})
   try{
    const value=await Promise.race([Promise.resolve().then(()=>{signal?.throwIfAborted();return fetchResponse?fetchResponse(url,{signal}):fetchText||fetchBytes?(url.endsWith('.docx')?(need(typeof fetchBytes==='function','a binary document callback is required'),fetchBytes(url,{signal})):fetchText(url,{signal})):publicRead(url,{signal})}),aborted])
    signal?.throwIfAborted()
    const packet=typeof value==='string'||Buffer.isBuffer(value)||value instanceof Uint8Array?{bytes:Buffer.from(value)}:value
    need(packet&&Buffer.isBuffer(packet.bytes)&&packet.bytes.length>0&&packet.bytes.length<=4000000,'bounded original response bytes required')
    if(packet.status!==undefined)need(packet.status===200,'HTTP '+packet.status+' for '+url)
    if(packet.finalURL!==undefined)need(packet.finalURL===url,'native response URL changed')
    if(packet.requestedURL!==undefined)need(packet.requestedURL===url,'native request URL changed')
    if(packet.bodySHA256!==undefined)need(packet.bodySHA256===sha(packet.bytes),'native response digest differs')
    if(packet.contentType!==undefined)need(url.endsWith('.docx')?/^application\/(?:vnd\.openxmlformats-officedocument\.wordprocessingml\.document|octet-stream)\b/i.test(packet.contentType):/^text\/html\b/i.test(packet.contentType),'native response content type changed')
    receipts.push({url,requestedURL:packet.requestedURL??null,method:packet.method??null,status:packet.status??null,finalURL:packet.finalURL??null,contentType:packet.contentType??null,startedAt:packet.startedAt??null,completedAt:packet.completedAt??null,bodySHA256:sha(packet.bytes),bodyBytes:packet.bytes.length})
    return packet.bytes
   }finally{signal?.removeEventListener('abort',listener)}
  }
  const opening=readMistralTable((await read(CAREERS)).toString('utf8'))
  need(opening.contactURL===CONTACT,'own country context must be literally declared by current careers')
  const office=readMistralOffice((await read(CONTACT)).toString('utf8')),documents=new Map()
  for(const row of opening.jobs)if(!documents.has(row.sourceUrl)){const bytes=await read(row.sourceUrl);documents.set(row.sourceUrl,await readMistralDocx(bytes));signal?.throwIfAborted()}
  const closing=readMistralTable((await read(CAREERS)).toString('utf8'))
  need(JSON.stringify(opening.table)===JSON.stringify(closing.table)&&JSON.stringify(opening.containingContext)===JSON.stringify(closing.containingContext)&&opening.contactURL===closing.contactURL,'closing native table or containing context changed; reconcile before output')
  const closingOffice=readMistralOffice((await read(CONTACT)).toString('utf8'))
  need(JSON.stringify(office.reconciledWholeModel)===JSON.stringify(closingOffice.reconciledWholeModel)&&JSON.stringify(office.reconciledContainingContext)===JSON.stringify(closingOffice.reconciledContainingContext),'closing office country context changed')
  for(const[url,doc]of documents)need(sha(await read(url))===doc.bodySHA256,'closing full native document changed: '+url)
  signal?.throwIfAborted()
  const runCompletedAt=Date.now();let precedingEnd=runStartedAt
  const transportEvidenceWithinRun=receipts.every(r=>{const start=Date.parse(r.startedAt),end=Date.parse(r.completedAt),ok=r.method==='GET'&&r.requestedURL===r.url&&r.finalURL===r.url&&r.status===200&&r.contentType&&Number.isFinite(start)&&Number.isFinite(end)&&start>=precedingEnd&&end>=start&&end<=runCompletedAt;precedingEnd=end;return ok})
  const observations=opening.jobs.map(row=>{const job=bindMistralDocument(row,documents.get(row.sourceUrl),office);return transportEvidenceWithinRun&&job.nativeRoleCriteriaReconciled?{...job,sourceDetailComplete:true,sourceDetailStatus:'native-role-documents-reconciled',sourceDetailFailureKind:null}:job}),now=options.now||factoryNow
  const evidence={openingCareers:{table:opening.table,containingContext:opening.containingContext,originalHTML:opening.originalHTML,bodySHA256:opening.bodySHA256},closingCareers:{table:closing.table,containingContext:closing.containingContext,originalHTML:closing.originalHTML,bodySHA256:closing.bodySHA256},openingOffice:office,closingOffice,observedPublishedRows:opening.jobs.length,originalPublicResponses:receipts,wholeOpeningClosingDocumentsReconciled:true,transportEvidenceWithinRun,diagnosticBodyCallbacksUsed:!fetchResponse&&(!!fetchText||!!fetchBytes),individuallyQualifiedRoles:observations.filter(j=>j.sourceDetailComplete).length,newQualifiedSourceCredit:0,completeCompanyInventory:false}
  const jobs=observations.slice(0,cap).map(job=>{let scrapedAt;try{scrapedAt=now()}catch(error){signal?.throwIfAborted();throw error}return{...job,source:'mistralsolutions',link:job.sourceUrl,scrapedAt,companyCareerPage:CAREERS,companyDomain:'mistralsolutions.com',nativeRunEvidence:evidence,applicationVisited:false,applicationFormSubmitted:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false}})
  signal?.throwIfAborted();return finish(jobs)
 }}
}
