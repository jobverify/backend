import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

export const CAREERS_URL='https://group.teamlease.com/jobs/'
export const CAREERS_API_URL='https://group.teamlease.com/wp-json/wp/v2/awsm_job_openings'
export const SOURCE='teamlease',COMPANY='Teamlease'
export const nativeFailure=message=>Object.assign(Error('TeamLease native detail/inventory: '+message),{abortRetries:true,softFailure:true,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw nativeFailure(message)}
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const desc=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>desc(child,predicate))]
const retained=(node,predicate)=>['template','object','iframe','noscript'].includes(node.tag)?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>retained(child,predicate))]
// Hidden/inert/object fallback nodes still own document fragment IDs. Ordinary
// HTML template contents are separate; foreign template/integration descendants
// stay conservative ID owners rather than proving absence with an unknown model.
const identityNodes=(node,predicate,foreign=false)=>{
 foreign ||=node.tag==='svg'||node.tag==='math'
 return [...(predicate(node)?[node]:[]),...(node.tag==='template'&&!foreign?[]:node.children.filter(child=>typeof child!=='string').flatMap(child=>identityNodes(child,predicate,foreign)))]
}
const one=(nodes,name)=>{need(nodes.length===1,'Missing or ambiguous '+name);return nodes[0]}
const rootOf=document=>one(document.nodes(node=>node.tag==='root'),'document root')
const nodeText=node=>node.inert||['script','style'].includes(node.tag)?'':node.children.map(child=>typeof child==='string'?decodeNativeEntities(child):nodeText(child)).join(' ')
const visibleText=html=>{const document=readVisibleNativeDocument(String(html),{strict:true});return norm(nodeText(rootOf(document)))}
// WordPress typography differs between visible content and its JSON-LD mirror.
// Compare those punctuation variants while returning the original visible text.
const comparable=value=>norm(value).replace(/\s/g,'').replace(/[–—]/g,'-').replace(/[‘’]/g,"'")
const plainLines=node=>{
 if(node.inert||['script','style'].includes(node.tag))return ''
 const value=node.children.map(child=>typeof child==='string'?decodeNativeEntities(child):plainLines(child)).join('')
 return /^(?:p|div|li|ul|ol|h[1-6]|br|section)$/.test(node.tag)?'\n'+value+'\n':value
}
const lines=node=>plainLines(node).split(/\r?\n/).map(norm).filter(Boolean)
const taxonomy=(classes,prefix)=>{
 const values=classes.filter(value=>value.startsWith(prefix)).map(value=>value.slice(prefix.length))
 need(values.length<=1,'Ambiguous native taxonomy '+prefix)
 return values[0]?values[0].replace(/-/g,' ').replace(/\b\p{L}/gu,value=>value.toUpperCase()):null
}
export const isRoleURL=value=>{
 try{const url=new URL(value);return url.href===value&&url.origin==='https://group.teamlease.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/jobs\/[a-z0-9-]+\/$/.test(url.pathname)}catch{return false}
}
export const buildSearchUrl=(page=1,pageSize=100)=>{
 need(Number.isSafeInteger(page)&&page>=1&&page<=100&&Number.isSafeInteger(pageSize)&&pageSize>=1&&pageSize<=100,'Invalid native pagination limits')
 const url=new URL(CAREERS_API_URL)
 url.searchParams.set('_fields','id,link,title,content,class_list');url.searchParams.set('per_page',String(pageSize));url.searchParams.set('page',String(page))
 return url.href
}
export function extractSearchResults(records){
 need(Array.isArray(records)&&records.length<=100,'Invalid published native inventory')
 const ids=new Set(),urls=new Set()
 return records.map(record=>{
  need(record&&Number.isSafeInteger(record.id)&&record.id>0&&isRoleURL(record.link),'Invalid native record identity')
  const classes=record.class_list
  need(Array.isArray(classes)&&classes.every(value=>typeof value==='string')&&classes.includes('type-awsm_job_openings')&&classes.includes('status-publish'),'Native record is not a published job post')
  need(!ids.has(record.id)&&!urls.has(record.link),'Duplicate published native record');ids.add(record.id);urls.add(record.link)
  need(record.content?.protected!==true&&typeof record.content?.rendered==='string'&&record.content.rendered.trim(),'Protected or missing native content')
  const title=visibleText(record.title?.rendered??'');need(title,'Missing native title')
  const location=taxonomy(classes,'job-location-'),country=nativeLocationCountryName(location)
  return {title,company:COMPANY,department:taxonomy(classes,'job-category-'),location,city:location,
   country,sourceCountryScopeUnresolved:country===null,jobId:String(record.id),requisitionId:null,
   sourceUrl:record.link,applyUrl:record.link,employmentType:taxonomy(classes,'job-type-'),
   experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
   postingDate:null,closingDate:null,jobDescription:visibleText(record.content.rendered),remoteStatus:null,
   sourceNativeListingRecord:structuredClone(record)}
 })
}
function retainedDocument(html,url){
 const document=readNativeDocument(String(html)),root=rootOf(document)
 need(retained(root,node=>node.tag==='base').length===0,'Unreviewed document base')
 const htmlNode=one(root.children.filter(node=>typeof node!=='string'&&node.tag==='html'),'HTML document')
 const head=one(retained(root,node=>node.tag==='head'),'retained document head')
 need(htmlNode.children.includes(head),'Head is outside its document')
 const body=one(retained(root,node=>node.tag==='body'),'retained document body')
 need(htmlNode.children.includes(body),'Body is outside its document')
 const canonical=one(retained(head,node=>node.tag==='link'&&(node.attrs.rel||'').toLowerCase()==='canonical'),'canonical identity')
 need(canonical.attrs.href===url,'Canonical identity changed')
 return {document,root,head,body}
}
export function parseArchive(html,rows,{check=()=>{}}={}){
 check();retainedDocument(html,CAREERS_URL)
 const document=readVisibleNativeDocument(String(html),{strict:true})
 need(document.nodes(node=>node.tag==='body'&&document.hasClass(node,'post-type-archive-awsm_job_openings')).length===1,'Native jobs archive identity changed')
 const title=one(document.nodes(node=>node.tag==='title'),'archive title')
 need(/Job Openings Archive\s*-\s*TeamLease/i.test(norm(decodeNativeEntities(title.raw))),'Archive employer title changed')
 const known=new Map(rows.map(row=>[row.sourceUrl,row]))
 const matched=new Map()
 for(const card of document.nodes(node=>document.hasClass(node,'awsm-job-listing-item'))){
  const anchor=one(desc(card,node=>node.tag==='a'&&document.hasClass(node,'awsm-job-item')),'native archive card link')
  const row=known.get(anchor.attrs.href)
  need(row&&card.attrs.id==='awsm-grid-item-'+row.jobId,'Native archive post identity does not match the feed')
  const heading=one(desc(anchor,node=>/^h[1-3]$/.test(node.tag)&&document.hasClass(node,'awsm-job-post-title')),'native archive role heading')
  need(comparable(nodeText(heading))===comparable(row.title),'Native archive role title does not match the feed')
  need(!matched.has(row.sourceUrl),'Duplicate native archive post')
  matched.set(row.sourceUrl,{url:row.sourceUrl,title:row.title})
 }
 need(matched.size>0,'No visible native vacancy links match the feed')
 const hasPagination=document.nodes(node=>document.hasClass(node,'awsm-jobs-pagination')&&/load more/i.test(document.text(node))).length>0
 need(matched.size===rows.length||hasPagination,'Native feed records have no matching visible archive or declared pagination')
 check();return [...matched.values()].sort((a,b)=>a.url.localeCompare(b.url))
}
function jobPosting(root){
 const postings=[]
 for(const script of retained(root,node=>node.tag==='script'&&(node.attrs.type||'').toLowerCase()==='application/ld+json')){
  let data;try{data=JSON.parse(script.raw||'null')}catch{throw nativeFailure('Malformed native structured metadata')}
  const pending=[data];let count=0
  while(pending.length){
   const value=pending.pop();if(!value||typeof value!=='object')continue
   need(++count<=4096,'Structured metadata budget exceeded')
   const types=Array.isArray(value['@type'])?value['@type']:[value['@type']]
   if(types.includes('JobPosting')||types.includes('https://schema.org/JobPosting'))postings.push(value)
   pending.push(...Object.values(value))
  }
 }
 return one(postings,'native JobPosting')
}
function nativeDate(value,label){
 if(value==null||value==='')return null
 need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value),'Unsupported native '+label)
 const day=value.slice(0,10),[year,month,date]=day.split('-').map(Number),calendar=new Date(Date.UTC(year,month-1,date))
 need(calendar.toISOString().slice(0,10)===day&&Number.isFinite(Date.parse(value)),'Impossible native '+label)
 return new Date(value).toISOString()
}
function workplace(posting,listing){
 const raw=posting.jobLocation==null?[]:Array.isArray(posting.jobLocation)?posting.jobLocation:[posting.jobLocation]
 need(raw.length<=32,'Native workplace bound exceeded')
 const locations=raw.map(item=>{
  need(item&&item.address&&typeof item.address==='object'&&!Array.isArray(item.address),'Malformed native workplace')
  const address=item.address,value=address.addressCountry
  const label=typeof value==='object'&&value?value.name??value.countryCode:value
  const country=nativeCountryName(label)
  const city=typeof address.addressLocality==='string'?norm(address.addressLocality):null
  const region=typeof address.addressRegion==='string'?norm(address.addressRegion):null
  return {country,city,region,location:[city,region,country].filter(Boolean).join(', ')||null,raw:structuredClone(item)}
 })
 const countries=[...new Set(locations.map(item=>item.country).filter(Boolean))]
 const qualified=locations.length>0&&locations.every(item=>item.country)&&countries.length===1
 const country=qualified?countries[0]:locations.length?null:listing.country
 return {country,city:locations.length===1?locations[0].city:locations.length?null:listing.city,
  location:locations.length?locations.map(item=>item.location).filter(Boolean).join('; ')||null:listing.location,
  locations,sourceCountryScopeUnresolved:country===null}
}
export function extractJobDetail(html,listing={}, {now=new Date().toISOString(),check=()=>{}}={}){
 check();need(isRoleURL(listing.sourceUrl)&&/^\d+$/.test(listing.jobId||''),'Missing native listing identity')
 const retainedPage=retainedDocument(html,listing.sourceUrl),posting=jobPosting(retainedPage.root)
 need(typeof posting.title==='string'&&comparable(visibleText(posting.title))===comparable(listing.title),'Native structured title identity changed')
 need(posting.hiringOrganization?.name==='TeamLease Services Limited','Native employer organization changed')
 let organizationURL;try{organizationURL=new URL(posting.hiringOrganization.sameAs)}catch{}
 need(organizationURL?.origin==='https://group.teamlease.com'&&organizationURL.pathname==='/'&&!organizationURL.search&&!organizationURL.hash,'Native employer identity URL changed')
 const document=readVisibleNativeDocument(String(html),{strict:true})
 need(document.nodes(node=>node.tag==='body'&&document.hasClass(node,'single-awsm_job_openings')&&document.hasClass(node,'postid-'+listing.jobId)).length===1,'Native post body identity changed')
 const banner=one(document.nodes(node=>document.hasClass(node,'new-page-banner-content')),'native role title banner')
 const heading=one(desc(banner,node=>/^h[1-3]$/.test(node.tag)),'visible role heading')
 need(comparable(nodeText(heading))===comparable(listing.title),'Visible native title identity changed')
 const scope=one(document.nodes(node=>document.hasClass(node,'awsm-job-single-wrap')),'native detail scope')
 const description=one(desc(scope,node=>document.hasClass(node,'awsm-job-entry-content')),'visible native description')
 const descriptionLines=lines(description),content=descriptionLines.join('\n')
 need(content.length>=80,'Native description content unavailable')
 need(comparable(content)===comparable(visibleText(listing.sourceNativeListingRecord?.content?.rendered??'')),'Feed and visible native description content changed')
 need(typeof posting.description==='string'&&comparable(content)===comparable(visibleText(posting.description)),'Structured and visible native description content changed')
 const form=one(desc(scope,node=>node.tag==='form'&&node.attrs.id==='awsm-application-form'&&document.hasClass(node,'awsm-application-form')),'native application form')
 one(identityNodes(retainedPage.root,node=>node.attrs.id==='awsm-application-form'),'retained application form fragment identity')
 need((form.attrs.method||'').toLowerCase()==='post'&&!form.attrs.action,'Native application form action changed')
 const field=name=>one(desc(form,node=>node.tag==='input'&&node.attrs.type==='hidden'&&node.attrs.name===name),'application form '+name)
 need(field('awsm_job_id').attrs.value===listing.jobId,'Application form post identity changed')
 need(field('action').attrs.value==='awsm_applicant_form_submission','Native application form action changed')
 need(desc(form,node=>node.tag==='input'&&node.attrs.type==='file'&&node.attrs.name==='awsm_file').length===1,'Native resume application field unavailable')
 const posted=nativeDate(posting.datePosted,'publication date'),closing=nativeDate(posting.validThrough,'closing date')
 need(posted&&Number.isFinite(Date.parse(now)),'Missing native publication or source clock')
 need(!closing||Date.parse(closing)>=Date.parse(posted),'Native closing date precedes publication')
 const geography=workplace(posting,listing)
 check();return {...listing,title:norm(nodeText(heading)),...geography,
  applyUrl:listing.sourceUrl+'#awsm-application-form',requisitionId:null,
  jobDescription:content,sourceDescription:content,sourceDescriptionLines:descriptionLines,
  postingDate:posted,closingDate:closing,sourcePostedDateRaw:posting.datePosted,sourceClosingDateRaw:posting.validThrough??null,
  sourceClosingStatusVerified:Boolean(closing),sourceRoleExpired:Boolean(closing&&Date.parse(closing)<Date.parse(now)),
  sourceFuturePublication:Date.parse(posted)>Date.parse(now),sourceNativeJobPosting:structuredClone(posting),
  sourceNativeLocationEvidence:{jobLocation:structuredClone(posting.jobLocation??null),taxonomyLocation:listing.location,
    applicantLocationRequirements:structuredClone(posting.applicantLocationRequirements??null)},
  sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  applicationVisited:false,sourceApplicationHandoff:{kind:'native-public-role-application-form',url:listing.sourceUrl+'#awsm-application-form',nativePostId:listing.jobId},
  employmentType:typeof posting.employmentType==='string'?posting.employmentType:listing.employmentType,
  firstEverPostedAt:null,nativeLegalEmployer:null}
}
