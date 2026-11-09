import {createPublishingGapAtsScraper} from '../../scraper-support/utils/publishingGapAts.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {decodeNativeEntities,extractActiveDescription,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
export const CAREERS_URL='https://banyansoftware.com/careers'
export const API_URL='https://boards-api.greenhouse.io/v1/boards/banyansoftware/jobs?content=true'
const fail=(ok,message)=>{if(!ok)throw Error('Banyan native inventory: '+message)}
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const canonical=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
const countries=new Map(),display=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=display.of(code);if(name&&!['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code))countries.set(name.toLowerCase(),new Intl.Locale('und-'+code).region)}
for(const[name,code]of[['USA','US'],['US','US'],['United States of America','US'],['UK','GB']])countries.set(name.toLowerCase(),code)
// Explicit country labels establish geography. City-only, broad remote and
// unresolved region labels never establish that India is absent.
const country=value=>{const label=clean(value),parts=label.split(',').map(p=>p.trim().replace(/^Remote\s*-\s*/i,'').toLowerCase()),last=countries.get(parts.at(-1)),declared=new Set(parts.filter(p=>!(p==='georgia'&&last==='US')).map(p=>countries.get(p)).filter(Boolean));fail(declared.size<=1,'conflicting countries within one supplied location');return last||null}
const id=value=>Number.isSafeInteger(value)&&value>0
const errorEnvelope=value=>value&&typeof value==='object'&&Object.entries(value).some(([key,v])=>/^(?:error|errors)$/i.test(key)&&v!=null&&v!==false&&v!==''||/^(?:success|ok)$/i.test(key)&&(v===false||v===0||typeof v==='string'&&/^(?:false|0|failed|error)$/i.test(v.trim()))||/^(?:status|state|statusCode|httpStatus)$/i.test(key)&&(typeof v==='number'&&v>=400||typeof v==='string'&&(/error|fail/i.test(v)||/^\d{3}$/.test(v)&&Number(v)>=400))||/^(?:meta|metadata|response|result)$/i.test(key)&&errorEnvelope(v))
const activeNodes=(html,predicate)=>{const root=readNativeDocument(html).nodes(n=>n.tag==='root')[0],found=[];const visit=node=>{if(!node||node.inert||Object.hasOwn(node.attrs||{},'inert'))return;if(predicate(node))found.push(node);for(const child of node.children||[])if(typeof child!=='string')visit(child)};visit(root);return found}
const unavailableDescription=/^(?:the\s+)?(?:full\s+)?job description is (?:currently )?(?:unavailable|not available)[.!]?(?: please check back later(?: for details(?: about this (?:position|role))?)?[.!]?)?$/i
const applicationOnlyDescription=/^(?:please )?(?:click )?apply now to (?:learn more about this (?:opportunity|position|role) and )?submit your application(?: for this (?:position|role|opportunity))?[.!]?$/i
const descriptionOf=value=>{if(typeof value!=='string')return null;const html=decodeNativeEntities(value),root=readNativeDocument(html).nodes(n=>n.tag==='root')[0];const text=node=>!node||node.inert||Object.hasOwn(node.attrs||{},'inert')||node.tag==='script'?'':(node.children||[]).map(c=>typeof c==='string'?decodeNativeEntities(c):text(c)).join(' ');const content=text(root).replace(/\s+/g,' ').trim();return unavailableDescription.test(content)||applicationOnlyDescription.test(content)?null:extractActiveDescription(content)}
const validDate=(value,{allowFuture=false,allowDateOnly=false}={})=>{if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return false;const m=value.match(/^(\d{4})-(\d{2})-(\d{2})(T|$)/);if(!m||m[4]!=='T'&&!allowDateOnly)return false;const calendar=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return calendar.getUTCFullYear()===+m[1]&&calendar.getUTCMonth()===+m[2]-1&&calendar.getUTCDate()===+m[3]&&(allowFuture||Date.parse(value)<=Date.now()+300000)}
const abortable=(pending,signal)=>new Promise((resolve,reject)=>{const abort=()=>{cleanup();reject(signal.reason||Error('Native request aborted'))},cleanup=()=>signal.removeEventListener('abort',abort);if(signal.aborted){abort();return}signal.addEventListener('abort',abort,{once:true});Promise.resolve(pending).then(value=>{cleanup();resolve(value)},error=>{cleanup();reject(error)})})
const verifyBinding=html=>{
 // The description reader excludes iframe fallback contents. Project only a
 // closed iframe's attributes into a harmless node, keeping its ancestors and
 // visibility attributes while discarding raw fallback markup.
 const projected=html.replace(/<iframe\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>[\s\S]*?<\/iframe\s*>/gi,(_all,attrs)=>'<a data-banyan-iframe="true" '+attrs+'></a>')
 const frames=activeNodes(projected,n=>n.tag==='a'&&n.attrs['data-banyan-iframe']==='true'&&typeof n.attrs.src==='string')
 fail(frames.some(frame=>{try{const u=new URL(frame.attrs.src,CAREERS_URL);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname==='job-boards.greenhouse.io'&&!u.port&&u.pathname==='/embed/job_board'&&u.searchParams.get('for')==='banyansoftware'}catch{return false}}),'current active official Greenhouse iframe missing')
}
const inspect=payload=>{
 fail(payload&&typeof payload==='object'&&!errorEnvelope(payload),'upstream error envelope')
 fail(Array.isArray(payload.jobs)&&Number.isSafeInteger(payload.meta?.total)&&payload.meta.total>=0&&payload.meta.total===payload.jobs.length,'complete primitive native total required')
 for(const container of [payload,payload.meta]){
  fail(container.hasMore===undefined||container.hasMore===false,'unconsumed or untyped pagination marker')
  for(const key of ['nextPage','nextCursor','next'])fail(container[key]==null,'unconsumed pagination')
 }
 const seen=new Set(),records=[];let unresolved=0
 for(const raw of payload.jobs){
  fail(raw&&id(raw.id)&&!seen.has(raw.id),'unique native positive numeric job ID required');seen.add(raw.id)
  fail(clean(raw.title)&&raw.company_name==='Banyan Software','native title/company identity mismatch')
  fail(typeof raw.absolute_url==='string','primitive native job URL required')
  let url;try{url=new URL(raw.absolute_url)}catch{fail(false,'invalid native job URL')}
  fail(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash&&url.hostname==='job-boards.greenhouse.io'&&url.pathname==='/banyansoftware/jobs/'+raw.id,'exact native board/job URL required')
  fail(typeof raw.location?.name==='string'&&clean(raw.location.name),'native primary location missing')
  fail(Array.isArray(raw.offices)&&raw.offices.length>0,'native office list unavailable')
  const officeIds=new Set(),offices=[]
  for(const office of raw.offices){
   fail(office&&id(office.id)&&!officeIds.has(office.id)&&clean(office.name),'invalid or duplicate native office');officeIds.add(office.id)
   fail(office.location==null||typeof office.location==='string','native office location type changed')
   const named=country(office.name),located=country(office.location)
  fail(!named||!located||named===located,'native office country labels conflict for '+raw.id+'/'+office.id+': '+named+' versus '+located)
   const code=located||named;offices.push({label:clean(office.location)||clean(office.name),country:code});if(!code)unresolved++
  }
  // Primary locations and offices can describe different valid locations of
  // the same role. Retain their union; neither may erase an explicit India
  // location from the other. Only conflicting fields on one office reject.
  const primary=raw.location.name.split(/\s*;\s*/).map(label=>({label:clean(label),country:country(label)}))
  unresolved+=primary.filter(p=>!p.country).length
  const india=[...new Map([...offices,...primary].filter(o=>o.country==='IN').map(o=>[o.label,o])).values()],description=descriptionOf(raw.content)
  fail(raw.first_published==null||validDate(raw.first_published),'invalid or future native publication date')
  fail(raw.application_deadline==null||validDate(raw.application_deadline,{allowFuture:true,allowDateOnly:true}),'invalid native closing date')
  records.push({raw,india,description})
 }
 return{records,unresolved}
}
export async function runNativeBanyan({fetchImpl=globalThis.fetch,signal,maxJobs}={}){
 fail(maxJobs==null,'caller truncation is not a complete source check')
 const activeSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)
 activeSignal.throwIfAborted()
 const request=async(url,json=false)=>{activeSignal.throwIfAborted();const response=await abortable(fetchImpl(url,{signal:activeSignal,headers:{Accept:json?'application/json':'text/html'}}),activeSignal);fail(response.status===200&&response.url===url,'exact successful public HTTP response required');const body=await abortable(response.text(),activeSignal);return json?JSON.parse(body):body}
 verifyBinding(await request(CAREERS_URL))
 const first=await request(API_URL,true),observed=inspect(first),last=await request(API_URL,true);inspect(last)
 fail(canonical(first)===canonical(last),'native listing changed during boundary reconciliation')
 const prepared=structuredClone(first),byId=new Map(observed.records.map(record=>[String(record.raw.id),record]))
 for(const raw of prepared.jobs){const record=byId.get(String(raw.id));if(record.india.length)raw.location.name=record.india.map(o=>o.label).join('; ')}
 const mapped=await createPublishingGapAtsScraper({source:'banyansoftware',companyName:'Banyan Software',companyCareerPage:CAREERS_URL,atsPlatform:'greenhouse',boardToken:'banyansoftware'}).run({fetchJson:async()=>prepared,signal:activeSignal})
 const indiaRecords=observed.records.filter(r=>r.india.length)
 fail(mapped.length===indiaRecords.length,'native India role mapping omitted or added an identity')
 const boardComplete=observed.unresolved===0&&indiaRecords.every(r=>r.description)
 // The official group board does not establish every portfolio company's
 // separate hiring inventory. Keep source-wide totals/health unknown even
 // when this exact public board has a fully reconciled zero India result.
 const complete=false
 const jobs=mapped.map(job=>{const record=byId.get(String(job.jobId));fail(record?.india.length,'mapped native identity mismatch');return{...job,jobId:String(record.raw.id),companyDomain:'banyansoftware.com',country:'India',location:record.india[0].label,locations:record.india.map(o=>o.label),jobDescription:record.description,sourceDescription:record.description,postedAt:record.raw.first_published??null,postingDate:record.raw.first_published??null,closingDate:record.raw.application_deadline??null,sourceClosingDateIsExact:typeof record.raw.application_deadline==='string'&&record.raw.application_deadline.includes('T'),nativeUpdatedAt:record.raw.updated_at??null,nativeEmployer:record.raw.company_name,nativePrimaryLocation:record.raw.location.name,nativeOffices:record.raw.offices,sourceListingComplete:complete,sourceDetailComplete:Boolean(record.description),sourceGlobalJobCount:complete?first.meta.total:null,sourceObservedIndiaJobCount:indiaRecords.length}})
 activeSignal.throwIfAborted()
 Object.defineProperty(jobs,'nativeBoardEvidence',{value:{surface:API_URL,reportedTotal:first.meta.total,observedRecords:observed.records.length,observedIndiaRecords:observed.unresolved===0?indiaRecords.length:null,listingComplete:boardComplete,unresolvedLocationScopes:observed.unresolved,companyGlobalTotal:null,companyIndiaTotal:null,companyScopeComplete:false},enumerable:false})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:API_URL,firstParty:true,listingComplete:false,pagesFetched:1,reportedTotal:first.meta.total,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:boardComplete?'current-official-board-complete-whole-company-and-portfolio-inventories-unverified':'native-board-geography-or-selected-description-incomplete-whole-company-scope-unverified'})
}
