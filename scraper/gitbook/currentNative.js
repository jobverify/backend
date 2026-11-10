import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {parse} from 'acorn'
import {readNativeDocument,extractActiveDescription,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {createPublishingGapAtsScraper} from '../../scraper-support/utils/publishingGapAts.js'
import {verifyUnavailableAshbyRoles} from '../../scraper-support/utils/ashbyScopeEvidence.js'
import {captureActiveHiringScope} from '../../scraper-support/shared/kekaCurrentSourceScope.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const official='https://www.gitbook.com/careers',feed='https://api.ashbyhq.com/posting-api/job-board/GitBook'
const norm=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const sha=value=>createHash('sha256').update(value).digest('hex')
const equal=(left,right)=>JSON.stringify(left)===JSON.stringify(right)
const reviewed=JSON.parse(readFileSync(new URL('./current.scope.json',import.meta.url),'utf8'))
const reviewedProfiles=[reviewed,...['current-20261105.scope.json','current-20261107.scope.json','current-20261110.scope.json','current-continuation-20261110.scope.json']
 .map(file=>JSON.parse(readFileSync(new URL('./'+file,import.meta.url),'utf8')))]
const schemaFields=new Set(['@context','@type','title','description','directApply','identifier','datePosted','hiringOrganization',
 'jobLocation','employmentType','jobLocationType','applicantLocationRequirements'])
const rawFields=new Set(['id','title','department','team','employmentType','location','secondaryLocations','descriptionHtml',
 'descriptionPlain','publishedAt','isListed','isRemote','workplaceType','address','jobUrl','applyUrl'])
const postingFields=new Set(['id','title','departmentName','departmentExternalName','locationName','locationAddress',
 'workplaceType','employmentType','descriptionHtml','isListed','isConfidential','teamNames','secondaryLocationNames',
 'compensationTierSummary','compensationTiers','applicationDeadline','compensationTierGuideUrl','scrapeableCompensationSalarySummary',
 'compensationPhilosophyHtml','applicationLimitCalloutHtml','shouldAskForTextingConsent','shouldAskForWhatsAppConsent',
 'candidateTextingPrivacyPolicyUrl','candidateTextingTermsAndConditionsUrl','legalEntityNameForTextingConsent',
 'automatedProcessingLegalNotice','__typename'])
const regionNames=new Intl.DisplayNames(['en'],{type:'region'}),countries=new Map()
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=regionNames.of(code)
 if(name&&name!==code&&!['ZZ','EU','UN','XA','XB','QO'].includes(code))for(const key of [code,name])countries.set(key.toLowerCase(),name)
}
const country=value=>typeof value==='string'?countries.get(value.trim().toLowerCase())||null:null
const postal=value=>value?.address?.postalAddress||value?.address||{}
const locationIssues=row=>{
 const issues=[]
 for(const [index,location]of [row,...(row.secondaryLocations||[])].entries()){
  const address=location.address,fields=address?.postalAddress||address
  if(index&&Object.keys(location).some(key=>!['location','address'].includes(key)))issues.push('unhandled-secondary-location-fields')
  if(address&&Object.hasOwn(address,'postalAddress')&&Object.keys(address).some(key=>key!=='postalAddress'))issues.push('unhandled-native-address-fields')
  if(!fields||typeof fields!=='object'||Array.isArray(fields)
   ||Object.entries(fields).some(([key,value])=>!['@type','addressCountry','addressLocality','addressRegion','streetAddress','postalCode'].includes(key)
    ||(value!=null&&typeof value!=='string')))issues.push('unhandled-native-postal-fields')
 }
 return issues
}
const fail=message=>{const error=new Error('[gitbook] '+message);Object.assign(error,{softFailure:true,abortRetries:true,failureKind:'source_identity_unverified'});throw error}
const validDate=value=>{
 const parts=typeof value==='string'&&value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/)
 if(!parts)return false
 const[,year,month,day,hour,minute,second,,offsetHour='00',offsetMinute='00']=parts
 return +year>=1000&&+month>=1&&+month<=12&&+day>=1&&+day<=new Date(Date.UTC(+year,+month,0)).getUTCDate()
  &&+hour<24&&+minute<60&&+second<60&&+offsetHour<24&&+offsetMinute<60&&Number.isFinite(Date.parse(value))
}
const plainObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const keysWithin=(value,keys)=>plainObject(value)&&Object.keys(value).every(key=>keys.includes(key))
const schemaLocationValid=value=>keysWithin(value,['@type','address'])&&value['@type']==='Place'
 &&keysWithin(value.address,['@type','addressCountry','addressLocality','addressRegion','streetAddress','postalCode'])
 &&value.address['@type']==='PostalAddress'&&typeof value.address.addressCountry==='string'
 &&typeof value.address.addressLocality==='string'&&Object.values(value.address).every(item=>item==null||typeof item==='string')
