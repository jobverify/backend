import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
export const BOARD='https://cba.wd3.myworkdayjobs.com/CommBank_Careers'
export const INDIA_ID='c4f78be1a8f14da0ab49ce1162348a5e'
export const JOBS_API='https://cba.wd3.myworkdayjobs.com/wday/cxs/cba/CommBank_Careers/jobs'
export const OFFICIAL_BINDING=Object.freeze({
 officialURL:'https://www.commbank.com.au/',careersURL:'https://www.commbank.com.au/about-us/careers/india.html?ei=india',
 boardURL:BOARD+'?locationCountry='+INDIA_ID,observedAt:'2026-10-21T13:23:24.850Z',
 proof:'artifacts/full-catalog/workday-discovery-020-qualification-001/commonwealthbankofaustralia-official-india-004.json',
 proofSha256:'bf1c5df2746b3edfffa39ab0dde04e31efd39f078b19ba906beeebe168ffd990',
 bodySha256:'ffde0fecdee3c15c05af26d7904c971987a9e9ba167db577db978c6d0dfbf6c9',
 observationTransport:'actual-current-public-corporate-HTTP200-active-exact-native-India-link',companyScopeComplete:false,
})
const check=(ok,message)=>{if(!ok)throw Error('CommBank native contract: '+message)}
export function validateCbaDescriptions(jobs){
 for(const job of jobs){
  check(typeof job.title==='string'&&job.title.trim()&&!/[<>\u0000-\u001f]/.test(job.title),'Native title malformed')
  const document=readNativeDocument(job.sourceDescription),root=document.nodes(n=>n.tag==='root')[0]
  const mark=(node,inherited=false)=>{if(typeof node==='string')return;node.inert=Boolean(node.inert||inherited||Object.hasOwn(node.attrs,'inert'));for(const child of node.children)mark(child,node.inert)}
  mark(root)
  const text=document.text(root),sentences=text.split(/(?<=[.!?])\s+/)
  check(!/\b(?:(?:this|the) (?:job|position|role) is (?:no longer available|closed)|(?:we are )?no longer accepting applications|(?:job|position|role) has (?:been (?:closed|filled)|expired))\b/i.test(text),'Native role explicitly unavailable')
  const substantive=sentences.filter(s=>!/^(?:please\s+)?(?:(?:click|select|press|tap)\s+(?:the\s+)?)?apply(?:\s+now)?(?:\s+button)?\b.*\b(?:view|learn|description|application|access|details|requirements|instructions|recruitment|qualifications|responsibilities)\b/i.test(s)&&!/^(?:please\s+)?(?:submit|complete|start|send)\s+(?:(?:your|an?|the)\s+)?application\b.*\b(?:view|access|learn|information|details|responsibilities|qualifications)\b/i.test(s)&&!/^(?:the\s+)?(?:full\s+|detailed\s+)?job description\b.*\b(?:unavailable|not available|available soon|coming soon|available\s+(?:after|once))\b/i.test(s)).join(' ').replace(/\b(?:job description|apply now|sample|placeholder|read more|coming soon)\b/gi,'').replace(/[^\p{L}\p{N}]/gu,'')
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
export async function verifyFinalIndiaListing(jobs,{signal}={}){
 check(Array.isArray(jobs)&&jobs.length<=2000,'Selected native inventory over bounded limit')
 const seen=new Set(),metadataTotals=[],pages=Math.max(1,Math.ceil(jobs.length/20))
 for(let page=0;page<pages;page++){
  signal?.throwIfAborted()
  const response=await fetch(JOBS_API,{method:'POST',body:JSON.stringify({appliedFacets:{locationCountry:[INDIA_ID]},limit:20,offset:page*20,searchText:''}),
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
 return{allPagesRechecked:true,pagesFetched:pages,observedNativeIndiaFacetRecords:jobs.length,perPageMetadataTotals:metadataTotals,companyGlobalTotal:null,companyIndiaTotal:null}
}
