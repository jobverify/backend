import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {types} from 'node:util'
import {parse} from 'acorn'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const SOURCE='verintsystems'
export const CORPORATE='https://www.verint.com/careers/'
export const BOARD='https://jobs.ashbyhq.com/27cfd344-670f-4dcd-8b13-0e18005b0d65'
export const FEED='https://api.ashbyhq.com/posting-api/job-board/verint'
const PROFILE=JSON.parse(readFileSync(new URL('./currentProfile20261114.json',import.meta.url),'utf8'))
const LATER_PROFILE=JSON.parse(readFileSync(new URL('./currentProfile20261114Later.json',import.meta.url),'utf8'))
const CORRECTED_PROFILE=JSON.parse(readFileSync(new URL('./currentProfile20261114Corrected.json',import.meta.url),'utf8'))
const INVENTORY_PROFILES=[{records:17,profile:PROFILE},{records:18,profile:LATER_PROFILE},{records:18,profile:CORRECTED_PROFILE}]
const USER_AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const intrinsicByteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
const hash=value=>createHash('sha256').update(value).digest('hex')
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right)
const failure=message=>Object.assign(new Error('[verintsystems] Current native text contract: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap'})
const need=(value,message)=>{if(!value)throw failure(message)}
const cap=(options,names,maximum)=>Math.min(maximum,...names.filter(name=>options[name]!=null).map(name=>{
 const value=options[name]
 if(!Number.isSafeInteger(value)||value<1)throw RangeError('Invalid Verint '+name)
 return value
}))