const visibleDescription=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),root=doc.nodes(node=>node.tag==='root')[0]
 return root?doc.text(root):''
}
const nativeAppState=(html,bootstrapSha256s)=>{
 const doc=readNativeDocument(html),scripts=doc.nodes(node=>node.tag==='script'&&!node.attrs.src
  &&!Object.hasOwn(node.attrs,'nomodule')&&/^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type||'')
  &&/window\.__appData\s*=/.test(node.raw||''))
 if(scripts.length!==1)throw Error('native-role-app-data-unavailable')
 const program=parse(scripts[0].raw,{ecmaVersion:'latest',sourceType:'script'}),statement=program.body[0],assignment=statement?.expression
 if(statement?.type!=='ExpressionStatement'||assignment?.type!=='AssignmentExpression'
  ||assignment.operator!=='='||assignment.left?.type!=='MemberExpression'||assignment.left.computed
  ||assignment.left.object?.name!=='window'||assignment.left.property?.name!=='__appData'
  ||assignment.right?.type!=='ObjectExpression'||!bootstrapSha256s.includes(sha(scripts[0].raw.slice(statement.end))))throw Error('native-app-assignment-not-active-literal-or-reviewed-bootstrap')
 // Read exactly the AST-validated right-hand side. A comment/string containing
 // another window.__appData assignment cannot supply this program's data.
 const app=JSON.parse(scripts[0].raw.slice(assignment.right.start,assignment.right.end))
 return{app,doc}
}
const nativeApp=(html,bootstrapSha256s)=>{
 const{app,doc}=nativeAppState(html,bootstrapSha256s)
 const schemas=doc.nodes(node=>node.tag==='script'&&!node.attrs.src&&node.attrs.type==='application/ld+json')
  .flatMap(node=>{const value=JSON.parse(node.raw||'');return Array.isArray(value)?value:Array.isArray(value?.['@graph'])?value['@graph']:[value]})
  .filter(value=>value?.['@type']==='JobPosting')
 if(schemas.length!==1)throw Error('native-role-schema-unavailable')
 return{app,schema:schemas[0]}
}

async function inspectEmployer(page,fetchProgram,signal){
 if(page?.status!==200||page.url!==official||typeof page.html!=='string'||!page.html.trim()
  ||!activeHead(page.html).titles.some(title=>/GitBook Careers/i.test(title)))fail('employer response unavailable')
 const doc=readNativeDocument(page.html),links=doc.nodes(node=>['a','area'].includes(node.tag)&&node.attrs.href).map(node=>{
  try{return{url:new URL(node.attrs.href,page.url),text:doc.text(node)}}catch{return null}
 }).filter(Boolean)
 const ids=[...new Set(links.flatMap(({url})=>url.origin==='https://jobs.ashbyhq.com'&&!url.search&&!url.hash
  ?url.pathname.match(/^\/GitBook\/([a-z\d-]+)(?:\/application)?$/i)?.slice(1)||[]:[]))].sort()
 if(!ids.length)fail('active employer role handoff unavailable')
 const scope=captureActiveHiringScope(page.html,page.url)
 const profile=reviewedProfiles.find(value=>value.scope?equal(scope,value.scope):sha(JSON.stringify(scope))===value.scopeSha256)
 if(!profile)fail('employer declaration scope changed; binding unavailable')
 const declaredProgramProofs=[]
 if(profile.declaredPrograms){
  // This finite deployment is accepted only with its actually declared main and
  // preload programs. Hash complete bytes; never execute or normalize programs.
  const declared=[...doc.nodes(node=>node.tag==='script'&&node.attrs['data-framer-bundle']==='main').map(node=>node.attrs.src),
   ...doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='modulepreload').map(node=>node.attrs.href)]
  if(!equal(declared,profile.declaredPrograms.map(program=>program.url)))fail('current declared program set changed')
  for(const expected of profile.declaredPrograms){
   signal?.throwIfAborted()
   const program=await fetchProgram(expected.url,{signal});signal?.throwIfAborted()
   if(program?.status!==200||program.url!==expected.url||typeof program.html!=='string'
    ||! /^(?:text|application)\/(?:javascript|ecmascript)(?:\s*;|$)/i.test(program.contentType||'')
    ||Buffer.byteLength(program.html)!==expected.bytes||sha(program.html)!==expected.sha256){
    try{fail('current declared program response/status/MIME/complete bytes changed')}catch(error){
     if(Number.isInteger(program?.status)&&program.status>=100&&program.status<=599)error.status=program.status
     error.requestUrl=expected.url;throw error
    }
   }
   declaredProgramProofs.push({...expected,status:program.status,finalURL:program.url,contentType:program.contentType})
  }
 }
 const additionalHiringSurfaces=[...new Set(links.filter(({url,text})=>url.origin!=='https://jobs.ashbyhq.com'
  &&url.hostname.replace(/^www\./,'')!=='gitbook.com'&&/career|jobs?|apply|open.roles/i.test(url.pathname+' '+text)).map(({url})=>url.href))].sort()
 return{ids,scope,additionalHiringSurfaces,bodySha256:sha(page.html),...(profile.declaredPrograms?{declaredProgramProofs}:{}),
  nativeAppBootstrapSha256s:[profile.nativeAppBootstrap.sha256,...(profile.nativeAppBootstrap.additionalReviewedSha256||[])],
  bindingMethod:'reviewed-first-party-responsive-SSR-role-declarations; partial-only',
  strictAllConditionsVisibleRoleAnchors:readVisibleNativeDocument(page.html,{strict:true}).nodes(node=>node.tag==='a'&&node.attrs.href?.startsWith('https://jobs.ashbyhq.com/GitBook/')).length,
  reviewedDeclarationProvenance:profile.provenance}
}

