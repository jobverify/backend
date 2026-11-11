import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {readNativeDocument,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {parseEightfoldJson as parseHeaderJSON} from '../../scraper-support/utils/recruitmentEightfoldData.js'
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
// One reviewed own-page profile. This is literal work-country evidence only;
// neither the listing city nor a corporate address supplies the country.
const headerURL='https://cyraacs.com/job-description-technical-architect/'
const ownHeaderCountry=(listing,html,doc,{postings,errors})=>{
 if(listing.sourceUrl!==headerURL||listing.title!=='Technical Architect'
  ||listing.sourceNativeListingRecord.sourceURL!==headerURL||postings.length||errors.length)return null
 try{
  const root=doc.nodes(n=>n.tag==='root')[0],entries=[]
  const walk=(node,ancestors,path)=>{
   entries.push({node,ancestors,path})
   node.children.forEach((child,index)=>{if(typeof child!=='string')walk(child,[...ancestors,node],[...path,index])})
  }
  walk(root,[],[])
  const visible=readVisibleNativeDocument(html,{strict:true}),visibleRoot=visible.nodes(n=>n.tag==='root')[0]
  const active=entry=>{
   if(!entry||[...entry.ancestors,entry.node].some(n=>n.inert||n.nativeTagUnqualified||['svg','math','template','object','noscript'].includes(n.tag)))return false
   let current=visibleRoot
   for(const index of entry.path){current=current?.children[index];if(!current||typeof current==='string'||current.inert)return false}
   return !!current&&!current.inert
  }
  const exact=(node,tag,attrs)=>node?.tag===tag&&canonical(node.attrs)===canonical(attrs)
  const titles=entries.filter(e=>e.node.tag==='title')
  if(titles.length!==1||!active(titles[0])||titles[0].node.raw!==listing.title
   ||!exact(titles[0].node,'title',{})||!titles[0].ancestors.some(n=>n.tag==='head'))return null
  const heads=entries.filter(e=>e.node.tag==='h1'),headers=entries.filter(e=>doc.hasClass(e.node,'elementor-icon-list-text'))
  if(heads.length!==1||headers.length!==1)return null
  const head=heads[0],header=headers[0],common=head.ancestors.at(-2),titleWidget=head.ancestors.at(-1)
  const [metadataWidget,ul,li]=header.ancestors.slice(-3)
  const children=node=>node.children.filter(child=>typeof child!=='string')
  const originalText='Bangalor/ India/Full-time',rawHTML='<span class="elementor-icon-list-text">'+originalText+'</span>'
  if(!active(head)||!active(header)||!exact(head.node,'h1',{class:'elementor-heading-title elementor-size-default'})
   ||head.node.children.length!==1||head.node.children[0]!==listing.title
   ||!exact(header.node,'span',{class:'elementor-icon-list-text'})||header.node.children.length!==1||header.node.children[0]!==originalText
   ||html.split(rawHTML).length!==2||common!==header.ancestors.at(-4)||common?.attrs['data-id']!=='db49edc'
   ||titleWidget?.attrs['data-id']!=='1762ef2'||metadataWidget?.attrs['data-id']!=='e65d7a6'
   ||!exact(ul,'ul',{class:'elementor-icon-list-items'})||!exact(li,'li',{class:'elementor-icon-list-item'})
   ||canonical(children(common))!==canonical([titleWidget,metadataWidget])||children(titleWidget).length!==1
   ||children(metadataWidget).length!==1||children(ul).length!==1||children(li).at(-1)!==header.node
   ||doc.text(common)!=='Technical Architect '+originalText
   ||head.ancestors.filter(n=>n.attrs['data-elementor-id']==='18600'&&n.attrs['data-elementor-type']==='wp-page').length!==1)return null
  const canonicals=entries.filter(e=>e.node.tag==='link'&&(e.node.attrs.rel||'').toLowerCase().split(/\s+/).includes('canonical'))
  if(canonicals.length!==1||!active(canonicals[0])||canonicals[0].node.attrs.href!==headerURL
   ||!canonicals[0].ancestors.some(n=>n.tag==='head'))return null
  // Count hidden/foreign carriers too: their presence cannot establish schema
  // absence. The duplicate-aware pure parser leaves the legacy schema path alone.
  const carriers=entries.filter(e=>e.node.tag==='script'&&e.node.attrs.type?.toLowerCase()==='application/ld+json')
  if(entries.some(({node})=>['noscript','textarea','xmp','iframe','noembed','noframes','plaintext'].includes(node.tag)
   &&/(?:application\/ld\+json|JobPosting|elementor-icon-list-text|<h1\b)/i.test(node.raw||'')))return null
  if(carriers.length!==1||!active(carriers[0])||Object.hasOwn(carriers[0].node.attrs,'src'))return null
  const schema=parseHeaderJSON(carriers[0].node.raw),models=[],queue=[schema]
  while(queue.length){if(models.length>=50000)return null;const value=queue.pop();if(!value||typeof value!=='object')continue
   models.push(value);queue.push(...Object.values(value).filter(v=>v&&typeof v==='object'))}
  const type=(value,name)=>(Array.isArray(value['@type'])?value['@type']:[value['@type']]).includes(name)
  if(models.some(value=>type(value,'JobPosting')))return null
  const pages=models.filter(value=>type(value,'WebPage')),sites=models.filter(value=>type(value,'WebSite'))
  const publisherName='CyRAACS - Your Trusted Partner in Cybersecurity Excellence'
  const publishers=models.filter(value=>type(value,'Organization'))
  if(pages.length!==1||pages[0].url!==headerURL||pages[0].name!==listing.title
   ||sites.length!==1||sites[0].url!=='https://cyraacs.com'||sites[0].name!==publisherName
   ||sites[0]['@id']!==pages[0].isPartOf?.['@id']||publishers.length!==1
   ||publishers[0]['@id']!==sites[0].publisher?.['@id']||publishers[0].name!==publisherName)return null
  const criteria=entries.filter(e=>e.node.attrs['data-id']==='0b45422')
  const dom=node=>({tag:node.tag,attributes:structuredClone(node.attrs),...(Object.hasOwn(node,'raw')?{raw:node.raw}:{}),children:node.children.map(child=>typeof child==='string'?child:dom(child))})
  if(criteria.length!==1||!active(criteria[0])||!criteria[0].ancestors.some(n=>head.ancestors.includes(n)&&n.attrs['data-elementor-id']==='18600'))return null
  // This static partial-country profile covers exactly the reviewed authored
  // context. New criteria/work metadata holds; no country-word inference or
  // claim of a complete isolated JD follows from these comparison-only hashes.
  const criteriaDOM=dom(criteria[0].node),criteriaDOMSHA256=hash(canonical(criteriaDOM)),wholeOwnTextSHA256=hash(doc.text(root))
  if(criteriaDOMSHA256!=='e0b6b0a3a4936cfb888df0b7bc146381b0631cff93aa45fc925921ac9bab8767'
   ||wholeOwnTextSHA256!=='58b8cd27d5ea68b93180185ae45ac46d2df0e86e8822b5c57f35374837de595e')return null
  const targets=[...head.ancestors,head.node,...header.ancestors,header.node,canonicals[0].node,carriers[0].node,titles[0].node,criteria[0].node]
  for(const match of html.matchAll(/<(html|body|div|h1|span|li|ul|link|script)\s+([^>]*)>/gi)){
   const tokens=readNativeAttributeTokens(match[2]),attrs={}
   for(const [key,value]of tokens)if(!Object.hasOwn(attrs,key))attrs[key]=decodeHTML(value)
   if(targets.some(n=>n.tag===match[1].toLowerCase()&&canonical(n.attrs)===canonical(attrs))
    &&new Set(tokens.map(([key])=>key)).size!==tokens.length)return null
  }
  return {profile:'cyraac-technical-architect-country-header-v1',sourceURL:headerURL,title:listing.title,
   originalText,rawHTML,originalParts:['Bangalor',' India','Full-time'],country:'India',location:'Bangalor/ India',employmentLiteral:'Full-time',cityAliasInferred:false,
   titleDOM:dom(head.node),headerDOM:dom(header.node),commonHeaderDOM:dom(common),
   ancestorPath:head.ancestors.map(n=>({tag:n.tag,attributes:structuredClone(n.attrs)})),
   reviewedContext:{criteriaDOM,criteriaDOMSHA256,wholeOwnTextSHA256,comparisonOnly:true,completeIsolatedJD:false},
   publisher:{website:structuredClone(sites[0]),organization:structuredClone(publishers[0]),legalEntityQualified:false},
   renderingScope:'Native HTML and inline/internal CSS; external assets and browser execution unqualified'}
 }catch{return null}
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
 const header=ownHeaderCountry(listing,html,d,{postings,errors})
 const country=resolved?(countries.includes('India')?'India':new Set(countries).size===1?countries[0]:null):header?.country??null
 const locations=header?[{location:header.location,country:header.country}]:country?addresses.map((a,i)=>({location:[a.addressLocality,a.addressRegion,countries[i]].filter(Boolean).join(', '),country:countries[i]})):[]
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
  ownRoleText:description,applicationReferences:declared,...(header?{ownHeaderCountry:header}:{})}
 return {...listing,company:COMPANY,source:'cyraac',country,city:country&&cities.length===1?cities[0]:null,state:country&&states.length===1?states[0]:null,
  location:country?locations.map(p=>p.location).join('; '):null,locations,sourceCountryScopeUnresolved:!country,
  countryEvidence:header?{field:'own title-bound metadata country literal',values:['India'],url:listing.sourceUrl}:country?{field:'own JobPosting.jobLocation.address.addressCountry',values:addresses.map(a=>a.addressCountry),url:listing.sourceUrl}:null,
  nativeCountryAddresses:structuredClone(addresses),sourceNativeLocationEvidence:{listingLabel:listing.sourceNativeListingRecord.locationLabel,addresses:structuredClone(addresses)},
  requisitionId,postingDate:schema?.datePosted??null,postedAt:schema?.datePosted??null,sourceDatePrecision:posted.precision,
  closingDate:schema?.validThrough??null,firstEverPublication:null,legalEmployer:null,nativeHiringOrganization:schema?structuredClone(schema.hiringOrganization):null,
  applyUrl:declared.length===1?declared[0]:null,link:declared.length===1?declared[0]:listing.sourceUrl,
  jobDescription:description,sourceDescription:description,nativeSourceRecord:model,sourceRawNativeHTML:html,sourceRawNativeHTMLSHA256:hash(html),
  sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:country?'native-criteria-container-unverified':'native-country-unproven',
  sourceNativeProofGaps:[...(!country?['native-role-country-unproven']:[]),'native-whole-criteria-container-unverified'],
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeRoleClosingReconciled:false,
  applicationVisited:false,activeApplyVerified:false,employmentType:header?header.employmentLiteral:typeof schema?.employmentType==='string'?schema.employmentType:null,
  ...(header?{sourcePublicationDateUnavailable:true,sourceRemoteStatusUnresolved:true,remoteStatus:null}:{}),scrapedAt:clock}
}
