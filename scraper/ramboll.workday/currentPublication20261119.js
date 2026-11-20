import {parse} from 'acorn'
import {isDeepStrictEqual} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {findExplicitNativeClosure} from '../../scraper-support/utils/sourceAvailability.js'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const source='ramboll',company='Ramboll',origin='https://www.ramboll.com',home=origin+'/careers'
const norm=value=>String(value??'').replace(/\s+/g,' ').trim(),same=isDeepStrictEqual
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('[ramboll] current publication: '+message),{abortRetries:true,failureKind:'parser_or_contract_error'})}
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)
function walk(node,visit,depth=0){if(!node||typeof node!=='object'||depth>200)return;visit(node);for(const value of Object.values(node))if(value&&typeof value==='object'){if(Array.isArray(value))value.forEach(n=>walk(n,visit,depth+1));else walk(value,visit,depth+1)}}

export function readRambollPage(html){
 const d=readNativeDocument(html),scripts=d.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__')
 need(scripts.length===1&&!d.nodes(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')).length,'unique current own literal page unavailable')
 const model=JSON.parse(scripts[0].raw),payload=model.props?.pageProps,locale=model.locale,route=payload?.__namespaces?.multiple?.career
 need(locale==='en'&&typeof route==='string'&&/^[a-z][a-z-]{1,40}$/.test(route),'current native language/role route unavailable')
 const resources=d.nodes(n=>n.tag==='script'&&n.attrs.src).map(n=>new URL(n.attrs.src,home)).filter(u=>u.origin===origin&&u.pathname.startsWith('/_next/')&&u.pathname.endsWith('.js')&&!u.search&&!u.hash)
 need(resources.length>0&&resources.length<=80,'current own native program declarations unavailable')
 return{model,payload,locale,route,resources:[...new Set(resources.map(u=>u.href))]}
}

export function readRambollProtocol(code){
 if(!code.includes('/api/jobsPosts?locale='))return null
 need(Buffer.byteLength(code)<=4*1024*1024,'native protocol program too large')
 const tree=parse(code,{ecmaVersion:'latest'}),aliases=new Set(),fetches=[],routes=[]
 walk(tree,n=>{
  if(n.type==='ObjectPattern')for(const p of n.properties??[])if(p.type==='Property'&&p.key?.name==='multiple'&&p.value?.type==='Identifier')aliases.add(p.value.name)
  if(n.type==='CallExpression'&&n.callee?.type==='Identifier'&&n.callee.name==='fetch'){
   const literals=[];walk(n.arguments[0],x=>{if(x.type==='Literal'&&typeof x.value==='string')literals.push(x.value)})
   const required=['/api/jobsPosts?locale=','&countries=','&workplace=','&market=','&careerStage=','&search=','&pageNumber=']
   if(!required.every(v=>literals.includes(v)))return
   const settings=n.arguments[1]
   need(!settings||settings.type==='ObjectExpression'&&settings.properties.every(p=>p.type==='Property'&&!p.computed&&['signal','method'].includes(p.key.name??p.key.value)
    &&((p.key.name??p.key.value)!=='method'||p.value.type==='Literal'&&p.value.value==='GET')),'native public search method changed')
   fetches.push(n)
  }
  if(n.type==='ObjectExpression'&&n.properties.some(p=>(p.key?.name??p.key?.value)==='as'&&p.value?.value==='a')){
   const href=n.properties.find(p=>(p.key?.name??p.key?.value)==='href')?.value
   if(href)routes.push(href)
  }
 })
 need(fetches.length===1,'unique declared current native GET search protocol unavailable')
 const declared=routes.filter(n=>{
  if(n.type!=='CallExpression'||n.callee?.property?.name!=='concat'||n.arguments.length!==1||n.arguments[0].type!=='MemberExpression'||n.arguments[0].computed||n.arguments[0].property.name!=='jobPostId')return false
  const prefix=n.callee.object
  if(prefix?.type!=='CallExpression'||prefix.callee?.property?.name!=='concat'||prefix.callee.object?.type!=='Literal'||prefix.callee.object.value!==''||prefix.arguments.length!==2||prefix.arguments[1].value!=='/')return false
  let route=false
  walk(prefix.arguments[0],x=>{if(x.type==='CallExpression'&&x.callee?.type==='Identifier'&&aliases.has(x.callee.name)&&x.arguments.length===1&&x.arguments[0].value==='career')route=true})
  return route
 })
 need(declared.length===1,'current own native posting-ID role route declaration unavailable')
 return{path:'/api/jobsPosts',method:'GET',countrySeparator:'_SEPARATOR_',roleField:'jobPostId',routeNamespace:'multiple.career'}
}

export function readRambollInventory(value,pageNumber){
 const model=value?.jobsPosts,rows=model?.data?.jobPosts
 need(model&&Array.isArray(rows)&&Number.isSafeInteger(model.pageNumber)&&model.pageNumber===pageNumber&&Number.isSafeInteger(model.pageSize)&&model.pageSize>0&&model.pageSize<=100
  &&Number.isSafeInteger(model.totalRecordCount)&&model.totalRecordCount>=0&&model.totalRecordCount<=5000&&rows.length<=model.pageSize,'native page/pagination envelope unavailable')
 need(rows.every(row=>uuid(row?.jobPostId)&&norm(row.title)),'native posting identity unavailable')
 return{model,rows,total:model.totalRecordCount,size:model.pageSize}
}

function authoredDate(raw,now,deadline=false){
 need(typeof raw==='string','native publication date type unavailable')
 const local=/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?$/.exec(raw)
 const date=nativeDate(local?local[1]:raw,{required:true}),today=now.toISOString().slice(0,10)
 need(deadline?(date.exact?Date.parse(date.iso)>=+now:date.iso.slice(0,10)>=today):(date.exact?Date.parse(date.iso)<=+now:date.iso.slice(0,10)<=today),deadline?'native publication expired':'native publication date in future')
 return{raw,date:date.raw,precision:local?'native-calendar-day-with-timezone-unavailable':date.precision,sourceTimezone:local?null:'as-authored'}
}

function workplaceCountries(value){
 const found=new Set(),whole=nativeLocationCountryName(value);if(whole)found.add(whole)
 for(const part of String(value??'').split(/[,/;|&]|\s+(?:and|or)\s+/i)){const label=norm(part);if(label.length<=2)continue;const country=nativeCountryName(label);if(country)found.add(country)}
 return [...found]
}

function nativeApplication(row,route){
 if(row.applyUrl==null||row.applyUrl==='')return null
 let u;try{u=new URL(row.applyUrl,origin)}catch{}
 const own=u?.href===origin+'/'+route+'/'+row.jobPostId
 const declaredATS=u&&u.origin==='https://jobs.smartrecruiters.com'&&!u.username&&!u.password&&!u.hash
  &&/^\/Ramboll3\/[1-9]\d+-[^/]+$/.test(u.pathname)&&uuid(row.srJobPostId)
  &&[...u.searchParams].every(([key,value])=>key==='oga'&&value==='true')
 need(own||declaredATS,'native application handoff differs from the qualified own role or current declared employer ATS')
 return u.href
}

function constrain(row,observedAt,route){
 const now=new Date(observedAt);need(Number.isFinite(+now),'invalid observation clock')
 need(norm(row.company)===company,'native employer conflict')
 need(nativeCountryName(row.country)==='India','native job country conflict')
 for(const key of ['countryCode','workCountry','addressCountry'])if(row[key]!=null&&row[key]!=='')need(nativeCountryName(row[key])==='India','native additional country conflict')
 for(const key of ['location','workplace']){const countries=workplaceCountries(row[key]);need(!countries.length||countries.includes('India'),'native workplace country conflict')}
 if(row.additionalLocation!=null&&row.additionalLocation!==''){
  need(typeof row.additionalLocation==='string','additional native workplaces unqualified')
  for(const label of row.additionalLocation.split(/[;|]/)){const countries=workplaceCountries(label);need(!countries.length||countries.includes('India'),'native additional workplace country conflict')}
 }
 nativeApplication(row,route)
 for(const key of ['isClosed','closed','expired','isExpired','isArchived','archived','disabled'])if(row[key]!=null)need(row[key]===false,'native availability explicitly closed')
 for(const key of ['isActive','isPublished','canApply'])if(row[key]!=null)need(row[key]===true,'native availability unavailable')
 for(const key of ['status','postingStatus','jobStatus'])if(row[key]!=null)need(!/^(?:closed|filled|expired|removed|archived|inactive|draft)$/i.test(norm(row[key])),'native status explicitly closed')
 const publications=[],expiries=[]
 for(const key of ['postingStartDate','datePosted','publishedAt'])if(row[key]!=null&&row[key]!=='')publications.push({field:key,...authoredDate(row[key],now)})
 for(const key of ['unpublishDateTime','validThrough','closingDate','applicationDeadline','expiryDate'])if(row[key]!=null&&row[key]!=='')expiries.push({field:key,...authoredDate(row[key],now,true)})
 const html=[row.description,row.teaser].filter(v=>typeof v==='string').join('\n'),doc=readNativeDocument(html),plain=extractActiveDescription(html),blockTags=new Set(['p','li','h1','h2','h3','h4','div','section','td','dt','dd']),nodes=doc.nodes(n=>blockTags.has(n.tag))
 const leafBlocks=nodes.filter(n=>!doc.nodes(child=>child!==n&&blockTags.has(child.tag),n).length).map(doc.text),blocks=leafBlocks.length?leafBlocks:[plain??'']
 need(!findExplicitNativeClosure([plain??'',...blocks]),'native authored role explicitly closed')
 for(const block of blocks){
  const place=/^(?:(?:job|work)\s+)?(?:location|workplace)\s*:\s*(.+)$/i.exec(block);if(place){const countries=workplaceCountries(place[1]);need(!countries.length||countries.includes('India'),'native authored workplace conflict')}
  const country=/^(?:(?:job|work|workplace)\s+)?country\s*:\s*(.+)$/i.exec(block);if(country)need(nativeCountryName(country[1])==='India','native authored country conflict')
  const employer=/^(?:company(?: name)?|employer|legal employer|hiring organization)\s*:\s*(.+)$/i.exec(block);if(employer)need(norm(employer[1])===company,'native authored employer conflict')
  const status=/^(?:(?:job|posting|publication)\s+)?(?:status|availability)\s*:\s*(.+)$/i.exec(block);if(status)need(!/^(?:closed|filled|expired|removed|archived|inactive|draft|unpublished)$/i.test(norm(status[1])),'native authored publication status unavailable')
  const deadline=/^(?:closing date|application deadline|valid through|expiry date|expiration date)\s*:\s*(.+)$/i.exec(block);if(deadline)expiries.push({field:'authored-criteria-deadline',...authoredDate(norm(deadline[1]),now,true)})
  const posted=/^(?:date posted|posted date|publication date|published date)\s*:\s*(.+)$/i.exec(block);if(posted)publications.push({field:'authored-criteria-publication',...authoredDate(norm(posted[1]),now)})
 }
 publications.sort((a,b)=>a.date.localeCompare(b.date));expiries.sort((a,b)=>a.date.localeCompare(b.date));return{publications,expiries}
}

export function projectRambollPublishedRole(row,{route,observedAt}={}){
 need(uuid(row?.jobPostId)&&norm(row.refId)&&norm(row.title)&&norm(row.workplace??row.location)&&/^[a-z][a-z-]{1,40}$/.test(route??''),'native exact role identity/workplace unavailable')
 const dates=constrain(row,observedAt,route),url=origin+'/'+route+'/'+row.jobPostId,description=extractActiveDescription(row.description??'')||extractActiveDescription(row.teaser??'')||null
 return{source,company,title:norm(row.title),jobId:row.jobPostId,requisitionId:row.refId,sourceUrl:url,applyUrl:url,link:url,
  country:'India',location:norm(row.workplace||row.location),city:null,state:null,department:null,sourceNativeMarket:row.market??null,nativeEmployerDisplayName:row.company,nativeLegalEmployer:null,
  sourceDescription:description,jobDescription:description,sourceNativeRecord:row,sourceNativeDescription:row.description??null,sourceNativeTeaser:row.teaser??null,
  sourceNativeWorkplaceCountries:[...new Set([row.location,row.workplace,row.additionalLocation].flatMap(workplaceCountries))],
  postingDate:dates.publications[0]?.date??null,closingDate:dates.expiries[0]?.date??null,sourceNativePublicationDates:dates.publications,sourceNativeExpiryDates:dates.expiries,
  sourcePublicationDatePolicy:'native-authored-calendar-day-retained-without-inventing-timezone-or-first-ever-publication',
  sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'native-current-published-record-criteria-and-declared-own-role-handoff-only-full-renderer-and-application-controls-unverified',
  sourceNativeApplication:{kind:'current-publisher-declared-posting-ID-role-link',url,nativePostingId:row.jobPostId,rolePageObserved:false,controlsQualified:false,activationVerified:false,submitted:false},
  employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],backendApplicationActivationVerified:false,
  sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:observedAt}
}

export async function runRambollCurrentPublication(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'metadata-free callback transport unsupported')
 const timeout=options.timeoutMs??180000,interval=options.requestIntervalMs??1000
 need(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000&&Number.isSafeInteger(interval)&&interval>=0&&interval<=10000,'invalid native bounded limits')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Ramboll source deadline exceeded')),timeout),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const nativeFetch=options.fetchImpl??globalThis.fetch,allowed=new Set([home]),raw=[],held=[],observedDetails=[]
 let requests=0,bytes=0,last=0
 async function read(url,kind='html'){
  signal.throwIfAborted();need(allowed.has(url)&&++requests<=160,'request outside declared native public contract')
  const wait=interval-(Date.now()-last);if(wait>0)await delay(wait,undefined,{signal});last=Date.now()
  const packet=await boundedDeclaredPublicRead(url,{signal,timeoutMs:20000,overflowError:Error('Ramboll response hard byte limit'),fetchImpl:async(u,init)=>{
   const r=await nativeFetch(u,{...init,credentials:'omit'})
   try{need(r?.url===u&&r.redirected===false&&r.headers?.get&&r.body&&Number.isInteger(r.status),'native HTTP metadata unavailable')
    if(r.status!==200)throw Object.assign(Error('Ramboll native HTTP '+r.status),{status:r.status})
    const mime=r.headers.get('content-type')??'',pattern={html:/text\/html(?:\s*;|$)/i,json:/(?:application|text)\/(?:[\w.+-]*\+)?json\b/i,js:/(?:application|text)\/(?:x-)?(?:java|ecma)script/i}[kind]
    need(pattern.test(mime),'native MIME unavailable');return r
   }catch(error){try{Promise.resolve(r?.body?.cancel(error)).catch(()=>{})}catch{}throw error}
  }})
  const body=Buffer.from(packet.bodyBase64,'base64');bytes+=body.length;need(body.length<=4*1024*1024&&bytes<=64*1024*1024,'native decoded entity/aggregate byte bound exceeded')
  const text=new TextDecoder('utf-8',{fatal:true}).decode(body);raw.push({url,kind,originalBody:text});return text
 }
 const phase=async()=>{
  const page=readRambollPage(await read(home)),india=page.payload.pageProps?.Jobs?.countries?.filter(r=>nativeCountryName(r.apiCodename)==='India')
  need(india?.length===1&&india[0].apiCodename==='India','current native India country facet unavailable')
  let protocol=null
  for(const url of page.resources){allowed.add(url);protocol=readRambollProtocol(await read(url,'js'));if(protocol)break}
  need(protocol,'current declared native public jobs protocol unavailable')
  const records=[];let total=null,size=null
  for(let number=1;number<=60;number++){
   const url=origin+protocol.path+'?'+new URLSearchParams({locale:page.locale,countries:india[0].apiCodename,workplace:'',market:'',careerStage:'',search:'',pageNumber:String(number)})
   allowed.add(url);const value=JSON.parse(await read(url,'json')),parsed=readRambollInventory(value,number)
   if(total===null){total=parsed.total;size=parsed.size}
   need(total===parsed.total&&size===parsed.size,'native pagination total/page size changed');records.push(...parsed.rows)
   need(new Set(records.map(r=>r.jobPostId)).size===records.length,'native duplicate posting identity across pages')
   if(records.length>=total){need(records.length===total,'native pagination total overcount');return{records,total,route:page.route,protocol,declaredFacet:india[0]}}
   need(parsed.rows.length===size,'native pagination truncated before total')
  }
  throw Error('Ramboll native page bound exhausted')
 }
 try{
  const opening=await phase(),closing=await phase()
  need(opening.route===closing.route&&same(opening.protocol,closing.protocol),'current closing native route/protocol differs')
  const observedAt=(options.now??(()=>new Date().toISOString()))(),closed=new Map(closing.records.map(row=>[row.jobPostId,row])),jobs=[]
  for(const row of opening.records){try{
   need(same(row,closed.get(row.jobPostId)),'native closing whole publication model changed')
   const job=projectRambollPublishedRole(row,{route:opening.route,observedAt})
   job.sourceClosingQualified=true;jobs.push(job)
  }catch(error){held.push({id:row.jobPostId,reason:error.message,originalRecord:row,closingRecord:closed.get(row.jobPostId)??null})}}
  // Close the independently published native inventory before attempting these
  // optional role reads. An unavailable enrichment cannot erase that proof.
  const optionalRoleFailures=[]
  let originUnavailable=false
  const remove=(row,error)=>{const index=jobs.findIndex(job=>job.jobId===row.jobPostId);if(index!==-1)jobs.splice(index,1);held.push({id:row.jobPostId,reason:error.message,originalRecord:row,closingRecord:closed.get(row.jobPostId)??null})}
  for(const row of opening.records.slice(0,2)){
   if(originUnavailable)break
   const job=jobs.find(value=>value.jobId===row.jobPostId);if(!job)continue
   // This URL is generated by the current native client using its original ID.
   const url=origin+'/'+opening.route+'/'+row.jobPostId;allowed.add(url)
   let observation=null
   try{
    const html=await read(url),a=readRambollPage(html).payload.pageProps?.Job?.data?.jobPost
    need(a?.jobPostId===row.jobPostId&&a.title===row.title&&a.refId===row.refId,'native observed own role identity conflict')
    const dates=constrain(a,observedAt,opening.route)
    observation={id:row.jobPostId,openingRecord:a,closingRecord:null,detailClosingQualified:false};observedDetails.push(observation)
    job.sourceNativeObservedRole=a;job.sourceNativeApplication.rolePageObserved=true;job.sourceNativeRoleDetailClosingQualified=false
    const application=nativeApplication(a,opening.route)
    if(application){const d=readNativeDocument(html);need(d.nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>{try{return new URL(n.attrs.href,url).href===application&&/^apply\s+now/i.test(d.text(n))}catch{return false}}),'native observed role application field/visible handoff conflict')
     job.applyUrl=application;job.link=application;job.sourceNativeApplication={...job.sourceNativeApplication,kind:'current-own-role-declared-employer-ATS-job-handoff',url:application,originalOwnRoleURL:url,nativeATSJobPostID:a.srJobPostId??null}}
    job.sourceDescription=extractActiveDescription(a.description??'')||extractActiveDescription(a.teaser??'')||job.sourceDescription;job.jobDescription=job.sourceDescription
    job.sourceNativeCriteriaConflict=!same(a.description,row.description)||!same(a.teaser,row.teaser)
    job.sourceNativeObservedPublicationDates=dates.publications;job.sourceNativeObservedExpiryDates=dates.expiries
    const posted=[...job.sourceNativePublicationDates,...dates.publications].sort((a,b)=>a.date.localeCompare(b.date)),expires=[...job.sourceNativeExpiryDates,...dates.expiries].sort((a,b)=>a.date.localeCompare(b.date))
    job.postingDate=posted[0]?.date??null;job.closingDate=expires[0]?.date??null
    const b=readRambollPage(await read(url)).payload.pageProps?.Job?.data?.jobPost
    need(b?.jobPostId===row.jobPostId&&b.title===row.title&&b.refId===row.refId,'native observed closing own role identity conflict')
    constrain(b,observedAt,opening.route);observation.closingRecord=b
    need(same(a,b),'native observed own role closing data changed')
    observation.detailClosingQualified=true;job.sourceNativeObservedClosingRole=b;job.sourceNativeRoleDetailClosingQualified=true
   }catch(error){
    signal.throwIfAborted()
    const status=Number.isInteger(error.status)?error.status:null
    optionalRoleFailures.push({id:row.jobPostId,url,status,reason:error.message,openingRoleObserved:!!observation})
    if([202,401,403,429,451].includes(status))originUnavailable=true
    if([404,410].includes(status)||error.failureKind==='parser_or_contract_error'||error instanceof SyntaxError)remove(row,error)
   }
  }
  const audit={source,openingNativeRecords:opening.records,closingNativeRecords:closing.records,openingDeclaredFacet:opening.declaredFacet,closingDeclaredFacet:closing.declaredFacet,observedDetails,optionalRoleFailures,held,originalResponses:raw,
   companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeClientExecuted:false,backendApplicationActivationVerified:false,applicationSubmitted:false}
  const result=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0?jobs.slice(0,options.maxJobs):jobs
  attachSourceObservationEvidence(result,{source,recordKind:'vacancy-rows',observedRecordCount:opening.records.length,observedVacancyCount:opening.records.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null})
  Object.defineProperty(result,'nativeCollectionEvidence',{value:audit,configurable:true})
  if(options.onAudit){let listener;try{await Promise.race([Promise.resolve().then(()=>options.onAudit(structuredClone(audit))),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true});if(signal.aborted)listener()})])}finally{if(listener)signal.removeEventListener('abort',listener)}}signal.throwIfAborted()
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:home,firstParty:true,pagesFetched:raw.length,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
   reason:'current-own-declared-native-India-publications-whole-model-closing-and-role-handoff-qualified;full-renderer-application-controls-company-inventory-and-cleanup-unverified'})
 }finally{clearTimeout(timer);controller.abort()}
}
