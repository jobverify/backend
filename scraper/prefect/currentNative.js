import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES } from '../../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js'
import { createPublicIO } from '../../scraper-support/native-sources/publicIO.js'
import { appData, nativeOrganization } from '../../scraper-support/native-sources/declaredAshby/nativeData.js'
import { countryName } from '../../scraper-support/native-sources/jobPostingData.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { withCallerSignal } from '../abmknowledgeware/publicIntake.js'

const profile=DECLARED_JOB_FEED_PROFILES.prefect
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const norm=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
const same=(left,right)=>JSON.stringify(canonical(left))===JSON.stringify(canonical(right))
const fail=(message,code='PREFECT_NATIVE_CONTRACT_CHANGED')=>Object.assign(new Error('Prefect: '+message),{code})
const list=value=>value==null?[]:Array.isArray(value)?value:[value]
const typedCountry=value=>typeof value==='string'?countryName(value):value&&typeof value==='object'&&Object.keys(value).every(key=>['@type','name'].includes(key))&&value['@type']==='Country'?countryName(value.name):null
const address=place=>place?.address?.postalAddress??place?.postalAddress??place?.address??place??{}
const addressCountries=(value,depth=0)=>{
 if(value==null)return[]
 if(typeof value!=='object'||Array.isArray(value)||depth>4)return[{unsupportedAddressShape:true}]
 return[...(value.addressCountry==null?[]:[value.addressCountry]),...['address','postalAddress'].flatMap(key=>Object.hasOwn(value,key)?addressCountries(value[key],depth+1):[])]
}
const unsupportedWorksiteFields=(value,allowed)=>value&&Object.keys(value).some(key=>/countr|geograph|worksites?|locations?/i.test(key)&&!allowed.includes(key))

// The suffix describes this particular role's work base. EMEA, cities,
// customer markets and time zones never supply a country here.
export function resolvePrefectWorksite(original){
 const row=structuredClone(original),record=row.sourceNativeListingRecord,posting=row.sourceNativePosting,schema=row.sourceNativeJobPosting
 const countryLiterals=[...addressCountries(record?.address),...list(record?.secondaryLocations).flatMap(place=>addressCountries(place?.address)),...addressCountries(posting?.locationAddress),
  ...list(schema?.jobLocation).flatMap(place=>addressCountries(place)),...list(schema?.applicantLocationRequirements)]
 const unsupported=unsupportedWorksiteFields(record,['location','secondaryLocations'])||unsupportedWorksiteFields(posting,['locationName','locationAddress','secondaryLocationNames'])
  ||unsupportedWorksiteFields(schema,['jobLocation','jobLocationType','applicantLocationRequirements'])
 if(unsupported||countryLiterals.some(value=>!typedCountry(value))||!row.sourceCountryScopeUnresolved&&countryLiterals.some(value=>!(row.sourceNativeCountries??[]).includes(typedCountry(value))))return{...row,country:null,city:null,state:null,location:null,locations:[],sourceCountryScopeUnresolved:true,
  sourceNativeCountryProofHeld:'unsupported original structured work-country or applicant-country alternatives'}
 if(!record||!posting||!schema||!row.sourceCurrentNativePostingIdentityQualified||!row.sourceNativeDetailQualified
  ||record.id!==row.jobId||posting.id!==row.jobId||schema.identifier?.value!==row.jobId
  ||schema.hiringOrganization?.name!=='Prefect'||![posting.title,schema.title,row.title].every(title=>norm(title)===norm(record.title))
  ||!/^.+\(UK-Based\)$/i.test(norm(record.title)))return row
 const existing=row.sourceNativeCountries??[],primary=address(record.address),own=address(posting.locationAddress)
 const schemaPlaces=list(schema.jobLocation)
 const emptyPrimaryPlaceholder=schemaPlaces.length===1&&Object.keys(schemaPlaces[0]??{}).every(key=>['@type','address'].includes(key))
  &&Object.keys(address(schemaPlaces[0])).every(key=>key==='@type')
 const alternatives=[...(emptyPrimaryPlaceholder?[]:schemaPlaces.map(place=>address(place))),...list(schema.applicantLocationRequirements).map(value=>({addressCountry:value}))]
 const specified=[...countryLiterals,primary.addressCountry,own.addressCountry,...alternatives.map(place=>place.addressCountry)].filter(value=>value!=null)
 const conflict=row.sourceNativeCountryConflict||existing.some(country=>country!=='United Kingdom')
  ||specified.some(value=>typedCountry(value)!=='United Kingdom')
 const unknownAlternative=record.secondaryLocations?.length!==0||list(posting.secondaryLocationNames).length!==0
  ||alternatives.some(place=>typedCountry(place.addressCountry)!=='United Kingdom')
 if(conflict||unknownAlternative)return{...row,country:null,city:null,state:null,location:null,locations:[],sourceCountryScopeUnresolved:true,
  sourceNativeCountryConflict:Boolean(conflict),sourceNativeCountryProofHeld:'role-title work-base restriction conflicts with or cannot cover every original native worksite/applicant alternative'}
 return{...row,country:'United Kingdom',city:null,state:null,location:'United Kingdom',locations:['United Kingdom'],sourceCountryScopeUnresolved:false,
  sourceNativeCountries:['United Kingdom'],sourceNativeCountryProof:{kind:'exact-own-role-title-work-base',country:'United Kingdom',title:record.title,
   jobId:row.jobId,sourceUrl:row.sourceUrl,originalListingLocation:record.location,originalListingAddress:structuredClone(record.address),companyWideInference:false}}
}

