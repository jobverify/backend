import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
export const SOURCE='cyfuture',COMPANY='Cyfuture',INDEX='https://cyfuture.com/current-opportunities.html',CONTACT='https://cyfuture.com/contact-us.html'
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Cyfuture native: '+message),{code:'CYFUTURE_NATIVE_CONTRACT',abortRetries:true})}
export const hash=value=>createHash('sha256').update(value).digest('hex')
const clean=v=>String(v??'').replace(/\s+/g,' ').trim(),cls=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)
const contentExcluded=new Set(['script','style','template','noscript','iframe','object','svg'])
export const nativeText=n=>clean(typeof n==='string'?decodeHTML(n):contentExcluded.has(n.tag)?'':n.children.map(nativeText).join(' '))
const all=(n,p)=>typeof n==='string'?[]:[...(p(n)?[n]:[]),...n.children.flatMap(c=>all(c,p))]
const within=(n,p)=>n.inert?[]:[...(p(n)?[n]:[]),...n.children.filter(c=>typeof c!=='string').flatMap(c=>within(c,p))]
const one=(rows,name)=>{need(rows.length===1,'one '+name+' required');return rows[0]}
const tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:structuredClone(n.attrs),children:n.children.map(tree),...(n.raw===undefined?{}:{raw:n.raw})}
const coverage=(n,visible=false)=>typeof n==='string'?clean(decodeHTML(n))||null:contentExcluded.has(n.tag)||visible&&n.inert?null:
 {tag:n.tag,attrs:structuredClone(n.attrs),children:n.children.map(c=>coverage(c,visible)).filter(c=>c!==null)}
