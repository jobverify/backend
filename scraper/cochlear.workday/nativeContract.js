import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
export const BOARD='https://cochlear.wd3.myworkdayjobs.com/Cochlear_Careers'
export const LOCATION_IDS=["7e8bd2b67f8a10016e76004691bc0000","066c4eba02cc1000aecf261bfcd00000","132788a5b8bb10016e75f3c9012c0000","132788a5b8bb10016e75ebf38bb60000"]
export const JOBS_API='https://cochlear.wd3.myworkdayjobs.com/wday/cxs/cochlear/Cochlear_Careers/jobs'
export const OFFICIAL_BINDING=Object.freeze({
  "officialURL": "https://www.cochlear.com/",
  "careersURL": "https://www.cochlear.com/in/en/corporate/careers/jobs-at-cochlear",
  "boardURL": "https://cochlear.wd3.myworkdayjobs.com/Cochlear_Careers",
  "observedAt": "2026-10-21T13:41:35.782Z",
  "proof": "artifacts/full-catalog/cochlear-native-001/official-jobs-001.json",
  "proofSha256": "ee690ddb21dc49ef4e140f149f3862ca60070aabc3de93298f295853165a957f",
  "bodySha256": "f8479c06bbd6f57064f4497f707eb9fd098611e9d57bebd2273494cd1c507b38",
  "observationTransport": "actual-current-public-corporate-HTTP200-active-exact-native-link",
  "companyScopeComplete": false
})
const check=(ok,message)=>{if(!ok)throw Error('Cochlear native contract: '+message)}
export function validateCochlearDescriptions(jobs){
 for(const job of jobs){
  check(typeof job.title==='string'&&job.title.trim()&&!/[<>\u0000-\u001f]/.test(job.title),'Native title malformed')
  const document=readNativeDocument(job.sourceDescription),root=document.nodes(n=>n.tag==='root')[0]
  const mark=(node,inherited=false)=>{if(typeof node==='string')return;node.inert=Boolean(node.inert||inherited||Object.hasOwn(node.attrs,'inert'));for(const child of node.children)mark(child,node.inert)}
  mark(root)
  const text=document.text(root),sentences=text.split(/(?<=[.!?])\s+/)
  check(!/\b(?:(?:this|the) (?:job|position|role) is (?:no longer available|closed)|(?:we are )?no longer accepting applications|(?:job|position|role) has (?:been (?:closed|filled)|expired))\b/i.test(text),'Native role explicitly unavailable')
  const substantive=sentences.filter(s=>!/^(?:please\s+)?(?:click\s+(?:the\s+)?)?apply\s+now\b.*\b(?:view|learn|description|application|access|details|requirements|instructions|recruitment)\b/i.test(s)&&!/^(?:please\s+)?(?:submit|complete|start|send)\s+(?:(?:your|an|the)\s+)?application\b.*\b(?:view|access|learn|information|details)\b/i.test(s)&&!/^(?:the\s+)?(?:full\s+|detailed\s+)?job description\b.*\b(?:unavailable|not available|available soon|coming soon)\b/i.test(s)).join(' ').replace(/\b(?:job description|apply now|sample|placeholder|read more|coming soon)\b/gi,'').replace(/[^\p{L}\p{N}]/gu,'')
  check(substantive.length>=100,'Full native description missing, inactive or instructional only')
 }
 return jobs
}
function noFailureEnvelope(value){
 check(value&&typeof value==='object'&&!Array.isArray(value),'Native listing object missing')
 for(const[key,field]of Object.entries(value)){
  const name=key.toLowerCase().replace(/[_\s-]/g,'')
  check(!['error','errors','errorcode','errormessage','exception','fault'].includes(name),'Native listing error envelope')
  if(['ok','success'].includes(name))check(field===true,'Native listing failed status')
  if(['status','statuscode','httpstatus','httpstatuscode'].includes(name))check(field===200,'Native listing failed HTTP status')
  if(['meta','metadata','result','response'].includes(name)&&field!=null)noFailureEnvelope(field)
 }
}
export async function verifyFinalLocationListing(jobs,{signal}={}){
 check(Array.isArray(jobs)&&jobs.length<=2000,'Selected native inventory over bounded limit')
 const seen=new Set(),metadataTotals=[],pages=Math.max(1,Math.ceil(jobs.length/20))
 for(let page=0;page<pages;page++){
  signal?.throwIfAborted()
  const response=await fetch(JOBS_API,{method:'POST',body:JSON.stringify({appliedFacets:{locations:LOCATION_IDS},limit:20,offset:page*20,searchText:''}),
    headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':'Mozilla/5.0'},signal,redirect:'error'})
  signal?.throwIfAborted();check(response.status===200&&response.url===JOBS_API,'Final native listing HTTP or identity failure')
  const payload=await response.json();signal?.throwIfAborted();noFailureEnvelope(payload)
  check(Number.isSafeInteger(payload.total)&&Array.isArray(payload.jobPostings),'Final native listing schema unavailable')
  const expected=Math.min(20,jobs.length-page*20)
  check(payload.jobPostings.length===expected,'Final native page truncated or changed')
  // Current public CXS deliberately omits totals/facets on later pages, using
  // total:0 alongside actual nonempty rows. The first positive total plus exact
  // unique role enumeration is authoritative; that metadata never means zero.
  check(payload.total===jobs.length||(page>0&&payload.total===0&&expected>0),'Final native selected total changed')
  metadataTotals.push(payload.total)
  for(const row of payload.jobPostings){
   check(row&&typeof row.externalPath==='string'&&/^\/job\/[^?#]+$/.test(row.externalPath),'Final native row identity invalid')
   check(!seen.has(row.externalPath),'Final native duplicate role');seen.add(row.externalPath)
   const canonical=BOARD+row.externalPath,job=jobs.find(j=>j.sourceUrl.replace('/en-US/','/')===canonical)
   check(job&&row.title===job.title,'Final native role/title changed')
   check(Array.isArray(row.bulletFields)&&row.bulletFields.includes(job.requisitionId),'Final native requisition changed')
  }
 }
 signal?.throwIfAborted();check(seen.size===jobs.length,'Final native listing omitted selected roles')
 return{allPagesRechecked:true,pagesFetched:pages,observedNativeLocationFacetRecords:jobs.length,perPageMetadataTotals:metadataTotals,companyGlobalTotal:null,companyIndiaTotal:null}
}