function reader(options){
 for(const key of ['fetchText','fetchPage','fetchJson'])if(options[key]!=null)throw TypeError('Verint requires full Response fetchImpl; body-only transport is unsupported')
 const limits={sourceTimeoutMs:cap(options,['sourceTimeoutMs'],45000),requestTimeoutMs:cap(options,['requestTimeoutMs'],15000),
  maxRequests:cap(options,['maxRequests'],16),maxPages:cap(options,['maxPages','maxDiscoveryPages'],6),maxDetails:cap(options,['maxDetails','maxDetailResponses'],8),
  maxEntityBytes:cap(options,['maxEntityBytes'],4000000),maxAggregateBytes:cap(options,['maxAggregateBytes'],24000000),maxOutputBytes:cap(options,['maxOutputBytes'],4000000)}
 const controller=new AbortController(),sourceReason=new DOMException('Verint source deadline exceeded','TimeoutError')
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const timer=setTimeout(()=>controller.abort(sourceReason),limits.sourceTimeoutMs),started=performance.now()
 const check=()=>{options.signal?.throwIfAborted();if(performance.now()-started>=limits.sourceTimeoutMs&&!controller.signal.aborted)controller.abort(sourceReason);signal.throwIfAborted()}
 let requests=0,pages=0,details=0,aggregateBytes=0,inventoryProfile=null
 const receipts=[]
 const transport=options.fetchImpl??globalThis.fetch
 const read=async(url,kind)=>{
  check();need(Object.hasOwn(PROFILE.documents,url),'Unreviewed public URL')
  need(requests<limits.maxRequests,'Total read budget exhausted')
  if(kind==='detail'){need(details<limits.maxDetails,'Detail response budget exhausted');details++}
  else{need(pages<limits.maxPages,'Discovery response budget exhausted');pages++}
  requests++
  let responseRedirected
  const page=await boundedDeclaredPublicRead(url,{signal,timeoutMs:limits.requestTimeoutMs,overflowError:failure('Entity budget exhausted'),fetchImpl:async(requestURL,request)=>{
   const response=await transport(requestURL,{...request,credentials:'omit',headers:{...request.headers,'User-Agent':USER_AGENT}})
   if(!(response instanceof Response))throw TypeError('Verint native transport must return an original full Response')
   responseRedirected=response.redirected
   let entityBytes=0
   const body=response.body?.pipeThrough(new TransformStream({transform(chunk,sink){
    if(!types.isUint8Array(chunk))throw TypeError('Native response chunk must be a Uint8Array')
    const length=intrinsicByteLength.call(chunk)
    entityBytes+=length;aggregateBytes+=length
    need(entityBytes<=limits.maxEntityBytes,'Entity byte budget exhausted')
    need(aggregateBytes<=limits.maxAggregateBytes,'Aggregate byte budget exhausted')
    sink.enqueue(chunk)
   }}))??null
   return {status:response.status,url:response.url,headers:new Headers(response.headers),body}
  }})
  check()
  need(responseRedirected===false,'Unexpected followed redirect in original native response')
  if(page.status!==200||page.url!==url)throw Object.assign(failure('HTTP status or exact final URL changed'),{
   status:page.status,requestUrl:url,finalUrl:page.url,
   ...([401,403,407,429,451].includes(page.status)?{failureKind:'blocked_or_access_denied'}:{})})
  const mime=page.headers['content-type']??'',bytes=Buffer.from(page.bodyBase64,'base64')
  // The three admitted inventories have distinct complete board lengths.
  // Select a coherent tuple at its board, then require that same tuple for
  // every following entity and closing read. Corporate/India bytes outside
  // the two typed CSP slots are identical across these reviewed originals.
  const candidates=url===BOARD&&!inventoryProfile?INVENTORY_PROFILES.filter(value=>value.profile.documents[BOARD].bytes===bytes.length):[]
  if(url===BOARD&&!inventoryProfile)need(candidates.length===1,'Original document byte length changed')
  const candidate=inventoryProfile??candidates[0]??INVENTORY_PROFILES[0]
  const profile=candidate.profile.documents[url]
  need(mime===profile.mime,'Original response MIME/UTF8 parameters changed')
  need(bytes.length===profile.bytes,'Original document byte length changed')
  let cursor=0,nonce=null
  for(const [index,slot]of profile.slots.entries()){
   const segment=bytes.subarray(cursor,slot.start),slotBytes=bytes.subarray(slot.start,slot.end)
   const ascii=slotBytes.every(byte=>byte>=48&&byte<=57||byte>=65&&byte<=90||byte>=97&&byte<=122||byte===45||byte===95)
   const value=slotBytes.toString('ascii')
   need(segment.length===profile.segments[index].bytes&&hash(segment)===profile.segments[index].sha256,'Original immutable document segment changed')
   // Exactly two fixed-position public CSP values. All owner attributes,
   // program bytes, native data and criteria remain in immutable segments.
   need(slot.kind==='public-csp-nonce-43-base64url'&&slot.end-slot.start===43&&ascii&&/^[A-Za-z0-9_-]{43}$/.test(value),'Public CSP nonce type changed')
   need(nonce===null||nonce===value,'Public CSP nonce owners disagree');nonce=value;cursor=slot.end
  }
  const last=profile.segments.at(-1),tail=bytes.subarray(cursor)
  need(tail.length===last.bytes&&hash(tail)===last.sha256,'Original immutable document tail changed')
  let html
  try{html=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw failure('Original UTF8 is invalid')}
  need(!html.startsWith('\ufeff'),'Unexpected original BOM')
  if(url===BOARD&&!inventoryProfile)inventoryProfile=candidate
  const receipt={url,kind,status:page.status,contentType:mime,bytes:bytes.length,originalEntitySHA256:hash(bytes),finiteRawByteProfileMatched:true}
  receipts.push(receipt)
  return {html,receipt}
 }
 return {read,check,limits,inventorySize:()=>inventoryProfile?.records,stats:()=>({limits,requests,pages,details,aggregateBytes,finiteInventoryRecordCount:inventoryProfile?.records??null,receipts}),close:()=>clearTimeout(timer)}
}

