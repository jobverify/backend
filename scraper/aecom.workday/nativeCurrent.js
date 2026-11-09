import {createHash} from 'node:crypto'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {parseNativeJSON} from './nativeJSON.js'
import {CAREERS,BOARD,SEARCH,SEARCH_HEADERS,ROLE_BASE,CLIENTS,need,nativeFailure,isNativeFailure,verifyCorporateHandoff,readBoardDeclaration,verifyClient} from './nativeDeclarations.js'
import {readIndiaFacet,readIndiaPage,readRole,reconcileModels,reconcileIndiaEnvelope,mapRole} from './nativeModels.js'

const SHA=bytes=>createHash('sha256').update(bytes).digest('hex')
const cap=(v,name)=>{if(v===null||v===undefined||v===Infinity)return Infinity;if(!Number.isSafeInteger(v)||v<0)throw new RangeError('AECOM native invalid '+name);return v}
const budget=(v,fallback,name)=>{if(v===undefined)return fallback;if(!Number.isSafeInteger(v)||v<=0||v>fallback)throw new RangeError('AECOM native invalid '+name);return v}
const cancelBody=response=>{try{Promise.resolve(response.body?.cancel()).catch(()=>{})}catch{}}
const ORIGINALS=Symbol.for('jobverify.verified-recruitment-observations')
export const readAecomOriginalResponses=jobs=>structuredClone(jobs?.[ORIGINALS]?.nativeOriginalResponses||[])
const decode=bytes=>{try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw nativeFailure('invalid UTF-8 original body')}}

// All scheduled work and observer continuations share one stop boundary. The
// original caller reason may be any value, including null or a frozen object.
function controls(parent,sourceMs){
 const controller=new AbortController(),waiters=new Set();let stopped=false,reason
 const fail=value=>{if(!stopped){stopped=true;reason=parent?.aborted?parent.reason:value;controller.abort(reason);for(const reject of [...waiters])reject(reason)}return reason}
 const check=()=>{if(parent?.aborted)fail(parent.reason);if(stopped)throw reason}
 const onAbort=()=>fail(parent.reason)
 parent?.addEventListener('abort',onAbort,{once:true})
 if(parent?.aborted)fail(parent.reason)
 const timer=setTimeout(()=>fail(nativeFailure('source deadline exceeded')),sourceMs)
 const gate=async(fn,ms,label)=>{
  check();await Promise.resolve();check()
  return new Promise((resolve,reject)=>{
   let settled=false,deadline
   const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(deadline);waiters.delete(stop);error?reject(value):resolve(value)}
   const stop=value=>finish(true,value);waiters.add(stop)
   deadline=setTimeout(()=>fail(nativeFailure(label+' deadline exceeded')),ms)
   Promise.resolve().then(()=>{check();return fn()}).then(value=>{try{check();finish(false,value)}catch(e){finish(true,e)}},error=>finish(true,fail(error)))
  })
 }
 return{signal:controller.signal,gate,check,fail,dispose:()=>{clearTimeout(timer);parent?.removeEventListener('abort',onAbort)}}
}

export function createAecomScraper(defaults={}){
 return{run:runtime=>runNativeAecom(defaults.source||'aecom',Object.fromEntries(Object.entries({...defaults,...runtime}).map(([key,value])=>[key,value===undefined?defaults[key]:value])))}
}

