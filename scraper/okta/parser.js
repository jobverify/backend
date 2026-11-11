import {document,norm} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {requireNative,nativeDate,nativeCountryName,nativeLocationCountryName,plainNativeHTML} from '../../scraper-support/shared/nativeJobPosting.js'
import {activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
export const SOURCE='okta',COMPANY='Okta',ORIGIN='https://www.okta.com'
export const HOME=ORIGIN+'/company/careers/',BOARD=HOME+'job-listing/'
const ensure=(value,message)=>requireNative(value,'Okta: '+message)
const one=(values,label)=>{ensure(values.length===1,'Missing/ambiguous '+label);return values[0]}
const excluded=new Set(['blockquote','q','pre','code','aside','template','object','noscript'])
const activeNodes=(d,predicate,node=d.root)=>{
 const found=[]
 const visit=node=>{
  if(node.inactive||excluded.has(node.tag))return
  if(predicate(node))found.push(node)
  for(const child of node.children)if(typeof child!=='string')visit(child)
 }
 visit(node);return found
}
const activeText=node=>{
 const text=node=>typeof node==='string'?node:node.inactive||excluded.has(node.tag)||node.tag==='script'?'':node.children.map(text).join(' ')
 return norm(text(node))
}
const roleCriterion=value=>/^(?:design|develop|build|implement|maintain|manage|lead|deliver|support|collaborate|partner|test|debug|analy[sz]e|monitor|own|drive|execute|ensure|improve|architect|integrate|automate|operate|work|conduct|create|coordinate|establish|evaluate|provide|participate|define|identify|engage|understand|demonstrate|assist|contribute|help|perform|serve|plan|translate|promote|enable|represent|champion|advocate|mentor|coach|research|document|respond|resolve|scale|secure)\b/i.test(value)
 ||/\b(?:you|candidate|this role|the role|position|responsible)\b.{0,100}\b(?:will|must|should|have|work|design|develop|build|manage|lead|support|deliver)\b/i.test(value)
 ||/\b\d+\+?(?:\s*[-\u2013]\s*\d+\+?)?\s+years?\b|\b(?:experience|knowledge|expertise|familiarity|understanding|proficiency|skills)\s+(?:in|with|of|using|building|developing|working)\b|\b(?:at least|minimum|strong|proven|demonstrated|hands[- ]on).{0,60}\b(?:experience|knowledge|expertise|skills)\b|\b(?:bachelor|master|Ph\.?D|B\.?S\.?|M\.?S\.?|degree|certification)\b.{0,80}\b(?:in|or|equivalent|required|preferred)\b/i.test(value)
const countryPatterns=(()=>{
 const names=new Set()
 for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const name=nativeCountryName(String.fromCharCode(a,b));if(name&&name.length>2)names.add(name)}
 return [...names].map(name=>[name,new RegExp('(?<![\\p{L}\\p{N}])'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+')+'(?![\\p{L}\\p{N}])','iu')])
})()
const writtenCountries=label=>countryPatterns.filter(([,pattern])=>pattern.test(label)).map(([name])=>name)
const activeBlocks=article=>{
 const ignored=new Set([...excluded].filter(tag=>tag!=='aside'))
 const boundaries=new Set(['address','article','aside','body','br','caption','dd','details','div','dl','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hr','li','main','nav','ol','p','section','summary','table','tbody','td','th','thead','tr','ul'])
 const blocks=[];let current=''
 const flush=()=>{const value=norm(current);if(value)blocks.push(value);current=''}
 const visit=node=>{
  if(typeof node==='string'){current+=node+' ';return}
  if(node.inactive||ignored.has(node.tag)||node.tag==='script'){flush();blocks.push(null);return}
  const boundary=boundaries.has(node.tag);if(boundary)flush()
  for(const child of node.children)visit(child)
  if(boundary)flush();else current+=' '
 }
 visit(article);flush();return blocks
}
const declarationValues=(lines,label)=>{
 const values=[]
 for(let index=0;index<lines.length;index++){
  if(typeof lines[index]!=='string')continue
  const match=label.exec(lines[index]);if(!match)continue
  if(match[1]?.trim()){values.push(match[1].trim());continue}
  const next=lines[index+1]===':'?lines[index+2]:lines[index+1]
  // A new label is not the preceding declaration's value. Blank declarations
  // cannot borrow Country/Location/Title metadata to invent an employer.
  const anotherLabel=/^(?:(?:Job|Work|Role)\s+)?(?:Employer|Hiring Organization|Organization Name|Company Name|Hiring Company|Company|Location|Country|Workplace|Title|Department|Function|Responsibilities|Qualifications)\s*:?$/i.test(next||'')
  if(next&&!anotherLabel&&!/^[\p{L}][\p{L} /-]{0,60}\s*:/u.test(next))values.push(next)
 }
 return values
}
const employerConflict=article=>{
 const lines=activeBlocks(article),key=value=>norm(value).replace(/[^\p{L}\p{N}]/gu,'').toLowerCase()
 const own=name=>['okta','oktainc'].includes(key(name))
 const declared=declarationValues(lines,/^(?:Employer|Hiring Organization|Organization Name|Company Name|Hiring Company|Company)\s*(?::\s*(.*))?$/i)
 if(declared.some(value=>!own(value)))return true
 for(const line of lines){
  if(!line)continue
  const affirmative=[...line.matchAll(/\b(?:you (?:will be|are) employed by|your employer (?:is|will be))\s+([^.!?]+)(?:[.!?]|$)/gi),
   ...line.matchAll(/(?:^|[.!?]\s+)([^.!?]+?)\s+is your employer\b/gi)]
  if(affirmative.some(match=>!own(match[1])))return true
 }
 const segments=[''];for(const line of lines){if(line===null)segments.push('');else segments[segments.length-1]+=' '+line}
 return segments.some(segment=>/\bOkta(?:[,\s]*Inc\.?)?(?![\p{L}\p{N}]).{0,60}(?:is not|isn['\u2019]t|will not be|won['\u2019]t be).{0,40}employer\b|\b(?:not|won['\u2019]t|aren['\u2019]t|isn['\u2019]t)\s+(?:be\s+)?(?:employed by|(?:an?\s+)?employee of)\s+Okta(?:[,\s]*Inc\.?)?(?![\p{L}\p{N}])/iu.test(segment))
}
const workplaceConflict=(article,countries)=>{
 const lines=activeBlocks(article),values=declarationValues(lines,/^(?:(?:Job|Work|Role)\s+)?(?:Location|Country|Workplace)\s*(?::\s*(.*))?$/i)
 for(const line of lines){const statement=/^(?:This|The) (?:role|position|job) (?:is|will be) (?:based|located) in\s+(.+)$/i.exec(line);if(statement)values.push(statement[1])}
 return values.some(value=>/\b(?:not|non)[-\s]*India\b/i.test(value)||writtenCountries(value).some(country=>!countries.includes(country)))
}
const canonical=(d,url,{reviewedRoot=false}={})=>{
 const active=activeNodes(d,()=>true)
 const href=one(active.filter(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical URL').attrs.href
 if(href===url)return{url:href,policy:'exact-resource-canonical'}
 ensure(reviewedRoot&&href===ORIGIN&&url!==HOME&&new URL(url).origin===ORIGIN,'Native canonical URL conflict')
 // Current native career pages publish a site-wide SEO canonical. It does not
 // identify the resource: the real requested URL, listing and own article/IDs
 // continue to bind the role. Require both original typed publisher models.
 const scripts=active.filter(node=>node.tag==='script'&&node.attrs.type==='application/ld+json')
 const models=scripts.map(node=>JSON.parse(node.raw))
 ensure(models.every(model=>model&&typeof model==='object'&&!Array.isArray(model)&&!model['@graph']),'Unreviewed site publisher graph')
 const organization=one(models.filter(model=>model['@type']==='Organization'),'typed site Organization')
 const website=one(models.filter(model=>model['@type']==='WebSite'),'typed site WebSite')
 ensure(organization.legalName==='Okta, Inc.'&&organization.url===ORIGIN+'/'
  &&(organization.name==null||organization.name==='Okta, Inc.')
  &&website.name==='Okta, Inc.'&&website.url===ORIGIN+'/','Native site publisher conflict')
 return{url:href,policy:'reviewed-site-root-SEO;resource-bound-by-native-own-page-model'}
}
const writtenIndia=label=>/(?:^|,\s*)India$/.test(norm(label))
// Drupal's short -0/-1/... suffixes distinguish slugs; they are not job IDs.
// Before the own role is read, keep the complete resource path as identity.
const externalURLID=url=>/-([1-9]\d{4,11})\/$/.exec(new URL(url).pathname)?.[1]??null
const idFromURL=url=>externalURLID(url)??url

export function createSourceConfig({now=()=>new Date().toISOString(),maxJobs}={}){
 const current=Date.parse(now()),allowedDetails=new Set(),seenExternalIDs=new Set()
 ensure(Number.isFinite(current),'Invalid observation clock')
 ensure(maxJobs==null,'Partial maxJobs limit unsupported;native inventory must be read completely')
 const config={source:SOURCE,companyName:COMPANY,boardURL:BOARD,detailConcurrency:4,maxAggregateBytes:192*1024*1024,compactResponseReferences:true,
  sameReadIdentity:(a,b)=>a===b,
  validateURL(value){
   ensure(typeof value==='string','Invalid public URL')
   const url=new URL(value)
   ensure(!url.username&&!url.password&&!url.search&&!url.hash&&url.origin===ORIGIN,'Unqualified public origin/query/credentials')
   ensure(value===HOME||value===BOARD||allowedDetails.has(value),'Unlisted public resource or application action')
  },
  handoffs:[{url:HOME,verify(html){
   const d=document(html);canonical(d,HOME)
   const titles=activeHead(html).titles
   ensure(activeNodes(d,n=>n.tag==='a'&&typeof n.attrs.href==='string'&&new URL(n.attrs.href,ORIGIN).href===BOARD).length>0
    &&titles.length===1&&/\bCareers\b[\s\S]*\bOkta\b/i.test(titles[0]),'Official careers/search/company binding missing')
  }}],
  parseListing(html,url){
   ensure(url===BOARD,'Unknown listing page');const d=document(html),nativeCanonical=canonical(d,BOARD,{reviewedRoot:true})
   const titles=activeHead(html).titles
   ensure(titles.length===1&&norm(titles[0])==='Job Openings | Okta','Native board publisher title changed')
   ensure(activeNodes(d,n=>n.tag==='form'&&n.attrs['data-drupal-selector']==='views-exposed-form-careers-main').length===1,
    'Missing unique native careers listing container')
   ensure(!activeNodes(d,n=>n.tag==='a'&&(n.attrs.rel||'').split(/\s+/).includes('next')
    ||['nav','li'].includes(n.tag)&&/(?:^|\s)(?:pager|pager__item|pagination)(?:\s|$)/.test(n.attrs.class||'')).length,
   'Native board gained pagination controls;single-page enumeration unverified')
   const rows=activeNodes(d,n=>d.hasClass(n,'views-row'));ensure(rows.length>0&&rows.length<=2000,'Native board missing or exceeds listing bound')
   const records=[],errors=[]
   for(const node of rows)try{
    const link=one(activeNodes(d,n=>n.tag==='a'&&typeof n.attrs.href==='string',node),'listing role link')
    const role=new URL(link.attrs.href,ORIGIN)
    ensure(role.origin===ORIGIN&&!role.username&&!role.password&&!role.search&&!role.hash
     &&/^\/company\/careers\/(?:[a-z0-9-]+\/){1,2}$/.test(role.pathname)
     &&!role.pathname.slice('/company/careers/'.length).split('/').some(part=>['job-listing','apply','application','login','register','sign-in','account'].includes(part)),
    'Unqualified listing role URL')
    const title=activeText(link),location=activeText(one(activeNodes(d,n=>d.hasClass(n,'views-field-field-job-location'),node),'listing location'))
    ensure(title&&location,'Missing native title/location')
    // A country is recognized only when written in the location field. The
    // India locale,company name and city alone never establish India scope.
    ensure(!/\bIndia\b/.test(location)||writtenIndia(location)&&writtenCountries(location).every(country=>country==='India'),'Ambiguous native India listing location')
    const india=writtenIndia(location);if(india)allowedDetails.add(role.href)
    records.push({id:idFromURL(role.href),title,url:role.href,locations:[location],countries:india?['India']:[],
     nativeLocation:location,nativeURLJobID:externalURLID(role.href),nativeListingHTML:d.outer(node),
     nativeBoardCanonicalURL:nativeCanonical.url,nativeBoardCanonicalPolicy:nativeCanonical.policy})
   }catch(error){errors.push({message:error.message,rawCandidate:{rawHTML:d.outer(node)}})}
   // The board has no advertised numeric total. Keep that unknown instead of
   // relabeling a count of observed DOM rows as an upstream reported total.
   return{pageNumber:1,lastPage:1,reportedTotal:null,observedRows:rows.length,records,errors,nextURL:null,terminationKnown:true}
  },
  pageFingerprint:page=>JSON.stringify([page.observedRows,page.records.map(r=>[r.id,r.title,r.url,r.nativeLocation]),page.errors]),
  candidateForIndia:row=>row.countries.includes('India'),
  parseDetail(html,row){
   const d=document(html),nativeCanonical=canonical(d,row.url,{reviewedRoot:true})
   const postings=activeNodes(d,n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>JSON.parse(n.raw)).filter(p=>p['@type']==='JobPosting')
   const schema=one(postings,'native JobPosting'),title=activeText(one(activeNodes(d,n=>n.tag==='h1'),'visible title'))
   ensure(norm(schema.title)===row.title&&title===row.title,'Native listing/schema/visible title conflict')
   ensure(schema.hiringOrganization?.name==='Okta, Inc.'&&schema.hiringOrganization.sameAs==='http://www.okta.com/',
    'Native hiring organization identity conflict')
   const jobNode=one(activeNodes(d,n=>n.tag==='article'&&d.hasClass(n,'Job__content')),'full native role article')
   ensure(new URL(jobNode.attrs.about,ORIGIN).href===row.url,'Native article identity conflict')
   const nativeHTML=d.inner(jobNode),text=activeText(jobNode)
   ensure(!employerConflict(jobNode),'Active own role employer contradiction')
   ensure(text&&!/\b(?:this job is no longer available|this position has been filled)\b/i.test(text),'Missing or closed native role body')
   ensure(typeof schema.description==='string'&&plainNativeHTML(schema.description),'Missing native schema teaser')
   const teaser=document(schema.description).root
   ensure(!employerConflict(teaser),'Own native schema teaser employer contradiction')
   // The schema text is a truncated teaser ending in a period. It is retained
   // separately. Require authored material after the shared first paragraph
   // and before the native benefits footer;never substitute the teaser.
   const paragraphs=jobNode.children.filter(n=>typeof n!=='string'&&!n.inactive&&!excluded.has(n.tag)),firstParagraph=paragraphs[0]
   ensure(firstParagraph&&firstParagraph.tag==='p','Missing native role introduction paragraph')
   const intro=activeText(firstParagraph)
   let authored=text
   if(/^Secure Every Identity, from AI to Human/.test(intro))authored=authored.slice(intro.length).trim()
   for(const marker of ['What you can look forward to as an Okta employee!','The Okta Experience']){
    const at=authored.indexOf(marker);if(at>=0)authored=authored.slice(0,at).trim()
   }
   ensure(authored&&authored.replace(/\s/g,'')!==plainNativeHTML(schema.description).replace(/\s/g,''),
    'Missing employer-authored role content beyond company teaser/footer')
   const footerNodes=activeNodes(d,n=>['p','div','h1','h2','h3','h4','h5','h6'].includes(n.tag),jobNode)
    .filter(node=>['What you can look forward to as an Okta employee!','The Okta Experience'].some(marker=>activeText(node).startsWith(marker)))
   const footerStart=footerNodes.length?Math.min(...footerNodes.map(node=>node.start)):Infinity
   const criteria=activeNodes(d,n=>['p','li'].includes(n.tag)&&n.start>=firstParagraph.end&&n.start<footerStart,jobNode)
    .map(activeText).filter(value=>value.length>=40&&!/:\s*$/.test(value)&&roleCriterion(value)).join(' ')
   ensure(criteria.length>=100&&criteria.split(/\s+/).length>=15,'Missing active substantive own role criteria beyond headings/company introduction')
   ensure(!activeNodes(d,n=>n.tag==='form',jobNode).length,'Native role article unexpectedly contains application form')
   const locations=Array.isArray(schema.jobLocation)?schema.jobLocation:[schema.jobLocation]
   ensure(locations.length>0&&locations.length<=32,'Missing native JobPosting locations')
   const addresses=locations.map(place=>{
    ensure(place?.['@type']==='Place'&&typeof place.address==='string'&&norm(place.address),'Missing native address string')
    const country=nativeLocationCountryName(place.address);ensure(country&&writtenCountries(place.address).every(value=>value===country),'Unrecognized or conflicting native written country')
    return{raw:place.address,country,nativeCountryRaw:place.address,nativeAddressFormat:'original JobPosting Place.address string'}
   })
   const india=addresses.filter(a=>a.country==='India')
   const countries=addresses.map(address=>address.country)
   ensure(!workplaceConflict(jobNode,countries)&&!workplaceConflict(teaser,countries),'Own native criteria workplace country contradiction')
   ensure(india.length>0&&india.some(a=>norm(a.raw)===row.nativeLocation),'Native listing/schema India location conflict')
   const visible=activeText(one(activeNodes(d,n=>n.tag==='div'&&d.hasClass(n,'mb-4')&&d.hasClass(n,'h5')),'visible native location'))
   ensure(visible===row.nativeLocation,'Native visible/listing location conflict')
   const posted=nativeDate(schema.datePosted,{required:true}),closing=nativeDate(schema.validThrough)
   ensure(Date.parse(posted.iso)<=current&&(!closing.iso||closing.iso>=posted.iso),'Future posting or invalid native expiry chronology')
   const ids=one(activeNodes(d,n=>typeof n.attrs['data-job-id']==='string'),'native public job identifier').attrs
   const external=ids['data-job-id'],internal=ids['data-job-id-internal']
   ensure(/^[1-9]\d{4,11}$/.test(external)&&/^[1-9]\d{4,11}$/.test(internal)
    &&(!row.nativeURLJobID||external===row.nativeURLJobID),'Native public/internal job ID or listing URL conflict')
   ensure(!seenExternalIDs.has(external),'Duplicate native external job ID across distinct listing URLs');seenExternalIDs.add(external)
   return{id:external,title:row.title,sourceURL:row.url,nativeCanonicalURL:nativeCanonical.url,nativeCanonicalPolicy:nativeCanonical.policy,
    nativeListingRecord:row,nativeJobPosting:schema,nativeJobPostingIdentifier:schema.identifier??null,
    nativeHiringOrganization:schema.hiringOrganization,nativeCountryAddresses:addresses,nativeVisibleLocationTexts:[visible],
    nativeSchemaDescription:schema.description,nativeVisibleDescriptionHTML:nativeHTML,nativeDescriptionHTML:nativeHTML,
    nativeDescriptionOrigin:'exact original Job__content article HTML;schema teaser retained separately;application form outside article',
    nativePostedDate:posted,nativeValidThrough:closing,nativeApplicationURL:null,nativeExternalJobID:external,nativeInternalJobID:internal,
    nativeIndiaLocationLabels:india.map(a=>norm(a.raw)),sourceRequisitionID:null,nativeApplicationFormAttributesReadOnly:true,
    applicationsVisited:false,firstEverPublication:null,legalEmployer:null,sourceScopeComplete:false}
  },
 }
 return config
}
