import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
export const HOME='https://cyraacs.com/careers/',COMPANY='CYRAAC Services Private Limited'
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error('CYRAACS native: '+message),{code:'CYRAAC_NATIVE_PROOF',abortRetries:true})}
export const hash=value=>createHash('sha256').update(value).digest('hex')
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()||null
const titleKey=value=>clean(value)?.replace(/[\u2010-\u2015]/g,'-').replace(/\s*-\s*/g,'-')
const employer=value=>['CYRAAC Services Private Limited','CyRAACS'].some(name=>clean(value)?.toLowerCase()===name.toLowerCase())
export function extractJobCards(html){
 const d=readNativeDocument(html),jobs=[]
 const text=node=>typeof node==='string'?decodeHTML(node):node.inert||node.tag==='script'?'':node.children.map(text).join(' ')
 let department=null,heading=null,parts=[]
 const visit=node=>{
  if(typeof node==='string'){if(heading)parts.push(decodeHTML(node));return}
  if(node.inert||node.tag==='script')return
  if(node.tag==='h2'){department=clean(text(node));heading=null;parts=[];return}
  if(/^h[3-6]$/.test(node.tag)){heading={tag:node.tag,attrs:structuredClone(node.attrs),text:clean(text(node))};parts=[];return}
  if(node.tag==='a'&&clean(text(node))==='VIEW JOB DETAIL'){
   const url=new URL(node.attrs.href,HOME)
   if(url.origin==='https://cyraacs.com'&&url.pathname.replace(/\/$/,'')==='/careers')return
   need(url.origin==='https://cyraacs.com'&&!url.search&&!url.hash&&!url.username&&!url.password
    &&/^\/(?:job-description\/)?[a-z0-9-]+\/$/.test(url.pathname),'unreviewed declared role URL')
   if(!heading?.text)return
   const title=heading.text,details=clean(parts.join(' ')),experienceRequired=details?.match(/Experience:\s*(.*?)(?=\s+Location:|$)/i)?.[1]?.trim()||null
   const locationLabel=details?.match(/Location:\s*(.*)$/i)?.[1]?.trim()||null,jobId=url.pathname.split('/').filter(Boolean).at(-1)
   const nativeListing={title,department,experienceRequired,locationLabel,sourceURL:url.href,visibleCardText:details,
    heading:structuredClone(heading),link:{attrs:structuredClone(node.attrs),text:clean(text(node))}}
   jobs.push({title,department,experienceRequired,jobDescription:/Experience:/i.test(details||'')?null:details,
    location:null,city:null,sourceUrl:url.href,applyUrl:null,jobId,requisitionId:null,sourceNativeListingRecord:nativeListing})
   heading=null;parts=[];return
  }
  node.children.forEach(visit)
 }
 visit(d.nodes(n=>n.tag==='root')[0])
 // Keep duplicates visible to the collection validator; the last card cannot
 // silently erase a contradictory earlier observation of the same opening.
 return jobs
}
export function extractJobDescription(html){
 const d=readNativeDocument(html),root=d.nodes(n=>n.tag==='root')[0]
 return root?d.text(root)||null:null
}
const allSchemas=doc=>{
 const schemas=[],errors=[]
 for(const node of doc.nodes(n=>n.tag==='script'&&n.attrs.type?.toLowerCase()==='application/ld+json')){
  try{schemas.push(JSON.parse(node.raw))}catch{errors.push('invalid-own-JSON-LD')}
 }
 const postings=[],queue=[...schemas];let count=0
 while(queue.length){need(++count<=50000,'native schema bound');const node=queue.pop()
  if(!node||typeof node!=='object')continue
  if((Array.isArray(node['@type'])?node['@type']:[node['@type']]).includes('JobPosting'))postings.push(node)
  queue.push(...Object.values(node).filter(v=>v&&typeof v==='object'))
 }
 return {schemas,postings,errors}
}
export function readNativeRole(listing,html,clock){
 const d=readNativeDocument(html),heads=d.nodes(n=>/^h[1-6]$/.test(n.tag)&&titleKey(d.text(n))===titleKey(listing.title))
 need(heads.length>0&&!d.nodes(n=>n.tag==='base').length,'own visible title/base changed')
 const {schemas,postings,errors}=allSchemas(d)
 const candidates=postings.filter(p=>titleKey(p.title)===titleKey(listing.title)).map(p=>{
  const identities=[p.url,p['@id']].filter(value=>value!=null)
  const matches=identities.map(value=>{
   if(typeof value!=='string')return false
   try{const url=new URL(value,listing.sourceUrl);url.hash='';return url.href===listing.sourceUrl}catch{return false}
  })
  return {posting:p,matches}
 }).filter(candidate=>candidate.matches.some(Boolean))
 // A contradictory identity remains relevant when another explicit identity
 // points to this role. Filtering it out would let a second schema win silently.
 need(candidates.length<=1,'ambiguous own native JobPosting')
 const own=candidates.filter(candidate=>candidate.matches.every(Boolean)).map(candidate=>candidate.posting)
 const schema=own[0]||null
 if(schema){const org=schema.hiringOrganization;need(org&&employer(org.name)&&(!org.legalName||employer(org.legalName)),'own native employer conflicts')}
 const places=schema?.jobLocation==null?[]:Array.isArray(schema.jobLocation)?schema.jobLocation:[schema.jobLocation]
 const addresses=places.map(p=>p?.['@type']==='Place'&&p.address?.['@type']==='PostalAddress'?p.address:null)
 const countries=addresses.map(address=>{
  const value=address?.addressCountry
  if(value&&typeof value==='object')return value['@type']==='Country'&&Object.keys(value).every(k=>['@type','name'].includes(k))?nativeCountryName(value.name):null
  return typeof value==='string'?nativeCountryName(value):null
 })
 const resolved=errors.length===0&&addresses.length>0&&countries.every(Boolean)
 const country=resolved?(countries.includes('India')?'India':new Set(countries).size===1?countries[0]:null):null
 const locations=country?addresses.map((a,i)=>({location:[a.addressLocality,a.addressRegion,countries[i]].filter(Boolean).join(', '),country:countries[i]})):[]
 const ownAddresses=country?addresses.filter((a,i)=>countries[i]===country):[]
 const cities=[...new Set(ownAddresses.map(a=>clean(a.addressLocality)).filter(Boolean))],states=[...new Set(ownAddresses.map(a=>clean(a.addressRegion)).filter(Boolean))]
 const posted=nativeDate(schema?.datePosted),expiry=nativeDate(schema?.validThrough)
 need(!posted.iso||Date.parse(posted.iso)<=Date.parse(clock),'future native publication')
 need(!expiry.iso||Date.parse(expiry.iso)>=Date.parse(clock),'own native role expired')
 const identifier=schema?.identifier,value=typeof identifier==='string'?identifier:identifier?.['@type']==='PropertyValue'?identifier.value:null
 const requisitionId=typeof value==='string'&&value.trim()?value.trim():null
 const applications=d.nodes(n=>n.tag==='a'&&/^(?:Apply(?: Now| for this job)?|Submit Resume)$/i.test(d.text(n))).map(n=>n.attrs.href)
 const declared=[...new Set(applications.filter(Boolean).map(value=>new URL(value,listing.sourceUrl).href))].filter(value=>/^https:\/\//.test(value))
 const description=extractJobDescription(html);need(description?.length>=30,'own native content unavailable')
 const model={listing:structuredClone(listing.sourceNativeListingRecord),schemas:structuredClone(schemas),jobPostings:structuredClone(own),
  ownRoleText:description,applicationReferences:declared}
 return {...listing,company:COMPANY,source:'cyraac',country,city:country&&cities.length===1?cities[0]:null,state:country&&states.length===1?states[0]:null,
  location:country?locations.map(p=>p.location).join('; '):null,locations,sourceCountryScopeUnresolved:!country,
  countryEvidence:country?{field:'own JobPosting.jobLocation.address.addressCountry',values:addresses.map(a=>a.addressCountry),url:listing.sourceUrl}:null,
  nativeCountryAddresses:structuredClone(addresses),sourceNativeLocationEvidence:{listingLabel:listing.sourceNativeListingRecord.locationLabel,addresses:structuredClone(addresses)},
  requisitionId,postingDate:schema?.datePosted??null,postedAt:schema?.datePosted??null,sourceDatePrecision:posted.precision,
  closingDate:schema?.validThrough??null,firstEverPublication:null,legalEmployer:null,nativeHiringOrganization:schema?structuredClone(schema.hiringOrganization):null,
  applyUrl:declared.length===1?declared[0]:null,link:declared.length===1?declared[0]:listing.sourceUrl,
  jobDescription:description,sourceDescription:description,nativeSourceRecord:model,sourceRawNativeHTML:html,sourceRawNativeHTMLSHA256:hash(html),
  sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:country?'native-criteria-container-unverified':'native-country-unproven',
  sourceNativeProofGaps:[...(!country?['native-role-country-unproven']:[]),'native-whole-criteria-container-unverified'],
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeRoleClosingReconciled:false,
  applicationVisited:false,activeApplyVerified:false,employmentType:typeof schema?.employmentType==='string'?schema.employmentType:null,scrapedAt:clock}
}
