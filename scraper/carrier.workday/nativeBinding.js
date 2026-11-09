import {readNativeDocument,extractActiveDescription,decodeNativeHtml} from './nativeHtml.js'
export const HOME='https://www.carrier.com/us/en/careers/',CAREERS='https://jobs.carrier.com/en',BOARD='https://carrier.wd5.myworkdayjobs.com/jobs'
// Retained for the archived regression fixture. Live binding discovers a role
// from the current official search form instead of depending on this vacancy.
export const ROLE='https://jobs.carrier.com/en/job/hyderabad/salesforce-developer-with-cpq/29289/101934204896'
export const EMPLOYER_PATTERN=/^(?:4040 Carrier Technologies India Limited|4010 Carrier Airconditioning & Refrigeration Ltd|4020 EcoEnergy Insights Limited)$/
const check=(ok,message)=>{if(!ok)throw Error('Carrier current native binding: '+message)},norm=value=>String(value??'').replace(/\s+/g,' ').trim()
async function bounded(signal,fn){signal.throwIfAborted();let listener;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);signal.throwIfAborted()}}
export async function verifyCarrierBinding({fetchPage,signal=AbortSignal.timeout(30000),now=new Date().toISOString()}={}){
 check(Number.isFinite(Date.parse(now)),'Invalid current time')
 async function get(url,requireCanonical=true){const p=await bounded(signal,async()=>{if(fetchPage)return fetchPage(url,{signal});const r=await fetch(url,{signal,redirect:'error',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}});return{status:r.status,url:r.url,body:await r.text()}});check(p?.status===200&&p.url===url&&typeof p.body==='string'&&p.body.length<=2000000,'Current official HTTP or final URL unavailable');const d=readNativeDocument(p.body),c=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical');if(requireCanonical)check(c.length===1&&c[0].attrs.href===url,'Current corporate canonical missing');return d}
 const links=(d,base)=>d.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string').flatMap(n=>{try{const u=new URL(n.attrs.href,base);return u.protocol==='https:'&&!u.username&&!u.password?[u.href]:[]}catch{return[]}})
 const home=await get(HOME);check(home.nodes(n=>n.tag==='title').some(n=>norm(n.raw)==='Careers | Carrier')&&links(home,HOME).includes(CAREERS),'Current corporate careers handoff missing')
 const careers=await get(CAREERS);check(careers.nodes(n=>n.tag==='title').some(n=>norm(n.raw)==='Working at Carrier')&&links(careers,CAREERS).includes(BOARD+'/login'),'Current native board handoff missing')
 const descendants=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>descendants(child,predicate))]
 const searchForms=careers.nodes(n=>n.tag==='form'&&n.attrs.action==='/en/search-jobs'&&(!n.attrs.method||n.attrs.method.toLowerCase()==='get'))
  .filter(form=>descendants(form,n=>n.tag==='input'&&n.attrs.name==='k'&&n.attrs.type==='search').length===1)
 check(searchForms.length>0,'Current official keyword search form missing')
 const searchURL=new URL(searchForms[0].attrs.action,CAREERS);searchURL.searchParams.set('k','India')
 // This current GET result page has no canonical element. Its exact official
 // response URL, active title and advertised role links bind discovery only.
 const search=await get(searchURL.href,false)
 check(search.nodes(n=>n.tag==='title').some(n=>norm(n.raw)==='Search our Job Opportunities at Carrier'),'Current public search identity missing')
 const candidates=search.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string').flatMap(node=>{
  try{const url=new URL(node.attrs.href,searchURL),headings=descendants(node,n=>n.tag==='h2');return url.origin===new URL(CAREERS).origin&&/^\/en\/job\/[^/]+\/[^/]+\/29289\/\d+$/.test(url.pathname)&&!url.search&&!url.hash&&!url.username&&!url.password&&/\bIndia\b/.test(search.text(node))&&headings.length===1&&search.text(headings[0])?[{url:url.href,title:search.text(headings[0])}]:[]}catch{return[]}
 })
 check(candidates.length>0,'Current public India role handoff missing')
 const {url:publicRoleURL,title}=candidates[0],role=await get(publicRoleURL)
 check(role.nodes(n=>n.tag==='h1').some(n=>role.text(n)===title)&&role.nodes(n=>n.tag==='title').some(n=>norm(n.raw)===title+' at Carrier'),'Current public role title missing')
 const nativeIds=role.nodes(n=>n.tag==='meta'&&n.attrs.name==='job-ats-req-id')
 check(nativeIds.length===1&&/^\d{8}$/.test(nativeIds[0].attrs.content),'Current public requisition missing')
 const nativeRequisitionId=nativeIds[0].attrs.content,visibleIds=role.nodes(n=>n.tag==='span'&&role.hasClass(n,'job-id'))
 check(visibleIds.length===1&&role.text(visibleIds[0])==='Job ID '+nativeRequisitionId,'Current visible public requisition disagrees')
 const applications=[...new Set(links(role,publicRoleURL).filter(value=>{const u=new URL(value);return u.origin===new URL(BOARD).origin&&new RegExp('^/jobs/job/[^/]+/[^/]+_'+nativeRequisitionId+'(?:-\\d+)?/apply$').test(u.pathname)&&!u.search&&!u.hash}))];check(applications.length===1,'Current exact public application handoff missing')
 return{officialURL:HOME,careersURL:CAREERS,boardURL:BOARD,publicRoleURL,title,nativeRequisitionId,nativeCanonicalURL:applications[0].slice(0,-6),region:'India',companyScopeComplete:false,checkedAt:now}
}
export function validateCarrierMappedJobs(jobs,binding){
 check(Array.isArray(jobs),'Expected native jobs')
 for(const job of jobs){
  check(job.source==='carrier'&&job.company==='Carrier'&&EMPLOYER_PATTERN.test(job.nativeEmployer)&&job.country==='India'&&job.sourceDetailComplete===true,'Native regional employer/country/content mismatch')
  const active=extractActiveDescription(job.sourceDescription)
  check(active&&norm(active)===norm(decodeNativeHtml(job.jobDescription)),'Native full role description is inactive or inconsistent')
  const sentences=active.split(/(?<=[.!?])\s+/)
  check(!sentences.some(s=>/^(?:this|the)\s+(?:job|position|vacancy)\s+is\s+(?:no longer available|closed|not available)\b/i.test(s)),'Native role description explicitly closes the position')
  const substantive=sentences.filter(s=>!/^(?:please\s+)?(?:click\s+)?apply\s+now\b.*\b(?:view|learn|description|application)\b/i.test(s)&&!/^(?:the\s+)?(?:full\s+|detailed\s+)?job description\b.*\b(?:unavailable|not available|available soon|coming soon)\b/i.test(s)&&!/^please\s+check back\b/i.test(s)).join(' ').replace(/\b(?:job description|apply now|sample|placeholder|read more|coming soon)\b/gi,'').replace(/[^\p{L}\p{N}]/gu,'')
  check(substantive.length>=40,'Native full role description is only an unavailable notice or application instruction')
 }
 const selected=jobs.filter(j=>j.requisitionId===binding.nativeRequisitionId);check(selected.length===1&&selected[0].title===binding.title&&selected[0].link===binding.nativeCanonicalURL,'Current public application and native inventory identity disagree');
 return jobs
}
