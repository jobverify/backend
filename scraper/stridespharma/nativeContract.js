import {createHash} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import {DOMParser} from '@xmldom/xmldom'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,extractActiveDescription,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

const LEGAL_NAME='Strides Pharma Science Limited',LEGAL_CODE='STRIDES PHARMA SCIENCE LTD'
const MAIN_SHA='87d6b690acd176b8def52fd834dd32c3db3683289b77869b36b735709adbeff6'
const COMMUNICATOR_SHA='a5243d5013b9b4e26f7cc95be56a2c74c7cfc21b936304b90a4efb0dacdbfcbd'
const EXECUTABLE_SET_SHA='56aaca2d02079043e4c4f5e5947c3aa1a75cec648e136414d6f6abbf04939a9d'
const sha=b=>createHash('sha256').update(b).digest('hex'),text=v=>typeof v==='string'?v.replace(/\s+/g,' ').trim():''
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('[stridespharma] '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap'})}
const executable=n=>n.tag==='script'&&(!n.attrs.type||['text/javascript','application/javascript','module'].includes(n.attrs.type))
// Visibility is deliberately not consulted: hidden/quoted scripts and event
// handlers execute. Template/noscript content and HTML comments do not.
export const nativeExecutableSet=html=>{
 const doc=readNativeDocument(html),records=[],walk=node=>{
  if(['template','noscript'].includes(node.tag))return
  const attrs=Object.entries(node.attrs).sort(([a],[b])=>a.localeCompare(b)),events=attrs.filter(([key,value])=>/^on/i.test(key)||/^\s*javascript:/i.test(value))
  if(node.tag==='script')records.push({tag:node.tag,attrs,raw:node.raw||''})
  else if(events.length||['base','iframe','object','embed'].includes(node.tag)||(node.tag==='meta'&&node.attrs['http-equiv']?.toLowerCase()==='refresh'))records.push({tag:node.tag,attrs})
  node.children.filter(n=>typeof n!=='string').forEach(walk)
 };walk(doc.nodes(n=>n.tag==='root')[0]);return records
}
const quoted=new Set(['blockquote','q','pre','code','template','noscript','style','textarea','iframe','object'])
const positiveNodes=doc=>{
 const walk=node=>node.inert||quoted.has(node.tag)?[]:[node,...node.children.filter(n=>typeof n!=='string').flatMap(walk)]
 return walk(doc.nodes(n=>n.tag==='root')[0])
}
const positiveText=node=>!node||node.inert||quoted.has(node.tag)||node.tag==='script'?'':text(decodeNativeEntities(node.children.map(n=>typeof n==='string'?n:positiveText(n)).join(' ')))
const bodyText=doc=>{const nodes=positiveNodes(doc);return positiveText(nodes.find(n=>n.tag==='body')||nodes[0])}
export const activeCorporate=(html,portal)=>{
 const doc=readNativeDocument(html),nodes=positiveNodes(doc),titles=nodes.filter(n=>n.tag==='title')
 return titles.length===1&&text(titles[0].raw)==='Careers | Join the Strides Team'&&bodyText(doc).includes('Join Us and Grow with Strides')
  &&nodes.filter(n=>n.tag==='a'&&n.attrs.href===portal&&positiveText(n)==='View current openings').length>0
}
export const activePortal=html=>{
 const doc=readNativeDocument(html),titles=positiveNodes(doc).filter(n=>n.tag==='title'),visible=bodyText(doc)
 return titles.length===1&&text(titles[0].raw)==='Career Portal'&&visible.includes('Build your future with Us')
  &&/Welcome to the Careers Centre for strides\s*\./i.test(visible)&&visible.includes(LEGAL_NAME)
}
const dataset=xml=>{
 need(typeof xml==='string'&&xml.length<=4000000&&!/<!DOCTYPE|<!ENTITY|<\?/i.test(xml),'Unsafe or missing native XML')
 const invalid=message=>{throw Error('Invalid native XML: '+message)}
 const doc=new DOMParser({errorHandler:{warning:invalid,error:invalid,fatalError:invalid}}).parseFromString(xml,'application/xml')
 const root=doc.documentElement;need(root?.tagName==='NewDataSet'&&!root.attributes.length,'Native dataset root changed')
 const tables=new Map()
 for(let node=root.firstChild;node;node=node.nextSibling){
  if(node.nodeType!==1){need(node.nodeType===8||!text(node.nodeValue),'Unexpected native XML content');continue}
  need(/^Table\d*$/.test(node.tagName)&&!node.attributes.length,'Native table shape changed')
  const record=Object.create(null)
  for(let field=node.firstChild;field;field=field.nextSibling){
   if(field.nodeType!==1){need(field.nodeType===8||!text(field.nodeValue),'Unexpected native field text');continue}
   need(/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.tagName)&&!field.attributes.length&&!Object.hasOwn(record,field.tagName),'Duplicate or malformed native field')
   for(let child=field.firstChild;child;child=child.nextSibling)need([3,4,8].includes(child.nodeType),'Nested native field markup')
   record[field.tagName]=field.textContent
  }
  if(!tables.has(node.tagName))tables.set(node.tagName,[]);tables.get(node.tagName).push(record)
 }
 return tables
}
const publicDataset=payload=>{
 need(payload?.d?.SuccessOrFailure==='Success'&&payload.d.MessageType===0&&!text(payload.d.Message)&&typeof payload.d.Returnvalues==='string','Native service returned an error or missing dataset')
 return dataset(payload.d.Returnvalues)
}
const foreign=[]
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const name=nativeCountryName(String.fromCharCode(a,b));if(name&&name!=='India')foreign.push(name.toLowerCase().match(/[\p{L}\p{N}]+/gu))}
const hasForeign=value=>{const words=text(value).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];return foreign.some(country=>words.some((_,at)=>country.every((word,n)=>words[at+n]===word)))}
const geography=(row,detail)=>{
 const label=text(row.Joblocation),city=text(row.location_city),parts=label.split(',').map(text)
 const detailWorksite=text(detail.Joblocation)
 const suppliedCountries=[row,detail].flatMap(record=>Object.entries(record).filter(([key])=>/^(?:country|country_name|country_code|countrycode|location_country)$/i.test(key)).map(([,v])=>text(v))).filter(Boolean)
 const explicitIndia=parts.length===4&&parts[0].startsWith('Strides-')&&parts[1]===city&&parts[2]
  &&/^India(?:\s*\([A-Za-z0-9 _-]{1,40}\))?$/.test(parts[3])&&!hasForeign(label)&&!hasForeign(city)
  &&(!detailWorksite||detailWorksite===label)&&suppliedCountries.every(v=>/^(?:India|IN|IND)$/i.test(v))
 return {country:explicitIndia?'India':null,location:label||city||null,city:city.split(',')[0]||null,unresolved:!explicitIndia}
}
const boundaries=new Set(['address','article','aside','body','br','caption','dd','details','dialog','div','dl','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hgroup','hr','html','li','main','menu','nav','ol','p','section','summary','table','tbody','td','tfoot','th','thead','tr','ul'])
const ownBlocks=(html,{headings=true}={})=>{
 if(typeof html!=='string')return []
 const doc=readNativeDocument(html),walk=node=>typeof node==='string'?node:node.inert||quoted.has(node.tag)||node.tag==='script'||(!headings&&/^h[1-6]$/.test(node.tag))?'':
  (boundaries.has(node.tag)?'\n':'')+node.children.map(walk).join('')+(boundaries.has(node.tag)?'\n':'')
 return walk(doc.nodes(n=>n.tag==='root')[0]).split(/\r?\n/).map(s=>text(decodeNativeEntities(s))).filter(Boolean)
}
const employerCriteriaAgree=html=>{
 const blocks=ownBlocks(html),legal=value=>[LEGAL_NAME,LEGAL_CODE].some(name=>name.toLowerCase()===text(value).toLowerCase())
 const label=/^(?:legal employer|own employer|employer|hiring organization|company(?: name)?|employing entity)(?:\s*[:-]\s*(.*)|\s*)$/i
 for(let at=0;at<blocks.length;at++){const match=blocks[at].match(label);if(match)need(legal(match[1]||blocks[at+1]),'Own written employer label conflicts')}
 const visible=blocks.join(' ')
 need(!/\b(?:you (?:will not|won['’]t) be|you are not|the successful candidate will not be)\s+(?:(?:employed|hired)\s+by|an?\s+employee\s+of)\b/i.test(visible)
  &&!/\b(?:strides(?: pharma science limited)?|strides pharma science ltd)\s+is not (?:your|the) employer\b/i.test(visible)
  &&!/\byour employer (?:is|will be) not\s+(?:strides(?: pharma science limited)?|strides pharma science ltd)\b/i.test(visible),'Own written employer denial')
 for(const match of visible.matchAll(/\b(?:you will be|you are|the successful candidate will be)\s+(?:(?:employed|hired)\s+by|an?\s+employee\s+of)\s+([^.!?;]+)(?:[.!?;]|$)/gi))need(legal(match[1]),'Own written employment assignment conflicts')
 for(const match of visible.matchAll(/\b(?:your employer|the employing entity)\s+(?:is|will be)\s+([^.!?;]+)(?:[.!?;]|$)/gi))need(legal(match[1]),'Own written employing entity conflicts')
}
const criteriaCountryAgrees=(html,row)=>{
 const blocks=ownBlocks(html),country=/^(?:country|country of employment)(?:\s*[:-]\s*(.*)|\s*)$/i,location=/^(?:work location|worksite|job location|location)(?:\s*[:-]\s*(.*)|\s*)$/i
 const nativeParts=text(row.Joblocation).split(',').map(text),allowed=[text(row.location_city),text(row.Joblocation),nativeParts.slice(1).join(', '),[...nativeParts.slice(1,3),'India'].join(', '),'India']
 const agrees=value=>!hasForeign(value)&&allowed.some(native=>native.toLowerCase()===text(value).toLowerCase())
 for(let at=0;at<blocks.length;at++){
  const countryMatch=blocks[at].match(country),locationMatch=blocks[at].match(location)
  if(countryMatch&&!/^(?:India|IN|IND)$/i.test(countryMatch[1]||blocks[at+1]||''))return false
  if(locationMatch&&!agrees(locationMatch[1]||blocks[at+1]))return false
 }
 // Only explicit assignments to this own role/candidate bind its workplace;
 // global-team/customer/market mentions do not assign the applicant's location.
 const ownLocation=/\b(?:(?:this|the) (?:role|position|job)|you|the (?:successful|selected) candidate)\s+(?:is|are|will be)\s+(?:based|located)\s+(?:in|at)\s+([^.!?;]+)(?:[.!?;]|$)/gi
 for(const match of blocks.join(' ').matchAll(ownLocation))if(!agrees(match[1]))return false
 return true
}
const fullCriteria=description=>{
 const active=extractActiveDescription(description)
 if(!active||active.length<100||/^(?:please\s+)?enter\s+(?:the\s+)?job\s+description[.!\s]*$/i.test(active))return null
 const substantive=ownBlocks(description,{headings:false}).filter(block=>! /^(?:(?:key |job )?(?:responsibilities|qualifications|requirements|skills|experience)|and|[\s:.,&-])+$/i.test(block)).join(' ')
 if(substantive.length<100||new Set(substantive.toLowerCase().match(/[\p{L}\p{N}]+/gu)).size<15)return null
 return active
}
const wait=(operation,signal)=>new Promise((resolve,reject)=>{
 const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true})
 if(signal.aborted){signal.removeEventListener('abort',abort);reject(signal.reason);return}
 Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort))
})