const validDate=value=>{
 if(value==null)return true
 if(typeof value!=='string')return false
 const match=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value)
 if(!match||!Number.isFinite(Date.parse(value)))return false
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3])
 return month>=1&&month<=12&&day>=1&&day<=new Date(Date.UTC(year,month,0)).getUTCDate()
  &&(!match[4]||Number(match[4])<=23&&Number(match[5])<=59&&Number(match[6])<=59)
}
const publicPosting=posting=>posting&&Object.fromEntries(Object.entries(posting).filter(([key])=>[
 'id','title','departmentName','departmentExternalName','locationName','locationAddress','workplaceType','employmentType',
 'isListed','isConfidential','teamNames','secondaryLocationNames','applicationDeadline',
].includes(key)||/html$|compensation/i.test(key)))
const publicSchema=schema=>schema&&Object.fromEntries(Object.entries(schema).filter(([key])=>[
 'title','description','hiringOrganization','identifier','employmentType','datePosted','validThrough','jobLocation','jobLocationType','applicantLocationRequirements','baseSalary',
].includes(key)))
const publicRow=row=>[row.sourceNativeListingRecord,row.sourceNativeBoardRecord,publicPosting(row.sourceNativePosting),publicSchema(row.sourceNativeJobPosting),row.jobDescription]
const validFeed=feed=>feed?.apiVersion==='1'&&Array.isArray(feed.jobs)&&Object.keys(feed).every(key=>['apiVersion','jobs','meta','total'].includes(key))
 &&(feed.total==null||feed.total===feed.jobs.length)&&[feed,feed.meta??{}].every(value=>value.hasMore==null||value.hasMore===false)
 &&['next','nextPage','nextCursor'].every(key=>feed[key]==null&&feed.meta?.[key]==null)
 &&feed.jobs.every(row=>uuid.test(row?.id)&&row.isListed===true)&&new Set(feed.jobs.map(row=>row.id)).size===feed.jobs.length