const walk=v=>!v||typeof v!=='object'?[]:[v,...Object.values(v).flatMap(walk)]
const schemaAndIdentity=(html,title)=>{
 const d=readNativeDocument(html),head=activeHead(html),root=d.nodes(n=>n.tag==='root')[0]
 need(head.titles.length===1&&(typeof title==='string'?head.titles[0]===title:title.test(head.titles[0])),'native publisher/page identity changed')
 need(!all(root,n=>n.tag==='base').length,'active base unsupported')
 const schemas=all(root,n=>n.tag==='script'&&(n.attrs.type||'').trim().toLowerCase()==='application/ld+json').map(n=>{
  try{return JSON.parse(n.raw)}catch{need(false,'invalid native JSON-LD')}})
 need(!walk(schemas).some(n=>(Array.isArray(n['@type'])?n['@type']:[n['@type']]).some(t=>typeof t==='string'&&/(?:^|[\/:#])JobPosting$/.test(t))),'new native JobPosting requires field review')
 return {d,identity:head,schemas}
}
export const isRoleURL=url=>{try{const u=new URL(url);return u.origin==='https://cyfuture.com'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/apply-job\/\d+\/[A-Za-z0-9-]*$/.test(u.pathname)}catch{return false}}
const applyURL=value=>{const u=new URL(value,INDEX);need(['https://cyfuture.com','https://www.cyfuture.com'].includes(u.origin)&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&u.pathname==='/upload-resume.html','unreviewed application handoff');return u.href}
export function readIndex(html){
 const {d,identity,schemas}=schemaAndIdentity(html,'Career Opportunities at Cyfuture')
 need(schemas.some(n=>n['@type']==='Corporation'&&n.name==='Cyfuture'&&n.url==='https://cyfuture.com'),'own native publisher declaration missing')
 const officeLinks=d.nodes(n=>n.tag==='a'&&n.attrs.href&&new URL(n.attrs.href,INDEX).href===CONTACT)
 need(officeLinks.length>0,'declared publisher office surface missing')
 const controls=d.nodes(n=>n.tag==='button'&&n.attrs['data-bs-toggle']==='tab'&&n.attrs['data-bs-target'])
 need(controls.length>0,'native location tabs missing')
 const rows=[],tabs=controls.map(control=>{
  const target=control.attrs['data-bs-target'];need(/^#[a-z]+$/.test(target),'unreviewed native location tab target')
  const pane=one(d.nodes(n=>n.attrs.id===target.slice(1)&&cls(n,'tab-pane')),'tab-assigned native pane')
  const tab={attrs:structuredClone(control.attrs),label:nativeText(control),paneAttrs:structuredClone(pane.attrs)}
  const cards=within(pane,n=>cls(n,'opening-card'))
  for(const card of cards){
   const heading=one(within(card,n=>n.tag==='h4'),'native role heading'),title=nativeText(heading)
   const declaredLinks=within(card,n=>n.tag==='a'&&cls(n,'view-details-btn'))
   if(!declaredLinks.length&&title==='Coming Soon'&&nativeText(card)==='Coming Soon')continue
   const link=one(declaredLinks,'native View Details link')
   const sourceUrl=new URL(link.attrs.href,INDEX).href;need(isRoleURL(sourceUrl)&&nativeText(link)==='View Details','unreviewed declared role URL')
   const jobId=new URL(sourceUrl).pathname.match(/^\/apply-job\/(\d+)\//)[1]
   const badge=one(within(card,n=>cls(n,'opening-badge')),'native positions badge'),label=nativeText(badge),m=/^(\d+) Openings?$/.exec(label)
   need(title&&m&&Number.isSafeInteger(Number(m[1]))&&Number(m[1])>0&&Number(m[1])<=10000,'native role identity or position count unavailable')
   const previews=within(card,n=>n.tag==='li').map(n=>({label:within(n,c=>c.tag==='strong').map(nativeText).join(' '),text:nativeText(n),tree:tree(n)}))
   rows.push({jobId,title,sourceUrl,nativeLocation:tab.label,tab:structuredClone(tab),numberOfOpenings:Number(m[1]),openingLabel:label,previews,card:tree(card)})
  }
  need(cards.length||nativeText(pane)==='Coming Soon','unreviewed non-role tab content')
  return {...tab,nativeText:nativeText(pane),tree:tree(pane)}
 })
 need(rows.length&&new Set(rows.map(r=>r.jobId)).size===rows.length&&new Set(rows.map(r=>r.sourceUrl)).size===rows.length,'missing or duplicate native roles')
 return {identity,schemas,contactURL:CONTACT,officeDeclarations:officeLinks.map(tree),tabs,rows}
}
export function readOfficeIndex(html){
 const {d,identity,schemas}=schemaAndIdentity(html,'Contact Us | Call Us | Connect with Cyfuture 24x7')
 const section=one(d.nodes(n=>n.tag==='section'&&cls(n,'contact-us-section')),'native global office scope')
 const tablist=one(within(section,n=>n.attrs.id==='regionTab'&&n.attrs.role==='tablist'),'native country/region declaration')
 const controls=within(tablist,n=>n.tag==='a'&&n.attrs.role==='tab')
 need(controls.length>0,'country/region declarations missing')
 const assignments=new Map()
 const office=(card,{country=null,countryLabel=null,panelId=null}={})=>{
  const heading=one(within(card,n=>cls(n,'office-title')),'native office heading'),address=one(within(card,n=>cls(n,'address-info')),'whole native office address')
  return {heading:nativeText(heading),address:nativeText(address),country,countryLabel,panelId,tree:tree(card)}
 }
 const groups=controls.map(control=>{
  const target=control.attrs.href;need(/^#[a-z]+$/.test(target)&&control.attrs['aria-controls']===target.slice(1),'native office-country target changed')
  const pane=one(within(section,n=>n.attrs.id===target.slice(1)&&n.attrs.role==='tabpanel'&&n.attrs['aria-labelledby']===control.attrs.id),'declared country office panel')
  const label=nativeText(control),country=label==='INDIA'?'India':null
  const offices=within(pane,n=>cls(n,'location-card')).map(card=>{
   need(!assignments.has(card),'overlapping native office-country assignments')
   assignments.set(card,pane.attrs.id)
   return office(card,{country,countryLabel:label,panelId:pane.attrs.id})
  })
  need(offices.length>0,'empty native office region requires review')
  return {label,country,control:tree(control),paneAttrs:structuredClone(pane.attrs),offices,tree:tree(pane)}
 })
 need(new Set(groups.map(g=>g.paneAttrs.id)).size===groups.length,'ambiguous native office-country groups')
 const unassignedOffices=all(section,n=>cls(n,'location-card')).filter(card=>!assignments.has(card)).map(card=>office(card))
 return {identity,schemas,groups,unassignedOffices,tree:tree(section)}
}
export function makeListingObservation(row,clock=null){
 return {source:SOURCE,company:COMPANY,jobId:row.jobId,requisitionId:null,title:row.title,sourceUrl:row.sourceUrl,nativeCanonicalRoleURL:row.sourceUrl,
  nativeLocation:row.nativeLocation,country:null,city:null,state:null,location:null,department:null,legalEmployer:null,
  applyUrl:null,link:null,applicationUrlIsGeneric:true,applicationVisited:false,activeApplyVerified:false,numberOfOpenings:row.numberOfOpenings,
  nativeListingPreviews:structuredClone(row.previews),employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
  postingDate:null,postedAt:null,closingDate:null,firstEverPublication:null,jobDescription:null,sourceDescription:null,remoteStatus:null,
  nativeHiringOrganization:{name:COMPANY,url:'https://cyfuture.com/'},nativeSourceRecord:{listing:structuredClone(row)},
  sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'native-country-unproven',sourceCountryScopeUnresolved:true,
  sourceNativeCriteriaContainerRetained:false,nativeRoleClosingReconciled:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:clock}
}
export function readRole(html,row,{clock=null}={}){
 need(isRoleURL(row.sourceUrl),'own declared role identity required')
 const {d,identity,schemas}=schemaAndIdentity(html,/^Apply for Job ID \d+(?: |$)/)
 need(identity.titles[0].match(/^Apply for Job ID (\d+)(?: |$)/)?.[1]===row.jobId,'native role ID conflict')
 const section=one(d.nodes(n=>n.tag==='section'&&n.attrs.id==='section1'&&cls(n,'cyf-opp-details')),'whole native role scope')
 need(!all(section,n=>['iframe','object','embed'].includes(n.tag)).length,'delegated native role criteria require review')
 const visible=readVisibleNativeDocument(html,{strict:true}),v=one(visible.nodes(n=>n.tag==='section'&&n.attrs.id==='section1'&&cls(n,'cyf-opp-details')),'visible whole role scope')
 need(JSON.stringify(coverage(section))===JSON.stringify(coverage(v,true)),'hidden or unreviewed native role criteria')
 const parts=within(section,n=>cls(n,'opportunitylist')).map(n=>({headings:within(n,c=>c.tag==='h2').map(nativeText),text:nativeText(n),tree:tree(n)}))
 const fields=new Map()
 for(const p of parts){need(p.headings.length<=1,'ambiguous native criterion headings');if(!p.headings.length){need(p.text==='Apply Now','unreviewed native role block');continue}
  const key=p.headings[0];need(['Job Title','Job Responsibilities','Skill Requirement','Perks and Benefits','Recruiter Details'].includes(key)&&!fields.has(key),'unreviewed or duplicate native role field');fields.set(key,p)}
 need(fields.has('Job Title')&&fields.has('Job Responsibilities')&&fields.has('Skill Requirement'),'complete native role criteria unavailable')
 const title=fields.get('Job Title').text.slice('Job Title'.length).trim()
 need(title&&(!row.title||title===row.title),'native listing/detail title conflict')
 const links=within(section,n=>n.tag==='a'&&nativeText(n)==='Apply Now'),applications=[...new Set(links.map(n=>applyURL(n.attrs.href)))]
 need(applications.length===1,'one declared shared application required')
 const description=nativeText(section);need(description.length>500,'incomplete whole native role content')
 const job={...makeListingObservation(row,clock),title,applyUrl:applications[0],link:applications[0],jobDescription:description,sourceDescription:description,
  nativeSourceRecord:{listing:structuredClone(row),role:{identity,schemas,parts,tree:tree(section)}},sourceNativeCriteriaContainerRetained:true}
 return job
}
const escaped=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const workplaceScopes=text=>String(text??'').match(/\b(?:(?:country|(?:work |job |office |posting |employment )?location|work\s?site|duty station)\s*:|(?:located|based|stationed|posted)\s+(?:in|at|from)\b|work from anywhere\b|overseas\b|abroad\b|(?:this|the) (?:role|post|position|job) (?:(?:is|will be|shall be) )?(?:located|based|operates|works) (?:in|at|from)\b)[^.!?\n]{0,160}/gi)||[]
const geographicAttributes=node=>all(node,n=>Object.keys(n.attrs).some(k=>/^(?:data-(?:country|location|worksite)|itemprop)$/i.test(k)&&
 (k!=='itemprop'||/country|location|worksite|address/i.test(n.attrs[k])))).map(tree)
export function bindOfficeCountry(job,offices){
 const city=job.nativeLocation,pattern=new RegExp('\\b'+escaped(city)+'\\b','i')
 const matching=[...offices.groups.flatMap(g=>g.offices),...offices.unassignedOffices].filter(o=>pattern.test(o.heading)||pattern.test(o.address))
 const fields=workplaceScopes(job.sourceDescription)
 const listingFields=job.nativeListingPreviews.filter(p=>/\b(?:country|location|work\s?site|duty station)\b/i.test(p.label)||workplaceScopes(p.text).length)
 const officeFields=matching.flatMap(o=>workplaceScopes(nativeText(o.tree)).map(text=>({heading:o.heading,text})))
 const attributes=[...geographicAttributes(job.nativeSourceRecord.listing.card),...geographicAttributes(job.nativeSourceRecord.role.tree),...matching.flatMap(o=>geographicAttributes(o.tree))]
 if(!matching.length||matching.some(o=>o.country!=='India')||fields.length||listingFields.length||officeFields.length||attributes.length){
  job.sourceNativeCountryContext={nativeRoleLocation:city,matchingOfficeGroups:matching.map(o=>({heading:o.heading,countryLabel:o.countryLabel,panelId:o.panelId})),
   unreviewedRoleWorkplaceScopes:fields,unreviewedListingWorkplaceScopes:structuredClone(listingFields),unreviewedOfficeWorkplaceScopes:officeFields,unreviewedGeographicAttributes:attributes}
  return job
 }
 job.country='India';job.location=city;job.sourceCountryScopeUnresolved=false;job.sourceDetailFailureKind='native-closing-unreconciled'
 job.sourceWorksiteCountryProof={method:'role-location-to-publisher-office-country-group',contextualBinding:true,literalRoleCountry:false,
  nativeRoleLocation:city,country:'India',countryLabel:'INDIA',contactURL:CONTACT,exactCampusEstablished:false,
  matchingOffices:matching.map(({heading,address,countryLabel,panelId})=>({heading,address,countryLabel,panelId}))}
 return job
}
const email=value=>{
 need(typeof value==='string'&&/^(?:[a-f0-9]{2}){2,512}$/i.test(value),'unreviewed public email encoding')
 const b=Buffer.from(value,'hex'),text=new TextDecoder('utf8',{fatal:true}).decode(Uint8Array.from(b.subarray(1),v=>v^b[0])).trim()
 need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text),'invalid public email encoding');return text
}
// Compare public semantic values while preserving both actual source models.
const logical=value=>{
 if(!value||typeof value!=='object')return value
 if(Array.isArray(value))return value.map(logical)
 return Object.fromEntries(Object.entries(value).map(([key,v])=>{
  if(key==='attrs'){
   const attrs=structuredClone(v)
   if(attrs['data-cfemail'])attrs['data-cfemail']='decoded-public-email:'+email(attrs['data-cfemail'])
   if(typeof attrs.href==='string'&&/^\/cdn-cgi\/l\/email-protection#[a-f0-9]+$/i.test(attrs.href))attrs.href='/cdn-cgi/l/email-protection#decoded-public-email:'+email(attrs.href.split('#')[1])
   return [key,attrs]
  }
  return [key,logical(v)]
 }))
}
export const equivalent=(a,b)=>JSON.stringify(logical(a))===JSON.stringify(logical(b))
