import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'

const profile=JSON.parse(readFileSync(new URL('./reviewedNative20261117.json',import.meta.url)))
const HOME='https://fireflies.ai/',BOARD=profile.boardURL,API=profile.apiURL,sha=value=>createHash('sha256').update(value).digest('hex')
const fail=message=>firstPartyFailure('firefliesai','Fireflies native '+message,{nativeAuthorityFailure:true})
const need=(ok,message)=>{if(!ok)throw fail(message)}
const detailRequest=extId=>({...profile.roles[0].request,variables:{boardId:'fireflies',extId}})
const extID=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(value)
const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
const within=(operation,signal,dispose)=>new Promise((resolve,reject)=>{
 let done=false
 const stop=()=>{if(!done){done=true;signal.removeEventListener('abort',stop);reject(signal.reason)}}
 signal.addEventListener('abort',stop,{once:true});if(signal.aborted){stop();return}
 Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}).then(value=>{
  if(done){if(dispose)ignore(()=>dispose(value));return}
  done=true;signal.removeEventListener('abort',stop);resolve(value)
 },error=>{if(!done){done=true;signal.removeEventListener('abort',stop);reject(error)}})
})

// Source-local JSON POST transport: the existing shared form-query reader has
// a different method/body contract. Only these reviewed public reads are used.
function reader(options){
 options.signal?.throwIfAborted()
 need(!options.fetchPage&&!options.fetchGraphql&&!options.fetchText&&!options.fetchJson,'Original HTTP metadata required; body-only overrides cannot qualify current Gem')
 const sourceMs=options.sourceTimeoutMs??180000,requestMs=options.requestTimeoutMs??15000
 if(!Number.isSafeInteger(sourceMs)||sourceMs<1||sourceMs>180000||!Number.isSafeInteger(requestMs)||requestMs<1||requestMs>15000)throw RangeError('Fireflies native invalid deadline')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const began=performance.now(),timer=setTimeout(()=>controller.abort(new DOMException('Fireflies native source deadline exceeded','TimeoutError')),sourceMs)
 const receipts=[],admittedRoles=new Set();let total=0,nextStart=0
 const check=()=>{options.signal?.throwIfAborted();if(performance.now()-began>=sourceMs&&!controller.signal.aborted)controller.abort(new DOMException('Fireflies native source deadline exceeded','TimeoutError'));signal.throwIfAborted()}
 return{check,receipts,allowRole(id){need(extID(id)&&admittedRoles.size<16,'invalid/excessive current native role admission');admittedRoles.add(id)},stats:()=>({requests:receipts.length,decodedBytes:total,sourceTimeoutMs:sourceMs,requestTimeoutMs:requestMs}),close:()=>{clearTimeout(timer);controller.abort()},
  async read(url,query){
   check();need(receipts.length<72,'physical read limit exceeded')
   if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal})
   check();nextStart=performance.now()+500
   const requestBody=query?JSON.stringify(query):null
   const currentQueries=[profile.list.request,...[...admittedRoles].map(detailRequest)]
   const rolePages=[...admittedRoles].flatMap(id=>[BOARD+'/'+id,BOARD+'/'+id+'/application'])
   need(query?url===API&&currentQueries.some(q=>JSON.stringify(q)===requestBody):[HOME,BOARD,...profile.clients.map(c=>c.url),...rolePages].includes(url),'unreviewed public read admission')
   need(!requestBody||Buffer.byteLength(requestBody)<=8192,'excessive native query body')
   const deadline=new AbortController(),requestSignal=AbortSignal.any([signal,deadline.signal]),start=performance.now()
   const requestTimer=setTimeout(()=>deadline.abort(new DOMException('Fireflies native read deadline exceeded','TimeoutError')),requestMs)
   const requestCheck=()=>{check();if(performance.now()-start>=requestMs&&!deadline.signal.aborted)deadline.abort(new DOMException('Fireflies native read deadline exceeded','TimeoutError'));requestSignal.throwIfAborted()}
   const receipt={url,method:query?'POST':'GET',...(query?{requestBodySHA256:sha(requestBody)}:{})};receipts.push(receipt)
   let response,stream,completed=false,observedHttpError=null
   const dispose=()=>{if(stream){ignore(()=>stream.cancel(requestSignal.reason));ignore(()=>stream.releaseLock())}else if(response)ignore(()=>response.body?.cancel(requestSignal.reason))}
   try{
    response=await within(()=>(options.fetchImpl??globalThis.fetch)(url,{method:receipt.method,redirect:'manual',credentials:'omit',cache:'no-store',signal:requestSignal,
     headers:{Accept:query?'application/json':'text/html,application/javascript,*/*;q=0.5',...(query?{'Content-Type':'application/json'}:{})},...(query?{body:requestBody}:{})}),requestSignal,value=>value.body?.cancel())
    requestCheck();receipt.status=response.status;receipt.finalURL=response.url
    try{
     // This helper owns bounded, signal-aware denial-body disposal. Preserve
     // its already-observed HTTP failure if a local deadline interrupts that
     // cleanup; only an explicit caller abort may replace the primary error.
     await requireNativeHttpResponse(response,url,{context:'Fireflies original native HTTP',signal:requestSignal,callerSignal:options.signal??null})
    }catch(error){
     options.signal?.throwIfAborted()
     if(error?.httpStatus===receipt.status&&error?.requestedUrl===url&&error?.responseUrl===receipt.finalURL)observedHttpError=error
     throw error
    }
    requestCheck();need(!response.redirected,'original HTTP followed an undeclared redirect at '+url)
    const mime=response.headers.get('content-type')??''
    need((query?/^application\/json(?:;|$)/i:url.includes('static.gem.com')?/^(?:application|text)\/(?:x-)?javascript(?:;|$)/i:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i).test(mime),'original MIME changed')
    stream=await within(()=>response.body.getReader(),requestSignal,value=>{ignore(()=>value.cancel());ignore(()=>value.releaseLock())})
    const chunks=[];let size=0
    for(;;){const item=await within(()=>stream.read(),requestSignal);requestCheck();if(item.done)break;need(item.value instanceof Uint8Array,'unsupported original body chunk');size+=item.value.byteLength;need(size<=8*1024*1024&&total+size<=32*1024*1024,'original body byte budget exceeded');chunks.push(Buffer.from(item.value))}
    const bytes=Buffer.concat(chunks);total+=size;need(bytes.length>0,'empty original body');requestCheck()
    receipt.bodySHA256=sha(bytes);receipt.bodyBytes=bytes.length;completed=true
    return {body:new TextDecoder('utf8',{fatal:true}).decode(bytes),sha256:receipt.bodySHA256}
   }catch(error){dispose();options.signal?.throwIfAborted();if(observedHttpError)throw observedHttpError;signal.throwIfAborted();throw error}
   finally{clearTimeout(requestTimer);if(completed)ignore(()=>stream.releaseLock())}
  },
 }
}
function home(html){
 const doc=readNativeDocument(html),head=activeHead(html)
 need(head.titles.length===1&&head.titles[0]===profile.homepageTitle,'current employer homepage identity changed')
 need(head.metas.some(m=>m.property==='og:site_name'&&m.content==='Fireflies.ai'),'employer brand metadata changed')
 need(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href==='https://fireflies.ai').length===1,'employer canonical changed')
 need(doc.nodes(n=>n.tag==='a'&&n.attrs.href===BOARD&&doc.text(n)==='Careers').length>0,'employer native board handoff changed')
}
function board(html){const doc=readNativeDocument(html);need(activeHead(html).titles[0]==='Fireflies Careers','native board title changed');need(doc.nodes(n=>n.tag==='script'&&n.attrs.type==='module'&&n.attrs.src===profile.clients[0].url).length===1,'native current client declaration changed')}
function nativeJSON(response){
 readLiteralModel(response.body)
 const model=JSON.parse(response.body)
 need(!Object.hasOwn(model,'errors'),'native query errors present');return model
}
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const keys=(value,expected,label)=>need(object(value)&&Object.keys(value).sort().join('|')===expected.split(' ').sort().join('|'),'unqualified '+label+' fields')
const text=(value,label)=>need(typeof value==='string'&&value.trim().length>0&&value.length<=1024,'unqualified '+label)
const maybeText=(value,label)=>{if(value!==null)text(value,label)}
function locations(rows){
 need(Array.isArray(rows)&&rows.length<=100&&new Set(rows.map(l=>l?.id)).size===rows.length,'unqualified or duplicated worksite records')
 for(const row of rows){keys(row,'id extId name city isoCountry isRemote','worksite');text(row.id,'worksite id');text(row.extId,'worksite external id');text(row.name,'worksite name');need(row.city===null||typeof row.city==='string'&&row.city.length<=1024,'unqualified worksite city');need(row.isoCountry===null||typeof row.isoCountry==='string'&&/^[A-Z]{3}$/.test(row.isoCountry),'unqualified worksite country');need(typeof row.isRemote==='boolean','unqualified remote worksite')}
}
function department(d){keys(d,'id extId name','department');for(const value of Object.values(d))text(value,'department value')}
function listing(model){
 keys(model,'data','list response');keys(model.data,'oatsExternalJobPostings oatsExternalJobPostingsFilters jobBoardExternal','list data')
 const data=model.data,board=data.jobBoardExternal
 keys(board,'id teamDisplayName descriptionHtml pageTitle','employer board')
 need(board.id===profile.boardId&&board.teamDisplayName===profile.nativeTeam&&board.pageTitle==='Fireflies Careers'&&typeof board.descriptionHtml==='string','native employer board identity differs')
 keys(data.oatsExternalJobPostings,'jobPostings','listing')
 const rows=data.oatsExternalJobPostings.jobPostings
 need(Array.isArray(rows)&&rows.length<=100&&new Set(rows.map(r=>r?.extId)).size===rows.length&&new Set(rows.map(r=>r?.id)).size===rows.length,'unqualified or duplicate native record identities')
 for(const row of rows){
  keys(row,'id extId title locations job','listing role');text(row.id,'native posting id');need(extID(row.extId),'unqualified native external role identity');text(row.title,'role title');locations(row.locations)
  keys(row.job,'id department locationType employmentType','listing job');text(row.job.id,'native job id');department(row.job.department);maybeText(row.job.locationType,'location type');maybeText(row.job.employmentType,'employment type')
 }
 need(Array.isArray(data.oatsExternalJobPostingsFilters)&&data.oatsExternalJobPostingsFilters.length<=500,'unqualified native filters')
 for(const f of data.oatsExternalJobPostingsFilters){keys(f,'type displayName rawValue value count','native filter');for(const k of ['type','displayName','rawValue','value'])text(f[k],'filter value');need(Number.isSafeInteger(f.count)&&f.count>=0,'unqualified native filter count')}
 return rows
}
function questions(rows,demographic=false){
 need(Array.isArray(rows)&&rows.length<=100,'unqualified native questions')
 for(const q of rows){
  keys(q,demographic?'extId answerType displayType text description options':'extId answerType displayType fileType text description isRequired options numericRatingRange','native question')
  text(q.extId,'question identity');text(q.answerType,'question answer type');text(q.text,'question text');maybeText(q.displayType,'question display type');maybeText(q.description,'question description')
  if(!demographic){maybeText(q.fileType,'question file type');need(typeof q.isRequired==='boolean','unqualified question requirement');need(q.numericRatingRange===null||Number.isFinite(q.numericRatingRange),'unqualified numeric rating range')}
  if(q.options!==null){need(Array.isArray(q.options)&&q.options.length<=100,'unqualified question options');for(const o of q.options){keys(o,'extId value','native answer option');text(o.extId,'answer option identity');text(o.value,'answer option value')}}
 }
}
function detail(model,row){
 keys(model,'data','detail response');keys(model.data,'oatsExternalJobPosting oatsJobPostFieldsAndQuestions','detail data')
 const d=model.data.oatsExternalJobPosting,a=model.data.oatsJobPostFieldsAndQuestions
 keys(d,'id title descriptionHtml extId startDateTs firstPublishedTsSec companyLogo companyUrl isApplicationFormHidden applicationFormTemplate isUnlistedExternally locations job jobPostSectionHtml compensationHtml','native posting')
 need(d.extId===row.extId&&d.id===row.id&&d.title===row.title,'own native posting identity differs')
 need(typeof d.descriptionHtml==='string'&&d.descriptionHtml.length<=256*1024,'native role criteria unavailable')
 need(d.startDateTs===null||Number.isSafeInteger(d.startDateTs),'unqualified native start date')
 need(Number.isSafeInteger(d.firstPublishedTsSec)&&d.firstPublishedTsSec>0,'unqualified native publication date')
 need(d.companyUrl===null||['https://fireflies.ai','https://fireflies.ai/'].includes(d.companyUrl),'unreviewed native company authority');maybeText(d.companyLogo,'company logo')
 need(d.isApplicationFormHidden===false&&d.isUnlistedExternally===false,'native application availability differs')
 locations(d.locations);locations(d.job?.locations)
 keys(d.job,'id locationType employmentType requisitionId teamDisplayName department locations','native job');department(d.job.department);maybeText(d.job.requisitionId,'requisition identity')
 need(d.job.teamDisplayName===profile.nativeTeam&&d.job.id===row.job.id&&d.job.locationType===row.job.locationType&&d.job.employmentType===row.job.employmentType&&isDeepStrictEqual(d.job.department,row.job.department),'own listing/detail employer or job fields differ')
 need(sameWorksites(row.locations,d.locations)&&sameWorksites(d.locations,d.job.locations),'own listing/detail full worksite models differ')
 keys(d.jobPostSectionHtml,'introHtml outroHtml','native criteria sections')
 for(const value of [d.jobPostSectionHtml.introHtml,d.jobPostSectionHtml.outroHtml,d.compensationHtml])need(value===null||typeof value==='string'&&value.length<=256*1024,'unqualified native criteria section')
 const template=d.applicationFormTemplate;keys(template,'id includeEeoc eeocConfig','native application template');need(Number.isSafeInteger(template.id)&&template.id>0&&typeof template.includeEeoc==='boolean','unqualified application template');keys(template.eeocConfig,'includeRaceXGender includeVeteranStatus includeDisabilityStatus','native EEOC config');need(Object.values(template.eeocConfig).every(v=>typeof v==='boolean'),'unqualified EEOC fields')
 keys(a,'fields questions demographicSurvey','native application criteria');need(Array.isArray(a.fields)&&a.fields.length<=64,'unqualified application fields')
 for(const f of a.fields){keys(f,'fieldType isRequired','application field');text(f.fieldType,'application field type');need(typeof f.isRequired==='boolean','unqualified application field requirement')}
 questions(a.questions)
 if(a.demographicSurvey!==null){keys(a.demographicSurvey,'extId surveyType questions','demographic survey');text(a.demographicSurvey.extId,'survey identity');text(a.demographicSurvey.surveyType,'survey type');questions(a.demographicSurvey.questions,true)}
 return d
}
function publicCarrier(html,d){
 const doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0],head=activeHead(html)
 need(head.titles.length===1&&head.titles[0]===d.title,'public role title differs')
 const one=key=>{const matches=head.metas.filter(m=>(m.name??m.property)===key);need(matches.length===1,'ambiguous public role metadata '+key);return matches[0].content}
 for(const k of ['og:title','twitter:title','apple-mobile-web-app-title','application-name'])need(one(k)===d.title,'public role metadata title differs')
 need(one('og:url')===BOARD+'/'+d.extId,'public role metadata native URL differs')
 const description=one('description');need(typeof description==='string'&&description.length>=300&&description.length<=256*1024&&one('og:description')===description&&one('twitter:description')===description,'public role metadata criteria unavailable')
 const walk=node=>{
  if(typeof node==='string')return
  if(Object.hasOwn(node.attrs,'nonce'))node.attrs.nonce='TECHNICAL_NONCE'
  if(node.tag==='title')node.raw='NATIVE_ROLE_TITLE'
  if(node.tag==='meta'){
   const key=node.attrs.name??node.attrs.property
   if(key==='csp-nonce')node.attrs.content='TECHNICAL_NONCE'
   if(['description','og:description','twitter:description'].includes(key))node.attrs.content='NATIVE_ROLE_CRITERIA'
   if(['og:title','twitter:title','apple-mobile-web-app-title','application-name'].includes(key))node.attrs.content='NATIVE_ROLE_TITLE'
   if(key==='og:url')node.attrs.content='NATIVE_ROLE_URL'
  }
  node.children.forEach(walk)
 };walk(root)
 need(sha(JSON.stringify(root))===profile.publicCarrierSHA256,'complete published role/application carrier changed')
 return {head:{titles:head.titles,metas:head.metas.filter(m=>(m.name??m.property)!=='csp-nonce')},nativeMetadataCriteria:description,carrierSHA256:profile.publicCarrierSHA256}
}
const sameWorksites=(left,right)=>{
 // The actual Mobile App Designer posting orders the same six full typed
 // worksite records differently from its listing/job. Preserve both orders;
 // compare every field by the native location ID, never only a row count.
 if(!Array.isArray(left)||!Array.isArray(right)||left.some(l=>typeof l.id!=='string')||right.some(l=>typeof l.id!=='string')
  ||new Set(left.map(l=>l.id)).size!==left.length||new Set(right.map(l=>l.id)).size!==right.length)return false
 const ordered=rows=>[...rows].sort((a,b)=>a.id.localeCompare(b.id))
 return isDeepStrictEqual(ordered(left),ordered(right))
}
export async function runCurrentFireflies(options={}){
 options.signal?.throwIfAborted()
 const maxJobs=options.maxJobs??100;if(!Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>100)throw RangeError('Fireflies native invalid output cap')
 const read=reader(options),phaseModels=[]
 try{
  for(const phase of ['opening','closing']){
   home((await read.read(HOME)).body);board((await read.read(BOARD)).body)
   for(const client of profile.clients)need((await read.read(client.url)).sha256===client.sha256,'published whole client changed')
   const list=nativeJSON(await read.read(API,profile.list.request)),rows=listing(list),selected=rows.filter(r=>r.locations.some(l=>l.isoCountry==='IND'))
   need(selected.length<=8,'current India detail cohort exceeds reviewed bounded read budget')
   const details=[],pages=[]
   for(const row of selected){
    read.allowRole(row.extId)
    const model=nativeJSON(await read.read(API,detailRequest(row.extId))),d=detail(model,row)
    for(const url of [BOARD+'/'+d.extId,BOARD+'/'+d.extId+'/application'])pages.push({url,...publicCarrier((await read.read(url)).body,d)})
    details.push(model)
   }
   phaseModels.push({list,details,pages});read.check()
  }
  need(isDeepStrictEqual(phaseModels[0],phaseModels[1]),'whole closing native models changed')
  const observedAt=typeof options.now==='function'?options.now():new Date().toISOString();need(Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
  const jobs=phaseModels[0].details.map((model,index)=>{
   const data=model.data,d=data.oatsExternalJobPosting,sections=[d.jobPostSectionHtml.introHtml,d.descriptionHtml,d.compensationHtml,d.jobPostSectionHtml.outroHtml].filter(v=>typeof v==='string'&&v.trim())
   const criteria=readOriginalNativeCriteria(sections.join('\n'),fail);need(criteria.sourceDetailComplete,'full authored criteria incomplete')
   const locations=d.locations.filter(l=>l.isoCountry==='IND'),questions=data.oatsJobPostFieldsAndQuestions.questions
   need(Number.isSafeInteger(d.firstPublishedTsSec)&&d.firstPublishedTsSec*1000<=Date.parse(observedAt),'native publication timestamp unqualified')
   const applicationCriteria=questions.map(q=>[q.text,q.description,...(q.options??[]).map(o=>o.value)].filter(v=>typeof v==='string'&&v.trim()).join('\n')).join('\n')
   return {...criteria,jobDescription:criteria.jobDescription+(applicationCriteria?'\n'+applicationCriteria:''),sourceDescription:criteria.sourceDescription+(applicationCriteria?'\n'+applicationCriteria:''),
    source:'firefliesai',company:'Fireflies.ai',companyName:'Fireflies.ai',companyDomain:'fireflies.ai',companyCareerPage:'https://fireflies.ai/careers',atsPlatform:'gem',
    title:d.title,jobId:d.extId,requisitionId:d.job.requisitionId,department:d.job.department.name,country:'India',city:null,
    location:[...new Set(locations.map(l=>l.name==='India'?'India':l.name+', India'))].join('; '),employmentType:d.job.employmentType==='FULL_TIME'?'Full-time':null,remoteStatus:d.job.locationType==='REMOTE'?'Remote':null,
    postingDate:new Date(d.firstPublishedTsSec*1000).toISOString(),closingDate:null,sourceUrl:BOARD+'/'+d.extId,applyUrl:BOARD+'/'+d.extId+'/application',link:BOARD+'/'+d.extId+'/application',scrapedAt:observedAt,
    sourceNativeDetail:structuredClone(data),sourceNativeClosingDetail:structuredClone(phaseModels[1].details[index].data),sourceNativeWorksites:structuredClone(d.locations),sourceNativeApplication:structuredClone(data.oatsJobPostFieldsAndQuestions),sourceNativePublicPages:structuredClone(phaseModels[0].pages.filter(p=>p.url===BOARD+'/'+d.extId||p.url===BOARD+'/'+d.extId+'/application')),
    sourceRenderedCriteriaComplete:false,sourceApplicationQualificationComplete:false,activationVerified:false,legalEmployer:null,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false}
  }).slice(0,maxJobs)
  const nativeCount=phaseModels[0].list.data.oatsExternalJobPostings.jobPostings.length
  const audit={source:'firefliesai',recordKind:'vacancy-rows',observedRecordCount:nativeCount,observedVacancyCount:nativeCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
   nativeModelsClosingReconciled:true,unhydratedNativeRecordCount:nativeCount-phaseModels[0].details.length,opening:phaseModels[0],closing:phaseModels[1],reader:read.stats(),receipts:read.receipts}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:read.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'current-employer-declared-native-board/full-India-criteria/application-data-pairs-closing-reconciled;rendered-activation/legal/company-scope-held'})
  read.check();return jobs
 }finally{read.close()}
}
