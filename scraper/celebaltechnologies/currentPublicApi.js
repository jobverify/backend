import {createHash} from 'node:crypto'
import {activeHead,readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {OFFICE_LOCATIONS_URL,hasPublishedOfficeHandoff,readIndiaOfficeWorksites} from './officeWorksites.js'

const origin='https://celebaltech.com',careers=origin+'/careers'
const api='https://celebal-connect-backend-prod-c2d0ghayhbgjhkc6.centralindia-01.azurewebsites.net/api/jobOpenings/'
const listClient=origin+'/_next/static/chunks/pages/careers-7794f93b5502d572.js'
const detailClients={
 [origin+'/_next/static/chunks/pages/careers/%5Bid%5D-98a56e5ce2d7e26b.js']:{sha256:'be3428682abdcd6ad34dc8c4411824e7bd3cb37b37f5168753215cffe99607b6',plainTextOnly:false},
 [origin+'/_next/static/chunks/pages/careers/%5Bid%5D-337a5d16861cc114.js']:{sha256:'f551c8cac732833001391d857155585daa7b777303093132865424731b563b08',plainTextOnly:true},
}
const hashes={
 [listClient]:'d8013145d710b9e631af135f51e9384f757fcebc1281e5b09f829f168f2b2442',
}
const roleFields=new Set(['area','createdAt','dbId','description','desiredSkills','exp','goodToHave','id','jobDetails','location','qualifications','responsibilities','skills','slug','status','title','workMode'])
const detailLabels={department:'Department',employmentType:'Employment type',areaOfInterest:'Area of interest',numberOfOpenings:'Number of openings',closingDate:'Closing date',ctcBand:'Compensation'}
const check=(condition,reason)=>{if(!condition)throw Error('Celebal current API '+reason)}
const hash=value=>createHash('sha256').update(value).digest('hex')
const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)
 ?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)
