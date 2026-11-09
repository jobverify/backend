import {readNativeDocument,extractActiveDescription,decodeNativeHtml} from './nativeHtml.js'
export const HOME='https://www.carelonglobal.in/',CAREERS=HOME+'careers',BOARD='https://elevancehealth.wd1.myworkdayjobs.com/en-US/carelonglobal_in',LEGAL_EMPLOYER='Carelon Global Solutions India LLP'
const check=(ok,message)=>{if(!ok)throw Error('Carelon current native binding: '+message)},norm=value=>String(value??'').replace(/\s+/g,' ').trim()
async function bounded(signal,fn){signal.throwIfAborted();let listener;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);signal.throwIfAborted()}}
export async function verifyCarelonBinding({fetchPage,signal=AbortSignal.timeout(30000),now=new Date().toISOString()}={}){
 check(Number.isFinite(Date.parse(now)),'Invalid current time')
 async function get(url){const p=await bounded(signal,async()=>{if(fetchPage)return fetchPage(url,{signal});const r=await fetch(url,{signal,redirect:'error',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}});return{status:r.status,url:r.url,body:await r.text()}});check(p?.status===200&&p.url===url&&typeof p.body==='string'&&p.body.length<=2000000,'Current official HTTP or final URL unavailable');const d=readNativeDocument(p.body),canonicals=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical');check(canonicals.length===1&&new URL(canonicals[0].attrs.href).href===url,'Current corporate canonical missing');return d}
 const home=await get(HOME),careers=await get(CAREERS),activeHref=(d,base,url)=>d.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string').some(n=>{try{return new URL(n.attrs.href,base).href===url}catch{return false}})
 check(home.nodes(n=>n.tag==='title').some(n=>norm(n.raw)==='Transforming Healthcare | Carelon Global Solutions India')&&activeHref(home,HOME,CAREERS),'Current corporate identity/careers handoff missing')
 check(careers.nodes(n=>n.tag==='title').some(n=>norm(n.raw)==='Careers | Carelon Global Solutions India')&&careers.nodes(n=>n.tag==='h1').some(n=>careers.text(n)==='India careers')&&activeHref(careers,CAREERS,BOARD),'Current India regional Workday handoff missing')
 check(careers.text(careers.nodes(n=>n.tag==='root')[0]).includes(LEGAL_EMPLOYER),'Current regional employer identity missing')
 return{officialURL:HOME,careersURL:CAREERS,boardURL:BOARD,regionalEntity:LEGAL_EMPLOYER,region:'India',companyScopeComplete:false,checkedAt:now}
}
export function validateCarelonMappedJobs(jobs){
 check(Array.isArray(jobs),'Expected native jobs')
 for(const job of jobs){
  check(job.source==='carelonglobalsolutions'&&job.company==='Carelon Global Solutions'&&job.nativeEmployer===LEGAL_EMPLOYER&&job.country==='India'&&job.sourceDetailComplete===true,'Native regional employer/country/content mismatch')
  const active=extractActiveDescription(job.sourceDescription)
  check(active&&norm(active)===norm(decodeNativeHtml(job.jobDescription)),'Native full role description is inactive or inconsistent')
  const sentences=active.split(/(?<=[.!?])\s+/)
  check(!/\b(?:(?:this|the)\s+(?:job|position|vacancy|role)\s+(?:is\s+(?:no longer available|closed|not available)|has\s+(?:been\s+(?:closed|filled)|expired))|(?:we are\s+)?no longer accepting applications)\b/i.test(active),'Native role description explicitly closes the position')
  const substantive=sentences.filter(s=>!/^(?:please\s+)?(?:(?:click|select|press|tap)\s+(?:the\s+)?)?apply(?:\s+now)?(?:\s+button)?\b.*\b(?:view|learn|description|application|access|details|requirements|instructions|recruitment|qualifications|responsibilities)\b/i.test(s)&&!/^(?:please\s+)?(?:submit|complete|start|send)\s+(?:(?:your|an?|the)\s+)?application\b.*\b(?:view|access|learn|information|details|responsibilities|qualifications)\b/i.test(s)&&!/^(?:the\s+)?(?:full\s+|detailed\s+)?job description\b.*\b(?:unavailable|not available|available soon|coming soon|available\s+(?:after|once))\b/i.test(s)&&!/^please\s+check back\b/i.test(s)).join(' ').replace(/\b(?:job description|apply now|sample|placeholder|read more|coming soon)\b/gi,'').replace(/[^\p{L}\p{N}]/gu,'')
  check(substantive.length>=40,'Native full role description is only an unavailable notice or application instruction')
 }
 return jobs
}
