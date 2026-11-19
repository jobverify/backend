import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {clientScriptDeclarations} from '../../scraper-support/utils/reviewedClientProgram.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const PROFILE=JSON.parse(readFileSync(new URL('./currentProfile20261119.json',import.meta.url)))
const API=PROFILE.apiOrigin+'/hcmRestApi/resources/latest/'
const ROLE='https://explore-jobs.ciklum.com/en/sites/ciklum-career/job/'
const sha=value=>createHash('sha256').update(value).digest('hex')
const need=(value,reason)=>{if(!value)throw Object.assign(Error('Ciklum current native: '+reason),{abortRetries:true})}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const walk=(node,visit)=>{if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>walk(child,visit));else if(value&&typeof value==='object')walk(value,visit)}
const json=text=>{
 const ast=parse('('+text+')',{ecmaVersion:'latest'})
 walk(ast,node=>{if(node.type==='ObjectExpression'){const keys=node.properties.map(p=>p.key.name??p.key.value);need(new Set(keys).size===keys.length,'duplicate native JSON keys')}})
 const value=JSON.parse(text)
 need(value&&Array.isArray(value.items)&&value.items.length===1&&!value.error&&!value.errors,'one non-error native response required')
 return value.items[0]
}
const searchURL=offset=>API+'recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations,flexFieldsFacet.values,requisitionList.requisitionFlexFields&finder=findReqs;siteNumber=CX_1001,selectedLocationsFacet=300000000468243,limit=24,offset='+offset
const detailURL=id=>API+'recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;siteNumber=CX_1001,Id=%22'+id+'%22'
const cancel=body=>{try{Promise.resolve(body?.cancel?.()).catch(()=>{})}catch{/* Cleanup is best effort. */}}