function corporate(entity){
 const doc=readVisibleNativeDocument(entity.html,{strict:true})
 const links=doc.nodes(node=>node.tag==='a'&&node.attrs.href===BOARD&&doc.text(node)==='Join Our Global Team')
 need(links.length===2,'Exact current corporate employer handoff changed')
 return links.map(node=>({attributes:node.attrs,text:doc.text(node)}))
}
function native(entity){
 const doc=readNativeDocument(entity.html),scripts=doc.nodes(node=>node.tag==='script'&&!node.attrs.src&&/window\.__appData\s*=/.test(node.raw||''))
 need(scripts.length===1,'Unique original native data owner unavailable')
 const raw=scripts[0].raw,tree=parse(raw,{ecmaVersion:'latest'}),first=tree.body[0],assignment=first?.expression
 need(first?.type==='ExpressionStatement'&&assignment?.type==='AssignmentExpression'&&assignment.operator==='='
  &&assignment.left.type==='MemberExpression'&&!assignment.left.computed&&assignment.left.object.name==='window'&&assignment.left.property.name==='__appData'
  &&assignment.right.type==='ObjectExpression','Original first native literal assignment changed')
 const app=JSON.parse(raw.slice(assignment.right.start,assignment.right.end)),org=app.organization
 need(app.environment==='production'&&app.maintenanceMode===false&&app.schedulingMaintenanceMode===false
  &&org?.organizationId==='ce0bb950-f562-4737-aa12-c1de5c4f6b6d'&&org.name==='Verint'&&org.publicWebsite==='https://www.verint.com/'
  &&org.hostedJobsPageSlug==='verint'&&org.isDemoOrg===false,'Original own native employer/status changed')
 return {app,doc,executableSuffixSHA256:hash(raw.slice(first.end))}
}
function listing(board,feed,expectedRecords){
 const rows=feed.jobs,briefs=board.jobBoard?.jobPostings
 need(Array.isArray(rows)&&rows.length===expectedRecords&&Array.isArray(briefs)&&briefs.length===rows.length,'Complete original native inventory changed')
 need(new Set(rows.map(row=>row.id)).size===rows.length&&new Set(briefs.map(row=>row.id)).size===briefs.length,'Duplicate original native role identity')
 for(const row of rows){
  const brief=briefs.find(value=>value.id===row.id)
  need(brief&&row.isListed===true&&brief.title===row.title&&brief.locationName===row.location
   &&brief.workplaceType===row.workplaceType&&brief.employmentType===row.employmentType
   &&same(brief.secondaryLocations.map(value=>value.locationName),row.secondaryLocations.map(value=>value.location)),'Native board/feed full role identity disagrees')
 }
 return rows
}
const allCountries=row=>[row,...row.secondaryLocations].map(location=>location.address?.postalAddress?.addressCountry??null)
function detail(entity,row,observedAt){
 const {app,doc,executableSuffixSHA256}=native(entity),posting=app.posting
 const schemas=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').map(node=>JSON.parse(node.raw))
 need(schemas.length===1&&schemas[0]['@type']==='JobPosting','Unique original full native JobPosting unavailable')
 const schema=schemas[0]
 need(posting?.id===row.id&&posting.title===row.title&&posting.locationName===row.location&&posting.isListed===true&&posting.isConfidential===false
  &&posting.workplaceType===row.workplaceType&&posting.employmentType===row.employmentType&&posting.descriptionHtml===row.descriptionHtml
  &&same(posting.secondaryLocationNames,row.secondaryLocations.map(value=>value.location)),'Full original native role fields disagree')
 need(schema.identifier?.value===row.id&&schema.identifier.name==='Verint'&&schema.title===row.title&&schema.description===row.descriptionHtml
  &&schema.hiringOrganization?.name==='Verint'&&schema.hiringOrganization.sameAs==='https://www.verint.com/','Original full native schema/employer disagrees')
 need(allCountries(row).every(country=>country==='India')&&schema.jobLocation?.address?.addressCountry==='India'
  &&schema.applicantLocationRequirements?.name==='India','Original explicit native country disagrees')
 need(typeof row.publishedAt==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}\+00:00$/.test(row.publishedAt)
  &&Number.isFinite(Date.parse(row.publishedAt))&&Date.parse(row.publishedAt)<=Date.parse(observedAt)
  &&schema.datePosted===new Date(row.publishedAt).toISOString().slice(0,10)&&posting.applicationDeadline===null,'Original native publication/date state changed')
 const criteria=readOriginalNativeCriteria(row.descriptionHtml,failure)
 need(criteria.sourceDetailComplete&&/ABOUT THE ROLE:/.test(row.descriptionPlain)&&/REQUIREMENTS YOU WILL NEED TO BE SUCCESSFUL:/.test(row.descriptionPlain),'Full substantive original role criteria unavailable')
 need(!/\b(?:(?:this|the) (?:job|position|role) (?:is |has been )?(?:closed|filled|expired)|no longer accepting applications)\b/i.test(row.descriptionPlain),'Explicit native closed role')
 return {posting,schema,criteria,executableSuffixSHA256,organization:{organizationId:app.organization.organizationId,name:app.organization.name,publicWebsite:app.organization.publicWebsite,hostedJobsPageSlug:app.organization.hostedJobsPageSlug}}
}

