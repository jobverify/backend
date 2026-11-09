import {activeHead,readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {failure} from './runtime20261107.js'
export const SOURCE='doppio',COMPANY='Doppio',HOMEPAGE_URL='https://www.doppio-espresso.nl/',CAREERS_PAGE_URL='https://www.doppio-espresso.nl/werken-bij-doppio/',VACANCIES_PAGE_URL='https://www.doppio-espresso.nl/category/vacatures/',VACANCY_CATEGORY_API_URL='https://www.doppio-espresso.nl/wp-json/wp/v2/categories?slug=vacatures&_fields=id,name,slug,count'
export const need=(ok,message)=>{if(!ok)throw failure('Doppio native '+message,'DOPPIO_NATIVE_PROOF')}
export const buildVacancyPostsApiUrl=id=>{need(Number.isSafeInteger(id)&&id>0,'post category identity unavailable');return `https://www.doppio-espresso.nl/wp-json/wp/v2/posts?categories=${id}&per_page=20&_fields=id,date,date_gmt,link,title,content,status,categories`}
export const extractVacancyCategoryId=rows=>{need(Array.isArray(rows),'category payload must be an array');const found=rows.filter(r=>r?.slug==='vacatures');need(found.length===1&&Number.isSafeInteger(found[0].id)&&found[0].id>0,'vacatures category unavailable or ambiguous');return found[0].id}
export const emptyAnalysis=()=>({publishedPosts:[],hiringSignals:[],unresolvedRecords:[],duplicateRepresentations:[]})
export const facts=a=>[...a.publishedPosts,...a.hiringSignals,...a.unresolvedRecords]
export const summary=a=>({source:SOURCE,recordKind:a.unresolvedRecords.length?'mixed':'hiring-signals',observedRecordCount:facts(a).length,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
export function attach(jobs,audit,inventory){attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});return attachInventoryEvidence(jobs,inventory)}
const unknown={jobId:null,requisitionId:null,country:null,city:null,location:null,postingDate:null,applyUrl:null,sourceDetailComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
function publishedAt(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value))return null;const d=new Date(value+'Z');return Number.isFinite(+d)&&d.toISOString().slice(0,19)===value?d.toISOString():null}
function postURL(value){try{const u=new URL(value);return u.origin===HOMEPAGE_URL.slice(0,-1)&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&u.pathname!=='/'?u.href:null}catch{return null}}
export function readPublishedPosts(rows){
 need(Array.isArray(rows)&&rows.length<=10000,'post payload must be a bounded array')
 const a=emptyAnalysis(),seen=new Map()
 for(const [index,r]of rows.entries()){
  const title=typeof r?.title?.rendered==='string'?extractActiveDescription(r.title.rendered):null,url=postURL(r?.link),content=typeof r?.content?.rendered==='string'?r.content.rendered:null,text=content===null?null:extractActiveDescription(content)
  if(r?.status!=='publish'||!Number.isSafeInteger(r?.id)||r.id<=0||!title||!url||!text||r.content.protected===true){a.unresolvedRecords.push({nativeRecordKind:'unresolved-post',observationOrdinal:index+1,rawNativePost:structuredClone(r),reason:'published-post-identity-or-content-unverified',...unknown});continue}
  const p={nativeRecordKind:'recruitment-post',observationOrdinal:index+1,nativePostId:String(r.id),nativeTitle:title,nativeStatus:r.status,nativeCategories:structuredClone(r.categories??null),nativeContentHTML:content,fullAvailableNativeText:text,nativePublishedAt:publishedAt(r.date_gmt),nativeLocalPublicationValue:r.date??null,sourceUrl:url,rawNativePost:structuredClone(r),activeRolePublicationQualified:false,...unknown}
  if(seen.has(p.nativePostId)){p.duplicateOfObservationOrdinal=seen.get(p.nativePostId);a.duplicateRepresentations.push({...p})}else seen.set(p.nativePostId,p.observationOrdinal)
  a.publishedPosts.push(p)
 }
 return a
}
export function extractVacancyPosts(rows){const a=readPublishedPosts(rows),reason='native-blog-posts-await-own-role-identity-country-and-active-publication';return attach([],{...summary(a),...a,status:'partial',reason,wholeCompanyScope:false,lifecycleCleanupAllowed:false,retainedNativeResponses:[],attempts:[]},{status:'coverage-gap',surface:VACANCIES_PAGE_URL,listingComplete:false,reportedTotal:null,indiaFacetCount:null,firstParty:false,verifiedAt:null,reason})}
export function readHomepage(html){
 need(typeof html==='string','homepage body unavailable')
 const visible=readVisibleNativeDocument(html),active=readNativeDocument(html),headings=visible.nodes(n=>n.tag==='h2'&&visible.text(n)==='Jouw toekomst begint bij Doppio Espresso'),links=active.nodes(n=>n.tag==='a'&&/^Werken bij(?: Doppio)?$/i.test(active.text(n))).map(n=>({text:active.text(n),nativeHref:n.attrs.href}))
 need(headings.length===1&&links.length>=1&&links.every(l=>l.nativeHref===CAREERS_PAGE_URL),'company identity or native careers navigation changed')
 return{nativePublisher:'Doppio Espresso',nativeHeading:visible.text(headings[0]),links,careersURL:CAREERS_PAGE_URL,qualification:'publisher-declared-navigation; no vacancy or country proof',nativeDocumentTitles:activeHead(html).titles}
}
export function readCurrentIntake(html){
 need(typeof html==='string','careers body unavailable')
 const d=readVisibleNativeDocument(html),titles=activeHead(html).titles,headings=d.nodes(n=>n.tag==='h1'),body=d.nodes(n=>n.tag==='body')[0],text=body?d.text(body):'',applications=d.nodes(n=>n.tag==='a'&&/^Solliciteer hier!$/i.test(d.text(n))),otherInventory=d.nodes(n=>n.tag==='a'&&/\bvacatures?\b|\bjobs?\b/i.test(d.text(n))),native=readNativeDocument(html)
 need(titles.length===1&&titles[0]==='Werken bij Doppio'&&headings.length===1&&d.text(headings[0])==='werken bij doppio'&&text.includes('Waarom werken bij Doppio?')&&text.includes('Join our team!'),'current careers intake identity changed')
 need(applications.length===1&&!otherInventory.length&&!native.nodes(n=>n.attrs['data-job-id']!==undefined).length,'intake declaration or inventory scope changed')
 for(const n of native.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')){let value;try{value=JSON.parse(n.raw)}catch{need(false,'structured publication data unqualified')}need(!JSON.stringify(value).includes('JobPosting'),'new native role publication requires reconciliation')}
 const nativeHref=applications[0].attrs.href;let u;try{u=new URL(nativeHref)}catch{need(false,'application declaration unavailable')}
 need(u.protocol==='https:'&&u.hostname==='forms.office.com'&&!u.port&&!u.username&&!u.password&&u.pathname==='/Pages/ResponsePage.aspx'&&!u.hash&&[...u.searchParams.keys()].length===1&&u.searchParams.getAll('id').length===1&&u.searchParams.get('id')==='hVulte-VLkeMinvXB03-3PZ7dIYG4GREi_p5Gd6wirNUNUpUT0FVVVZFM1dSMTRJMUpBNjBNOEtXUC4u','application intake declaration changed')
 const signal={nativeRecordKind:'open-application-intake',sourceUrl:CAREERS_PAGE_URL,nativeTitle:d.text(headings[0]),fullAvailableNativeText:text,nativeIntakeURL:nativeHref,intakeFormFollowed:false,activeRolePublicationQualified:false,...unknown}
 return{...emptyAnalysis(),hiringSignals:[signal],nativeCareersTitles:titles}
}
