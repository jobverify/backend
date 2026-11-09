import baselines from './native.scope.json' with {type:'json'}
import {createHash} from 'node:crypto'
import {createCurrentSourceScope,hasLiteralActiveKekaConfiguration,finishCurrentKekaInventory} from '../../scraper-support/shared/kekaCurrentSourceScope.js'
import {activeHead,readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {verifyGoogleSitesPublisher,nativePortalDocument} from './publisherChain.js'
import {inspectAssignedLocations} from './assignedLocations.js'

const ROOT='https://kidvento.keka.com/careers/',ID='79e3ba6e-9a27-4031-8af7-4c7bca97a921',OFFICIAL='https://www.kidvento.com/careers',HOME='https://www.kidvento.com/'
const BOARD=ROOT+'api/jobs/default/active',EMBED=ROOT+'api/embedjobs/default/active/'+ID,RENDERER=ROOT+'api/embedjobs/js/'+ID,PORTAL=ROOT+'api/organization/default/careerportalinfo'
const hash=v=>createHash('sha256').update(v).digest('hex'),clean=v=>typeof v==='string'?v.replace(/\s+/g,' ').trim():''
const canonical=v=>JSON.stringify(v,(_,r)=>r&&typeof r==='object'&&!Array.isArray(r)?Object.fromEntries(Object.keys(r).sort().map(k=>[k,r[k]])):r)
const fail=(ok,message)=>{if(!ok){const error=new Error('Kidvento native inventory: '+message);error.abortRetries=true;error.failureKind='parser_or_contract_error';throw error}}
const positive=v=>/^[1-9]\d*$/.test(String(v))&&Number.isSafeInteger(Number(v))
const recordFields=new Set(['id','title','departmentIdentifier','departmentName','description','excerpt','jobType','experience','salaryRange','salaryRangeFormat','publishedOn','publishedSinceDays','skillNames','jobLocations','jobNumber'])
const locationFields=new Set(['id','name','city','state','countryCode','countryName','locationIdentifier'])
const regions=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})