function nextData(html){
 const rows=readNativeDocument(html).nodes(node=>node.tag==='script'&&node.attrs.id==='__NEXT_DATA__'&&node.attrs.type==='application/json')
 if(rows.length!==1)return null
 try{return JSON.parse(rows[0].raw)}catch{return null}
}
function declares(html,url){
 const rows=readNativeDocument(html).nodes(node=>node.tag==='script'&&node.attrs.src).filter(node=>{
  try{return new URL(node.attrs.src,origin).href===url}catch{return false}
 })
 const allowed=new Set(['src','defer','async','type','nonce'])
 return rows.length===1&&Object.keys(rows[0].attrs).every(key=>allowed.has(key))
  &&(!rows[0].attrs.type||/^(?:text|application)\/(?:java|ecma)script$/i.test(rows[0].attrs.type.trim()))
}
export function usesCurrentCelebalApi(html){
 const data=nextData(html)
 // Only the retained pre-API deployment may use the older bundle path. A new
 // modern declaration must fail in this validator, never authorize stale roles.
 const legacy=data?.buildId==='t5vdeU8giC_kDI7abUy0F'&&declares(html,origin+'/_next/static/chunks/pages/careers-da0b8fda17caf48f.js')
 return data?.page==='/careers'&&!legacy||declares(html,listClient)
}
function publisher(html){
 const head=activeHead(html),data=nextData(html)
 check(head.titles.length===1&&head.titles[0]==='Careers - Celebal Technologies'
  &&head.metas.some(row=>row.name==='description'&&row.content==='Empower the future you imagine')
  &&data?.page==='/careers'&&typeof data.buildId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(data.buildId)&&data.isFallback===false&&declares(html,listClient),'publisher surface or declared client contract changed')
 return data.buildId
}
function detailDeclaration(html,publisherBuild){
 const data=nextData(html),clients=readNativeDocument(html).nodes(node=>node.tag==='script'&&node.attrs.src).map(node=>{
  try{return new URL(node.attrs.src,origin).href}catch{return null}
 }).filter(url=>url&&url.startsWith(origin+'/_next/static/chunks/pages/careers/')&&/\/(?:%5Bid%5D|\[id\])-[a-f0-9]+\.js$/.test(url))
 check(data?.page==='/careers/[id]'&&data.buildId===publisherBuild&&data.isFallback===false
  &&clients.length===1&&Object.hasOwn(detailClients,clients[0])&&declares(html,clients[0]),'native detail client handoff changed')
 return clients[0]
}
function inventory(text){
 const value=JSON.parse(text)
 check(value&&Object.keys(value).length===1&&Array.isArray(value.data),'inventory pagination or envelope changed')
 const ids=new Set(),databaseIds=new Set()
 for(const row of value.data){
  check(row&&/^[a-z0-9-]+$/.test(row.id)&&Number.isSafeInteger(row.dbId)&&row.dbId>0
   &&typeof row.title==='string'&&row.title.trim()&&typeof row.location==='string'&&row.location.trim()
   &&typeof row.status==='string'&&!ids.has(row.id)&&!databaseIds.has(row.dbId),'inventory role identity changed or repeated')
  check(Object.keys(row).every(field=>roleFields.has(field)),'inventory native field contract changed; country or scope requires review')
  check(row.jobDetails==null||typeof row.jobDetails==='object'&&!Array.isArray(row.jobDetails)
   &&Object.entries(row.jobDetails).every(([field,value])=>Object.hasOwn(detailLabels,field)&&(value==null||['string','number'].includes(typeof value))),'inventory native job details or country contract changed')
  ids.add(row.id);databaseIds.add(row.dbId)
 }
 return value.data
}
const snapshot=rows=>canonical([...rows].sort((a,b)=>a.dbId-b.dbId))
function workplace(role){
 const label=role.location.trim()
 return /^India \(Jaipur\)(?:\s*[\u2013\u2014-]\s*co-location with the core team expected)?$/i.test(label)?{method:'literal-native-India-workplace',nativeRoleLocation:label}:null
}
function fullCriteria(row,plainTextOnly){
 return typeof row.description==='string'&&row.description.trim().length>=120
  &&['skills','responsibilities','qualifications','desiredSkills','goodToHave'].every(field=>Array.isArray(row[field])&&row[field].every(value=>typeof value==='string'))
  &&row.responsibilities.some(value=>value.trim())&&row.qualifications.some(value=>value.trim())
  &&[row.description,...row.skills,...row.responsibilities,...row.qualifications,...row.desiredSkills,...row.goodToHave].every(value=>(!plainTextOnly||!/[<>]/.test(value))&&readableCriterion(value))
}
const criterionTags=new Set(['root','p','div','span','br','strong','em','b','i','u','s','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote','pre','code','table','thead','tbody','tfoot','tr','th','td','dl','dt','dd'])
const unstyledCriterion=node=>typeof node==='string'||criterionTags.has(node.tag)&&!node.nativeTagUnqualified&&Object.keys(node.attrs).length===0&&node.children.every(unstyledCriterion)
function readableCriterion(value){
 if(!value.trim())return true
 const active=readNativeDocument(value),visible=readVisibleNativeDocument(value,{strict:true}),root=active.nodes(node=>node.tag==='root')[0],visibleRoot=visible.nodes(node=>node.tag==='root')[0]
 const raw=node=>typeof node==='string'?decodeNativeEntities(node):typeof node.raw==='string'?decodeNativeEntities(node.raw):node.children.map(raw).join(' ')
 const normalize=text=>text.replace(/\s/g,'')
 return Boolean(root&&visibleRoot&&unstyledCriterion(root)&&normalize(raw(root))===normalize(active.text(root))&&normalize(raw(root))===normalize(visible.text(visibleRoot)))
}
function closingDate(row){
 const value=row.jobDetails?.closingDate
 if(value==null||value==='')return null
 const match=/^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
 check(match,'native detail closing date changed')
 const date=`${match[3]}-${match[2]}-${match[1]}`
 check(Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date,'native detail closing date invalid')
 return date
}
// The exact reviewed list client fetches every native record once and selects
// status=live. Both reviewed role clients bind getJob/<encoded route id> and
// render every native criteria field. The newer description/responsibilities
// renderer accepts plain text/markdown, so this validator holds authored HTML.
// Bundled fallback roles never establish live proof. Build IDs only reconcile
// the active opening, role and closing deployment; exact program bytes authorize.
export async function readCurrentCelebalApi({html,readText,normalizeRole,now,maxJobs}){
 const publisherBuild=publisher(html)
 let pagesFetched=1
 const read=async url=>{pagesFetched++;return readText(url)}
 const program=async url=>{const code=await read(url);check(hash(code)===(hashes[url]??detailClients[url]?.sha256),'declared client program contract changed');return code}
 await program(listClient)
 const opening=inventory(await read(api+'getAllJobs')),live=opening.filter(row=>row.status.toLowerCase()==='live')
 let detailClient=null
 if(live.length){
  detailClient=detailDeclaration(await read(careers+'/'+live[0].id),publisherBuild)
  await program(detailClient)
 }
 let offices=null,officeFailure=null
 if(hasPublishedOfficeHandoff(html)){
  const officeHtml=await read(OFFICE_LOCATIONS_URL)
  try{offices=readIndiaOfficeWorksites(officeHtml)}catch(error){officeFailure=error.message}
 }else officeFailure='current publisher has no native India office handoff'
 const qualified=live.map(row=>({row,countryEvidence:workplace(row,offices)})).filter(item=>item.countryEvidence)
 const selected=Number.isInteger(maxJobs)&&maxJobs>0?qualified.slice(0,maxJobs):qualified
 const observedAt=now(),jobs=[],details=new Map(),criteriaHolds=[]
 for(const{row,countryEvidence}of selected){
  const value=JSON.parse(await read(api+'getJob/'+encodeURIComponent(row.id)))
  check(value&&Object.keys(value).length===1&&value.data&&canonical(value.data)===canonical(row),'native active detail identity, country or criteria mismatch')
  const detail=value.data
  details.set(detail.id,detail)
  if(!fullCriteria(detail,detailClients[detailClient].plainTextOnly)){criteriaHolds.push(detail.id);continue}
  check(typeof detail.createdAt==='string'&&Number.isFinite(Date.parse(detail.createdAt))&&Date.parse(detail.createdAt)<=Date.parse(observedAt),'native detail posting date changed')
  const closes=closingDate(detail)
  check(!closes||closes>=observedAt.slice(0,10),'native active detail has expired')
  const job=normalizeRole(detail,{now:()=>observedAt,countryEvidence})
  const additional=Object.entries(detail.jobDetails||{}).filter(([,value])=>value!=null&&String(value).trim())
   .map(([field,value])=>`${detailLabels[field]}: ${value}`)
  if(additional.length)job.jobDescription+='\n\n'+additional.join('\n')
  if(detail.jobDetails?.employmentType?.trim())job.employmentType=detail.jobDetails.employmentType.trim()
  if(detail.jobDetails?.department?.trim())job.department=detail.jobDetails.department.trim()
  jobs.push({...job,postingDate:detail.createdAt,closingDate:closes,sourceNativeRecord:detail,
   sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
 }
 const closing=inventory(await read(api+'getAllJobs'))
 check(snapshot(opening)===snapshot(closing),'closing whole native inventory or criteria changed')
 const closingHtml=await read(careers);check(publisher(closingHtml)===publisherBuild,'closing publisher deployment changed')
 await program(listClient)
 if(live.length){
  check(detailDeclaration(await read(careers+'/'+live[0].id),publisherBuild)===detailClient,'closing native detail client handoff changed')
  await program(detailClient)
 }
 if(offices){
  check(hasPublishedOfficeHandoff(closingHtml),'closing native India office handoff changed')
  const closingOffices=readIndiaOfficeWorksites(await read(OFFICE_LOCATIONS_URL))
  check(closingOffices.model===offices.model,'closing native India office country evidence changed')
 }else if(hasPublishedOfficeHandoff(closingHtml))await read(OFFICE_LOCATIONS_URL)
 const unknown=live.filter(row=>!workplace(row,offices)).map(row=>({jobId:row.id,location:row.location}))
 const audit={source:'celebaltechnologies',recordKind:'vacancy-rows',observedRecordCount:opening.length,observedVacancyCount:opening.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
  publisherBuild,nativeListClient:{url:listClient,sha256:hashes[listClient]},nativeDetailClient:detailClient?{url:detailClient,sha256:detailClients[detailClient].sha256,plainTextOnly:detailClients[detailClient].plainTextOnly}:null,
  candidateRoles:live.length,rawNativeRecords:opening.length,returnedIndia:jobs.length,openingClosingStable:true,unknownCountry:unknown,officeFailure,criteriaHolds,requestedSample:selected.length<qualified.length,
  observations:opening.map(row=>({nativeSourceRecord:row,nativeDetailRecord:details.get(row.id)??null,sourceScopeComplete:false,lifecycleCleanupAllowed:false})),closingRecords:closing}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 attachSourceObservationEvidence(jobs,audit)
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',firstParty:true,listingComplete:false,surface:careers,
  lifecycleCleanupAllowed:false,
  pagesFetched,reportedTotal:live.length,indiaFacetCount:null,verifiedAt:now(),reason:'reviewed-current-native-API-and-full-details; closing-full-records-and-office-countries-reconciled; unqualified-compound-workplaces-or-company-scope-remain'})
}