async function inspectRole(row,fetchPage,signal,bootstrapSha256s){
 const proof={jobId:row.id,url:row.jobUrl,complete:false,country:null,reasons:[]}
 try{
  const page=await fetchPage(row.jobUrl,{signal});signal?.throwIfAborted()
  if(page?.status!==200||page.url!==row.jobUrl||typeof page.html!=='string'||Buffer.byteLength(page.html)>3000000)throw Error('native-role-response-unavailable')
  proof.responseSha256=sha(page.html)
  const{app,schema}=nativeApp(page.html,bootstrapSha256s),posting=app.posting
  proof.nativeAppData=app;proof.nativeJobPosting=schema
  if(app.environment!=='production'||app.maintenanceMode!==false||app.schedulingMaintenanceMode!==false
   ||app.organization?.hostedJobsPageSlug!=='GitBook'||app.organization.name!=='GitBook'
   ||app.organization.publicWebsite!=='https://www.gitbook.com/'
   ||posting?.id!==row.id||posting.isListed!==true||posting.isConfidential!==false
   ||norm(posting.title)!==norm(row.title)||norm(posting.locationName)!==norm(row.location)
   ||posting.workplaceType!==row.workplaceType||posting.employmentType!==row.employmentType
   ||posting.descriptionHtml!==row.descriptionHtml
   ||!equal(posting.secondaryLocationNames,(row.secondaryLocations||[]).map(location=>location.location))
   ||schema.identifier?.value!==row.id||norm(schema.title)!==norm(row.title)
   ||schema.description!==row.descriptionHtml||!extractActiveDescription(row.descriptionHtml))throw Error('native-role-state-not-reconciled')
  if(schema.hiringOrganization?.['@type']!=='Organization'||schema.hiringOrganization.name!=='GitBook'
   ||schema.hiringOrganization.sameAs!=='https://www.gitbook.com/'||schema.identifier?.['@type']!=='PropertyValue'
   ||schema.identifier.name!=='GitBook')proof.reasons.push('native-schema-employer-not-reconciled')
  if(schema['@context']!=='https://schema.org/'||Object.keys(schema).some(key=>!schemaFields.has(key))||[...schemaFields].some(key=>!Object.hasOwn(schema,key))
   ||Object.keys(schema.hiringOrganization||{}).some(key=>!['@type','name','sameAs','logo'].includes(key))
   ||Object.keys(schema.identifier||{}).some(key=>!['@type','name','value'].includes(key)))proof.reasons.push('unhandled-native-schema-criteria')
  const schemaLocations=Array.isArray(schema.jobLocation)?schema.jobLocation:[schema.jobLocation]
  if(schema.directApply!==true||typeof schema.hiringOrganization?.logo!=='string'
   ||!schemaLocations.length||schemaLocations.some(value=>!schemaLocationValid(value))
   ||!keysWithin(schema.applicantLocationRequirements,['@type','name'])||schema.applicantLocationRequirements['@type']!=='Country'
   ||typeof schema.applicantLocationRequirements.name!=='string'
   ||schema.employmentType!==({FullTime:'FULL_TIME',PartTime:'PART_TIME',Contract:'CONTRACTOR',Intern:'INTERN'}[row.employmentType]))proof.reasons.push('unhandled-native-schema-types-or-location-fields')
  if(!validDate(row.publishedAt)||schema.datePosted!==new Date(row.publishedAt).toISOString().slice(0,10))proof.reasons.push('native-publication-date-not-reconciled')
  if(!equal(row.isRemote,row.workplaceType==='Remote')||schema.jobLocationType!==(row.isRemote?'TELECOMMUTE':undefined))proof.reasons.push('conflicting-native-remote-contract')
  if(norm(extractActiveDescription(row.descriptionHtml))!==norm(visibleDescription(row.descriptionHtml)))proof.reasons.push('hidden-native-criteria')
  if(Object.keys(row).some(key=>!rawFields.has(key))||Object.keys(posting).some(key=>!postingFields.has(key)))proof.reasons.push('unhandled-native-role-fields')
  if([...rawFields].some(key=>!Object.hasOwn(row,key)))proof.reasons.push('native-role-field-presence-changed')
  if([...postingFields].some(key=>!Object.hasOwn(posting,key)))proof.reasons.push('native-posting-field-presence-changed')
  if(['id','title','departmentName','departmentExternalName','locationName','workplaceType','employmentType','descriptionHtml','legalEntityNameForTextingConsent','__typename'].some(key=>typeof posting[key]!=='string')
   ||['isListed','isConfidential','shouldAskForTextingConsent','shouldAskForWhatsAppConsent'].some(key=>typeof posting[key]!=='boolean')
   ||['locationAddress','candidateTextingPrivacyPolicyUrl','candidateTextingTermsAndConditionsUrl'].some(key=>posting[key]!==null))proof.reasons.push('unreviewed-native-posting-field-types')
  proof.reasons.push(...locationIssues(row))
  for(const key of ['department','team','employmentType','location','publishedAt','descriptionHtml','descriptionPlain'])if(typeof row[key]!=='string')proof.reasons.push('native-role-field-type-changed:'+key)
  if(!Array.isArray(posting.teamNames)||posting.teamNames.some(value=>typeof value!=='string')
   ||norm(posting.departmentName)!==norm(row.department)||norm(posting.departmentExternalName)!==norm(row.department)
   ||!posting.teamNames.includes(row.team))proof.reasons.push('unreconciled-native-department-or-team')
  if(typeof row.isRemote!=='boolean'||!Array.isArray(posting.compensationTiers)||posting.compensationTiers.length
   ||['compensationTierSummary','compensationTierGuideUrl','scrapeableCompensationSalarySummary','compensationPhilosophyHtml','applicationLimitCalloutHtml','automatedProcessingLegalNotice']
    .some(key=>posting[key]!==null)||posting.applicationDeadline!==null)proof.reasons.push('unreconciled-native-additional-criteria')
  const alternatives=[row,...(row.secondaryLocations||[])],nativeCountries=alternatives.map(location=>country(postal(location).addressCountry))
  const locations=Array.isArray(schema.jobLocation)?schema.jobLocation:[schema.jobLocation]
  const schemaCountries=locations.map(location=>country(location?.address?.addressCountry))
  const applicant=country(schema.applicantLocationRequirements?.name)
  const resolved=nativeCountries[0]
  if(!proof.reasons.length&&resolved&&nativeCountries.every(value=>value===resolved)&&schemaCountries.length===nativeCountries.length
   &&schemaCountries.every(value=>value===resolved)&&(!row.isRemote||applicant===resolved)
   &&(!posting.locationAddress||country((posting.locationAddress.postalAddress||posting.locationAddress).addressCountry)===resolved))proof.country=resolved
  proof.complete=proof.reasons.length===0
 }catch(error){signal?.throwIfAborted();proof.reasons.push(error.message)}
 return proof
}

