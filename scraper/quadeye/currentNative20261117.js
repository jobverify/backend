import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {clientScriptDeclarations,hasClientDocumentBase} from '../../scraper-support/utils/reviewedClientProgram.js'
import {readLiteralFlightRecords} from '../../scraper-support/utils/kulaFlight.js'
import {nativeCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {currentQuadeyeTransport} from './currentTransport20261117.js'

const profile=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
const ORIGIN=profile.origin,LIST=profile.listingURL,API=profile.inventoryURL
// Exact pinned module58846 exports fixJobText and the current listing/detail
// renderers apply it to Posting_Title. Keep the native input and this proof.
const sha=value=>createHash('sha256').update(value).digest('hex'),fix=value=>value.replace(/\bcypto\b/gi,'Crypto')
const requireCurrent=(ok,message)=>{if(!ok)throw Object.assign(Error('Quadeye current native contract: '+message),{failureKind:'parser_or_contract_error',abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
const one=(values,label)=>{requireCurrent(values.length===1,'unique '+label);return values[0]}
const detailURL=row=>ORIGIN+'/jobs/'+row.id+'/'+row.Posting_Title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-')+'?source=CareerSite'
const applicationURL=row=>ORIGIN+'/job-apply?id='+encodeURIComponent(row.id)+'&title='+encodeURIComponent(row.Posting_Title)
const textKey=value=>extractActiveDescription(value)?.replace(/\s+/g,' ').trim()

function sameNativeViews(listing,detail){
 const {Job_Description:plain,Sub_Users:listingUsers,...listingFields}=listing
 const {Job_Description:rich,Sub_Users:detailUsers,...detailFields}=detail??{}
 // The pinned current renderer never reads Sub_Users. The single-record
 // endpoint expands this nullable internal user DTO; retain both originals
 // and compare each whole DTO again on closing, without granting scope.
 const userExpansion=listingUsers===null&&Array.isArray(detailUsers)&&detailUsers.length>0&&detailUsers.every(user=>user&&typeof user==='object'
  &&isDeepStrictEqual(Object.keys(user).sort(),['emailId','id','name'])&&typeof user.name==='string'&&typeof user.emailId==='string'&&/^\d{12,24}$/.test(user.id))
 return isDeepStrictEqual(listingFields,detailFields)&&(isDeepStrictEqual(listingUsers,detailUsers)||userExpansion)
  &&textKey(plain)&&textKey(plain)===textKey(rich)
}

function page(html,kind,row){
 requireCurrent(!hasClientDocumentBase(html),'unreviewed document base')
 const doc=readNativeDocument(html),root=one(doc.nodes(n=>n.tag==='root'),'document'),styles=[]
 const inspect=(node,namespace='html')=>{
  if(node.tag==='template'||node.tag==='object')return
  if(node.tag==='svg'||node.tag==='math')namespace=node.tag
  requireCurrent(!(node.tag==='script'&&namespace!=='html'),'unreviewed foreign program')
  requireCurrent(!Object.keys(node.attrs).some(name=>/^on[a-z]/i.test(name)),'unreviewed inline event program')
  requireCurrent(node.tag!=='style','unreviewed inline stylesheet')
  if(node.tag==='link'&&node.attrs.rel==='stylesheet')styles.push(node.attrs)
  for(const child of node.children)if(typeof child==='object')inspect(child,namespace==='svg'&&['foreignobject','desc','title'].includes(node.tag)?'html':namespace)
 }
 inspect(root)
 const programs=clientScriptDeclarations(html),inline=programs.filter(n=>!n.attrs.src),frames=[],bootstrap=[]
 for(const node of inline){
  requireCurrent(Object.keys(node.attrs).length===0,'inline declaration attributes')
  if(node.raw.startsWith('self.__next_f.push(')){
   const match=/^self\.__next_f\.push\(([\s\S]*)\);?$/.exec(node.raw)
   let value;try{value=JSON.parse(match?.[1])}catch{}
   requireCurrent(Array.isArray(value)&&value.length===2&&value[0]===1&&typeof value[1]==='string','literal Flight program')
   frames.push('<script>'+node.raw+'</script>')
  }else bootstrap.push(sha(node.raw))
 }
 const records=readLiteralFlightRecords(frames.join(''))
 requireCurrent(records instanceof Map,'literal Flight declarations')
 const imports=[...records.values()].filter(v=>v.raw.startsWith('I')).map(v=>JSON.parse(v.raw.slice(1))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 const plan={scripts:programs.filter(n=>n.attrs.src).map(n=>n.attrs),styles,imports,bootstrapSHA256:bootstrap,flightPrograms:[]}
 // Flight metadata can carry a JSON-LD script; executable additions are not
 // data and must not be admitted through a literal model frame.
 const visit=value=>{
  if(!value||typeof value!=='object')return
  if(Array.isArray(value)&&value[0]==='$'&&value[1]==='script'&&value[3]?.type!=='application/ld+json')plan.flightPrograms.push(value)
  for(const child of Object.values(value))visit(child)
 }
 for(const record of records.values())visit(record.value)
 requireCurrent(isDeepStrictEqual(plan,profile.plan[kind]),kind+' full current program declaration/import profile')
 const mainID={listing:66308,detail:49730,application:12533}[kind]
 const primary=[...records.entries()].filter(([,v])=>v.raw.startsWith('I')&&JSON.parse(v.raw.slice(1))[0]===mainID)
 const [primaryKey]=one(primary,'current route module')
 const references=[]
 const find=value=>{if(!value||typeof value!=='object')return
  if(Array.isArray(value)&&value[0]==='$'&&value[1]==='$L'+primaryKey)references.push(value[3])
  for(const child of Object.values(value))find(child)
 }
 for(const record of records.values())find(record.value)
 if(kind==='detail')requireCurrent(references.length===1&&references[0]?.id===row.id,'native route component ID binding')
 else requireCurrent(JSON.stringify([...records.values()].map(v=>v.value)).includes('$L'+primaryKey),'native route component activation')
 const schemas=[]
 const walk=value=>{if(Array.isArray(value)){value.forEach(walk);return}if(value&&typeof value==='object'){schemas.push(value);if(value['@graph'])walk(value['@graph'])}}
 for(const node of doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))walk(JSON.parse(node.raw))
 const organization=one(schemas.filter(v=>v['@type']==='Organization'&&v['@id']===ORIGIN+'/#organization'),'publisher Organization')
 requireCurrent(organization.name==='Quadeye'&&organization.url===ORIGIN,'publisher brand and origin')
 if(kind==='listing')requireCurrent(isDeepStrictEqual(activeHead(html).titles,['HFT, Quant & Software Engineering Jobs in India | Quadeye Careers']),'current careers title')
 if(kind==='application')requireCurrent(isDeepStrictEqual(activeHead(html).titles,['Apply | Quadeye']),'current application entry title')
 return {plan,organization,postings:schemas.filter(v=>v['@type']==='JobPosting')}
}

function inventory(payload){
 requireCurrent(payload?.success===true&&Array.isArray(payload.data)&&payload.data.length<=200
  &&Object.keys(payload).every(k=>['success','data','cached'].includes(k))&&(!Object.hasOwn(payload,'cached')||typeof payload.cached==='boolean'),'complete native inventory envelope')
 const seen=new Set(),candidates=[],dispositions=[],country={consistentIndia:0,explicitIndiaSourceRows:0,knownForeign:0,unknownOrMixed:0}
 for(const row of payload.data){
  requireCurrent(row&&typeof row==='object'&&!Array.isArray(row)&&typeof row.id==='string'&&/^\d{12,24}$/.test(row.id)
   &&!seen.has(row.id)&&typeof row.Posting_Title==='string'&&row.Posting_Title.trim(),'native record identity');seen.add(row.id)
  const disposition={id:row.id,nativeRecord:structuredClone(row)}
  if(Object.keys(row).some(k=>!profile.allowedNativeFields.includes(k))){dispositions.push({...disposition,reason:'unreviewed-native-field'});country.unknownOrMixed++;continue}
  if(row.Publish===false||/^(?:filled|closed|cancelled|canceled)$/i.test(row.Job_Opening_Status||'')){
   dispositions.push({...disposition,reason:'native-unpublished-or-closed'});continue
  }
  const nativeCountry=nativeCountryName(row.Country)
  if(nativeCountry==='India')country.explicitIndiaSourceRows++
  if(nativeCountry&&nativeCountry!=='India'){country.knownForeign++;dispositions.push({...disposition,reason:'explicit-native-foreign-country'});continue}
  const places=row.Job_Location,city=row.City,state=row.State
  const stableIndia=nativeCountry==='India'&&Array.isArray(places)&&places.length>0&&places.every(p=>typeof p==='string'&&/^(?:Gurugram|Gurgaon)$/i.test(p))
   &&(city==null||typeof city==='string'&&/^(?:Gurugram|Gurgaon|Gurgaon Kty\.)$/i.test(city))
   &&(state==null||typeof state==='string'&&/^(?:Haryana|Hariyana)$/i.test(state))&&row.Job_Opening_Status==='In-progress'&&row.Is_Locked===false&&row.Date_Closed===null
  if(!stableIndia){country.unknownOrMixed++;dispositions.push({...disposition,reason:'native-country-workplace-or-status-unqualified'});continue}
  country.consistentIndia++;candidates.push(row)
 }
 return {candidates,dispositions,country}
}

function qualify(row,posting,now){
 requireCurrent(posting.identifier?.name==='Quadeye'&&posting.identifier.value===row.id,'schema/native identifier binding')
 requireCurrent(posting.title===row.Posting_Title||posting.title===fix(row.Posting_Title),'schema/native title binding')
 const canonical=detailURL(row).split('?')[0]
 requireCurrent(posting.url===canonical&&posting['@id']===canonical+'#job','schema/current native URL binding')
 requireCurrent(posting.hiringOrganization?.name==='Quadeye'&&posting.hiringOrganization.sameAs===ORIGIN,'schema/native employer binding')
 requireCurrent(Array.isArray(posting.jobLocation)&&posting.jobLocation.length===1
  &&nativeCountryName(posting.jobLocation[0]?.address?.addressCountry)==='India'
  &&['Gurugram','Gurgaon'].includes(posting.jobLocation[0]?.address?.addressLocality),'schema/native explicit country binding')
 const opened=nativeDate(row.Date_Opened,{required:true}),target=nativeDate(row.Target_Date,{required:true})
 requireCurrent(posting.datePosted===opened.iso&&posting.validThrough===target.iso,'native/schema date binding')
 if(target.iso<opened.iso)return {reason:'native-expiry-precedes-posting',row,posting}
 requireCurrent(typeof row.Job_Description==='string'&&extractActiveDescription(row.Job_Description)&&textKey(row.Job_Description)===textKey(posting.description),'complete native/schema criteria mismatch')
 requireCurrent(posting.skills===row.Required_Skills&&posting.experienceRequirements===row.Work_Experience,'full native skills/experience mismatch')
 if(target.iso<=now)return {reason:'native-expired',row,posting}
 return {row,posting,opened,target}
}

export async function runCurrentQuadeye(options={}){
 options.signal?.throwIfAborted()
 const now=(options.now??(()=>new Date().toISOString()))(),cap=options.maxJobs??null
 requireCurrent(Number.isFinite(Date.parse(now))&&(cap==null||Number.isSafeInteger(cap)&&cap>=0&&cap<=200),'configured clock/result cap')
 const empty=()=>attachInventoryEvidence([],{status:'coverage-gap',surface:LIST,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,
  pagesFetched:0,verifiedAt:now,reason:'caller-cap-zero-no-public-observation'})
 if(cap===0)return empty()
 const allowed=new Set([LIST,API,...profile.assets.map(p=>p.url)]),io=currentQuadeyeTransport({...options,allowedURL:url=>allowed.has(url)})
 const round=async()=>{
  const root=await io.read(LIST),publisher=page(root.text,'listing'),assets=[]
  for(const expected of profile.assets){const p=await io.read(expected.url,expected.kind)
   requireCurrent(p.bodyBytes===expected.bytes&&p.bodySHA256===expected.sha256,'entire current program/stylesheet original profile '+expected.url)
   assets.push({url:expected.url,sha256:p.bodySHA256,bytes:p.bodyBytes})}
  const payload=(await io.read(API,'json')).value,native=inventory(payload),facts=[],exclusions=[...native.dispositions],failures=[],details=[]
  for(const row of native.candidates){
   const url=detailURL(row),apiURL=API+'/'+row.id;allowed.add(url);allowed.add(apiURL)
   const html=await io.read(url),visible=page(html.text,'detail',row),raw=(await io.read(apiURL,'json')).value
   requireCurrent(raw?.success===true&&raw.data&&Object.keys(raw).every(k=>['success','data','cached'].includes(k))
    &&(!Object.hasOwn(raw,'cached')||typeof raw.cached==='boolean'),'native detail envelope')
   const posting=one(visible.postings,'native JobPosting');details.push({id:row.id,row:raw.data,posting,publisher:visible.organization})
   let fact
   try{fact=qualify(row,posting,now)}catch(error){failures.push({stage:'native-detail',id:row.id,reason:error.message,nativeRecord:row,nativeJobPosting:posting});continue}
   // Contradictory dates are holds, with no criteria/completeness assertion.
   // Other records require full public criteria, preserving word boundaries,
   // and all native DTO fields.
   if(fact.reason!=='native-expiry-precedes-posting')requireCurrent(sameNativeViews(row,raw.data),'complete native listing/detail record model mismatch')
   if(fact.reason){(fact.reason==='native-expired'?exclusions:failures).push({stage:'native-detail',id:row.id,...fact});continue}
   const apply=applicationURL(row);allowed.add(apply)
   const entry=await io.read(apply),application=page(entry.text,'application')
   facts.push({...fact,nativeDetailRecord:raw.data,sourceURL:url,applyURL:apply,application:{...profile.application,entryURL:apply,routeBinding:{id:row.id,title:row.Posting_Title},
    programURL:ORIGIN+'/_next/static/chunks/40vnpj-77_vg-.js',programSHA256:profile.assets.find(p=>p.url.includes('/40vnpj')).sha256,declaredProgramModel:true,entryVerified:true,submissionPerformed:false},applicationPublisher:application.organization})
  }
  return {payload,native,facts,exclusions,failures,details,publisher:publisher.organization,assets}
 }
 try{
  const opening=await round(),closing=await round()
  requireCurrent(isDeepStrictEqual(opening.payload.data,closing.payload.data)&&isDeepStrictEqual(opening.native,closing.native)
   &&isDeepStrictEqual(opening.facts,closing.facts)&&isDeepStrictEqual(opening.details,closing.details)
   &&isDeepStrictEqual(opening.failures,closing.failures)&&isDeepStrictEqual(opening.exclusions,closing.exclusions)
   &&isDeepStrictEqual(opening.publisher,closing.publisher)&&isDeepStrictEqual(opening.assets,closing.assets),'closing full native inventory/detail/application model changed')
  const selected=cap==null?opening.facts:opening.facts.slice(0,cap),jobs=selected.map(fact=>({source:'quadeye',company:'QuadEye',jobId:fact.row.id,requisitionId:null,
   title:fix(fact.row.Posting_Title),nativeRawTitle:fact.row.Posting_Title,
   nativeDisplayTitleModel:{kind:'current-pinned-native-module-58846-fixJobText',input:fact.row.Posting_Title,output:fix(fact.row.Posting_Title),schemaTitle:fact.posting.title,
    programURL:ORIGIN+'/_next/static/chunks/3obtsu337u7qq.js',programSHA256:profile.assets.find(p=>p.url.includes('/3obtsu')).sha256},
   country:'India',city:'Gurugram',state:fact.row.State,location:'Gurugram, India',
   sourceUrl:fact.sourceURL,applyUrl:fact.applyURL,link:fact.applyURL,companyCareerPage:LIST,companyDomain:'quadeye.com',atsPlatform:'first-party-declared-zoho-proxy',
   jobDescription:fact.nativeDetailRecord.Job_Description,sourceRawDescription:fact.nativeDetailRecord.Job_Description,sourceSchemaDescription:fact.posting.description,
   experienceRequired:fact.row.Work_Experience,employmentType:fact.row.Job_Type,requiredSkills:fact.row.Required_Skills.split(',').map(s=>s.trim()).filter(Boolean),
   minimumQualification:null,preferredQualification:null,postingDate:fact.row.Date_Opened,closingDate:fact.row.Target_Date,sourceDatePrecision:'day',
   firstEverPublication:null,legalEmployer:null,sourceDetailComplete:true,sourceDescriptionInspected:true,sourceFullDescriptionPresent:true,
   nativeRoleClosingReconciled:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,browserEquivalenceComplete:false,
   nativeFacts:{nativeRecord:fact.row,nativeDetailRecord:fact.nativeDetailRecord,nativeJobPosting:fact.posting,nativeClosingRecord:closing.payload.data.find(r=>r.id===fact.row.id)},
   nativeApplicationModel:fact.application,applicationVisited:true,applicationSubmissionPerformed:false,publicEligibility:null,scrapedAt:now}))
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:LIST,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,
   pagesFetched:2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'paired-current-publisher-native-models;unknown-workplaces-and-native-date-contradictions-held;company-browser-scope-unverified'})
  attachSourceObservationEvidence(jobs,{source:'quadeye',recordKind:'vacancy-rows',observedRecordCount:opening.payload.data.length,
   observedVacancyCount:opening.payload.data.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  const detailExclusions=opening.exclusions.filter(r=>r.reason==='native-expired')
  const audit={...jobs.nativeCollectionEvidence,source:'quadeye',observedListingCount:opening.payload.data.length,candidateDetails:opening.native.candidates.length,
   extractedDetailJobs:jobs.length,excludedDetailJobs:detailExclusions.length,failures:[...opening.failures,...opening.facts.slice(jobs.length).map(fact=>({stage:'native-detail',id:fact.row.id,reason:'caller-result-cap',nativeRecord:fact.row}))],
   exclusions:detailExclusions,nativeListingDispositions:opening.native.dispositions,nativeCountryDispositions:opening.native.country,nativeOpeningInventory:opening.payload,nativeClosingInventory:closing.payload,
   nativeOpeningDetails:opening.details,nativeClosingDetails:closing.details,closingFullNativeInventoryMatch:true,listingPaginationComplete:true,
   closingInventoryMatches:true,retainedResponses:io.receipts,sourceScopeComplete:false,browserEquivalenceComplete:false,unknownPassiveContextComplete:false,lifecycleCleanupAllowed:false}
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:audit})
  jobs.forEach(job=>{job.nativeCollectionEvidence=audit})
  return jobs
 }finally{io.close()}
}