// The unchanged complete-inventory Keka engine requires both a native location
// ID and country on every alternative. This actual partial board violates that
// contract. This source-local validator does not feed it a filtered or rewritten
// HTTP body, invent IDs/countries, or claim the stronger engine's inventory proof.
function inspectRole(native){
 const schema=[]
 for(const key of recordFields)if(key!=='experience'&&!Object.hasOwn(native,key))schema.push(key+':missing')
 for(const key of Object.keys(native))if(!recordFields.has(key))schema.push(key)
 for(const key of ['departmentIdentifier','departmentName','jobNumber','salaryRangeFormat','excerpt','description'])if(typeof native[key]!=='string')schema.push(key+':type')
 if(Object.hasOwn(native,'experience')&&typeof native.experience!=='string')schema.push('experience:type')
 if(typeof native.departmentIdentifier!=='string'||!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(native.departmentIdentifier))schema.push('departmentIdentifier:identity')
 if(!Number.isSafeInteger(native.jobType)||native.jobType!==2)schema.push('jobType:type')
 if(!Array.isArray(native.skillNames)||native.skillNames.some(v=>!clean(v)))schema.push('skillNames:type')
 if(!clean(native.publishedOn)||!Number.isFinite(Date.parse(native.publishedOn)))schema.push('publishedOn:type')
 if(!Number.isSafeInteger(native.publishedSinceDays)||native.publishedSinceDays<0)schema.push('publishedSinceDays:type')
 if(!Array.isArray(native.jobLocations))schema.push('jobLocations:type')
 const salary=native.salaryRange,salaryFields=new Set(['minimum','maximum','currency','salaryPeriod','cultureInfo'])
 if(!salary||typeof salary!=='object'||Array.isArray(salary))schema.push('salaryRange:type')
 else{
  for(const key of ['currency','salaryPeriod','cultureInfo'])if(!Object.hasOwn(salary,key))schema.push('salaryRange.'+key+':missing')
  if(Object.hasOwn(salary,'minimum')!==Object.hasOwn(salary,'maximum'))schema.push('salaryRange.minimum/maximum:incomplete-pair')
  for(const [key,v] of Object.entries(salary))if(!salaryFields.has(key)||(['minimum','maximum','salaryPeriod'].includes(key)?typeof v!=='number'||!Number.isFinite(v):!clean(v)))schema.push('salaryRange.'+key+':type-or-field')
 }
 const places=[],seen=new Set();let unresolved=!Array.isArray(native.jobLocations)||!native.jobLocations.length
 if(Array.isArray(native.jobLocations))for(const [at,loc] of native.jobLocations.entries()){
  if(!loc||typeof loc!=='object'||Array.isArray(loc)){unresolved=true;continue}
  for(const key of Object.keys(loc))if(!locationFields.has(key)){schema.push(`jobLocations[${at}].${key}`);unresolved=true}
  for(const key of ['name','city','state','countryCode','countryName','locationIdentifier'])if(loc[key]!=null&&typeof loc[key]!=='string'){schema.push(`jobLocations[${at}].${key}:type`);unresolved=true}
  const hasId=Object.hasOwn(loc,'id'),name=clean(loc.name)||clean(loc.city),city=clean(loc.city)||clean(loc.name),code=clean(loc.countryCode).toUpperCase(),country=clean(loc.countryName)
  if(hasId){if(!positive(loc.id)||seen.has(String(loc.id))){unresolved=true;schema.push(`jobLocations[${at}].id`)}seen.add(String(loc.id))}
  // Optional ID absence is supported only by the observed explicit India
  // location shape; its absence is preserved in the native payload and output.
  if(!hasId&&(code!=='IN'||country!=='India'))unresolved=true
  if(!name||!city||(loc.state!=null&&typeof loc.state!=='string')||!/^[A-Z]{2}$/.test(code)||['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code)||!country){unresolved=true;continue}
  let expected;try{expected=regions.of(code)}catch{unresolved=true;continue}
  const aliases=code==='US'?['usa','united states of america']:code==='GB'?['uk']:[]
  if(!expected||expected===code||(expected.toLowerCase()!==country.toLowerCase()&&!aliases.includes(country.toLowerCase()))){unresolved=true;continue}
  if(loc.locationIdentifier!=null&&(typeof loc.locationIdentifier!=='string'||!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(loc.locationIdentifier))){unresolved=true;schema.push(`jobLocations[${at}].locationIdentifier`)}
  places.push({...loc,name,city,countryCode:code,countryName:country})
 }
 return {schema,places,unresolved}
}

function visibleDescription(value){
 if(typeof value!=='string')return {text:null,complete:false}
 const active=readNativeDocument(value),visible=readVisibleNativeDocument(value,{strict:true}),root=visible.nodes(n=>n.tag==='root')[0],text=root?clean(visible.text(root)):''
 let hiddenText=false
 function walk(node){if(typeof node==='string')return;if(node.inert&&node.children.some(v=>typeof v==='string'&&clean(v)))hiddenText=true;node.children.forEach(walk)}
 active.nodes(n=>n.tag==='root').forEach(walk)
 return {text:text||null,complete:!hiddenText&&Boolean(extractActiveDescription(value))&&text===clean(extractActiveDescription(value))&&text.length>=80}
}

function detailProof(native,html){
 const id=String(native.id),doc=readNativeDocument(html),visible=readVisibleNativeDocument(html,{strict:true}),head=activeHead(html),titles=visible.nodes(n=>n.tag==='h1'&&Object.hasOwn(n.attrs,'title')),descriptions=visible.nodes(n=>visible.hasClass(n,'job-description-container')),allDescriptions=doc.nodes(n=>doc.hasClass(n,'job-description-container')),ids=doc.nodes(n=>Object.hasOwn(n.attrs,'selectedjobid')),description=visibleDescription(native.description)
 const identity=ids.length>0&&ids.every(n=>n.attrs.selectedjobid===id)&&ids.every(n=>!n.attrs.selectedjobtitle||clean(n.attrs.selectedjobtitle)===clean(native.title))&&ids.every(n=>!n.attrs.selecteddepartmentidentifier||n.attrs.selecteddepartmentidentifier===native.departmentIdentifier)&&titles.length===1&&clean(visible.text(titles[0]))===clean(native.title)&&head.titles.length===1&&clean(head.titles[0])===clean(native.title)&&head.metas.filter(m=>m.property==='og:title').every(m=>clean(m.content)===clean(native.title))
 const criteria=description.complete&&descriptions.length===1&&allDescriptions.length===1&&clean(visible.text(descriptions[0]))===description.text
 const parents=new Map();function index(node){if(typeof node==='string')return;for(const child of node.children)if(typeof child==='object'){parents.set(child,node);index(child)}}visible.nodes(n=>n.tag==='root').forEach(index)
 const icons=visible.nodes(n=>visible.hasClass(n,'ki-location')),expectedLocations=Array.isArray(native.jobLocations)?native.jobLocations.map(l=>clean(l?.name)||clean(l?.city)).join(', '):null
 const geography=expectedLocations===null?false:expectedLocations?icons.length===1&&clean(visible.text(parents.get(icons[0])))===clean(expectedLocations):icons.length===0
 const reviewed=hash(html)===baselines.$detailHashes[ROOT+'jobdetails/'+id]
 return {id,identity,criteria,geography,reviewed,complete:identity&&criteria&&geography&&reviewed,sha256:hash(html),description:description.text}
}

export async function runNativeInventory(options={}){
 const {fetchImpl=fetch,signal,onAudit}=options;signal?.throwIfAborted()
 fail(!options.fetchPage&&!options.fetchText&&!options.fetchJson,'native HTTP metadata transport required');fail(options.maxJobs==null&&options.maxPages==null,'inventory caps unsupported')
 const scope=createCurrentSourceScope({baselines,kekaRootUrl:ROOT}),receipts=[]
 async function request(url){
  signal?.throwIfAborted();const deadline=signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)
  const response=await fetchImpl(url,{method:'GET',redirect:'manual',signal:deadline,headers:{'User-Agent':'JobverifyScraper/1.0',Accept:'application/json,text/html,application/javascript'}});deadline.throwIfAborted()
  fail(response?.status===200&&response.url===url,'HTTP status or response identity changed: '+url)
  const json=url.includes('/api/')&&!url.includes('/api/embedjobs/js/'),renderer=Object.hasOwn(baselines.$renderers,url)
  const contentType=response.headers?.get('content-type')||''
  fail(json?/^application\/json\b/i.test(contentType):renderer?/(?:java|ecma)script/i.test(contentType)||(url===RENDERER&&/^text\/js\b/i.test(contentType)):/^text\/html\b/i.test(contentType),'HTTP content type changed: '+url)
  fail(response.body?.getReader,'streaming native body unavailable');const reader=response.body.getReader(),chunks=[];let bytes=0
  try{for(;;){const {done,value}=await reader.read();deadline.throwIfAborted();if(done)break;bytes+=value.byteLength;fail(bytes<=4000000,'response budget exceeded');chunks.push(Buffer.from(value))}}catch(error){await reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
  const body=Buffer.concat(chunks).toString('utf8');receipts.push({url,status:response.status,responseUrl:response.url,bytes,sha256:hash(body)})
  if(renderer)scope.observeRenderer(url,body)
  if(Object.hasOwn(baselines,url)&&!json&&!renderer)scope.observe(url,body)
  return body
 }
 const parse=(body,label)=>{try{return JSON.parse(body)}catch{fail(false,'malformed native JSON '+label)}}
 async function surface(){
  const home=await request(HOME),head=activeHead(home);fail(head.titles.length===1&&head.titles[0]==='Home'&&head.metas.some(m=>m.property==='og:url'&&m.content===HOME),'official homepage identity changed')
  const publisher=await verifyGoogleSitesPublisher(request,baselines.$publisher),shell=await request(publisher.nativeShell),documentUrl=nativePortalDocument(shell,baselines),html=await request(documentUrl)
  fail(hasLiteralActiveKekaConfiguration(html,{identifier:ID,kekaRootUrl:ROOT}),'actual active portal configuration identity changed')
  const doc=readNativeDocument(html);fail(doc.nodes(n=>n.tag==='script'&&n.attrs.src===RENDERER).length===1,'actual active renderer missing')
  const renderer=await request(RENDERER)
  fail(['api/organization/${portalName}/careerportalinfo','api/embedjobs/${portalName}/active/','jobdetails/','job.jobLocations','khConfig.identifier'].every(s=>renderer.includes(s)),'native published renderer contract changed')
  const portal=parse(await request(PORTAL),'portal');fail(portal?.name==='Kidvento Education and Research'&&portal.shortName===portal.name&&portal.careersPortalDomain==='kidvento.keka.com','native employer identity changed')
  if(canonical(portal)!==canonical(baselines.$portal))scope.gaps.add('changed-native-portal-config')
  const groups=[];for(const url of [ROOT+'api/organization/grouplinkstatus',ROOT+'api/embedjobs/grouplinkstatus/'+ID]){const value=parse(await request(url),'group');groups.push(value);if(canonical(value)!=='{"isGroupLinked":false}')scope.gaps.add('unresolved-native-group:'+url)}
  return {publisher,documentUrl,portal,groups}
 }
 async function inventory(){const raw=parse(await request(BOARD),'board'),embedded=parse(await request(EMBED),'embedded');fail(Array.isArray(raw)&&Array.isArray(embedded),'invalid native inventory envelope');fail(canonical(raw)===canonical(embedded),'unfiltered board/embed inventory disagreement');const seen=new Set();for(const row of raw){const id=String(row?.id??'');fail(row&&typeof row==='object'&&!Array.isArray(row)&&positive(id)&&!seen.has(id)&&Boolean(clean(row.title)),'invalid or duplicate native job identity');seen.add(id)}return raw}
 const openingSurface=await surface(),raw=await inventory(),openingDetails=new Map()
 for(const native of raw){const html=await request(ROOT+'jobdetails/'+native.id);openingDetails.set(String(native.id),{html,proof:detailProof(native,html)})}
 const closingRaw=await inventory();if(canonical(raw)!==canonical(closingRaw))scope.gaps.add('closing-native-inventory-changed')
 const closingMap=new Map(closingRaw.map(r=>[String(r.id),r])),closingDetails=new Map()
 for(const native of raw){const current=closingMap.get(String(native.id))||native,html=await request(ROOT+'jobdetails/'+native.id);closingDetails.set(String(native.id),{html,proof:detailProof(current,html)})}
 const closingSurface=await surface();if(canonical(openingSurface)!==canonical(closingSurface))scope.gaps.add('closing-publisher-or-native-scope-changed')
 const unknown=[],jobs=[],allNativeDetailProofs=[]
 for(const native of raw){
  const id=String(native.id),info=inspectRole(native),assigned=inspectAssignedLocations(native.description,info.places),before=openingDetails.get(id),after=closingDetails.get(id),stable=canonical(native)===canonical(closingMap.get(id)),criteriaComplete=before.proof.complete&&after.proof.complete&&before.proof.sha256===after.proof.sha256&&stable,complete=criteriaComplete&&info.schema.length===0&&!assigned.unresolved&&!info.unresolved
  allNativeDetailProofs.push({id,complete,criteriaComplete,opening:before.proof,closing:after.proof,schemaGaps:info.schema,assignedLocationStatements:assigned.statements,stableNativeRole:stable})
  if(assigned.unresolved)scope.gaps.add('unresolved-JD-assigned-location:'+id)
  if(info.unresolved||info.schema.length){unknown.push(native);scope.gaps.add('unresolved-native-role:'+id)}
  if(!complete)scope.gaps.add('unreviewed-native-criteria:'+id)
  const india=info.places.filter(l=>l.countryCode==='IN');if(!india.length||info.unresolved)continue
  const primary=india[0],render=l=>[l.name,clean(l.state),l.countryName].filter(Boolean).join(', '),description=before.proof.description
  const job={source:'kidvento',company:'Kidvento Education and Research Private Limited',companyCareerPage:OFFICIAL,companyDomain:'kidvento.com',atsPlatform:'keka',jobId:id,requisitionId:clean(native.jobNumber)||id,title:clean(native.title),location:render(primary),locations:india.map(render),sourceNativeLocations:native.jobLocations,city:primary.city,state:clean(primary.state)||null,country:'India',sourceUrl:ROOT+'jobdetails/'+id,applyUrl:ROOT+'jobdetails/'+id,link:ROOT+'jobdetails/'+id,jobDescription:description,experienceRequired:clean(native.experience)||null,department:clean(native.departmentName)||null,employmentType:native.jobType===2?'Full Time':null,requiredSkills:Array.isArray(native.skillNames)?native.skillNames.filter(v=>clean(v)):[],postingDate:clean(native.publishedOn)&&Number.isFinite(Date.parse(native.publishedOn))?new Date(native.publishedOn).toISOString():null,closingDate:null,publicExperienceChecked:true,sourceDetailComplete:complete,sourceNativePayload:native,sourceNativeInventorySha256:hash(canonical(raw)),sourceNativeDescriptionSha256:typeof native.description==='string'?hash(native.description):null,sourceNativeDetailSha256:before.proof.sha256,sourceNativeClosingDetailSha256:after.proof.sha256,scrapedAt:new Date().toISOString()}
  job.sourceNativeCriteriaComplete=criteriaComplete;job.sourceAssignedLocationStatements=assigned.statements;job.sourceAssignedLocationsUnresolved=assigned.unresolved
  if(!complete){job.sourceDetailFailureKind='unverified-native-criteria-schema-or-assigned-geography';job.sourceNativeOpeningDetailHtml=before.html;job.sourceNativeClosingDetailHtml=after.html;job.sourceNativeSchemaGaps=info.schema}jobs.push(job)
 }
 let result=finishCurrentKekaInventory(jobs,{raw,unknown,scope,evidence:{surface:BOARD,firstParty:true,pagesFetched:receipts.length,verifiedAt:new Date().toISOString(),reason:'kidvento-actual-GoogleSites-publisher-chain-native-partial-inventory-all-details-opening-closing'}})
 const evidence=readInventoryEvidence(result);if(!evidence.listingComplete)result=attachInventoryEvidence(result,{...evidence,reportedTotal:null,indiaFacetCount:null})
 const audit={source:'kidvento',nativeTotal:raw.length,closingNativeTotal:closingRaw.length,returnedIndiaJobs:result.length,fullReturnedCriteria:result.filter(j=>j.sourceNativeCriteriaComplete).length,completeReturnedDetails:result.filter(j=>j.sourceDetailComplete).length,sourceScopeComplete:readInventoryEvidence(result).listingComplete,lifecycleCleanupAllowed:readInventoryEvidence(result).listingComplete,unresolvedCountryIds:unknown.map(r=>String(r.id)),sourceScopeGaps:[...scope.gaps],sourceNativeRaw:raw,sourceNativeClosingRaw:closingRaw,allNativeDetailProofs,openingSurface,closingSurface,receipts,productionWrites:false,websiteJavaScriptExecuted:false}
 Object.defineProperty(result,'sourceAudit',{value:audit});onAudit?.(structuredClone(audit));return result
}