function publisher(html){
 const d=readNativeDocument(html)
 need(same(activeHead(html).titles,[PROFILE.title]),'publisher title changed')
 need(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href===PROFILE.landingURL).length===1,'publisher canonical identity changed')
 const declarations=clientScriptDeclarations(html).map(node=>node.attrs.src?{src:new URL(node.attrs.src,PROFILE.landingURL).href}:{inlineSHA256:sha(node.raw||'')})
 need(same(declarations,PROFILE.publisherDeclarations),'publisher activation declarations changed')
 const facets=[...new Set(d.nodes(n=>n.tag==='a'&&n.attrs.href?.startsWith('https://explore-jobs.ciklum.com/en/sites/ciklum-career/jobs?lastSelectedFacet=LOCATIONS&selectedLocationsFacet=300000000468243')).map(n=>n.attrs.href))]
 need(same(facets,PROFILE.facetURLs),'current first-party India facet declaration changed')
 return{declarations,facets}
}
function nativeClient(body,profile){need(Buffer.byteLength(body)===profile.bytes&&sha(body)===profile.sha256,'whole reviewed native program changed')}
function date(value,label){
 need(typeof value==='string'&&/^\d{4}-\d\d-\d\d(?:T\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d))?$/.test(value)&&Number.isFinite(Date.parse(value)),label+' calendar invalid')
 need(new Date(value).toISOString().slice(0,10)===value.slice(0,10),label+' calendar invalid')
 return value
}
const fieldsMatch=(value,fields)=>same(Object.keys(value).sort(),fields)
const workplaceModel=value=>Object.fromEntries(Object.keys(value).sort().map(key=>{
 if(!['Latitude','Longitude'].includes(key))return[key,value[key]]
 const coordinate=value[key]
 if((coordinate===null||coordinate==='')&&PROFILE.workLocations.some(known=>known.id===value.LocationId&&known.name===value.LocationName&&known.missingCoordinates===true))return[key,null]
 need(typeof coordinate==='number'||typeof coordinate==='string'&&/^-?\d{1,3}(?:\.\d{1,9})?$/.test(coordinate),'native coordinate representation changed')
 const numeric=Number(coordinate)
 need(Number.isFinite(numeric)&&Math.abs(numeric)<=(key==='Latitude'?90:180),'native coordinate out of range')
 return[key,numeric]
}))
const ownFields=['ExternalDescriptionStr','ExternalResponsibilitiesStr','ExternalQualificationsStr','OrganizationDescriptionStr','CorporateDescriptionStr']
function criteria(value){
 need(typeof value==='string','external criteria field changed')
 if(!value)return ''
 const d=readNativeDocument(value),root=d.nodes(n=>n.tag==='root')[0]
 walk(root,node=>{if(node.tag)need(!node.inert&&!node.nativeTagUnqualified&&!['script','style','iframe','object','embed','template','noscript','form','input','textarea','link','img'].includes(node.tag),'authored criteria are hidden, active or unsupported')})
 const visible=readVisibleNativeDocument(value,{strict:true}),vr=visible.nodes(n=>n.tag==='root')[0]
 need(norm(d.text(root))===norm(visible.text(vr)),'full original authored criteria are not visible')
 return norm(d.text(root))
}
function qualify(row,detail,now){
 need(fieldsMatch(row,PROFILE.listingFields)&&fieldsMatch(detail,PROFILE.detailFields),'native role fields changed')
 need(detail.Id===row.Id&&detail.Title===row.Title,'native own-role ID/title conflict')
 need(row.PrimaryLocationCountry==='IN'&&detail.PrimaryLocationCountry==='IN'&&detail.PrimaryLocation===row.PrimaryLocation&&/\bIndia\b/.test(row.PrimaryLocation),'native primary country or location conflict')
 for(const value of [row,detail]){
  need(Number.isSafeInteger(value.GeographyId)&&value.GeographyId===row.GeographyId,'native primary geography changed')
  need(Array.isArray(value.workLocation)&&value.workLocation.length===1&&Array.isArray(value.otherWorkLocations)&&!value.otherWorkLocations.length&&Array.isArray(value.secondaryLocations)&&!value.secondaryLocations.length,'additional native workplace scope unqualified')
  const location=value.workLocation[0]
  need(fieldsMatch(location,PROFILE.workLocationFields),'native workplace fields changed')
  need(PROFILE.workLocations.some(known=>known.id===location.LocationId&&known.name===location.LocationName)&&location.Country===null,'native workplace identity or country changed')
  for(const [key,field]of Object.entries(location))if(/country|address|region|town|postal|building/i.test(key))need(field===null,'unreconciled native workplace country/address')
 }
 need(same(row.workLocation.map(workplaceModel),detail.workLocation.map(workplaceModel)),'native listing/detail workplace conflict')
 need(Array.isArray(detail.primaryLocationCoordinates)&&detail.primaryLocationCoordinates.length===1&&detail.primaryLocationCoordinates[0].CountryCode==='IN'&&detail.primaryLocationCoordinates[0].GeographyId===detail.GeographyId&&detail.primaryLocationCoordinates[0].GeographyNodeId===detail.GeographyNodeId,'native primary country coordinate conflict')
 need(detail.LegalEmployer===null&&detail.LegalEmployerId===row.LegalEmployerId,'native legal employer declaration changed')
 date(row.PostedDate,'native listing publication');date(detail.ExternalPostedStartDate,'native publication')
 need(detail.ExternalPostedStartDate.slice(0,10)===row.PostedDate&&Date.parse(detail.ExternalPostedStartDate)<=now,'native publication conflict')
 need(row.PostingEndDate===null&&detail.ExternalPostedEndDate===null,'native closing date requires separate qualification')
 const texts=ownFields.map(key=>criteria(detail[key])),full=texts.filter(Boolean).join('\n\n')
 need(full.length>=400,'full own-role external criteria unavailable')
 const intro=new RegExp('^Ciklum is looking for (?:a|an) '+row.Title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' to join our team full-time in India(?:[.!]|$)','i')
 const introDocument=readNativeDocument(detail.ExternalDescriptionStr),introParagraph=introDocument.nodes(node=>node.tag==='p').find(node=>norm(introDocument.text(node)))
 need(introParagraph&&intro.test(norm(introDocument.text(introParagraph))),'own criteria employer/title/India introduction conflict')
 need(!/\b(?:(?:this|the) (?:position|role|job) (?:is|has been) (?:closed|filled|expired)|no longer accepting applications)\b/i.test(full),'native own role is closed')
 for(const match of full.matchAll(/\b(work country|job country|country of employment|employer|hiring organization)\s*:\s*([^.;\n]+)/gi))need(/country/i.test(match[1])?norm(match[2])==='India':norm(match[2])==='Ciklum','explicit own-role country/employer conflict')
 need(!/full (?:job )?(?:description|criteria) (?:on request|available upon)|coming soon|description to follow/i.test(full),'full criteria deferred')
 return{detail,text:full,html:ownFields.map(key=>detail[key]).filter(Boolean).join('\n\n'),country:'India'}
}

