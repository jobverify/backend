import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {HOME,BOARD,SOURCE,need,canonical,readLakeNativeHome,readLakeNativeBoard,assignedLakeSite,makeLakeObservation} from './nativeModels.js'
const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex')
const sorted=value=>Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)))
// Historical whole-page signatures remain diagnostics, never company-scope proof.
export const lakeExecutableScopeSignature = html => {
  const document = readNativeDocument(html)
  const visible = readVisibleNativeDocument(html, { strict: true })
  return hash({
    visibleText: visible.nodes(node => node.tag === 'body').map(visible.text).join(' '),
    attributes: document.nodes(node => Object.keys(node.attrs).length > 0).map(node => ({ tag: node.tag, attrs: sorted(node.attrs) })),
    scripts: document.nodes(node => node.tag === 'script').map(node => ({ attrs: sorted(node.attrs), body: node.raw || '' })),
    styles: [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(match => match[1]),
    forms: document.nodes(node => node.tag === 'form').map(node => ({ attrs: sorted(node.attrs), text: document.text(node) })),
    frames: visible.frames().map(node => sorted(node.attrs)),
  })
}

export async function runLakeCurrentInventory(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson,'HTTP response metadata required; body-only transports unsupported')
 need(options.maxPages==null,'static native scope has no page limit')
 const cap=options.maxJobs??Infinity
 need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid result cap')
 const clock=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString()
 const receipts=[],audit={source:SOURCE,observedAt:clock,nativeRecords:0,nativeRoleClosingReconciled:0,heldNativeRows:[],unknownCountryRoles:[],failures:[],reasons:['company-recruitment-scope-unverified'],complete:false,
  sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 let jobs=[]
 const finish=()=>{
  const returned=jobs.slice(0,cap)
  const observations={...structuredClone(audit),responses:structuredClone(receipts),returnedRecords:returned.length,
   unresolved:['company-recruitment-scope-unverified',...(audit.unknownCountryRoles.length?['native-role-country-unproven']:[])],
   nativeInventoryReads:[{kind:'whole-native-cards-and-role-assigned-explicit-country-worksites',surface:BOARD,reportedTotal:audit.nativeRecords}]}
  Object.defineProperty(returned,Symbol.for('jobverify.verified-recruitment-observations'),{value:observations})
  if(returned.length)returned[0].sourceNativeCollectionAudit={...structuredClone(audit),responses:structuredClone(receipts)}
  return attachInventoryEvidence(returned,{status:'coverage-gap',surface:BOARD,firstParty:receipts.length>0,listingComplete:false,reportedTotal:null,indiaFacetCount:null,
   pagesFetched:receipts.length,verifiedAt:clock,reason:'Own native cards and named worksites retain their evidence; whole company scope and cleanup remain unqualified'})
 }
 if(cap===0)return finish()
 const interval=options.minIntervalMs??1000
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(interval>=1000||typeof options.fetchImpl==='function'),'invalid source pacing')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const deadline=setTimeout(()=>controller.abort(Error('Lake source deadline')),180000),fetchImpl=options.fetchImpl||globalThis.fetch
 const cancel=value=>{try{Promise.resolve(value?.cancel()).catch(()=>{})}catch{}}
 let bytes=0,last=0
 const read=async url=>{
  signal.throwIfAborted();need([HOME,BOARD].includes(url)&&receipts.length<64,'unreviewed URL or request bound')
  const wait=interval-(Date.now()-last);if(wait>0)await delay(wait,undefined,{signal});signal.throwIfAborted();last=Date.now()
  const local=new AbortController(),combined=AbortSignal.any([signal,local.signal]);let response,reader,listener
  const timer=setTimeout(()=>local.abort(Error('Lake request deadline')),20000)
  const interrupted=new Promise((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true})})
  try{return await Promise.race([(async()=>{
   response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'manual',headers:{Accept:'text/html'},signal:combined})
   if(combined.aborted){cancel(response.body);combined.throwIfAborted()}
   need(response.url===url,'HTTP response observed URL mismatch')
   const receipt={url,method:'GET',status:response.status,bodySHA256:null,httpMetadataVerified:true};receipts.push(receipt)
   if(response.status!==200)throw Object.assign(Error('Lake native HTTP '+response.status),{status:response.status,requestUrl:url,abortRetries:true})
   need(/^text\/html\b/i.test(response.headers.get('content-type')||''),'native MIME changed')
   const length=response.headers.get('content-length'),encoding=response.headers.get('content-encoding')?.toLowerCase()
   need(length===null||/^\d+$/.test(length)&&Number(length)<=4000000,'advertised native response bound')
   need(!encoding||['identity','gzip','br','deflate'].includes(encoding),'unreviewed native encoding')
   reader=response.body?.getReader();need(reader,'native response stream missing');const chunks=[];let count=0
   for(;;){combined.throwIfAborted();const part=await reader.read();combined.throwIfAborted();if(part.done)break
    count+=part.value.byteLength;bytes+=part.value.byteLength;need(count<=4000000&&bytes<=32000000,'native response byte bound');chunks.push(Buffer.from(part.value))}
   need(length===null||encoding&&encoding!=='identity'||Number(length)===count,'native body length mismatch')
   const body=Buffer.concat(chunks),html=new TextDecoder('utf8',{fatal:true}).decode(body);receipt.bodySHA256=hash(body);receipt.rawHTML=html;return html
  })(),interrupted])}finally{clearTimeout(timer);combined.removeEventListener('abort',listener);cancel(reader||response?.body)}
 }
 const raw=(html,nativeRecord=null)=>({rawHTML:html,bodySHA256:hash(html),nativeRecord:structuredClone(nativeRecord)})
 const group=rows=>{const map=new Map();for(const row of rows){if(!map.has(row.jobId))map.set(row.jobId,[]);map.get(row.jobId).push(row)}return map}
 const held=(job,reason,phase,evidence)=>audit.heldNativeRows.push({jobId:job.jobId,title:job.title,reason,phase,...evidence})
 try{
  const homeHTML=await read(HOME);audit.openingHomepage=raw(homeHTML);const homepage=readLakeNativeHome(homeHTML)
  audit.openingHomepage.nativeRecord=structuredClone(homepage)
  const boardHTML=await read(BOARD);audit.openingBoard=raw(boardHTML);const page=readLakeNativeBoard(boardHTML),opening=group(page.rows)
  audit.openingBoard.nativeRecord=structuredClone(page);audit.nativeRecords=opening.size;audit.nativeCardObservations=page.nativeCardObservations
  audit.heldNativeRows.push(...page.held.map(row=>({...row,phase:'opening-board'})))
  const listings=[]
  for(const rows of opening.values()){
   const row=rows[0]
   if(!rows.every(r=>canonical(r.card)===canonical(row.card))){held(row,'conflicting duplicate native role observations','opening-board',{cards:rows.map(r=>structuredClone(r.card)),opening:raw(boardHTML)});continue}
   const job=makeLakeObservation(row,homepage,page,boardHTML,homeHTML,clock)
   if(job.country===null){audit.unknownCountryRoles.push({...structuredClone(row),nativeRecord:structuredClone(job.nativeSourceRecord),country:null,reason:'role-assigned-named-worksite-country-unresolved'});continue}
   jobs.push(job);listings.push(row)
  }
  const closingHomeHTML=await read(HOME),previous=jobs;audit.closingHomepage=raw(closingHomeHTML);jobs=[]
  let closingHome
  try{closingHome=readLakeNativeHome(closingHomeHTML)}catch(error){
   for(const job of previous)held(job,error.message,'closing-worksite',{opening:raw(job.sourceRawNativeHTML,job.nativeSourceRecord),closing:raw(closingHomeHTML)})
   throw error
  }
  audit.closingHomepage.nativeRecord=structuredClone(closingHome)
  for(const job of previous){
   const row=listings.find(r=>r.jobId===job.jobId),site=assignedLakeSite(row,closingHome)
   if(canonical(site)===canonical(job.nativeSourceRecord.worksite)
    &&canonical({identity:closingHome.identity,schemas:closingHome.schemas})===canonical(job.nativeSourceRecord.employerPage)){
    job.sourceClosingRawNativeEmployerHTML=closingHomeHTML;job.sourceClosingRawNativeEmployerHTMLSHA256=hash(closingHomeHTML);jobs.push(job)
   }else held(job,'closing assigned native worksite/employer model changed','closing-worksite',{opening:raw(job.sourceRawNativeHTML,job.nativeSourceRecord),
    closing:raw(closingHomeHTML,{homepage:closingHome,worksite:site})})
  }
  const closingBoardHTML=await read(BOARD),beforeBoard=jobs;audit.closingBoard=raw(closingBoardHTML);jobs=[]
  let closingPage
  try{closingPage=readLakeNativeBoard(closingBoardHTML)}catch(error){
   for(const job of beforeBoard)held(job,error.message,'closing-board',{opening:raw(job.sourceRawNativeHTML,job.nativeSourceRecord),closing:raw(closingBoardHTML)})
   throw error
  }
  audit.closingBoard.nativeRecord=structuredClone(closingPage);const ending=group(closingPage.rows)
  audit.heldNativeRows.push(...closingPage.held.map(row=>({...row,phase:'closing-board'})))
  for(const job of beforeBoard){
   const rows=ending.get(job.jobId)||[];let current
   if(rows.length&&rows.every(row=>canonical(row.card)===canonical(rows[0].card))){
    current=makeLakeObservation(rows[0],closingHome,closingPage,closingBoardHTML,closingHomeHTML,clock)
   }
   if(current&&current.country==='India'&&canonical(current.nativeSourceRecord)===canonical(job.nativeSourceRecord)){
    Object.assign(job,{nativeClosingRecord:structuredClone(current.nativeSourceRecord),sourceClosingRawNativeHTML:closingBoardHTML,sourceClosingRawNativeHTMLSHA256:hash(closingBoardHTML),
     sourceDetailComplete:true,sourceDetailStatus:'complete',nativeRoleClosingReconciled:true});jobs.push(job)
   }else held(job,'closing own native card/worksite model changed or duplicated','closing-board',{opening:raw(job.sourceRawNativeHTML,job.nativeSourceRecord),
    closing:raw(closingBoardHTML,current?.nativeSourceRecord??closingPage),cards:rows.map(r=>structuredClone(r.card))})
  }
  audit.nativeRoleClosingReconciled=jobs.length;audit.returnedIndiaJobs=jobs.length
 }catch(error){
  options.signal?.throwIfAborted();audit.failures.push({status:error.status??null,message:error.message})
  for(const job of jobs)Object.assign(job,{sourceDetailComplete:false,sourceDetailStatus:'partial',nativeRoleClosingReconciled:false})
  audit.nativeRoleClosingReconciled=0
  if(!jobs.length){Object.assign(error,{source:SOURCE,abortRetries:true,failureKind:'incomplete_listing',recruitmentObservations:{...audit,responses:receipts},
   inventoryEvidence:{status:'coverage-gap',surface:BOARD,firstParty:receipts.length>0,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:clock,reason:error.message}});throw error}
 }finally{clearTimeout(deadline)}
 await options.onAudit?.(structuredClone(audit));options.signal?.throwIfAborted();return finish()
}
