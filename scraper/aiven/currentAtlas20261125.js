import {createHash} from 'node:crypto'
import {isDeepStrictEqual as equal} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {readNativeDocument,activeHead,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody,disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'

const LISTING='https://aiven.io/careers/job',CLIENT='https://careers.aiven.io/assets/index-BPQcEDLt.js'
const CLIENT_SHA='57b1c88f4e1d86503a382817b99bab9749932e616fe6ec004554e00665072b67'
const FRAME_SHA='9db55948cecc2a73ec9c99cddcf625016d0a5263829a5515b3063cd281cc4911'
const sha=value=>createHash('sha256').update(value).digest('hex'),norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const check=(ok,reason)=>{if(!ok)throw Object.assign(Error('Aiven current Atlas contract: '+reason),{failureKind:'parser_or_contract_error',abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
const one=(values,name)=>{check(values.length===1,'unique '+name);return values[0]}
const keys=(value,names,name)=>check(value&&typeof value==='object'&&!Array.isArray(value)&&equal(Object.keys(value).sort(),names.slice().sort()),'complete '+name+' fields')
const roleURL=value=>{try{const url=new URL(value);return url.origin==='https://careers.aiven.io'&&/^\/openings\/[1-9]\d{1,15}$/.test(url.pathname)&&!url.search&&!url.hash&&!url.username&&!url.password?url.href:null}catch{return null}}

function listingModel(html){
 const doc=readNativeDocument(html)
 check(equal(activeHead(html).titles,['Careers & Jobs at Aiven | Join our team today!']),'official listing title')
 check(doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'&&node.attrs.href===LISTING).length===1,'official listing canonical')
 const lists=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').map(node=>JSON.parse(node.raw)).filter(value=>value['@type']==='ItemList')
 const list=one(lists,'publisher role ItemList')
 check(Number.isSafeInteger(list.numberOfItems)&&list.numberOfItems>0&&list.numberOfItems<=500&&Array.isArray(list.itemListElement)&&list.itemListElement.length===list.numberOfItems,'whole positive published role count')
 const anchors=doc.nodes(node=>node.tag==='a'&&roleURL(node.attrs.href)),urls=new Set(anchors.map(node=>node.attrs.href)),seen=new Set()
 check(urls.size===list.numberOfItems,'declared role list and active links reconcile')
 const rows=list.itemListElement.map((entry,index)=>{
  check(entry['@type']==='ListItem'&&entry.position===index+1&&typeof entry.name==='string'&&norm(entry.name)&&roleURL(entry.url)&&!seen.has(entry.url),'typed unique published role identity');seen.add(entry.url)
  const labels=[...new Set(anchors.filter(node=>node.attrs.href===entry.url).map(node=>doc.text(node)))]
  const label=one(labels,'consistent active role label'),title=norm(entry.name)
  check(label===title||label.startsWith(title+' '),'separate publisher title and workplace label')
  return{url:entry.url,title,location:label===title?null:label.slice(title.length+1),nativeListItem:entry}
 })
 return{rows,nativeItemList:list,fullNativeHTML:html}
}

function passiveCriteria(node){
 if(typeof node==='string')return true
 return !node.inert&&['root','p','div','span','br','strong','b','em','i','u','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote'].includes(node.tag)
  &&Object.keys(node.attrs).length===0&&node.children.every(passiveCriteria)
}

// The whole fixed HTML frame remains pinned after masking only the typed native
// model and its independently reconciled title/workplace/description renderings.
// Any additional script, field, hidden context or unmodeled restriction changes
// the frame. This reader never executes the client or submits an application.
export function readCurrentAtlasPage(url,html,row){
 check(roleURL(url)===url,'native role URL')
 const doc=readNativeDocument(html,{sourceRanges:true}),masks=[]
 const inner=(node,name)=>{check(Number.isInteger(node.sourceOpenEnd)&&Number.isInteger(node.sourceCloseStart),'closed '+name);masks.push({start:node.sourceOpenEnd,end:node.sourceCloseStart,name})}
 const whole=(node,name)=>masks.push({start:node.sourceStart,end:node.sourceOpenEnd,name})
 const carrier=one(doc.nodes(node=>node.tag==='script'&&node.attrs.id==='atlas-job'),'native Atlas job carrier')
 keys(carrier.attrs,['type','id'],'native carrier attributes');check(carrier.attrs.type==='application/json','native closed JSON carrier')
 const job=JSON.parse(carrier.raw)
 keys(job,['publicId','title','team','location','employmentType','postedAt','description','format','questions','acceptsApplications','acceptsFiles'],'native role')
 check(Number.isSafeInteger(job.publicId)&&url.endsWith('/'+job.publicId)&&job.title===row.title,'native listing/detail role identity')
 check(job.location==='India'&&row.location==='India','independent explicit India workplace')
 check(typeof job.team==='string'&&norm(job.team)&&typeof job.employmentType==='string'&&norm(job.employmentType),'native team and employment type')
 check(job.acceptsApplications===true&&typeof job.acceptsFiles==='boolean'&&job.format==='markdown'&&typeof job.description==='string'&&job.description.length>100&&job.description.length<=100000,'complete published native criteria and state')
 check(typeof job.postedAt==='string'&&Number.isFinite(Date.parse(job.postedAt))&&new Date(job.postedAt).toISOString()===job.postedAt,'native posting timestamp')
 check(Array.isArray(job.questions)&&job.questions.length<=40,'complete bounded public application questions')
 const questionKeys=new Set()
 for(const question of job.questions){
  keys(question,['key','label','required','answerType','options',...(Object.hasOwn(question,'description')?['description']:[])],'native question')
  check(typeof question.key==='string'&&question.key.length>0&&question.key.length<=400&&!questionKeys.has(question.key),'unique native question identity');questionKeys.add(question.key)
  check(typeof question.label==='string'&&norm(question.label)&&question.label.length<=300&&typeof question.required==='boolean'
   &&['short_text','long_text','boolean','single_select','multi_select','attachment'].includes(question.answerType)&&Array.isArray(question.options)&&question.options.length<=300
   &&question.options.every(option=>typeof option==='string'&&option.length>0&&option.length<=200)
   &&(!Object.hasOwn(question,'description')||typeof question.description==='string'&&question.description.length>0&&question.description.length<=500),'complete native question/requirement values')
 }
 const programs=doc.nodes(node=>node.tag==='script'&&node.attrs.src)
 check(programs.length===1&&programs[0].attrs.type==='module'&&new URL(programs[0].attrs.src,url).href===CLIENT,'exact declared Atlas module')
 const semantic=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').map(node=>({node,value:JSON.parse(node.raw)}))
 const organization=one(semantic.filter(item=>item.value['@type']==='Organization'),'native employer organization').value
 keys(organization,['@context','@type','name','legalName','url','description','contactPoint','address'],'native employer organization')
 keys(organization.contactPoint,['@type','contactType','email'],'native employer contact')
 keys(organization.address,['@type','streetAddress','postalCode','addressLocality','addressCountry'],'native employer address')
 check(organization['@context']==='https://schema.org'&&organization.name==='Aiven'&&organization.legalName==='Aiven Oy'&&organization.url==='https://aiven.io'
  &&typeof organization.description==='string'&&norm(organization.description)
  &&equal(organization.contactPoint,{'@type':'ContactPoint',contactType:'recruiting',email:'recruitment@aiven.io'})
  &&equal(organization.address,{'@type':'PostalAddress',streetAddress:'Antinkatu 1, 6th Floor',postalCode:'00100',addressLocality:'Helsinki',addressCountry:'FI'}),'reciprocal native legal employer')
 const{node:postingCarrier,value:posting}=one(semantic.filter(item=>item.value['@type']==='JobPosting'),'native posting')
 keys(posting,['@context','@type','title','description','datePosted','identifier','url','hiringOrganization','directApply','employmentType','jobLocation'],'native structured posting')
 keys(posting.identifier,['@type','name','value'],'native posting identifier')
 keys(posting.hiringOrganization,['@type','name','sameAs'],'native posting employer')
 keys(posting.jobLocation,['@type','address'],'native posting workplace')
 check(posting['@context']==='https://schema.org'&&posting.title===job.title&&posting.url===url
  &&equal(posting.identifier,{'@type':'PropertyValue',name:'Aiven',value:String(job.publicId)})
  &&equal(posting.hiringOrganization,{'@type':'Organization',name:'Aiven',sameAs:'https://aiven.io'})
  &&posting.jobLocation['@type']==='Place'&&posting.datePosted===job.postedAt&&posting.directApply===true
  &&job.employmentType==='Permanent'&&posting.employmentType==='FULL_TIME','whole native posting identity/employer/publication/employment binding')
 // This migration's JSON-LD puts the country label in addressLocality and omits
 // addressCountry. It supplies no city proof. Country comes from the actual
 // typed native workplace and the independent employer listing label above.
 keys(posting.jobLocation?.address,['@type','addressLocality'],'current incomplete JSON-LD address')
 check(posting.jobLocation.address['@type']==='PostalAddress'&&posting.jobLocation.address.addressLocality===job.location,'matching native workplace label')
 check(typeof posting.description==='string'&&posting.description.length<=150000,'complete rendered native criteria')
 const criteria=readNativeDocument(posting.description),criteriaRoot=one(criteria.nodes(node=>node.tag==='root'),'criteria root')
 check(passiveCriteria(criteriaRoot),'unqualified native rich criteria')
 check(!/[<>`]|!?\[[^\]]*\]\(|\*\*|__/.test(job.description),'unqualified native Markdown presentation')
 // Exact reviewed block-marker rules from the pinned Atlas bc renderer. Its
 // unordered-list rule also accepts '-Text' without a space; retain the whole
 // remaining line and never erase an arbitrary hyphen within the criteria.
 const plain=norm(job.description.replace(/\r\n?/g,'\n').split('\n').map(line=>{
  const heading=/^(#{1,3})\s*([^#\s].*?)\s*#*\s*$/.exec(line)
  const bullet=/^\s*(?:-(?!-)\s*|\*\s+)(\S.*)$/.exec(line),ordered=/^\s*\d+[.)]\s+(.*)$/.exec(line)
  return(heading?.[2]??bullet?.[1]??ordered?.[1]??line).trim()
 }).join('\n')),rendered=extractActiveDescription(posting.description)
 check(rendered&&plain===norm(rendered),'whole original and rendered criteria agree')
 const descriptionNode=one(doc.nodes(node=>node.tag==='div'&&html.slice(node.sourceOpenEnd,node.sourceCloseStart)===posting.description),'complete SSR criteria rendering')
 inner(carrier,'ATLAS-JOB');inner(postingCarrier,'ATLAS-POSTING');inner(descriptionNode,'ATLAS-CRITERIA')
 const title=one(doc.nodes(node=>node.tag==='title'),'native document title')
 check(title.raw===job.title+' - Aiven careers','native title binding');inner(title,'ATLAS-TITLE')
 const heading=one(doc.nodes(node=>node.tag==='h1'),'native role heading');check(heading.children.every(child=>typeof child==='string')&&doc.text(heading)===job.title,'active native heading binding');inner(heading,'ATLAS-HEADING')
 for(const[name,value]of[['TEAM',job.team],['WORKPLACE',job.location],['EMPLOYMENT',job.employmentType]]){
  const badge=one(doc.nodes(node=>node.tag==='span'&&doc.text(node)===value),'native '+name+' badge')
  check(badge.children.every(child=>typeof child==='string'),'literal native workplace/metadata badge');inner(badge,'ATLAS-'+name)
 }
 const canonical=one(doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'native canonical')
 keys(canonical.attrs,['rel','href'],'native canonical attributes');check(canonical.attrs.href===url,'native canonical role identity');whole(canonical,'ATLAS-CANONICAL')
 for(const[property,value,name]of[['og:title',job.title+' - Aiven careers','ATLAS-OG-TITLE'],['og:url',url,'ATLAS-OG-URL']]){
  const meta=one(doc.nodes(node=>node.tag==='meta'&&node.attrs.property===property),'native '+property)
  keys(meta.attrs,['property','content'],'native metadata attributes');check(meta.attrs.content===value,'native metadata binding');whole(meta,name)
 }
 let frame=html,prior=html.length
 for(const mask of masks.sort((a,b)=>b.start-a.start)){check(mask.end<=prior&&mask.start<mask.end,'disjoint native data/rendering masks');frame=frame.slice(0,mask.start)+'<'+mask.name+'>'+frame.slice(mask.end);prior=mask.start}
 return{job,posting,organization,frameSHA256:sha(frame),fullNativeHTML:html}
}

// Race every admitted asynchronous wait against its owning signal. The promise
// handlers remain attached after cancellation so late failures stay observed.
function interrupted(pending,signal){
 return new Promise((resolve,reject)=>{
  const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason)}
  signal.addEventListener('abort',abort,{once:true})
  Promise.resolve(pending).then(value=>{signal.removeEventListener('abort',abort);signal.aborted?reject(signal.reason):resolve(value)},error=>{signal.removeEventListener('abort',abort);reject(signal.aborted?signal.reason:error)})
  if(signal.aborted)abort()
 })
}

export async function runCurrentAivenAtlas({fetchImpl=globalThis.fetch,signal,now=()=>new Date().toISOString(),maxJobs=null,requestIntervalMs=1000,timeoutMs=180000,requestTimeoutMs=25000}={}){
 signal?.throwIfAborted()
 check(Number.isSafeInteger(requestIntervalMs)&&requestIntervalMs>=0&&(fetchImpl!==globalThis.fetch||requestIntervalMs>=1000),'native pacing limits')
 check(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000&&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=25000,'bounded native source/request deadlines')
 const owner=new AbortController(),sourceStarted=performance.now(),sourceExpired=()=>owner.abort(new DOMException('Aiven current source deadline exceeded','TimeoutError'))
 const timer=setTimeout(sourceExpired,timeoutMs)
 const sourceSignal=signal?AbortSignal.any([signal,owner.signal]):owner.signal,allowed=new Set([LISTING,CLIENT]),receipts=[],last=new Map();let total=0
 const sourceCheckpoint=()=>{signal?.throwIfAborted();if(performance.now()-sourceStarted>=timeoutMs&&!owner.signal.aborted)sourceExpired();sourceSignal.throwIfAborted()}
 const read=async(url,kind='html')=>{
  sourceCheckpoint();check(allowed.has(url)&&receipts.length<64,'bounded declared native request')
  const origin=new URL(url).origin,wait=requestIntervalMs-(Date.now()-(last.get(origin)??0))
  if(wait>0)try{await delay(wait,undefined,{signal:sourceSignal})}catch(error){signal?.throwIfAborted();throw error}
  sourceCheckpoint();last.set(origin,Date.now())
  const requestOwner=new AbortController(),requestStarted=performance.now(),requestExpired=()=>requestOwner.abort(new DOMException('Aiven current request deadline exceeded','TimeoutError'))
  const requestTimer=setTimeout(requestExpired,requestTimeoutMs),requestSignal=AbortSignal.any([sourceSignal,requestOwner.signal]),requestedAt=new Date().toISOString()
  const checkpoint=()=>{sourceCheckpoint();if(performance.now()-requestStarted>=requestTimeoutMs&&!requestOwner.signal.aborted)requestExpired();requestSignal.throwIfAborted()}
  let response,reader,complete=false,detached=false
  try{
   const pending=Promise.resolve().then(()=>{checkpoint();return fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',signal:requestSignal,headers:{Accept:kind==='js'?'application/javascript':'text/html,application/xhtml+xml'}})}).then(async admitted=>{
    if(detached||requestSignal.aborted){await disposeResponseBody(admitted,{bestEffort:true});checkpoint()}
    return admitted
   })
   // This continuation owns bounded cleanup if the fetch ignores cancellation
   // and only supplies its response after the caller has already returned.
   response=await interrupted(pending,requestSignal)
   signal?.throwIfAborted();await requireNativeHttpResponse(response,url,{context:'Aiven current native read',signal:requestSignal,callerSignal:signal??null});checkpoint()
   check((kind==='js'?/^(?:application|text)\/(?:java|ecma)script\b/i:/^(?:text\/html|application\/xhtml\+xml)\b/i).test(response.headers.get('content-type')??'')&&response.body,'native MIME/body')
   reader=response.body.getReader();const chunks=[];let bytes=0
   for(;;){checkpoint();const part=await interrupted(reader.read(),requestSignal);checkpoint();if(part.done){complete=true;break}bytes+=part.value.byteLength;total+=part.value.byteLength;check(bytes<=4000000&&total<=32000000,'native response/source byte bounds');chunks.push(Buffer.from(part.value))}
   const body=Buffer.concat(chunks,bytes),text=new TextDecoder('utf-8',{fatal:true}).decode(body)
   receipts.push({url,status:response.status,bodyBytes:bytes,bodySHA256:sha(body),requestedAt,completedAt:new Date().toISOString()});return text
  }catch(error){signal?.throwIfAborted();throw error}
  finally{
   detached=true;clearTimeout(requestTimer)
   try{
    if(reader){try{if(!complete)await disposeResponseReader(reader,{signal:requestSignal,bestEffort:true})}finally{reader.releaseLock()}}
    else if(response&&!response.bodyUsed)await disposeResponseBody(response,{signal:requestSignal,bestEffort:true})
   }catch{signal?.throwIfAborted()}
   signal?.throwIfAborted()
  }
 }
 try{
  const round=async()=>{
   const listing=listingModel(await read(LISTING)),details=[]
   for(const row of listing.rows.filter(row=>row.location==='India')){
    allowed.add(row.url);const page=readCurrentAtlasPage(row.url,await read(row.url),row)
    check(page.frameSHA256===FRAME_SHA,'whole native HTML frame changed')
    const client=await read(CLIENT,'js');check(Buffer.byteLength(client)===429152&&sha(client)===CLIENT_SHA,'whole native client program changed')
    check(Date.parse(page.job.postedAt)<=new Date(now()).getTime(),'future native publication')
    details.push({row,...page})
   }
   return{listing,details}
  }
  const opening=await round(),closing=await round();check(equal(opening,closing),'complete closing listing/criteria/application models changed')
  const all=opening.details.map(({row,job,posting,organization})=>({source:'aiven',company:'Aiven',title:job.title,jobId:String(job.publicId),requisitionId:String(job.publicId),
   sourceUrl:row.url,link:row.url,applyUrl:row.url,location:job.location,city:null,state:null,country:'India',department:job.team,employmentType:job.employmentType,
   postingDate:job.postedAt,closingDate:null,jobDescription:posting.description,sourceDescription:job.description,sourceDescriptionFormat:job.format,
   sourceNativeModel:job,sourceNativeRenderedDescription:posting.description,sourceNativeApplicationQuestions:job.questions,sourceNativeEmployer:organization,
   sourceNativeApplicationPolicy:{requiredIdentityFields:['firstName','lastName','email'],externalCandidatesOnly:true,dataNoticeConfirmationRequired:true,maximumFiles:2,maximumFileBytes:10485760,acceptedFileTypes:['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],verifiedClientSHA256:CLIENT_SHA},
   sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,publicEligibility:null,applicationValidationQualified:false,applicationVisited:false,scrapedAt:now()}))
  const jobs=Number.isSafeInteger(maxJobs)&&maxJobs>0?all.slice(0,maxJobs):all
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:LISTING,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:receipts.length,verifiedAt:now(),reason:'native-Atlas-explicit-India-full-models-retained;company-browser-and-application-scope-unverified'})
  attachSourceObservationEvidence(jobs,{source:'aiven',recordKind:'vacancy-rows',observedRecordCount:opening.listing.rows.length,observedVacancyCount:opening.listing.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{source:'aiven',observedListingCount:opening.listing.rows.length,selectedExplicitIndiaCount:all.length,nativeOpeningModel:opening,nativeClosingModel:closing,
   retainedResponses:receipts,closingNativeModelsMatch:true,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,browserEquivalenceComplete:false,applicationValidationQualified:false,publicEligibility:null,lifecycleCleanupAllowed:false}})
  return jobs
 }finally{clearTimeout(timer);owner.abort()}
}
