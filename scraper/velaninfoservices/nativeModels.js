import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
export const SOURCE='velaninfoservices',COMPANY='Velan Info Services',CAREERS='https://www.velaninfo.com/careers',INDEX='https://www.velaninfo.com/jobs',CONTACT='https://www.velaninfo.com/contact'
export const need=(v,m)=>{if(!v)throw Object.assign(Error('Velan native: '+m),{code:'VELAN_NATIVE_CONTRACT',abortRetries:true})}
export const hash=v=>createHash('sha256').update(v).digest('hex')
const clean=v=>String(v??'').replace(/\s+/g,' ').trim(),cls=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)
const excluded=new Set(['script','style','template','noscript','svg','iframe','object','embed'])
export const nativeText=n=>clean(typeof n==='string'?decodeHTML(n):excluded.has(n.tag)?'':n.children.map(nativeText).join(' '))
const all=(n,p)=>typeof n==='string'?[]:[...(p(n)?[n]:[]),...n.children.flatMap(c=>all(c,p))]
const one=(a,m)=>{need(a.length===1,'one '+m+' required');return a[0]}
const tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:structuredClone(n.attrs),children:n.children.map(tree),...(n.raw===undefined?{}:{raw:n.raw})}
const coverage=(n,visible=false,application=null)=>typeof n==='string'?clean(decodeHTML(n))||null:n===application||excluded.has(n.tag)||visible&&n.inert?null:
 {tag:n.tag,attrs:structuredClone(n.attrs),children:n.children.map(c=>coverage(c,visible,application)).filter(c=>c!==null)}
