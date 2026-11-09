import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runWorkdayScraper} from '../../scraper-support/myworkday/engine.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {CORPORATE,ARROW,API,BOARD,INDIA,verifyCurrentHandoff,validateNativeDetail} from './nativeGuard.js'
const directory=path.dirname(fileURLToPath(import.meta.url))
const check=(ok,message)=>{if(!ok)throw new Error('eInfochips current inventory: '+message)}
function envelope(payload){
 check(payload&&typeof payload==='object'&&!Array.isArray(payload),'Malformed native envelope')
 for(const key of ['error','Error','errors','Errors','message','Message'])if(payload[key]!=null)check(payload[key]===''||(Array.isArray(payload[key])&&payload[key].length===0),'Native error envelope')
 for(const key of ['success','Success'])if(payload[key]!=null)check(payload[key]===true,'Native failure envelope')
 for(const key of ['status','Status','statusCode','StatusCode'])if(payload[key]!=null)check(payload[key]===200,'Native failure status')
 check(typeof payload.total==='number'&&Number.isSafeInteger(payload.total)&&payload.total>=0,'Native total unavailable')
 check(Array.isArray(payload.jobPostings)&&payload.jobPostings.length<=20,'Native postings unavailable')
 return payload
}
function identity(row){
 check(row&&typeof row==='object'&&typeof row.title==='string'&&row.title.trim()&&typeof row.externalPath==='string'&&/^\/job\/[^/]+\/[^/]+_R\d+(?:-\d+)?$/.test(row.externalPath),'Native listing identity unavailable')
 check(Array.isArray(row.bulletFields)&&row.bulletFields.length===1&&typeof row.bulletFields[0]==='string'&&/^R\d+$/.test(row.bulletFields[0]),'Native listing requisition unavailable')
 check(row.externalPath.match(/_(R\d+)(?:-\d+)?$/)?.[1]===row.bulletFields[0],'Native listing requisition conflict')
 return row.bulletFields[0]
}
export async function runNativeEInfochips(options={}) {
 const {fetchImpl=globalThis.fetch,runWorkday=runWorkdayScraper}=options
 const timeoutMs=options.timeoutMs??150000
 check(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000,'Invalid source deadline')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 check(Number.isFinite(Date.parse(now)),'Invalid check time')
 const cap=options.maxJobs??Infinity
 check(cap===Infinity||Number.isInteger(cap)&&cap>=0,'Invalid job cap')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('eInfochips source deadline exceeded')),timeoutMs)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const abort=()=>{if(signal.aborted)throw signal.reason||new Error('Caller aborted')}
 const bounded=async(fn)=>{abort();let listener;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason||new Error('Caller aborted'));signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);abort()}}
 async function request(url,body){const response=await bounded(()=>fetchImpl(url,{signal,redirect:'follow',headers:{Accept:body?'application/json':'text/html,application/json','Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})}));check(response.status===200&&response.url===url,'Native HTTP status or final URL changed');return response}
 async function page(offset){const response=await request(API,{appliedFacets:{Location_Country:[INDIA]},limit:20,offset,searchText:'einfochips'});return envelope(await bounded(()=>response.json()))}
 try {
  const corporate=await bounded(async()=> (await request(CORPORATE)).text()),arrow=await bounded(async()=> (await request(ARROW)).text())
  verifyCurrentHandoff(corporate,arrow)
  const shared=await bounded(()=>runWorkday({source:'einfochips',company:'eInfochips',baseUrl:BOARD,scraperDir:directory,boardIdentityVerified:true,signal}))
  const inner=readInventoryEvidence(shared)
  check(Array.isArray(shared)&&inner?.listingComplete===true&&inner.firstParty===true&&['complete-inventory','verified-empty'].includes(inner.status),'Shared enumeration incomplete')
  const first=await page(0),total=first.total,rows=[...first.jobPostings]
  check(total<=200&&rows.length===Math.min(20,total),'Native first page count mismatch or bounded inventory exceeded')
  let pagesFetched=1
  while(rows.length<total){const p=await page(rows.length);pagesFetched++;check((p.total===0||p.total===total)&&p.jobPostings.length===Math.min(20,total-rows.length),'Native pagination drift');rows.push(...p.jobPostings)}
  // CXS restarts at page zero for out-of-range offsets. Reconciled total plus
  // exact page sizes proves exhaustion; an extra offset>=total is not a terminal.
  const ids=rows.map(identity);check(new Set(ids).size===ids.length,'Duplicate native requisition')
  check(shared.length===total&&inner.reportedTotal===total,'Mapped/native enumeration count mismatch')
  const mapped=new Map(shared.map(j=>[j.requisitionId,j]));check(mapped.size===total,'Duplicate mapped requisition')
  const output=[]
  // Re-read current public details to validate the native section boundaries,
  // company identity and every secondary office before accepting shared mapping.
  for(let start=0;start<rows.length;start+=2){const chunk=await Promise.all(rows.slice(start,start+2).map(async row=>{
   const job=mapped.get(identity(row));check(job&&job.title===row.title&&job.link===BOARD+row.externalPath,'Mapped/native role identity mismatch')
   const detail=await request(API.slice(0,-5)+row.externalPath),payload=await bounded(()=>detail.json())
   return validateNativeDetail(payload,job,{now})
  }));output.push(...chunk)}
  const end=await page(0);pagesFetched++
  check(end.total===total&&JSON.stringify(end.jobPostings.map(r=>[identity(r),r.title,r.externalPath]))===JSON.stringify(first.jobPostings.map(r=>[identity(r),r.title,r.externalPath])),'Final native inventory drift')
  abort()
  return attachInventoryEvidence(output.slice(0,cap),{status:'coverage-gap',surface:ARROW,firstParty:true,listingComplete:false,pagesFetched,reportedTotal:total,indiaFacetCount:total,verifiedAt:now,reason:cap<output.length?'caller-cap-and-official-keyword-company-scope-unresolved':'official-keyword-scope-not-proven-complete-company'})
 } finally {clearTimeout(timer)}
}