const closedEnvelope=(value,count)=>value&&typeof value==='object'&&!Array.isArray(value)
 &&!value.error&&(!value.errors||Array.isArray(value.errors)&&value.errors.length===0)&&value.success!==false
 &&['hasMore','hasNextPage'].every(key=>value[key]==null||value[key]===false)
 &&['next','nextPage','nextCursor','continuationToken'].every(key=>value[key]==null||value[key]==='')
 &&(value.total==null||value.total===count)
 &&['meta','pagination','pageInfo'].every(key=>value[key]==null||closedEnvelope(value[key],count))
const validBoard=data=>Array.isArray(data?.jobBoard?.jobPostings)&&closedEnvelope(data,data.jobBoard.jobPostings.length)&&closedEnvelope(data.jobBoard,data.jobBoard.jobPostings.length)
const activeScript=node=>!node.inert&&!Object.hasOwn(node.attrs,'nomodule')&&['','text/javascript','application/javascript','module'].includes((node.attrs.type??'').trim().toLowerCase())

export const createCurrentPrefectScraper=(defaults={})=>({name:'prefect',async run(passed={}){
 const options={...defaults,...passed},{signal,maxJobs=null,collectionBudgetMs=180000}=options
 signal?.throwIfAborted()
 if((options.fetchText||options.fetchJson)&&!options.fetchPage&&!options.fetchImpl)throw new TypeError('Prefect requires original public HTTP response provenance')
 if(maxJobs!==null&&(!Number.isSafeInteger(maxJobs)||maxJobs<0))throw new TypeError('Invalid Prefect maxJobs')
 if(!Number.isSafeInteger(collectionBudgetMs)||collectionBudgetMs<=0||collectionBudgetMs>600000)throw new TypeError('Invalid Prefect collection budget')
 const deadline=new AbortController(),timeout=fail('public collection deadline exceeded','PREFECT_COLLECTION_TIMEOUT')
 timeout.name='TimeoutError'
 const timer=setTimeout(()=>deadline.abort(timeout),collectionBudgetMs),requestSignal=signal?AbortSignal.any([signal,deadline.signal]):deadline.signal
 const held=new Map(),transportErrors=[],starts=new Map()
 const fetchPage=async url=>{
  requestSignal.throwIfAborted()
  const host=new URL(url).hostname
  if(held.has(host))return{...held.get(host),url}
  const packet=await withCallerSignal(async()=>{
   if(options.fetchPage)return options.fetchPage(url,{signal:signal??requestSignal})
   const begin=Math.max(Date.now(),starts.get(host)??0);starts.set(host,begin+500)
   if(begin>Date.now())await withCallerSignal(()=>new Promise(resolve=>setTimeout(resolve,begin-Date.now())),requestSignal)
   requestSignal.throwIfAborted()
   if(held.has(host))return{...held.get(host),url}
   const readSignal=AbortSignal.any([requestSignal,AbortSignal.timeout(15000)])
   const response=await withCallerSignal(()=>(options.fetchImpl??globalThis.fetch)(url,{method:'GET',redirect:'manual',signal:readSignal,
    headers:{Accept:'text/html,application/json,*/*;q=0.5','User-Agent':'Mozilla/5.0 (compatible; Jobverify scraper)'}}),readSignal)
   const body=Buffer.from(await withCallerSignal(()=>response.arrayBuffer(),readSignal))
   return{status:response.status,url:response.url,headers:Object.fromEntries(response.headers),bodyBase64:body.toString('base64')}
  },requestSignal)
  if(typeof packet?.bodyBase64==='string'&&Buffer.byteLength(packet.bodyBase64,'base64')>16*1024*1024){const error=fail('native response exceeds input limit');transportErrors.push(error);throw error}
  if([401,403,429].includes(packet?.status))held.set(host,packet)
  return packet
 }
 const execute=async()=>{
  let audit
  await createDeclaredJobFeedScraper(profile).run({...options,signal:requestSignal,maxJobs:null,fetchPage,onAudit:value=>{audit=value},onRecords:()=>{}})
  requestSignal.throwIfAborted()
  if(transportErrors.length)throw transportErrors[0]
  if(held.size){const packet=held.values().next().value;throw Object.assign(fail('public native request denied','PREFECT_PUBLIC_ACCESS_DENIED'),{status:packet.status,failureKind:'blocked',abortRetries:true})}
  const allowed=new Set([...profile.primaryPages,profile.declaration.scriptURL,profile.boardURL,profile.publicAPIURL])
  const io=createPublicIO({signal:requestSignal,fetchPage,allowed:url=>allowed.has(url.href)})
  const final={qualified:false,issues:[],originalPrimaryPages:[],originalDeclarationAsset:null,originalNativeBoard:null,originalNativeFeed:null}
  const requireFinal=(ok,message)=>{if(!ok)throw fail(message)}
  try{
   for(const[index,url]of profile.primaryPages.entries()){
    const page=await io.load(url,{fresh:true});final.originalPrimaryPages.push(page)
    requireFinal(page?.usable&&page.transportQualified&&page.bodyBase64,'final primary response unavailable')
    const doc=readNativeDocument(page.originalText),next=profile.primaryPages[index+1]
    requireFinal(doc.nodes(node=>node.tag==='title').some(node=>profile.primaryTitleSignals.some(value=>norm(node.raw).toLowerCase().includes(value.toLowerCase()))),'final primary publisher changed')
    if(next)requireFinal(doc.nodes(node=>node.tag==='a'&&node.attrs.href).some(node=>{try{return new URL(node.attrs.href,url).href===next}catch{return false}}),'final primary career handoff changed')
    else requireFinal(doc.nodes(node=>node.tag==='script'&&activeScript(node)).some(node=>node.attrs.src===profile.declaration.scriptSpecifier),'final declared native asset is inactive')
   }
   const asset=await io.load(profile.declaration.scriptURL,{fresh:true});final.originalDeclarationAsset=asset
   requireFinal(asset?.usable&&asset.transportQualified&&asset.bodySHA256===profile.declaration.scriptSHA256,'final public inventory client changed')
   const board=await io.load(profile.boardURL,{fresh:true})
   requireFinal(board?.usable&&board.transportQualified,'final native board unavailable')
   final.originalNativeBoard=appData(readNativeDocument(board.originalText))
   const feed=await io.load(profile.publicAPIURL,{fresh:true});final.originalNativeFeed=io.json(feed)
   const boardData=final.originalNativeBoard,feedData=final.originalNativeFeed
   requireFinal(feed?.transportQualified&&validFeed(feedData),'final native API envelope incomplete')
   requireFinal(nativeOrganization({...profile,companyName:profile.publisherName},boardData.organization)&&validBoard(boardData),'final native publisher or board envelope changed')
   const ids=feedData.jobs.map(row=>row.id).sort(),briefs=boardData.jobBoard.jobPostings
   requireFinal(new Set(briefs.map(row=>row.id)).size===briefs.length&&same(ids,briefs.map(row=>row.id).sort()),'final native board/API membership differs')
   requireFinal(same(ids,[...audit.opening.nativePostIds].sort())&&same(ids,[...audit.closing.nativePostIds].sort()),'final native membership changed after own details')
   final.qualified=true
  }catch(error){requestSignal.throwIfAborted();final.issues.push(error.message)}
  const finalFeed=new Map((Array.isArray(final.originalNativeFeed?.jobs)?final.originalNativeFeed.jobs:[]).map(row=>[row.id,row]))
  const finalBoard=new Map((final.originalNativeBoard?.jobBoard?.jobPostings??[]).map(row=>[row.id,row]))
  const histories=new Map(audit.observationHistory.map(row=>[row.id,row]))
  const observations=audit.observations.map(original=>{
   let row=resolvePrefectWorksite(original)
   const history=histories.get(row.jobId)
   const stable=history&&same(publicRow(history.earlier),publicRow(history.current))
    &&same(row.sourceNativeListingRecord,finalFeed.get(row.jobId))&&same(row.sourceNativeBoardRecord,finalBoard.get(row.jobId))
   const dates=[row.sourcePostingDate,row.sourceClosingDate,row.sourceNativeStructuredDatePosted,row.sourceNativeJobPosting?.validThrough]
   const detail=Boolean(row.sourceNativeDetailQualified&&row.sourceCurrentNativePostingIdentityQualified&&stable&&dates.every(validDate))
   if(!stable)row={...row,sourceCurrentNativeRoleQualified:false,sourceCurrentNativePostingIdentityQualified:false,sourceNativeTemporalQualification:'full-public-criteria-worksites-dates-or-final-membership-changed'}
   if(!dates.every(validDate))row={...row,postingDate:null,closingDate:null,sourceNativeDateUnresolved:true}
   return{...row,sourceDetailComplete:detail,sourceScopeComplete:false,sourceCompanyWideScopeComplete:false,lifecycleCleanupAllowed:false}
  })
  const complete=Boolean(audit.opening.qualified&&audit.closing.qualified&&validFeed(audit.opening.originalNativeFeed)&&validFeed(audit.closing.originalNativeFeed)
   &&validBoard(audit.opening.originalNativeBoard)&&validBoard(audit.closing.originalNativeBoard)
   &&final.qualified&&observations.every(row=>row.sourceCurrentNativeRoleQualified&&row.sourceDetailComplete&&!row.sourceCountryScopeUnresolved&&!row.sourceNativeCountryConflict))
  const eligible=observations.filter(row=>row.country==='India'&&row.sourceCurrentNativeRoleQualified&&row.sourceDetailComplete&&!row.sourceNativeCountryConflict)
  const capped=maxJobs>0&&eligible.length>maxJobs,jobs=(maxJobs>0?eligible.slice(0,maxJobs):eligible).map(row=>({...row,scrapedAt:new Date().toISOString(),sourceListingComplete:complete&&!capped,sourceDeclaredBoardScopeComplete:complete&&!capped}))
  const evidence={status:complete&&!capped?'complete-inventory':'discovery-only',surface:profile.publicAPIURL,firstParty:audit.rawPages.some(page=>page.transportQualified),listingComplete:complete&&!capped,
   pagesFetched:audit.rawPages.length+io.rawPages.length,reportedTotal:complete?observations.length:null,indiaFacetCount:complete?eligible.length:null,verifiedAt:new Date().toISOString(),
   reason:complete&&!capped?'current-declared-prefect-board-all-full-criteria-country-and-final-membership-qualified;company-wide-scope-and-cleanup-unqualified':'current-prefect-native-board-has-unresolved-detail-country-temporal-or-output-cap-gaps'}
  const result={...audit,observations,final,rawPages:[...audit.rawPages,...io.rawPages],inventoryEvidence:evidence,sourceDeclaredBoardScopeComplete:complete&&!capped,sourceCompanyWideScopeComplete:false,lifecycleCleanupAllowed:false}
  Object.defineProperty(jobs,'sourceAudit',{value:result})
  attachSourceObservationEvidence(jobs,{source:'prefect',recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  attachInventoryEvidence(jobs,evidence)
  await withCallerSignal(()=>options.onAudit?.(structuredClone(result)),requestSignal)
  await withCallerSignal(()=>options.onRecords?.(structuredClone(observations)),requestSignal)
  requestSignal.throwIfAborted()
  if(transportErrors.length)throw transportErrors[0]
  if(held.size){const packet=held.values().next().value;throw Object.assign(fail('final public native request denied','PREFECT_PUBLIC_ACCESS_DENIED'),{status:packet.status,failureKind:'blocked',abortRetries:true})}
  return jobs
 }
 try{return await withCallerSignal(execute,requestSignal)}finally{clearTimeout(timer)}
}})
