import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {requireNative,oneNative,nativeDate,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {isNativeBareCityInPublicScope} from '../../scraper-support/shared/nativeCityScope.js'
import {getValidIndiaCityForJob} from '../../src/utils/publicJobLocationScope.js'
import {extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'

export const HOME_URL='https://www.xto10x.com/', ABOUT_URL='https://www.xto10x.com/about'
export const EMPLOYER_URL='https://www.linkedin.com/company/xto10x-tech'
export const INDIA_URL='https://www.linkedin.com/jobs/search/?f_C=14628973&location=India'
export const WORLDWIDE_URL='https://www.linkedin.com/jobs/search/?f_C=14628973&location=Worldwide'
export const RECRUITING_EMAIL='mailto:hungryforimpact@xto10x.com'
export const NATIVE_POSTS=[{id:1728041,title:'Strategy Consultant',url:'https://www.iimjobs.com/j/strategy-consultant-1728041'},{id:1728042,title:'Engagement Manager',url:'https://www.iimjobs.com/j/engagement-manager-1728042'}]
export const apiURL=id=>'https://gladiator.iimjobs.com/job/detail?jobcode='+id
export function activeDocument(html) {
 const doc=document(html)
 const prune=(node,inherited=false)=>{
  node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((node.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,''))
  for(const child of node.children.filter(value=>typeof value!=='string'))prune(child,node.inactive)
 }
 prune(doc.root);return doc
}
export function verifyCorporate(html,{about=false}={}) {
 const doc=activeDocument(html),text=doc.text(doc.root)
 requireNative(text.includes('xto10x Technologies'),'Official xto10x employer identity missing')
 const careers=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Careers')
 requireNative(careers.length>0&&careers.every(n=>n.attrs.href===RECRUITING_EMAIL),'Active corporate careers destination changed')
 requireNative(!doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').some(n=>/JobPosting/.test(n.raw)),'New corporate JobPosting requires role-level review')
 if(about){
  requireNative(doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Join Us'&&n.attrs.href===RECRUITING_EMAIL).length>0,'Active corporate Join Us invitation missing')
  const next=JSON.parse(oneNative(doc.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__'),'Next data').raw)
  const body=next.props?.pageProps?.story?.content?.body
  requireNative(Array.isArray(body)&&body.length===5&&body.every(b=>['abouthero','beliefs','founders','team','offices'].includes(b.component)),'Unreviewed corporate body component')
  const team=oneNative(body.filter(b=>b.component==='team'),'corporate team')
  requireNative(team.joinUsLink?.linktype==='email'&&team.joinUsLink.email==='hungryforimpact@xto10x.com'&&team.joinLink?.length===1&&team.joinLink[0].link===RECRUITING_EMAIL,'Native corporate invitation destination changed')
  requireNative(doc.nodes(n=>n.tag==='h2'&&doc.text(n)===team.description).length>0,'Corporate generic invitation heading not active')
 }
 return {careersDestination:RECRUITING_EMAIL,firstParty:true,kind:'generic-email-invitation',specificJob:false}
}
export function verifyNativeEmployerPost(html,record,{now=()=>new Date().toISOString()}={}) {
 const envelope=JSON.parse(html),row=envelope.data
 const reviewedFields=new Set(['locations','location','otherLocation','address','latitude','longitude','createdTime','createdTimeMs','createdTimeNoMillis','hasExpired','jobStatusInfo'])
 const carrier=key=>/countr|locat|address|latitude|longitude|expir|valid.?through|closing|publish|posted/i.test(key)||!/candidate$/i.test(key)&&/date|(?:created|modified|updated)[_-]?(?:at|time)/i.test(key)
 requireNative(row&&Object.keys(row).every(key=>!carrier(key)||reviewedFields.has(key)),'Unreviewed native country/date/expiry carrier')
 requireNative(row?.id===record.id&&row.title?.trim()===record.title&&row.jobDetailUrl===record.url,'Native employer-posted job identity changed')
 requireNative(row.creatorDomainName==='xto10x.com'&&row.createdBy===340446&&row.companyData?.companyName==='xto10x'&&row.careerCompanyName==='xto10x'&&row.crawled===0,'Exact employer-authored primary posting proof changed')
 requireNative(row.status===1&&row.active===1&&row.applyStatus===1&&row.hasExpired===false&&row.permanentlyRemoved===false&&row.applyUrl==='','Native active application or expiry contract changed')
 const dates=['createdTime','createdTimeMs'].map(field=>{requireNative(Number.isSafeInteger(row[field])&&row[field]>0,'Native creation date invalid');return {field,value:row[field],parsed:nativeDate(new Date(row[field]).toISOString(),{required:true})}})
 const earliest=dates.reduce((a,b)=>a.value<b.value?a:b)
 requireNative(earliest.parsed.iso<=now(),'Native creation date is in the future')
 requireNative(row.createdTimeNoMillis===null&&row.jobStatusInfo===null,'Unreviewed native date/status metadata')
 requireNative(Array.isArray(row.locations)&&row.locations.length>0&&row.locations.every(l=>Object.keys(l).every(k=>['id','name'].includes(k))&&Number.isSafeInteger(l.id)&&typeof l.name==='string'),'Unreviewed native location shape')
 requireNative(JSON.stringify(row.locations)===JSON.stringify(row.location)&&row.address===null&&row.latitude===null&&row.longitude===null,'Unreviewed native country/address contract')
 requireNative(row.otherLocation===''&&row.state===1&&row.jobJdContent===null,'Unreviewed native location or description carrier')
 const explicitCountries=row.locations.map(l=>nativeLocationCountryName(l.name)).filter(Boolean)
 requireNative(explicitCountries.length===0,'Native post now supplies country; renewed eligibility review required')
 const cityScope=row.locations.every(l=>isNativeBareCityInPublicScope(l.name,{extraLabels:['delhi ncr']}))
 return {id:String(row.id),title:row.title.trim(),sourceURL:record.url,apiURL:apiURL(row.id),firstParty:false,employerAuthored:true,creatorDomainName:row.creatorDomainName,nativeEmployerName:row.companyData.companyName,nativeRecord:row,nativeDates:dates,nativeEarliestDate:earliest,explicitCountries,excluded:!cityScope,exclusionReason:cityScope?null:'outside-existing-public-city-scope',activeApplicationFlags:{status:row.status,active:row.active,applyStatus:row.applyStatus,hasExpired:row.hasExpired},sourceScopeComplete:false,lifecycleCleanupAllowed:false}
}
export async function collectNative({read,now,signal}) {
 const about=verifyCorporate(await read(ABOUT_URL),{about:true})
 const home=verifyCorporate(await read(HOME_URL))
 const employer=activeDocument(await read(EMPLOYER_URL))
 requireNative(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='xto10x').length===1&&employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:14628973').length===1,'Native exact employer identity changed')
 requireNative(employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{
  try{const link=new URL(n.attrs.href),target=new URL(link.searchParams.get('url'));return link.origin==='https://www.linkedin.com'&&link.pathname==='/redir/redirect'&&target.href===HOME_URL}catch{return false}
 }),'Native exact employer corporate website changed')
 const scopedSearches=[],independentDiscoveryGaps=[]
 const inspectIndependentSearches=async()=>{for(const [url,scope] of [[INDIA_URL,'India'],[WORLDWIDE_URL,'Worldwide']]){
  const listing=activeDocument(await read(url))
  requireNative(listing.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='14628973'&&Object.hasOwn(n.attrs,'checked')).length===1,'Native exact employer search facet changed')
  requireNative(listing.nodes(n=>n.tag==='h1'&&listing.text(n)==='We couldn’t find a match for Jobs jobs in '+scope).length===1&&listing.nodes(n=>listing.hasClass(n,'job-search-card')).length===0,'Native scoped search inventory changed; role-level enumeration required')
  scopedSearches.push({url,observedCards:0})
 }}
 const nativeCandidates=[]
 for(const record of NATIVE_POSTS)nativeCandidates.push(verifyNativeEmployerPost(await read(apiURL(record.id),{json:true}),record,{now}))
 const exclusions=nativeCandidates.filter(r=>r.excluded)
 const jobs=nativeCandidates.filter(r=>!r.excluded).map(fact=>{
  const row=fact.nativeRecord
  requireNative(row.introText==null||typeof row.introText==='string','Invalid native description')
  const raw=row.introText,core=typeof raw==='string'&&extractActiveDescription(raw.replace(/<(h[1-6]|strong|b)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,''))
  const key=value=>String(value||'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase()
  const sourceDescription=core&&key(core)!==key(fact.title)&&!/^(?:responsibilities|requirements)\s*[:.!]*$/i.test(core)?raw:null
  const locations=row.locations.map(l=>l.name)
  return {source:'xto10x',company:'XTO10X',title:fact.title,jobId:fact.id,requisitionId:null,
   sourceUrl:fact.sourceURL,applyUrl:fact.sourceURL,link:fact.sourceURL,country:null,
   locations,location:locations.join(', '),city:getValidIndiaCityForJob({country:null,location:locations[0]}),
   postingDate:fact.nativeEarliestDate.parsed.iso,postedAt:fact.nativeEarliestDate.parsed.iso,closingDate:null,
   nativeDates:fact.nativeDates,nativeEarliestDate:fact.nativeEarliestDate,
   sourceDescription,jobDescription:sourceDescription,sourceDetailComplete:sourceDescription!==null,sourceDetailStatus:sourceDescription===null?'missing-description':'complete',
   sourceListingComplete:false,sourceScopeComplete:false,sourceGeographyComplete:false,lifecycleCleanupAllowed:false}
 })
 try{await inspectIndependentSearches()}catch(error){if(signal?.aborted)throw signal.reason;independentDiscoveryGaps.push({reason:error.message})}
 return {jobs,inventoryStatus:'coverage-gap',firstParty:false,nativeRecordCount:nativeCandidates.length,nativeCandidates,exclusions,independentDiscoveryGaps,observations:{home,about,nativeEmployer:{url:EMPLOYER_URL,organizationID:'14628973',employerName:'xto10x',reciprocalCorporateWebsite:HOME_URL,corporateOutgoingHandoffProven:false},scopedSearches},reason:'Employer-authored native iimjobs records preserve earliest native creation dates without refresh. All native city labels must satisfy existing public policy; countries remain null. Corporate Careers/JoinUs are generic email invitations. '+(independentDiscoveryGaps.length?'Independent discovery unavailable: '+independentDiscoveryGaps.map(g=>g.reason).join('; '):'Scoped searches show no matches only.')+' No outgoing recruiting handoff or whole-company completeness proven; cleanup disabled.'}
}