export async function run(options={}){
 const read=reader(options)
 try{
  read.check()
  need(read.limits.maxRequests>=8&&read.limits.maxPages>=6&&read.limits.maxDetails>=2,'Caller budget cannot fit required opening/closing authority')
  const observedAt=(options.now??(()=>new Date().toISOString()))()
  need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'Invalid source observation clock')
  const openingCorporate=corporate(await read.read(CORPORATE,'corporate'))
  const openingBoard=native(await read.read(BOARD,'board'))
  const openingFeed=JSON.parse((await read.read(FEED,'feed')).html),rows=listing(openingBoard.app,openingFeed,read.inventorySize())
  const selected=rows.filter(row=>allCountries(row).every(value=>value==='India'))
  need(selected.length===1,'Finite reviewed explicit India cohort changed; no verified zero')
  const row=selected[0],first=detail(await read.read(row.jobUrl,'detail'),row,observedAt),last=detail(await read.read(row.jobUrl,'detail'),row,observedAt)
  need(same(first.posting,last.posting)&&same(first.schema,last.schema)&&same(first.organization,last.organization),'Full original role changed at closing')
  const closingFeed=JSON.parse((await read.read(FEED,'feed')).html),closingBoard=native(await read.read(BOARD,'board'))
  listing(closingBoard.app,closingFeed,read.inventorySize())
  const closingCorporate=corporate(await read.read(CORPORATE,'corporate'))
  need(same(openingFeed,closingFeed)&&same(openingBoard.app.jobBoard,closingBoard.app.jobBoard)
   &&same(openingBoard.app.organization,closingBoard.app.organization)&&same(openingCorporate,closingCorporate),'Original whole inventory/employer handoff changed at closing')
  const address=row.address.postalAddress
  const jobs=[{...first.criteria,source:SOURCE,company:'Verint Systems',title:row.title,jobId:row.id,requisitionId:row.id,
   country:'India',city:address.addressLocality,state:address.addressRegion,location:[address.addressLocality,address.addressRegion,address.addressCountry].join(', '),
   department:row.department,team:row.team,employmentType:row.employmentType,remoteStatus:row.workplaceType,
   jobDescription:row.descriptionHtml,sourceDescription:row.descriptionHtml,sourceDescriptionText:row.descriptionPlain,
   postingDate:row.publishedAt,closingDate:null,nativePublicationDateProvenance:'Original Ashby publishedAt reconciled with original JobPosting.datePosted; first-ever publication unverified',
   sourceUrl:row.jobUrl,applyUrl:row.applyUrl,link:row.applyUrl,sourceNativeListingRecord:row,sourceNativeDetailRecord:first.posting,sourceNativeJobPosting:first.schema,
   sourceNativeClosingDetailRecord:last.posting,nativeEmployerBinding:first.organization,sourceClosingReconciled:true,nativeCriteriaTextComplete:true,
   sourceDetailComplete:true,fullSourceDetailQualified:true,sourceDetailQualification:'complete-original-native-criteria-as-data-only',
   sourceListingComplete:false,sourceScopeComplete:false,sourceCompanyCoverageComplete:false,lifecycleCleanupAllowed:false,currentCSSCoverage:false,activationVerified:false,
   nativeApplyHandoff:{url:row.applyUrl,source:'original native feed',directApply:first.schema.directApply,applicationActionVerified:false},
   nativeWorkplaceCarriers:{feedIsRemote:row.isRemote,feedWorkplaceType:row.workplaceType,schemaJobLocationType:first.schema.jobLocationType,discrepancyPreserved:true},
   scrapedAt:observedAt,companyCareerPage:CORPORATE,companyDomain:'verint.com',atsPlatform:'ashby'}]
  const audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,returnedCount:jobs.length,
   originalOpeningFeed:openingFeed,originalClosingFeed:closingFeed,originalOpeningBoard:openingBoard.app.jobBoard,originalClosingBoard:closingBoard.app.jobBoard,
   holds:rows.filter(value=>value.id!==row.id).map(value=>({id:value.id,nativeCountries:allCountries(value),reason:'outside-selected-explicit-India-native-cohort;detail-unhydrated'})),
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,currentCSSCoverage:false,activationVerified:false,
   openingClosingListingMatch:true,openingClosingEmployerMatch:true,applicationQuestionsQualified:false,firstEverPublicationVerified:false,
   nativeCriteriaQualification:'Finite original native criteria as data only. External client/CSS/media/application/rendered activation and complete company scope remain unverified.',
   profileNonceScope:'Only exact two same fixed-position 43-base64url public CSP values per native HTML; full raw entity hashes retained. Rotation is permitted as a typed data slot, not claimed observed in the paired fixture.',
   nativeFeedRouteProvenance:'Existing public Ashby posting-api contract; slug taken from exact current own native organization. Endpoint is not a literal route newly discovered in the corporate page.',
   nativeWorkplaceDiscrepancy:jobs[0].nativeWorkplaceCarriers,reader:read.stats(),observationTime:observedAt}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:audit.reader.requests,
   reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'current-own-native-original-India-criteria-and-opening-closing-inventory-reconciled;client-CSS-activation-application-company-scope-unverified'})
  need(Buffer.byteLength(JSON.stringify({jobs,audit}))<=read.limits.maxOutputBytes,'Output byte budget exhausted')
  read.check();return jobs
 }finally{read.close()}
}
