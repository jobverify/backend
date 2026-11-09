import {createHash} from 'node:crypto'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {createBoundedPublicCareerTransport} from '../../scraper-support/utils/boundedPublicCareerTransport.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const CAREERS='https://www.frugaltesting.com/careers',APPLICATION='https://www.frugaltesting.com/apply-to-frugal-testing'
const source='frugaltesting',origin=new URL(CAREERS).origin
const need=(value,message)=>{if(!value)throw Error('Frugal Testing native: '+message)}
const one=(rows,label)=>{need(rows.length===1,'missing or ambiguous '+label);return rows[0]}
const roleURL=value=>{try{const u=new URL(value,CAREERS);return u.origin===origin&&!u.search&&!u.hash&&/^\/job-openings\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(u.pathname)?u.href:null}catch{return null}}
function canonical(doc,url){need(one(doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical')),'native canonical').attrs.href===url,'native canonical role disagreement')}
export function frugalListing(html){
 const doc=readNativeDocument(html);canonical(doc,CAREERS)
 need(doc.nodes(n=>/^h[123]$/.test(n.tag)&&/^(?:Careers(?: at Frugal)?|Accelerate Your Career with Frugal Testing)$/.test(doc.text(n))).length>0,'active careers heading unavailable')
 const urls=[...new Set(doc.nodes(n=>n.tag==='a'&&roleURL(n.attrs.href)).map(n=>roleURL(n.attrs.href)))]
 need(urls.length>0&&urls.length<=100,'published role links unavailable or bounded listing exceeded')
 return urls
}
export function frugalRole(url,html){
 need(roleURL(url)===url,'unexpected native detail route')
 const doc=readNativeDocument(html);canonical(doc,url)
 need(activeHead(html).titles.length===1,'native page title unavailable')
 const title=doc.text(one(doc.nodes(n=>n.tag==='h2'&&doc.hasClass(n,'uui-heading-medium-9')),'native role title'))
 const details=doc.nodes(n=>doc.hasClass(n,'uui-career05_detail-wrapper')).map(doc.text)
 need(details.length===3&&details.every(Boolean),'native workplace, employment or experience fields unavailable')
 const department=doc.text(one(doc.nodes(n=>doc.hasClass(n,'text-block-92')),'native department'))
 const intro=doc.text(one(doc.nodes(n=>doc.hasClass(n,'uui-text-size-large-10')),'native role introduction'))
 const headings=['About the Company','Roles and Responsibilities','Qualifications']
 const sections=[],containers=new Set()
 for(const heading of headings){
  const matches=doc.nodes(n=>n.tag==='section'&&doc.nodes(child=>/^h[123]$/.test(child.tag)&&doc.text(child)===heading,n).length===1)
  const section=one(matches,'full native '+heading)
  const text=doc.text(section);need(text.length>heading.length+40,'native criteria missing for '+heading)
  if(!containers.has(section)){sections.push(text);containers.add(section)}
 }
 need(/\bFrugal Testing\b/.test(sections[0]),'own native employer declaration unavailable')
 const apply=doc.nodes(n=>{if(n.tag!=='a'||!n.attrs.href)return false;try{return new URL(n.attrs.href,url).href===APPLICATION}catch{return false}})
 need(apply.length>0,'published native application handoff unavailable')
 const workplace=details[0],parts=workplace.split(/,\s*/),suffix=parts.at(-1)
 const countries=[...new Set(parts.filter(p=>p.length>3).map(nativeCountryName).filter(Boolean))]
 need(countries.length<=1,'contradictory native workplace countries')
 const country=suffix.length>3?nativeCountryName(suffix)||null:null,location=country?workplace:null
 const description=[intro,...sections].join('\n\n'),id=new URL(url).pathname.split('/').at(-1)
 return {source,title,company:'Frugal Testing',nativeEmployer:'Frugal Testing',nativeLegalEmployer:null,
  department,location,city:null,state:null,country,sourceCountryScopeUnresolved:!country,jobId:id,requisitionId:null,
  sourceUrl:url,applyUrl:APPLICATION,link:url,applicationVisited:false,
  employmentType:details[1],experienceRequired:details[2],remoteStatus:null,
  postingDate:null,closingDate:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
  jobDescription:description,sourceDescription:description,sourceDetailComplete:true,publicExperienceChecked:true,
  nativeSourceRecord:{projectionKind:'original-first-party-HTML-fields',canonical:url,title,department,intro,
   workplace:details[0],employmentType:details[1],experience:details[2],descriptionSections:sections},
  sourceRawNativeHTML:html,sourceRawNativeHTMLSHA256:createHash('sha256').update(html).digest('hex'),
  nativeWorkplace:details[0],sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
  companyCareerPage:CAREERS,companyDomain:'frugaltesting.com',atsPlatform:'official-first-party-job-openings'}
}
export async function runFrugalNative(options={}){
 options.signal?.throwIfAborted()
 const jobs=[],failures=[],cap=options.maxJobs,observedAt=new Date((options.now||(()=>new Date().toISOString()))()).toISOString()
 need(cap==null||Number.isSafeInteger(cap)&&cap>=0,'invalid caller cap')
 let pages=0
 const finish=()=>{
  const observation={source,firstPartyConfirmed:pages>0,nativePostings:jobs.length,closedNativeDetails:jobs.filter(j=>j.sourceClosingQualified).length,
   failures,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
   nativeInventoryReads:pages?[{kind:'first-party-role-html',pagesFetched:pages,reportedTotal:null,usable:true}]:[],
   unresolved:[...(jobs.some(j=>!j.country)?['native-country-unproven']:[]),...(failures.length?['closing-native-context-unqualified']:[]),'company-recruitment-scope-unverified']}
  Object.defineProperty(jobs,Symbol.for('jobverify.verified-recruitment-observations'),{value:observation})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:pages>0,pagesFetched:pages,
   listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
   reason:'full-first-party-criteria-retained;own-country-required;company-scope-unverified'})
 }
 if(cap===0)return finish()
 const io=createBoundedPublicCareerTransport({...options,source,allowedURL:(value,method)=>method==='GET'&&(value===CAREERS||roleURL(value)===value)})
 const load=async url=>{const html=await io.fetchText(url,{cache:'no-store'});pages++;return html}
 try{
  const urls=frugalListing(await load(CAREERS)),selected=cap==null?urls:urls.slice(0,cap)
  for(const url of selected){
   try{jobs.push({...frugalRole(url,await load(url)),sourceClosingQualified:false,scrapedAt:observedAt})}
   catch(error){io.signal.throwIfAborted();failures.push({url,message:error.message,status:error.status??null});if(error.publicReadFailure)return finish()}
  }
  const closing=frugalListing(await load(CAREERS));need(JSON.stringify(urls)===JSON.stringify(closing),'native closing inventory changed')
  for(const job of jobs){
   try{const current=frugalRole(job.sourceUrl,await load(job.sourceUrl));need(JSON.stringify(current.nativeSourceRecord)===JSON.stringify(job.nativeSourceRecord),'native closing role changed');job.sourceClosingQualified=true}
   catch(error){io.signal.throwIfAborted();failures.push({url:job.sourceUrl,message:error.message,status:error.status??null});if(error.publicReadFailure)return finish()}
  }
  return finish()
 }catch(error){io.signal.throwIfAborted();failures.push({message:error.message,status:error.status??null});return finish()}
 finally{io.close()}
}
