import {isDeepStrictEqual as same} from 'node:util'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {need,one,all,norm,props,scalarFields,constraints,authoredLines,writtenPlaceCountries,nativeCountryName,schemas} from './currentFacts20261120.js'
import {currentReader,nativeUnavailable} from './currentRead20261120.js'
import {currentNativeModel} from './currentModel20261120.js'

export const HOME='https://hoxhunt.com/careers',BOARD='https://jobs.ashbyhq.com/hoxhunt',FEED='https://api.ashbyhq.com/posting-api/job-board/hoxhunt'
const COMPANY='Hoxhunt',SOURCE='hoxhunt',UUID=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
const key=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
const applicationKeys=new Set(['applyurl','applicationurl','jobapplicationurl','applyuri','applicationuri','applylink','applicationlink','joburl','detailurl'])
const employerKeys=new Set(['employer','employername','company','companyname','hiringorganization','legalemployer'])
const countryKeys=new Set(['country','countrycode','jobcountry','workcountry','workplacecountry','addresscountry'])
const context=(at,countries)=>({employer:COMPANY,observedAt:at,countryAlternatives:countries})
function pure(fn){try{return fn()}catch(error){if(error?.nativeContradiction)throw error;throw Object.assign(Error('Hoxhunt complete native parser/contract: '+error.message),{cause:error,abortRetries:true,nativeContradiction:true,softFailure:true,failureKind:'parser_or_contract_error'})}}
function safeURL(value,base){need(typeof value==='string'&&value.trim()===value&&value.length>0,'native URL malformed');const url=new URL(value,base);need(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash,'native exact HTTPS URL differs');return url}
function applications(properties,allowed){for(const property of properties)if(applicationKeys.has(key(property.key))&&property.value!=null)need(allowed.includes(safeURL(property.value,BOARD).href),'native same-role application alias conflicts')}
function ancestors(root,target,path=[]){if(root===target)return[...path,root];for(const child of root.children.filter(n=>typeof n!=='string')){const found=ancestors(child,target,[...path,root]);if(found)return found}return null}
function carrier(p,node,at,{countries=[],allowed=[BOARD]}={}){
 const nodes=ancestors(p.d.root,node);need(nodes,'actual native carrier ancestry missing')
 need(nodes.every(n=>!Object.hasOwn(n.attrs,'disabled')&&!Object.hasOwn(n.attrs,'hidden')&&!Object.hasOwn(n.attrs,'inert')&&n.attrs['aria-disabled']!=='true'&&n.attrs['aria-hidden']!=='true'&&!/(?:^|\s)(?:disabled|hidden|d-none)(?:\s|$)/.test(n.attrs.class??'')&&!/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(n.attrs.style??'')),'actual publisher/control carrier withdrawn')
 const properties=props(nodes.map(n=>({...n,inactive:false,inert:false})));applications(properties,allowed);constraints(properties,[],context(at,countries))
}
function publisher(html,url,at,{own=false}={}){
 const d=document(html),nodes=all(d.root,()=>true),head=activeHead(html),title=one(head.titles,'current native publisher title')
 need(/\bHoxhunt\b/i.test(title),'current publisher brand differs');need(!nodes.some(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')),'native base/refresh differs')
 const p={d,nodes,title},canonicals=nodes.filter(n=>n.tag==='link'&&(n.attrs.rel??'').toLowerCase()==='canonical')
 if(own||canonicals.length){const canonical=one(canonicals,'current publisher canonical');need(safeURL(canonical.attrs.href,url).href===url,'native publisher canonical differs');carrier(p,canonical,at)}
 carrier(p,one(nodes.filter(n=>n.tag==='title'),'actual publisher title'),at)
 for(const meta of nodes.filter(n=>n.tag==='meta'&&['og:site_name','og:url','og:title'].includes(n.attrs.property))){if(meta.attrs.property==='og:site_name')need(meta.attrs.content===COMPANY,'native OG publisher differs');if(meta.attrs.property==='og:url')need(safeURL(meta.attrs.content,url).href===url,'native OG publisher URL differs');if(meta.attrs.property==='og:title')need(/\bHoxhunt\b/i.test(meta.attrs.content??''),'native OG title publisher differs');carrier(p,meta,at)}
 if(own){const heading=one(d.nodes(n=>n.tag==='h1'&&norm(d.text(n))==='Empowering human cyber defense'),'actual current own publisher heading');carrier(p,heading,at)}
 need(!schemas({d}).length,'additional native JobPosting requires role qualification rather than configured empty proof')
 return p
}
function authority(html,at){
 const p=publisher(html,HOME,at,{own:true}),links=p.nodes.filter(n=>n.tag==='a'&&n.attrs.href).filter(n=>{try{const u=safeURL(n.attrs.href,HOME);return u.origin==='https://jobs.ashbyhq.com'&&/^\/[^/]+\/?$/.test(u.pathname)}catch{return false}})
 need(links.length>0&&links.length<=16,'current own direct unfiltered board missing/excessive')
 for(const link of links){need(safeURL(link.attrs.href,HOME).href===BOARD,'current own native account differs');carrier(p,link,at)}
 return{publisher:COMPANY,home:HOME,board:BOARD,originalDeclarations:links.map(n=>({attributes:structuredClone(n.attrs),text:p.d.text(n)})),legalEmployer:null}
}
function noAdditionalJobs(model){
 const collections=new Set(['jobs','joblist','joblistings','jobopenings','openpositions','positions','vacancies','jobpostings','jobcount','jobscount','openjobcount']);let visited=0
 function visit(value,path=[],depth=0){need(depth<=32&&++visited<=20000,'finite native original model scope exceeded');if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach((child,i)=>visit(child,[...path,String(i)],depth+1));return}for(const[name,child]of Object.entries(value)){need(!collections.has(key(name))||path.length===1&&path[0]==='jobBoard'&&name==='jobPostings','additional unqualified native job model prevents configured zero');if(child&&typeof child==='object')visit(child,[...path,name],depth+1)}}
 visit(model)
}
function publication(model,at,countries,allowed){
 constraints(scalarFields(model),[],context(at,countries));applications(Object.entries(model).map(([key,value])=>({key,value})),allowed)
 for(const[field,value]of Object.entries(model)){const name=key(field);if(['listed','islisted'].includes(name))need(value===true,'native role not listed');if(name==='isconfidential')need(value===false,'native employer/publication confidentiality differs')}
 if(model.publishedAt!=null){const value=model.publishedAt;need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value),'native published date malformed');nativeDate(value.slice(0,10),{required:true});need(Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.parse(at),'native published date invalid/future')}
}
function foreignCountry(value){const country=nativeCountryName(value?.name??value);need(country&&country!=='India','native explicit workplace is India or unresolved');return country}
function places(record){
 need(Array.isArray(record.secondaryLocations)&&record.secondaryLocations.length<=64,'native secondary workplaces malformed')
 return[{location:record.location,address:record.address},...record.secondaryLocations].map(place=>{
  need(place&&typeof place==='object'&&!Array.isArray(place)&&typeof place.location==='string'&&norm(place.location)&&!/\b(?:worldwide|anywhere|global|APAC|EMEA)\b/i.test(place.location),'native whole workplace is unresolved')
  const address=place.address?.postalAddress??place.address;need(address&&typeof address==='object'&&!Array.isArray(address),'native typed workplace address absent');const country=foreignCountry(address.addressCountry)
  for(const value of[place.location,address.name,address.addressLocality,address.addressRegion,address.streetAddress].filter(v=>v!=null)){need(typeof value==='string','native workplace text malformed');need(writtenPlaceCountries(value).every(c=>c===country||country==='United States'&&c==='Georgia'&&value===address.addressRegion&&value==='Georgia'),'native same-place authored country contradicts typed address')}
  for(const[field,value]of Object.entries(place))if(countryKeys.has(key(field))&&value!=null)need(foreignCountry(value)===country,'native same-workplace explicit countries conflict')
  return{country,location:place.location,originalAddress:structuredClone(place.address),address:structuredClone(address)}
 })
}
function extraFacts(model,at,workplaces,allowed){
 const countries=[...new Set(workplaces.map(p=>p.country))]
 for(const[field,value]of Object.entries(model)){
  if(value==null)continue;const name=key(field)
  if(employerKeys.has(name)){const employer=typeof value==='string'?value:value&&typeof value==='object'&&!Array.isArray(value)?value.name:null;need(employer===COMPANY,'native nested employer differs')}
  if(countryKeys.has(name))need(countries.includes(foreignCountry(value)),'native explicit primary country differs')
  if(['applicantlocationrequirements','eligibleregion'].includes(name)){const entries=Array.isArray(value)?value:[value];need(entries.length>0&&entries.length<=32,'native applicant countries malformed');entries.forEach(foreignCountry)}
  if(['joblocation','worklocation','primarylocation'].includes(name)){
   const entries=Array.isArray(value)?value:[value];need(entries.length>0&&entries.length<=32,'native additional workplaces malformed')
   const written=entries.map(place=>{need(place&&typeof place==='object'&&!Array.isArray(place),'native typed additional workplace malformed');const address=place.address?.postalAddress??place.address??place,country=foreignCountry(address.addressCountry??place.country??place.countryCode);for(const text of[place.name,address.name,address.addressLocality,address.addressRegion].filter(v=>v!=null))need(writtenPlaceCountries(text).every(c=>c===country),'native typed workplace country contradicts authored place');return{country,city:address.addressLocality??null}})
   need(written.some(place=>workplaces.some(known=>place.country===known.country&&(!place.city||!known.address.addressLocality||norm(place.city).toLowerCase()===norm(known.address.addressLocality).toLowerCase()))),'native additional typed primary workplace contradicts current role')
  }
 }
 publication(model,at,countries,allowed)
}
function criteria(record,at,workplaces,allowed){
 const countries=[...new Set(workplaces.map(p=>p.country))],html=record.descriptionHtml
 need(html==null||typeof html==='string','native original criteria HTML malformed');need(record.descriptionPlain==null||typeof record.descriptionPlain==='string','native original criteria text malformed')
 const d=readNativeDocument(html??''),root=one(d.nodes(n=>n.tag==='root'),'native criteria root'),nodes=all(root,()=>true),properties=props(nodes),lines=[...authoredLines(root),...(record.descriptionPlain??'').split(/\r?\n/).map(norm).filter(Boolean)]
 applications(properties,allowed);constraints(properties,lines,context(at,countries))
 for(const line of lines){const label=/^(?:Location|Work Location|Job Location|Workplace)\s*:\s*(.+)$/i.exec(line);if(label)need(!/\b(?:worldwide|anywhere|global|APAC|EMEA)\b/i.test(label[1]),'authored native workplace is unresolved')}
 for(const schema of schemas({d})){if(schema.title!=null)need(norm(schema.title)===norm(record.title),'native criteria JobPosting title differs');if(schema.url!=null)need(schema.url===record.jobUrl,'native criteria JobPosting URL differs');extraFacts(schema,at,workplaces,allowed)}
 return{originalHTML:html??null,originalPlain:record.descriptionPlain??null}
}
function board(html,at){
 const p=publisher(html,BOARD,at),state=currentNativeModel(p.d),model=state.originalModel,organization=model.organization,collection=model.jobBoard
 noAdditionalJobs(model)
 need(model.environment==='production'&&model.maintenanceMode===false&&model.schedulingMaintenanceMode===false&&model.posting===null&&model.routerPrefix==='/','native current board environment/router differs')
 need(organization.__typename==='Organization'&&organization.name===COMPANY&&organization.hostedJobsPageSlug==='hoxhunt'&&organization.isDemoOrg===false&&UUID.test(organization.organizationId)&&safeURL(organization.publicWebsite).href==='https://hoxhunt.com/','native exact publisher/account/backlink differs')
 need(organization.customJobsPageUrl==null||safeURL(organization.customJobsPageUrl).href===HOME,'native custom publisher differs')
 need(collection?.__typename==='JobBoard'&&collection.stealthAccess===false&&Array.isArray(collection.jobPostings)&&collection.jobPostings.length>0&&collection.jobPostings.length<=2000,'native complete current listed collection unavailable')
 publication(Object.fromEntries(Object.entries(organization).filter(([name])=>!['country','location'].includes(key(name)))),at,[],[BOARD]);publication(collection,at,[],[BOARD])
 const selected=one(p.nodes.filter(n=>n.tag==='script'&&n.attrs===state.originalScriptAttributes),'actual original appData carrier');carrier(p,selected,at)
 return{model,rows:collection.jobPostings,organizationBinding:{id:organization.organizationId,name:organization.name,slug:organization.hostedJobsPageSlug,website:organization.publicWebsite},originalAssignment:state.originalAssignment}
}
function feed(text,currentBoard,at){
 const model=JSON.parse(text);need(model&&typeof model==='object'&&!Array.isArray(model)&&same(Object.keys(model).sort(),['apiVersion','jobs'])&&model.apiVersion==='1'&&Array.isArray(model.jobs)&&model.jobs.length<=2000,'native documented unfiltered public feed shape differs')
 const seen=new Set(),rows=[]
 for(const record of model.jobs){need(record&&typeof record==='object'&&!Array.isArray(record)&&UUID.test(record.id)&&!seen.has(record.id)&&typeof record.title==='string'&&norm(record.title)&&typeof record.isListed==='boolean','native identity/title/listed scope malformed');seen.add(record.id);if(!record.isListed)continue
  const url=BOARD+'/'+record.id,apply=url+'/application';need(record.jobUrl===url&&record.applyUrl===apply,'native account/publicID/application differs');const workplaces=places(record),allowed=[url,apply];extraFacts(record,at,workplaces,allowed);const originalCriteria=criteria(record,at,workplaces,allowed)
  rows.push({id:record.id,title:norm(record.title),url,application:apply,countries:[...new Set(workplaces.map(p=>p.country))],workplaces,originalRecord:structuredClone(record),originalCriteria})
 }
 need(rows.length===currentBoard.rows.length&&new Set(currentBoard.rows.map(r=>r.id)).size===currentBoard.rows.length,'native board/feed membership count differs')
 for(const brief of currentBoard.rows){const row=one(rows.filter(r=>r.id===brief.id),'native exact board/feed identity');need(brief.__typename==='JobPostingBriefsWithIdsAndTeamId'&&norm(brief.title)===row.title&&brief.locationName===row.originalRecord.location&&Array.isArray(brief.secondaryLocations)&&same(brief.secondaryLocations.map(p=>p.locationName),row.originalRecord.secondaryLocations.map(p=>p.location)),'native board/feed title or workplace alternatives differ');for(const field of['workplaceType','employmentType'])if(brief[field]!=null&&row.originalRecord[field]!=null)need(brief[field]===row.originalRecord[field],'native board/feed employment/workplace kind differs');extraFacts(brief,at,row.workplaces,[row.url,row.application])}
 return{model,rows}
}
export async function runCurrentConfiguredBoard(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchPage&&!options.fetchJson,'original native Responses required');for(const field of['maxJobs','maxPages'])if(options[field]!=null)need(Number.isSafeInteger(options[field])&&options[field]>=0,'finite supported caller cap differs')
 const at=pure(()=>new Date((typeof options.now==='function'?options.now():options.now)??new Date()).toISOString()),io=currentReader([HOME],['https://hoxhunt.com','https://jobs.ashbyhq.com','https://api.ashbyhq.com'],options),observations=[];let complete=false
 try{
  if(options.maxJobs!==0&&options.maxPages!==0){for(const phase of['opening','closing']){const authorityBody=await io.read(HOME),currentAuthority=pure(()=>authority(authorityBody.text,at));io.allow(BOARD);const boardBody=await io.read(BOARD),currentBoard=pure(()=>board(boardBody.text,at));io.allow(FEED);const feedBody=await io.read(FEED,{kind:'json'}),currentFeed=pure(()=>feed(feedBody.text,currentBoard,at));observations.push({phase,authority:currentAuthority,board:currentBoard,...currentFeed})}
   need(same(observations[0].board.organizationBinding,observations[1].board.organizationBinding),'native closing publisher/account differs');const membership=value=>value.rows.map(r=>({id:r.id,title:r.title,url:r.url,application:r.application})).sort((a,b)=>a.id.localeCompare(b.id));need(same(membership(observations[0]),membership(observations[1])),'native closing complete role membership differs');complete=true
  }
  const jobs=[],audit={source:SOURCE,observedAt:at,observations,nativeOpeningInventory:observations[0]?.model.jobs??[],nativeClosingInventory:observations[1]?.model.jobs??[],foreignObservations:observations.flatMap(value=>value.rows.map(row=>({...row,phase:value.phase}))),configuredBoardCurrentIndiaJobs:complete?0:null,configuredBoardClosingQualified:complete,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeProgramsExecuted:false,rendererOrUIActivationVerified:false,backendApplicationActivationVerified:false,applicationsSubmitted:false,originalResponses:structuredClone(io.receipts)}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations[0]?.rows.length??0,observedVacancyCount:observations[0]?.rows.length??0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});if(options.onAudit)await io.callback(options.onAudit,structuredClone(audit));io.check()
  return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:BOARD,firstParty:complete,listingComplete:complete,lifecycleCleanupAllowed:false,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:at,reason:complete?'paired-current-own-direct-declared-native-board-and-documented-unfiltered-public-feed;all-listed-primary-and-secondary-workplaces-explicitly-foreign;configured-typed-India-projection-only;not-company-wide-or-country-facet-zero':'caller-zero-cap-without-native-inventory-proof'})
 }catch(error){io.check();if(nativeUnavailable(error)||error?.nativeContradiction)throw error;return pure(()=>{throw error})}finally{io.close()}
}