// The registered producer retains Global behavior. The unchanged public ATS
// engine validates each complete, original envelope before this source maps its
// global records. "Remote" and a Europe time window cannot become a country.
export async function runCurrentGitBook({fetchPage,fetchProgram,fetchJson,mapJobs,now,onAudit,signal}){
 signal?.throwIfAborted()
 const openingPage=await fetchPage(official,{signal}),employer=await inspectEmployer(openingPage,fetchProgram,signal)
 const provider={source:'gitbook',companyName:'GitBook',atsPlatform:'ashby',boardToken:'GitBook',sourceScopeComplete:false}
 const validator=createPublishingGapAtsScraper(provider)
 const opening=await fetchJson(feed,{signal});await validator.run({fetchJson:async()=>opening,signal})
 const rows=opening.jobs.filter(row=>row.isListed)
 const missing=employer.ids.filter(id=>!rows.some(row=>row.id===id))
 const unavailable=await verifyUnavailableAshbyRoles(missing,provider,{fetchPage:async(url,options)=>{
  const page=await fetchPage(url,options);signal?.throwIfAborted()
  if(page?.status===404){
   const{app}=nativeAppState(page.html,employer.nativeAppBootstrapSha256s)
   if(app.environment!=='production'||app.maintenanceMode!==false||app.schedulingMaintenanceMode!==false
    ||app.organization!==null||app.posting!==null||app.jobBoard!==null)throw Error('actual-native-unavailable-state-not-established')
  }
  return page
 },signal})
 const openingDetails=[]
 for(const row of rows)openingDetails.push(await inspectRole(row,fetchPage,signal,employer.nativeAppBootstrapSha256s))
 const closingDetails=[]
 for(const row of rows)closingDetails.push(await inspectRole(row,fetchPage,signal,employer.nativeAppBootstrapSha256s))
 const closing=await fetchJson(feed,{signal});await validator.run({fetchJson:async()=>closing,signal})
 if(!equal(opening,closing))fail('closing-inventory-changed')
 const closingPage=await fetchPage(official,{signal});signal?.throwIfAborted()
 const closingEmployer=await inspectEmployer(closingPage,fetchProgram,signal)
 const employerScopeStable=equal(employer.scope,closingEmployer.scope)
 const details=openingDetails.map((proof,index)=>({...proof,closingResponseSha256:closingDetails[index].responseSha256,
  country:proof.country===closingDetails[index].country?proof.country:null,
  complete:proof.complete&&closingDetails[index].complete&&equal(proof.nativeAppData?.posting,closingDetails[index].nativeAppData?.posting)
   &&equal(proof.nativeJobPosting,closingDetails[index].nativeJobPosting),
  reasons:[...proof.reasons,...closingDetails[index].reasons]}))
 const jobs=mapJobs(opening).map(job=>{
  const at=rows.findIndex(row=>row.id===job.jobId),row=rows[at],proof=details[at],address=postal(row)
  return{...job,country:proof.country,city:/^remote\s*$/i.test(address.addressLocality||'')?null:address.addressLocality||null,
   state:address.addressRegion||null,nativeAddressCountry:address.addressCountry??null,sourceNativeRecord:row,
   sourceNativeDescriptionPlain:row.descriptionPlain,sourceDescription:row.descriptionHtml,
   jobDescription:visibleDescription(row.descriptionHtml)||null,postingDate:validDate(row.publishedAt)?row.publishedAt:null,
   sourceDetailComplete:proof.complete&&Object.keys(opening).every(key=>['apiVersion','jobs'].includes(key)),sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
   source:'gitbook',link:job.applyUrl,scrapedAt:now()}
 })
 const observed={source:'gitbook',recordKind:'vacancy-rows',observedRecordCount:opening.jobs.length,
  observedVacancyCount:opening.jobs.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
 const audit={...observed,nativeCount:opening.jobs.length,nativeRawOpening:opening,nativeRawClosing:closing,closingInventoryMatches:true,
  employerOpening:employer,employerClosing:closingEmployer,employerScopeStable,
  additionalHiringSurfaces:[...new Set([...employer.additionalHiringSurfaces,...closingEmployer.additionalHiringSurfaces])],
  unavailableAdvertisedRoleProofs:unavailable.proofs,unresolvedAdvertisedRoleIds:missing.filter(id=>!unavailable.proofs.some(proof=>proof.jobId===id)),
  detailProofs:details,unknownCountryRoleIds:details.filter(proof=>!proof.country).map(proof=>proof.jobId),
  sourceScopeComplete:false,lifecycleCleanupAllowed:false,authoritativeSourceTotal:null,authoritativeIndiaFacetCount:null,
  reasons:['current-corporate-renderer-and-complete-source-scope-unverified',...(details.some(proof=>!proof.country)?['native-country-scope-unresolved']:[]),
   ...(!employerScopeStable?['changed-corporate-hiring-scope']:[])]}
 onAudit?.(audit)
 signal?.throwIfAborted()
 attachSourceObservationEvidence(jobs,observed)
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
 Object.defineProperty(jobs,'sourceAudit',{value:audit})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:feed,firstParty:true,listingComplete:false,
  pagesFetched:4+rows.length*2+unavailable.pagesFetched+(employer.declaredProgramProofs?.length||0)+(closingEmployer.declaredProgramProofs?.length||0),reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:audit.reasons.join(';')})
}