export async function runNativeAecom(source,options={}){
 need(source==='aecom'||source==='aecomindia','unknown registration')
 const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap')
 if(maxPages!==Infinity)throw new RangeError('AECOM native finite page cap cannot qualify complete native proof')
 const readMs=budget(options.readTimeoutMs,15000,'read timeout'),observerMs=budget(options.observerTimeoutMs,15000,'observer timeout'),sourceMs=budget(options.sourceTimeoutMs,900000,'source timeout')
 const control=controls(options.signal,sourceMs),requests=[],originals=[]
 const finish=jobs=>{
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:requests.filter(r=>r.url.startsWith(SEARCH)).length,reason:maxJobs===0?'caller-zero-cap-no-inventory-proof':'native-india-channel-observations-not-company-inventory'})
  attachSourceObservationEvidence(jobs,{source,recordKind:'vacancy-rows',observedRecordCount:observedCount,observedVacancyCount:observedCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  const retained=originals.map(p=>Object.freeze({...p,requestHeaders:Object.freeze({...p.requestHeaders})}))
  Object.defineProperty(jobs,ORIGINALS,{value:Object.freeze({source,nativeOriginalResponses:Object.freeze(retained),sourceScopeComplete:false,lifecycleCleanupAllowed:false})})
  return jobs
 }
 let observedCount=0
 try{
  control.check()
  if(maxJobs===0)return finish([])
  const read=async(url,headers={Accept:'text/html,application/javascript'})=>control.gate(async()=>{
   control.check()
   const init={method:'GET',redirect:'manual',credentials:'omit',headers:{...headers},signal:control.signal}
   const original={source,sequence:originals.length+1,requestedURL:url,method:'GET',body:null,requestHeaders:{...headers},startedAt:new Date().toISOString(),originalBodyComplete:false}
   originals.push(original)
   let bytes,status,finalURL,contentType,startedAt=new Date().toISOString(),completedAt
   if(options.fetchResponse){
    const result=await options.fetchResponse(url,init);control.check()
    status=result?.status;finalURL=result?.finalURL;contentType=result?.contentType||''
    Object.assign(original,{status,finalURL,contentType,completedAt:new Date().toISOString()})
    need(Buffer.isBuffer(result.bytes)||result.bytes instanceof Uint8Array||typeof result.html==='string','response has no original bytes')
    bytes=Buffer.from(result.bytes||result.html,'utf8')
    Object.assign(original,{bodyBase64:bytes.toString('base64'),bodyBytes:bytes.length,bodySHA256:SHA(bytes),originalBodyComplete:true})
    need(status===200,'HTTP '+status+' at '+url);need(finalURL===url,'unexpected redirect or response identity')
    if(result.html!==undefined)need(decode(bytes)===result.html,'original body and text differ')
    if(result.bodySHA256!==undefined)need(SHA(bytes)===result.bodySHA256,'original response hash differs')
    startedAt=result.startedAt||startedAt;completedAt=result.completedAt
   }else{
    const response=await (options.fetchImpl||globalThis.fetch)(url,init)
    if(control.signal.aborted){cancelBody(response);control.check()}
    control.check()
    status=response.status;finalURL=response.url;contentType=response.headers.get('content-type')||''
    Object.assign(original,{status,finalURL,contentType,completedAt:new Date().toISOString()})
    if(status!==200||finalURL!==url){cancelBody(response);need(status===200,'HTTP '+status+' at '+url);need(false,'unexpected redirect or response identity')}
    const chunks=[];let size=0,cancelled=false,reader
    if(typeof response.body?.getReader==='function')reader=response.body.getReader()
    const stopBody=()=>{
     if(cancelled)return;cancelled=true
     if(control.signal.aborted){const partial=Buffer.concat(chunks);Object.assign(original,{completedAt:new Date().toISOString(),bodyBase64:partial.toString('base64'),bodyBytes:partial.length,bodySHA256:SHA(partial),originalBodyComplete:false})}
     if(reader){try{Promise.resolve(reader.cancel(control.signal.reason)).catch(()=>{})}catch{};try{reader.releaseLock()}catch{}}
     else cancelBody(response)
    }
    control.signal.addEventListener('abort',stopBody,{once:true})
    const add=chunk=>{control.check();size+=chunk.byteLength;need(size<=4000000,'response exceeds native body limit');chunks.push(Buffer.from(chunk))}
    try{
     if(reader)for(;;){const item=await reader.read();if(item.done)break;add(item.value)}
     else for await(const chunk of response.body)add(chunk)
    }finally{control.signal.removeEventListener('abort',stopBody);stopBody();try{reader?.releaseLock()}catch{}}
    bytes=Buffer.concat(chunks)
   }
   control.check();need(bytes.length>0&&bytes.length<=4000000,'empty or oversized original body')
   Object.assign(original,{status,finalURL,contentType,startedAt,completedAt:completedAt||new Date().toISOString(),bodyBase64:bytes.toString('base64'),bodyBytes:bytes.length,bodySHA256:SHA(bytes),originalBodyComplete:true})
   const text=decode(bytes)
   need(!text.includes('\u0000'),'NUL in original response')
   if(url.startsWith(SEARCH)||url.startsWith(ROLE_BASE))need(/application\/json/i.test(contentType),'native JSON content type differs')
   requests.push({url,status,finalURL,bodyBytes:bytes.length,bodySHA256:SHA(bytes),startedAt,completedAt:completedAt||new Date().toISOString()})
   return{bytes,text}
  },readMs,'read/body')
  const json=async(url,headers)=>{const response=await read(url,headers);try{return parseNativeJSON(response.text)}catch(error){throw nativeFailure('JSON parse failed: '+error.message)}}
  verifyCorporateHandoff((await read(CAREERS)).text)
  const declaration=readBoardDeclaration((await read(BOARD)).text)
  for(const contract of CLIENTS)verifyClient((await read(contract.url)).bytes,contract)
  const global=await json(SEARCH+'?page=1&num_items=10',SEARCH_HEADERS),facet=readIndiaFacet(global),total=facet.value
  need(total>0,'zero facet does not establish complete company inventory')
  const readListings=async()=>{
   const rows=[],models=[],ids=new Set()
   for(let page=1;page<=Math.ceil(total/10);page++){
    control.check()
    const model=await json(SEARCH+'?page='+page+'&location=ind&num_items=10',SEARCH_HEADERS)
    for(const row of readIndiaPage(model,page,total)){need(!ids.has(row.guid),'duplicate listing GUID across pages');ids.add(row.guid);rows.push(row)}
    models.push(model)
   }
   need(rows.length===total,'native listing total differs');return{rows,models}
  }
  const openingListings=await readListings(),now=Date.now()
  const details=async rows=>{
   const result=Array(rows.length);let next=0
   const worker=async()=>{
    while(next<rows.length){
     control.check();const index=next++,listing=rows[index]
     try{const model=await json(ROLE_BASE+listing.guid+'.json',{Accept:'application/json'});control.check();result[index]=readRole(model,listing,now)}catch(error){throw control.fail(error)}
    }
   }
   const settled=await Promise.allSettled(Array.from({length:Math.min(4,rows.length)},worker))
   control.check();for(const row of settled)if(row.status==='rejected')throw row.reason
   return result
  }
  const opening=await details(openingListings.rows)
  const closingGlobal=await json(SEARCH+'?page=1&num_items=10',SEARCH_HEADERS)
  need(readIndiaFacet(closingGlobal).value===total,'closing native India facet changed')
  const closingListings=await readListings(),closingByID=new Map(closingListings.rows.map(row=>[row.guid,row]))
  for(let i=0;i<openingListings.models.length;i++)reconcileIndiaEnvelope(openingListings.models[i],closingListings.models[i])
  for(const row of openingListings.rows){need(closingByID.has(row.guid),'closing listing identity changed');reconcileModels(row,closingByID.get(row.guid),'listing')}
  const closing=await details(openingListings.rows.map(row=>closingByID.get(row.guid)))
  for(let i=0;i<total;i++)reconcileModels(opening[i].model,closing[i].model,'role')
  control.check()
  const clock=options.now===undefined?new Date():typeof options.now==='function'?options.now():options.now
  control.check();const at=new Date(clock).toISOString()
  const all=opening.map((role,i)=>mapRole(source,openingListings.rows[i],role,closing[i],closingByID.get(role.model.guid),declaration,at))
  observedCount=all.length
  const audit={source,records:all,requests,originalResponses:originals,reportedNativeIndiaTotal:total,openingListingModels:openingListings.models,closingListingModels:closingListings.models,openingGlobalModel:global,closingGlobalModel:closingGlobal,declaration,sourceScopeComplete:false,lifecycleCleanupAllowed:false,publisherProgramsExecuted:false,applicationInteractions:0}
  if(options.onAudit)await control.gate(()=>options.onAudit(structuredClone(audit)),observerMs,'audit observer')
  if(options.onRecords)await control.gate(()=>options.onRecords(structuredClone(all)),observerMs,'records observer')
  control.check();return finish(all.slice(0,maxJobs))
 }catch(error){const reason=control.fail(error);if(!options.signal?.aborted&&isNativeFailure(reason)&&Object.isExtensible(reason))Object.defineProperty(reason,'nativeOriginalResponses',{value:structuredClone(originals),enumerable:true});throw reason}finally{control.dispose()}
}
