import {isDeepStrictEqual} from 'node:util'
import {readFileSync} from 'node:fs'
import {encodeHTML} from 'entities'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {readEightfoldDataCarrier,parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {createDsmNativeReader,CAREERS,BOARD,ORIGIN} from './nativeReader20261121.js'
import {readCurrentDsmEntry,readCurrentDsmRoles} from './currentProgramme20261121.js'
import {currentDsmCriteria} from './nativeCriteria20261121.js'
const SOURCE='dsmfirmenich',SEARCH=ORIGIN+'/api/pcsx/search?domain=dsm.com&query=&location=India&start=0&'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
const text=v=>typeof v==='string'&&v.trim().length>0
const norm=v=>String(v).normalize('NFC').replace(/\s+/gu,' ').trim()
const keys=(v,allowed)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k))
const listingKeys=['id','displayJobId','name','locations','standardizedLocations','postedTs','solrScore','stars','department','creationTs','isHot','workLocationOption','locationFlexibility','atsJobId','positionUrl']
const detailKeys=['id','displayJobId','name','locations','standardizedLocations','postedTs','stars','department','creationTs','jobDescription','location','isHot','workLocationOption','locationFlexibility','atsJobId','positionUrl','publicUrl','jdHighlight','positionExtraDetails','positionUserActions']
function envelope(body){const v=parseEightfoldJson(body);need(keys(v,['status','error','data','metadata'])&&v.status===200&&keys(v.error,['message','body'])&&v.error.message===''&&v.error.body===''&&v.metadata===null,'Native public JSON error/envelope changed');return v}
function listing(body){
 const model=envelope(body),d=model.data
 need(d&&Number.isSafeInteger(d.count)&&d.count>=0&&d.count<=100000&&Array.isArray(d.positions)&&d.positions.length<=10&&d.count>=d.positions.length,'Native first-page total/row bounds changed')
 const ids=new Set()
 for(const row of d.positions){need(row&&typeof row==='object'&&!Array.isArray(row)&&Number.isSafeInteger(row.id)&&row.id>0&&!ids.has(row.id)&&row.positionUrl==='/careers/job/'+row.id&&text(row.name)&&text(row.displayJobId),'Native first-page unique identity changed');ids.add(row.id)}
 return model
}
function countries(row){
 if(!Array.isArray(row.locations)||!row.locations.length||!row.locations.every(text)||!Array.isArray(row.standardizedLocations)||row.standardizedLocations.length!==row.locations.length||!row.standardizedLocations.every(text))return null
 const pairs=row.locations.map((label,i)=>({label,standardized:row.standardizedLocations[i],country:nativeLocationCountryName(label),standardizedCountry:nativeCountryName(row.standardizedLocations[i].split(',').at(-1).trim())}))
 if(row.location!=null&&(!text(row.location)||!row.locations.some(v=>norm(v)===norm(row.location))))return null
 return pairs.every(p=>p.country==='India'&&p.standardizedCountry==='India')?pairs:null
}
function corporate(body){
 const d=readNativeDocument(body);need(!d.nodes(n=>n.tag==='base').length,'Corporate base changed')
 const links=d.nodes(n=>n.tag==='a'&&!n.inert&&n.attrs.href===BOARD).map(n=>({href:n.attrs.href,label:d.text(n)}))
 need(links.length>0&&links.every(l=>/roles|vacancies/i.test(l.label)),'Current own corporate native recruitment handoff unavailable')
 return{links,wholeAuthoredText:d.text(d.nodes(n=>n.tag==='root')[0])}
}
function nativeBoard(body){
 const d=readNativeDocument(body);need(!d.nodes(n=>n.tag==='base').length,'Native board base changed')
 const scripts=d.nodes(n=>n.tag==='script'&&!n.inert&&!Object.hasOwn(n.attrs,'nomodule')&&/^(?:|application\/javascript|text\/javascript)$/i.test(n.attrs.type??'')&&/^\/gen\/js\/pcsxPwa\.[a-f0-9]+\.js$/.test(n.attrs.src??''))
 need(scripts.length===1,'Unique active native PWA declaration unavailable')
 const pcsx=readEightfoldDataCarrier(body,{id:'pcsx-data',mountId:'pcsx'}).value,branding=readEightfoldDataCarrier(body,{id:'branding-data'}).value
 need(pcsx.domain==='dsm.com'&&branding.domain==='dsm.com'&&pcsx.themeBuilderUser===null&&isDeepStrictEqual(pcsx.onboardingData,{}),'Current public native tenant/mode changed')
 return{entryURL:new URL(scripts[0].attrs.src,ORIGIN).href,entryAttributes:{src:scripts[0].attrs.src,type:scripts[0].attrs.type??'',nomodule:false},pcsx,branding}
}
function posting(body,url){
 const d=readNativeDocument(body),head=activeHead(body);need(!d.nodes(n=>n.tag==='base').length,'Own published role base changed')
 const all=d.nodes(n=>n.tag==='script'&&!n.inert&&n.attrs.type==='application/ld+json').map(n=>({raw:n.raw,model:parseEightfoldJson(n.raw)})).filter(p=>p.model?.['@type']==='JobPosting')
 need(all.length===1&&all[0].model.url===url,'Exact own published role JobPosting unavailable')
 return{...all[0],head}
}
const reviewedSupplemental=JSON.parse(readFileSync(new URL('./reviewedCriticalProgramme20261121.json',import.meta.url))).supplemental
function supplemental(extra){
 const nullable=v=>v===null||typeof v==='string'
 if(!keys(extra,['videos','blogs','perks','pymww','customContent'])||!Array.isArray(extra.videos)||extra.videos.length>20||!Array.isArray(extra.perks)||extra.perks.length>20||!Array.isArray(extra.blogs)||extra.blogs.length||!Array.isArray(extra.customContent)||extra.customContent.length||!keys(extra.pymww,['people','count'])||!Array.isArray(extra.pymww.people)||extra.pymww.people.length||extra.pymww.count!==0)return null
 if(!extra.videos.every(v=>keys(v,['url','title','description'])&&text(v.url)&&text(v.title)&&text(v.description))||!extra.perks.every(v=>keys(v,['title','description','image','imageAlt','icon','isFavicon'])&&text(v.title)&&text(v.description)&&nullable(v.image)&&nullable(v.imageAlt)&&typeof v.icon==='string'&&typeof v.isFavicon==='boolean'))return null
 return{videos:extra.videos.map(({title,description})=>({title,description})),blogs:[],perks:extra.perks.map(({title,description,imageAlt})=>({title,description,imageAlt})),pymww:{people:[],count:0},customContent:[]}
}
function isReviewedSupplement(extra){
 if(!extra)return false
 const videoKeys=extra.videos.map(v=>JSON.stringify(v))
 return new Set(videoKeys).size===videoKeys.length
  &&extra.videos.every(v=>reviewedSupplemental.videos.some(known=>isDeepStrictEqual(v,known)))
  &&isDeepStrictEqual({...extra,videos:[]},{...reviewedSupplemental,videos:[]})
}
function supplementalText(model){return [...model.videos,...model.perks].flatMap(v=>[v.title,v.description,v.imageAlt].filter(v=>typeof v==='string'&&v.length)).join('\n\n')}
const postingFields=['@context','@type','title','description','url','jobLocation','hiringOrganization','datePosted','validThrough','employmentType','inLanguage']
function reviewedPostingShape(p){
 const places=Array.isArray(p.jobLocation)?p.jobLocation:[p.jobLocation]
 return keys(p,postingFields)&&keys(p.hiringOrganization,['@type','logo','name','sameAs'])&&p.hiringOrganization.sameAs==='dsm.com'&&places.length>0&&places.every(l=>keys(l,['@type','address'])&&keys(l.address,['@type','addressCountry','addressLocality','addressRegion','streetAddress','postalCode'])&&(typeof l.address.addressCountry==='string'||keys(l.address.addressCountry,['@type','name'])))
}
function qualified(row,model,published,application){
 const d=model.data,p=published.model,pairs=countries(row),holds=[]
 const hold=(ok,reason)=>{if(!ok)holds.push(reason)}
 hold(keys(row,listingKeys)&&keys(d,detailKeys),'native-fields-or-dates-outside-reviewed-contract')
 const extra=supplemental(d?.positionExtraDetails)
 hold(isReviewedSupplement(extra)&&Array.isArray(d.jdHighlight)&&d.jdHighlight.length===0,'native-supplemental-criteria-unreconciled')
 hold(reviewedPostingShape(p),'own-published-supplemental-or-eligibility-fields-unreconciled')
 hold(keys(d?.positionUserActions,['isSaved','applyAction'])&&typeof d.positionUserActions.isSaved==='boolean'&&keys(d.positionUserActions.applyAction,['status']),'native-application-model-unreconciled')
 hold(pairs&&countries(d),'explicit-native-country-unknown-mixed-or-conflicting')
 hold(d?.publicUrl===ORIGIN+row.positionUrl&&d?.positionUrl===row.positionUrl,'native-detail-public-identity-conflict')
 for(const k of ['id','displayJobId','name','locations','standardizedLocations','postedTs','creationTs','department','atsJobId','workLocationOption','locationFlexibility'])hold(isDeepStrictEqual(row[k],d?.[k]),'native-listing-detail-'+k+'-conflict')
 hold(norm(p.title??'')===norm(row.name),'own-published-native-title-conflict')
 hold(p.hiringOrganization?.name==='dsm-firmenich','own-published-employer-unqualified')
 const locations=Array.isArray(p.jobLocation)?p.jobLocation:[p.jobLocation]
 hold(locations.length>0&&locations.every(l=>nativeCountryName(typeof l?.address?.addressCountry==='object'?l.address.addressCountry.name:l?.address?.addressCountry)==='India'),'own-published-native-country-unqualified')
 const nativeDate=Number.isSafeInteger(d?.postedTs)&&d.postedTs>0?new Date(d.postedTs*1000).toISOString():null
 // Native postedTs supplies the actual Unix instant. The own schema prints
 // the same second without milliseconds or a timezone; retain that literal
 // separately and never add a timezone to its authored value.
 hold(nativeDate&&p.datePosted===nativeDate.slice(0,19),'native-publication-date-channels-conflict')
 if(p.validThrough!=null){
  const literal=p.validThrough,day=typeof literal==='string'?literal.match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/)?.[1]:null
  // Compare only a clearly past authored calendar day. No timezone is added
  // to the source field, and an absent closing date is not invented.
  hold(day&&Number.isFinite(Date.parse(literal))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day&&day>=new Date().toISOString().slice(0,10),'own-published-application-validity-unqualified-or-expired')
 }
 hold(d?.positionUserActions?.applyAction?.status==='allowed','native-public-application-action-not-allowed')
 let apiCriteria,publishedCriteria
 try{apiCriteria=currentDsmCriteria(d.jobDescription,true);publishedCriteria=currentDsmCriteria(p.description,false);hold(apiCriteria.length>200&&apiCriteria===publishedCriteria,'whole-authored-native-and-own-published-criteria-differ')}catch{holds.push('native-criteria-block-or-list-semantics-unqualified')}
 if(holds.length)return{holds:[...new Set(holds)],job:null}
 const url=ORIGIN+row.positionUrl
 const authoredSupplement=supplementalText(extra),description=d.jobDescription+'\n'+authoredSupplement.split('\n\n').map(v=>'<p>'+encodeHTML(v)+'</p>').join('\n')+'\n<p>'+encodeHTML(application.publicApplicationLabel)+'</p>'
 return{holds:[],job:{source:SOURCE,company:'DSM-Firmenich',companyName:'DSM-Firmenich',title:row.name,jobTitle:row.name,jobId:String(row.id),nativeId:String(row.id),requisitionId:row.displayJobId,location:row.locations.join(' | '),country:'India',url,jobUrl:url,applyUrl:ORIGIN+application.publicApplicationPrefix+row.id,description,sourceDescription:description,sourceDescriptionHTML:description,postingDate:nativeDate,datePosted:nativeDate,employmentType:p.employmentType??null,
  sourceNativeCountry:null,sourceCountryProvenance:{kind:'explicit-native-location-name-and-standardized-country-plus-own-JobPosting',pairs,jobPostingCountry:locations.map(l=>l.address.addressCountry)},sourceCountryScopeUnresolved:false,sourceCriteriaScopeUnresolved:false,sourceApplicationScopeUnresolved:false,sourceCompanyScopeUnresolved:false,sourceNativeEmployerQualified:true,sourceCompanyInventoryScopeUnresolved:true,lifecycleCleanupAllowed:false,sourceLifecycleCleanupAllowed:false,applicationVisited:false,activeApplyVerified:false,renderedVerified:false,
  sourceNativeRecord:{listing:structuredClone(row),detail:structuredClone(d),jobPosting:structuredClone(p)},sourceDescriptionChannels:{nativeJobDescriptionHTML:d.jobDescription,publishedJobPostingDescription:p.description,nativeApplicationLabel:application.publicApplicationLabel,nativeSupplementalContent:structuredClone(d.positionExtraDetails),nativeSupplementalAuthoredText:authoredSupplement},sourceNativeDatePostedLiteral:p.datePosted,sourceNativeValidThroughLiteral:p.validThrough??null,sourceNativeCreationTimestamp:d.creationTs,sourceNativeApplicationDeclaration:structuredClone(application),sourceNativeApplicationStatus:'allowed',sourceScope:'positive-partial-first-native-query-page',sourceScopeComplete:false}}
}
export async function runCurrentDsm(options={}){
 options.signal?.throwIfAborted();const max=options.maxHydratedJobs??10
 need(Number.isSafeInteger(max)&&max>=0&&max<=10,'Invalid selected native hydration cap')
 const io=createDsmNativeReader(options)
 let opening,closing,openedListing,closedListing;const observations=[],hydrated=[]
 const authority=async()=>{
  const ownResponse=await io.read(CAREERS),boardResponse=await io.read(BOARD),own=corporate(ownResponse.body),board=nativeBoard(boardResponse.body)
  io.allow(board.entryURL,'javascript');const client=await io.read(board.entryURL),entry=readCurrentDsmEntry(client.body)
  io.allow(entry.componentURL,'javascript');io.allow(entry.pageURL,'javascript')
  const component=await io.read(entry.componentURL),page=await io.read(entry.pageURL),application=readCurrentDsmRoles(entry,component.body,page.body)
  return{own,board,entryURL:board.entryURL,entryContract:entry.projection,pageURL:entry.pageURL,componentURL:entry.componentURL,application,originalUnexecutedProgrammes:{entry:client.body,component:component.body,page:page.body}}
 }
 const audit=()=>({source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,nativeOpening:opening,nativeClosing:closing,originalOpeningRawJSON:openedListing?.body??null,originalClosingRawJSON:closedListing?.body??null,openingListing:openedListing?.model??null,closingListing:closedListing?.model??null,observations,originalResponses:io.stats().receipts,queryReportedMatches:openedListing?.model.data.count??null,queryMatchesAreNotIndiaOrCompanyTotal:true,wholeCompanyInventoryQualified:false,rawNativeCountryFabricated:false,applicationVisited:false,activeApplyVerified:false,renderedVerified:false})
 try{
  opening=await authority();io.allow(SEARCH,'json');const list=await io.read(SEARCH);openedListing={body:list.body,model:listing(list.body)}
  for(const row of openedListing.model.data.positions)observations.push({nativeId:String(row.id),nativeRecord:structuredClone(row),nativeCountry:null,explicitLocationPairs:countries(row),country:countries(row)?'India':null,holdReasons:countries(row)?['native-detail-and-own-published-role-not-yet-hydrated']:['native-work-country-unknown-mixed-or-conflicting'],qualified:false})
  for(const observation of observations.filter(o=>o.explicitLocationPairs).slice(0,max)){
   const row=observation.nativeRecord,url=ORIGIN+row.positionUrl,detailURL=ORIGIN+'/api/pcsx/position_details?'+new URLSearchParams({position_id:String(row.id),domain:'dsm.com',hl:'en'})
   io.allow(detailURL,'json');io.allow(url,'html')
   const detail=await io.read(detailURL),model=envelope(detail.body),html=await io.read(url),published=posting(html.body,url),result=qualified(row,model,published,opening.application)
   Object.assign(observation,{detail:structuredClone(model),ownJobPosting:published.model,originalDetailRawJSON:detail.body,originalPublishedJobPosting:published.raw,holdReasons:result.holds,qualified:!!result.job})
   hydrated.push({observation,row,url,detailURL,detailRaw:detail.body,model,published,result})
  }
  for(const r of hydrated){
   const detail=await io.read(r.detailURL),model=envelope(detail.body),html=await io.read(r.url),published=posting(html.body,r.url)
   need(isDeepStrictEqual(r.model,model)&&isDeepStrictEqual(r.published.model,published.model),'Closing complete selected native/own published role changed')
   Object.assign(r.observation,{originalClosingDetailRawJSON:detail.body,originalClosingPublishedJobPosting:published.raw,wholeSelectedRoleClosingReconciled:true})
  }
  const closed=await io.read(SEARCH);closedListing={body:closed.body,model:listing(closed.body)}
  need(isDeepStrictEqual(openedListing.model,closedListing.model),'Closing whole first-page raw native model/count changed')
  closing=await authority()
  const semantic=a=>({own:a.own,board:a.board,entryURL:a.entryURL,entryContract:a.entryContract,pageURL:a.pageURL,componentURL:a.componentURL,application:a.application})
  need(isDeepStrictEqual(semantic(opening),semantic(closing)),'Closing current corporate/native programme/account models changed')
  const jobs=hydrated.filter(r=>r.result.job).map(r=>r.result.job),summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachSourceObservationEvidence(jobs,summary)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{...audit(),wholeObservedNativePageClosingReconciled:true,everyHydratedRoleClosingReconciled:true,unhydratedNativeRowCount:observations.length-hydrated.length,hydratedNativeRoleCount:hydrated.length,qualifiedNativeRoleCount:jobs.length,callerHydrationCap:max,scope:'First native India-query page only; full selected-role metadata qualification, no company inventory or browser/application execution claim.'}})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:SEARCH,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-declared-native-first-query-page-and-selected-full-role-models-reconciled;positive-partial-company-scope-and-cleanup-held'})
  io.check();return jobs
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{configurable:true,value:audit()})}catch{/* Preserve the exact primary failure or caller reason. */}options.signal?.throwIfAborted();throw error}
 finally{io.close();options.signal?.throwIfAborted()}
}
