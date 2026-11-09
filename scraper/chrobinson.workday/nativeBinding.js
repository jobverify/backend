import {readNativeDocument,extractActiveDescription,decodeNativeHtml} from './nativeHtml.js'
export const CAREERS='https://www.chrobinson.com/en-us/about-us/careers/'
export const BOARD='https://chrobinson.wd5.myworkdayjobs.com/CHRobinson'
export const TALENT_NETWORK=BOARD+'/page/3e8b8b1707d61001a64a805e2ac80000'
export const LEGAL_EMPLOYERS=['090 C.H. Robinson Worldwide Freight India Private Limited','083 C.H. Robinson Worldwide GmbH']
const check=(ok,message)=>{if(!ok)throw Error('C.H. Robinson current native binding: '+message)}
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
async function bounded(signal,fn){signal.throwIfAborted();let listener;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);signal.throwIfAborted()}}
export async function verifyCHRobinsonBinding({fetchPage,signal=AbortSignal.timeout(30000),now=new Date().toISOString()}={}){
 check(Number.isFinite(Date.parse(now)),'Invalid current time')
 const p=await bounded(signal,async()=>{if(fetchPage)return fetchPage(CAREERS,{signal});const r=await fetch(CAREERS,{signal,redirect:'error',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}});return{status:r.status,url:r.url,body:await r.text()}})
 check(p?.status===200&&p.url===CAREERS&&typeof p.body==='string'&&p.body.length<=2000000,'Current corporate HTTP or final URL unavailable')
 const d=readNativeDocument(p.body),canonicals=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 check(canonicals.length===1&&canonicals[0].attrs.href===CAREERS,'Current corporate canonical missing')
 check(d.nodes(n=>n.tag==='title').some(n=>norm(n.raw)==='Careers | C.H. Robinson'),'Current corporate title missing')
 const anchors=d.nodes(n=>n.tag==='a'&&n.attrs.href===TALENT_NETWORK)
 check(anchors.some(n=>d.text(n)==='Sign up now'&&n.attrs['trk-desc']==='Careers-join-our-talent-network-cta'),'Current active exact Workday talent-network handoff missing')
 return{officialURL:CAREERS,careersURL:CAREERS,boardURL:BOARD,observedHandoffURL:TALENT_NETWORK,handoffKind:'corporate-join-our-talent-network-same-native-site',companyScopeComplete:false,checkedAt:now}
}

export function validateCHRobinsonMappedJobs(jobs){
 check(Array.isArray(jobs),'Expected native jobs')
 for(const job of jobs){
  check(job.source==='chrobinson'&&job.company==='C.H. Robinson'&&LEGAL_EMPLOYERS.includes(job.nativeEmployer)&&job.country==='India'&&job.sourceDetailComplete===true,'Native regional employer/country/content mismatch')
  const active=extractActiveDescription(job.sourceDescription)
  check(active&&norm(active)===norm(decodeNativeHtml(job.jobDescription)),'Native full role description is inactive or inconsistent')
  const sentences=active.split(/(?<=[.!?])\s+/)
  check(!/\b(?:(?:this|the)\s+(?:job|position|vacancy|role)\s+(?:is\s+(?:no longer available|closed|not available)|has\s+(?:been\s+(?:closed|filled)|expired))|(?:we are\s+)?no longer accepting applications)\b/i.test(active),'Native role description explicitly closes the position or is no longer accepting applications')
  const substantive=sentences.filter(s=>!/^(?:please\s+)?(?:(?:click|select|press|tap)\s+(?:the\s+)?)?apply(?:\s+now)?(?:\s+button)?\b.*\b(?:view|learn|description|application|access|details|requirements|instructions|recruitment|qualifications|responsibilities)\b/i.test(s)&&!/^(?:please\s+)?(?:submit|complete|start|send)\s+(?:(?:your|an?|the)\s+)?application\b.*\b(?:view|access|learn|information|details|responsibilities|qualifications)\b/i.test(s)&&!/^(?:the\s+)?(?:full\s+|detailed\s+)?job description\b.*\b(?:unavailable|not available|available soon|coming soon|available\s+(?:after|once))\b/i.test(s)&&!/^please\s+check back\b/i.test(s)).join(' ').replace(/\b(?:job description|apply now|sample|placeholder|read more|coming soon)\b/gi,'').replace(/[^\p{L}\p{N}]/gu,'')
  check(substantive.length>=40,'Native full role description is only an unavailable notice or application instruction')
 }
 return jobs
}
