import {readNativeDocument,extractActiveDescription,decodeNativeHtml} from './nativeHtml.js'
export const CAREERS='https://www.allegion.com/corp/en/careers.html'
export const BOARD='https://allegion.wd5.myworkdayjobs.com/careers'
export const NATIVE_HANDOFF=BOARD+'/jobs'
export const LEGAL_EMPLOYERS=['Allegion India Private Limited']
const check=(ok,message)=>{if(!ok)throw Error('Allegion current native binding: '+message)}
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
async function bounded(signal,fn){signal.throwIfAborted();let listener;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);signal.throwIfAborted()}}
export async function verifyAllegionBinding({fetchPage,signal=AbortSignal.timeout(30000),now=new Date().toISOString()}={}){
 check(Number.isFinite(Date.parse(now)),'Invalid current time')
 const p=await bounded(signal,async()=>{if(fetchPage)return fetchPage(CAREERS,{signal});const r=await fetch(CAREERS,{signal,redirect:'error',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}});return{status:r.status,url:r.url,body:await r.text()}})
 check(p?.status===200&&p.url===CAREERS&&typeof p.body==='string'&&p.body.length<=2000000,'Current corporate HTTP or final URL unavailable')
 const d=readNativeDocument(p.body),canonicals=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 check(canonicals.length<=1&&canonicals.every(n=>n.attrs.href===CAREERS),'Current corporate canonical conflicts')
 const titles=d.nodes(n=>n.tag==='title')
 check(titles.length===1&&norm(titles[0].raw)==='Allegion Careers','Current corporate title missing or conflicting')
 const anchors=d.nodes(n=>n.tag==='a'&&n.attrs.href===NATIVE_HANDOFF)
 check(anchors.some(n=>d.text(n)==='Explore open jobs'&&n.attrs['aria-label']==='Explore open jobs'),'Current active exact Workday Explore-open-jobs handoff missing')
 return{officialURL:CAREERS,careersURL:CAREERS,boardURL:BOARD,observedHandoffURL:NATIVE_HANDOFF,handoffKind:'corporate-active-Explore-open-jobs',companyScopeComplete:false,checkedAt:now}
}

export function validateAllegionMappedJobs(jobs){
 check(Array.isArray(jobs),'Expected native jobs')
 for(const job of jobs){
  check(job.source==='allegion'&&job.company==='Allegion'&&LEGAL_EMPLOYERS.includes(job.nativeEmployer)&&job.country==='India'&&job.sourceDetailComplete===true,'Native regional employer/country/content mismatch')
  const active=extractActiveDescription(job.sourceDescription)
  check(active&&norm(active)===norm(decodeNativeHtml(job.jobDescription)),'Native full role description is inactive or inconsistent')
  const sentences=active.split(/(?<=[.!?])\s+/)
  check(!/\b(?:(?:this|the)\s+(?:job|position|vacancy|role)\s+(?:is\s+(?:no longer available|closed|not available)|has\s+(?:been\s+(?:closed|filled)|expired))|(?:we are\s+)?no longer accepting applications)\b/i.test(active),'Native role description explicitly closes the position or is no longer accepting applications')
  const substantive=sentences.filter(s=>!/^(?:please\s+)?(?:(?:click|select|press|tap)\s+(?:the\s+)?)?apply(?:\s+now)?(?:\s+button)?\b.*\b(?:view|learn|description|application|access|details|requirements|instructions|recruitment|qualifications|responsibilities)\b/i.test(s)&&!/^(?:please\s+)?(?:submit|complete|start|send)\s+(?:(?:your|an?|the)\s+)?application\b.*\b(?:view|access|learn|information|details|responsibilities|qualifications)\b/i.test(s)&&!/^(?:the\s+)?(?:full\s+|detailed\s+)?job description\b.*\b(?:unavailable|not available|available soon|coming soon|available\s+(?:after|once))\b/i.test(s)&&!/^please\s+check back\b/i.test(s)).join(' ').replace(/\b(?:job description|apply now|sample|placeholder|read more|coming soon)\b/gi,'').replace(/[^\p{L}\p{N}]/gu,'')
  check(substantive.length>=40,'Native full role description is only an unavailable notice or application instruction')
  // The native employer intro and equal-opportunity footer are substantial
  // text, but cannot establish duties or qualifications for the selected role.
  const document=readNativeDocument(job.sourceDescription)
  const nonRole=/^(?:At Allegion\b|Additionally,? Allegion\b|About Allegion\b|Creating Peace of Mind\b|We Celebrate Who We Are\b|Allegion is (?:committed|an equal)\b|Together, we embrace\b|©\s*Allegion\b|REGISTERED IN IRELAND\b|Privacy Policy\b|(?:please\s+)?(?:click|select|press|tap)\s+(?:the\s+)?Apply\b|(?:please\s+)?(?:submit|complete|start|send)\s+(?:your\s+)?application\b)/i
  for(const node of document.nodes(n=>['p','li','h1','h2','h3','h4','h5','h6'].includes(n.tag)))if(nonRole.test(document.text(node)))node.inert=true
  const roleText=document.text(document.nodes(n=>n.tag==='root')[0]).replace(/[^\p{L}\p{N}]/gu,'')
  if(roleText.length<80){job.sourceRejectedNativeDescription=job.sourceDescription;job.sourceDescription=null;job.jobDescription=null;job.sourceDetailComplete=false;job.sourceDetailFailureKind='unqualified-role-content'}
 }
 return jobs
}
