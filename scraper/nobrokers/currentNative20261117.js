import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const SOURCE='nobrokers',COMPANY='NoBroker',HOMEPAGE_URL='https://www.nobroker.in/',CAREERS_URL=HOMEPAGE_URL+'careers',JOB_FEED_URL='https://no-broker-cbaa4.firebaseio.com/jobOpeningSheet.json'
export const SEARCH_URL='https://www.linkedin.com/jobs/search/?f_C=9226228&locationId=OTHERS.worldwide'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(nodes,label)=>{need(nodes.length===1,'Expected one current native '+label);return nodes[0]}
// The reviewed executable modules establish the active import/export/call chain.
// Never execute remote programmes or accept an unrelated config string as authority.
const criticalPrograms=new Map([
 ['https://assets.nobroker.in/nb-new/41/41.0a1b48c0d9c92bf70879.chunk.js','0ea440165d6823650117de5198f466761e4f5a4ed78741548c23ba8b41539993'],
 ['https://assets.nobroker.in/nb-new/careers/careers.1c5a6746d0965d5502f9.chunk.js','d1189a0b29b7b13cbb3b9d9bca01c4d6eccba372b96a050fef8f907f5f768c36'],
])
const programmeProfiles=[
 {id:'retained-20261117',componentModule:3325,entryModule:1098,configModule:1365,criticalPrograms,bootURLs:[
  'https://assets.nobroker.in/nb-new/691.b56c99c6f87440061dbe.js',
  'https://assets.nobroker.in/nb-new/main.c45ef50822d53c11ecde.js',
  'https://assets.nobroker.in/nb-new/6/6.a1d241bb327fe1c7fdc1.chunk.js',
  'https://assets.nobroker.in/nb-new/21/21.ba0bf95f500b55ecdf07.chunk.js',
  'https://assets.nobroker.in/nb-new/41/41.0a1b48c0d9c92bf70879.chunk.js',
  'https://assets.nobroker.in/nb-new/careers/careers.1c5a6746d0965d5502f9.chunk.js',
 ]},
 {id:'current-20261121',componentModule:3333,entryModule:1910,configModule:1284,criticalPrograms:new Map([
  ['https://assets.nobroker.in/nb-new/41/41.07a9d48911ae6b02e436.chunk.js','f806a54f28a7188990ad260f82b7fc4e0b9204c209c76a1ae6b7e3ba6447328d'],
  ['https://assets.nobroker.in/nb-new/careers/careers.eeb6f256aea164d5808f.chunk.js','f280ab47549b5a746bc1f48e456a68db666fd0379c22341211d67fe11c076fd5'],
 ]),bootURLs:[
  'https://assets.nobroker.in/nb-new/694.3993ca0e70df03ca905e.js',
  'https://assets.nobroker.in/nb-new/main.4b2dcd38530cd24e9ba0.js',
  'https://assets.nobroker.in/nb-new/6/6.b45dfc055a119082e42f.chunk.js',
  'https://assets.nobroker.in/nb-new/21/21.974be12d96e19d5fbb3e.chunk.js',
  'https://assets.nobroker.in/nb-new/41/41.07a9d48911ae6b02e436.chunk.js',
  'https://assets.nobroker.in/nb-new/careers/careers.eeb6f256aea164d5808f.chunk.js',
 ]},
]
// Complete reviewed tuples prevent combining critical modules with another deployment.
const programmeProfileFor=boot=>programmeProfiles.find(profile=>boot.length===profile.bootURLs.length&&boot.every((p,index)=>p.body===''&&isDeepStrictEqual(Object.keys(p.attrs).sort(),['async','crossorigin','data-chunk','src'])&&p.attrs.async===''&&p.attrs.crossorigin==='anonymous'&&p.attrs['data-chunk']===(index<2?'main':'careers')&&p.attrs.src===profile.bootURLs[index]))
const jobType=v=>Array.isArray(v)?v.some(jobType):typeof v==='string'&&/(?:^|[/#:])JobPosting$/i.test(v)
const hasJob=v=>!!v&&typeof v==='object'&&(jobType(v['@type'])||Object.values(v).some(hasJob))
const detailURL=value=>{try{const u=new URL(value);return u.href===value&&u.origin==='https://www.linkedin.com'&&/^\/jobs\/view\/\d+\/$/.test(u.pathname)&&u.search==='?capColoOverride=true'}catch{return false}}
export function readCurrentNoBrokerPage(html,url){
 const doc=readNativeDocument(html),title=one(activeHead(html).titles,'document title'),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href
 need(title==='Flats, Houses, Apartments for Rent, Buy, Sale Without Brokerage in India'&&canonical===(url===HOMEPAGE_URL?'https://www.nobroker.in':url)&&!doc.nodes(n=>n.tag==='base').length,'Current own NoBroker title/canonical/base changed')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value);need(!structured.some(hasJob),'New native JobPosting requires full vacancy review')
 const website=structured.filter(v=>v?.['@type']==='WebSite');need(website.some(v=>v.url==='https://www.nobroker.in'),'Current NoBroker structured publisher authority changed')
 const career=url===CAREERS_URL?one(doc.nodes(n=>doc.hasClass(n,'nb__2PpJ3')),'whole career root'):null
 if(career)need(doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='Careers at NoBroker',career).length===1&&doc.text(career).includes('Join an amazing team'),'Current own career context changed')
 const programmes=doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''})),boot=programmes.filter(p=>['main','careers'].includes(p.attrs['data-chunk']))
 const programmeProfile=career?programmeProfileFor(boot):null
 if(career)need(programmeProfile,'Current declared career boot programme binding changed')
 return {url,title,canonical,structured,programmeProfileId:programmeProfile?.id??null,wholeCareerDOM:career?structuredClone(career):null,careerText:career?doc.text(career):null,programDeclarations:programmes,bootURLs:boot.map(p=>p.attrs.src),wholeOriginalHTML:html}
}
export function readCurrentNoBrokerFeed(body){
 const feed=readLiteralModel(body).value;need(Array.isArray(feed)&&feed.length<=500,'Current native feed array model changed')
 const keys=['Id','Link','Location','Role','SubTeam','Team'],ids=new Set(),links=new Set()
 for(const row of feed){if(row===null)continue;need(row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).length===keys.length&&keys.every(k=>Object.hasOwn(row,k)),'Unreviewed native feed schema/criteria field requires review')
  need(Number.isSafeInteger(row.Id)&&row.Id>0&&!ids.has(row.Id)&&!links.has(row.Link)&&detailURL(row.Link)&&['Location','Role','SubTeam','Team'].every(k=>typeof row[k]==='string'&&row[k].trim()===row[k]&&row[k].length>0),'Current native row identity/location/application fields changed');ids.add(row.Id);links.add(row.Link)
 }
 return feed
}
export function readCurrentNoBrokerSearch(html){
 const doc=readNativeDocument(html),title=one(activeHead(html).titles,'native handoff title'),filters=doc.nodes(n=>n.tag==='button'&&n.attrs['aria-label']?.includes('Company filter. NoBroker.com filter is currently applied.')).map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)}))
 need(title==='Jobs Jobs at NoBroker.com in United States | LinkedIn'&&filters.length===1,'Current native handoff company/filter scope requires review')
 const main=one(doc.nodes(n=>n.tag==='main'&&n.attrs.id==='main-content'),'complete public search result model'),noResults=doc.nodes(n=>doc.hasClass(n,'no-results'),main)
 need(noResults.length===1&&doc.text(noResults[0]).includes('Jobs jobs in United States')&&!doc.nodes(n=>n.tag==='a'&&/^https:\/\/www\.linkedin\.com\/jobs\/view\//.test(n.attrs.href??''),main).length,'Current native handoff result shape requires vacancy acquisition review')
 return {title,nativeCompanyFilters:filters,nativeNoResultsText:doc.text(noResults[0]),wholeResultsDOM:structuredClone(main),wholeOriginalHTML:html,observedSearchCountry:'United States',searchIsCompanyOrIndiaInventory:false}
}
export async function runCurrentNoBroker(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output bound; native observations cannot be truncated')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html'],[CAREERS_URL,'html'],[JOB_FEED_URL,'json'],[SEARCH_URL,'html']],learnedURL:(url,kind)=>kind==='javascript'&&/^https:\/\/assets\.nobroker\.in\/nb-new\/.+\.js$/.test(url)||kind==='html'&&detailURL(url)})
 let opening,closing,nativeHandoffDenial
 async function detail(url){
  if(nativeHandoffDenial)return {url,httpStatus:null,qualification:'unobserved-after-native-host-denial',activeApplyVerified:false}
  reader.allow(url,'html')
  try{const page=await reader.read(url);return {url,httpStatus:200,wholeOriginalHTML:page.body,qualification:'unreviewed-current-public-detail',activeApplyVerified:false}}
  catch(error){options.signal?.throwIfAborted();const receipt=reader.stats().receipts.at(-1)
   if((error.accessChallenge||[401,402,403,406,407,429,451].includes(error.httpStatus))&&error.failureKind==='blocked_or_access_denied'&&error.responseUrl===url&&receipt?.finalUrl===url){
    nativeHandoffDenial={url,httpStatus:error.httpStatus,message:error.message,failureKind:error.failureKind,accessChallenge:error.accessChallenge===true,originalReceipt:receipt,bodyComplete:receipt?.bodyComplete===true,followupDeniedHostRequests:0}
    return {url,httpStatus:error.httpStatus,qualification:'native-detail-denied-no-criteria-or-application-qualified',originalReceipt:receipt,activeApplyVerified:false}
   }
   if(error.httpStatus!==301)throw error;reader.check();const location=receipt?.headers?.location
   need(receipt?.requestedUrl===url&&receipt.finalUrl===url&&/^https:\/\/www\.linkedin\.com\/jobs\/[a-z0-9-]+-jobs\?trk=expired_jd_redirect$/.test(location??''),'Current native detail no longer matches reviewed expired redirect; original HTTP '+String(error.httpStatus??'unavailable'))
   return {url,httpStatus:301,nativeRedirectLocation:location,originalReceipt:receipt,redirectFollowed:false,qualification:'native-expired-JD-redirect-to-generic-search',activeApplyVerified:false}
  }
 }
 async function authority(){
  const home=readCurrentNoBrokerPage((await reader.read(HOMEPAGE_URL)).body,HOMEPAGE_URL),career=readCurrentNoBrokerPage((await reader.read(CAREERS_URL)).body,CAREERS_URL),programmes=[]
  const profile=programmeProfiles.find(p=>p.id===career.programmeProfileId);need(profile,'Current native programme profile was not selected')
  for(const url of career.bootURLs){reader.allow(url,'javascript');const page=await reader.read(url);if(profile.criticalPrograms.has(url))need(page.sha256===profile.criticalPrograms.get(url),'Reviewed active programme import/config/feed binding changed');programmes.push({url,sha256:page.sha256,wholeOriginalProgram:page.body})}
  const feed=readCurrentNoBrokerFeed((await reader.read(JOB_FEED_URL)).body),search=nativeHandoffDenial?{url:SEARCH_URL,qualification:'unobserved-after-native-host-denial'}:readCurrentNoBrokerSearch((await reader.read(SEARCH_URL)).body),details=[]
  for(const row of feed.filter(Boolean))details.push(await detail(row.Link))
  return {home,career,programmes,feed,search,details,programmeBinding:{programmeProfileId:profile.id,componentModule:profile.componentModule,entryModule:profile.entryModule,configModule:profile.configModule,configExport:'firebaseConfig',collection:'jobOpeningSheet',feedURL:JOB_FEED_URL,searchURL:SEARCH_URL,reviewedCriticalProgramHashes:Object.fromEntries(profile.criticalPrograms),programmesExecuted:false,completeDependencyClosureQualified:false}}
 }
 const semantic=m=>({home:{title:m.home.title,canonical:m.home.canonical,structured:m.home.structured},career:{wholeCareerDOM:m.career.wholeCareerDOM,structured:m.career.structured,bootURLs:m.career.bootURLs},programmes:m.programmes.map(p=>({url:p.url,sha256:p.sha256})),feed:m.feed})
 const searchSemantic=m=>({title:m.title,nativeCompanyFilters:m.nativeCompanyFilters,nativeNoResultsText:m.nativeNoResultsText,wholeResultsDOM:m.wholeResultsDOM}),detailSemantic=m=>({url:m.url,httpStatus:m.httpStatus,nativeRedirectLocation:m.nativeRedirectLocation,wholeOriginalHTML:m.wholeOriginalHTML})
 try{
  opening=await authority();closing=await authority();need(isDeepStrictEqual(semantic(opening),semantic(closing)),'Closing full native feed/career/programme model changed')
  if(opening.search.wholeResultsDOM&&closing.search.wholeResultsDOM)need(isDeepStrictEqual(searchSemantic(opening.search),searchSemantic(closing.search)),'Closing full observed search handoff model changed')
  const detailClosingReconciliation=opening.details.map((detail,index)=>{const other=closing.details[index],bothObserved=[200,301].includes(detail.httpStatus)&&[200,301].includes(other.httpStatus);if(bothObserved)need(isDeepStrictEqual(detailSemantic(detail),detailSemantic(other)),'Closing full observed native detail model changed');return {url:detail.url,observedModelClosingMatch:bothObserved,closingComparisonScope:bothObserved?(detail.httpStatus===301?'HTTP-status-and-native-Location-only;redirect-entity-not-qualified':'whole-original-HTML;role-criteria-and-application-unreviewed'):'native-host-denial-or-unobserved-response',activeApplicationQualified:false}});reader.check()
  const rows=opening.feed.filter(Boolean),jobs=[],summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null};attachSourceObservationEvidence(jobs,summary)
  const observations=rows.map((row,index)=>({nativeRecord:structuredClone(row),jobId:String(row.Id),title:row.Role,location:row.Location,country:/(?:^|,\s*)India$/.test(row.Location)?'India':null,criteria:null,postingDate:null,closingDate:null,applyUrl:row.Link,nativeDetail:opening.details[index],nativeDetailClosing:closing.details[index],publicExperienceChecked:false,publicApplicationEligibilityQualified:false,activeApplyVerified:false}))
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations,nativeObservedFeedClosingReconciled:true,nativeDetailClosingQualified:false,observedNativeDetailMetadataClosingReconciled:!nativeHandoffDenial,detailClosingReconciliation,nativeHandoffDenial,nativeInventoryQualified:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,searchNoResultsIsCompanyZero:false,
   publicApplicationEligibilityQualified:false,sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,applicationInteractions:0,legacyGuessedRouteRequests:0,
   holds:['currently-published-feed-metadata-retained-without-authoritative-full-role-criteria-or-posting-and-closing-dates','advertised-role-redirects-are-generic-expired-JD-searches-not-active-role-applications','authored-worldwide-search-rendered-United-States-scope-cannot-prove-company-or-India-zero','unexecuted-complete-client-dependency-scope-and-company-native-inventory-unqualified']}
  need(Buffer.byteLength(JSON.stringify(audit))<=12*1024*1024,'Native output evidence byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:(nativeHandoffDenial?'observed-native-handoff-HTTP'+nativeHandoffDenial.httpStatus+';no-further-denied-host-reads;':'')+'current-feed-observations-retained;native-expired-detail-redirects-and-scoped-search-do-not-qualify-active-JD-application-or-company-inventory'});reader.check();return result
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}options.signal?.throwIfAborted();throw error}
 finally{reader.close()}
}
