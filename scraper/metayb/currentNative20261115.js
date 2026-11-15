import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {eightfoldDocument,parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {extractActiveDescription,decodeNativeEntities,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const scope=JSON.parse(fs.readFileSync(new URL('./currentScope20261115.json',import.meta.url)))
const U=scope.urls,SOURCE='metayb',sha=value=>createHash('sha256').update(value).digest('hex')
const norm=value=>decodeNativeEntities(String(value)).normalize('NFC').replace(/\s+/g,' ').trim()
const text=value=>typeof value==='string'&&value.trim().length>0
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
const model=value=>JSON.stringify(canonical(value))
const problem=(message,kind='coverage_gap')=>Object.assign(Error('Metayb current native: '+message),{softFailure:true,abortRetries:true,failureKind:kind,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw problem(message)}
const keys=(value,allowed,required=allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key))&&required.every(key=>Object.hasOwn(value,key))
const rawText=(node,separate=false)=>typeof node==='string'?node:['script','style'].includes(node.tag)?'':node.children.map(value=>rawText(value,separate)).join(separate?' ':'')
const unavailable=/\b(?:(?:(?:this|the)\s+)?(?:job|position|role|vacancy|opening|requisition)\s+(?:(?:has|have)\s+(?:now\s+)?been|is|was|has)\s+(?:(?:now|currently|temporarily|already)\s+)*(?:filled|closed|expired|withdrawn|cancelled|canceled|unavailable|not\s+(?:(?:currently|now)\s+)?(?:available|open)|no\s+longer\s+(?:available|open|accepting\s+applications))|(?:applications\s+are|recruitment\s+is)\s+(?:(?:now|currently|temporarily|already)\s+)*closed|applications\s+are\s+(?:(?:now|currently)\s+)?no\s+longer\s+(?:being\s+)?accepted|(?:we\s+are\s+)?(?:(?:now|currently)\s+)?no\s+longer\s+accepting\s+applications)\b/i
const hasIndia=row=>Array.isArray(row?.jobLocations)&&row.jobLocations.length>0&&row.jobLocations.every(location=>location?.countryCode==='IN'&&location.countryName==='India')
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
const publicRole=id=>U.board+'jobdetails/'+id

function nativeRole(row,now){
 need(keys(row,scope.nativeRoleKeys),'unknown or omitted original role/criteria field')
 need(Number.isSafeInteger(row.id)&&row.id>0&&text(row.title)&&text(row.description)&&text(row.excerpt),'native role identity or original criteria missing')
 need(text(row.jobNumber)&&/^JD-\d{4}-\d+$/.test(row.jobNumber)&&/^[a-f\d-]{36}$/i.test(row.departmentIdentifier)&&text(row.departmentName),'native requisition or department identity missing')
 need(text(row.experience)&&row.jobType===2,'native experience or employment type unreviewed')
 need(Array.isArray(row.skillNames)&&row.skillNames.every(text)&&new Set(row.skillNames).size===row.skillNames.length,'original native required skills malformed')
 need(keys(row.salaryRange,scope.nativeSalaryKeys,['currency','salaryPeriod','cultureInfo'])&&text(row.salaryRange.currency)&&text(row.salaryRange.cultureInfo)&&Number.isSafeInteger(row.salaryRange.salaryPeriod)
  &&['minimum','maximum'].every(key=>row.salaryRange[key]===undefined||Number.isFinite(row.salaryRange[key])&&row.salaryRange[key]>=0)&&typeof row.salaryRangeFormat==='string','native salary criteria unreviewed')
 need(typeof row.publishedOn==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(row.publishedOn)&&Number.isFinite(Date.parse(row.publishedOn))
  &&new Date(Date.parse(row.publishedOn)).toISOString().slice(0,19)===row.publishedOn.slice(0,19)&&Date.parse(row.publishedOn)<=Date.parse(now)
  &&Number.isSafeInteger(row.publishedSinceDays)&&row.publishedSinceDays>=0,'original native publication invalid or future')
 need(hasIndia(row)&&row.jobLocations.length<=20,'complete independently typed India worksite alternatives required')
 for(const location of row.jobLocations)need(keys(location,scope.nativeLocationKeys,['id','name','city','state','countryCode','countryName'])&&Number.isSafeInteger(location.id)&&location.id>0
  &&text(location.name)&&text(location.city)&&text(location.state),'unknown or incomplete native worksite model')
 const original=eightfoldDocument(row.description),root=original.entries[0].node,visible=readVisibleNativeDocument(row.description,{strict:true})
 need(!original.entries.some(({node})=>['script','style','template','noscript','iframe','object','embed','svg','math'].includes(node.tag)),'unreviewed original criteria content')
 need(!original.entries.some(({node})=>Object.keys(node.attrs||{}).some(name=>/^on/i.test(name)||name==='srcdoc')),'unreviewed original criteria inline program')
 need(norm(rawText(root,true))===visible.text(visible.nodes(node=>node.tag==='root')[0]),'original native criteria contain hidden or inert content')
 const criteria=extractActiveDescription(row.description)
 need(criteria&&criteria.length>=300&&criteria===visible.text(visible.nodes(node=>node.tag==='root')[0]),'full original native criteria missing')
 need(norm(row.excerpt)===norm(rawText(root)),'original alternate native criteria conflict or were omitted')
 need(!unavailable.test(criteria),'native role explicitly closed or unavailable')
 return criteria
}
function corporate(html){
 const {document,entries}=eightfoldDocument(html),root=entries[0].node
 const schemas=entries.filter(({node})=>node.tag==='script'&&node.attrs.type==='application/ld+json').map(({node})=>parseEightfoldJson(node.raw))
 const organizations=schemas.flatMap(value=>value['@context']==='https://schema.org'&&Array.isArray(value['@graph'])?value['@graph'].filter(row=>row['@type']==='Organization'):[])
 need(organizations.length===1&&organizations[0]['@id']==='https://metayb.ai/#organization'&&organizations[0].name==='Metayb'&&organizations[0].url===U.home
  &&Array.isArray(organizations[0].sameAs)&&organizations[0].sameAs.includes(scope.linkedIn),'current corporate publisher/social identity missing or ambiguous')
 const mounts=entries.filter(({node})=>node.attrs.id==='root'),scripts=document.nodes(node=>node.tag==='script'&&node.attrs.type==='module')
 need(mounts.length===1&&!mounts[0].node.inert&&mounts[0].ancestors.some(node=>node.tag==='body')&&scripts.length===1&&new URL(scripts[0].attrs.src,U.home).href===U.entry,'current corporate renderer or mount changed')
 need(root&&!root.inert,'current corporate context unavailable')
}
function publishedResources(page){
 const {entries}=eightfoldDocument(page)
 need(!entries.some(({node})=>['iframe','frame','frameset','object','embed','applet'].includes(node.tag)),'unreviewed own role embedded program or criteria context')
 need(!entries.some(({node})=>Object.keys(node.attrs||{}).some(name=>/^on/i.test(name)||name==='srcdoc')),'unreviewed own role inline program')
 const sources=entries.filter(({node})=>node.tag==='script'&&node.attrs.src||node.tag==='link'&&node.attrs.rel==='stylesheet').map(({node})=>new URL(node.attrs.src||node.attrs.href,U.board).href)
 need(sources.length===scope.roleResources.length&&new Set(sources).size===sources.length&&sources.every((url,index)=>url===scope.roleResources[index].url),'own role current whole resource context changed')
 need(!entries.some(({node})=>node.tag==='script'&&!node.attrs.src),'unreviewed own role inline program')
 for(const match of page.matchAll(/<([a-z][^\s/>]*)\s+([^>]*)>/gi)){
  const attributes=readNativeAttributeTokens(match[2]),names=new Set()
  for(const [name]of attributes){need(!names.has(name),'duplicate own role HTML attribute');names.add(name)}
 }
 return sources
}
function ownRole(row,page,styles,now){
 const criteria=nativeRole(row,now);publishedResources(page)
 const parsed=eightfoldDocument(page),doc=parsed.document,visible=readVisibleNativeDocument(page.replace('</head>',styles+'</head>'),{strict:true})
 const h1=doc.nodes(node=>node.tag==='h1'),descriptions=doc.nodes(node=>doc.hasClass(node,'job-description-container')),buttons=doc.nodes(node=>node.tag==='button'&&node.attrs.id==='apply-job')
 need(h1.length===1&&doc.text(h1[0])===row.title&&h1[0].attrs.title===row.title,'own published role title identity changed')
 need(descriptions.length===1&&doc.text(descriptions[0])===criteria,'own full original published/native criteria mismatch')
 need(buttons.length===1&&!['disabled','hidden','inert'].some(key=>Object.hasOwn(buttons[0].attrs,key))&&buttons[0].attrs['aria-disabled']!=='true'&&doc.text(buttons[0])==='Apply for this job','own public application availability/control changed')
 need(visible.nodes(node=>node.tag==='h1').length===1&&visible.nodes(node=>visible.hasClass(node,'job-description-container')).length===1
  &&visible.nodes(node=>node.tag==='button'&&node.attrs.id==='apply-job').length===1,'own original criteria/title/application control hidden by current styles')
 const selected=parsed.entries.filter(({node})=>Object.hasOwn(node.attrs,'selectedjobid'))
 need(selected.length===2&&selected.every(({node})=>!node.inert&&node.attrs.selectedjobid===String(row.id))
  &&selected.some(({node})=>node.attrs.selectedjobtitle===row.title)&&selected.some(({node})=>node.attrs.selecteddepartmentidentifier===row.departmentIdentifier),'own native public posting/requisition context changed')
 const bases=doc.nodes(node=>node.tag==='base');need(bases.length===1&&bases[0].attrs.href==='/careers/','own native role base identity changed')
 const metrics=doc.nodes(node=>node.tag==='span'&&doc.hasClass(node,'text-white')&&doc.text(node)).map(doc.text)
 need(metrics.length===3&&[row.experience,row.experience+' Years'].includes(metrics[0])&&metrics[1]===row.jobLocations.map(location=>location.name).join(', ')
  &&metrics[2]===scope.roleMetricFormats.employmentType[row.jobType],'complete own public experience/worksites/employment criteria changed')
 const skillLabels=parsed.entries.filter(({node})=>node.tag==='p'&&doc.text(node)==='Required Skills')
 let skills=[]
 if(row.skillNames.length){need(skillLabels.length===1,'own required skills section omitted');const panel=skillLabels[0].ancestors.at(-1)
  skills=doc.nodes(node=>node.tag==='span',panel).map(doc.text);need(model(skills)===model(row.skillNames),'own required skills omitted or added')
  const visibleSkills=visible.nodes(node=>node.tag==='span'&&visible.hasClass(node,'bg-secondary')).map(visible.text)
  need(model(visibleSkills)===model(row.skillNames),'own required skills hidden by current styles')
 }else need(skillLabels.length===0,'additional own public required skills are unrepresented')
 const bodies=doc.nodes(node=>node.tag==='body');need(bodies.length===1,'own body context ambiguous')
 const allText=doc.text(bodies[0]);need(norm(rawText(bodies[0],true))===allText,'own original criteria include hidden or inert text')
 need(!unavailable.test(allText),'own public role explicitly closed or unavailable')
 let surrounding=allText.replace(criteria,'$DESCRIPTION$').replace(row.title,'$TITLE$')
 for(const [index,value]of metrics.entries())surrounding=surrounding.replace(value,['$EXPERIENCE$','$LOCATIONS$','$JOBTYPE$'][index])
 if(skills.length)surrounding=surrounding.replace('Required Skills '+skills.join(' '),'$SKILLS$')
 need(scope.roleSurroundingTexts.includes(surrounding),'additional or omitted original public criterion/application context')
 return{criteria,publicHTML:page,publicSHA256:sha(page),metrics,skills}
}
function envelope(value){
 need(Array.isArray(value)&&value.length<=1000,'native active full-array envelope changed')
 const ids=new Set()
 for(const row of value){need(row&&Number.isSafeInteger(row.id)&&row.id>0&&text(row.title)&&!ids.has(row.id),'native full-array identity ambiguous or duplicate');ids.add(row.id)}
 return value
}
function account(value){need(value?.name===scope.nativeEmployer&&value.shortName===scope.nativeEmployer&&value.careersPortalDomain==='metayb.keka.com'&&value.companyWebsite===scope.linkedIn,'exact current own native account/legal employer/social binding changed')}

export async function runCurrentMetayb(options={}){
 options.signal?.throwIfAborted()
 need(!(options.fetchText||options.fetchPage||options.fetchJson)||options.fetchImpl,'raw native HTTP status/URL/MIME/body metadata required')
 const maxRequests=options.maxRequests??64,maxDetails=options.maxDetails??4,sourceTimeoutMs=options.sourceTimeoutMs??90000,requestIntervalMs=options.requestIntervalMs??500
 for(const [name,value,maximum]of[['maxRequests',maxRequests,64],['maxDetails',maxDetails,4],['sourceTimeoutMs',sourceTimeoutMs,90000]])need(Number.isSafeInteger(value)&&value>0&&value<=maximum,'invalid bounded current '+name)
 need(Number.isSafeInteger(requestIntervalMs)&&requestIntervalMs>=0&&(requestIntervalMs>=500||options.fetchImpl),'current public pacing changed')
 const now=typeof options.now==='function'?options.now():new Date().toISOString();need(Number.isFinite(Date.parse(now)),'invalid current observation clock')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded','network_or_timeout')),sourceTimeoutMs),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const allowed=new Set(Object.values(U)),receipts=[],nativeRows=[],closingSnapshots=[],holds=[],staged=[],returned=[],lastRead=new Map(),resourceBodies=new Map()
 let totalBytes=0,requests=0,nativeIndiaCandidateCount=0,publisher
 const audit=()=>({source:SOURCE,observedAt:now,recordKind:'vacancy-rows',observedRecordCount:nativeRows.length,observedVacancyCount:nativeRows.length,nativeRows,
  nativeIndiaCandidateCount,closingNativeSnapshots:closingSnapshots,holds,returnedIndiaJobs:returned.length,publicRequestReceipts:receipts,
  sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,corporateUIQualified:false,sourceRenderedApplicationQualified:false,
  reason:'current-corporate-declared-own-Keka-account-and-full-native-India-models+full-public-criteria+fresh-closing;company-inventory-scope-unverified'})
 const read=async(url,kind,expectedMime)=>{
  signal.throwIfAborted();need(allowed.has(url)&&++requests<=maxRequests,'unbound endpoint or current read cap')
  const origin=new URL(url).origin,wait=Math.max(0,requestIntervalMs-(performance.now()-(lastRead.get(origin)??-Infinity)))
  if(wait)await delay(wait,undefined,{signal});lastRead.set(origin,performance.now())
  const fetchImpl=async(value,init)=>{
   const response=await(options.fetchImpl||globalThis.fetch)(value,{...init,cache:'no-store',credentials:'omit',headers:{'User-Agent':'Mozilla/5.0',Accept:kind==='json'?'application/json':kind==='css'?'text/css':kind==='javascript'?'application/javascript':'text/html'}})
   let bytes=0
   const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();return{
    async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native byte stream type changed');need(part.value.byteLength<=4000000-bytes&&part.value.byteLength<=24000000-totalBytes,'native streaming byte cap');bytes+=part.value.byteLength;totalBytes+=part.value.byteLength}return part},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }
  const packet=await boundedDeclaredPublicRead(url,{fetchImpl,signal,timeoutMs:15000,overflowError:problem('native streaming byte cap')}),bytes=Buffer.from(packet.bodyBase64,'base64'),body=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)
  receipts.push({url,finalURL:packet.url,status:packet.status,headers:packet.headers,bytes:bytes.length,sha256:sha(bytes),checkedAt:new Date().toISOString()})
  if(packet.status!==200)throw problem('native HTTP '+packet.status,[401,403,429,451].includes(packet.status)?'blocked_or_access_denied':'upstream_unavailable')
  need(packet.url===url,'native final URL identity changed')
  const mime=kind==='json'?/^application\/json\b/i:kind==='css'?/^text\/css\b/i:kind==='javascript'?(url===U.renderer?/^text\/js\b/i:/^(?:text|application)\/javascript\b/i):/^text\/html\b/i
  need(expectedMime?(packet.headers['content-type']||'').split(';')[0].trim().toLowerCase()===expectedMime:mime.test(packet.headers['content-type']||''),'native MIME changed at '+url)
  if(scope.exactCurrentBodies[url])need(sha(bytes)===scope.exactCurrentBodies[url],'reviewed whole current publisher/client/account context changed')
  return body
 }
 const context=async closing=>{
  const urls=closing?[U.account,U.renderer,U.portal,U.board,U.entry,U.home]:[U.home,U.entry,U.board,U.portal,U.renderer,U.account]
  for(const url of urls){const body=await read(url,[U.entry,U.renderer].includes(url)?'javascript':url===U.account?'json':'html')
   if(url===U.home)corporate(body)
   if(url===U.account){const value=parseEightfoldJson(body);account(value);if(!closing)publisher=value}
  }
 }
 const resources=async closing=>{
  for(const entry of scope.roleResources){allowed.add(entry.url);const body=await read(entry.url,entry.kind,entry.mime);need(sha(body)===entry.sha256,'own role declared whole client/stylesheet changed at '+entry.url)
   if(!closing)resourceBodies.set(entry.url,body)
  }
 }
 const styles=()=>scope.roleResources.filter(row=>row.kind==='css').map(row=>'<style>'+resourceBodies.get(row.url)+'</style>').join('')
 const observeClosing=rows=>{closingSnapshots.push({checkedAt:new Date().toISOString(),fullModels:structuredClone(rows)});return new Map(rows.map(row=>[row.id,row]))}
 try{
  await context(false)
  const opening=envelope(parseEightfoldJson(await read(U.feed,'json')));nativeRows.push(...structuredClone(opening));nativeIndiaCandidateCount=opening.filter(hasIndia).length
  const candidates=opening.filter(hasIndia).slice(0,maxDetails)
  for(const row of opening)if(!hasIndia(row)||!candidates.some(candidate=>candidate.id===row.id))holds.push({id:String(row.id),reason:hasIndia(row)?'full-detail-closing-budget-held':'complete-native-worksite-country-unresolved-or-non-India'})
  for(const row of candidates){
   let page
   try{nativeRole(row,now)}catch(error){holds.push({id:String(row.id),reason:error.message});continue}
   const url=publicRole(row.id);allowed.add(url);page=await read(url,'html');publishedResources(page)
   if(!resourceBodies.size)await resources(false)
   try{staged.push({row,opening:ownRole(row,page,styles(),now)})}catch(error){holds.push({id:String(row.id),reason:error.message})}
  }
  const closed=[]
  for(const value of staged){const page=await read(publicRole(value.row.id),'html')
   try{const proof=ownRole(value.row,page,styles(),now);need(proof.publicSHA256===value.opening.publicSHA256,'full original own public role changed at closing');closed.push({...value,closing:proof})}
   catch(error){holds.push({id:String(value.row.id),reason:error.message})}
  }
  const closing=observeClosing(envelope(parseEightfoldJson(await read(U.feed,'json'))))
  await context(true);if(resourceBodies.size)await resources(true)
  const final=observeClosing(envelope(parseEightfoldJson(await read(U.feed,'json'))))
  for(const value of closed){
   if(model(closing.get(value.row.id))!==model(value.row)||model(final.get(value.row.id))!==model(value.row)){holds.push({id:String(value.row.id),reason:'full original native role/criteria/country model drift at independent closing'});continue}
   const row=value.row,locations=row.jobLocations.map(location=>[location.name,location.state,location.countryName].join(', ')),skills=row.skillNames.length?'<h3>Required Skills</h3><ul>'+row.skillNames.map(skill=>'<li>'+escape(skill)+'</li>').join('')+'</ul>':''
   const description=row.description+'\n<h3>Experience</h3><p>'+escape(row.experience)+'</p>\n'+skills
   const job={source:SOURCE,company:'Metayb',companyCareerPage:U.home,companyDomain:'metayb.ai',atsPlatform:'keka-current-native',jobId:String(row.id),requisitionId:row.jobNumber,title:row.title,
    country:'India',city:row.jobLocations.length===1?row.jobLocations[0].city:null,location:locations.join('; '),locations,sourceUrl:publicRole(row.id),applyUrl:publicRole(row.id),link:publicRole(row.id),
    jobDescription:description,sourceDescription:description,requiredSkills:structuredClone(row.skillNames),experienceRequired:row.experience,employmentType:'Full-Time',
    nativeSalaryRange:structuredClone(row.salaryRange),nativeSalaryRangeFormat:row.salaryRangeFormat,sourceNativeEmploymentType:row.jobType,
    postingDate:row.publishedOn,postedAt:row.publishedOn,closingDate:null,firstEverPostedAt:null,remoteStatus:null,sourceRemoteStatusUnresolved:true,
    nativeHiringOrganization:{name:publisher.name},nativeLegalEmployer:publisher.name,nativeEmployerBinding:{kind:'exact-current-corporate-whole-client-delegated-account',sourceBrand:'Metayb',nativeEmployer:publisher.name,corporateURL:U.home,declaredBoard:U.board,currentSocialIdentity:scope.linkedIn},
    nativeSourceRecord:{originalNativeRole:structuredClone(row),originalNativeAccount:structuredClone(publisher),originalOwnPublicRoleHTML:value.opening.publicHTML,
     nativeClosingContext:{ownPublicRoleRechecked:true,ownPublicRoleSHA256:value.closing.publicSHA256,fullNativeRoleModelRechecked:true,finalFullNativeReadAfterPublicRoles:true,
      currentCorporateProgramRechecked:true,ownNativeAccountRechecked:true,ownWholeNativeRendererRechecked:true,allDeclaredOwnRoleClientsAndStylesheetsRechecked:true}},
    sourceDetailComplete:true,sourceNativeCriteriaComplete:true,sourceNativeClosingReconciled:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
    corporateUIQualified:false,sourceRenderedApplicationQualified:false,applicationVisited:false,scrapedAt:new Date().toISOString()}
   returned.push(job)
  }
  signal.throwIfAborted();const evidence=audit();attachSourceObservationEvidence(returned,evidence);Object.defineProperty(returned,'nativeCollectionEvidence',{value:evidence,configurable:true})
  if(options.onAudit){
   let abort
   const aborted=new Promise((_,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()})
   try{await Promise.race([Promise.resolve().then(()=>{signal.throwIfAborted();return options.onAudit(structuredClone(evidence))}),aborted])}
   finally{signal.removeEventListener('abort',abort)}
  }
  signal.throwIfAborted()
  return attachInventoryEvidence(returned,{status:'coverage-gap',surface:U.board,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:receipts.length,verifiedAt:new Date().toISOString(),reason:evidence.reason})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error))try{Object.assign(error,{softFailure:true,abortRetries:true,failureKind:error.failureKind||'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceAudit:audit()})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