export async function runCurrentNativeCiklum(options={}){
 options.signal?.throwIfAborted()
 need(options.maxJobs==null&&(options.maxPages==null||options.maxPages===Infinity),'native inventory truncation is unsupported')
 const timeout=options.sourceTimeoutMs??180000
 need(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000,'invalid source deadline')
 const signal=AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(timeout)]),responses=[],allowed=new Set([PROFILE.landingURL,PROFILE.shell.url,PROFILE.main.url,PROFILE.custom.url])
 let totalBytes=0
 const wait=async(start,dispose)=>{
  signal.throwIfAborted();let listener,abandoned=false
  const operation=Promise.resolve().then(()=>{signal.throwIfAborted();return start()})
  operation.then(value=>{if(abandoned)dispose?.(value)},()=>{})
  try{return await Promise.race([operation,new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true});if(signal.aborted)listener()})])}
  finally{abandoned=true;signal.removeEventListener('abort',listener)}
 }
 async function read(url){
  signal.throwIfAborted();need(allowed.has(url)&&responses.length<128,'undeclared route or bounded request budget reached')
  const startedAt=new Date().toISOString()
  const response=await wait(()=>(options.fetchImpl||globalThis.fetch)(url,{method:'GET',redirect:'manual',credentials:'omit',signal,headers:{Accept:'text/html,application/json,application/javascript'}}),late=>cancel(late?.body))
  let bytes
  try{
   need(response.status===200&&response.url===url,'native HTTP/final identity changed: '+response.status)
   need(Number(response.headers?.get('content-length')||0)<=8e6,'native body over bound')
   const reader=response.body?.getReader();need(reader,'bounded native stream unavailable')
   const chunks=[];let count=0
   try{for(;;){const part=await wait(()=>reader.read());signal.throwIfAborted();if(part.done)break;count+=part.value.byteLength;need(count<=8e6,'native body over bound');chunks.push(Buffer.from(part.value))}}finally{try{Promise.resolve(reader.cancel()).catch(()=>{});reader.releaseLock()}catch{/* Closing a stream may race cancellation. */}}
   bytes=Buffer.concat(chunks)
  }finally{cancel(response.body)}
  totalBytes+=bytes.length;need(totalBytes<=32e6,'native aggregate body budget reached')
  const html=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
  responses.push({url,requestedURL:url,finalURL:response.url,method:'GET',status:response.status,contentType:response.headers.get('content-type'),startedAt,completedAt:new Date().toISOString(),bodySHA256:sha(bytes),bodyBytes:bytes.length,bodyBase64:bytes.toString('base64')})
  return html
 }
 async function context(){
  const p=publisher(await read(PROFILE.landingURL))
  nativeClient(await read(PROFILE.shell.url),PROFILE.shell)
  nativeClient(await read(PROFILE.main.url),PROFILE.main)
  nativeClient(await read(PROFILE.custom.url),PROFILE.custom)
  return p
 }
 async function inventory(){
  const rows=[];let total
  for(let offset=0;offset<240;offset+=24){
   const url=searchURL(offset);allowed.add(url)
   const page=json(await read(url))
   need(page.SiteNumber==='CX_1001'&&page.SelectedLocationsFacet===PROFILE.facet&&page.Offset===offset&&page.Limit===24&&Number.isSafeInteger(page.TotalJobsCount)&&page.TotalJobsCount>0&&page.TotalJobsCount<=240&&Array.isArray(page.requisitionList),'native configured facet/envelope changed')
   total??=page.TotalJobsCount;need(total===page.TotalJobsCount,'native facet total changed')
   need(page.requisitionList.length===Math.min(24,total-offset),'native facet page length or continuation conflict')
   rows.push(...page.requisitionList)
   if(rows.length===total)break
  }
  need(rows.length===total&&new Set(rows.map(row=>row.Id)).size===rows.length,'native inventory incomplete or duplicate')
  for(const row of rows){need(typeof row.Id==='string'&&/^\d{1,8}$/.test(row.Id)&&typeof row.Title==='string'&&row.Title.trim(),'native listing identity unavailable');allowed.add(detailURL(row.Id))}
  return rows
 }
 const heldRows=[],clock=()=>{signal.throwIfAborted();const value=typeof options.now==='function'?options.now():options.now||new Date().toISOString();signal.throwIfAborted();return value},observedAt=clock(),now=Date.parse(observedAt)
 need(Number.isFinite(now),'invalid observation clock')
 async function details(rows,phase){
  const map=new Map()
  for(const row of rows){
   const raw=json(await read(detailURL(row.Id)))
   try{map.set(row.Id,{raw,qualified:qualify(row,raw,now)})}catch(error){signal.throwIfAborted();heldRows.push({id:row.Id,phase,reason:error.message,nativeListing:row,nativeDetail:raw});map.set(row.Id,{raw,qualified:null})}
  }
  return map
 }
 const openingContext=await context(),opening=await inventory(),first=await details(opening,'opening')
 const closingContext=await context(),closing=await inventory(),last=await details(closing,'closing'),final=await inventory()
 need(same(openingContext,closingContext),'closing current corporate declaration changed')
 const active=new Map(final.map(row=>[row.Id,row])),jobs=[]
 for(const row of opening){
  const a=first.get(row.Id),b=last.get(row.Id)
  if(!a?.qualified||!b?.qualified)continue
  if(!same(row,active.get(row.Id))||!same(a.raw,b.raw)){heldRows.push({id:row.Id,phase:'closing',reason:'closing native identity, full criteria or membership changed'});continue}
  const qualified=a.qualified,location=a.raw.workLocation[0].LocationName,sourceUrl=ROLE+row.Id
  jobs.push({source:'ciklum',company:'Ciklum',title:row.Title,jobId:row.Id,requisitionId:String(a.raw.RequisitionId),sourceUrl,link:sourceUrl,applyUrl:sourceUrl,
   companyDomain:'jobs.ciklum.com',companyCareerPage:PROFILE.landingURL,country:'India',location:location+', India',city:location==='IN-Remote'?null:location,
   department:a.raw.Department,employmentType:a.raw.JobSchedule,remoteStatus:a.raw.WorkplaceType,postingDate:row.PostedDate,closingDate:null,
   jobDescription:qualified.html,sourceDescription:qualified.html,nativeWholeCriteriaText:qualified.text,sourceDetailComplete:true,
   nativeSourceRecord:a.raw,nativeClosingRecord:b.raw,nativeListing:row,nativeCountry:'IN',nativeSiteNumber:'CX_1001',nativePrimaryCountryProof:'typed native primary country plus independent own-role employer/title/India introduction and native country coordinates',
   sourceNativeApplicationStatus:'current-listed-native-role-route;application-form-not-qualified',activeApplyVerified:false,applicationVisited:false,applicationSubmitted:false,
   sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:clock()})
 }
 const audit={source:'ciklum',recordKind:'vacancy-rows',observedRecordCount:opening.length,observedVacancyCount:opening.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,browserEquivalenceComplete:false,
  openingNativeRows:opening,closingNativeRows:closing,finalNativeRows:final,heldRows,openingNativeDetails:[...first.values()].map(v=>v.raw),closingNativeDetails:[...last.values()].map(v=>v.raw),originalResponses:responses,configuredMembershipClosingReconciled:same(opening,closing)&&same(opening,final)}
 attachSourceObservationEvidence(jobs,{source:'ciklum',recordKind:'vacancy-rows',observedRecordCount:opening.length,observedVacancyCount:opening.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
 signal.throwIfAborted()
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:PROFILE.shell.url,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:responses.length,reportedTotal:opening.length,indiaFacetCount:null,verifiedAt:clock(),reason:'current-declared-native-India-facet-and-full-own-criteria-reconciled;unqualified-rows-application-and-company-scope-held'})
}
