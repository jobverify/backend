import {decodeHTML} from 'entities'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {qualifiedFirstPartyHTML,clean,descendants,retained,nativeText,nativeLines,authoredNativeLines,comparable,requireNative,exactlyOne} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
export const CONFIGURED_URL='https://detecttechnologies.com/current-openings/'
export const CURRENT_URL='https://detecttechnologies.com/current-openings'
const failure=message=>firstPartyFailure('detecttechnologies',message),need=(ok,message)=>requireNative(ok,message,failure),one=(rows,label)=>exactlyOne(rows,label,failure)
const cls=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
const normalized=value=>clean(decodeHTML(value??''))
const writtenCountry=label=>nativeLocationCountryName(label)||(/(?:^|[, :]\s*)USA$/.test(label)?'United States':null)
export const isCurrentRoleURL=value=>{try{const url=new URL(value);return url.href===value&&url.origin==='https://detecttechnologies.com'&&!url.search&&!url.hash&&!url.username&&!url.password&&/^\/careers\/[a-z0-9-]+$/.test(url.pathname)}catch{return false}}
const roleURL=href=>{const url=new URL(href,CURRENT_URL).href;need(isCurrentRoleURL(url),'Unreviewed native role URL');return url}
const metadata=card=>{
 const fields=[]
 for(const parent of descendants(card,()=>true)){
  const children=parent.children.filter(child=>typeof child!=='string'&&!child.inert)
  for(const [index,node] of children.entries()){
   const label=clean(nativeText(node))
   if(!['Mode:','Exp:','Location:'].includes(label))continue
   need(index+1<children.length,'Native vacancy metadata value missing')
   const value=clean(nativeText(children[index+1]));need(value&&!value.endsWith(':'),'Native vacancy metadata value changed')
   fields.push({label,value})
  }
 }
 const locations=fields.filter(row=>row.label==='Location:'),modes=fields.filter(row=>row.label==='Mode:'),experiences=fields.filter(row=>row.label==='Exp:')
 need(locations.length===1&&modes.length>=1&&modes.length<=2&&experiences.length<=1,'Native vacancy fields missing or ambiguous')
 return {location:locations[0].value,employmentType:modes[0].value,workplaceType:modes[1]?.value??null,experienceRequired:experiences[0]?.value??null}
}
export function extractCurrentListings(html){
 const page=qualifiedFirstPartyHTML(html,CURRENT_URL,failure)
 need(page.title==='Current Job Openings - Detect Technologies','Current native careers title changed')
 // The current publisher repeats id=roles on its heading and collection. Bind
 // the actual collection rather than treating that fragment as a unique ID.
 const scope=one(page.visible.nodes(node=>cls(node,'w-dyn-list')&&descendants(node,child=>cls(child,'job-listing-card')).length>0),'native openings collection')
 const cards=descendants(scope,node=>cls(node,'job-listing-card'))
 need(cards.length>0&&cards.length<=32&&cards.length===page.visible.nodes(node=>cls(node,'job-listing-card')).length
  &&cards.length===retained(page.root,node=>cls(node,'job-listing-card')).length,'Hidden, missing or outside-scope native cards')
 const urls=new Set()
 return cards.map(card=>{
  const title=clean(nativeText(one(descendants(card,node=>node.tag==='h3'),'native vacancy title')))
  const link=one(descendants(card,node=>node.tag==='a'&&clean(nativeText(node))==='Apply Now'),'native role link'),sourceUrl=roleURL(link.attrs.href)
  need(title&&!urls.has(sourceUrl),'Missing or duplicate native vacancy identity');urls.add(sourceUrl)
  const fields=metadata(card),country=writtenCountry(fields.location)
  return {jobId:new URL(sourceUrl).pathname.split('/').at(-1),requisitionId:null,title,sourceUrl,applyUrl:sourceUrl,...fields,country,
   sourceCountryScopeUnresolved:country===null,jobDescription:null,sourceDetailComplete:false}
 })
}
export function extractCurrentDetail(html,listing){
 need(isCurrentRoleURL(listing.sourceUrl),'Unbound native role')
 const page=qualifiedFirstPartyHTML(html,listing.sourceUrl,failure),doc=page.visible
 const document=one(page.root.children.filter(node=>typeof node!=='string'&&node.tag==='html'),'native role HTML document')
 need(document.attrs['data-wf-item-slug']===listing.jobId,'Native Webflow item slug conflicts with role identity')
 need(page.title===listing.title+' | Job - Detect Technologies','Native role document title changed')
 const scope=one(doc.nodes(node=>cls(node,'job-grid')),'native role scope')
 need(retained(page.root,node=>cls(node,'job-grid')).length===1,'Retained native role scope is ambiguous')
 const heading=one(descendants(scope,node=>node.tag==='h1'),'native visible role heading')
 need(clean(nativeText(heading))===listing.title,'Native listing/detail role title conflict')
 need(!/\b(?:this (?:job|position|requisition) is no longer (?:available|active)|(?:this )?position (?:has been|is) filled)\b/i.test(clean(nativeText(scope))),'Native role visibly closed')
 const schemas=retained(page.head,node=>node.tag==='script'&&node.attrs.type==='application/ld+json').map(node=>{try{return JSON.parse(node.raw)}catch{throw failure('Invalid native structured data')}})
 const schema=one(schemas.filter(row=>row['@type']==='JobPosting'),'native JobPosting')
 need(normalized(schema.title)===listing.title&&roleURL(schema.url)===listing.sourceUrl,'Native JobPosting role identity conflict')
 need(schema.hiringOrganization?.name==='Detect Technologies'&&schema.hiringOrganization?.url==='https://detecttechnologies.com','Native hiring organization changed')
 const address=schema.jobLocation?.address
 need(address&&typeof address.addressLocality==='string'&&clean(address.addressLocality)===listing.location,'Native listing/detail workplace conflict')
 const country=address.addressCountry?nativeCountryName(address.addressCountry):writtenCountry(listing.location)
 need(!address.addressCountry||country,'Unrecognized native workplace country')
 need(!listing.country||country===listing.country,'Native workplace country conflict')
 need(normalized(schema.employmentType)===listing.employmentType&&normalized(schema.experienceRequirements)===(listing.experienceRequired??''),'Native employment/experience metadata conflict')
 const rawScope=one(retained(page.root,node=>cls(node,'job-grid')),'retained original native role')
 const blocks=descendants(scope,node=>cls(node,'w-richtext')),originalBlocks=retained(rawScope,node=>cls(node,'w-richtext'))
 need(blocks.length>=2&&blocks.length<=4&&blocks.length===originalBlocks.length,'Native full criteria blocks hidden or incomplete')
 const descriptionLines=blocks.flatMap((block,index)=>{
  const lines=nativeLines(block);need(comparable(lines.join(' '))===comparable(authoredNativeLines(originalBlocks[index]).join(' ')),'Native criteria content hidden or incomplete')
  need(clean(lines.join(' ')).length>0,'Empty native criteria section');return lines
 }),description=descriptionLines.join('\n')
 need(description.length>300,'Missing native full criteria')
 const form=one(descendants(scope,node=>node.tag==='form'),'native role-scoped application form')
 need(form.attrs.id==='email-form'&&form.attrs.method==='get'&&!form.attrs.action,'Native role application form changed')
 const posted=nativeDate(schema.datePosted,{required:true})
 need(schema.validThrough===undefined,'New native closing date requires review')
 return {...listing,company:'Detect Technologies',city:listing.location==='Remote'?null:listing.location.split(',')[0],sourceCountryScopeUnresolved:country===null,
  department:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:posted.raw,closingDate:null,
  sourceClosingStatusVerified:false,firstEverPostedAt:null,nativeLegalEmployer:null,jobDescription:description,sourceDescription:description,
  sourceDescriptionLines:descriptionLines,sourceNativeJobPosting:schema,
  sourceNativeRoleEvidence:{nativeRoleSlug:listing.jobId,canonicalURL:listing.sourceUrl,visibleTitle:listing.title,nativeWorkplace:listing.location,
   nativeDescriptionBlocks:blocks.length,structuredDescriptionIsFullCriteria:false,nativeDatePosted:posted.raw},
  sourceApplicationHandoff:{kind:'native-form-on-role-page',url:listing.sourceUrl,formId:form.attrs.id,activationVerified:false},
  sourceCriteriaPresentation:'full-native-richtext-role-blocks;short-structured-description-is-not-substituted',
  applicationVisited:false,sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
}