export async function collectStridesNative(options,contract){
 const {careers,portal,service,companyToken,listingKey,detailKey,buildServiceRequestBody,buildApplyUrl}=contract
 const timeout=options.sourceTimeoutMs??90000,requestLimit=options.maxRequests??32
 need(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000&&Number.isSafeInteger(requestLimit)&&requestLimit>0&&requestLimit<=64,'Invalid native collection budgets')
 const controller=new AbortController(),expires=performance.now()+timeout,timer=setTimeout(()=>controller.abort(new DOMException('Strides source deadline exceeded','TimeoutError')),timeout)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const check=()=>{options.signal?.throwIfAborted();if(performance.now()>=expires&&!controller.signal.aborted)controller.abort(new DOMException('Strides source deadline exceeded','TimeoutError'));signal.throwIfAborted()}
 let bytes=0,requests=0,unverified=false;const receipts=[],jobs=[],failures=[];let rows=[],closingMatches=false
 const read=async(url,kind='html',body)=>{
  check();need(++requests<=requestLimit,'Native request budget exhausted');const requestedAt=new Date().toISOString(),request={method:body===undefined?'GET':'POST',...(body===undefined?{}:{body})}
  let content,receipt={url,method:request.method,...body===undefined?{}:{requestBody:body},requestedAt}
  const callback=kind==='json'?options.fetchJson:options.fetchText
  if(callback){
   unverified=true;const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(15000)]),requestExpires=performance.now()+15000
   const value=await wait(()=>callback(url,{method:request.method,signal:requestSignal,...body===undefined?{}:{body,headers:{'Content-Type':'application/json; charset=utf-8'}}}),requestSignal)
   check();requestSignal.throwIfAborted();if(performance.now()>=requestExpires)throw new DOMException('Strides request deadline exceeded','TimeoutError')
   content=kind==='json'?JSON.stringify(value):value;need(typeof content==='string','Native callback returned malformed content')
   receipt={...receipt,callbackMetadataUnverified:true,callbackRepresentationSHA256:sha(content)}
  }else{
   const raw=await boundedDeclaredPublicRead(url,{signal,request,timeoutMs:15000,overflowError:Error('Strides response exceeds byte bound'),fetchImpl:(target,init)=>(options.fetchImpl||fetch)(target,{...init,credentials:'omit',headers:{...init.headers,Accept:kind==='json'?'application/json':kind==='js'?'application/javascript':'text/html',...body===undefined?{}:{'Content-Type':'application/json; charset=utf-8'}}})})
   check();const native=Buffer.from(raw.bodyBase64,'base64'),mime=(raw.headers['content-type']||'').split(';')[0].toLowerCase().trim()
   need(raw.status===200&&raw.url===url,'Native HTTP status or final authority changed')
   need(kind==='json'?mime==='application/json':kind==='js'?['application/javascript','text/javascript'].includes(mime):['text/html','application/xhtml+xml'].includes(mime),'Native response MIME changed')
   content=native.toString('utf8');receipt={...receipt,status:raw.status,finalURL:raw.url,contentType:mime,bodySHA256:sha(native)}
  }
  check();const size=Buffer.byteLength(content);need(size<=4000000&&(bytes+=size)<=12000000,'Native response or aggregate byte budget exhausted')
  receipts.push({...receipt,bodyBytes:size,completedAt:new Date().toISOString()});const parsed=kind==='json'?JSON.parse(content):content;check();return parsed
 }
 const requestBody=(key,params)=>buildServiceRequestBody({key,params})
 const listing=()=>read(service,'json',requestBody(listingKey,{company:companyToken}))
 const collection=()=>({source:'stridespharma',observedListingCount:rows.length,observedRecords:rows,candidateDetails:rows.length,
  jobs:jobs.filter(j=>j.sourceDetailComplete).map(j=>({id:j.jobId,url:j.applyUrl})),extractedDetailJobs:jobs.filter(j=>j.sourceDetailComplete).length,exclusions:[],excludedDetailJobs:0,
  failures,listingPaginationComplete:false,closingInventoryMatches:closingMatches,sourceScopeComplete:false,retainedResponses:receipts})
 try{
  check();const now=options.now?options.now():new Date().toISOString();need(Number.isFinite(Date.parse(now)),'Invalid native observation date')
  const corporate=await read(careers);need(activeCorporate(corporate,portal),'Current active corporate careers delegation changed')
  const page=await read(portal);need(activePortal(page),'Current active native publisher changed')
  need(sha(JSON.stringify(nativeExecutableSet(page)))===EXECUTABLE_SET_SHA,'Reviewed complete native executable and handler set changed')
  const doc=readNativeDocument(page),programs=positiveNodes(doc).filter(n=>executable(n)&&!n.attrs.src&&n.raw.includes('var MAIN ='))
  need(programs.length===1&&sha(programs[0].raw)===MAIN_SHA,'Reviewed active native read-only program changed')
  const scripts=positiveNodes(doc).filter(n=>executable(n)&&n.attrs.src&&new URL(n.attrs.src,portal).href===portal+'js/Communicator.js')
  need(scripts.length===1,'Active native Communicator declaration changed')
  const communicator=await read(portal+'js/Communicator.js','js')
  // Response.text() strips the optional UTF-8 signature; raw bounded reads retain
  // it. Normalize exactly one leading BOM, retaining the complete raw receipt.
  need(sha(communicator.startsWith('\ufeff')?communicator.slice(1):communicator)===COMMUNICATOR_SHA,'Reviewed native service executable changed')
  const opening=publicDataset(await listing());rows=opening.get('Table6')||[]
  const aliases=(opening.get('Table3')||[]).filter(r=>r.Comp_code===LEGAL_CODE)
  need(aliases.length===1&&aliases[0].company_Name===LEGAL_NAME,'Native exact legal employer registry changed')
  need(rows.length>0&&rows.every(r=>r.company===companyToken&&/^[a-zA-Z0-9-]{1,128}$/.test(r.JobId)&&text(r.title)&&text(r.location_city)),'Native filtered own inventory missing or changed')
  need(new Set(rows.map(r=>r.JobId)).size===rows.length,'Native own inventory repeats an identity')
  const selected=options.maxJobs?rows.slice(0,options.maxJobs):rows
  for(const row of selected){
   const tables=publicDataset(await read(service,'json',requestBody(detailKey,{JobId:row.JobId}))),details=tables.get('Table')||[]
   need(details.length===1,'Own native detail is missing or ambiguous');const detail=details[0]
   for(const field of ['JobId','title','designation','department','experience','location_city'])need(detail[field]===row[field],'Own native detail identity or geography conflicts: '+field)
   need(detail.company===LEGAL_CODE&&detail.company_Name===LEGAL_NAME,'Own native legal employer conflicts')
   employerCriteriaAgree(detail.description);employerCriteriaAgree(detail.Job_desc)
   const geo=geography(row,detail),criteria=fullCriteria(detail.description),id=row.JobId,url=buildApplyUrl(id)
   if(!criteriaCountryAgrees(detail.description,row)||!criteriaCountryAgrees(detail.Job_desc,row)){geo.country=null;geo.unresolved=true}
   if(!criteria)failures.push({stage:'native-detail',id,url,reason:'Native full criteria are empty, placeholder, metadata-only or inactive',failureKind:'native-role-criteria-unpublished'})
   jobs.push({source:'stridespharma',company:'Strides Pharma',title:detail.title,jobId:id,requisitionId:id,department:detail.department,
    location:geo.location,city:geo.city,country:geo.country,sourceCountryScopeUnresolved:geo.unresolved,sourceNativeWorksiteLabel:row.Joblocation||null,
    sourceNativeLegalEmployer:detail.company_Name,sourceNativeCompanyCode:detail.company,sourceNativeListingRecord:row,nativeSourceRecord:detail,
    sourceNativeDescription:detail.description??null,sourceNativeLegacyDescription:detail.Job_desc??null,sourceDescription:criteria,jobDescription:criteria,
    sourceUrl:portal,applyUrl:url,link:url,employmentType:detail.employee_type||detail.employee_type1||null,experienceRequired:detail.experience||null,
    minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,sourceDateScopeUnresolved:true,sourceNativeRelativePostedDate:row.createdDate??null,
    sourceDetailComplete:!!criteria,...criteria?{}:{sourceDetailFailureKind:'native-role-criteria-unpublished'},sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:now})
  }
  const closing=publicDataset(await listing());need(JSON.stringify(closing.get('Table6')||[])===JSON.stringify(rows),'Fresh closing own inventory changed')
  need(JSON.stringify((closing.get('Table3')||[]).filter(r=>r.Comp_code===LEGAL_CODE))===JSON.stringify(aliases),'Fresh closing legal employer registry changed');closingMatches=true
  const evidence=collection();for(const job of jobs)job.nativeCollectionEvidence=evidence
  check();attachSourceObservationEvidence(jobs,{source:'stridespharma',recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:portal,firstParty:!unverified,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:1,verifiedAt:new Date().toISOString(),reason:'native-own-row-worksite-evidence;full-criteria-and-company-scope-held;aggregate-country-and-position-counters-are-not-inventory-totals'})
 }catch(error){
  if(rows.length&&!signal.aborted)Object.assign(error,{nativeCollectionEvidence:collection(),nativeEvidence:collection(),recruitmentObservations:{nativeRecords:rows.length,records:rows,failures}})
  throw error
 }finally{clearTimeout(timer);controller.abort()}
}
