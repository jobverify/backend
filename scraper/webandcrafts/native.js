import {createHash} from 'node:crypto'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {createBoundedPublicCareerTransport} from '../../scraper-support/utils/boundedPublicCareerTransport.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const HOME='https://webandcrafts.com/',CAREERS=HOME+'careers',INDEX=CAREERS+'/job-openings'
const source='webandcrafts',sha=value=>createHash('sha256').update(value).digest('hex')
const need=(value,message)=>{if(!value)throw Error('Webandcrafts native: '+message)}
const literal=value=>typeof value==='string'&&value.trim()?value.trim():null
const exactOne=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}

// Read only the literal JSON argument of active, inline Flight push statements.
// Neither the site's JavaScript nor Flight reference expressions are executed.
function flight(html){
 const doc=readNativeDocument(html),chunks=[]
 for(const node of doc.nodes(n=>n.tag==='script'&&!n.attrs.src)){
  const match=/^\s*self\.__next_f\.push\((\[[\s\S]*\])\)\s*;?\s*$/.exec(node.raw||'')
  if(!match)continue
  const value=readLiteralModel(match[1]).value
  if(Array.isArray(value)&&value[0]===1&&typeof value[1]==='string')chunks.push(value[1])
 }
 need(chunks.length>0&&chunks.length<=256,'literal Flight carrier unavailable')
 const text=chunks.join(''),bytes=Buffer.from(text),records=new Map()
 let at=0
 while(at<bytes.length){
  if(bytes[at]===10){at++;continue}
  const prefix=/^([a-f0-9]+):/.exec(bytes.subarray(at,at+32).toString())
  need(prefix,'unsupported Flight record framing')
  const id=prefix[1];at+=prefix[0].length
  const sized=/^T([a-f0-9]+),/.exec(bytes.subarray(at,at+32).toString())
  if(sized){
   const length=parseInt(sized[1],16);at+=sized[0].length
   need(length>0&&length<=4000000&&at+length<=bytes.length&&!records.has(id),'invalid native literal text record length or identity')
   const body=bytes.subarray(at,at+length),value=new TextDecoder('utf-8',{fatal:true}).decode(body)
   records.set(id,value);at+=length
  }else{
   const end=bytes.indexOf(10,at);need(end>=at,'unterminated native Flight record');at=end+1
  }
 }
 return {doc,text,records}
}
function field(text,name){
 const marker=JSON.stringify(name)+':',values=[]
 for(let from=0;;){
  const at=text.indexOf(marker,from);if(at<0)break
  const first=at+marker.length,opening=text[first]
  need(opening==='{'||opening==='[','nonliteral '+name)
  let quote=false,escaped=false,depth=0,end=-1
  for(let index=first;index<text.length;index++){
   const char=text[index]
   if(escaped){escaped=false;continue}
   if(quote&&char==='\\'){escaped=true;continue}
   if(char==='"'){quote=!quote;continue}
   if(quote)continue
   if(char==='{'||char==='[')depth++
   if(char==='}'||char===']'){if(--depth===0){end=index+1;break}}
  }
  need(end>first,'unterminated '+name)
  values.push(readLiteralModel(text.slice(first,end)).value);from=end
 }
 return exactOne(values,name)
}
function canonical(doc,url,required=true){
 const nodes=doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical'))
 if(!required&&nodes.length===0)return
 need(exactOne(nodes,'canonical').attrs.href===url,'canonical disagrees with native route')
}
export function webandcraftsListing(html){
 const {doc,text}=flight(html);canonical(doc,INDEX)
 need(doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='Job Openings').length===1,'active jobs heading unavailable')
 const categories=field(text,'jobOpenings'),rows=[],categoryIDs=new Set(),roleIDs=new Set()
 need(Array.isArray(categories)&&categories.length<=100,'category array unavailable')
 for(const category of categories){
  need(Number.isSafeInteger(category.id)&&category.id>0&&!categoryIDs.has(category.id),'duplicate or invalid category identity')
  categoryIDs.add(category.id)
  if(category.is_active!==true)continue
  need(literal(category.category_name)&&Array.isArray(category.job_post),'active category fields unavailable')
  for(const role of category.job_post){
   if(role.is_active!==true)continue
   need(Number.isSafeInteger(role.id)&&role.id>0&&!roleIDs.has(role.id)&&literal(role.title)
    &&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(role.slug),'duplicate or invalid native posting identity')
   roleIDs.add(role.id)
   rows.push({id:role.id,title:role.title,slug:role.slug,departmentID:category.id,department:category.category_name,
    sourceUrl:INDEX+'/'+role.slug+'?job_id='+role.id+'&dept='+category.id,
    rawNativeListing:structuredClone(role)})
  }
 }
 need(rows.length>0&&rows.length<=100,'no usable active native postings or native posting bound exceeded')
 return {rows,rawCategories:structuredClone(categories),signature:sha(JSON.stringify(rows))}
}
const calendar=value=>{
 need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}))?$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value.slice(0,10)).toISOString().slice(0,10)===value.slice(0,10),'invalid native publication date')
 return value
}
function geography(model){
 const location=literal(model.location),explicit=literal(model.country),typed=explicit?nativeCountryName(explicit):null
 const parts=location?.split(/,\s*/)||[],countries=[...new Set(parts.filter(p=>p.length>3).map(nativeCountryName).filter(Boolean))]
 const suffix=parts.at(-1),written=suffix?.length>3?nativeCountryName(suffix):null
 need(!explicit||typed,'unsupported explicit native country')
 need(countries.length<=1&&(!typed||countries.every(c=>c===typed)),'contradictory native country/workplace')
 const country=typed||written||null
 return {location:country?location:null,country,city:null,state:null,sourceCountryScopeUnresolved:!country}
}
export function webandcraftsRole(html,listing,observedAt){
 const {doc,text,records}=flight(html),original=field(text,'jobData'),model=structuredClone(original),references={}
 // Flight's length-framed T records are literal UTF-8 text. Retain both the
 // original reference and its exact own-record bytes, without evaluating it.
 for(const key of ['about','responsibilities','requirements','pre_requirements','benefits','join_team_content']){
  const ref=typeof model[key]==='string'&&/^\$([a-f0-9]+)$/.exec(model[key])
  if(ref){need(records.has(ref[1]),'missing native criteria text record');references[ref[1]]=records.get(ref[1]);model[key]=references[ref[1]]}
 }
 canonical(doc,INDEX+'/'+listing.slug,false)
 need(doc.nodes(n=>n.tag==='h1'&&doc.text(n)===listing.title).length===1,'native role heading conflict')
 need(model.id===listing.id&&model.slug===listing.slug&&model.title===listing.title&&model.is_active===true
  &&model.wac_pro_job_dept?.id===listing.departmentID&&model.wac_pro_job_dept.category_name===listing.department
  &&model.wac_pro_job_dept.is_active===true,'native detail/listing identity or activity disagreement')
 need(literal(model.requisition_id)&&/^WAC-[A-Z0-9/-]+$/.test(model.requisition_id),'native requisition identity unavailable')
 const criteria={}
 for(const key of ['about','responsibilities','requirements','pre_requirements','benefits','join_team_content']){
  need(model[key]==null||typeof model[key]==='string'&&!/^\$[A-Za-z0-9]/.test(model[key]),'unsupported native criteria reference')
  criteria[key]=model[key]?extractActiveDescription(model[key]):null
 }
 need(criteria.responsibilities&&criteria.requirements,'full native responsibilities and requirements unavailable')
 need(criteria.join_team_content&&/becoming a part of Webandcrafts\./.test(criteria.join_team_content),'own native employer declaration unavailable')
 const nativeCreatedAt=calendar(model.created_at)
 need(Date.parse(nativeCreatedAt)<=Date.parse(observedAt),'future native creation timestamp')
 const sections=[['About','about'],['Responsibilities','responsibilities'],['Requirements','requirements'],
  ['Additional requirements','pre_requirements'],['Benefits','benefits'],['Join the team','join_team_content']]
 const description=sections.filter(([,key])=>criteria[key]).map(([name,key])=>name+':\n'+criteria[key]).join('\n\n')
 return {source,title:model.title,company:'Webandcrafts',nativeEmployer:'Webandcrafts',nativeLegalEmployer:null,
  department:listing.department,...geography(model),jobId:model.requisition_id,requisitionId:model.requisition_id,
  sourceUrl:listing.sourceUrl,applyUrl:listing.sourceUrl,link:listing.sourceUrl,applicationVisited:false,
  employmentType:null,remoteStatus:literal(model.job_type),experienceRequired:literal(model.formatted_experience_range),
  minimumQualification:criteria.requirements,preferredQualification:criteria.pre_requirements,requiredSkills:Array.isArray(model.technology)?model.technology.filter(v=>typeof v==='string'):[],
  postingDate:null,postingDatePrecision:null,sourcePostingDateIsExact:false,sourceRawDates:{created_at:model.created_at,updated_at:model.updated_at},nativeCreatedAt,
  closingDate:null,jobDescription:description,sourceDescription:description,sourceDetailComplete:true,publicExperienceChecked:true,
  nativeSourceRecord:structuredClone(original),nativeResolvedSourceRecord:model,nativeFlightTextRecords:references,rawNativeListing:structuredClone(listing.rawNativeListing),
  nativeWorkplace:structuredClone(model.location),nativeCriteria:criteria,
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  companyCareerPage:INDEX,companyDomain:'webandcrafts.com',atsPlatform:'webandcrafts-first-party-careers-api',scrapedAt:observedAt}
}
const allowed=(value,method)=>{
 const url=new URL(value)
 return method==='GET'&&url.origin===new URL(HOME).origin&&![...url.searchParams.keys()].some(k=>!['job_id','dept'].includes(k))
  &&([HOME,CAREERS,INDEX].includes(url.href)||new RegExp('^/careers/job-openings/[a-z0-9]+(?:-[a-z0-9]+)*$').test(url.pathname))
}
function handoff(html,url,target){
 const doc=readNativeDocument(html)
 need(doc.nodes(n=>{if(n.tag!=='a'||!n.attrs.href)return false;try{return new URL(n.attrs.href,url).href===target}catch{return false}}).length>0,'current active employer handoff unavailable')
}
export async function runWebandcraftsNative(options={}){
 options.signal?.throwIfAborted()
 const observedAt=new Date((options.now||(()=>new Date().toISOString()))()).toISOString(),jobs=[],failures=[]
 const cap=options.maxJobs
 need(cap==null||Number.isSafeInteger(cap)&&cap>=0,'invalid caller cap')
 const finish=(pages,closed=false)=>{
  const unknown=jobs.filter(j=>!j.country).length
  const observation={source,firstPartyConfirmed:pages>0,nativePostings:jobs.length,closedNativeDetails:jobs.filter(j=>j.sourceClosingQualified).length,
   nativeInventoryReads:pages?[{kind:'first-party-flight',pagesFetched:pages,reportedTotal:null,usable:true}]:[],
   failures,unresolved:[...(unknown?['native-country-unproven']:[]),...(!closed?['closing-native-context-unqualified']:[]),'company-recruitment-scope-unverified'],
   sourceScopeComplete:false,lifecycleCleanupAllowed:false}
  Object.defineProperty(jobs,Symbol.for('jobverify.verified-recruitment-observations'),{value:observation})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:INDEX,firstParty:pages>0,pagesFetched:pages,listingComplete:false,
   reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'full-native-models-retained;own-country-required;company-scope-unverified'})
 }
 if(cap===0)return finish(0)
 const io=createBoundedPublicCareerTransport({...options,source,allowedURL:allowed}),read=io.fetchText;let pages=0
 const load=async url=>{const html=await read(url,{cache:'no-store'});pages++;return html}
 try{
  handoff(await load(HOME),HOME,CAREERS);handoff(await load(CAREERS),CAREERS,INDEX)
  const listing=webandcraftsListing(await load(INDEX)),selected=cap==null?listing.rows:listing.rows.slice(0,cap)
  for(const row of selected){
   try{jobs.push({...webandcraftsRole(await load(row.sourceUrl),row,observedAt),sourceClosingQualified:false})}
   catch(error){io.signal.throwIfAborted();failures.push({url:row.sourceUrl,message:error.message,status:error.status??null});if(error.publicReadFailure)break}
  }
  // Denials stop this source. No legacy API, alternate host or retry follows.
  if(failures.some(f=>[401,403,429,451].includes(f.status)))return finish(pages)
  const closing=webandcraftsListing(await load(INDEX))
  need(listing.signature===closing.signature,'native closing listing changed')
  for(const job of jobs){
   const row=selected.find(row=>row.sourceUrl===job.sourceUrl)
   try{
    const current=webandcraftsRole(await load(row.sourceUrl),row,observedAt)
    // Flight may allocate different text-record IDs between two reads. Compare
    // the full resolved native fields, retaining both original encodings.
    need(JSON.stringify(current.nativeResolvedSourceRecord)===JSON.stringify(job.nativeResolvedSourceRecord),'native closing role changed')
    job.nativeClosingSourceRecord=current.nativeSourceRecord
    job.nativeClosingFlightTextRecords=current.nativeFlightTextRecords
    job.sourceClosingQualified=true
   }catch(error){io.signal.throwIfAborted();failures.push({url:row.sourceUrl,message:error.message,status:error.status??null});if(error.publicReadFailure)break}
  }
  if(failures.some(f=>[401,403,429,451].includes(f.status)))return finish(pages)
  handoff(await load(HOME),HOME,CAREERS);handoff(await load(CAREERS),CAREERS,INDEX)
  return finish(pages,failures.length===0&&jobs.length===selected.length)
 }catch(error){io.signal.throwIfAborted();failures.push({message:error.message,status:error.status??null});return finish(pages)}
 finally{io.close()}
}
