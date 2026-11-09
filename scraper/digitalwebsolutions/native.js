import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {createHTMLTransport} from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import {readNativeDocument,activeHead,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {nativeCountryName,nativeLocationCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const SOURCE='digitalwebsolutions',COMPANY='Digital Web Solutions'
export const CAREERS='https://www.digitalwebsolutions.com/careers/'
export const BOARD='https://hirenext.io/co/digital-web-solutions/',CANONICAL_BOARD=BOARD.slice(0,-1)
const sha=b=>createHash('sha256').update(b).digest('hex')
const need=(ok,message)=>{if(!ok)throw Error('Digital Web Solutions native: '+message)}
const one=(nodes,label)=>{need(nodes.length===1,'missing or ambiguous '+label);return nodes[0]}
const text=v=>typeof v==='string'?v.replace(/\s+/g,' ').trim():null,copy=v=>structuredClone(v)
export const roleURL=value=>{
 try{const u=new URL(value,BOARD);return u.origin==='https://hirenext.io'&&!u.search&&!u.hash
  &&/^\/co\/digital-web-solutions\/[a-z0-9-]+\/\d+$/.test(u.pathname)?u.href:null}catch{return null}
}
function noChangedBase(doc,url){const bases=doc.nodes(n=>n.tag==='base');need(!bases.length||bases.length===1&&new URL(bases[0].attrs.href,url).href===url,'unreviewed native document base')}
export function corporateHandoff(html){
 const doc=readNativeDocument(html);noChangedBase(doc,CAREERS)
 need(activeHead(html).titles.some(t=>/^Careers\s*-\s*Digital Web Solutions$/i.test(t)),'verified first-party careers page identity missing')
 const links=doc.nodes(n=>n.tag==='a'&&[BOARD,CANONICAL_BOARD].includes(n.attrs.href)&&/View All Jobs/i.test(doc.text(n)))
 need(links.length>0,'verified first-party careers page handoff missing')
 const targets=[...new Set(links.map(n=>n.attrs.href))];need(targets.length===1,'ambiguous current jobs handoff');return targets[0]
}
export function nativeListings(html){
 const doc=readNativeDocument(html);noChangedBase(doc,CANONICAL_BOARD)
 need(activeHead(html).titles.some(t=>/^Jobs at Digital Web Solutions$/i.test(t)),'native company board identity missing')
 const jobs=[],seen=new Set()
 for(const node of doc.nodes(n=>n.tag==='a'&&roleURL(n.attrs.href))){
  const url=roleURL(node.attrs.href),title=doc.text(one(doc.nodes(n=>n.tag==='h3',node),'native listing title'))
  const id=url.split('/').at(-1);need(title&&!seen.has(id),'missing title or duplicate native listing ID');seen.add(id)
  jobs.push({url,id,title,labels:doc.nodes(n=>n.tag==='span',node).map(n=>doc.text(n)).filter(Boolean)})
 }
 need(jobs.length>0&&jobs.length<=100,'current native board has no qualified complete role index');return jobs
}
function postings(doc){
 const result=[]
 const walk=(v,depth=0)=>{
  need(depth<8&&v&&typeof v==='object','malformed native structured model')
  if(Array.isArray(v)){v.forEach(item=>walk(item,depth+1));return}
  if((Array.isArray(v['@type'])?v['@type']:[v['@type']]).includes('JobPosting'))result.push(v)
  if(v['@graph'])walk(v['@graph'],depth+1)
 }
 for(const n of doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))walk(readLiteralModel(n.raw).value)
 return result
}
export function nativeRole(url,html,listing={},observedAt=null){
 need(roleURL(url)===url,'unqualified native role URL')
 const id=url.split('/').at(-1),doc=readNativeDocument(html),parents=new WeakMap();noChangedBase(doc,url)
 const walk=n=>{for(const child of n.children||[])if(typeof child!=='string'){parents.set(child,n);walk(child)}}
 doc.nodes(n=>n.tag==='root').forEach(walk)
 const post=one(postings(doc),'own native JobPosting'),titleNode=one(doc.nodes(n=>n.tag==='h1'),'own visible title'),title=doc.text(titleNode)
 need(title===text(post.title)&&(!listing.title||title===listing.title),'native role title differs from current index or visible role')
 need(String(post.identifier?.value)===id&&post.identifier?.name===COMPANY&&post.url===url,'native role identifier or canonical URL changed')
 const employer=post.hiringOrganization
 need(employer?.name===COMPANY&&employer.identifier?.value===57&&employer.identifier?.name===COMPANY
  &&employer.url==='https://digitalwebsolutions.com','native publisher does not match the current exact employer account')
 need(doc.nodes(n=>n.tag==='p'&&doc.text(n)===COMPANY,parents.get(titleNode)).length===1,'own visible employer missing')
 const canonicals=doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical'))
 need(!canonicals.length||canonicals.length===1&&canonicals[0].attrs.href===url,'native page canonical changed')
 const sections=[]
 for(const heading of ['Job Description','Responsibilities','Department','Skills']){
  const nodes=doc.nodes(n=>n.tag==='h2'&&doc.text(n)===heading)
  if(!nodes.length&&['Department','Skills'].includes(heading))continue
  const node=one(nodes,'complete '+heading),whole=doc.text(parents.get(node))
  need(whole.startsWith(heading+' '),'native criteria container changed')
  const content=whole.slice(heading.length).trim();need(content.length>(['Job Description','Responsibilities'].includes(heading)?100:0),'native criteria absent for '+heading)
  sections.push({heading,text:content})
 }
 need(sections.find(s=>s.heading==='Job Description')?.text===extractActiveDescription(post.description),'own visible and structured role descriptions disagree')
 need(post.jobLocation?.['@type']==='Place','native worksite model changed')
 const address=post.jobLocation.address,rawCountry=address?.addressCountry
 const countryValue=typeof rawCountry==='string'?rawCountry:null
 // addressLocality alone is a city field. Only a trailing written country in
 // its complete comma-separated worksite label can add country evidence.
 const typed=nativeCountryName(countryValue),locality=typeof address?.addressLocality==='string'&&address.addressLocality.includes(',')
  ?nativeLocationCountryName(address.addressLocality):null,conflict=!!(typed&&locality&&typed!==locality)
 const country=conflict||rawCountry!=null&&!typed?null:typed||locality||null
 const labels=Array.isArray(listing.labels)?[...listing.labels]:[]
 const nativeWorkplace=text(address?.addressLocality)||labels.find(v=>/^(?:Remote|Hybrid)$/i.test(v))||null
 const remote=labels.find(v=>/^(?:Remote|Hybrid)$/i.test(v))||(post.jobLocationType==='TELECOMMUTE'?'Remote':null)
 const posted=nativeDate(post.datePosted);need(!posted.raw||!observedAt||Date.parse(posted.raw)<=Date.parse(observedAt),'native publication lies in the future')
 const nativeSourceRecord={representation:'original-JobPosting-and-complete-visible-role',jobPosting:copy(post),
  visibleRole:{title,employer:COMPANY,sections},listing:{url,id,title:listing.title||title,labels}}
 const fullDescription=sections.map(s=>s.heading+'\n'+s.text).join('\n\n')
 return {source:SOURCE,company:COMPANY,title,jobId:id,requisitionId:null,legalEmployer:null,nativeLegalEmployer:null,
  sourceUrl:url,applyUrl:url,link:url,country,location:country?(nativeWorkplace||country):null,city:null,state:null,
  nativeWorkplace,nativeCountryEvidence:{field:typed?'jobLocation.address.addressCountry':locality?'jobLocation.address.addressLocality':null,
   value:typed?countryValue:locality?address.addressLocality:null},sourceCountryScopeUnresolved:!country,sourceNativeCountryConflict:conflict,
  remoteStatus:remote,department:sections.find(s=>s.heading==='Department')?.text||null,employmentType:text(post.employmentType),
  experienceRequired:Number.isSafeInteger(post.experienceRequirements?.monthsOfExperience)?post.experienceRequirements.monthsOfExperience+' months':null,
  minimumQualification:null,preferredQualification:null,requiredSkills:Array.isArray(post.skills)?post.skills.filter(s=>typeof s==='string'):[],
  postingDate:posted.raw,postedAt:posted.exact?posted.raw:null,sourceDatePrecision:posted.precision,sourcePostedDateRaw:posted.raw,
  sourcePostingDateUnresolved:!posted.raw,firstEverPublication:null,closingDate:null,
  jobDescription:fullDescription,sourceDescription:fullDescription,nativeSourceRecord,nativeHiringOrganization:copy(employer),
  sourceRawNativeHTML:html,sourceRawNativeHTMLSHA256:sha(html),sourceDetailComplete:true,sourceClosingQualified:false,
  sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
  companyCareerPage:CAREERS,companyDomain:'digitalwebsolutions.com',atsPlatform:'hirenext',applicationVisited:false}
}
export async function runNative(options={}){
 const cap=options.maxJobs??null;options.signal?.throwIfAborted();need(cap==null||Number.isSafeInteger(cap)&&cap>=0,'invalid result limit')
 const observedAt=new Date((options.now||(()=>new Date().toISOString()))()).toISOString(),failures=[]
 let jobs=[],index=[],boards=0,firstParty=false
 const finish=()=>{
  const result=cap==null?jobs:jobs.slice(0,cap)
  Object.defineProperty(result,Symbol.for('jobverify.verified-recruitment-observations'),{value:{source:SOURCE,firstPartyConfirmed:firstParty,
   nativePostings:boards?index.length:null,closedNativeDetails:jobs.filter(j=>j.sourceClosingQualified).length,
   unknownCountryIds:jobs.filter(j=>!j.country).map(j=>j.jobId),
   nativeInventoryReads:boards?[{kind:'current-global-Hirenext-native-HTML',pagesFetched:boards,reportedTotal:index.length,usable:jobs.length===index.length}]:[],
   failures,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
   unresolved:['company-recruitment-scope-unverified',...(jobs.some(j=>!j.country)?['global-native-role-countries-unproven']:[]),...(failures.length?['native-reading-or-closing-incomplete']:[])]}})
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:CAREERS,firstParty,pagesFetched:boards,reportedTotal:boards?index.length:null,
   indiaFacetCount:null,listingComplete:false,verifiedAt:observedAt,reason:'global-own-native-models-retained;unknown-work-countries-held;company-scope-unverified'})
 }
 if(cap===0)return finish()
 const interval=options.requestIntervalMs??1000,timeout=options.sourceTimeoutMs??180000
 const injected=typeof options.fetchText==='function'&&typeof options.fetchImpl!=='function'
 need(Number.isSafeInteger(interval)&&interval>=0&&(interval>=1000||injected||typeof options.fetchImpl==='function'&&options.fetchImpl!==globalThis.fetch),'invalid public request interval')
 need(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000,'invalid source deadline')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Digital Web Solutions source deadline')),timeout)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const allowed=url=>[CAREERS,BOARD,CANONICAL_BOARD].includes(url)||roleURL(url)===url
 const fetchImpl=injected?async(url,init)=>{const response=new Response(await options.fetchText(url,init),{status:200,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:url});return response}:options.fetchImpl
 const transport=createHTMLTransport({validateURL:url=>need(allowed(url),'public request outside own native contract')},{fetchImpl,signal})
 const prior=new Map();let requestCount=0,bytes=0
 const read=async url=>{
  try{
  signal.throwIfAborted();need(++requestCount<=32,'native source request bound exceeded')
  const origin=new URL(url).origin,wait=interval-(Date.now()-(prior.get(origin)||0))
  if(wait>0)await delay(wait,undefined,{signal});signal.throwIfAborted();prior.set(origin,Date.now())
  let response;try{response=await transport(url)}catch(error){throw Object.assign(error,{publicReadFailure:true})}
  bytes+=response.body.length;need(bytes<=8000000,'native aggregate byte bound exceeded')
  if(response.status===308&&url===BOARD){need(response.headers.location==='/co/digital-web-solutions','unreviewed native board redirect');return read(CANONICAL_BOARD)}
  if(response.status!==200)throw Object.assign(Error('Digital Web Solutions public read HTTP '+response.status),{publicReadFailure:true,status:response.status})
  need(/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers['content-type']||''),'unexpected native response MIME')
  const html=new TextDecoder('utf-8',{fatal:true}).decode(response.body)
  need(!activeHead(html).titles.some(title=>/^(?:Just a moment(?:\.{3}|…)?|Access Denied|Attention Required! ?(?:\| ?Cloudflare)?|Security check|Checking your browser(?:\.{3}|…)?)\s*$/i.test(title)),
   'public upstream challenge')
  return html
  }catch(error){throw Object.assign(error,{publicReadFailure:true})}
 }
 try{
  const declared=corporateHandoff(await read(CAREERS));firstParty=true;index=nativeListings(await read(declared));boards++
  for(const listing of index){
   try{jobs.push({...nativeRole(listing.url,await read(listing.url),listing,observedAt),scrapedAt:observedAt})}
   catch(error){signal.throwIfAborted();failures.push({id:listing.id,message:error.message,status:error.status??null});if(error.publicReadFailure)return finish()}
  }
  const closing=nativeListings(await read(corporateHandoff(await read(CAREERS))));boards++
  need(JSON.stringify(index.map(j=>j.url).sort())===JSON.stringify(closing.map(j=>j.url).sort()),'native closing inventory membership changed')
  const stable=[]
  for(const job of jobs){
   try{const current=nativeRole(job.sourceUrl,await read(job.sourceUrl),closing.find(j=>j.url===job.sourceUrl),observedAt)
    need(JSON.stringify(job.nativeSourceRecord)===JSON.stringify(current.nativeSourceRecord),'native closing full role changed')
    job.sourceClosingQualified=true;job.nativeClosingRecord=copy(current.nativeSourceRecord);stable.push(job)
   }catch(error){signal.throwIfAborted();failures.push({id:job.jobId,message:error.message,status:error.status??null});if(error.publicReadFailure)return finish()}
  }
  jobs=stable;return finish()
 }catch(error){signal.throwIfAborted();if(!jobs.length)throw error;failures.push({message:error.message,status:error.status??null});return finish()}
 finally{clearTimeout(timer);controller.abort()}
}
