import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {SOURCE,COMPANY,ENTRY,PRIMARY,BOARD,AJAX,sha,need,comparable,roleURL,readPublisher,readInventoryContract,inventoryBody,readInventory,readDetail} from './nativeModels.js'

const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const publicationState=detail=>({closed:detail.nativePublishedClosedNotice,criteriaReconciled:detail.nativeRoleCriteriaReconciled,identityReconciled:detail.nativeRoleIdentityReconciled,employerReconciled:detail.nativeEmployerReconciled})
const cancel=body=>{try{Promise.resolve(body?.cancel()).catch(()=>{})}catch{}}
async function abortable(start,signal){
 signal?.throwIfAborted();let listener
 const pending=new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal?.addEventListener('abort',listener,{once:true})})
 try{return await Promise.race([Promise.resolve().then(()=>{signal?.throwIfAborted();return start()}),pending])}finally{signal?.removeEventListener('abort',listener)}
}
async function publicRead(url,{method,body,signal}){
 const startedAt=new Date().toISOString(),response=await fetch(url,{method,body:body||undefined,headers:{Accept:'text/html',...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'}:{})},redirect:'manual',credentials:'omit',signal})
 if(![200,301].includes(response.status)){cancel(response.body);throw Error('SPEC native HTTP '+response.status+' for '+url)}
 need(response.url===url,'public response URL changed')
 const chunks=[];let size=0
 try{for await(const chunk of response.body){size+=chunk.byteLength;need(size<=4000000,'bounded original response required');chunks.push(Buffer.from(chunk))}}finally{cancel(response.body)}
 return{bytes:Buffer.concat(chunks),method,body,status:response.status,requestedURL:url,finalURL:response.url,headers:Object.fromEntries(response.headers),contentType:response.headers.get('content-type')||'',startedAt,completedAt:new Date().toISOString()}
}

export function createNativeSpecScraper({maxJobs:factoryCap=Infinity,now:factoryNow=()=>new Date().toISOString()}={}){
 return{async run(options={}){
  const started=Date.now(),{signal,fetchPage,fetchResponse,fetchText}=options;signal?.throwIfAborted()
  const cap=Object.hasOwn(options,'maxJobs')&&options.maxJobs!==undefined?options.maxJobs??Infinity:factoryCap??Infinity
  if(!(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0))throw new RangeError('SPEC invalid result cap')
  if(options.maxPages!=null&&options.maxPages!==Infinity)throw new RangeError('SPEC finite source-page truncation is unsupported')
  const finish=(jobs,reads=0,qualified=false)=>attachInventoryEvidence(jobs,{status:'coverage-gap',surface:ENTRY,firstParty:qualified,listingComplete:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,reason:'Native published cohort only; complete company inventory, application availability and lifecycle cleanup remain unqualified'})
  if(cap===0)return finish([])
  const receipts=[],originals=[],allowedRoles=new Set(),read=async(url,{method='GET',body=null}={})=>{
   signal?.throwIfAborted()
   need(method==='GET'&&([ENTRY,PRIMARY,BOARD].includes(url)||allowedRoles.has(url))||method==='POST'&&url===AJAX&&Array.from({length:8},(_,i)=>inventoryBody(i+1)).includes(body),'unreviewed native request')
   const timeout=AbortSignal.timeout(20000),attempt=signal?AbortSignal.any([signal,timeout]):timeout
   const value=await abortable(()=>fetchResponse?fetchResponse(url,{method,body,signal:attempt}):fetchPage?fetchPage(url,{method,body,signal:attempt}):fetchText?(need(method==='GET','legacy text callback cannot impersonate a native POST'),fetchText(url,{method,body,signal:attempt})):publicRead(url,{method,body,signal:attempt}),attempt)
   signal?.throwIfAborted()
   const packet=typeof value==='string'?{html:value}:value
   need(packet&&typeof packet==='object','original response packet required')
   const bytes=Buffer.isBuffer(packet.bytes)?packet.bytes:typeof packet.bodyBase64==='string'?Buffer.from(packet.bodyBase64,'base64'):typeof packet.html==='string'?Buffer.from(packet.html):null
   need(bytes&&bytes.length<=4000000,'bounded original response bytes required')
   const html=new TextDecoder('utf-8',{fatal:true}).decode(bytes),status=packet.status??200,headers=packet.headers instanceof Headers?Object.fromEntries(packet.headers):packet.headers||{},contentType=packet.contentType??headers['content-type']??null
   need(status===200||status===301&&url===ENTRY,'HTTP '+status+' for '+url)
   need(status===301||bytes.length>0,'empty native role/inventory body')
   if(packet.method!==undefined)need(packet.method===method,'response method metadata differs')
   if(packet.body!==undefined)need(packet.body===body,'response request-body metadata differs')
   for(const field of ['url','requestedURL','finalURL'])if(packet[field]!==undefined)need(packet[field]===url,'response URL metadata differs')
   if(packet.bodySHA256!==undefined)need(packet.bodySHA256===sha(bytes),'original response digest differs')
   if(contentType!==null)need(/^text\/html\b/i.test(contentType),'native HTML content type changed')
   if(packet.html!==undefined)need(packet.html===html,'original response text/bytes disagree')
   const receipt={url,requestedURL:packet.requestedURL??packet.url??null,method:packet.method??null,body:packet.body??null,status:packet.status??null,finalURL:packet.finalURL??packet.url??null,contentType,startedAt:packet.startedAt??null,completedAt:packet.completedAt??null,bodySHA256:sha(bytes),bodyBytes:bytes.length}
   receipts.push(receipt);originals.push({...receipt,html});return{html,status,headers}
  }
  const primary=async()=>{const response=await read(ENTRY);if(response.status===301){need(response.headers.location===PRIMARY,'unreviewed canonical redirect');return readPublisher((await read(PRIMARY)).html,'primary')}return readPublisher(response.html,'primary')}
  const snapshot=async(expected)=>{
   const publisher=await primary(),board=readPublisher((await read(BOARD)).html,'board'),contract=readInventoryContract(board),pages=[],rows=[]
   need(equal(publisher.office.reconciledWholeContext,board.office.reconciledWholeContext),'primary/board own office context differs')
   for(let page=1;page<=8;page++){const inventory=readInventory((await read(AJAX,{method:'POST',body:inventoryBody(page)})).html,page);pages.push(inventory);rows.push(...inventory.rows);if(inventory.terminal)break;need(page<8,'native inventory page bound reached before terminal evidence')}
   need(rows.length>0&&new Set(rows.map(r=>r.url)).size===rows.length,'empty or duplicate native role inventory remains unqualified')
   need(publisher.featured.every(url=>rows.some(row=>row.url===url)),'primary featured roles missing from native inventory')
   const model={featured:publisher.featured,primaryOffice:publisher.office.reconciledWholeContext,boardOffice:board.office.reconciledWholeContext,contract:{program:contract.wholeNativeProgram,programSHA256:contract.programSHA256},pages:pages.map(p=>({model:p.model,page:p.page,count:p.count,terminal:p.terminal}))}
   if(expected)need(equal(model,expected.model),'closing native inventory, publisher or office context changed')
   for(const row of rows)allowedRoles.add(roleURL(row.url))
   const details=[]
   for(const row of rows){const detail=readDetail((await read(row.url)).html,row);need(equal(detail.nativeOfficeContext.reconciledWholeContext,publisher.office.reconciledWholeContext),'role and publisher own office context differs');if(expected){const earlier=expected.details.find(j=>j.sourceUrl===detail.sourceUrl);need(earlier&&equal(comparable(detail.nativeRoleModel),comparable(earlier.nativeRoleModel))&&detail.country===earlier.country&&equal(detail.nativeRoleFields,earlier.nativeRoleFields),'closing full role criteria or identity changed');need(equal(publicationState(detail),publicationState(earlier)),'closing native publication or qualification status changed')}details.push(detail);signal?.throwIfAborted()}
   return{publisher,board,contract,pages,rows,details,model}
  }
  const opening=await snapshot(),closing=await snapshot(opening);signal?.throwIfAborted()
  const completed=Date.now();let prior=started
  const transportWithinRun=receipts.every(r=>{const a=Date.parse(r.startedAt),b=Date.parse(r.completedAt),valid=r.requestedURL===r.url&&r.finalURL===r.url&&r.method&&r.status&&r.contentType&&Number.isFinite(a)&&Number.isFinite(b)&&a>=prior&&b>=a&&b<=completed;prior=b;return Boolean(valid)})
  const audit={source:SOURCE,openingNativeRows:opening.rows.length,closingNativeRows:closing.rows.length,originalResponses:receipts,rawNativeOriginals:originals,openingPublisher:{originalHTML:opening.publisher.originalHTML,bodySHA256:opening.publisher.bodySHA256,office:opening.publisher.office},closingPublisher:{originalHTML:closing.publisher.originalHTML,bodySHA256:closing.publisher.bodySHA256,office:closing.publisher.office},nativeLoadingContract:opening.contract,openingInventoryPages:opening.pages,closingInventoryPages:closing.pages,wholeNativeRoleModelsClosingReconciled:true,transportEvidenceWithinRun:transportWithinRun,companyInventoryComplete:false,lifecycleCleanupAllowed:false,publisherProgramsExecuted:false,applicationInteractions:0}
  const observations=opening.details.map(first=>{const last=closing.details.find(j=>j.sourceUrl===first.sourceUrl),nativeSourceRecord={listing:first.nativeListingModel,role:first.nativeRoleModel,office:first.nativeOfficeContext.wholeContext},nativeClosingRecord={listing:last.nativeListingModel,role:last.nativeRoleModel,office:last.nativeOfficeContext.wholeContext};return{...first,nativeSourceRecord,nativeClosingRecord,nativeClosingPublicationState:publicationState(last),sourceRawClosingNativeRole:last.sourceRawNativeRole,sourceRawClosingNativeRoleSHA256:last.sourceRawNativeRoleSHA256,sourceDetailComplete:transportWithinRun&&first.nativeRoleCriteriaReconciled&&last.nativeRoleCriteriaReconciled,nativeRoleClosingReconciled:true,nativeCollectionAudit:audit}})
  if(options.onAudit)await abortable(()=>options.onAudit(structuredClone({...audit,observations})),signal)
  const now=options.now||factoryNow
  const jobs=observations.slice(0,cap).map(j=>{let scrapedAt;try{scrapedAt=now()}catch(error){signal?.throwIfAborted();throw error}signal?.throwIfAborted();return{...j,source:SOURCE,company:COMPANY,link:j.sourceUrl,companyCareerPage:ENTRY,companyDomain:'spec-india.com',scrapedAt,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false}})
  Object.defineProperty(jobs,'sourceAudit',{value:audit});signal?.throwIfAborted();return finish(jobs,receipts.length,transportWithinRun&&jobs.every(j=>j.sourceDetailComplete))
 }}
}
