import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {qualifiedFirstPartyHTML,clean,nativeText} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {composeLeverDescription} from '../../scraper-support/utils/leverDescription.js'
import {getValidIndiaCityForJob} from '../../src/utils/publicJobLocationScope.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {famPublicURLs,famReviewedProgrammes,readFamPublicScope,readFamWorksiteScope,sameFamNativeRecords} from './publicScope20261112.js'
const HOME='https://www.famapp.in/',CAREERS=HOME+'careers/',API='https://api.lever.co/v0/postings/fampay?mode=json'
const CLIENT=HOME+'_next/static/chunks/2cyegqtq_3d48.js',HASH='57524cd1c9585b13a5aa22189602a6b489e6eac70cb1278d6043092b13199dcd'
const aliases={famapp:'FamApp by Trio',fampay:'Fampay'}
const criteriaText=value=>{
 const doc=readNativeDocument(value),root=doc.nodes(node=>node.tag==='root')[0]
 return decodeHTML(doc.text(root)).replace(/\s+/g,'')
}
const fullCriteria=row=>{
 // Fam's current native HTML contains criteria missing from the redundant
 // plain variant (including the Data Engineer tech stack). Keep that original
 // full HTML, then reconcile every supplied native variant against it.
 const description=composeLeverDescription({...row,descriptionPlain:null})
 if(!description)return null
 const combined=criteriaText(description)
 for(const key of['description','descriptionPlain','opening','openingPlain','descriptionBody','descriptionBodyPlain','additional','additionalPlain']){
  if(row[key]==null)continue
  if(typeof row[key]!=='string')return null
  const text=criteriaText(row[key])
  if(text&&!combined.includes(text))return null
 }
 return description
}
export const hasCurrentFamHome=html=>String(html).includes('FamApp: Lightning fast UPI payments with bank &amp; wallet')
export const hasCurrentFamCareers=html=>String(html).includes('/_next/static/chunks/2cyegqtq_3d48.js')
export async function runCurrentFam(options={}){
 const {source,company,fetchImpl=globalThis.fetch}=options
 const failure=message=>firstPartyFailure(source,message,{nativeAuthorityFailure:true})
 const need=(ok,message)=>{if(!ok)throw failure(message)}
 need(Object.hasOwn(aliases,source)&&company===aliases[source],'Unverified native source alias or company identity')
 const timeoutMs=options.timeoutMs??120000
 need(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=300000,'Invalid native source deadline')
 const signal=AbortSignal.any([AbortSignal.timeout(timeoutMs),...(options.signal?[options.signal]:[])])
 const verifiedAt=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(typeof verifiedAt==='string'&&Number.isFinite(Date.parse(verifiedAt)),'Invalid native check time')
 let requests=0
 const retainedResponses=[]
 const read=async(url,type)=>{
  signal.throwIfAborted();requests++
  const requestedAt=new Date().toISOString()
  const response=await boundedDeclaredPublicGet(url,{fetchImpl,signal,overflowError:failure('Native response exceeds bounded entity size')})
  const bytes=Buffer.from(response.bodyBase64,'base64'),body=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
  retainedResponses.push({requestedUrl:url,method:'GET',requestedAt,completedAt:new Date().toISOString(),status:response.status,finalUrl:response.url,
   contentType:response.headers['content-type']??null,bodyBytes:bytes.length,bodySha256:createHash('sha256').update(bytes).digest('hex'),body})
  need(response.status===200&&response.url===url,'Native HTTP status or final URL changed')
  need((type==='json'?/application\/json/i:type==='js'?/(?:text|application)\/(?:java|ecma)script/i:/text\/html/i).test(response.headers['content-type']??''),'Native entity content type changed')
  return body
 }
 const bind=async()=>{
  // This publisher's current homepage has no canonical link. Qualify its
  // actual head, exact og:url and static route metadata rather than inventing
  // a canonical or accepting arbitrary homepage copy.
  const homeHTML=await read(HOME,'html'),home=readNativeDocument(homeHTML)
  const heads=home.nodes(n=>n.tag==='head'),bodies=home.nodes(n=>n.tag==='body'),roots=home.nodes(n=>n.tag==='html')
  need(heads.length===1&&bodies.length===1&&roots.length===1&&roots[0].children.includes(heads[0])&&roots[0].children.includes(bodies[0]),'Current native homepage document identity changed')
  const all=node=>[node,...node.children.filter(n=>typeof n!=='string').flatMap(all)]
  need(!all(roots[0]).some(n=>n.tag==='base'||n.tag==='link'&&n.attrs.rel==='canonical'),'Current native homepage base or canonical profile changed')
  const titles=heads[0].children.filter(n=>typeof n!=='string'&&n.tag==='title'&&!n.inert)
  need(titles.length===1&&clean(decodeNativeEntities(titles[0].raw))==='FamApp: Lightning fast UPI payments with bank & wallet','Current native employer title changed')
  const og=heads[0].children.filter(n=>typeof n!=='string'&&n.tag==='meta'&&n.attrs.property==='og:url'&&!n.inert)
  need(og.length===1&&og[0].attrs.content==='https://famapp.in','Current native homepage origin identity changed')
  const homeData=home.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__'&&n.attrs.type==='application/json')
  need(homeData.length===1&&JSON.parse(homeData[0].raw).page==='/','Current native homepage route changed')
  need(home.nodes(n=>n.tag==='a'&&n.attrs.href==='/careers/').length>0,'Missing current native careers handoff')
  const careersHTML=await read(CAREERS,'html'),page=qualifiedFirstPartyHTML(careersHTML,'https://famapp.in/careers/',failure)
  need(page.title==='Careers at Fam: come hang at FamHQ','Current native careers title changed')
  const data=page.raw.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__'&&n.attrs.type==='application/json')
  need(data.length===1,'Ambiguous current native careers page identity')
  const metadata=JSON.parse(data[0].raw)
  need(metadata.page==='/careers'&&metadata.isFallback===false&&Object.keys(metadata.query??{}).length===0,'Filtered or fallback current native page')
  need(page.raw.nodes(n=>n.tag==='script'&&n.attrs.src===new URL(CLIENT).pathname&&!n.inert).length===1,'Current native careers client declaration changed')
  need(clean(nativeText(page.body)).includes('Careers at Fam.'),'Missing current native careers region')
  const code=await read(CLIENT,'js')
  // This reviewed publisher configuration declares the Fampay tenant, public
  // postings feed and native role URL builder. Static game sample roles and the
  // separate application POST endpoint never supply vacancy records.
  need(createHash('sha256').update(code).digest('hex')===HASH,'Current native recruiting client profile requires review')
  return{documents:{[HOME]:homeHTML,[CAREERS]:careersHTML},programmes:{[CLIENT]:code}}
 }
 const inventory=async()=>{
  const rows=JSON.parse(await read(API,'json'))
  need(Array.isArray(rows)&&rows.length<=5000,'Native inventory is not a bounded posting array')
  const ids=new Set()
  for(const row of rows){
   need(row&&typeof row==='object'&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(row.id??'')&&!ids.has(row.id)&&clean(row.text)&&row.categories&&clean(row.categories.location),'Incomplete or duplicate native role identity')
   ids.add(row.id)
   for(const[field,suffix]of[['hostedUrl',''],['applyUrl','/apply']])need(row[field]==='https://jobs.lever.co/fampay/'+row.id+suffix,'Native tenant or role URL identity changed')
   need(row.country==null||typeof row.country==='string','Native country type changed')
   need(row.lists==null||Array.isArray(row.lists)&&row.lists.every(section=>section&&typeof section.content==='string'),'Native full criteria sections changed')
  }
  return rows.sort((a,b)=>a.id.localeCompare(b.id))
 }
 const qualify=async(binding,records)=>{
  const pagination=[]
  try{
   const documents={...binding.documents},programmes={...binding.programmes}
   await Promise.all([famPublicURLs.jobs,famPublicURLs.hq].map(async url=>{documents[url]=await read(url,'html')}))
   const urls=famReviewedProgrammes.filter(url=>!Object.hasOwn(programmes,url))
   for(let offset=0;offset<urls.length;offset+=4)await Promise.all(urls.slice(offset,offset+4).map(async url=>{programmes[url]=await read(url,'js')}))
   const[boardHTML,generalHTML,groupedBody]=await Promise.all([read(famPublicURLs.board,'html'),read(famPublicURLs.general,'html'),read(famPublicURLs.grouped,'json')])
   const paginatedRecords=[]
   for(let page=0;page<=50;page++){
    const url=API+'&skip='+paginatedRecords.length+'&limit=100',rows=JSON.parse(await read(url,'json'))
    need(Array.isArray(rows)&&rows.length<=100,'Native explicit pagination contract changed')
    pagination.push({url,offset:paginatedRecords.length,count:rows.length,terminal:rows.length===0})
    if(!rows.length)break
    paginatedRecords.push(...rows)
    need(paginatedRecords.length<=5000&&new Set(paginatedRecords.map(row=>row.id)).size===paginatedRecords.length,'Native pagination repeated or exceeded the public inventory budget')
   }
   need(pagination.at(-1)?.terminal,'Native explicit pagination did not reach a terminal empty page')
   return{certificate:readFamPublicScope({documents,programmes,boardHTML,generalHTML,records,paginatedRecords,groupedRecords:JSON.parse(groupedBody)}),pagination,error:null}
  }catch(error){return{certificate:null,pagination,error:clean(error.message)}}
 }
 const openingBinding=await bind(),opening=await inventory(),openingScope=await qualify(openingBinding,opening)
 const closingBinding=await bind(),closing=await inventory(),closingScope=await qualify(closingBinding,closing)
 need(sameFamNativeRecords(opening,closing),'Native closing inventory or full criteria changed')
 const worksites=opening.map(row=>({id:row.id,...readFamWorksiteScope(row)})),byId=new Map(worksites.map(scope=>[scope.id,scope]))
 const unknown=worksites.filter(scope=>!scope.complete).map(scope=>scope.id)
 const india=opening.filter(row=>byId.get(row.id).primaryCountry==='India'&&!byId.get(row.id).primaryCountryConflict)
 const descriptions=new Map(opening.map(row=>[row.id,fullCriteria(row)])),missing=opening.filter(row=>!descriptions.get(row.id)).map(row=>row.id)
 let jobs=india.flatMap(row=>{
  const description=descriptions.get(row.id)
  if(!description)return[]
  const location=clean(row.categories.location)
  const created=Number.isFinite(row.createdAt)&&row.createdAt>0?new Date(row.createdAt):null
  return[{source,company,officialBrandName:'FamApp by Trio',legalEmployer:null,title:clean(row.text),jobId:row.id,requisitionId:row.id,sourceNativeJobId:row.id,
   country:'India',location:/\bIndia\b/i.test(location)?location:location+', India',city:getValidIndiaCityForJob({location})??null,state:null,
   department:clean(row.categories.department??row.categories.team)||null,sourceUrl:row.hostedUrl,applyUrl:row.applyUrl,link:row.applyUrl,
   employmentType:clean(row.categories.commitment)||null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
   postingDate:null,sourcePublicationDate:null,nativeCreatedAt:created&&Number.isFinite(created.getTime())?created.toISOString():null,
   nativeCreationTimestampRaw:row.createdAt??null,sourcePublicationDateStatus:'not-declared-in-current-native-feed',closingDate:null,
   remoteStatus:row.workplaceType??null,jobDescription:description,sourceDescription:description,sourceNativeJobRecord:row,
   nativeWorksiteCountryEvidence:byId.get(row.id),sourceDetailComplete:true,sourceDetailStatus:'complete-published-native-criteria',
   sourceEmployerScope:'current-declared-public-Fam-vacancy-channel;legal-employer-unqualified',scrapedAt:verifiedAt}]
 })
 const maxJobs=options.maxJobs??null
 need(maxJobs===null||maxJobs===Infinity||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'Invalid native job cap')
 const capped=maxJobs!==null&&maxJobs!==Infinity&&maxJobs<jobs.length
 if(capped)jobs=jobs.slice(0,maxJobs)
 const complete=!unknown.length&&!missing.length&&!capped
 const publicScopeStable=openingScope.certificate&&closingScope.certificate&&JSON.stringify(openingScope.certificate)===JSON.stringify(closingScope.certificate)
 const qualified=Boolean(complete&&publicScopeStable),certificate=qualified?openingScope.certificate:null
 const audit={source,recordKind:'vacancy-rows',observedRecordCount:opening.length,observedVacancyCount:opening.length,
  sourceScopeComplete:qualified,lifecycleCleanupAllowed:qualified,companyGlobalTotal:null,companyIndiaTotal:null,
  currentNativeCandidateCount:opening.length,explicitIndiaPrimaryCount:india.length,unknownWorksiteIds:unknown,missingFullCriteriaIds:missing,
  nativeWorksites:worksites,callerCapped:capped,openingPagination:openingScope.pagination,closingPagination:closingScope.pagination,
  publicScope:certificate,publicScopeFailures:[openingScope.error,closingScope.error].filter(Boolean),nativeInventoryReconciledAtClosing:true,
  originalPublicationDatesKnown:false,applicationSubmissionVisited:false,verifiedAt,retainedResponses,originalNativeRecords:opening}
 const compact={...audit,retainedResponses:undefined,originalNativeRecords:undefined,nativeWorksites:undefined,
  publicScope:certificate?{...certificate,generalApplicationPool:{...certificate.generalApplicationPool,nativeJobPosting:undefined,nativeVisibleText:undefined}}:null,
  retainedResponseCount:retainedResponses.length,fullBatchEvidenceOnFirstExtractedJob:true,firstExtractedJobId:jobs[0]?.jobId??null}
 jobs.forEach((job,index)=>Object.assign(job,{sourceListingComplete:complete,sourceScopeComplete:qualified,lifecycleCleanupAllowed:qualified,nativeCollectionEvidence:index===0?audit:compact}))
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
 return attachInventoryEvidence(jobs,{status:complete&&(opening.length||qualified)?(opening.length?'complete-inventory':'verified-empty'):'coverage-gap',surface:API,firstParty:true,listingComplete:complete&&(opening.length>0||qualified),lifecycleCleanupAllowed:qualified,
  pagesFetched:requests,reportedTotal:opening.length,indiaFacetCount:unknown.length?null:india.length,verifiedAt,
  reason:'current-declared-native-client-and-full-postings-reconciled-at-closing;'+(qualified?'current-public-Fam-channel-qualified;private-and-legal-employer-scope-excluded':'current-public-scope-held')
   +';unknown-worksite-country:'+unknown.join(',')+';missing-criteria:'+missing.join(',')+(capped?';caller-cap':'')})
}
