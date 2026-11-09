import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {SOURCE,COMPANY,LIFE,BOARD,FACILITIES,OFFICES,sha,need,stable,readLife,readBoard,readFacilities,readOffices,readRole} from './nativeCurrentModels.js'
const cancel=body=>{try{Promise.resolve(body?.cancel()).catch(()=>{})}catch{}}
async function abortable(start,signal){signal?.throwIfAborted();let listener;const cancelled=new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal?.addEventListener('abort',listener,{once:true})});try{return await Promise.race([Promise.resolve().then(()=>{signal?.throwIfAborted();return start()}),cancelled])}finally{signal?.removeEventListener('abort',listener)}}
async function publicRead(url,{signal}){
 const startedAt=new Date().toISOString();let response
 try{
  response=await fetch(url,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'text/html'},signal})
  if(response.status!==200){cancel(response.body);throw Object.assign(Error('Syrma native HTTP '+response.status),{status:response.status,abortRetries:true,inventoryEvidence:{status:'coverage-gap',reportedTotal:null}})}
  need(response.url===url,'public response URL changed');need(!response.headers.get('content-length')||Number(response.headers.get('content-length'))<=4000000,'oversized native body')
  const chunks=[];let size=0;try{for await(const chunk of response.body){size+=chunk.byteLength;need(size<=4000000,'oversized original response');chunks.push(Buffer.from(chunk))}}finally{cancel(response.body)}
  return{bytes:Buffer.concat(chunks),requestedURL:url,finalURL:response.url,method:'GET',body:null,status:200,headers:Object.fromEntries(response.headers),contentType:response.headers.get('content-type')||'',startedAt,completedAt:new Date().toISOString()}
 }catch(error){cancel(response?.body);signal?.throwIfAborted();if(error.abortRetries)throw error;throw Object.assign(Error('Syrma native transport: '+error.message),{abortRetries:true,cause:error,inventoryEvidence:{status:'coverage-gap',reportedTotal:null}})}
}
const publication=j=>({qualified:j.nativeRoleQualified,closed:j.nativePublishedClosedNotice,future:j.nativePublicationDateFuture,expired:j.nativePublicationExpired,criteria:j.nativeRoleCriteriaReconciled,country:j.nativeRoleCountryReconciled,employer:j.nativeEmployerReconciled})
export function createCurrentSyrmaScraper(configuration={}){const{maxJobs:factoryCap=Infinity,now:factoryNow=()=>new Date().toISOString()}=configuration;return{async run(runtime={}){
 const started=Date.now(),options={...configuration,...runtime},{signal}=options;signal?.throwIfAborted();const cap=Object.hasOwn(runtime,'maxJobs')&&runtime.maxJobs!==undefined?runtime.maxJobs??Infinity:factoryCap??Infinity
 if(!(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0))throw new RangeError('Syrma invalid result cap')
 if(options.maxPages!=null&&options.maxPages!==Infinity)throw new RangeError('Syrma finite native inventory truncation is unsupported')
 const finish=(jobs,reads=0,current=false)=>attachInventoryEvidence(jobs,{status:'coverage-gap',surface:LIFE,firstParty:current,listingComplete:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:'Native published cohort only; ambiguous countries, application availability, complete company inventory and cleanup remain unqualified'})
 if(cap===0)return finish([])
 const receipts=[],originals=[],allowed=new Set([LIFE,BOARD,FACILITIES,OFFICES])
 const read=async url=>{
  signal?.throwIfAborted();need(allowed.has(url),'unreviewed native request');const deadline=AbortSignal.timeout(20000),attempt=signal?AbortSignal.any([signal,deadline]):deadline
  let value;try{value=await abortable(()=>options.fetchResponse?options.fetchResponse(url,{method:'GET',body:null,signal:attempt}):options.fetchText?options.fetchText(url,{method:'GET',body:null,signal:attempt}):publicRead(url,{signal:attempt}),attempt)}catch(error){signal?.throwIfAborted();throw error}
  signal?.throwIfAborted();const p=typeof value==='string'?{html:value}:value;need(p&&typeof p==='object','original response packet required')
  const bytes=Buffer.isBuffer(p.bytes)?p.bytes:typeof p.bodyBase64==='string'?Buffer.from(p.bodyBase64,'base64'):typeof p.html==='string'?Buffer.from(p.html):null
  need(bytes?.length>0&&bytes.length<=4000000,'bounded original HTML bytes required');const html=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),headers=p.headers instanceof Headers?Object.fromEntries(p.headers):p.headers||{},contentType=p.contentType??headers['content-type']??null
  need((p.status??200)===200,'HTTP '+p.status+' for '+url);need(contentType===null||/^text\/html\b/i.test(contentType),'native HTML content type changed')
  if(p.method!==undefined)need(p.method==='GET','response method metadata differs');if(p.body!==undefined)need(p.body===null,'response request body metadata differs')
  for(const f of ['url','requestedURL','finalURL'])if(p[f]!==undefined)need(p[f]===url,'response URL metadata differs')
  if(p.html!==undefined)need(p.html===html,'native bytes and text disagree');if(p.bodySHA256!==undefined)need(p.bodySHA256===sha(bytes),'native original digest differs')
  const receipt={url,requestedURL:p.requestedURL??p.url??null,finalURL:p.finalURL??p.url??null,method:p.method??null,body:p.body??null,status:p.status??null,contentType,startedAt:p.startedAt??null,completedAt:p.completedAt??null,bodySHA256:sha(bytes),bodyBytes:bytes.length};receipts.push(receipt);originals.push({...receipt,html,bodyBase64:bytes.toString('base64')});return html
 }
 const snapshot=async expected=>{
  const publisher=readLife(await read(LIFE)),board=readBoard(await read(BOARD)),facilities=readFacilities(await read(FACILITIES)),offices=readOffices(await read(OFFICES)),context={publisher,board:board.model,facilities,offices}
  if(expected)need(stable(context)===stable(expected.context),'closing publisher or office context changed')
  for(const row of board.rows)allowed.add(row.sourceUrl)
  const roles=[];for(const row of board.rows){const html=await read(row.sourceUrl),role=readRole(html,row,offices,receipts.at(-1).completedAt||new Date().toISOString());if(expected){const prior=expected.roles.find(j=>j.sourceUrl===role.sourceUrl);need(prior&&stable(role.nativeRoleModel)===stable(prior.nativeRoleModel),'closing whole native role model changed');need(stable(publication(role))===stable(publication(prior))&&stable(role.sourceWorksiteCountryProof)===stable(prior.sourceWorksiteCountryProof),'closing native role publication or country changed')}roles.push(role);signal?.throwIfAborted()}
  return{context,rows:board.rows,roles}
 }
 const opening=await snapshot(),closing=await snapshot(opening),completed=Date.now();let previous=started
 const current=receipts.every(r=>{const a=Date.parse(r.startedAt),b=Date.parse(r.completedAt),valid=r.requestedURL===r.url&&r.finalURL===r.url&&r.method==='GET'&&r.status===200&&r.contentType&&a>=previous&&b>=a&&b<=completed;previous=b;return Boolean(valid)})
 const observations=opening.roles.map(first=>{const last=closing.roles.find(j=>j.sourceUrl===first.sourceUrl);return{...first,nativeSourceRecord:{listing:first.nativeListingModel,role:first.nativeRoleModel,offices:opening.context.offices,facilities:opening.context.facilities},nativeClosingRecord:{listing:last.nativeListingModel,role:last.nativeRoleModel,offices:closing.context.offices,facilities:closing.context.facilities},sourceRawClosingNativeRole:last.sourceRawNativeRole,sourceRawClosingNativeRoleSHA256:last.sourceRawNativeRoleSHA256,nativeClosingPublicationState:publication(last),nativeRoleClosingReconciled:true,sourceDetailComplete:current&&first.nativeRoleQualified&&last.nativeRoleQualified}})
 const observed={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
 const audit={...observed,observations,openingContext:opening.context,closingContext:closing.context,originalResponses:receipts,rawNativeOriginals:originals,wholeNativeRoleModelsClosingReconciled:true,transportEvidenceWithinRun:current,publisherProgramsExecuted:false,applicationInteractions:0,companyInventoryComplete:false,lifecycleCleanupAllowed:false}
 if(options.onAudit)await abortable(()=>options.onAudit(structuredClone(audit)),signal)
 const jobs=observations.filter(j=>j.sourceDetailComplete&&j.country==='India').slice(0,cap).map(j=>{let scrapedAt;try{scrapedAt=(options.now||factoryNow)()}catch(error){signal?.throwIfAborted();throw error}signal?.throwIfAborted();return{...j,source:SOURCE,company:COMPANY,link:j.sourceUrl,companyCareerPage:LIFE,companyDomain:'syrmasgs.com',scrapedAt,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,activeApplyVerified:false}})
 attachSourceObservationEvidence(jobs,observed)
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
 Object.defineProperty(jobs,'sourceAudit',{value:audit});signal?.throwIfAborted();return finish(jobs,receipts.length,current)
}}}
