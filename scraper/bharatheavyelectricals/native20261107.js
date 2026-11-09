import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {failure} from './runtime20261107.js'
export const SOURCE='bharatheavyelectricals',HOME='https://www.bhel.com/',CAREERS_URL='https://careers.bhel.in/index.jsp'
const need=(ok,message)=>{if(!ok)throw failure('BHEL native '+message,'BHEL_NATIVE_PROOF')}
const descend=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...(node.children??[]).filter(n=>typeof n!=='string').flatMap(n=>descend(n,predicate))]
const sections=['Regular Recruitment','Recruitment of Consultants/Experts/Deputation','Recruitment of FTA/ Part-Time positions']
export function readHomepage(html){
 need(typeof html==='string','homepage body unavailable')
 const d=readVisibleNativeDocument(html,{strict:true}),titles=activeHead(html).titles,headings=d.nodes(n=>n.tag==='h3'&&d.text(n)==='Career with BHEL'),links=d.nodes(n=>n.tag==='a'&&/^(?:Working at BHEL|Current Job Openings)$/i.test(d.text(n))).map(n=>({text:d.text(n),href:n.attrs.href}))
 const cards=d.nodes(n=>n.tag==='div'&&(n.attrs.class??'').split(/\s+/).includes('function-item')&&descend(n,c=>c.tag==='h3'&&d.text(c)==='Career with BHEL').length>0),cardLinks=cards.flatMap(n=>descend(n,c=>c.tag==='a'&&/^(?:view details|Working in BHEL|Current Job Openings)$/i.test(d.text(c)))).map(n=>({text:d.text(n),href:n.attrs.href}))
 need(cards.length>=1&&new Set(cardLinks.map(n=>n.text.toLowerCase())).size===3&&cardLinks.every(n=>n.href===CAREERS_URL),'company careers card has an unqualified or conflicting target')
 need(titles.length===1&&/^Official Website of Bharat Heavy Electricals Limited, New Delhi, India\s*\|\s*$/.test(titles[0])&&headings.length>=1&&new Set(links.map(n=>n.text)).size===2&&links.every(n=>n.href===CAREERS_URL),'official homepage company or careers handoff changed')
 return{nativePublisher:'Bharat Heavy Electricals Limited',titles,careersURL:CAREERS_URL,links,cardLinks,qualificationIsVacancyProof:false}
}
export const hasOfficialHomepageSignal=html=>{try{readHomepage(html);return true}catch{return false}}
export const extractHomepageCareersUrl=html=>{try{return readHomepage(html).careersURL}catch{return null}}
function linkFor(n,d){
 const nativeHref=n.attrs.href??null,text=d.text(n);let url=null
 try{if(typeof nativeHref==='string'&&nativeHref.length<=4096&&!/[\u0000-\u001f\u007f]/.test(nativeHref)){const u=new URL(nativeHref,CAREERS_URL);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port)url=u.href}}catch{}
 const requiresAccount=!!url&&/(?:\/|\b)(?:login|signin|sign-in|account)(?:[./?]|\b)/i.test(url),purpose=/Corrigendum|Addendum/i.test(text)?'correction':/Break-up|Breakup|vacanc/i.test(text)?'vacancy-table':/^Detailed Advertisement$/i.test(text)?'primary-advertisement':/^(?:Advertisement|Advt\.?|Detailed Ad\.?)$/i.test(text)?'advertisement':/\bapply\s*online\b|^login$/i.test(text)?'application':'other'
 return{nativeHref,text,url,purpose,requiresAccount,admitted:false}
}
function eventDates(text,observedAt){
 const results=[]
 for(const m of text.matchAll(/(?:Walk[- ]in Interview|interview)[\s\S]{0,35}?\bheld on\s+(\d{2})\.(\d{2})\.(\d{4})/gi)){
  const year=Number(m[3]),month=Number(m[2]),day=Number(m[1]),at=Date.UTC(year,month-1,day),d=new Date(at)
  if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)continue
  results.push({kind:'walk-in-interview',nativeText:m[0],date:d.toISOString().slice(0,10),state:typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt))&&Date.parse(observedAt)>at+86400000?'past-event':'unverified-event-state',isPublicationOrClosingDate:false})
 }
 return results
}
export function readAnnouncements(html,observedAt=null){
 need(typeof html==='string','careers body unavailable')
 const d=readVisibleNativeDocument(html,{strict:true}),scopes=d.nodes(n=>n.attrs.id==='openings'),portals=d.nodes(n=>(n.tag==='button'||/^h[1-6]$/.test(n.tag))&&d.text(n)==='BHEL Careers Portal'),headings=d.nodes(n=>n.tag==='h2'&&/^Current Openings\s*\(/.test(d.text(n)))
 need(scopes.length===1&&portals.length>=1&&headings.length===1,'public careers portal or Current Openings scope changed')
 let section=null,current=null;const rows=[],unresolvedRows=[],seenSections=[]
 function visit(node){
  if(typeof node==='string'){if(current)current.nativeTextTokens.push(node);return}
  if(node.inert)return
  if(node.tag==='span'&&(node.attrs.class??'').split(/\s+/).includes('lrgblb')){section=d.text(node);seenSections.push(section);current=null;return}
  if(node.tag==='img'&&node.attrs.src==='arrow3.gif'){current={observationOrdinal:rows.length+1,section,title:null,links:[],nativeTextTokens:[]};rows.push(current);return}
  if(current&&node.tag==='b'&&!current.title)current.title=d.text(node)||null
  if(current&&node.tag==='a')current.links.push(linkFor(node,d))
  for(const child of node.children??[])visit(child)
 }
 visit(scopes[0]);need(rows.length>0,'native announcement markers unavailable')
 need(seenSections.length===sections.length&&seenSections.every((v,i)=>v===sections[i]),'native recruitment section vocabulary changed')
 const duplicateRepresentations=[],seen=new Map()
 for(const row of rows){
  row.nativeNoticeText=d.text({tag:'span',children:row.nativeTextTokens,inert:false});delete row.nativeTextTokens
  Object.assign(row,{nativeRecordKind:'recruitment-announcement',nativeVacancyId:null,requisitionId:null,country:null,city:null,jobDescription:null,postingDate:null,closingDate:null,sourceUrl:CAREERS_URL,sourceDetailComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeIdentityUnresolved:true,nativeEventDateFacts:eventDates(row.nativeNoticeText,observedAt)})
  row.applicationLinks=row.links.filter(l=>l.purpose==='application')
  const details=row.links.filter(l=>l.purpose==='primary-advertisement'||l.purpose==='advertisement'),primary=details.filter(l=>l.purpose==='primary-advertisement'),candidates=primary.length?primary:details
  row.nativeDetailCandidates=candidates
  row.nativeDetailURL=null
  if(candidates.length===1&&candidates[0].url&&!candidates[0].requiresAccount){const u=new URL(candidates[0].url);if(u.origin==='https://careers.bhel.in'&&!u.search&&!u.hash&&/^\/(?:ar_\d{4}|static)\/[^/]+\.pdf$/i.test(u.pathname)){row.nativeDetailURL=u.href;candidates[0].admitted=true}}
  if(!row.title||!row.nativeNoticeText)unresolvedRows.push({observationOrdinal:row.observationOrdinal,nativeNoticeText:row.nativeNoticeText,links:row.links,reason:'native-announcement-title-or-text-unresolved'})
  const identity=JSON.stringify([row.section,row.title,row.links.map(l=>l.nativeHref)])
  if(seen.has(identity)){row.duplicateOfObservationOrdinal=seen.get(identity);duplicateRepresentations.push({...row})}else seen.set(identity,row.observationOrdinal)
 }
 return{nativeDocumentKind:'recruitment-announcement-index',seenSections,observedAnnouncements:rows,withheldNativeFacts:[...rows],unresolvedRows,duplicateRepresentations,originalNativeNoticeCount:rows.length}
}
export const hasOfficialCareersSignal=html=>{try{readAnnouncements(html);return true}catch{return false}}
export const observation=analysis=>({source:SOURCE,recordKind:'mixed',observedRecordCount:analysis.observedAnnouncements.length,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
export function attachAnnouncementEvidence(jobs,audit,inventory){attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});return attachInventoryEvidence(jobs,inventory)}
export function extractJobsFromCareersPage(html,observedAt=new Date().toISOString()){
 const analysis=readAnnouncements(html,observedAt),audit={...observation(analysis),...analysis,status:'partial',wholeCompanyScope:false,lifecycleCleanupAllowed:false,retainedNativeResponses:[],attempts:[],reason:'native-announcements-await-original-role-identity-country-active-publication-and-content'}
 return attachAnnouncementEvidence([],audit,{status:'coverage-gap',surface:CAREERS_URL,firstParty:false,listingComplete:false,pagesFetched:0,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:audit.reason})
}