const withoutForms=n=>typeof n==='string'?decodeHTML(n):n.tag==='form'||excluded.has(n.tag)?'':n.children.map(withoutForms).join(' ')
const roleCriteriaText=(n,application,visible=false)=>typeof n==='string'?decodeHTML(n):n===application||excluded.has(n.tag)||visible&&n.inert?'':n.children.map(c=>roleCriteriaText(c,application,visible)).join(' ')
const roleRegion=(root,metadata)=>{
 const parent=one(all(root,n=>n.children.includes(metadata)),'native role-region parent')
 const start=parent.children.findIndex(n=>typeof n!=='string'&&cls(n,'banner-section'))
 const end=parent.children.findIndex(n=>typeof n!=='string'&&all(n,c=>cls(c,'credentials-section-home')).length)
 need(start>=0&&end>parent.children.indexOf(metadata),'native full role-region boundaries changed')
 return {tag:'native-role-region',attrs:{},children:parent.children.slice(start,end)}
}
const reviewApplication=form=>{
 const labels=['Full Name *','Email ID *','Phone Number *','Position Applied For *','Educational Qualification *','Years of Experience *','Linkedin Profile','Resume *','Browse Select File','Enter Captcha *','',
  'By checking this box, you agree to receive text messages from Velan Info Services India Pvt Ltd, related to conversations of messages. Frequency will vary. Reply "STOP" to opt-out at anytime. For customer care, reply "HELP" to +1 516 717 2049 . Messages and data rates may apply. Learn more in our privacy policy .']
 need(JSON.stringify(all(form,n=>n.tag==='label').map(nativeText))===JSON.stringify(labels),'unreviewed application eligibility label')
 const prose=n=>typeof n==='string'?clean(decodeHTML(n)):['label','select','button',...excluded].includes(n.tag)?'':n.children.map(prose).filter(Boolean).join(' ')
 need(!prose(form),'unreviewed mandatory content inside application form')
 need(all(form,n=>n.tag==='button').every(n=>nativeText(n)==='Submit'),'unreviewed application action text')
 const choices={
  'highest_degree[]':['B.Arch','B.B.A','B.Com','B.E/B. Tech','B.Lib','B.Sc','BA','BSW','Diploma','M.A','M.B.A','M.C.A','M.Com','Ph.D'],
  years_of__experience:['Select Years of Experience','0 to 1 Year','1+ Years','2+ Years','3+ Years','4+ Years','5+ Years','6+ Years','7+ Years']}
 for(const select of all(form,n=>n.tag==='select')){
  const actual=all(select,n=>n.tag==='option').map(nativeText)
  if(select.attrs.name==='position_applied_for')need(actual[0]==='Select Position Applied For'&&actual.slice(1).every(t=>/^[A-Za-z][A-Za-z &-]+$/.test(t)),'unreviewed application position choices')
  else need(choices[select.attrs.name]&&JSON.stringify(actual)===JSON.stringify(choices[select.attrs.name]),'unreviewed application qualification choices')
 }
}
const document=(html,title)=>{
 const d=readNativeDocument(html),root=one(d.nodes(n=>n.tag==='root'),'document'),identity=activeHead(html)
 need(identity.titles.length===1&&(typeof title==='string'?identity.titles[0]===title:title.test(identity.titles[0])),'native publisher/page identity changed')
 need(!all(root,n=>n.tag==='base').length,'unreviewed native base')
 const schemas=all(root,n=>n.tag==='script'&&(n.attrs.type||'').trim().toLowerCase()==='application/ld+json').map(n=>{
  try{return JSON.parse(n.raw)}catch{need(false,'invalid native structured data')}})
 need(schemas.length===0,'new native structured job data requires field review')
 return {d,root,identity,schemas}
}
export const isRoleURL=url=>{try{const u=new URL(url);return u.origin==='https://www.velaninfo.com'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/jobs\/[a-z0-9-]+$/.test(u.pathname)}catch{return false}}
const calendar=value=>{
 const m=/^(\d{2})-(\d{2})-(\d{4})$/.exec(value);need(m,'native posted calendar label unavailable')
 const [day,month,year]=m.slice(1).map(Number),d=new Date(Date.UTC(year,month-1,day))
 need(year>=1900&&year<=2200&&d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day,'invalid native posted calendar date')
 return m[3]+'-'+m[2]+'-'+m[1]
}
export function readCareers(html){
 const {d,identity,schemas}=document(html,'Velan | Jobs | Career Opportunities | IT & BPO Jobs')
 const publisherHeading=one(d.nodes(n=>n.tag==='h1'&&nativeText(n)==='Career Opportunities'),'current publisher heading')
 const intro=one(d.nodes(n=>n.tag==='h2'&&nativeText(n)==='Build Your Dream Career with Velan'),'native careers introduction')
 const jobsDeclarations=d.nodes(n=>n.tag==='a'&&n.attrs.href===INDEX),officeDeclarations=d.nodes(n=>n.tag==='a'&&n.attrs.href===CONTACT)
 need(jobsDeclarations.length>0&&jobsDeclarations.some(n=>nativeText(n)==='Current Openings')&&officeDeclarations.length>0,'current declared jobs/contact handoff missing')
 return {identity,schemas,publisherHeading:tree(publisherHeading),introduction:tree(intro),jobsDeclarations:jobsDeclarations.map(tree),officeDeclarations:officeDeclarations.map(tree),jobsURL:INDEX,contactURL:CONTACT}
}
export function readIndex(html){
 const {d,root,identity,schemas}=document(html,'Velan | Current Openings | IT & BPO Job Opportunites at Velan')
 need(d.nodes(n=>n.tag==='h1'&&nativeText(n)==='Join Our Team').length===1&&d.nodes(n=>n.tag==='h2'&&nativeText(n)==='Current Openings').length===1,'native openings context missing')
 const assigned=new Set(),rows=[],groups=[],containers=d.nodes(n=>cls(n,'job-opening-group'))
 for(const group of containers){
  let currentGroup=null
  for(const card of all(group,n=>n.tag==='h2'||cls(n,'job-opening-list'))){
   if(card.tag==='h2'){
    currentGroup={heading:nativeText(card),attrs:structuredClone(card.attrs),containerAttrs:structuredClone(group.attrs),tree:tree(card)}
    need(currentGroup.heading,'native role group heading missing');groups.push(currentGroup);continue
   }
   need(currentGroup,'role without a preceding native group heading')
   need(!assigned.has(card),'overlapping native role groups');assigned.add(card)
   const label=nativeText(one(all(card,n=>n.tag==='h3'),'whole native role heading')),m=/^(.+?)\s+\(JOB ID:\s*([A-Z0-9-]+)\)\s*-\s*(\d+)\s+Positions?$/i.exec(label)
   need(m&&Number.isSafeInteger(Number(m[3]))&&Number(m[3])>0&&Number(m[3])<=10000,'native title/job identity or position count unavailable')
   const previews=all(card,n=>n.tag==='li').map(n=>({label:all(n,c=>['b','strong'].includes(c.tag)).map(nativeText).join(' '),text:nativeText(n),tree:tree(n)})),locations=previews.filter(p=>/^Location:/i.test(p.text)),experiences=previews.filter(p=>/^Experience:/i.test(p.text))
   const nativeLocation=one(locations,'native role location').text.replace(/^Location:\s*/i,''),experience=one(experiences,'native experience').text.replace(/^Experience:\s*/i,'')
   const dateText=nativeText(one(all(card,n=>n.tag==='p'&&cls(n,'cpst')),'native Posted on field')),date=/^Posted on:\s*(.+)$/i.exec(dateText)?.[1]
   const link=one(all(card,n=>n.tag==='a'&&nativeText(n)==='Apply Now'),'published own-role handoff'),sourceUrl=new URL(link.attrs.href,INDEX).href
   need(nativeLocation&&experience&&isRoleURL(sourceUrl)&&new URL(sourceUrl).pathname.endsWith('-'+m[2]),'unreviewed own role URL or metadata')
   rows.push({jobId:m[2],title:m[1],heading:label,nativeLocation,experience,numberOfOpenings:Number(m[3]),postingLabel:date,postingDate:calendar(date),sourceUrl,
    group:{heading:currentGroup.heading,attrs:structuredClone(currentGroup.attrs),containerAttrs:structuredClone(group.attrs)},previews,card:tree(card)})
  }
 }
 need(rows.length&&rows.length<=29&&assigned.size===all(root,n=>cls(n,'job-opening-list')).length,'missing, unassigned or oversized native role set')
 need(new Set(rows.map(r=>r.jobId)).size===rows.length&&new Set(rows.map(r=>r.sourceUrl)).size===rows.length,'duplicate native role identity')
 return {identity,schemas,groups,containers:containers.map(tree),rows}
}
export function readOfficeIndex(html){
 const {d,identity,schemas}=document(html,'Velan | Contact Details | BPM Service Provider | BPO | IT Service')
 const section=one(d.nodes(n=>n.tag==='section'&&cls(n,'contact-sec')),'whole native contact scope'),ownedAddresses=new Set(),candidates=[]
 const locations=all(section,n=>cls(n,'location'));need(locations.length>0,'native office containers missing')
 for(const [ordinal,location]of locations.entries()){
  let heading=null
  for(const p of location.children.filter(n=>typeof n!=='string')){
   if(p.tag==='h3'){heading=nativeText(p);continue}
   if(p.tag!=='p')continue
   need(!ownedAddresses.has(p),'overlapping office-address containers');ownedAddresses.add(p)
   const address=nativeText(p),label=/\b(INDIA|USA)\s*$/.exec(address)?.[1]??null
   candidates.push({heading,address,country:label==='INDIA'?'India':label==='USA'?'United States':null,countryLabel:label,
    containerOrdinal:ordinal,unreviewedMarkup:all(p,n=>!['p','br'].includes(n.tag)).map(tree),tree:tree(p)})
  }
 }
 const unassignedText=[]
 const collect=n=>{if(typeof n==='string'){const t=clean(decodeHTML(n));if(t)unassignedText.push(t);return}
  if(ownedAddresses.has(n)||excluded.has(n.tag))return;for(const c of n.children)collect(c)}
 collect(section)
 return {identity,schemas,candidates,unassignedText,tree:tree(section)}
}
export function makeListingObservation(row,clock=null){
 return {source:SOURCE,company:COMPANY,jobId:row.jobId,requisitionId:null,title:row.title,sourceUrl:row.sourceUrl,nativeCanonicalRoleURL:row.sourceUrl,
  nativeLocation:row.nativeLocation,country:null,city:null,state:null,location:null,department:null,legalEmployer:null,employmentType:null,remoteStatus:null,
  nativeListingGroup:row.group.heading,nativeListingSummary:row.previews[0]?.text??null,nativeListingPreviews:structuredClone(row.previews),numberOfOpenings:row.numberOfOpenings,
  applyUrl:row.sourceUrl,link:row.sourceUrl,applicationUrlIsGeneric:true,applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false,
  nativeApplicationHandoff:{kind:'declared-public-role-page',url:row.sourceUrl,publicRolePageRead:false,formInteractedWith:false},
  experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:row.postingDate,postedAt:null,closingDate:null,firstEverPublication:null,
  sourcePostingDateLabel:row.postingLabel,sourceDatePrecision:'calendar-date',publicationTimezone:null,jobDescription:null,sourceDescription:null,
  nativeHiringOrganization:{name:COMPANY,url:'https://www.velaninfo.com/'},nativeSourceRecord:{listing:structuredClone(row)},
  sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'native-country-unproven',sourceCountryScopeUnresolved:true,
  sourceNativeCriteriaContainerRetained:false,nativeRoleClosingReconciled:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:clock}
}
export function readRole(html,row,{clock=null}={}){
 need(isRoleURL(row.sourceUrl),'declared own native role required')
 const {d,root,identity,schemas}=document(html,'Velan | '+row.title+' job in '+row.nativeLocation)
 const sectionKinds=['banner-section','job-detail-section','employee-criteria-section','career-form-two','walk-in-section','credentials-section-home','quick-connect-section','footer-nav-section']
 const sections=all(root,n=>n.tag==='section')
 need(sections.length===sectionKinds.length&&sectionKinds.every(k=>sections.filter(n=>cls(n,k)).length===1)
  &&sections.every(n=>sectionKinds.filter(k=>cls(n,k)).length===1),'unreviewed native role section or criteria scope')
 const metadata=one(d.nodes(n=>n.tag==='section'&&cls(n,'job-detail-section')),'whole role metadata')
 const title=nativeText(one(all(metadata,n=>n.tag==='h2'),'own role title')),ids=all(metadata,n=>n.tag==='b'&&/JOB ID:/.test(nativeText(n)))
 need(title===row.title&&nativeText(one(ids,'own native public job ID'))==='(JOB ID: '+row.jobId+')','listing/detail role identity conflict')
 const fields=all(metadata,n=>n.tag==='p').map(nativeText)
 need(fields.includes('Position Title: '+row.title)&&fields.includes('Experience: '+row.experience)&&fields.includes('Posted On: '+row.postingLabel),'listing/detail metadata conflict')
 const reviewedMetadata=new Set(['','Share',row.previews[0]?.text,'Position Title: '+row.title,'Experience: '+row.experience,'Posted On: '+row.postingLabel])
 const unreviewedMetadataFields=fields.filter(text=>!reviewedMetadata.has(text))
 const criteria=one(d.nodes(n=>n.tag==='section'&&cls(n,'employee-criteria-section')),'complete native employee criteria')
 need(!all(criteria,n=>['iframe','object','embed'].includes(n.tag)).length,'delegated native criteria require review')
 const application=one(all(criteria,n=>n.tag==='section'&&cls(n,'career-form-two')),'native inline application context'),form=one(all(application,n=>n.tag==='form'&&n.attrs.id==='careerForm'),'declared inline form')
 const content=one(all(criteria,n=>cls(n,'col-lg-6')&&cls(n,'form-group')),'complete native criterion column')
 const visible=readVisibleNativeDocument(html,{strict:true}),visibleScope=one(visible.nodes(n=>n.tag==='section'&&cls(n,'employee-criteria-section')),'visible criteria scope')
 const visibleApplication=one(all(visibleScope,n=>n.tag==='section'&&cls(n,'career-form-two')),'visible application context')
 need(JSON.stringify(coverage(criteria,false,application))===JSON.stringify(coverage(visibleScope,true,visibleApplication)),'hidden or unreviewed native criteria')
 const headings=all(content,n=>n.tag==='h3').map(nativeText)
 need(['Roles and Responsibilities:','Candidate Profile:','Why Should You Join Velan?'].every(h=>headings.includes(h)),'full responsibilities/candidate/benefit scope missing')
 need(clean(withoutForms(application))==='Apply Now','unreviewed content outside application form')
 const names=['_token','name','email','phone','position_applied_for','position_applied_for_name','highest_degree[]','highest_degree_name','years_of__experience',
  'years_of__experience_name','linkedin_url','uploadfile','captcha','career_detail_page','consent_status_cr']
 need(all(form,n=>['input','select','textarea'].includes(n.tag)).every(n=>names.includes(n.attrs.name)),'new application eligibility field requires review')
 reviewApplication(form)
 const walkIn=one(d.nodes(n=>n.tag==='section'&&cls(n,'walk-in-section')),'whole own-role interview context')
 const region=roleRegion(root,metadata),visibleRoot=one(visible.nodes(n=>n.tag==='root'),'visible document'),visibleMetadata=one(visible.nodes(n=>n.tag==='section'&&cls(n,'job-detail-section')),'visible role metadata')
 const visibleRegion=roleRegion(visibleRoot,visibleMetadata)
 need(all(region,n=>n===criteria).length===1&&all(region,n=>n===walkIn).length===1,'native full role-region scope changed')
 const frames=all(region,n=>['iframe','object','embed'].includes(n.tag)),interviewFrames=new Set(all(walkIn,n=>n.tag==='iframe'))
 need(frames.length===1&&frames.every(n=>interviewFrames.has(n)&&!Object.hasOwn(n.attrs,'srcdoc')&&/^https:\/\/www\.google\.com\/maps\/embed\?pb=/.test(n.attrs.src||'')),
  'delegated native content outside the reviewed unvisited interview map')
 need(clean(roleCriteriaText(region,application))===clean(roleCriteriaText(visibleRegion,visibleApplication,true)),'hidden or unreviewed whole role content')
 const description=clean(roleCriteriaText(region,application));need(description.length>700,'whole native role criteria unavailable')
 return {...makeListingObservation(row,clock),experienceRequired:row.experience,sourceDescription:description,jobDescription:description,
  nativeApplicationHandoff:{kind:'public-role-page-with-inline-form',url:row.sourceUrl,publicRolePageRead:true,formInteractedWith:false},
  nativeSourceRecord:{listing:structuredClone(row),role:{identity,schemas,metadata:tree(metadata),criteria:tree(criteria),criterionColumn:tree(content),applicationForm:tree(form),walkIn:tree(walkIn),
   region:tree(region),unreviewedMetadataFields,pageContextText:nativeText(root),pageGeographicDeclarations:[...identity.metas.filter(m=>/country|location|worksite|job:/i.test([m.name,m.property,m.itemprop].filter(Boolean).join(' '))),...geoAttributes(root)]}},
  sourceNativeCriteriaContainerRetained:true}
}
const escape=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const scopes=text=>String(text??'').match(/\b(?:(?:country|(?:work |job |office |posting |employment )?location|work\s?site|duty station)\s*:|(?:located|based|stationed|posted)\s+(?:in|at|from)\b|work from anywhere\b|overseas\b|abroad\b|(?:this|the) (?:role|post|position|job) (?:(?:is|will be|shall be) )?(?:located|based|operates|works) (?:in|at|from)\b)[^.!?\n]{0,160}/gi)||[]
const geoAttributes=node=>all(node,n=>Object.keys(n.attrs).some(k=>/^(?:data-(?:country|location|worksite)|itemprop)$/i.test(k)&&(k!=='itemprop'||/country|location|worksite|address/i.test(n.attrs[k])))).map(tree)
export function bindOfficeCountry(job,offices){
 const city=job.nativeLocation,pattern=new RegExp('\\b'+escape(city)+'\\b','i'),matching=offices.candidates.filter(o=>pattern.test(o.address))
 const roleFields=scopes(job.nativeSourceRecord.role.pageContextText)
 const listingFields=job.nativeListingPreviews.filter(p=>p.label&&!['Experience:','Location:'].includes(p.label)||!/^Location:\s*/i.test(p.text)&&scopes(p.text).length)
 const officeFields=matching.flatMap(o=>[...scopes(o.address),...(o.unreviewedMarkup.length||/\bcountry\b/i.test(o.address)?[{heading:o.heading,address:o.address,unreviewedMarkup:o.unreviewedMarkup}]:[])]),unassigned=offices.unassignedText.filter(t=>pattern.test(t))
 const attrs=[...geoAttributes(job.nativeSourceRecord.listing.card),...job.nativeSourceRecord.role.pageGeographicDeclarations,...geoAttributes(offices.tree)]
 if(!matching.length||matching.some(o=>o.country!=='India'||o.heading!=='Delivery Center')||roleFields.length||listingFields.length||officeFields.length||unassigned.length||attrs.length||job.nativeSourceRecord.role.unreviewedMetadataFields.length){
  job.sourceNativeCountryContext={nativeRoleLocation:city,matchingWorksites:structuredClone(matching),unreviewedRoleWorkplaceScopes:roleFields,
   unreviewedListingWorkplaceScopes:structuredClone(listingFields),unreviewedOfficeWorkplaceScopes:officeFields,unassignedMatchingText:unassigned,unreviewedGeographicAttributes:attrs,
   unreviewedMetadataFields:structuredClone(job.nativeSourceRecord.role.unreviewedMetadataFields)};return job
 }
 job.country='India';job.location=city;job.sourceCountryScopeUnresolved=false;job.sourceDetailFailureKind='native-closing-unreconciled'
 job.sourceWorksiteCountryProof={method:'role-location-to-publisher-delivery-center-country',contextualBinding:true,literalRoleCountry:false,exactCampusEstablished:false,
  nativeRoleLocation:city,country:'India',contactURL:CONTACT,interviewAddressAloneUsed:false,
  matchingWorksites:matching.map(({heading,address,countryLabel,containerOrdinal})=>({heading,address,countryLabel,containerOrdinal}))}
 return job
}
const logical=value=>{
 if(!value||typeof value!=='object')return value
 if(Array.isArray(value))return value.map(logical)
 const result=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,logical(v)]))
 if(value.tag==='input'&&value.attrs.type==='hidden'&&value.attrs.name==='_token'){
  need(/^[A-Za-z0-9]{40}$/.test(value.attrs.value||''),'unreviewed anonymous form token encoding')
  result.attrs.value='[anonymous form token; original retained]'
 }
 return result
}
export const equivalent=(a,b)=>JSON.stringify(logical(a))===JSON.stringify(logical(b))
