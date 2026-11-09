import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {fetchTextWithRetry} from '../../scraper-support/utils/fetch.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createNativeRoleAvailability,nativeRoleClosureNotice} from '../../scraper-support/utils/sourceAvailability.js'

export const CAREERS='https://enphase.com/careers'
export const API='https://enphase.com/api/v2/jobs'
const CLIENT='https://enphase.com/themes/custom/smalcode/dist/career-search-form.js?v=1.x'
const check=(ok,message)=>{if(!ok)throw new Error('Enphase native: '+message)}
const plain=v=>typeof v==='string'&&v.trim().length>0
const norm=v=>decodeNativeEntities(v).replace(/\s+/g,' ').trim()
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const own=(o,k)=>Object.hasOwn(o,k)
const roleURL=r=>'https://enphase.com/job/'+r.jid

function document(html){
 check(typeof html==='string'&&html.length<=3000000,'Body unavailable or over limit')
 const d=readNativeDocument(html),root=d.nodes(n=>n.tag==='root')[0],parents=new Map()
 function walk(n,parent,inert=false){
  if(typeof n==='string')return
  parents.set(n,parent);n.inert=Boolean(n.inert||inert||own(n.attrs,'inert'))
  for(const c of n.children)walk(c,n,n.inert)
 }
 walk(root,null)
 return {...d,root,within:(node,ancestor)=>{for(let p=node;p;p=parents.get(p))if(p===ancestor)return true;return false},ancestor:(node,cls)=>{for(let p=node;p;p=parents.get(p))if(d.hasClass(p,cls))return p;return null}}
}
function scriptURL(html){
 const d=document(html),scripts=d.nodes(n=>n.tag==='script'&&plain(n.attrs.src)&&n.attrs.src.includes('career-search-form.js'))
 const titles=d.nodes(n=>n.tag==='title'),canonical=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 check(titles.length===1&&norm(titles[0].raw)==='Careers at Enphase | Clean Energy Jobs'&&canonical.length===1&&canonical[0].attrs.href===CAREERS,'Current corporate career identity changed')
 check(scripts.length===1,'Current active career-search client missing or ambiguous')
 const url=new URL(scripts[0].attrs.src,CAREERS).href
 check(url===CLIENT,'Current advertised client URL changed')
 return url
}
export function parseBinding(html,client){
 const url=scriptURL(html)
 check(typeof client==='string'&&client.length<1000000,'Current client unavailable')
 for(const marker of ['fetch("/api/v2/jobs"+t)','t.rows','t.pager','goToPage:function(t)','"page",t','jobDetailPage:"/job"'])check(client.includes(marker),'Current client paging/role contract changed')
 return url
}
function geography(location){
 check(plain(location),'Native location missing')
 const value=norm(location),india=/\bIndia\b/i.test(value)
 if(india)check(/^(?:Bangalore|Chennai), India$/.test(value),'Unverified or conflicting explicit India location')
 else check(!/\b(?:Bangalore|Bengaluru|Chennai|Mumbai|Hyderabad|Pune|Delhi|Noida|Gurgaon)\b/i.test(value),'India city conflicts with native country label')
 return india
}
function applyURL(row,{locationVariant=false}={}){
 check(plain(row.applyUrl),'Configured apply URL absent')
 const value=decodeNativeEntities(row.applyUrl),u=new URL(value)
 check(u.protocol==='http:'&&u.hostname==='app.jobvite.com'&&u.port===''&&!u.username&&!u.password&&u.pathname==='/CompanyJobs/Careers.aspx'&&!u.hash,'Unverified native application route')
 // Three captured foreign rows are native location variants of a single
 // parent role. They stay separate inventory IDs; selected India roles must
 // always bind the full exact native ID and never use this foreign variant.
 const expected=locationVariant&&/^[a-zA-Z0-9]+-C[a-zA-Z0-9]+$/.test(row.jid)?row.jid.split('-')[0]:row.jid
 check(u.searchParams.size===3&&u.searchParams.getAll('c').length===1&&u.searchParams.get('c')==='qu49Vfwm'&&u.searchParams.getAll('j').length===1&&u.searchParams.get('j')===expected&&u.searchParams.getAll('k').length===1&&u.searchParams.get('k')==='Apply','Native application company/role/action mismatch')
 return value
}
function record(row){
 check(row&&typeof row==='object'&&!Array.isArray(row),'Invalid native record')
 check(plain(row.jid)&&/^[a-zA-Z0-9_-]{1,80}$/.test(row.jid)&&plain(row.name)&&plain(row.requisitionid)&&/^\d+$/.test(row.requisitionid)&&plain(row.category),'Native ID/title/requisition/category malformed')
 check(row.description__value==null||typeof row.description__value==='string','Native description field malformed')
 // Dates/status/employer are absent in the checked native contract. A newly
 // introduced field must be reviewed, never silently discarded or guessed.
 const keys=['applyUrl','category','description__value','jid','location','name','requisitionid']
 check(Object.keys(row).every(k=>keys.includes(k)),'Unreviewed native field contract')
 const india=geography(row.location);applyURL(row,{locationVariant:!india})
 return row
}
export function parsePage(text,page){
 check(typeof text==='string'&&text.length<=3000000,'API body invalid or over limit')
 const p=JSON.parse(text),g=p?.pager
 check(p&&Array.isArray(p.rows)&&g&&typeof g==='object','Missing native rows/pager')
 check(Number.isInteger(page)&&page>=0&&g.current_page===page,'Native page index mismatch')
 check(typeof g.total_items==='string'&&/^(?:0|[1-9]\d*)$/.test(g.total_items),'Invalid declared native record total')
 const total=Number(g.total_items)
 check(Number.isSafeInteger(total)&&total>0&&total<=120,'Native inventory empty or over cap; company zero remains unverified')
 check(Number.isInteger(g.total_pages)&&g.total_pages>0&&g.total_pages<=120&&Number.isInteger(g.items_per_page)&&g.items_per_page>0&&g.items_per_page<=120,'Invalid finite native pager')
 check(g.total_pages===Math.ceil(total/g.items_per_page)&&page<g.total_pages,'Native page/total contract inconsistent')
 check(p.rows.length===Math.min(g.items_per_page,total-page*g.items_per_page),'Native page size or last-page mismatch')
 p.rows.forEach(record)
 check(new Set(p.rows.map(r=>r.jid)).size===p.rows.length,'Duplicate native IDs within page')
 return {rows:p.rows,pager:g}
}
function decodedDescription(value){
 if(value==null)return ''
 let html=value
 // Drupal JSON escapes full HTML inside an outer <p>. Decode the native field
 // only; no description is recovered from page-wide marketing or scripts.
 for(let i=0;i<3;i++){const next=decodeNativeEntities(html);if(next===html)break;html=next}
 const d=document(html)
 return d.text(d.root)
}
const CLOSED=/\b(?:(?:this |the )?(?:job|position|role)\s+(?:is\s+|has been\s+)?(?:closed|filled|expired|removed|no longer available)|no longer (?:accepting applications|available)|applications (?:are |have been )?closed)\b/i
function usable(text){
 if(!plain(text)||text.length<=300)return false
 const substantive=text.split(/(?<=[.!?])\s+/).filter(s=>!/(?:job description.*(?:unavailable|not available|coming soon)|please (?:click|check back)|click (?:on )?(?:apply|here)|apply now)/i.test(s)).join(' ')
 return substantive.replace(/[^\p{L}\p{N}]/gu,'').length>200&&/\b(?:responsibilities|requirements|qualifications|what you|who you|about the role|experience|skills|duties|you will|education|the role)\b/i.test(substantive)
}
export function parseDetail(html,row,{now=new Date().toISOString()}={}){
 record(row);check(geography(row.location),'Selected role is not explicitly India')
 const d=document(html),intros=d.nodes(n=>d.hasClass(n,'jobvite-detail__intro'))
 check(d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').length===0,'Unreviewed structured date/employer contract')
 check(d.nodes(n=>n.tag==='time'||n.tag==='meta'&&/date|posted|expiry|validThrough|modified|published/i.test(JSON.stringify(n.attrs))).length===0,'Unreviewed authoritative date metadata contract')
 check(intros.length===1,'Missing or ambiguous active role intro')
 const intro=intros[0],rich=d.ancestor(intro,'rich-text')
 const one=(predicate,label)=>{const nodes=d.nodes(n=>predicate(n)&&d.within(n,intro));check(nodes.length===1,'Missing or ambiguous '+label);return d.text(nodes[0])}
 const title=one(n=>n.tag==='h1','title'),location=one(n=>n.tag==='h5','location'),req=one(n=>d.hasClass(n,'jobvite-detail__requisition-id'),'requisition')
 check(title===norm(row.name)&&location===norm(row.location)&&req==='Requisition ID: '+row.requisitionid,'Listing/detail title/location/requisition mismatch')
 const apply=applyURL(row),links=d.nodes(n=>n.tag==='a'&&plain(n.attrs.href)&&/jobvite\.com/i.test(n.attrs.href))
 check(links.length>0&&links.every(n=>n.attrs.href===apply&&/^Apply now$/i.test(d.text(n))),'Current configured application control missing or conflicting')
 const candidates=d.nodes(n=>d.hasClass(n,'jobvite-detail__content')).map(n=>({text:d.text(n),scoped:Boolean(rich)&&d.within(n,rich)})).filter(n=>n.text)
 const texts=[...new Set(candidates.map(n=>n.text))],nativeText=decodedDescription(row.description__value)
 const selected=texts.length===1&&candidates.every(n=>n.scoped)?texts[0]:null
 // Whitespace differs between API markup and the rendered corporate layout.
 // All non-whitespace content must agree, including role-specific full prose.
 const same=Boolean(selected)&&selected.replace(/\s/g,'')===nativeText.replace(/\s/g,'')
 // Closure is authoritative within the active role header as well as its JD.
 // The document reader excludes inherited hidden/inert and noncontent nodes;
 // unrelated footer/page text cannot close this role.
 let availabilityQualified=false,availabilityUnqualified=false,notice=null
 try{notice=nativeRoleClosureNotice({source:'enphaseenergy',company:'Enphase Energy',jobId:row.jid,title,sourceUrl:roleURL(row)},html);availabilityQualified=true}
 catch(error){availabilityUnqualified=error?.code==='NATIVE_STATUS_LAYOUT_UNQUALIFIED'}
 const closed=availabilityQualified?Boolean(notice):CLOSED.test(d.text(intro))||CLOSED.test(selected||'')||CLOSED.test(nativeText)
 const full=!closed&&same&&usable(selected)&&usable(nativeText)?selected:null
 const reason=full?'complete':closed?'native-role-closed':texts.length>1?'contradictory-native-description':!same?'missing-unscoped-or-conflicting-native-description':'closed-instruction-only-or-unusable-native-description'
 const job={
  source:'enphaseenergy',company:'Enphase Energy',jobId:row.jid,requisitionId:row.requisitionid,title,
  country:'India',city:location.split(',')[0],state:null,location,locations:[location],department:norm(row.category),
  sourceUrl:roleURL(row),applyUrl:apply,link:apply,
  jobDescription:full,sourceDescription:full,sourceDetailComplete:Boolean(full),sourceDetailStatus:reason,
  nativeDescriptionOriginal:row.description__value??null,nativeCorporateDescriptionText:selected,
  nativeRejectedDetailHTML:full?null:html,nativeListingOriginal:{...row},nativeLocationOriginal:row.location,
  nativeLegalEmployer:null,nativePostingStatus:null,nativeDateUnknown:true,
  postedAt:null,postingDate:null,closingDate:null,nativePublicationDate:null,nativeClosingDate:null,nativeUpdatedAt:null,
  publicationDateQualified:false,applicationAccessValidated:false,applicationEligibilityQualified:false,
  applicationAccess:'configured-native-application-control-only',applicationSubmitted:false,
  sourceListingComplete:false,sourceScopeComplete:false,sourceGlobalJobCount:null,sourceIndiaJobCount:null,
  sourceOfficialHtmlFetchedAtRuntime:true,scrapedAt:now,
 }
 if(availabilityQualified&&(full||closed))job.sourceAvailabilityEvidence=createNativeRoleAvailability(job,{state:closed?'closed':'open',observedAt:now,evidenceHtml:html})
 else if(availabilityUnqualified)job.sourceAvailabilityEvidence={state:'unavailable',reason:'native-status-layout-unqualified'}
 else if(closed)job.sourceAvailabilityEvidence={state:'unavailable',reason:'native-closure-identity-unqualified'}
 return job
}

export async function runNativeEnphase(options={}){
 check(options.maxJobs==null,'Native truncation is forbidden')
 const timeoutMs=options.timeoutMs??180000,concurrency=options.detailConcurrency??3,now=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 check(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=300000&&Number.isInteger(concurrency)&&concurrency>=1&&concurrency<=3&&Number.isFinite(Date.parse(now)),'Invalid bounded options')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Enphase source deadline')),timeoutMs)
 const signal=options.signal?AbortSignal.any([controller.signal,options.signal]):controller.signal
 const abort=()=>signal.throwIfAborted(),fetchImpl=options.fetchImpl??globalThis.fetch
 let requests=0
 async function bounded(fn){
  abort();let listener
  try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);abort()}
 }
 async function get(url,accept){
  check(++requests<=120,'Request cap exceeded')
  return bounded(()=>fetchTextWithRetry(url,{attempts:1,timeoutMs:20000,signal,label:'enphaseenergy',method:'GET',redirect:'error',headers:{'User-Agent':'Mozilla/5.0',Accept:accept},fetchImpl:async(u,init)=>{
   const r=await bounded(()=>fetchImpl(u,init))
   check(r.status===200&&r.url===url,'Upstream status or exact final URL mismatch ('+r.status+')')
   const content=r.headers?.get?.('content-type')??''
   check(accept==='application/json'?/application\/json/i.test(content):accept==='application/javascript'?/(?:javascript|ecmascript)/i.test(content):/text\/html/i.test(content),'Native response content type changed')
   return r
  }}))
 }
 const getPage=async p=>parsePage(await get(API+(p?'?page='+p:''),'application/json'),p)
 async function pool(rows,fn){
  let i=0;const result=new Array(rows.length)
  const settled=await Promise.allSettled(Array.from({length:Math.min(concurrency,rows.length)},async()=>{while(i<rows.length){abort();const at=i++;result[at]=await fn(rows[at])}}))
  const failed=settled.find(s=>s.status==='rejected');if(failed)throw failed.reason
  return result
 }
 try{
  const html=await get(CAREERS,'text/html,application/xhtml+xml'),clientURL=scriptURL(html),client=await get(clientURL,'application/javascript')
  parseBinding(html,client)
  const first=await getPage(0),pages=[first,...await pool(Array.from({length:first.pager.total_pages-1},(_,i)=>i+1),getPage)]
  const rows=pages.flatMap(p=>p.rows)
  for(const p of pages)for(const k of ['total_items','total_pages','items_per_page'])check(p.pager[k]===first.pager[k],'Pager drift across inventory')
  check(rows.length===Number(first.pager.total_items)&&new Set(rows.map(r=>r.jid)).size===rows.length,'Duplicate native IDs or native total mismatch')
  const india=rows.filter(r=>geography(r.location))
  check(india.length>0&&india.length<=60,'No qualified native India roles or India cap exceeded; company zero unverified')
  check(2+2*pages.length+2*india.length<=120,'Cannot exhaust and recheck within request cap')
  const jobs=await pool(india,async r=>parseDetail(await get(roleURL(r),'text/html,application/xhtml+xml'),r,{now}))
  const last=await pool(pages.map((_,i)=>i),getPage)
  check(equal(pages,last),'Native listing fields or pager changed during extraction')
  const final=await pool(india,async r=>parseDetail(await get(roleURL(r),'text/html,application/xhtml+xml'),r,{now}))
  // Public token/irrelevant page changes cannot renew authoritative role fields.
  for(let i=0;i<jobs.length;i++){
   const fields=j=>{const {nativeRejectedDetailHTML,...stable}=j;if(stable.sourceAvailabilityEvidence){const{evidenceHtml,evidenceSha256,...proof}=stable.sourceAvailabilityEvidence;stable.sourceAvailabilityEvidence=proof}return stable}
   check(equal(fields(jobs[i]),fields(final[i])),'Authoritative native detail fields changed during extraction')
  }
  abort()
  for(const job of jobs){job.sourceObservedNativeRecords=rows.length;job.sourceObservedNativeIndiaRecords=india.length;job.sourceCheckedAPIEnumerationComplete=true;job.sourceCheckedAPIReconciled=true}
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:API,firstParty:true,listingComplete:false,pagesFetched:pages.length*2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'current-corporate-api-exhausted-and-rechecked-company-scope-and-posting-dates-unqualified'})
 }finally{clearTimeout(timer)}
}
